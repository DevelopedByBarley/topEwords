<?php

use App\Models\User;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Cashier\Subscription;
use Laravel\Cashier\SubscriptionBuilder;
use Stripe\Exception\ApiConnectionException;

beforeEach(function () {
    config([
        'services.stripe.enabled' => true,
        'cashier.key' => 'pk_test_real',
        'cashier.secret' => 'sk_test_real',
        'services.stripe.premium_price_id' => 'price_pro',
    ]);
});

test('checkout requires explicit consent and records it on success', function () {
    $user = User::factory()->withBilling()->create();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'))
        ->assertSessionHasErrors('accept_terms');

    expect($user->fresh()->terms_accepted_at)->toBeNull();
});

test('success page shows a pending message when the subscription is not active yet', function () {
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

test('a lejárt aláírású success-link nem 403, hanem info üzenettel a pricing oldalra visz', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(URL::temporarySignedRoute('pricing.success', now()->subMinute()))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');
});

test('aláírás nélküli success-hívás sem 403, hanem a pricing oldalra visz', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('pricing.success'))
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');
});

test('trial is disabled by default', function () {
    $this->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('trialDays', 0)
        );
});

test('pricing page exposes the configured trial length as a prop', function () {
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
        ->post(route('pricing.checkout', 'premium'))
        ->assertRedirect(route('billing.edit'))
        ->assertSessionHas('info');
});

test('checkout does not gate users with complete billing details', function () {
    $user = User::factory()->withBilling()->create();

    $response = $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'));

    if ($response->isRedirect()) {
        expect($response->headers->get('Location'))->not->toContain('billing');
    }
});

test('checkout blocks users who already have non-Stripe access', function () {
    $user = User::factory()->withBilling()->create();
    $user->plan_override = 'premium';
    $user->save();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');

    expect($user->fresh()->subscriptions()->count())->toBe(0);
});

test('checkout blocks lifetime access users without a subscription', function () {
    $user = User::factory()->withBilling()->create();
    $user->lifetime_access = true;
    $user->save();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');

    expect($user->fresh()->subscriptions()->count())->toBe(0);
});

test('past_due előfizetésnél a checkout elzárva, a kártya-frissítés felé irányít', function () {
    $user = User::factory()->withBilling()->create(['stripe_id' => 'cus_'.uniqid()]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'past_due',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
    ]);

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionHas('info');

    expect($user->fresh()->subscriptions()->count())->toBe(1);
});

test('a lemondott (ends_at kitöltött) past_due előfizetés nem zárja el a checkoutot', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'past_due',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
        'ends_at' => now()->subDay(),
    ]);

    expect($user->hasPastDueSubscription())->toBeFalse();
});

test('a nem-fizetős kapuk a billing-kapu ELŐTT futnak: plan_override user billing-adat nélkül is a helyes üzenetet kapja', function () {
    $user = User::factory()->create(['plan_override' => 'premium']);

    expect($user->hasBillingDetails())->toBeFalse();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');

    expect($user->fresh()->subscriptions()->count())->toBe(0);
});

test('a nem-fizetős kapuk a billing-kapu ELŐTT futnak: past_due user billing-adat nélkül is a kártya-frissítés felé megy', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_'.uniqid()]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'past_due',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
    ]);

    expect($user->hasBillingDetails())->toBeFalse();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionHas('info');
});

test('grace period alatt (lemondva, de aktív) a checkout a lemondás-visszavonás felé terel, nem swap-ol', function () {
    $user = User::factory()->withBilling()->create(['stripe_id' => 'cus_'.uniqid()]);
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'active',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
        'ends_at' => now()->addDays(10),
    ]);

    expect($user->activeSubscription()?->onGracePeriod())->toBeTrue();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('subscription.edit'))
        ->assertSessionHas('info');
});

test('a generikus próbaidő (ajándék hónap) alatt is lehet előfizetni, a megmaradt idő a checkout próbaidejeként megy tovább', function () {
    $trialEndsAt = now()->addDays(20)->startOfSecond();

    $builder = Mockery::mock(SubscriptionBuilder::class);
    $builder->shouldReceive('trialUntil')
        ->once()
        ->withArgs(fn ($until) => $until->eq($trialEndsAt))
        ->andReturnSelf();
    $builder->shouldReceive('checkout')
        ->once()
        ->andReturn((object) ['url' => 'https://checkout.stripe.test/c/session']);

    $user = Mockery::mock(User::class)->makePartial();
    $user->shouldReceive('hasVerifiedEmail')->andReturnTrue();
    $user->shouldReceive('hasBillingDetails')->andReturnTrue();
    $user->shouldReceive('activeSubscription')->andReturnNull();
    $user->shouldReceive('hasPastDueSubscription')->andReturnFalse();
    $user->shouldReceive('newSubscription')->once()->with('premium', 'price_pro')->andReturn($builder);
    $user->shouldReceive('save')->andReturnTrue();
    $user->trial_ends_at = $trialEndsAt;

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect('https://checkout.stripe.test/c/session');
});

test('ha a konfigurált első-előfizetési trial hosszabb a megmaradt ajándék-időnél, a hosszabb érvényesül', function () {
    config(['registration.subscription_trial_days' => 9]);

    $builder = Mockery::mock(SubscriptionBuilder::class);
    $builder->shouldReceive('trialUntil')
        ->once()
        ->withArgs(fn ($until) => $until->between(now()->addDays(9)->subMinute(), now()->addDays(9)->addMinute()))
        ->andReturnSelf();
    $builder->shouldReceive('checkout')
        ->once()
        ->andReturn((object) ['url' => 'https://checkout.stripe.test/c/session']);

    $user = Mockery::mock(User::class)->makePartial();
    $user->shouldReceive('hasVerifiedEmail')->andReturnTrue();
    $user->shouldReceive('hasBillingDetails')->andReturnTrue();
    $user->shouldReceive('activeSubscription')->andReturnNull();
    $user->shouldReceive('hasPastDueSubscription')->andReturnFalse();
    $user->shouldReceive('isEligibleForSubscriptionTrial')->andReturnTrue();
    $user->shouldReceive('newSubscription')->once()->with('premium', 'price_pro')->andReturn($builder);
    $user->shouldReceive('save')->andReturnTrue();
    $user->trial_ends_at = now()->addDays(3)->startOfSecond();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect('https://checkout.stripe.test/c/session');
});

test('a Stripe oldali hiba a csomagváltáskor nem dől 500-ba, hanem érthető hibaüzenettel tér vissza', function () {
    $subscription = Mockery::mock(Subscription::class);
    $subscription->shouldReceive('getAttribute')->with('stripe_price')->andReturn('price_old');
    $subscription->shouldReceive('onTrial')->andReturnFalse();
    $subscription->shouldReceive('onGracePeriod')->andReturnFalse();
    $subscription->shouldReceive('swap')->once()->andThrow(new ApiConnectionException('boom'));

    $user = Mockery::mock(User::class)->makePartial();
    $user->shouldReceive('hasVerifiedEmail')->andReturnTrue();
    $user->shouldReceive('hasBillingDetails')->andReturnTrue();
    $user->shouldReceive('activeSubscription')->andReturn($subscription);
    $user->shouldReceive('subscriptionPlan')->andReturn('premium');
    $user->shouldReceive('save')->andReturnTrue();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('error');
});

test('a trial csak az első előfizetéshez jár — korábbi előfizetés után már nem', function () {
    $user = User::factory()->create();

    expect($user->isEligibleForSubscriptionTrial())->toBeTrue();

    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'canceled',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
        'ends_at' => now()->subDay(),
    ]);

    expect($user->fresh()->isEligibleForSubscriptionTrial())->toBeFalse();
});

test('a pricing oldal nem hirdet próbaidőt a korábban már előfizetett felhasználónak', function () {
    config(['registration.subscription_trial_days' => 7]);

    $user = User::factory()->create();
    $user->subscriptions()->create([
        'type' => 'premium',
        'stripe_id' => 'sub_'.uniqid(),
        'stripe_status' => 'canceled',
        'stripe_price' => 'price_pro',
        'quantity' => 1,
        'ends_at' => now()->subDay(),
    ]);

    $this->actingAs($user)
        ->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('trialDays', 0)
        );
});

test('hasBillingDetails returns false when details are missing', function () {
    $user = User::factory()->create();

    expect($user->hasBillingDetails())->toBeFalse();
});

test('hasBillingDetails returns true when all details are set', function () {
    $user = User::factory()->withBilling()->create();

    expect($user->hasBillingDetails())->toBeTrue();
});

test('hasBillingDetails returns false when billing_country is missing', function () {
    $user = User::factory()->withBilling()->create(['billing_country' => '']);

    expect($user->hasBillingDetails())->toBeFalse();
});

test('hasBillingDetails returns false when billing_type is missing', function () {
    $user = User::factory()->withBilling()->create(['billing_type' => '']);

    expect($user->hasBillingDetails())->toBeFalse();
});

test('hasBillingDetails requires a tax number for company billing', function () {
    $company = User::factory()->withBilling()->create([
        'billing_type' => 'company',
        'billing_tax_number' => null,
        'billing_company_registration_number' => '01-09-999999',
    ]);
    expect($company->hasBillingDetails())->toBeFalse();

    $company->billing_tax_number = '12345678-1-01';
    expect($company->hasBillingDetails())->toBeTrue();
});

test('hasBillingDetails requires a company registration number for company billing', function () {
    $company = User::factory()->withBilling()->create([
        'billing_type' => 'company',
        'billing_tax_number' => '12345678-1-01',
        'billing_company_registration_number' => null,
    ]);
    expect($company->hasBillingDetails())->toBeFalse();

    $company->billing_company_registration_number = '01-09-999999';
    expect($company->hasBillingDetails())->toBeTrue();
});

test('hasBillingDetails allows individual billing without a tax number', function () {
    $user = User::factory()->withBilling()->create([
        'billing_type' => 'individual',
        'billing_tax_number' => null,
    ]);

    expect($user->hasBillingDetails())->toBeTrue();
});
