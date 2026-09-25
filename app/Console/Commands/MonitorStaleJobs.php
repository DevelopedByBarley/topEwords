<?php

namespace App\Console\Commands;

use App\Notifications\StaleJobsDetected;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

#[Signature('queue:alert-stale {--minutes=30 : Ennyi percnél régebben esedékes, de fel nem dolgozott job számít beragadtnak}')]
#[Description('E-mail riasztást küld az adminnak, ha a jobs táblában régóta esedékes, fel nem dolgozott job vár — tipikusan leállt worker, ami kiállítatlan Billingo (NAV) számlát jelent.')]
class MonitorStaleJobs extends Command
{
    /**
     * A queue:monitor csak a queue MÉRETÉT nézi (--max=25), így egyetlen beragadt számlázó
     * job láthatatlan neki; a queue:alert-failed pedig csak az elbukottakat, a várakozó job
     * viszont nem bukik el. Ez a parancs a legrégebben esedékes job KORÁT figyeli (F4-L1).
     * A riasztást óránként egyre fogjuk, hogy egy tartós leállás ne árassza el a postafiókot.
     */
    private const THROTTLE_CACHE_KEY = 'queue-monitoring:stale-alerted';

    /** Legfeljebb ennyi jobot sorolunk fel név szerint az e-mailben. */
    private const MAX_LISTED_JOBS = 10;

    public function handle(): int
    {
        if (config('queue.default') !== 'database') {
            $this->info('A queue nem database driveren fut — a jobs tábla nem figyelhető.');

            return self::SUCCESS;
        }

        // Az available_at az esedékesség ideje (dispatchkor most, backoff utáni release-kor a
        // jövő), így a még backoffra váró újrapróbálkozás nem számít beragadtnak.
        $threshold = now()->subMinutes((int) $this->option('minutes'))->getTimestamp();

        $staleJobs = DB::connection(config('queue.connections.database.connection'))
            ->table(config('queue.connections.database.table', 'jobs'))
            ->where('available_at', '<=', $threshold)
            ->orderBy('available_at')
            ->get(['id', 'queue', 'payload', 'attempts', 'available_at']);

        if ($staleJobs->isEmpty()) {
            $this->info('Nincs beragadt job.');

            return self::SUCCESS;
        }

        $adminEmail = config('app.admin_email');

        if (! $adminEmail) {
            $this->error('Nincs ADMIN_EMAIL beállítva — a riasztást nincs hova küldeni.');

            return self::FAILURE;
        }

        if (! Cache::add(self::THROTTLE_CACHE_KEY, true, now()->addHour())) {
            $this->info("{$staleJobs->count()} beragadt job, de az elmúlt órában már riasztottunk.");

            return self::SUCCESS;
        }

        // Szándékosan szinkron küldés (notifyNow): ha a worker áll, a queue-ba tett riasztás
        // sosem érne célba.
        Notification::route('mail', $adminEmail)
            ->notifyNow(new StaleJobsDetected($staleJobs->count(), $this->summarize($staleJobs->take(self::MAX_LISTED_JOBS))));

        $this->info("Riasztás elküldve {$staleJobs->count()} beragadt jobról ({$adminEmail}).");

        return self::SUCCESS;
    }

    /**
     * @param  Collection<int, object>  $jobs
     * @return array<int, array{id: int, job: string, queue: string, attempts: int, waiting_minutes: int}>
     */
    private function summarize(Collection $jobs): array
    {
        return $jobs->map(function (object $job): array {
            $payload = json_decode($job->payload, true);

            return [
                'id' => (int) $job->id,
                'job' => $payload['displayName'] ?? 'ismeretlen job',
                'queue' => $job->queue,
                'attempts' => (int) $job->attempts,
                'waiting_minutes' => intdiv(now()->getTimestamp() - (int) $job->available_at, 60),
            ];
        })->values()->all();
    }
}
