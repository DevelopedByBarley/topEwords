<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Providers\AppServiceProvider;
use Illuminate\Database\Console\Migrations\FreshCommand;
use Illuminate\Database\Console\WipeCommand;
use Illuminate\Validation\Rules\Password;

/**
 * T-4 / F1-L2: a staging ugyanazt a hardeninget kapja, mint a production.
 * T-33 / F9B-L2: Billingo boot-guard. T-16 / F4-L2: log-megőrzési boot-guard.
 * Plusz: a queue retry_after nagyobb a számlázó job timeoutjánál (dupla számla ellen).
 *
 * A StripeWebhookSecurityTest `bootStripeSecretGuard` mintáját követjük: az
 * app()['env'] átállításával környezetenként hívjuk a guard-metódusokat.
 */
function hardeningProvider(string $env): AppServiceProvider
{
    // app()->environment() a konténer 'env' értékét olvassa, nem a config-ot.
    app()['env'] = $env;

    return new AppServiceProvider(app());
}

function runConfigureDefaults(AppServiceProvider $provider): void
{
    (new ReflectionMethod($provider, 'configureDefaults'))->invoke($provider);
}

function isProhibited(string $command): bool
{
    return (bool) (new ReflectionProperty($command, 'prohibitedFromRunning'))->getValue();
}

afterEach(function () {
    // A statikus tiltás túlélné a tesztet — visszaállítjuk a tesztkörnyezet állapotára.
    app()['env'] = 'testing';
    runConfigureDefaults(new AppServiceProvider(app()));
});

/*
|--------------------------------------------------------------------------
| T-4: staging = production hardening
|--------------------------------------------------------------------------
*/

test('T-4: a strong password policy applies in hardened environments', function (string $env) {
    runConfigureDefaults(hardeningProvider($env));

    $rules = Password::default()->appliedRules();

    expect($rules['min'])->toBe(12)
        ->and($rules['mixedCase'])->toBeTrue()
        ->and($rules['symbols'])->toBeTrue()
        ->and($rules['uncompromised'])->toBeTrue();
})->with(['production', 'staging']);

test('T-4: the password policy stays relaxed locally', function () {
    runConfigureDefaults(hardeningProvider('local'));

    expect(Password::default()->appliedRules()['min'])->toBe(8)
        ->and(Password::default()->appliedRules()['uncompromised'])->toBeFalse();
});

test('T-4: destructive database commands are prohibited in hardened environments', function (string $env) {
    runConfigureDefaults(hardeningProvider($env));

    expect(isProhibited(FreshCommand::class))->toBeTrue()
        ->and(isProhibited(WipeCommand::class))->toBeTrue();
})->with(['production', 'staging']);

test('T-4: destructive database commands are allowed locally', function () {
    runConfigureDefaults(hardeningProvider('local'));

    expect(isProhibited(FreshCommand::class))->toBeFalse();
});

test('T-4: the session cookie secure flag defaults to on in staging', function () {
    $originalEnv = $_ENV['APP_ENV'] ?? 'testing';
    $originalServer = $_SERVER['APP_ENV'] ?? 'testing';

    $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'staging';

    try {
        $config = require base_path('config/session.php');

        expect($config['secure'])->toBeTrue();
    } finally {
        $_ENV['APP_ENV'] = $originalEnv;
        $_SERVER['APP_ENV'] = $originalServer;
    }
});

test('T-4: CSP and HSTS are sent in staging', function () {
    $this->app->detectEnvironment(fn () => 'staging');

    $response = $this->get(route('home'));

    expect($response->headers->get('Content-Security-Policy'))->toContain("frame-ancestors 'none'")
        ->and($response->headers->get('Strict-Transport-Security'))->toContain('max-age=31536000');
});

test('T-4: APP_DEBUG=true refuses to boot in staging', function () {
    config(['app.debug' => true]);

    expect(fn () => hardeningProvider('staging')->assertDebugDisabledInProduction())
        ->toThrow(RuntimeException::class, 'APP_DEBUG is true');
});

test('T-4: a test-mode stripe secret stays allowed in staging', function () {
    // Tudatos döntés: a staging tipikusan teszt-módú Stripe-kulccsal fut, ezért a
    // live-kulcs assert csak productionben él.
    config(['services.stripe.enabled' => true, 'cashier.secret' => 'sk_test_abc123']);

    hardeningProvider('staging')->assertStripeSecretMatchesEnvironment();
})->throwsNoExceptions();

/*
|--------------------------------------------------------------------------
| T-33: Billingo boot-guard
|--------------------------------------------------------------------------
*/

test('T-33: an enabled but misconfigured Billingo refuses to boot', function (string $env, ?string $apiKey, int $blockId) {
    config([
        'services.billingo.enabled' => true,
        'services.billingo.api_key' => $apiKey,
        'services.billingo.block_id' => $blockId,
    ]);

    expect(fn () => hardeningProvider($env)->assertBillingoConfigured())
        ->toThrow(RuntimeException::class, 'BILLINGO_BLOCK_ID');
})->with([
    'production, üres kulcs' => ['production', '', 99],
    'production, null kulcs' => ['production', null, 99],
    'production, 0-s tömb' => ['production', 'key', 0],
    'staging, negatív tömb' => ['staging', 'key', -1],
]);

test('T-33: a fully configured Billingo boots in production', function () {
    config([
        'services.billingo.enabled' => true,
        'services.billingo.api_key' => 'key',
        'services.billingo.block_id' => 99,
    ]);

    hardeningProvider('production')->assertBillingoConfigured();
})->throwsNoExceptions();

test('T-33: the Billingo guard is inert when invoicing is disabled', function () {
    config(['services.billingo.enabled' => false, 'services.billingo.api_key' => '', 'services.billingo.block_id' => 0]);

    hardeningProvider('production')->assertBillingoConfigured();
})->throwsNoExceptions();

test('T-33: block_id=0 with a test profile is allowed locally', function () {
    config(['services.billingo.enabled' => true, 'services.billingo.api_key' => 'key', 'services.billingo.block_id' => 0]);

    hardeningProvider('local')->assertBillingoConfigured();
})->throwsNoExceptions();

/*
|--------------------------------------------------------------------------
| T-16: log-megőrzés
|--------------------------------------------------------------------------
*/

test('T-16: an unbounded log channel refuses to boot in hardened environments', function (string $env, string $default, array $stack, int $days) {
    config([
        'logging.default' => $default,
        'logging.channels.stack.channels' => $stack,
        'logging.channels.daily.days' => $days,
    ]);

    expect(fn () => hardeningProvider($env)->assertLogRetentionBounded())
        ->toThrow(RuntimeException::class, 'LOG_STACK=daily');
})->with([
    'production, single a stackben' => ['production', 'stack', ['single'], 365],
    'staging, daily mellett single' => ['staging', 'stack', ['daily', 'single'], 365],
    'production, közvetlen single csatorna' => ['production', 'single', [], 365],
    'production, 0 nap = korlátlan' => ['production', 'stack', ['daily'], 0],
    'staging, 365 napnál több' => ['staging', 'stack', ['daily'], 400],
]);

test('T-16: a bounded daily stack boots in production', function () {
    config([
        'logging.default' => 'stack',
        'logging.channels.stack.channels' => ['daily'],
        'logging.channels.daily.days' => 365,
    ]);

    hardeningProvider('production')->assertLogRetentionBounded();
})->throwsNoExceptions();

test('T-16: the single channel stays allowed locally', function () {
    config(['logging.default' => 'stack', 'logging.channels.stack.channels' => ['single']]);

    hardeningProvider('local')->assertLogRetentionBounded();
})->throwsNoExceptions();

test('T-16: the log stack defaults to the rotated daily channel', function () {
    $original = $_ENV['LOG_STACK'] ?? null;
    $originalServer = $_SERVER['LOG_STACK'] ?? null;
    $originalPut = getenv('LOG_STACK');

    unset($_ENV['LOG_STACK'], $_SERVER['LOG_STACK']);
    putenv('LOG_STACK');

    try {
        $config = require base_path('config/logging.php');

        expect($config['channels']['stack']['channels'])->toBe(['daily']);
    } finally {
        if ($original !== null) {
            $_ENV['LOG_STACK'] = $original;
        }
        if ($originalServer !== null) {
            $_SERVER['LOG_STACK'] = $originalServer;
        }
        if ($originalPut !== false) {
            putenv("LOG_STACK={$originalPut}");
        }
    }
});

/*
|--------------------------------------------------------------------------
| Queue retry_after > számlázó job timeout
|--------------------------------------------------------------------------
*/

test('a queue retry_after not exceeding the invoice job timeout refuses to boot', function (string $env, string $connection, int $retryAfter) {
    config([
        'queue.default' => $connection,
        "queue.connections.{$connection}.retry_after" => $retryAfter,
    ]);

    expect(fn () => hardeningProvider($env)->assertQueueRetryAfterExceedsInvoiceTimeout())
        ->toThrow(RuntimeException::class, 'retry_after');
})->with([
    'production, database, egyenlő' => ['production', 'database', GenerateBillingoInvoice::TIMEOUT_SECONDS],
    'production, redis, kisebb' => ['production', 'redis', 90],
    'staging, database, kisebb' => ['staging', 'database', 60],
]);

test('a queue retry_after above the invoice job timeout boots in production', function (string $connection) {
    config([
        'queue.default' => $connection,
        "queue.connections.{$connection}.retry_after" => GenerateBillingoInvoice::TIMEOUT_SECONDS + 1,
    ]);

    hardeningProvider('production')->assertQueueRetryAfterExceedsInvoiceTimeout();
})->with(['database', 'redis'])->throwsNoExceptions();

test('the retry_after guard skips the sync connection and non-hardened environments', function () {
    config(['queue.default' => 'sync']);
    hardeningProvider('production')->assertQueueRetryAfterExceedsInvoiceTimeout();

    config(['queue.default' => 'database', 'queue.connections.database.retry_after' => 30]);
    hardeningProvider('local')->assertQueueRetryAfterExceedsInvoiceTimeout();
})->throwsNoExceptions();
