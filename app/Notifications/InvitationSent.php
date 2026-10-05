<?php

namespace App\Notifications;

use App\Models\Invite;
use App\Support\Billing;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

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

    private function usesStripeTestMode(): bool
    {
        return Billing::enabled() && str_starts_with((string) config('cashier.secret'), 'sk_test_');
    }
}
