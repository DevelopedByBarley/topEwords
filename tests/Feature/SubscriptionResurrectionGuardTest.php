<?php

use App\Http\Controllers\StripeWebhookController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Laravel\Cashier\Subscription;

/**
 * W-M1: a Stripe nem garantál esemény-sorrendet — a customer.subscription.deleted
 * feldolgozása után befutó korábbi (késleltetett/újraküldött) subscription.updated
 * `status=active` pillanatképe nem támaszthatja fel a helyben már canceled
 * előfizetést, különben tartós ingyen prémium keletkezne.
 */
function dispatchSubscriptionUpdated(User $user, Subscription $subscription, string $status): void
{
    $request = Request::create('/stripe/webhook', 'POST', content: json_encode([
        'type' => 'customer.subscription.updated',
        'data' => [
            'object' => [
                'id' => $subscription->stripe_id,
                'customer' => $user->stripe_id,
                'status' => $status,
                'items' => [
                    'data' => [
                        [
                            'id' => 'si_'.uniqid(),
                            'price' => ['id' => 'price_basic', 'product' => 'prod_basic'],
                            'quantity' => 1,
                        ],
                    ],
                ],
            ],
        ],
    ]));

    (new StripeWebhookController)->handleWebhook($request);
}

function makeCanceledSubscription(User $user): Subscription
{
    return $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'canceled',
        'stripe_price' => 'price_basic',
        'quantity' => 1,
        'ends_at' => now()->subDay(),
    ]);
}

test('a stale active update cannot resurrect a locally canceled subscription', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $subscription = makeCanceledSubscription($user);
    $endsAt = $subscription->ends_at;

    Log::spy();

    dispatchSubscriptionUpdated($user, $subscription, 'active');

    $subscription->refresh();

    expect($subscription->stripe_status)->toBe('canceled')
        ->and($subscription->ends_at->timestamp)->toBe($endsAt->timestamp)
        ->and($subscription->valid())->toBeFalse()
        ->and($user->fresh()->subscribed())->toBeFalse();

    Log::shouldHaveReceived('warning')
        ->once()
        ->withArgs(fn (string $message, array $context) => $context['stripe_subscription_id'] === $subscription->stripe_id
            && $context['incoming_status'] === 'active');
});

test('an update on a live subscription still applies normally', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);

    $subscription = $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_basic',
        'quantity' => 1,
    ]);

    dispatchSubscriptionUpdated($user, $subscription, 'past_due');

    expect($subscription->refresh()->stripe_status)->toBe('past_due');
});

test('a canceled snapshot on a canceled subscription passes through untouched', function () {
    // Konzisztens (nem feltámasztó) update — a guard nem szólhat közbe.
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $subscription = makeCanceledSubscription($user);

    Log::spy();

    dispatchSubscriptionUpdated($user, $subscription, 'canceled');

    expect($subscription->refresh()->stripe_status)->toBe('canceled');

    Log::shouldNotHaveReceived('warning');
});

test('an active update on an unknown subscription still creates the local row', function () {
    // A guard csak a helyben canceled sorokat védi — új előfizetés webhookból
    // (pl. dashboardról indítva) továbbra is létrejöhet a Cashier alap-útján.
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);

    $stripeId = 'sub_'.uniqid();

    $request = Request::create('/stripe/webhook', 'POST', content: json_encode([
        'type' => 'customer.subscription.updated',
        'data' => [
            'object' => [
                'id' => $stripeId,
                'customer' => $user->stripe_id,
                'status' => 'active',
                'items' => [
                    'data' => [
                        [
                            'id' => 'si_'.uniqid(),
                            'price' => ['id' => 'price_basic', 'product' => 'prod_basic'],
                            'quantity' => 1,
                        ],
                    ],
                ],
            ],
        ],
    ]));

    (new StripeWebhookController)->handleWebhook($request);

    expect($user->subscriptions()->where('stripe_id', $stripeId)->exists())->toBeTrue();
});
