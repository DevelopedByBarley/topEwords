<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('billing:end-trial {email : A felhasználó e-mail címe}')]
#[Description('A megadott felhasználó próbaidejét azonnal lejáratja a Stripe-on (teszteléshez), így a valódi terhelés és a Billingo-számla rögtön lefut — nem kell kivárni a trial végét.')]
class EndTrialNow extends Command
{
    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $user = User::where('email', $email)->first();

        if (! $user) {
            $this->error("Nincs felhasználó ezzel az e-mail címmel: {$email}");

            return self::FAILURE;
        }

        $subscription = $user->activeSubscription();

        if ($subscription === null) {
            $this->error('A felhasználónak nincs aktív előfizetése.');

            return self::FAILURE;
        }

        if (! $subscription->onTrial()) {
            $this->warn('Az előfizetés nincs próbaidőben – nincs mit lejáratni.');

            return self::FAILURE;
        }

        // A Stripe a trial_end=now hatására azonnal lezárja a próbaidőt, kiállítja és
        // levonja az első valódi számlát, majd elküldi az invoice.payment_succeeded
        // webhookot — pontosan úgy, mint a trial természetes lejártakor. A helyi
        // trial_ends_at-et a customer.subscription.updated webhook szinkronizálja.
        $subscription->updateStripeSubscription(['trial_end' => 'now']);

        $this->info("Trial azonnal lejáratva: {$user->email} ({$subscription->stripe_id}).");
        $this->line('A terhelés és a Billingo-számla a webhookon keresztül fut le – lokálisan ehhez futnia kell a `stripe listen`-nek.');

        return self::SUCCESS;
    }
}
