<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Cashier;
use Laravel\Cashier\Subscription;
use Stripe\Exception\InvalidRequestException;
use Stripe\Subscription as StripeSubscription;

#[Signature('cashier:reconcile-subscriptions {--dry-run : Semmit nem ír: csak kilistázza, mit szinkronizálna és mit zárna le}')]
#[Description('Összeveti a helyileg aktívnak hitt (és a past_due/unpaid) előfizetéseket a Stripe valós állapotával: a Stripe-nál már halottakat lezárja, az eltérő státuszúakat rásimítja — így egy elveszett customer.subscription.deleted/updated esemény sem hagy beragadt „ingyen prémium", vagy fizetett, mégis Free-n ragadt előfizetést.')]
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
     * A helyben fizetési hiba miatt szünetelő státuszok, amelyeket a Cashier active()
     * scope-ja kizár, mégis egyeztetni kell őket (F9A-L3): ha a user utólag fizet, és a
     * helyreállító customer.subscription.updated elvész, a sor örökre past_due/unpaid
     * maradna — a user fizetett, de Free-n ragad. A státusz-szinkron ág nem destruktív.
     *
     * @var array<int, string>
     */
    private const PAYMENT_FAILED_STATUSES = [
        StripeSubscription::STATUS_PAST_DUE,
        StripeSubscription::STATUS_UNPAID,
    ];

    /**
     * Kör-fék (blast-radius guard). Ha egyetlen futás a vizsgált állomány ennél nagyobb
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

    /** A --dry-run futás: se státusz-szinkron, se lezárás, csak jelentés. */
    protected bool $dryRun = false;

    public function handle(): int
    {
        // A Stripe webhookok legalább-egyszer, sorrend nélkül érkeznek, és egy végleg
        // elveszett customer.subscription.deleted a helyi sort tartósan aktívan hagyná
        // (a handleCustomerSubscriptionUpdated guard csak a másik irányban véd). Ez a
        // parancs a Stripe-ot tekinti igazságforrásnak: minden helyileg aktív (és a
        // past_due/unpaid) előfizetést visszaellenőriz, a Stripe-nál már halottat helyben is
        // lezárja, az eltérő státuszút rásimítja.
        //
        // Két fázisban dolgozunk, hogy egy ops-hiba ne zárhassa le fék nélkül a teljes
        // fizető állományt: (1) eldöntjük, mit kellene tenni (Stripe-olvasás, DB-írás
        // nélkül a close-ágon), közben számoljuk a lezárás-jelölteket; (2) a kör-fék
        // után hajtjuk végre a lezárásokat. A státusz-szinkron (élő sub) azonnal fut,
        // mert az nem destruktív és nem esik a fék hatálya alá.
        $this->dryRun = (bool) $this->option('dry-run');

        $checkedCount = 0;
        $failed = 0;
        $synced = 0;

        /** @var array<int, Subscription> $toClose */
        $toClose = [];
        /** @var array<int, string> $closeReasons a subscription id → lezárás oka */
        $closeReasons = [];

        $this->reconcilableSubscriptions()->cursor()->each(function (Subscription $subscription) use (&$checkedCount, &$failed, &$synced, &$toClose, &$closeReasons): void {
            $checkedCount++;

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

        // Kör-fék: ha a lezárás-jelöltek száma átlép egy abszolút küszöböt ÉS a vizsgált
        // állomány nagy hányadát érinti, ez szinte biztosan ops-anomália (kulcs-mismatch /
        // Stripe-incidens), nem valós tömeges lemondás. Ilyenkor SEMMIT nem zárunk le,
        // hangosan riasztunk, és FAILURE-rel lépünk ki, hogy az operátor beavatkozhasson.
        if ($this->tripsKillSwitch($killCount, $checkedCount)) {
            Log::critical('Előfizetés-egyeztetés MEGSZAKÍTVA: a futás a vizsgált előfizetések túl nagy hányadát zárná le — valószínű ok rossz módú/fiókú STRIPE_SECRET vagy Stripe-incidens. Nem zártunk le semmit, kézi ellenőrzés szükséges.', [
                'checked_count' => $checkedCount,
                'would_close_count' => $killCount,
                'ratio' => round($killCount / max($checkedCount, 1), 3),
                'max_kill_ratio' => self::MAX_KILL_RATIO,
            ]);

            $this->error("Előfizetés-egyeztetés MEGSZAKÍTVA: {$killCount}/{$checkedCount} lezárás túllépné a kör-féket ({$this->percent(self::MAX_KILL_RATIO)}). Nem zártunk le semmit — ellenőrizd a STRIPE_SECRET-et.");

            return self::FAILURE;
        }

        // Fiók-ellenőrzés (F9A-L2): a resource_missing a rossz fiókú/módú kulcs tünete
        // is lehet, és ezt a kör-fék kis állományon (5 jelölt alatt) nem fogja meg. Ilyen
        // lezárás előtt egy független jelet kérünk: a konfigurált Pro ár fiókhoz és
        // módhoz kötött, tehát ha ez sem kérhető le, a kulcs a hibás, nem az előfizetés —
        // ekkor egyetlen sort sem zárunk le, darabszámtól függetlenül.
        if (in_array('resource_missing', $closeReasons, true) && ! $this->stripeAccountIsVerified()) {
            Log::critical('Előfizetés-egyeztetés MEGSZAKÍTVA: a Stripe resource_missing-et adott, de a konfigurált Pro ár sem kérhető le — valószínű ok rossz fiókú/módú STRIPE_SECRET vagy hiányzó STRIPE_PRO_PRICE_ID. Nem zártunk le semmit.', [
                'checked_count' => $checkedCount,
                'would_close_count' => $killCount,
            ]);

            $this->error("Előfizetés-egyeztetés MEGSZAKÍTVA: {$killCount} lezárás-jelölt, de a Stripe-fiók nem igazolható (a Pro ár nem kérhető le). Nem zártunk le semmit — ellenőrizd a STRIPE_SECRET-et és a STRIPE_PRO_PRICE_ID-t.");

            return self::FAILURE;
        }

        if ($this->dryRun) {
            foreach ($toClose as $subscription) {
                $this->line("[dry-run] lezárná: #{$subscription->id} {$subscription->stripe_id} (user #{$subscription->user_id}, ok: {$closeReasons[$subscription->id]})");
            }

            $this->info("Előfizetés-egyeztetés (dry-run): {$checkedCount} vizsgált, {$killCount} lezárná, {$synced} szinkronizálná, {$failed} hiba. Nem történt írás.");

            return $failed > 0 ? self::FAILURE : self::SUCCESS;
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
     * Az egyeztetendő előfizetések: a Cashier active() scope-ja (élő / trialing / grace
     * period) ÉS a fizetési hiba miatt szünetelő (past_due / unpaid), még le nem járt sorok
     * (F9A-L3). A past_due/unpaid sor is ugyanazon a döntési úton megy: a halott a kör-fék
     * és a fiók-ellenőrzés hatálya alatt záródik le, az élő-de-eltérő (pl. már active)
     * státuszt a nem destruktív szinkron-ág simítja rá. A lezárt (canceled) sorokat a
     * lekérdezés nem érinti — azokat a resurrection guard szerint sosem élesztjük fel.
     *
     * @return Builder<Subscription>
     */
    protected function reconcilableSubscriptions(): Builder
    {
        return Subscription::query()
            ->where(fn (Builder $query) => $query->active())
            ->orWhere(fn (Builder $query) => $query
                ->whereIn('stripe_status', self::PAYMENT_FAILED_STATUSES)
                ->where(fn (Builder $query) => $query->whereNull('ends_at')->orWhere(fn (Builder $query) => $query->onGracePeriod())));
    }

    /**
     * Aktív-e a kör-fék a mostani körre: a lezárás-jelöltek száma elérte az abszolút
     * küszöböt, ÉS a vizsgált állomány a megengedettnél nagyobb hányadát érinti.
     */
    protected function tripsKillSwitch(int $killCount, int $checkedCount): bool
    {
        if ($killCount < self::MIN_KILL_COUNT_FOR_GUARD) {
            return false;
        }

        // Inkluzív határ: a pontosan fél állomány lezárása is anomália (F9A-L2).
        return ($killCount / max($checkedCount, 1)) >= self::MAX_KILL_RATIO;
    }

    /**
     * A kulcs a várt Stripe-fiókhoz és módhoz tartozik-e: a konfigurált Pro ár
     * lekérhető. Hiányzó ár-azonosítónál sem igazolható — ilyenkor fail-closed.
     */
    protected function stripeAccountIsVerified(): bool
    {
        $priceId = config('services.stripe.premium_price_id');

        if (! is_string($priceId) || $priceId === '') {
            return false;
        }

        try {
            Cashier::stripe()->prices->retrieve($priceId);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
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

        // A Stripe szerint halott, de helyileg még aktív/past_due/unpaid → beragadt
        // előfizetés, lezárjuk.
        if (in_array($stripeStatus, self::DEAD_STRIPE_STATUSES, true)) {
            return new CloseDecision($stripeStatus);
        }

        // Él a Stripe-nál, de a státusz eltér (pl. elveszett past_due/unpaid frissítés, vagy
        // fordítva: a helyi past_due sor a Stripe-nál már újra active, F9A-L3): rásimítjuk a
        // valós állapotot, hogy a helyi jogosultság se tévedjen.
        if ($subscription->stripe_status !== $stripeStatus) {
            if ($this->dryRun) {
                $this->line("[dry-run] szinkronizálná: #{$subscription->id} {$subscription->stripe_id} ({$subscription->stripe_status} → {$stripeStatus})");

                return ReconcileOutcome::Synced;
            }

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

        // A skipTrial() nélkül a lezárt, de még jövőbeli trial_ends_at-ű sor valid()
        // maradna, és a trial végéig prémiumot adna (F9A-L4) — a Cashier saját
        // customer.subscription.deleted kezelője is így zár. A users.trial_ends_at-en
        // lévő (admin-adta) próbaidőt ez nem érinti.
        $subscription->skipTrial()->markAsCanceled();
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
