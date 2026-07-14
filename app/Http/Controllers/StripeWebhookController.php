<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateBillingoInvoice;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
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
    /**
     * A Stripe-customer törlésekor a Cashier alapból nullázza a users.trial_ends_at
     * mezőt is — ez viszont NEM Stripe-eredetű: az app előfizetéseinek próbaideje
     * magán az előfizetésen van (lásd User::isOnAnyTrial), a users.trial_ends_at
     * kizárólag az admin által kézzel adott „ajándék-hónap" tárolója
     * (AdminController::grantFreeMonth). Ezt a customer törlése nem érintheti, ezért
     * a Cashier-lépés után visszaállítjuk, ha még a jövőben jár le.
     *
     * (A lifetime_access és plan_override mezőket a Cashier eleve nem bántja, azok
     * magától túlélik a customer törlését.)
     */
    protected function handleCustomerDeleted(array $payload)
    {
        $user = $this->getUserByStripeId($payload['data']['object']['id'] ?? null);
        $giftTrialEndsAt = $user instanceof User ? $user->trial_ends_at : null;

        $response = parent::handleCustomerDeleted($payload);

        // A Cashier a saját, külön betöltött modellpéldányán nullázta a DB-t; a mi
        // $user példányunk még a régi értéket tartja, ezért egy célzott UPDATE-tel
        // írjuk vissza az ajándék-hónapot (a forceFill+save nem lenne „dirty").
        if ($user instanceof User && $giftTrialEndsAt !== null && $giftTrialEndsAt->isFuture()) {
            $user->newQuery()->whereKey($user->getKey())->update(['trial_ends_at' => $giftTrialEndsAt]);
            $user->trial_ends_at = $giftTrialEndsAt;
        }

        return $response;
    }

    protected function handleCustomerSubscriptionCreated(array $payload)
    {
        $response = parent::handleCustomerSubscriptionCreated($payload);

        $user = $this->getUserByStripeId($payload['data']['object']['customer'] ?? null);

        if ($user instanceof User) {
            $this->cancelDuplicateSubscriptions($user);
        }

        return $response;
    }

    /**
     * Cancels the user's duplicate subscriptions with a loud alert. Trial nélküli
     * (visszatérő) felhasználónál mindkét Checkout AZONNAL terhelt, és mindkét
     * fizetésről Billingo (NAV) számla is készült — a cancelNow() viszont NEM
     * refundál, a visszatérítés és a számla-sztornó kézi feladat. Ezért critical
     * szinten riasztunk, még a lemondás előtt, hogy annak hibája esetén se
     * maradjon észrevétlen a dupla terhelés.
     */
    public function cancelDuplicateSubscriptions(User $user): void
    {
        foreach ($this->duplicateSubscriptionsFor($user) as $subscription) {
            Log::critical('Duplikált Stripe-előfizetés — lemondjuk; ellenőrizd, kell-e kézi refund és Billingo-sztornó!', [
                'user_id' => $user->id,
                'duplicate_subscription_stripe_id' => $subscription->stripe_id,
            ]);

            try {
                $subscription->cancelNow();
            } catch (\Throwable $e) {
                // A takarítás soha ne buktassa meg a webhookot (a Stripe újraküldené).
                report($e);
            }
        }
    }

    /**
     * The user's redundant active subscriptions — every non-canceled subscription
     * except the keeper.
     *
     * A keeper NEM feltétlenül a legrégebbi: először egy egészséges (valid: active /
     * trialing / grace-period) előfizetést tartunk meg, mert egy pusztán created_at
     * szerinti választás megtarthatna egy incomplete/past_due/unpaid sort, és épp az
     * élő, fizető előfizetést mondaná le (#L3). Az egészséges (majd az összes) halmazon
     * belül a legrégebbi a keeper, hogy a választás stabil és determinisztikus maradjon.
     *
     * @return Collection<int, Subscription>
     */
    public function duplicateSubscriptionsFor(User $user): Collection
    {
        $candidates = $user->subscriptions()
            ->where('stripe_status', '!=', StripeSubscription::STATUS_CANCELED)
            ->whereNull('ends_at')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $keeper = $candidates->firstWhere(fn (Subscription $subscription): bool => $subscription->valid())
            ?? $candidates->first();

        return $candidates
            ->reject(fn (Subscription $subscription): bool => $subscription->is($keeper))
            ->values();
    }
}
