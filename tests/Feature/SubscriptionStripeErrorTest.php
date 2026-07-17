<?php

use App\Models\User;
use Laravel\Cashier\Subscription;
use Stripe\Exception\ApiConnectionException;

// A portál/cancel/resume mind Stripe API-t hív — hibájuk (pl. a Customer Portal
// nincs live módban konfigurálva) korábban kezeletlen 500-as volt.

test('a settings portál Stripe-hibája nem 500, hanem hibaüzenettel tér vissza', function () {
    $user = Mockery::mock(User::class)->makePartial();
    $user->shouldReceive('hasStripeId')->andReturnTrue();
    $user->shouldReceive('billingPortalUrl')->once()->andThrow(new ApiConnectionException('boom'));

    $this->actingAs($user)
        ->post(route('subscription.portal'))
        ->assertRedirect()
        ->assertSessionHas('error');
});

test('a pricing portál Stripe-hibája nem 500, hanem hibaüzenettel tér vissza', function () {
    $user = Mockery::mock(User::class)->makePartial();
    // A pricing.portal a 'verified' middleware mögött van (megerősített e-mail kell).
    $user->shouldReceive('hasVerifiedEmail')->andReturnTrue();
    $user->shouldReceive('hasStripeId')->andReturnTrue();
    $user->shouldReceive('billingPortalUrl')->once()->andThrow(new ApiConnectionException('boom'));

    $this->actingAs($user)
        ->post(route('pricing.portal'))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('error');
});

test('a lemondás Stripe-hibája nem 500, hanem hibaüzenettel tér vissza', function () {
    $subscription = Mockery::mock(Subscription::class);
    $subscription->shouldReceive('onGracePeriod')->andReturnFalse();
    // Az Inertia share (isOnAnyTrial) a válasz összeállításakor lekérdezi.
    $subscription->shouldReceive('onTrial')->andReturnFalse();
    $subscription->shouldReceive('cancel')->once()->andThrow(new ApiConnectionException('boom'));

    $user = Mockery::mock(User::class)->makePartial();
    $user->shouldReceive('activeSubscription')->andReturn($subscription);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('subscription.cancel'))
        ->assertRedirect()
        ->assertSessionHas('error');
});

test('a visszavonás Stripe-hibája nem 500, hanem hibaüzenettel tér vissza', function () {
    $subscription = Mockery::mock(Subscription::class);
    $subscription->shouldReceive('onGracePeriod')->andReturnTrue();
    // Az Inertia share (isOnAnyTrial) a válasz összeállításakor lekérdezi.
    $subscription->shouldReceive('onTrial')->andReturnFalse();
    $subscription->shouldReceive('resume')->once()->andThrow(new ApiConnectionException('boom'));

    $user = Mockery::mock(User::class)->makePartial();
    $user->shouldReceive('activeSubscription')->andReturn($subscription);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('subscription.resume'))
        ->assertRedirect()
        ->assertSessionHas('error');
});
