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
    // A Cashier deactivatePastDue=true defaultja miatt a past_due előfizetés már NEM valid()
    // → activeSubscription() null → isPremium hamis. A recovery-figyelmeztetést mégis látnia
    // kell a fizető usernek, ezért a dedikált prop a valid()-et megkerülve olvas.
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    makePastDueSubscription($user);

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', true)
            // A fail-closed lefokozás szándékos: prémium hozzáférés nincs. (Az upsell-blokkot
            // a frontend ilyenkor elrejti — S-L7 —, csak a recovery-sáv renderel.)
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
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', false)
            ->where('isPremium', true)
        );
});

test('lemondott (ends_at kitöltött) past_due előfizetésnél a prop hamis', function () {
    // A már lezárt/lejáró előfizetésre nem szól a recovery-figyelmeztetés.
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
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', false)
        );
});

test('előfizetés nélküli usernél a hasPastDueSubscription prop hamis', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/subscription')
            ->where('hasPastDueSubscription', false)
        );
});
