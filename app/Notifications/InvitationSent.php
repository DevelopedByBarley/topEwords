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
 * ha a küldés elbukott. A tartalom a mail.invitation markdown-nézetben van.
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

        return (new MailMessage)
            ->subject("Meghívót kaptál a {$appName} tesztelésére")
            ->markdown('mail.invitation', [
                'appName' => $appName,
                'code' => $this->invite->code,
                'registerUrl' => url('/register').'?invite='.$this->invite->code,
                'expiresAt' => $this->invite->expires_at?->timezone('Europe/Budapest')->format('Y.m.d. H:i'),
                'proDays' => $this->invite->pro_days,
                'extensionUrl' => $this->extensionUrl,
                'reportUrl' => route('report.index'),
                'showTestCard' => $this->usesStripeTestMode(),
            ]);
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
