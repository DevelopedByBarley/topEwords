<?php

namespace App\Notifications;

use App\Models\Report;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Admin-értesítés új felhasználói bejelentésről. Enélkül csak az admin felület
 * badge-éből derülne ki, hogy jött valami — vagyis akkor, ha valaki magától
 * benéz oda. Szándékosan NEM ShouldQueue: a projektben egyetlen értesítés sem
 * queue-zott, és egy beteg worker mellett pont a bajról szóló levél maradna el.
 */
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
            // Válasz-cím: az adminnak elég a levélre válaszolnia, nem kell
            // kikeresnie a címet az admin felületről.
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
