<?php

use App\Providers\AppServiceProvider;

/**
 * ENV-1 / HDR-1 / ENV-2 (Fázis 8): a boot-guardok a némán kikapcsoló
 * prod-hardening ellen védenek. A guard-metódusokat közvetlenül hívjuk,
 * hogy ne kelljen a teljes bootot újraindítani; a produkció-detektálást
 * az app()->detectEnvironment() felülírásával kényszerítjük.
 */
function envBootGuard(): AppServiceProvider
{
    return new AppServiceProvider(app());
}

function withAppEnvironment(string $env, Closure $callback): void
{
    $original = app()->environment();

    app()->detectEnvironment(fn () => $env);

    try {
        $callback();
    } finally {
        app()->detectEnvironment(fn () => $original);
    }
}

test('ENV-1: an unknown APP_ENV refuses to boot', function () {
    withAppEnvironment('prod', function () {
        expect(fn () => envBootGuard()->assertKnownEnvironment())
            ->toThrow(RuntimeException::class, 'not a recognized environment');
    });
});

test('ENV-1: a whitespace-padded production value is rejected', function () {
    withAppEnvironment('production ', function () {
        expect(fn () => envBootGuard()->assertKnownEnvironment())
            ->toThrow(RuntimeException::class);
    });
});

test('ENV-1: the four recognized environments boot cleanly', function () {
    foreach (['local', 'testing', 'staging', 'production'] as $env) {
        withAppEnvironment($env, function () {
            envBootGuard()->assertKnownEnvironment();
        });
    }

    // Ha egyik sem dobott, a guard átengedte a helyes értékeket.
    expect(true)->toBeTrue();
});

test('ENV-2: APP_DEBUG=true refuses to boot in production', function () {
    withAppEnvironment('production', function () {
        config(['app.debug' => true]);

        expect(fn () => envBootGuard()->assertDebugDisabledInProduction())
            ->toThrow(RuntimeException::class, 'APP_DEBUG is true');
    });
});

test('ENV-2: APP_DEBUG=false boots cleanly in production', function () {
    withAppEnvironment('production', function () {
        config(['app.debug' => false]);

        envBootGuard()->assertDebugDisabledInProduction();

        expect(true)->toBeTrue();
    });
});

test('ENV-2: APP_DEBUG=true is allowed outside production', function () {
    withAppEnvironment('local', function () {
        config(['app.debug' => true]);

        envBootGuard()->assertDebugDisabledInProduction();

        expect(true)->toBeTrue();
    });
});
