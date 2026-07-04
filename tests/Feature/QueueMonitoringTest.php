<?php

use App\Notifications\FailedJobsDetected;
use App\Notifications\QueueBacklogDetected;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

function insertFailedJob(string $displayName = 'App\\Jobs\\GenerateBillingoInvoice'): int
{
    return (int) DB::table('failed_jobs')->insertGetId([
        'uuid' => (string) Str::uuid(),
        'connection' => 'database',
        'queue' => 'default',
        'payload' => json_encode(['displayName' => $displayName]),
        'exception' => "RuntimeException: Billingo 500\n#0 stacktrace...",
        'failed_at' => now(),
    ]);
}

test('új elbukott jobról e-mail riasztás megy az adminnak', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    insertFailedJob();

    $this->artisan('queue:alert-failed')->assertExitCode(0);

    Notification::assertSentOnDemand(
        FailedJobsDetected::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'admin@example.com'
            && count($notification->failures) === 1
            && $notification->failures[0]['job'] === 'App\\Jobs\\GenerateBillingoInvoice'
    );
});

test('elbukott job nélkül nincs riasztás', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    $this->artisan('queue:alert-failed')->assertExitCode(0);

    Notification::assertNothingSent();
});

test('ugyanarról a bukásról nem riasztunk kétszer', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    insertFailedJob();

    $this->artisan('queue:alert-failed')->assertExitCode(0);
    $this->artisan('queue:alert-failed')->assertExitCode(0);

    Notification::assertSentOnDemandTimes(FailedJobsDetected::class, 1);
});

test('újabb bukás új riasztást vált ki', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    insertFailedJob();
    $this->artisan('queue:alert-failed')->assertExitCode(0);

    insertFailedJob('App\\Jobs\\MasikJob');
    $this->artisan('queue:alert-failed')->assertExitCode(0);

    Notification::assertSentOnDemandTimes(FailedJobsDetected::class, 2);
});

test('ADMIN_EMAIL nélkül hibával lép ki és nem küld semmit', function () {
    Notification::fake();
    config(['app.admin_email' => null]);

    insertFailedJob();

    $this->artisan('queue:alert-failed')
        ->expectsOutputToContain('Nincs ADMIN_EMAIL')
        ->assertExitCode(1);

    Notification::assertNothingSent();
});

test('torlódó queue-nál riasztás megy az adminnak', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    event(new QueueBusy('database', 'default', 120));

    Notification::assertSentOnDemand(
        QueueBacklogDetected::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'admin@example.com'
            && $notification->size === 120
    );
});

test('a torlódás-riasztás óránként legfeljebb egyszer megy ki', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    event(new QueueBusy('database', 'default', 120));
    event(new QueueBusy('database', 'default', 150));

    Notification::assertSentOnDemandTimes(QueueBacklogDetected::class, 1);
});

test('ADMIN_EMAIL nélkül a torlódás-riasztás némán kimarad', function () {
    Notification::fake();
    config(['app.admin_email' => null]);

    event(new QueueBusy('database', 'default', 120));

    Notification::assertNothingSent();
});
