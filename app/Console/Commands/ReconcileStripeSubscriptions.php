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

    /**
     * Kör-fék (blast-radius guard). Ha egyetlen futás az aktív állomány ennél nagyobb
     * hányadát zárná le, a parancs LEZÁRÁS HELYETT riaszt és leáll — mert a tömeges
     * lezárás valószínűbb oka egy ops-hiba (rossz módú/fiókú STRIPE_SECRET → a Stripe
     * MINDEN retrieve-re resource_missing-et ad), mint hogy tényleg mindenki egyszerre
     * mondta le. A fék csak a MIN_KILL_COUNT sornál nagyobb köröknél aktív, hogy a
     * legitim „1-2 beragadt sor lezárása" apró állományon ne akadjon el.
     */
    private const MAX_KILL_RATIO = 0.5;

    /**
     * A kör-fék alsó küszöbe: ennél kevesebb lezárás-jelöltnél a féket nem alkalmazzuk
     * (kis állományon a hányad félrevezető — 1 sorból 1 lezárás 100%, de nem anomália).
     */
    private const MIN_KILL_COUNT_FOR_GUARD = 5;

    public function handle(): int
    {
        // A Stripe webhookok legalább-egyszer, sorrend nélkül érkeznek, és egy végleg
        // elveszett customer.subscription.deleted a helyi sort tartósan aktívan hagyná
        // (a handleCustomerSubscriptionUpdated guard csak a másik irányban véd). Ez a
        // parancs a Stripe-ot tekinti igazságforrásnak: minden helyileg aktív előfizetést
        // visszaellenőriz, és a Stripe-nál már halottat helyben is lezárja.
        //
        // Két fázisban dolgozunk, hogy egy ops-hiba ne zárhassa le fék nélkül a teljes
        // fizető állományt: (1) eldöntjük, mit kellene tenni (Stripe-olvasás, DB-írás
        // nélkül a close-ágon), közben számoljuk a lezárás-jelölteket; (2) a kör-fék
        // után hajtjuk végre a lezárásokat. A státusz-szinkron (élő sub) azonnal fut,
        // mert az nem destruktív és nem esik a fék hatálya alá.
        $activeCount = 0;
        $failed = 0;
        $synced = 0;

        /** @var array<int, Subscription> $toClose */
        $toClose = [];
        /** @var array<int, string> $closeReasons a subscription id → lezárás oka */
        $closeReasons = [];

        Subscription::query()->active()->cursor()->each(function (Subscription $subscription) use (&$activeCount, &$failed, &$synced, &$toClose, &$closeReasons): void {
            $activeCount++;

            try {
                $decision = $this->reconcile($subscription);

                if ($decision instanceof CloseDecision) {
                    $toClose[] = $subscription;
                    $closeReasons[$subscription->id] = $decision->reason;
                } elseif ($decision === ReconcileOutcome::Synced) {
                    $synced++;
                }
            } catch (\Throwable $e) {
                // Egy hibás előfizetés (pl. törölt owner, átmeneti Stripe-hiba) ne állítsa
                // meg a teljes egyeztetést — naplózzuk és megyünk tovább a következőre.
                $failed++;
                report($e);
            }
        });

        $killCount = count($toClose);

        // Kör-fék: ha a lezárás-jelöltek száma átlép egy abszolút küszöböt ÉS az aktív
        // állomány nagy hányadát érinti, ez szinte biztosan ops-anomália (kulcs-mismatch /
        // Stripe-incidens), nem valós tömeges lemondás. Ilyenkor SEMMIT nem zárunk le,
        // hangosan riasztunk, és FAILURE-rel lépünk ki, hogy az operátor beavatkozhasson.
        if ($this->tripsKillSwitch($killCount, $activeCount)) {
            Log::critical('Előfizetés-egyeztetés MEGSZAKÍTVA: a futás az aktív előfizetések túl nagy hányadát zárná le — valószínű ok rossz módú/fiókú STRIPE_SECRET vagy Stripe-incidens. Nem zártunk le semmit, kézi ellenőrzés szükséges.', [
                'active_count' => $activeCount,
                'would_close_count' => $killCount,
                'ratio' => round($killCount / max($activeCount, 1), 3),
                'max_kill_ratio' => self::MAX_KILL_RATIO,
            ]);

            $this->error("Előfizetés-egyeztetés MEGSZAKÍTVA: {$killCount}/{$activeCount} lezárás túllépné a kör-féket ({$this->percent(self::MAX_KILL_RATIO)}). Nem zártunk le semmit — ellenőrizd a STRIPE_SECRET-et.");

            return self::FAILURE;
        }

        // A fék engedett → a jelölteket ténylegesen lezárjuk (itt megy a DB-írás).
        foreach ($toClose as $subscription) {
            try {
                $this->closeDeadSubscription($subscription, $closeReasons[$subscription->id]);
            } catch (\Throwable $e) {
                $failed++;
                report($e);
            }
        }

        $reconciled = count($toClose) + $synced;
        $this->info("Előfizetés-egyeztetés kész: {$reconciled} korrigálva ({$killCount} lezárva, {$synced} szinkronizálva), {$failed} hiba.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Aktív-e a kör-fék a mostani körre: a lezárás-jelöltek száma elérte az abszolút
     * küszöböt, ÉS az aktív állomány a megengedettnél nagyobb hányadát érinti.
     */
    protected function tripsKillSwitch(int $killCount, int $activeCount): bool
    {
        if ($killCount < self::MIN_KILL_COUNT_FOR_GUARD) {
            return false;
        }

        return ($killCount / max($activeCount, 1)) > self::MAX_KILL_RATIO;
    }

    private function percent(float $ratio): string
    {
        return ((int) round($ratio * 100)).'%';
    }

    /**
     * Egyetlen előfizetés egyeztetése a Stripe valós állapotával — DÖNTÉST ad vissza,
     * a close-ágon nem ír DB-t (azt a handle() a kör-fék után végzi). A státusz-szinkron
     * (élő, de eltérő státuszú sub) itt fut le azonnal, mert nem destruktív.
     *
     *  - CloseDecision      → a helyi sort le kellene zárni (a fék hatálya alatt)
     *  - ReconcileOutcome::Synced   → élő sub, státusz rásimítva
     *  - ReconcileOutcome::Unchanged → nincs teendő
     *
     * Protected, hogy a döntési logika a Stripe HTTP-rétegének felépítése nélkül,
     * mockolt Subscription-nel tesztelhető legyen (lásd ReconcileStripeSubscriptionsTest).
     */
    protected function reconcile(Subscription $subscription): CloseDecision|ReconcileOutcome
    {
        try {
            $stripeStatus = $subscription->asStripeSubscription()->status;
        } catch (InvalidRequestException $e) {
            // A Stripe már nem ismeri ezt az előfizetést (resource_missing): véglegesen
            // törölt, egyetlen korrekciós webhook sem fog már jönni → helyben lezárjuk.
            // (A tényleges lezárást a handle() végzi, a kör-fék jóváhagyása után.)
            if ($e->getStripeCode() === 'resource_missing') {
                return new CloseDecision('resource_missing');
            }

            throw $e;
        }

        // A Stripe szerint halott, de helyileg még aktív → beragadt előfizetés, lezárjuk.
        if (in_array($stripeStatus, self::DEAD_STRIPE_STATUSES, true)) {
            return new CloseDecision($stripeStatus);
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

            return ReconcileOutcome::Synced;
        }

        return ReconcileOutcome::Unchanged;
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

/**
 * Egy egyeztetési kör nem-destruktív kimenete.
 */
enum ReconcileOutcome
{
    /** Élő sub, a helyi státuszt rásimítottuk a Stripe-éra. */
    case Synced;

    /** Nincs teendő — a helyi és a Stripe-állapot egyezik. */
    case Unchanged;
}

/**
 * Lezárás-döntés: a helyi sort le KELLENE zárni, de csak a kör-fék jóváhagyása után.
 * A $reason a lezárás oka (Stripe-státusz vagy 'resource_missing') a naplózáshoz.
 */
final class CloseDecision
{
    public function __construct(public readonly string $reason) {}
}
