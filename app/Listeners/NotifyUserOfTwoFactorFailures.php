<?php

namespace App\Listeners;

use App\Models\User;
use App\Notifications\TwoFactorChallengeFailing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

class NotifyUserOfTwoFactorFailures
{
    public const THRESHOLD = 5;

    private const CACHE_KEY_PREFIX = 'two-factor-failures';

    public function __construct(private Request $request) {}

    public function handle(TwoFactorAuthenticationFailed $event): void
    {
        $user = $event->user;

        if (! $user instanceof User) {
            return;
        }

        $cacheKey = self::CACHE_KEY_PREFIX.":{$user->id}";

        Cache::add($cacheKey, 0, now()->addHour());
        $failures = (int) Cache::increment($cacheKey);

        if ($failures !== self::THRESHOLD) {
            return;
        }

        Log::warning('Sorozatos hibás kétlépcsős kód', [
            'user_id' => $user->id,
            'failures' => $failures,
            'ip' => $this->request->ip(),
        ]);

        $user->notifyNow(new TwoFactorChallengeFailing($failures, $this->request->ip()));
    }
}
