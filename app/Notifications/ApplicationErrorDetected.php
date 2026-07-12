<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Admin-riasztás prod-beli error szintű log-bejegyzésről. Szándékosan NEM ShouldQueue:
 * ha épp a queue infrastruktúra a hibás, a queue-ba tett riasztás sosem érne célba.
 */
class ApplicationErrorDetected extends Notification
{
    public function __construct(
        public string $level,
        public string $message,
        public ?string $exceptionSummary,
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
            ->subject("🚨 Hiba a topWords-ben ({$this->level})")
            ->error()
            ->line("Szint: {$this->level}")
            ->line("Üzenet: {$this->message}");

        if ($this->exceptionSummary !== null) {
            $mail->line("Kivétel: {$this->exceptionSummary}");
        }

        return $mail
            ->line('Részletek a szerveren: `storage/logs/laravel.log`.')
            ->line('További hibákról legfeljebb óránként egyszer megy riasztás — a log ennél többet tartalmazhat.');
    }
}
