<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ReportSubmitted extends Notification
{
    public function __construct(private readonly Report $report) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $category = Report::CATEGORY_LABELS[$this->report->category] ?? $this->report->category;
        $reporter = $this->report->user;

        $mail = (new MailMessage)
            ->subject("Új hibabejelentés — {$category}")
            ->line("Kategória: {$category}");

        if ($reporter !== null) {
            $mail->replyTo($reporter->email, $reporter->name)
                ->line("Bejelentő: {$reporter->name} ({$reporter->email})");
        }

        if ($this->report->word !== null) {
            $mail->line("Érintett szó: {$this->report->word->word}");
        }

        return $mail
            ->line('Leírás:')
            ->line($this->report->description)
            ->action('Megnyitás az admin felületen', route('admin'));
    }
}
