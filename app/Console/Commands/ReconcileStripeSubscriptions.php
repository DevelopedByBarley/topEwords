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
     * @var array<int, string>
     */
    private const DEAD_STRIPE_STATUSES = [
        StripeSubscription::STATUS_CANCELED,
        StripeSubscription::STATUS_INCOMPLETE_EXPIRED,
    ];

    /**
     * @var array<int, string>
     */
    private const PAYMENT_FAILED_STATUSES = [
        StripeSubscription::STATUS_PAST_DUE,
        StripeSubscription::STATUS_UNPAID,
    ];

    private const MAX_KILL_RATIO = 0.5;

    private const MIN_KILL_COUNT_FOR_GUARD = 5;

    protected bool $dryRun = false;

    public function handle(): int
    {
        $this->dryRun = (bool) $this->option('dry-run');

        $checkedCount = 0;
        $failed = 0;
        $synced = 0;

        /** @var array<int, Subscription> $toClose */
        $toClose = [];
        /** @var array<int, string> $closeReasons */
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
                $failed++;
                report($e);
            }
        });

        $killCount = count($toClose);

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

    protected function tripsKillSwitch(int $killCount, int $checkedCount): bool
    {
        if ($killCount < self::MIN_KILL_COUNT_FOR_GUARD) {
            return false;
        }

        return ($killCount / max($checkedCount, 1)) >= self::MAX_KILL_RATIO;
    }

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

    protected function reconcile(Subscription $subscription): CloseDecision|ReconcileOutcome
    {
        try {
            $stripeStatus = $subscription->asStripeSubscription()->status;
        } catch (InvalidRequestException $e) {
            if ($e->getStripeCode() === 'resource_missing') {
                return new CloseDecision('resource_missing');
            }

            throw $e;
        }

        if (in_array($stripeStatus, self::DEAD_STRIPE_STATUSES, true)) {
            return new CloseDecision($stripeStatus);
        }

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

    protected function closeDeadSubscription(Subscription $subscription, string $reason): void
    {
        Log::critical('Beragadt Stripe-előfizetés — a Stripe-nál már halott, de helyileg aktív volt. Lezárva (elveszett törlő webhook pótlása).', [
            'subscription_id' => $subscription->id,
            'stripe_subscription_id' => $subscription->stripe_id,
            'local_status' => $subscription->stripe_status,
            'stripe_reason' => $reason,
        ]);

        $subscription->skipTrial()->markAsCanceled();
    }
}

enum ReconcileOutcome
{
    case Synced;

    case Unchanged;
}

final class CloseDecision
{
    public function __construct(public readonly string $reason) {}
}
