<?php

use App\Models\User;

test('cancel without an active subscription does not flash a fake success', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('subscription.edit'))
        ->post(route('subscription.cancel'))
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionMissing('success');
});

test('resume without a cancellation informs the user instead of staying silent', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('subscription.edit'))
        ->post(route('subscription.resume'))
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionHas('info')
        ->assertSessionMissing('success');
});

test('the subscription portal route is rate limited', function () {
    // Stripe ügyfél nélkül a portál a /pricing-re irányít (nincs valódi Stripe-hívás),
    // így biztonságosan tesztelhető a throttle:10,1 korlát.
    $user = User::factory()->create();

    foreach (range(1, 10) as $i) {
        $this->actingAs($user)
            ->post(route('subscription.portal'))
            ->assertStatus(302);
    }

    $this->actingAs($user)
        ->post(route('subscription.portal'))
        ->assertStatus(429);
});
