<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function makePastDueSubscription(User $user): void
{
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'past_due',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
    ]);
}

test('past_due előfizetésnél a hasPastDueSubscription prop igaz, az isPremium blokktól függetlenül', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    makePastDueSubscription($user);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', true)
            ->where('isPremium', false)
            ->where('isSubscribed', false)
        );
});

test('aktív előfizetésnél a hasPastDueSubscription prop hamis', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
    ]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', false)
            ->where('isPremium', true)
        );
});

test('lemondott (ends_at kitöltött) past_due előfizetésnél a prop hamis', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'past_due',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
        'ends_at' => now()->subDay(),
    ]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', false)
        );
});

test('előfizetés nélküli usernél a hasPastDueSubscription prop hamis', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', false)
        );
});
