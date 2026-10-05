<?php

namespace App\Listeners;

use App\Notifications\ApplicationErrorDetected;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Throwable;

class AlertAdminOfLoggedError
{
    private const THROTTLE_CACHE_PREFIX = 'error-monitoring:alerted:';

    private const GLOBAL_BURST_CACHE_KEY = 'error-monitoring:global-burst';

    private const GLOBAL_BURST_LIMIT_PER_HOUR = 10;

    private const ALERT_LEVELS = ['emergency', 'alert', 'critical', 'error'];

    public function handle(MessageLogged $event): void
    {
        if (! in_array($event->level, self::ALERT_LEVELS, true)) {
            return;
        }

        if (! app()->environment(['production', 'staging'])) {
            return;
        }

        $adminEmail = config('app.admin_email');

        if (! $adminEmail) {
            return;
        }

        try {
            if (! Cache::add($this->throttleKey($event), true, now()->addHour())) {
                return;
            }

            if ($this->globalBurstExhausted()) {
                return;
            }

            Notification::route('mail', $adminEmail)
                ->notifyNow(new ApplicationErrorDetected(
                    $event->level,
                    str((string) $event->message)->limit(500)->toString(),
                    $this->exceptionSummary($event->context),
                ));
        } catch (Throwable) {
        }
    }

    private function throttleKey(MessageLogged $event): string
    {
        return self::THROTTLE_CACHE_PREFIX.$event->level.':'.md5((string) $event->message);
    }

    private function globalBurstExhausted(): bool
    {
        Cache::add(self::GLOBAL_BURST_CACHE_KEY, 0, now()->addHour());

        return Cache::increment(self::GLOBAL_BURST_CACHE_KEY) > self::GLOBAL_BURST_LIMIT_PER_HOUR;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function exceptionSummary(array $context): ?string
    {
        $exception = $context['exception'] ?? null;

        if (! $exception instanceof Throwable) {
            return null;
        }

        return $exception::class.' @ '.$exception->getFile().':'.$exception->getLine();
    }
}
