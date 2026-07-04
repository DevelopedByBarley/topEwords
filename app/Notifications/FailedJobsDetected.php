<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Admin-riasztás új elbukott queue jobokról. Szándékosan NEM ShouldQueue: a queue
 * hibájáról szóló riasztás nem mehet queue-n keresztül, a küldő parancs (queue:alert-failed)
 * pedig ütemezetten, HTTP kérésen kívül fut, így a szinkron küldés nem blokkol senkit.
 */
class FailedJobsDetected extends Notification
{
    /**
     * @param  array<int, array{id: int, job: string, queue: string, failed_at: string, error: string}>  $failures
     */
    public function __construct(public array $failures) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $count = count($this->failures);

        $mail = (new MailMessage)
            ->subject("⚠️ {$count} elbukott queue job — topWords")
            ->error()
            ->line("{$count} job véglegesen elbukott (minden újrapróbálkozás kimerült). Ha köztük van GenerateBillingoInvoice, az kimaradt NAV-számlát jelent!");

        foreach ($this->failures as $failure) {
            $mail->line("#{$failure['id']} · {$failure['job']} ({$failure['queue']}) · {$failure['failed_at']} — {$failure['error']}");
        }

        return $mail
            ->line('Részletek a szerveren: `php artisan queue:failed`, újrapróbálás javítás után: `php artisan queue:retry all`.');
    }
}
