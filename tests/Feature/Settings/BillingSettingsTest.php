<?php

use App\Models\User;

test('billing settings page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('billing.edit'))
        ->assertOk();
});

test('billing details can be updated', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Teszt Kft.',
            'billing_tax_number' => '12345678-1-01',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_company_registration_number' => '01-09-999999',
            'billing_type' => 'company',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('billing.edit'));

    $user->refresh();

    expect($user->billing_name)->toBe('Teszt Kft.')
        ->and($user->billing_tax_number)->toBe('12345678-1-01')
        ->and($user->billing_country)->toBe('HU')
        ->and($user->billing_zip)->toBe('1234')
        ->and($user->billing_city)->toBe('Budapest')
        ->and($user->billing_address)->toBe('Kossuth Lajos utca 1.')
        ->and($user->billing_phone)->toBe('+36301234567')
        ->and($user->billing_company_registration_number)->toBe('01-09-999999')
        ->and($user->billing_type)->toBe('company');
});

test('billing update requires the fields the checkout gatekeeper checks', function () {
    $user = User::factory()->create();

    // Csak country + type — a hasBillingDetails() által vizsgált mezők hiányoznak.
    // A korábbi viselkedés ezt hibátlanul elmentette, így a checkout kapuőr
    // visszadobta a usert ide (kijuthatatlan hurok). Most validációs hibát kell adnia.
    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_country' => 'HU',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors([
            'billing_name',
            'billing_zip',
            'billing_city',
            'billing_address',
            'billing_phone',
        ]);

    expect($user->refresh()->hasBillingDetails())->toBeFalse();
});

test('company billing requires a tax number', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Példa Kft.',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_company_registration_number' => '01-09-999999',
            'billing_type' => 'company',
            // billing_tax_number szándékosan hiányzik
        ])
        ->assertSessionHasErrors('billing_tax_number');
});

test('company billing requires a company registration number', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Példa Kft.',
            'billing_tax_number' => '12345678-1-01',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'company',
            // billing_company_registration_number szándékosan hiányzik
        ])
        ->assertSessionHasErrors('billing_company_registration_number');
});

test('individual billing does not require a tax number or company registration number', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasNoErrors();
});

test('switching from company to individual clears the stored tax number and registration number', function () {
    $user = User::factory()->create([
        'billing_type' => 'company',
        'billing_tax_number' => '12345678-1-01',
        'billing_company_registration_number' => '01-09-999999',
    ]);

    // Egyénire váltva a company-only mezők a UI-ban unmountolnak, így be sem
    // érkeznek — a régi adatoknak mégsem szabad a fiókon ragadniuk.
    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasNoErrors();

    expect($user->refresh()->billing_tax_number)->toBeNull()
        ->and($user->billing_company_registration_number)->toBeNull()
        ->and($user->billing_type)->toBe('individual');
});

test('a malformed tax number is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Példa Kft.',
            'billing_tax_number' => '12345678', // hiányzik a -c-kk rész
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_company_registration_number' => '01-09-999999',
            'billing_type' => 'company',
        ])
        ->assertSessionHasErrors('billing_tax_number');
});

test('a malformed company registration number is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Példa Kft.',
            'billing_tax_number' => '12345678-1-01',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_company_registration_number' => '999999', // hibás formátum
            'billing_type' => 'company',
        ])
        ->assertSessionHasErrors('billing_company_registration_number');
});

test('an individual may not submit a tax number', function () {
    $user = User::factory()->create();

    // Direkt POST (a UI unmountolja a mezőt, de a DB-konzisztenciát a szabály védi).
    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_tax_number' => '12345678-1-01',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_tax_number');
});

test('an individual may not submit a company registration number', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_company_registration_number' => '01-09-999999',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_company_registration_number');
});

test('a non-numeric zip is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'HU',
            'billing_zip' => '12A4',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_zip');
});

test('a missing phone number is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_phone');
});

test('a malformed phone number is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => 'nem-telefonszám!!',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_phone');
});

test('control characters in billing name are rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => "Kiss János\nHamis sor",
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_name');
});

test('an unsupported country code is rejected', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'ZZ',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Fő utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasErrors('billing_country');
});

test('the country code is normalized to uppercase', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'hu',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Fő utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->billing_country)->toBe('HU');
});

test('saved billing details satisfy the checkout gatekeeper (no redirect loop)', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('billing.update'), [
            'billing_name' => 'Kiss János',
            'billing_country' => 'HU',
            'billing_zip' => '1234',
            'billing_city' => 'Budapest',
            'billing_address' => 'Kossuth Lajos utca 1.',
            'billing_phone' => '+36301234567',
            'billing_type' => 'individual',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('billing.edit'));

    expect($user->refresh()->hasBillingDetails())->toBeTrue();
});

test('billing page requires authentication', function () {
    $this->get(route('billing.edit'))
        ->assertRedirect(route('login'));
});
