<?php

use App\Models\User;
use Laravel\Fortify\Features;

function authSource(string $path): string
{
    return file_get_contents(resource_path("js/{$path}"));
}

test('a bejelentkező oldal megkapja a feltételes elemeihez tartozó propokat', function () {
    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/login')
            ->where('canResetPassword', Features::enabled(Features::resetPasswords()))
            ->where('canRegister', Features::enabled(Features::registration()))
            ->has('status')
        );
});

test('a regisztráció után a bejelentkező oldal kiírja a megerősítő üzenetet', function () {
    $this->skipUnlessFortifyFeature(Features::registration());
    config(['registration.invite_only' => false]);

    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'status@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
        'terms' => 'on',
    ]);

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/login')
            ->where('status', fn (?string $status) => filled($status))
        );
});

test('a regisztrációs oldal átveszi a linkből érkező meghívókódot', function () {
    $this->skipUnlessFortifyFeature(Features::registration());
    config(['registration.invite_only' => true]);

    $this->get(route('register', ['invite' => 'ABC123']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/register')
            ->where('inviteOnly', true)
            ->where('invite', 'ABC123')
        );
});

test('a mezők hibaüzenete a képernyőolvasóhoz is eljut', function () {
    expect(authSource('components/auth/auth-field.tsx'))
        ->toContain('aria-invalid')
        ->toContain('aria-describedby');

    expect(authSource('components/input-error.tsx'))->toContain('role="alert"');
});

test('az auth-űrlapok nem írják felül a natív tab-sorrendet', function () {
    foreach (['pages/auth/login.tsx', 'pages/auth/register.tsx'] as $page) {
        expect(authSource($page))->not->toMatch('/tabIndex=\{\d+\}/');
    }

    expect(authSource('components/password-input.tsx'))->not->toContain('tabIndex={-1}');
});

test('a regisztráció elmondja, hogy e-mail-megerősítés következik', function () {
    expect(authSource('components/auth/register-fields.tsx'))->toContain('megerősítő e-mailt');
});

test('a regisztráció kifejezett pipával fogadtatja el a jogi dokumentumokat', function () {
    expect(authSource('components/auth/register-fields.tsx'))
        ->toContain('id="terms"')
        ->toContain('name="terms"')
        ->toContain('terms.url()')
        ->toContain('privacy.url()');
});

test('elfogadás nélkül nem jön létre fiók', function () {
    $this->skipUnlessFortifyFeature(Features::registration());
    config(['registration.invite_only' => false]);

    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'noterms@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasErrors('terms');

    expect(User::where('email', 'noterms@example.com')->exists())->toBeFalse();
});

test('a számlázási panel magától kinyílik, ha hibát ad vissza a szerver', function () {
    expect(authSource('components/auth/register-fields.tsx'))
        ->toContain("field.startsWith('billing_')")
        ->toContain('billingRequested || hasBillingError');
});

test('az auth-keret nem hirdet kivezetett funkciókat', function () {
    expect(authSource('layouts/auth/auth-split-layout.tsx'))
        ->not->toContain('kvíz')
        ->not->toContain('Kvíz')
        ->not->toContain('mondatkiegészítés');
});
