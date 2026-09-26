<?php

namespace App\Notifications;

use App\Models\Invite;
use App\Support\Billing;
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

        if ($this->invite->pro_days !== null) {
            $mail->line("A regisztrációtól számítva {$this->invite->pro_days} napig ingyen használhatod a Pro csomagot, a teljes AI-kerettel együtt.");
        }

        if ($this->extensionUrl !== null) {
            $mail->line('A Chrome-bővítményt itt telepítheted — vele YouTube- és Netflix-feliratokon is kikeresheted a szavakat:')
                ->line("[Chrome-bővítmény telepítése]({$this->extensionUrl})");
        }

        $mail->line('Ha hibát találsz vagy ötleted van, az alkalmazás menüjében a [Hibabejelentés]('.route('report.index').') oldalon jelezheted.');

        if ($this->usesStripeTestMode()) {
            $mail->line('Ez egy tesztkörnyezet, valódi pénz nem mozdul. Az előfizetést ezzel a tesztkártyával próbálhatod ki: **4242 4242 4242 4242**, bármilyen jövőbeli lejárat és bármilyen háromjegyű CVC.');
        }

        return $mail->salutation("Üdvözlettel: {$appName}");
    }

    /**
     * Teszt-módú Stripe-kulccsal (sk_test_) a fizetés nem terhel valódi kártyát, így a
     * tesztkártya-tipp csak ilyenkor kerül a levélbe — éles kulccsal soha.
     */
    private function usesStripeTestMode(): bool
    {
        return Billing::enabled() && str_starts_with((string) config('cashier.secret'), 'sk_test_');
    }
}
