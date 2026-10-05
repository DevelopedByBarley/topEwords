<?php

use App\Providers\AppServiceProvider;
use Illuminate\Support\Facades\Route;

function bootGuard(): void
{
    (new AppServiceProvider(app()))->assertStripeWebhookSecured();
}

function bootStripeSecretGuard(string $env, bool $enabled, string $secret): void
{
    app()['env'] = $env;
    config([
        'services.stripe.enabled' => $enabled,
        'cashier.secret' => $secret,
    ]);

    (new AppServiceProvider(app()))->assertStripeSecretMatchesEnvironment();
}

test('boot fails when stripe is enabled without a webhook secret', function () {
    config(['services.stripe.enabled' => true, 'cashier.webhook.secret' => '']);

    bootGuard();
})->throws(RuntimeException::class);

test('boot succeeds when stripe is enabled with a webhook secret', function () {
    config(['services.stripe.enabled' => true, 'cashier.webhook.secret' => 'whsec_test']);

    bootGuard();
})->throwsNoExceptions();

test('boot succeeds when stripe is disabled without a webhook secret', function () {
    config(['services.stripe.enabled' => false, 'cashier.webhook.secret' => '']);

    bootGuard();
})->throwsNoExceptions();

test('REC-1: boot fails in production with a test-mode stripe secret', function () {
    bootStripeSecretGuard(env: 'production', enabled: true, secret: 'sk_test_abc123');
})->throws(RuntimeException::class);

test('REC-1: boot succeeds in production with a live-mode stripe secret', function () {
    bootStripeSecretGuard(env: 'production', enabled: true, secret: 'sk_live_abc123');
})->throwsNoExceptions();

test('REC-1: a test-mode secret is allowed outside production', function () {
    bootStripeSecretGuard(env: 'local', enabled: true, secret: 'sk_test_abc123');
})->throwsNoExceptions();

test('REC-1: the guard is inert when stripe is disabled', function () {
    bootStripeSecretGuard(env: 'production', enabled: false, secret: 'sk_test_abc123');
})->throwsNoExceptions();

test('SESS-L4: the stripe/webhook POST is intentionally CSRF-exempt', function () {
    $response = $this->post('stripe/webhook', ['type' => 'ping']);

    expect($response->getStatusCode())->not->toBe(419);
});

test('SESS-L4: only the webhook is a state-changing route under stripe/', function () {
    $mutating = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'stripe/'))
        ->filter(fn ($route) => count(array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE'])) > 0)
        ->map(fn ($route) => $route->uri())
        ->values()
        ->all();

    expect($mutating)->toBe(['stripe/webhook']);
});
