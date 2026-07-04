<?php

namespace App\Console\Commands;

use App\Notifications\FailedJobsDetected;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

#[Signature('queue:alert-failed')]
#[Description('E-mail riasztást küld az adminnak, ha új elbukott job került a failed_jobs táblába — elbukott job tipikusan kimaradt Billingo (NAV) számlát jelent, ami nem maradhat észrevétlen.')]
class MonitorFailedJobs extends Command
{
    /**
     * A legutóbb már lejelentett failed_jobs rekord id-ját őrzi, így minden bukásról
     * pontosan egyszer riasztunk. Ha a cache-t kiürítik (pl. optimize:clear), a táblában
     * még bent lévő bukásokról újra megy a riasztás — inkább duplán, mint sehogy.
     */
    private const LAST_ALERTED_ID_CACHE_KEY = 'queue-monitoring:last-alerted-failed-job-id';

    public function handle(): int
    {
        $newFailures = DB::table('failed_jobs')
            ->where('id', '>', (int) Cache::get(self::LAST_ALERTED_ID_CACHE_KEY, 0))
            ->orderBy('id')
            ->get();

        if ($newFailures->isEmpty()) {
            $this->info('Nincs új elbukott job.');

            return self::SUCCESS;
        }

        $adminEmail = config('app.admin_email');

        if (! $adminEmail) {
            $this->error('Nincs ADMIN_EMAIL beállítva — a riasztást nincs hova küldeni.');

            return self::FAILURE;
        }

        // Szándékosan szinkron küldés (notifyNow): a riasztás épp a queue bajáról szól,
        // ezért nem bízhatjuk a kézbesítését ugyanarra a queue-ra.
        Notification::route('mail', $adminEmail)
            ->notifyNow(new FailedJobsDetected($this->summarize($newFailures)));

        Cache::forever(self::LAST_ALERTED_ID_CACHE_KEY, (int) $newFailures->last()->id);

        $this->info("Riasztás elküldve {$newFailures->count()} új elbukott jobról ({$adminEmail}).");

        return self::SUCCESS;
    }

    /**
     * A failed_jobs sorokból e-mailbe szánt, emberi összefoglalót készít.
     *
     * @param  Collection<int, object>  $failures
     * @return array<int, array{id: int, job: string, queue: string, failed_at: string, error: string}>
     */
    private function summarize(Collection $failures): array
    {
        return $failures->map(function (object $failure): array {
            $payload = json_decode($failure->payload, true);

            return [
                'id' => (int) $failure->id,
                'job' => $payload['displayName'] ?? 'ismeretlen job',
                'queue' => $failure->queue,
                'failed_at' => (string) $failure->failed_at,
                'error' => str($failure->exception)->before("\n")->limit(200)->toString(),
            ];
        })->all();
    }
}
