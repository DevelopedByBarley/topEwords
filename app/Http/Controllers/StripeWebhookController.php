<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateBillingoInvoice;
use App\Models\User;
use Illuminate\Support\Collection;
use Laravel\Cashier\Http\Controllers\WebhookController;
use Laravel\Cashier\Subscription;
use Stripe\Subscription as StripeSubscription;

class StripeWebhookController extends WebhookController
{
    /**
     * A sikeres fizetés után NAV-kompatibilis Billingo számlát állítunk ki. A számlázás
     * külön kapcsolóval ki is hagyható, hogy a fizetés a Billingo nélkül is működjön.
     *
     * A számlázás ASZINKRON, queue worker dolgozza fel (Ploi/VPS) — a webhook azonnal
     * 200-at ad, a job a jobs táblába kerül. Így egy lassú vagy hibázó Billingo nem tartja
     * fogva a webhook kérést, és a beépített újrapróba (backoff [60,300,900], 4 próbálkozás)
     * intézi az átmeneti hibákat. Az InvoiceGenerator idempotenciája (unique stripe_invoice_id)
     * miatt az újrapróba nem hoz létre második számlát; végleges bukáskor a job failed()
     * handlere naplóz (NAV-kötelezettség, nem maradhat észrevétlen).
     */
    protected function handleInvoicePaymentSucceeded(array $payload)
    {
        $invoice = $payload['data']['object'] ?? [];
        $user = $this->getUserByStripeId($invoice['customer'] ?? null);

        if ($user instanceof User && config('services.billingo.enabled')) {
            GenerateBillingoInvoice::dispatch($user, $invoice);
        }

        return $this->successMethod();
    }

    /**
     * Subscription events are handled automatically by Cashier; we only add a
     * de-duplication safety net on top of the default behaviour.
     *
     * A felhasználó a Stripe Checkoutot véletlenül kétszer is befejezheti (pl. két
     * böngészőfül), mire bármelyik webhook létrehozná a helyi előfizetést — így két
     * párhuzamos Stripe-előfizetés keletkezhet, és a trial végén mindkettő számláz.
     * Ebben az appban egy felhasználónak mindig pontosan egy aktív előfizetése van
     * (a csomagváltás helyben swap-el), ezért bármely további aktív előfizetés
     * duplikátum: a legrégebbit megtartjuk, a többit azonnal lemondjuk.
     */
    protected function handleCustomerSubscriptionCreated(array $payload)
    {
        $response = parent::handleCustomerSubscriptionCreated($payload);

        $user = $this->getUserByStripeId($payload['data']['object']['customer'] ?? null);

        if ($user instanceof User) {
            foreach ($this->duplicateSubscriptionsFor($user) as $subscription) {
                try {
                    $subscription->cancelNow();
                } catch (\Throwable $e) {
                    // A takarítás soha ne buktassa meg a webhookot (a Stripe újraküldené).
                    report($e);
                }
            }
        }

        return $response;
    }

    /**
     * The user's redundant active subscriptions — every active subscription except
     * the earliest-created one, which is the keeper.
     *
     * @return Collection<int, Subscription>
     */
    public function duplicateSubscriptionsFor(User $user): Collection
    {
        return $user->subscriptions()
            ->where('stripe_status', '!=', StripeSubscription::STATUS_CANCELED)
            ->whereNull('ends_at')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->skip(1)
            ->values();
    }
}
