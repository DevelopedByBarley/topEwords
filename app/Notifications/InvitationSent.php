<?php

namespace App\Notifications;

use App\Models\Invite;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Meghívó-levél egy még nem regisztrált címre (on-demand route). A regisztrációs
 * link a meghívókódot is hordozza, így a címzettnek semmit sem kell begépelnie;
 * a bővítmény linkje opcionális — az admin generáláskor adja meg. Szándékosan NEM
 * ShouldQueue, ahogy a projekt többi értesítése sem: az admin így azonnal látja,
 * ha a küldés elbukott.
 */
class InvitationSent extends Notification
{
    public function __construct(
        private readonly Invite $invite,
        private readonly ?string $extensionUrl = null,
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
        $appName = config('app.name');

        $mail = (new MailMessage)
            ->subject("Meghívó a {$appName} alkalmazásba")
            ->greeting('Szia!')
            ->line("Meghívást kaptál a {$appName} angol szótanuló alkalmazásba. Az alábbi gombbal regisztrálhatsz, a meghívókódot a link már tartalmazza.")
            ->action('Regisztráció', url('/register').'?invite='.$this->invite->code)
            ->line("Meghívókód: {$this->invite->code}");

        if ($this->invite->expires_at !== null) {
            $mail->line('A meghívó eddig érvényes: '.$this->invite->expires_at->timezone('Europe/Budapest')->format('Y.m.d. H:i').'.');
        }

        if ($this->extensionUrl !== null) {
            $mail->line('A Chrome-bővítményt itt telepítheted — vele YouTube- és Netflix-feliratokon is kikeresheted a szavakat:')
                ->line("[Chrome-bővítmény telepítése]({$this->extensionUrl})");
        }

        return $mail->salutation("Üdvözlettel: {$appName}");
    }
}
