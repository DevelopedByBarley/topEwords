<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AiUsageService
{
    public const WARNING_THRESHOLD_PERCENT = 80;

    public function allows(User $user): bool
    {
        $this->resetIfDue($user);

        $limit = $user->aiMonthlyLimit();

        return $limit === null || $user->ai_credits_used < $limit;
    }

    public function reserve(User $user, int $estimatedMicros): bool
    {
        $this->resetIfDue($user);

        if ($user->aiMonthlyLimit() === null) {
            return true;
        }

        $estimate = max(1, $estimatedMicros);

        $consumed = User::whereKey($user->getKey())
            ->where('ai_credits_used', '<=', $user->aiMonthlyLimit() - $estimate)
            ->increment('ai_credits_used', $estimate);

        if ($consumed === 0) {
            return false;
        }

        $user->ai_credits_used += $estimate;

        return true;
    }

    public function settle(User $user, int $estimatedMicros, int $actualMicros): void
    {
        if ($user->aiMonthlyLimit() === null) {
            return;
        }

        $this->adjust($user, max(0, $actualMicros) - max(1, $estimatedMicros));
    }

    public function refund(User $user, int $estimatedMicros): void
    {
        if ($user->aiMonthlyLimit() === null) {
            return;
        }

        $this->adjust($user, -max(1, $estimatedMicros));
    }

    private function adjust(User $user, int $deltaMicros): void
    {
        if ($deltaMicros > 0) {
            User::whereKey($user->getKey())->increment('ai_credits_used', $deltaMicros);
        } elseif ($deltaMicros < 0) {
            User::whereKey($user->getKey())->update([
                'ai_credits_used' => DB::raw(
                    'CASE WHEN ai_credits_used > '.(-$deltaMicros).
                    ' THEN ai_credits_used - '.(-$deltaMicros).' ELSE 0 END'
                ),
            ]);
        }

        $user->ai_credits_used = max(0, (int) $user->ai_credits_used + $deltaMicros);
    }

    /**
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
     * @return array{level: 'low'|'exhausted', remaining_percent: int, reset_at: string}|null
     */
    public function warning(User $user): ?array
    {
        $snapshot = $this->snapshot($user);

        if ($snapshot['unlimited'] || $snapshot['percent'] < self::WARNING_THRESHOLD_PERCENT) {
            return null;
        }

        $limit = (int) $snapshot['limit'];
        $remaining = (int) $snapshot['remaining'];

        return [
            'level' => $remaining === 0 ? 'exhausted' : 'low',
            'remaining_percent' => $limit > 0 ? (int) ceil($remaining / $limit * 100) : 0,
            'reset_at' => $snapshot['reset_at'],
        ];
    }

    private function resetIfDue(User $user): void
    {
        if ($user->ai_credits_reset_at !== null && $user->ai_credits_reset_at->isFuture()) {
            return;
        }

        $nextReset = $this->nextReset();

        User::whereKey($user->getKey())->update([
            'ai_credits_used' => 0,
            'ai_credits_reset_at' => $nextReset,
        ]);

        $user->ai_credits_used = 0;
        $user->ai_credits_reset_at = $nextReset;
    }

    private function nextReset(): Carbon
    {
        return Carbon::now()->startOfMonth()->addMonth();
    }
}
