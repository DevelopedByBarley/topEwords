<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateBillingoInvoice;
use App\Models\User;
use App\Services\Billingo\BillingProfile;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Http\Controllers\WebhookController;
use Laravel\Cashier\Subscription;
use Stripe\Subscription as StripeSubscription;

class StripeWebhookController extends WebhookController
{
    protected int $duplicateCleanupLockWaitSeconds = 10;

    public function handleWebhook(Request $request)
    {
        $payload = json_decode($request->getContent(), true);
        $eventId = is_array($payload) ? ($payload['id'] ?? null) : null;

        if (! is_string($eventId) || $eventId === '') {
            return parent::handleWebhook($request);
        }

        $reserved = DB::table('stripe_webhook_events')->insertOrIgnore([
            'event_id' => $eventId,
            'type' => is_string($payload['type'] ?? null) ? $payload['type'] : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($reserved === 0) {
            Log::info('Duplikált Stripe-webhook event — kihagyva (már feldolgozva).', [
                'stripe_event_id' => $eventId,
                'type' => $payload['type'] ?? null,
            ]);

            return $this->successMethod();
        }

        try {
            return parent::handleWebhook($request);
        } catch (\Throwable $e) {
            DB::table('stripe_webhook_events')->where('event_id', $eventId)->delete();

            throw $e;
        }
    }

    protected function handleInvoicePaymentSucceeded(array $payload)
    {
        $invoice = $payload['data']['object'] ?? [];
        $user = $this->getUserByStripeId($invoice['customer'] ?? null);

        if ($user instanceof User && config('services.billingo.enabled')) {
            GenerateBillingoInvoice::dispatch(BillingProfile::fromUser($user), GenerateBillingoInvoice::onlyNeededFields($invoice));
        } elseif (config('services.billingo.enabled') && $this->grossMinorPaid($invoice) > 0) {
            Log::critical('Sikeres Stripe-terhelés ismeretlen customerhez — NAV-számla NEM készül, kézi kiállítás kell!', [
                'stripe_customer' => $invoice['customer'] ?? null,
                'stripe_invoice_id' => $invoice['id'] ?? null,
                'amount_paid_minor' => $this->grossMinorPaid($invoice),
            ]);
        }

        return $this->successMethod();
    }

    /**
     * @param  array<string, mixed>  $invoice
     */
    private function grossMinorPaid(array $invoice): int
    {
        return (int) ($invoice['amount_paid'] ?? $invoice['total'] ?? 0);
    }

    protected function handleChargeRefunded(array $payload)
    {
        $charge = $payload['data']['object'] ?? [];
        $amountRefundedMinor = (int) ($charge['amount_refunded'] ?? 0);

        if (config('services.billingo.enabled') && $amountRefundedMinor > 0) {
            Log::critical('Stripe-visszatérítés történt — NAV-sztornó (jóváíró) számla NEM készül automatikusan, kézi kiállítás kell!', [
                'stripe_charge_id' => $charge['id'] ?? null,
                'stripe_customer' => $charge['customer'] ?? null,
                'stripe_invoice_id' => $charge['invoice'] ?? null,
                'amount_refunded_minor' => $amountRefundedMinor,
                'currency' => $charge['currency'] ?? null,
            ]);
        }

        return $this->successMethod();
    }

    protected function handleCustomerDeleted(array $payload)
    {
        $user = $this->getUserByStripeId($payload['data']['object']['id'] ?? null);
        $giftTrialEndsAt = $user instanceof User ? $user->trial_ends_at : null;

        $response = parent::handleCustomerDeleted($payload);

        if ($user instanceof User && $giftTrialEndsAt !== null && $giftTrialEndsAt->isFuture()) {
            $user->newQuery()->whereKey($user->getKey())->update(['trial_ends_at' => $giftTrialEndsAt]);
            $user->trial_ends_at = $giftTrialEndsAt;
        }

        return $response;
    }

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

    public function cancelDuplicateSubscriptions(User $user): void
    {
        $lock = Cache::lock("stripe:dup-subs:{$user->id}", 30);

        try {
            $lock->block($this->duplicateCleanupLockWaitSeconds);
        } catch (LockTimeoutException) {
            Log::critical('A duplikált előfizetések takarítása kimaradt (a user-szintű lock foglalt) — automatikus újrafuttatás nincs, ellenőrizd kézzel, maradt-e két élő, terhelő előfizetés!', [
                'user_id' => $user->id,
                'lock_wait_seconds' => $this->duplicateCleanupLockWaitSeconds,
            ]);

            return;
        }

        try {
            $this->cancelDuplicateSubscriptionsLocked($user);
        } finally {
            $lock->release();
        }
    }

    private function cancelDuplicateSubscriptionsLocked(User $user): void
    {
        foreach ($this->duplicateSubscriptionsFor($user) as $subscription) {
            Log::critical('Duplikált Stripe-előfizetés — lemondjuk; ellenőrizd, kell-e kézi refund és Billingo-sztornó!', [
                'user_id' => $user->id,
                'duplicate_subscription_stripe_id' => $subscription->stripe_id,
            ]);

            try {
                $subscription->cancelNow();
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    /**
     * @return Collection<int, Subscription>
     */
    public function duplicateSubscriptionsFor(User $user): Collection
    {
        $candidates = $user->subscriptions()
            ->where('stripe_status', '!=', StripeSubscription::STATUS_CANCELED)
            ->whereNull('ends_at')
            ->reorder()
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
