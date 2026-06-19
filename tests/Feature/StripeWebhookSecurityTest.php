<?php

use App\Providers\AppServiceProvider;

function bootGuard(): void
{
    (new AppServiceProvider(app()))->assertStripeWebhookSecured();
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
