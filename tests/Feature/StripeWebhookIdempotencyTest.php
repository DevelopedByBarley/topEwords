<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Laravel\Cashier\Events\WebhookReceived;
use Tests\TestCase;

/**
 * F2-W-1: központi event-id idempotencia. A Stripe legalább-egyszer kézbesít, így
 * UGYANAZ az `evt_…` esemény kétszer is befuthat. A StripeWebhookController::handleWebhook
 * override az első feldolgozáskor „lefoglalja" az event_id-t a stripe_webhook_events
 * táblában; a duplikátumot érdemi munka (parent-kezelő) nélkül nyugtázza.
 *
 * Megfigyelhető pont: a Cashier parentje a tényleges feldolgozáskor tüzeli a
 * WebhookReceived eseményt (feltétel nélkül, minden típusra). Duplikátumnál az override
 * a parentet meg sem hívja, így az esemény sem tüzel másodszor. (A WebhookHandled csak a
 * `handle{Típus}` kezelővel bíró típusokra tüzel — a `ping`-re nem —, ezért itt a
 * WebhookReceived a megbízható jel.)
 *
 * A webhook élesben aláírás-ellenőrzés (VerifyWebhookSignature) mögött van, ezért a
 * kéréseket a teszt-secret-tel érvényesen aláírjuk — különben 403-at kapnánk, mielőtt
 * a handleWebhook lefutna.
 *
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

    // A Cashier feldolgozása pontosan egyszer futott le; a második POST duplikátum volt.
    Event::assertDispatchedTimes(WebhookReceived::class, 1);

    // A lefoglalt event_id egyetlen sorként áll a táblában.
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

    // Nincs event-id → nem foglalunk, a Cashier alap-viselkedése marad; a ping simán 200.
    postSignedStripeWebhook($this, ['type' => 'ping', 'data' => ['object' => []]])->assertOk();

    Event::assertDispatchedTimes(WebhookReceived::class, 1);
    expect(DB::table('stripe_webhook_events')->count())->toBe(0);
});

test('a kezelő kivétele törli a foglalást, hogy a Stripe-újraküldés újrapróbálhasson', function () {
    // Egy kezelő kivétele NEM hagyhat maga után „feldolgozott" foglalást — különben a
    // soha le nem futott esemény tartósan elveszne. A WebhookReceived listenerén dobunk,
    // hogy a parent::handleWebhook a mi try/catch-ünkön belül szálljon el.
    Event::listen(WebhookReceived::class, function () {
        throw new RuntimeException('kezelő-hiba');
    });

    // withoutExceptionHandling nélkül a Laravel a kivételt 500-ra fordítaná; így viszont
    // átjut a handleWebhook try/catch-én (lefuttatva a foglalás-törlést), majd a tesztbe.
    $this->withoutExceptionHandling();

    expect(fn () => postStripeEvent($this, 'evt_boom'))->toThrow(RuntimeException::class);

    // A foglalás törlődött → egy újraküldés újra megpróbálhatja.
    expect(DB::table('stripe_webhook_events')->where('event_id', 'evt_boom')->count())->toBe(0);
});
