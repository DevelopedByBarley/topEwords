<?php

use App\Notifications\ApplicationErrorDetected;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Az error-riasztás csak prodban él — a tesztkörnyezetet ideiglenesen prodnak álcázzuk.
 * Az app példány tesztenként újraépül, így a beállítás nem szivárog át a többi tesztbe.
 */
function simulateProduction(): void
{
    app()['env'] = 'production';
}

test('prod-beli error szintű logról e-mail riasztás megy az adminnak', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    Log::error('Billingo API 500');

    Notification::assertSentOnDemand(
        ApplicationErrorDetected::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'admin@example.com'
            && $notification->level === 'error'
            && str_contains($notification->message, 'Billingo API 500')
    );
});

test('a kivétel osztálya és helye bekerül a riasztásba', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    Log::error('Kezeletlen kivétel', ['exception' => new RuntimeException('bumm')]);

    Notification::assertSentOnDemand(
        ApplicationErrorDetected::class,
        fn ($notification) => str_contains((string) $notification->exceptionSummary, RuntimeException::class)
    );
});

test('ugyanaz a hiba óránként legfeljebb egyszer riaszt', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    Log::error('ismétlődő beragadt hiba');
    Log::error('ismétlődő beragadt hiba');

    Notification::assertSentOnDemandTimes(ApplicationErrorDetected::class, 1);
});

test('két különböző hiba egy órán belül külön-külön riaszt', function () {
    // A throttle korábban egyetlen közös kulcson osztozott: egy órán belül a MÁSODIK,
    // más okú kritikus hiba (pl. dupla terhelés az ismeretlen-customer után) némán kimaradt.
    // A szint+üzenet szerinti kulccsal mindkettő eljut az adminhoz.
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    Log::error('ismeretlen customer — NAV-számla kézzel');
    Log::error('duplikált előfizetés — ellenőrizd a refundot');

    Notification::assertSentOnDemandTimes(ApplicationErrorDetected::class, 2);
});

test('a kérésenként változó üzenetű hiba-áradat nem árasztja el a postafiókot', function () {
    // Regresszió-védő: a per-üzenet dedup önmagában minden változó szövegű 500-at átengedne
    // (Stripe/Billingo timeout URL-lel, SQL-érték a QueryExceptionben). A globális óránkénti
    // burst-plafon fogja az áradatot — 30 különböző hibából legfeljebb a plafonnyi riaszt.
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    foreach (range(1, 30) as $i) {
        Log::error("cURL timeout https://api.stripe.com/v1/... kérés #{$i}");
    }

    Notification::assertSentOnDemandTimes(ApplicationErrorDetected::class, 10);
});

test('error alatti szintű log nem riaszt', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    Log::warning('csak figyelmeztetés');
    Log::info('csak info');

    Notification::assertNothingSent();
});

test('nem prod környezetben nincs riasztás', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    Log::error('lokális hiba');

    Notification::assertNothingSent();
});

test('ADMIN_EMAIL nélkül a riasztás némán kimarad', function () {
    Notification::fake();
    config(['app.admin_email' => null]);
    simulateProduction();

    Log::error('hiba admin nélkül');

    Notification::assertNothingSent();
});
