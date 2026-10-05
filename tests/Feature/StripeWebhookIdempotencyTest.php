<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Laravel\Cashier\Events\WebhookReceived;
use Tests\TestCase;

/**
 * @param  array<string, mixed>  $payload
 */
function postSignedStripeWebhook(TestCase $test, array $payload): TestResponse
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $timestamp = time();
    $signature = hash_hmac('sha256', "{$timestamp}.{$body}", config('cashier.webhook.secret'));

    return $test->call(
        'POST',
        'stripe/webhook',
        [],
        [],
        [],
        [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
        ],
        $body,
    );
}

function postStripeEvent(TestCase $test, string $eventId): TestResponse
{
    return postSignedStripeWebhook($test, [
        'id' => $eventId,
        'type' => 'ping',
        'data' => ['object' => []],
    ]);
}

test('ugyanaz az evt_ esemény csak egyszer dolgozódik fel', function () {
    Event::fake([WebhookReceived::class]);

    postStripeEvent($this, 'evt_dupe_1')->assertOk();
    postStripeEvent($this, 'evt_dupe_1')->assertOk();

    Event::assertDispatchedTimes(WebhookReceived::class, 1);

    expect(DB::table('stripe_webhook_events')->where('event_id', 'evt_dupe_1')->count())->toBe(1);
});

test('különböző evt_ események mind feldolgozódnak', function () {
    Event::fake([WebhookReceived::class]);

    postStripeEvent($this, 'evt_a')->assertOk();
    postStripeEvent($this, 'evt_b')->assertOk();

    Event::assertDispatchedTimes(WebhookReceived::class, 2);
    expect(DB::table('stripe_webhook_events')->count())->toBe(2);
});

test('id nélküli payload nem akad el a dedupláláson (Cashier-alapértelmezett)', function () {
    Event::fake([WebhookReceived::class]);

    postSignedStripeWebhook($this, ['type' => 'ping', 'data' => ['object' => []]])->assertOk();

    Event::assertDispatchedTimes(WebhookReceived::class, 1);
    expect(DB::table('stripe_webhook_events')->count())->toBe(0);
});

test('a kezelő kivétele törli a foglalást, hogy a Stripe-újraküldés újrapróbálhasson', function () {
    Event::listen(WebhookReceived::class, function () {
        throw new RuntimeException('kezelő-hiba');
    });

    $this->withoutExceptionHandling();

    expect(fn () => postStripeEvent($this, 'evt_boom'))->toThrow(RuntimeException::class);

    expect(DB::table('stripe_webhook_events')->where('event_id', 'evt_boom')->count())->toBe(0);
});
