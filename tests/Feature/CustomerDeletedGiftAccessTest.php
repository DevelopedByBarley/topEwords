<?php

use App\Http\Controllers\StripeWebhookController;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * A Stripe customer.deleted webhook nem veheti el az admin által kézzel adott
 * „ajándék-hónapot" (users.trial_ends_at) — az nem Stripe-eredetű. A Cashier
 * alapból nullázná; a felülírt handler visszaállítja, ha a jövőben jár le.
 */
function dispatchCustomerDeleted(User $user): void
{
    $request = Request::create('/stripe/webhook', 'POST', content: json_encode([
        'type' => 'customer.deleted',
        'data' => ['object' => ['id' => $user->stripe_id]],
    ]));

    (new StripeWebhookController)->handleWebhook($request);
}

test('customer.deleted preserves a future admin gift month', function () {
    $giftEndsAt = now()->addWeeks(3);

    $user = User::factory()->create([
        'stripe_id' => 'cus_'.uniqid(),
        'trial_ends_at' => $giftEndsAt,
    ]);

    dispatchCustomerDeleted($user);

    $user->refresh();

    expect($user->stripe_id)->toBeNull()
        ->and($user->trial_ends_at)->not->toBeNull()
        ->and($user->trial_ends_at->timestamp)->toBe($giftEndsAt->timestamp)
        ->and($user->currentPlan())->toBe('premium');
});

test('customer.deleted does not resurrect an already-expired gift month', function () {
    $user = User::factory()->create([
        'stripe_id' => 'cus_'.uniqid(),
        'trial_ends_at' => now()->subDay(),
    ]);

    dispatchCustomerDeleted($user);

    $user->refresh();

    expect($user->trial_ends_at)->toBeNull()
        ->and($user->currentPlan())->toBe('free');
});

test('customer.deleted leaves lifetime access untouched', function () {
    $user = User::factory()->create([
        'stripe_id' => 'cus_'.uniqid(),
        'lifetime_access' => true,
        'trial_ends_at' => null,
    ]);

    dispatchCustomerDeleted($user);

    $user->refresh();

    expect($user->stripe_id)->toBeNull()
        ->and($user->lifetime_access)->toBeTrue()
        ->and($user->currentPlan())->toBe('premium');
});
