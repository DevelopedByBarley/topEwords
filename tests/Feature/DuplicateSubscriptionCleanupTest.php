<?php

use App\Http\Controllers\StripeWebhookController;
use App\Models\User;

function makeActiveSubscription(User $user, string $price): void
{
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => $price,
        'quantity' => 1,
    ]);
}

test('a single active subscription has no duplicates to cancel', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(0);
});

test('the earliest active subscription is kept and later ones are duplicates', function () {
    // Két párhuzamos Checkout-befejezés két aktív előfizetést hozott létre.
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');
    makeActiveSubscription($user, 'price_premium');

    $kept = $user->subscriptions()->orderBy('id')->first();
    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(1)
        ->and($duplicates->first()->id)->not->toBe($kept->id)
        ->and($duplicates->first()->id)->toBe($user->subscriptions()->orderBy('id', 'desc')->first()->id);
});

test('already-canceled subscriptions are not counted as duplicates', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');

    // Egy lemondott (grace period) előfizetés nem duplikátum — már nem számláz külön.
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_premium',
        'quantity' => 1,
        'ends_at' => now()->addDays(5),
    ]);

    $duplicates = (new StripeWebhookController)->duplicateSubscriptionsFor($user);

    expect($duplicates)->toHaveCount(0);
});
