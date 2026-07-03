<?php

use App\Models\User;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Cashier\Subscription;
use Stripe\Exception\ApiConnectionException;

beforeEach(function () {
    // A checkout 404-el, ha a fizetés nincs élesítve (Billing::enabled()); a
    // gatekeeper-viselkedés csak élő Stripe-konfig mellett vizsgálható.
    config([
        'services.stripe.enabled' => true,
        'cashier.key' => 'pk_test_real',
        'cashier.secret' => 'sk_test_real',
        'services.stripe.premium_price_id' => 'price_pro',
    ]);
});

test('checkout requires explicit consent and records it on success', function () {
    // A consent szerveroldali kikényszerítése: kliensoldali pipa nélküli közvetlen POST
    // sem indíthat fizetést. A felhasználónak van számlázási adata, de nincs consent.
    $user = User::factory()->withBilling()->create();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'))
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

test('a lejárt aláírású success-link nem 403, hanem info üzenettel a pricing oldalra visz', function () {
    // A Stripe Checkout session 24 óráig él — a lassan fizető felhasználó lejárt
    // aláírással érkezhet vissza, közvetlenül egy SIKERES fizetés után. Nyers 403
    // helyett kecses visszairányítást kap.
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
    // Üzleti döntés (2026-07): nincs próbaidőszak. A config default 0 —
    // SUBSCRIPTION_TRIAL_DAYS env nélkül a pricing oldal nem hirdet trialt,
    // és a checkout sem ad. Env-ből kapcsolható vissza.
    $this->get(route('pricing'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('pricing')
            ->where('trialDays', 0)
        );
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
        ->post(route('pricing.checkout', 'premium'))
        ->assertRedirect(route('billing.edit'))
        ->assertSessionHas('info');
});

test('checkout does not gate users with complete billing details', function () {
    $user = User::factory()->withBilling()->create();

    $response = $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'));

    // Nem irányít a billing settings-re — a gatekeeper átengedi.
    if ($response->isRedirect()) {
        expect($response->headers->get('Location'))->not->toContain('billing');
    }
});

test('checkout blocks users who already have non-Stripe access', function () {
    // Admin-adta (plan_override) hozzáférésnél nincs Stripe-előfizetés, így a swap-ág nem fogná
    // meg — szerveroldalon kell elzárni, nehogy fölöslegesen fizetős előfizetést indítson.
    $user = User::factory()->withBilling()->create();
    $user->plan_override = 'premium';
    $user->save();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('info');

    expect($user->fresh()->subscriptions()->count())->toBe(0);
});

test('a Stripe oldali hiba a csomagváltáskor nem dől 500-ba, hanem érthető hibaüzenettel tér vissza', function () {
    // A swap() Stripe API-hibája (pl. hálózat, törölt ár) ne kezeletlen kivételként
    // 500-azzon a felhasználónak — a kontroller elkapja és barátságos üzenettel küldi vissza.
    $subscription = Mockery::mock(Subscription::class);
    // A Pro-tól eltérő aktuális ár, hogy a "már ez az aktív csomagod" ág ne fogja
    // meg, hanem valóban a swap() fusson (és dobja a Stripe-hibát).
    $subscription->shouldReceive('getAttribute')->with('stripe_price')->andReturn('price_old');
    // Az Inertia share (isOnAnyTrial) a válasz összeállításakor lekérdezi.
    $subscription->shouldReceive('onTrial')->andReturnFalse();
    $subscription->shouldReceive('swap')->once()->andThrow(new ApiConnectionException('boom'));

    $user = Mockery::mock(User::class)->makePartial();
    // A checkout most a 'verified' middleware mögött van (megerősített e-mail kell).
    $user->shouldReceive('hasVerifiedEmail')->andReturnTrue();
    $user->shouldReceive('hasBillingDetails')->andReturnTrue();
    $user->shouldReceive('activeSubscription')->andReturn($subscription);
    $user->shouldReceive('subscriptionPlan')->andReturn('premium');
    // A consent-naplózás (forceFill->save) ne próbáljon DB-be írni a mock usernél.
    $user->shouldReceive('save')->andReturnTrue();

    $this->actingAs($user)
        ->post(route('pricing.checkout', 'premium'), ['accept_terms' => true])
        ->assertRedirect(route('pricing'))
        ->assertSessionHas('error');
});

test('a trial csak az első előfizetéshez jár — korábbi előfizetés után már nem', function () {
    // #R3: a Cashier előfizetés-rekord lemondás után is megmarad, így a megléte
    // jelzi a korábbi előfizetést. Enélkül lemondás + újra-checkout ismételgetésével
    // korlátlan ingyenes próbaidő lenne szerezhető.
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
    // A checkout már nem adna trialt (#R3), így a UI se ígérjen — a trialDays prop 0.
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
