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
