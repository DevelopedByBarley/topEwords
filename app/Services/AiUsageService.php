<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;

class AiUsageService
{
    /**
     * Whether the user may make another AI call this period.
     */
    public function allows(User $user): bool
    {
        $this->resetIfDue($user);

        $limit = $user->aiMonthlyLimit();

        return $limit === null || $user->ai_credits_used < $limit;
    }

    /**
     * Record AI cost (call after a successful AI request) in micro-dollars,
     * as computed from the Gemini response's token usage.
     */
    public function record(User $user, int $costMicros): void
    {
        $this->resetIfDue($user);

        // Korlátlan (admin) felhasználónál nincs értelme számolni.
        if ($user->aiMonthlyLimit() === null || $costMicros <= 0) {
            return;
        }

        $user->increment('ai_credits_used', $costMicros);
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
