<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function makeTrialingPremiumSubscription(User $user): void
{
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'trialing',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
        'trial_ends_at' => now()->addDays(10),
    ]);
}

test('a Stripe-előfizetés trialja megjelenik a pricing oldal propjaiban', function () {
    // A Cashier onTrial()-ja argumentum nélkül csak a generikus trialt és a
    // 'default' típusú előfizetést nézi — az app 'premium' típusú előfizetésének
    // trialja emiatt korábban sosem látszott a UI-ban.
    $user = User::factory()->create();
    makeTrialingPremiumSubscription($user);

    $trialEnd = $user->activeSubscription()->trial_ends_at->toIso8601String();

    $this->actingAs($user)
        ->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('isOnTrial', true)
            ->where('trialEndsAt', $trialEnd)
            ->where('auth.subscription.isOnTrial', true)
        );
});

test('a Stripe-előfizetés trialja megjelenik a subscription beállításokon', function () {
    $user = User::factory()->create();
    makeTrialingPremiumSubscription($user);

    $trialEnd = $user->activeSubscription()->trial_ends_at->toIso8601String();

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('isOnTrial', true)
            ->where('trialEndsAt', $trialEnd)
        );
});

test('a generikus (admin-adta) trial továbbra is látszik', function () {
    $user = User::factory()->create();
    $user->forceFill(['trial_ends_at' => now()->addDays(5)])->save();

    $this->actingAs($user)
        ->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('isOnTrial', true)
            ->where('trialEndsAt', $user->fresh()->trial_ends_at->toIso8601String())
        );
});

test('trial nélkül a trial-propok üresek', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('isOnTrial', false)
            ->where('trialEndsAt', null)
        );
});

test('isOnAnyTrial és currentTrialEndsAt a megfelelő forrásból olvas', function () {
    // Előfizetéses trial: a subscription trial_ends_at-je az irányadó.
    $subscriber = User::factory()->create();
    makeTrialingPremiumSubscription($subscriber);

    expect($subscriber->isOnAnyTrial())->toBeTrue()
        ->and($subscriber->currentTrialEndsAt()?->toIso8601String())
        ->toBe($subscriber->activeSubscription()->trial_ends_at->toIso8601String());

    // Generikus trial: a users.trial_ends_at az irányadó.
    $trialUser = User::factory()->create();
    $trialUser->forceFill(['trial_ends_at' => now()->addDays(3)])->save();
    $trialUser = $trialUser->fresh();

    expect($trialUser->isOnAnyTrial())->toBeTrue()
        ->and($trialUser->currentTrialEndsAt()?->toIso8601String())
        ->toBe($trialUser->trial_ends_at->toIso8601String());

    // Egyik sem: nincs trial.
    $plainUser = User::factory()->create();

    expect($plainUser->isOnAnyTrial())->toBeFalse()
        ->and($plainUser->currentTrialEndsAt())->toBeNull();
});
