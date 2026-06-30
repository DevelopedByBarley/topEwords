<?php

use App\Models\User;

test('ismeretlen e-mailnél hibával lép ki', function () {
    $this->artisan('billing:end-trial', ['email' => 'nincs@ilyen.hu'])
        ->expectsOutputToContain('Nincs felhasználó')
        ->assertExitCode(1);
});

test('aktív előfizetés nélkül hibával lép ki', function () {
    $user = User::factory()->create();

    $this->artisan('billing:end-trial', ['email' => $user->email])
        ->expectsOutputToContain('nincs aktív előfizetése')
        ->assertExitCode(1);
});

test('próbaidőn kívüli előfizetésnél nincs mit lejáratni', function () {
    $user = User::factory()->create(['stripe_id' => 'cus_test']);

    // Aktív, de már nem próbaidős előfizetés (trial_ends_at = null).
    $user->subscriptions()->create([
        'type' => 'default',
        'stripe_id' => 'sub_active',
        'stripe_status' => 'active',
        'stripe_price' => 'price_test',
        'quantity' => 1,
        'trial_ends_at' => null,
    ]);

    $this->artisan('billing:end-trial', ['email' => $user->email])
        ->expectsOutputToContain('nincs próbaidőben')
        ->assertExitCode(1);
});
