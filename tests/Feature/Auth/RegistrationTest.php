<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyFeature(Features::registration());
    // A regisztráció-tesztek a nyílt regisztrációt vizsgálják; a fejlesztői
    // .env-ben bekapcsolt meghívó-only mód ne szivárogjon be és ne kérjen kódot.
    config(['registration.invite_only' => false]);
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register but are not logged in until they verify their email', function () {
    Notification::fake();

    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    // E-mail-megerősítés-előbb flow: a regisztráció NEM lépteti be a usert,
    // a login oldalra irányít, és kimegy a megerősítő levél.
    $this->assertGuest();
    $response->assertRedirect(route('login', absolute: false));

    $user = User::where('email', 'test@example.com')->first();
    expect($user)->not->toBeNull();
    expect($user->hasVerifiedEmail())->toBeFalse();

    Notification::assertSentTo($user, VerifyEmail::class);
});

test('registration rejects an individual who submits a tax number', function () {
    // A regisztrációs úton is tilos az ellentmondó individual+adószám állapot,
    // hogy ne ragadhasson a fiókon rossz adat a settings-út megkerülésével (L1).
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'indiv@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'billing_type' => 'individual',
        'billing_tax_number' => '12345678-1-01',
        'billing_country' => 'HU',
        'billing_zip' => '1234',
        'billing_city' => 'Budapest',
        'billing_address' => 'Fő utca 1.',
    ]);

    $response->assertSessionHasErrors('billing_tax_number');
    expect(User::where('email', 'indiv@example.com')->exists())->toBeFalse();
});

test('registration accepts a company with a valid tax number', function () {
    Notification::fake();

    $response = $this->post(route('register.store'), [
        'name' => 'Példa Kft.',
        'email' => 'company@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'billing_type' => 'company',
        'billing_tax_number' => '12345678-1-01',
        'billing_country' => 'HU',
        'billing_zip' => '1234',
        'billing_city' => 'Budapest',
        'billing_address' => 'Fő utca 1.',
    ]);

    $response->assertSessionHasNoErrors();

    $user = User::where('email', 'company@example.com')->first();
    expect($user)->not->toBeNull()
        ->and($user->billing_tax_number)->toBe('12345678-1-01')
        ->and($user->billing_type)->toBe('company')
        // S-L2: a regisztrációkor megadott (és validált) billing_country tényleg elmentődik —
        // korábban a CreateNewUser mentendő mezőiből kimaradt, és némán elveszett, majd a NAV-
        // számla partner-payloadja csendben 'HU'-ra esett volna vissza.
        ->and($user->billing_country)->toBe('HU');
});

test('unverified users are redirected away from protected routes', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)
        ->get(route('words.index'))
        ->assertRedirect(route('verification.notice'));
});

test('verified users can access protected routes', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('words.index'))
        ->assertOk();
});
