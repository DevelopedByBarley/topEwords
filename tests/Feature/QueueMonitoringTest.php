<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Models\User;
use App\Notifications\FailedJobsDetected;
use App\Notifications\QueueBacklogDetected;
use App\Notifications\StaleJobsDetected;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Queue\Events\QueueBusy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
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

/*
| F4-L1: a queue:monitor csak méretet mér, a queue:alert-failed csak a bukottakat — egy
| worker nélkül várakozó, egyetlen számlázó job egyiknek sem tűnik fel. A queue:alert-stale
| a legrégebben esedékes job korát figyeli.
*/

function dispatchInvoiceJobToDatabaseQueue(): void
{
    config(['queue.default' => 'database']);

    GenerateBillingoInvoice::dispatch(User::factory()->create(), ['id' => 'in_test']);
}

test('30 percnél régebben váró számlázó jobról riasztás megy', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    dispatchInvoiceJobToDatabaseQueue();
    $this->travel(31)->minutes();

    $this->artisan('queue:alert-stale')->assertExitCode(0);

    Notification::assertSentOnDemand(
        StaleJobsDetected::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'admin@example.com'
            && $notification->total === 1
            && $notification->jobs[0]['job'] === 'App\Jobs\GenerateBillingoInvoice'
            && $notification->jobs[0]['waiting_minutes'] === 31
    );
});

test('a frissen sorba tett job nem számít beragadtnak', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    dispatchInvoiceJobToDatabaseQueue();
    $this->travel(29)->minutes();

    $this->artisan('queue:alert-stale')->assertExitCode(0);

    Notification::assertNothingSent();
});

test('a backoffra váró újrapróbálkozás nem számít beragadtnak', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com', 'queue.default' => 'database']);

    // Release a 900 mp-es backoff-fal: 40 perc múlva már csak 25 perce esedékes.
    Queue::connection('database')->later(now()->addSeconds(900), 'App\Jobs\Dummy');
    $this->travel(40)->minutes();

    $this->artisan('queue:alert-stale')->assertExitCode(0);

    Notification::assertNothingSent();
});

test('a beragadt-job riasztás óránként legfeljebb egyszer megy ki', function () {
    Notification::fake();
    config(['app.admin_email' => 'admin@example.com']);

    dispatchInvoiceJobToDatabaseQueue();
    $this->travel(31)->minutes();

    $this->artisan('queue:alert-stale')->assertExitCode(0);
    $this->travel(10)->minutes();
    $this->artisan('queue:alert-stale')->assertExitCode(0);

    Notification::assertSentOnDemandTimes(StaleJobsDetected::class, 1);

    $this->travel(61)->minutes();
    $this->artisan('queue:alert-stale')->assertExitCode(0);

    Notification::assertSentOnDemandTimes(StaleJobsDetected::class, 2);
});

test('beragadt jobnál ADMIN_EMAIL nélkül hibával lép ki', function () {
    Notification::fake();
    config(['app.admin_email' => null]);

    dispatchInvoiceJobToDatabaseQueue();
    $this->travel(31)->minutes();

    $this->artisan('queue:alert-stale')
        ->expectsOutputToContain('Nincs ADMIN_EMAIL')
        ->assertExitCode(1);

    Notification::assertNothingSent();
});

test('a queue:alert-stale be van ütemezve', function () {
    $scheduled = collect(app(Schedule::class)->events())
        ->contains(fn ($event) => str_contains((string) $event->command, 'queue:alert-stale'));

    expect($scheduled)->toBeTrue();
});
