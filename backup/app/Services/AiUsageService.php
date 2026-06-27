<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

class AiUsageService
{
    /**
     * Whether the user may make another AI call this period. This is a fast,
     * non-atomic pre-check for UX (so the UI can show a 429 immediately); the
     * authoritative, race-safe enforcement happens in reserve().
     */
    public function allows(User $user): bool
    {
        $this->resetIfDue($user);

        $limit = $user->aiMonthlyLimit();

        return $limit === null || $user->ai_credits_used < $limit;
    }

    /**
     * Atomically reserve estimated budget for one upcoming AI call. Returns
     * false if the user is already at/over their limit (the call must then be
     * refused). Unlimited users (admins) always pass without being charged.
     *
     * The reservation is what makes budget enforcement race-safe: each
     * concurrent call consumes its estimate via a single conditional UPDATE
     * before its API request runs, so they cannot all pass a stale "under
     * limit" check and overspend (TOCTOU). The reservation is reconciled to the
     * real cost by settle(), or released by refund() if the call fails.
     */
    public function reserve(User $user, int $estimatedMicros): bool
    {
        $this->resetIfDue($user);

        if ($user->aiMonthlyLimit() === null) {
            return true; // unlimited (admin)
        }

        $estimate = max(1, $estimatedMicros);

        $consumed = User::whereKey($user->getKey())
            ->where('ai_credits_used', '<', $user->aiMonthlyLimit())
            ->increment('ai_credits_used', $estimate);

        if ($consumed === 0) {
            return false;
        }

        $user->ai_credits_used += $estimate; // keep the in-memory model in sync

        return true;
    }

    /**
     * Reconcile a reservation to the actual cost after a successful AI call.
     */
    public function settle(User $user, int $estimatedMicros, int $actualMicros): void
    {
        if ($user->aiMonthlyLimit() === null) {
            return;
        }

        $this->adjust($user, max(0, $actualMicros) - max(1, $estimatedMicros));
    }

    /**
     * Release a reservation when the AI call ultimately failed.
     */
    public function refund(User $user, int $estimatedMicros): void
    {
        if ($user->aiMonthlyLimit() === null) {
            return;
        }

        $this->adjust($user, -max(1, $estimatedMicros));
    }

    /**
     * Apply a signed delta to the usage counter atomically.
     */
    private function adjust(User $user, int $deltaMicros): void
    {
        if ($deltaMicros > 0) {
            User::whereKey($user->getKey())->increment('ai_credits_used', $deltaMicros);
        } elseif ($deltaMicros < 0) {
            User::whereKey($user->getKey())->decrement('ai_credits_used', -$deltaMicros);
        }

        $user->ai_credits_used = max(0, (int) $user->ai_credits_used + $deltaMicros);
    }

    /**
     * Usage snapshot for display to the user. Amounts are micro-dollars;
     * `percent` is the share of the monthly budget consumed.
     *
     * @return array{used: int, limit: int|null, remaining: int|null, reset_at: string, unlimited: bool, percent: int}
     */
    public function snapshot(User $user): array
    {
        $this->resetIfDue($user);

        $limit = $user->aiMonthlyLimit();
        $used = (int) $user->ai_credits_used;

        return [
            'used' => $used,
            'limit' => $limit,
            'remaining' => $limit === null ? null : max(0, $limit - $used),
            'reset_at' => $this->nextReset()->toIso8601String(),
            'unlimited' => $limit === null,
            'percent' => $limit && $limit > 0 ? min(100, (int) round($used / $limit * 100)) : 0,
        ];
    }

    /**
     * Reset the counter when the current period has elapsed (calendar month).
     */
    private function resetIfDue(User $user): void
    {
        if ($user->ai_credits_reset_at !== null && $user->ai_credits_reset_at->isFuture()) {
            return;
        }

        $user->forceFill([
            'ai_credits_used' => 0,
            'ai_credits_reset_at' => $this->nextReset(),
        ])->save();
    }

    /**
     * The next reset moment — the first day of next month at 00:00.
     */
    private function nextReset(): Carbon
    {
        return Carbon::now()->startOfMonth()->addMonth();
    }
}
