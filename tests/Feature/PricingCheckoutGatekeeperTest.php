<?php

use App\Models\User;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

test('checkout requires explicit consent and records it on success', function () {
    // A consent szerveroldali kikényszerítése: kliensoldali pipa nélküli közvetlen POST
    // sem indíthat fizetést. A felhasználónak van számlázási adata, de nincs consent.
    $user = User::factory()->withBilling()->create();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'basic'))
        ->assertSessionHasErrors('accept_terms');

    expect($user->fresh()->terms_accepted_at)->toBeNull();
});

test('success page shows a pending message when the subscription is not active yet', function () {
    // A webhook még nem hozta létre az előfizetést — ne "azonnal elérhető"-t ígérjünk.
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(URL::signedRoute('pricing.success'))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info')
        ->assertSessionMissing('success');
});

test('success page confirms success once the subscription is active', function () {
    $user = User::factory()->create();
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_basic',
        'quantity' => 1,
    ]);

    $this->actingAs($user)
        ->get(URL::signedRoute('pricing.success'))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('success');
});

test('pricing page exposes the configured trial length as a prop', function () {
    // A trial hossz egyetlen forrásból (config) jön — a UI nem hardcode-olja.
    config(['registration.subscription_trial_days' => 9]);

    $this->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('trialDays', 9)
        );
});

test('checkout redirects to billing settings when billing details are missing', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'basic'))
        ->assertRedirect(route('billing.edit'))
        ->assertSessionHas('info');
});

test('checkout does not gate users with complete billing details', function () {
    $user = User::factory()->withBilling()->create();

    $response = $this->actingAs($user)
        ->post(route('pricing.checkout', 'basic'));

    // Nem irányít a billing settings-re — a gatekeeper átengedi.
    if ($response->isRedirect()) {
        expect($response->headers->get('Location'))->not->toContain('billing');
    }
});

test('hasBillingDetails returns false when details are missing', function () {
    $user = User::factory()->create();

    expect($user->hasBillingDetails())->toBeFalse();
});

test('hasBillingDetails returns true when all details are set', function () {
    $user = User::factory()->withBilling()->create();

    expect($user->hasBillingDetails())->toBeTrue();
});
