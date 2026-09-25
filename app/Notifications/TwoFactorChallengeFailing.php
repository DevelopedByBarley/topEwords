<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Figyelmeztetés a fióktulajdonosnak: valaki a helyes jelszóval, de hibás
 * kétlépcsős kóddal próbál belépni (App\Listeners\NotifyUserOfTwoFactorFailures).
 * Szándékosan NEM ShouldQueue, a projekt többi értesítésével egyezően.
 */
class TwoFactorChallengeFailing extends Notification
{
    public function __construct(
        private readonly int $failures,
        private readonly ?string $ipAddress,
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
            ->subject('Sikertelen belépési kísérletek a fiókodba')
            ->line("Az elmúlt órában {$this->failures} alkalommal adtak meg hibás kétlépcsős kódot a fiókodhoz, a helyes jelszóval.")
            ->line('IP-cím: '.($this->ipAddress ?? 'ismeretlen'))
            ->line('Ha nem te voltál, a jelszavad valószínűleg illetéktelen kézbe került: változtasd meg most, és ellenőrizd a kétlépcsős azonosítás beállításait.')
            ->action('Jelszó módosítása', route('security.edit'))
            ->line('Ha te próbálkoztál (pl. rossz eszközön nézted a kódot), ezt a levelet figyelmen kívül hagyhatod.');
    }
}
