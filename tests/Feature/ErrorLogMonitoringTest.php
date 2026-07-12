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

test('az error-riasztás óránként legfeljebb egyszer megy ki', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);
    simulateProduction();

    Log::error('első hiba');
    Log::error('második hiba');

    Notification::assertSentOnDemandTimes(ApplicationErrorDetected::class, 1);
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
