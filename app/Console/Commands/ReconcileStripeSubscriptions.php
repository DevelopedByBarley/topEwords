<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Subscription;
use Stripe\Exception\InvalidRequestException;
use Stripe\Subscription as StripeSubscription;

#[Signature('cashier:reconcile-subscriptions')]
#[Description('Összeveti a helyileg aktívnak hitt előfizetéseket a Stripe valós állapotával, és lezárja a Stripe-nál már halottakat — így egy elveszett customer.subscription.deleted esemény sem hagy beragadt „ingyen prémium" előfizetést.')]
class ReconcileStripeSubscriptions extends Command
{
    /**
     * A Stripe-nál halottnak számító státuszok. Ha egy helyileg aktív előfizetés a
     * Stripe szerint ezek egyikében van (vagy a resource már nem is létezik), akkor
     * elveszett egy törlő/lejáró webhook — a helyi sort le kell zárnunk.
     *
     * @var array<int, string>
     */
    private const DEAD_STRIPE_STATUSES = [
        StripeSubscription::STATUS_CANCELED,
        StripeSubscription::STATUS_INCOMPLETE_EXPIRED,
    ];

    public function handle(): int
    {
        // A Stripe webhookok legalább-egyszer, sorrend nélkül érkeznek, és egy végleg
        // elveszett customer.subscription.deleted a helyi sort tartósan aktívan hagyná
        // (a handleCustomerSubscriptionUpdated guard csak a másik irányban véd). Ez a
        // parancs a Stripe-ot tekinti igazságforrásnak: minden helyileg aktív előfizetést
        // visszaellenőriz, és a Stripe-nál már halottat helyben is lezárja.
        $reconciled = 0;
        $failed = 0;

        Subscription::query()->active()->cursor()->each(function (Subscription $subscription) use (&$reconciled, &$failed): void {
            try {
                if ($this->reconcile($subscription)) {
                    $reconciled++;
                }
            } catch (\Throwable $e) {
                // Egy hibás előfizetés (pl. törölt owner, átmeneti Stripe-hiba) ne állítsa
                // meg a teljes egyeztetést — naplózzuk és megyünk tovább a következőre.
                $failed++;
                report($e);
            }
        });

        $this->info("Előfizetés-egyeztetés kész: {$reconciled} korrigálva, {$failed} hiba.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Egyetlen előfizetés egyeztetése a Stripe valós állapotával.
     * Visszatérési érték: true, ha a helyi sort korrigálni kellett.
     *
     * Protected, hogy a döntési logika a Stripe HTTP-rétegének felépítése nélkül,
     * mockolt Subscription-nel tesztelhető legyen (lásd ReconcileStripeSubscriptionsTest).
     */
    protected function reconcile(Subscription $subscription): bool
    {
        try {
            $stripeStatus = $subscription->asStripeSubscription()->status;
        } catch (InvalidRequestException $e) {
            // A Stripe már nem ismeri ezt az előfizetést (resource_missing): véglegesen
            // törölt, egyetlen korrekciós webhook sem fog már jönni → helyben lezárjuk.
            if ($e->getStripeCode() === 'resource_missing') {
                $this->closeDeadSubscription($subscription, 'resource_missing');

                return true;
            }

            throw $e;
        }

        // A Stripe szerint halott, de helyileg még aktív → beragadt előfizetés, lezárjuk.
        if (in_array($stripeStatus, self::DEAD_STRIPE_STATUSES, true)) {
            $this->closeDeadSubscription($subscription, $stripeStatus);

            return true;
        }

        // Él a Stripe-nál, de a státusz eltér (pl. elveszett past_due/unpaid frissítés):
        // rásimítjuk a valós állapotot, hogy a helyi jogosultság se tévedjen.
        if ($subscription->stripe_status !== $stripeStatus) {
            $previousStatus = $subscription->stripe_status;
            $subscription->syncStripeStatus();

            Log::warning('Stripe-előfizetés státusza eltért a helyitől — szinkronizálva.', [
                'subscription_id' => $subscription->id,
                'stripe_subscription_id' => $subscription->stripe_id,
                'local_status' => $previousStatus,
                'stripe_status' => $stripeStatus,
            ]);

            return true;
        }

        return false;
    }

    /**
     * A Stripe-nál halott előfizetés helyi lezárása Stripe-hívás nélkül
     * (markAsCanceled: stripe_status=canceled + ends_at=now), hangos riasztással.
     */
    protected function closeDeadSubscription(Subscription $subscription, string $reason): void
    {
        Log::critical('Beragadt Stripe-előfizetés — a Stripe-nál már halott, de helyileg aktív volt. Lezárva (elveszett törlő webhook pótlása).', [
            'subscription_id' => $subscription->id,
            'stripe_subscription_id' => $subscription->stripe_id,
            'local_status' => $subscription->stripe_status,
            'stripe_reason' => $reason,
        ]);

        $subscription->markAsCanceled();
    }
}
