<?php

use App\Models\AiWordCache;
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

/**
 * P7-L3: a manuális destruktív parancsok éles környezetben megerősítést kérnek.
 * A `confirmToProceed` az `environment() === 'production'` ágon aktiválódik, ezért
 * a teszt átmenetileg production-re állítja a környezetet.
 */
test('éles környezetben a cache-törlés megerősítés nélkül nem fut le', function () {
    AiWordCache::create([
        'cache_key' => 'lookup:dog:en:v1',
        'task' => 'lookup',
        'word' => 'dog',
        'prompt_version' => 1,
        'model' => 'gemini-2.5-flash-lite',
        'response' => ['meaning_hu' => 'kutya'],
    ]);

    app()->detectEnvironment(fn () => 'production');

    $this->artisan('ai:cache:clear')
        ->expectsConfirmation('Are you sure you want to run this command?', 'no')
        ->assertExitCode(1);

    // A megszakított parancs egyetlen sort sem törölt.
    expect(AiWordCache::count())->toBe(1);
});

test('éles környezetben a --force megerősítés nélkül lefuttatja a cache-törlést', function () {
    AiWordCache::create([
        'cache_key' => 'lookup:dog:en:v1',
        'task' => 'lookup',
        'word' => 'dog',
        'prompt_version' => 1,
        'model' => 'gemini-2.5-flash-lite',
        'response' => ['meaning_hu' => 'kutya'],
    ]);

    app()->detectEnvironment(fn () => 'production');

    $this->artisan('ai:cache:clear', ['--force' => true])->assertExitCode(0);

    expect(AiWordCache::count())->toBe(0);
});

test('teszt/local környezetben a parancs megerősítés nélkül fut', function () {
    AiWordCache::create([
        'cache_key' => 'lookup:dog:en:v1',
        'task' => 'lookup',
        'word' => 'dog',
        'prompt_version' => 1,
        'model' => 'gemini-2.5-flash-lite',
        'response' => ['meaning_hu' => 'kutya'],
    ]);

    $this->artisan('ai:cache:clear')->assertExitCode(0);

    expect(AiWordCache::count())->toBe(0);
});
