<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

test('security page is displayed', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManageTwoFactor', true)
            ->where('twoFactorEnabled', false),
        );
});

test('security page requires password confirmation when enabled', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    $user = User::factory()->create();

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $response = $this->actingAs($user)
        ->get(route('security.edit'));

    $response->assertRedirect(route('password.confirm'));
});

test('security page does not require password confirmation when disabled', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    $user = User::factory()->create();

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => false,
    ]);

    $this->actingAs($user)
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security'),
        );
});

test('security page renders without two factor when feature is disabled', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    config(['fortify.features' => []]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManageTwoFactor', false)
            ->missing('twoFactorEnabled')
            ->missing('requiresConfirmation'),
        );
});

test('password can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('security.edit'));

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue();
});

test('a session with a stale password hash is logged out', function () {
    $user = User::factory()->create();

    // Más eszköz sessionjét szimuláljuk: a benne tárolt jelszóhash már nem
    // egyezik a user aktuális jelszavával (pl. időközben jelszót cserélt).
    $this->actingAs($user)
        ->withSession(['password_hash_web' => 'stale-password-hash'])
        ->get(route('profile.edit'))
        ->assertRedirect(route('login'));

    $this->assertGuest();
});

test('changing the password keeps the current session authenticated', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasNoErrors();

    $this->get(route('profile.edit'))->assertOk();
});

test('changing the password rotates the remember token', function () {
    $user = User::factory()->create(['remember_token' => 'old-remember-token']);

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->remember_token)->not->toBe('old-remember-token');
});

test('correct password must be provided to update password', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasErrors('current_password')
        ->assertRedirect(route('security.edit'));
});

test('security page lists only the users own player devices', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $user->createToken('topwords Player – Laptop', ['player']);
    $other->createToken('topwords Player – Idegen gép', ['player']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->has('playerDevices', 1)
            ->where('playerDevices.0.name', 'topwords Player – Laptop'),
        );
});

test('the security page does not list expired player devices', function () {
    $user = User::factory()->create();

    $user->createToken('topwords Player – Élő', ['player'], now()->addDays(30));
    // Lejárt token: a guard már elutasítja, de a sora a napi prune-ig a táblában marad.
    $user->createToken('topwords Player – Lejárt', ['player'], now()->subDay());

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->has('playerDevices', 1)
            ->where('playerDevices.0.name', 'topwords Player – Élő'),
        );
});

test('a player device can be revoked', function () {
    $user = User::factory()->create();
    $token = $user->createToken('topwords Player – Laptop', ['player'])->accessToken;

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->from(route('security.edit'))
        ->delete(route('security.player-devices.destroy', ['tokenId' => $token->id]))
        ->assertRedirect(route('security.edit'));

    expect($user->tokens()->count())->toBe(0);
});

test('a user cannot revoke another users player device', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $token = $other->createToken('topwords Player – Idegen gép', ['player'])->accessToken;

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('security.player-devices.destroy', ['tokenId' => $token->id]));

    // Idegen tokent nem érhet el (user-scoped lekérdezés) — megmarad.
    expect($other->tokens()->count())->toBe(1);
});

test('F1-L5: revoking a player device requires password confirmation', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();
    $token = $user->createToken('topwords Player – Laptop', ['player'])->accessToken;

    // Friss jelszó-megerősítés nélkül a DELETE nem futhat le — eltérített
    // sessionből ne lehessen jelszó nélkül leválasztani az eszközöket.
    $this->actingAs($user)
        ->delete(route('security.player-devices.destroy', ['tokenId' => $token->id]))
        ->assertRedirect(route('password.confirm'));

    expect($user->tokens()->count())->toBe(1);
});

test('F1-L5: revoking all player devices requires password confirmation', function () {
    $this->skipUnlessFortifyFeature(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();
    $user->createToken('topwords Player – Laptop', ['player']);

    $this->actingAs($user)
        ->delete(route('security.player-devices.destroy-all'))
        ->assertRedirect(route('password.confirm'));

    expect($user->tokens()->count())->toBe(1);
});

test('revoking all player devices leaves non-player tokens intact', function () {
    $user = User::factory()->create();
    $user->createToken('topwords Player – Laptop', ['player']);
    $user->createToken('topwords Player – Telefon', ['player']);
    $user->createToken('Egyéb integráció', ['*']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->from(route('security.edit'))
        ->delete(route('security.player-devices.destroy-all'))
        ->assertRedirect(route('security.edit'));

    // Csak a két player-token törlődött; a szélesebb jogkörű token megmaradt.
    $remaining = $user->tokens()->get();
    expect($remaining)->toHaveCount(1)
        ->and($remaining->first()->name)->toBe('Egyéb integráció');
});

test('the revoke endpoint refuses to delete a non-player token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('Egyéb integráció', ['*'])->accessToken;

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('security.player-devices.destroy', ['tokenId' => $token->id]));

    // A `*`-token nem player-eszköz → nem törölhető ezen a végponton.
    expect($user->tokens()->count())->toBe(1);
});

test('F1-L7: changing the password revokes player device tokens', function () {
    $user = User::factory()->create();
    $user->createToken('topwords Player – Laptop', ['player']);
    $user->createToken('Egyéb integráció', ['*']);

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])
        ->assertSessionHasNoErrors();

    // A player Bearer-token nem élheti túl a jelszóváltást; a szélesebb
    // jogkörű token nem ennek a purge-nek a dolga.
    $remaining = $user->tokens()->get();
    expect($remaining)->toHaveCount(1)
        ->and($remaining->first()->name)->toBe('Egyéb integráció');
});
