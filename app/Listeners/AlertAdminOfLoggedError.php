<?php

namespace App\Listeners;

use App\Notifications\ApplicationErrorDetected;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Error szintű (vagy súlyosabb) log-bejegyzésről riasztja az admint. Enélkül egy prod-beli
 * exception csak a laravel.log-ban landolna, és senki nem értesülne róla. Csak prodban él,
 * és a riasztást óránként egyre fogjuk, hogy egy beragadt hiba ne árassza el a postafiókot —
 * a levél ezért azt jelzi, hogy "van baj", a részletek a szerver logjában vannak.
 */
class AlertAdminOfLoggedError
{
    private const THROTTLE_CACHE_KEY = 'error-monitoring:alerted';

    private const ALERT_LEVELS = ['emergency', 'alert', 'critical', 'error'];

    public function handle(MessageLogged $event): void
    {
        if (! in_array($event->level, self::ALERT_LEVELS, true)) {
            return;
        }

        if (! app()->isProduction()) {
            return;
        }

        $adminEmail = config('app.admin_email');

        if (! $adminEmail) {
            return;
        }

        try {
            // A Cache::add atomi, és MÉG a küldés előtt zárja a throttle-t: ha maga a
            // levélküldés hibázna és errort logolna, az újra ide futó hívás már itt kiesik.
            if (! Cache::add(self::THROTTLE_CACHE_KEY, true, now()->addHour())) {
                return;
            }

            // Szándékosan szinkron küldés (notifyNow): ha épp a queue/worker a beteg,
            // a queue-ra bízott riasztás sosem érne célba.
            Notification::route('mail', $adminEmail)
                ->notifyNow(new ApplicationErrorDetected(
                    $event->level,
                    str((string) $event->message)->limit(500)->toString(),
                    $this->exceptionSummary($event->context),
                ));
        } catch (Throwable) {
            // A riasztó nem dobhat tovább (az eredeti kérést törné el), és errort sem
            // logolhat (az újra ezt a listenert hívná) — a hibát némán elnyeljük.
        }
    }

    /**
     * A log-kontextusban utazó kivételből emberi összefoglalót készít (osztály + hely).
     *
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
