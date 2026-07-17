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
            // Csak a generator által olvasott mezőket adjuk át — a teljes payload ügyfél-PII-ja
            // ne szerializálódjon a jobs/failed_jobs táblába (W-L3).
            GenerateBillingoInvoice::dispatch($user, GenerateBillingoInvoice::onlyNeededFields($invoice));
        } elseif (config('services.billingo.enabled') && $this->grossMinorPaid($invoice) > 0) {
            // Pénz beszedve (pozitív terhelés), de nincs helyi user a customerhez — pl. egy
            // out-of-order customer.deleted már kinullázta a stripe_id-t, vagy a customert a
            // Stripe dashboardban kézzel hozták létre. NAV-számla így soha nem készülne, és a
            // 200-as ACK némán elnyelné a kötelezettséget. A retry nem segít (a user attól nem
            // lesz meg), ezért nem buktatjuk a webhookot — de hangosan riasztunk, hogy emberi
            // beavatkozással pótolható legyen. Ez a fájl minden más pénz-ága is hangos.
            Log::critical('Sikeres Stripe-terhelés ismeretlen customerhez — NAV-számla NEM készül, kézi kiállítás kell!', [
                'stripe_customer' => $invoice['customer'] ?? null,
                'stripe_invoice_id' => $invoice['id'] ?? null,
                'amount_paid_minor' => $this->grossMinorPaid($invoice),
            ]);
        }

        return $this->successMethod();
    }

    /**
     * A ténylegesen kifizetett bruttó összeg a legkisebb pénznemegységben (pl. cent) —
     * a riasztás csak valódi terhelésre szólal meg, a 0 összegű (trial-induló) számlára nem.
     *
     * @param  array<string, mixed>  $invoice
     */
    private function grossMinorPaid(array $invoice): int
    {
        return (int) ($invoice['amount_paid'] ?? $invoice['total'] ?? 0);
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

    /**
     * Sorrenden kívüli `customer.subscription.updated` nem támaszthat fel egy már
     * törölt előfizetést. A Stripe nem garantál esemény-sorrendet: a
     * `customer.subscription.deleted` feldolgozása UTÁN is befuthat egy korábbi
     * (késleltetett vagy újraküldött) `updated` esemény `status=active`
     * pillanatképpel, amit a Cashier ellenőrzés nélkül írna rá a helyi sorra
     * (`stripe_status=active`, `ends_at=null`) → tartós ingyen prémium, mert a
     * Stripe-oldalon az előfizetés halott, több korrekciós esemény nem jön.
     *
     * Egy ténylegesen törölt Stripe-előfizetés soha nem éled újra, ezért a helyben
     * `canceled` sorra érkező nem-canceled update biztosan elavult: naplózva eldobjuk.
     */
    protected function handleCustomerSubscriptionUpdated(array $payload)
    {
        $data = $payload['data']['object'] ?? [];
        $incomingStatus = $data['status'] ?? null;

        if ($incomingStatus !== null && $incomingStatus !== StripeSubscription::STATUS_CANCELED) {
            $user = $this->getUserByStripeId($data['customer'] ?? null);

            $isLocallyCanceled = $user instanceof User && $user->subscriptions()
                ->where('stripe_id', $data['id'] ?? null)
                ->where('stripe_status', StripeSubscription::STATUS_CANCELED)
                ->exists();

            if ($isLocallyCanceled) {
                Log::warning('Sorrenden kívüli subscription.updated egy már törölt előfizetésre — eldobva, hogy ne támadjon fel.', [
                    'stripe_subscription_id' => $data['id'] ?? null,
                    'stripe_customer' => $data['customer'] ?? null,
                    'incoming_status' => $incomingStatus,
                ]);

                return $this->successMethod();
            }
        }

        return parent::handleCustomerSubscriptionUpdated($payload);
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
