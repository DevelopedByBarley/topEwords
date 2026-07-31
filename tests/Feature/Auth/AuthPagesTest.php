<?php

/**
 * A bejelentkezés és a regisztráció UX-őrszem tesztjei.
 *
 * A két oldal viselkedésének nagy része a kliensen dől el (fókuszkezelés,
 * aria-kötés, a számlázási panel nyitása), ezért a `PublicPagesTest`
 * mintáját követve a forrást is ellenőrizzük — a szerver felől pedig azt,
 * hogy a lapok tényleg megkapják az általuk használt propokat.
 */

use App\Models\User;
use Laravel\Fortify\Features;

function authSource(string $path): string
{
    return file_get_contents(resource_path("js/{$path}"));
}

test('a bejelentkező oldal megkapja a feltételes elemeihez tartozó propokat', function () {
    // A „Regisztrálj ingyen” és az „Elfelejtett jelszó?” link csak akkor jelenik
    // meg, ha a hozzájuk tartozó Fortify-feature él.
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

    // A `status` prop hajtja a login-oldal visszajelző sávját; enélkül a
    // felhasználó némán a bejelentkezésen találná magát belépés helyett.
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

    // Kitöltött kód mellett a fókusz a névre kerül, üresnél a kódmezőre —
    // mindkét ág ezekre a propokra épül.
    $this->get(route('register', ['invite' => 'ABC123']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('auth/register')
            ->where('inviteOnly', true)
            ->where('invite', 'ABC123')
        );
});

test('a mezők hibaüzenete a képernyőolvasóhoz is eljut', function () {
    // A hiba korábban csak vizuálisan jelent meg: sem `aria-invalid`, sem
    // `aria-describedby` nem kötötte a mezőhöz.
    expect(authSource('components/auth/auth-field.tsx'))
        ->toContain('aria-invalid')
        ->toContain('aria-describedby');

    expect(authSource('components/input-error.tsx'))->toContain('role="alert"');
});

test('az auth-űrlapok nem írják felül a natív tab-sorrendet', function () {
    // Pozitív tabIndex korábban kézzel sorszámozta a mezőket, és a mutat/elrejt
    // gombot ki is hagyta a sorból.
    foreach (['pages/auth/login.tsx', 'pages/auth/register.tsx'] as $page) {
        expect(authSource($page))->not->toMatch('/tabIndex=\{\d+\}/');
    }

    expect(authSource('components/password-input.tsx'))->not->toContain('tabIndex={-1}');
});

test('a regisztráció elmondja, hogy e-mail-megerősítés következik', function () {
    // A `RegisterResponse` nem lépteti be a felhasználót; ha ezt az űrlap nem
    // mondja ki, a login-oldalra visszadobás hibának látszik.
    expect(authSource('pages/auth/register.tsx'))->toContain('megerősítő e-mailt');
});

test('a regisztráció kifejezett pipával fogadtatja el a jogi dokumentumokat', function () {
    expect(authSource('pages/auth/register.tsx'))
        ->toContain('id="terms"')
        ->toContain('name="terms"')
        ->toContain('terms.url()')
        ->toContain('privacy.url()');
});

test('elfogadás nélkül nem jön létre fiók', function () {
    $this->skipUnlessFortifyFeature(Features::registration());
    config(['registration.invite_only' => false]);

    // A pipa a kliensen nem `required` (a Radix-checkbox rejtett inputján a natív
    // validáció láthatatlan hibaüzenetet adna), ezért a kényszer szerveroldali —
    // ez a teszt őrzi, hogy közvetlen POST-tal se lehessen megkerülni.
    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'noterms@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasErrors('terms');

    expect(User::where('email', 'noterms@example.com')->exists())->toBeFalse();
});

test('a számlázási panel magától kinyílik, ha hibát ad vissza a szerver', function () {
    // Csukott panel mögött a felhasználó nem látná, melyik mezőt kifogásolja a
    // szerver — a hibás mező ilyenkor a DOM-ban sincs benne.
    expect(authSource('pages/auth/register.tsx'))
        ->toContain("field.startsWith('billing_')")
        ->toContain('billingRequested || hasBillingError');
});

test('az auth-keret nem hirdet kivezetett funkciókat', function () {
    // A kvíz és a mondatkiegészítés nem része az induló feature-körnek
    // (routes/words.php), így a regisztrációs oldal ígéretei közt sem lehet.
    expect(authSource('layouts/auth/auth-split-layout.tsx'))
        ->not->toContain('kvíz')
        ->not->toContain('Kvíz')
        ->not->toContain('mondatkiegészítés');
});
