<?php

use App\Http\Controllers\StripeWebhookController;
use App\Models\User;
use Illuminate\Support\Facades\Log;

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

test('a duplikátum lemondása critical riasztást ad — kézi refund és Billingo-sztornó kellhet', function () {
    // Trial nélküli usernél mindkét Checkout azonnal terhelt és mindkettőről NAV-számla
    // készült — a lemondás nem refundál, a riasztás nélkül ez észrevétlen maradna.
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');
    makeActiveSubscription($user, 'price_premium');

    Log::spy();

    (new StripeWebhookController)->cancelDuplicateSubscriptions($user);

    Log::shouldHaveReceived('critical')
        ->once()
        ->withArgs(fn (string $message, array $context) => $context['user_id'] === $user->id);
});

test('egyetlen előfizetésnél nincs riasztás', function () {
    $user = User::factory()->create();
    makeActiveSubscription($user, 'price_basic');

    Log::spy();

    (new StripeWebhookController)->cancelDuplicateSubscriptions($user);

    Log::shouldNotHaveReceived('critical');
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
