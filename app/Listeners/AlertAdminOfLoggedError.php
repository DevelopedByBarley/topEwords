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
 * és a riasztást két rétegben fogjuk, hogy se egy beragadt hiba, se egy incidens-burst ne
 * árassza el a postafiókot — a levél ezért azt jelzi, hogy "van baj", a részletek a szerver
 * logjában vannak.
 */
class AlertAdminOfLoggedError
{
    private const THROTTLE_CACHE_PREFIX = 'error-monitoring:alerted:';

    /**
     * A per-hiba dedup mellett futó globális óránkénti plafon: egy incidens-burst, ahol a
     * hibák üzenete kérésenként változik (Stripe/Billingo timeout URL-lel, SQL-érték a
     * QueryExceptionben), így minden példány külön dedup-kulcsot kapna — enélkül több száz
     * levelet küldene egy pár perc alatt. A plafon alatt minden különböző hiba átmegy,
     * felette a részletek már csak a szerver logjában landolnak.
     */
    private const GLOBAL_BURST_CACHE_KEY = 'error-monitoring:global-burst';

    private const GLOBAL_BURST_LIMIT_PER_HOUR = 10;

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
            // 1. réteg — per-hiba dedup. A Cache::add atomi, és MÉG a küldés előtt zárja a
            // throttle-t: ha maga a levélküldés hibázna és errort logolna, az újra ide futó
            // hívás már itt kiesik. A kulcs a szintet + üzenetet is tartalmazza, így egy órán
            // belül minden KÜLÖNBÖZŐ hiba külön riasztást ad (nem nyeli el a második, más okú
            // bajt), miközben ugyanaz a beragadt hiba óránként legfeljebb egyszer szól.
            if (! Cache::add($this->throttleKey($event), true, now()->addHour())) {
                return;
            }

            // 2. réteg — globális burst-plafon. Ha a hibák üzenete kérésenként változik, az
            // 1. réteg minden példányt átengedne; ez a plafon fogja a teljes áradatot óránként
            // GLOBAL_BURST_LIMIT_PER_HOUR levélre. A számlálót csak akkor léptetjük, ha a
            // dedup már átengedte a hibát (különben az ismétlődések is fogyasztanák a keretet).
            if ($this->globalBurstExhausted()) {
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
     * A throttle-kulcs hibánként egyedi: a szint és az üzenet hashe különbözteti meg az
     * eltérő hibákat, hogy az óránkénti fojtás típusonként külön számoljon.
     */
    private function throttleKey(MessageLogged $event): string
    {
        return self::THROTTLE_CACHE_PREFIX.$event->level.':'.md5((string) $event->message);
    }

    /**
     * Igaz, ha a globális óránkénti riasztás-keret betelt. Az első hívás fix egyórás TTL-lel
     * inicializálja a számlálót (a Cache::add nem nyúl a TTL-hez, ha a kulcs már létezik, így
     * az óra-ablak nem csúszik minden hibával), utána atomi incrementtel lép — a küszöb
     * elérése után minden további riasztást elnyel.
     */
    private function globalBurstExhausted(): bool
    {
        Cache::add(self::GLOBAL_BURST_CACHE_KEY, 0, now()->addHour());

        return Cache::increment(self::GLOBAL_BURST_CACHE_KEY) > self::GLOBAL_BURST_LIMIT_PER_HOUR;
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
