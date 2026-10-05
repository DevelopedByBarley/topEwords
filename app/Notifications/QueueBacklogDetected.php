<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class QueueBacklogDetected extends Notification
{
    public function __construct(
        public string $connection,
        public string $queue,
        public int $size,
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
        return (new MailMessage)
            ->subject("⚠️ Torlódó queue ({$this->size} várakozó job) — topWords")
            ->error()
            ->line("A(z) {$this->connection}:{$this->queue} queue-ban {$this->size} job várakozik — a legvalószínűbb ok, hogy a queue worker nem fut.")
            ->line('Amíg a worker áll, a Billingo (NAV) számlák nem készülnek el, csak gyűlnek a jobok.')
            ->line('Ellenőrizd a Ploi-ban a daemont, vagy a szerveren: `php artisan queue:work`.');
    }
}
