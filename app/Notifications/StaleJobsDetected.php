<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Admin-riasztás régóta esedékes, fel nem dolgozott queue jobokról — a tipikus ok a leállt
 * worker. Szándékosan NEM ShouldQueue: ha a worker áll, a queue-ba tett riasztás sosem érne célba.
 */
class StaleJobsDetected extends Notification
{
    /**
     * @param  array<int, array{id: int, job: string, queue: string, attempts: int, waiting_minutes: int}>  $jobs
     */
    public function __construct(
        public int $total,
        public array $jobs,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject("⚠️ {$this->total} beragadt queue job — topWords")
            ->error()
            ->line("{$this->total} job régóta esedékes, de egyik worker sem dolgozta fel. Ha köztük van GenerateBillingoInvoice, az kiállítatlan NAV-számlát jelent!");

        foreach ($this->jobs as $job) {
            $mail->line("#{$job['id']} · {$job['job']} ({$job['queue']}) · {$job['waiting_minutes']} perce vár, {$job['attempts']}. próbálkozás");
        }

        if ($this->total > count($this->jobs)) {
            $mail->line('… és további '.($this->total - count($this->jobs)).' job.');
        }

        return $mail
            ->line('Ellenőrizd a Ploi-ban a queue worker daemont, vagy a szerveren: `php artisan queue:work`.');
    }
}
