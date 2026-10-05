<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Models\BillingoInvoice;
use App\Models\User;
use App\Services\Billingo\BillingoClient;
use App\Services\Billingo\BillingProfile;
use App\Services\Billingo\InvoiceGenerator;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Database\ModelIdentifier;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

function billableUser(array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'stripe_id' => 'cus_'.uniqid(),
        'billing_name' => 'Teszt Elek',
        'billing_type' => 'individual',
        'billing_country' => 'HU',
        'billing_zip' => '1011',
        'billing_city' => 'Budapest',
        'billing_address' => 'Fő utca 1.',
    ], $overrides));
}

function stripeInvoice(array $overrides = []): array
{
    return array_merge([
        'id' => 'in_'.uniqid(),
        'customer' => 'cus_unknown',
        'currency' => 'huf',
        'amount_paid' => 299000,
        'total' => 299000,
        'created' => 1_700_000_000,
        'lines' => ['data' => [['description' => 'topEwords Pro – havi']]],
    ], $overrides);
}

function fakeBillingo(): void
{
    Http::fake([
        'api.billingo.hu/v3/currencies*' => Http::response(['conversation_rate' => 390.5], 200),
        'api.billingo.hu/v3/partners/*' => Http::response([], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
        'api.billingo.hu/v3/documents/*/send' => Http::response([], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'TESZT-2026-1'], 200),
        'api.billingo.hu/v3/document-blocks*' => Http::response(['data' => [
            ['id' => 41, 'type' => 'proforma'],
            ['id' => 42, 'type' => 'invoice'],
        ]], 200),
    ]);
}

beforeEach(function () {
    config([
        'services.billingo.enabled' => true,
        'services.billingo.api_key' => 'test-key',
        'services.billingo.block_id' => 99,
        'services.billingo.vat' => 'AAM',
        'services.billingo.item_name' => 'topEwords előfizetés',
        'cashier.webhook.secret' => '',
    ]);
});

test('kiállítja a Billingo számlát és eltárolja a felhasználóhoz', function () {
    fakeBillingo();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_abc']);

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, $invoice);

    expect($record)->toBeInstanceOf(BillingoInvoice::class)
        ->and($record->stripe_invoice_id)->toBe('in_abc')
        ->and($record->billingo_document_id)->toBe(5001)
        ->and($record->invoice_number)->toBe('TESZT-2026-1')
        ->and($record->isIssued())->toBeTrue();

    expect($user->refresh()->billingo_partner_id)->toBe(777);
});

test('a kiállított számlát e-mailben elküldi a partnernek és rögzíti a kézbesítést', function () {
    fakeBillingo();
    $user = billableUser();

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_send']));

    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents/5001/send'));

    expect($record->emailed_at)->not->toBeNull();
});

test('nem küldi el újra a már kézbesített számlát', function () {
    fakeBillingo();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_resend']);

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, $invoice);
    app(InvoiceGenerator::class)->generateForStripeInvoice($user, $invoice);

    Http::assertSentCount(3);
});

test('egy korábban kiállított, de el nem küldött számlát utólag elküld', function () {
    fakeBillingo();
    $user = billableUser();

    $record = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_unsent',
        'billingo_document_id' => 5001,
        'invoice_number' => 'TESZT-2026-1',
    ]);

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_unsent']));

    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents'));
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents/5001/send'));
    expect($record->refresh()->emailed_at)->not->toBeNull();
});

test('F2-BILL-1: a küldés utáni emailed_at-mentés hibája nem buktatja a jobot — nincs retry, nincs dupla e-mail', function () {
    fakeBillingo();
    Log::spy();
    $user = billableUser();

    BillingoInvoice::updating(function (BillingoInvoice $record) {
        if ($record->isDirty('emailed_at')) {
            throw new RuntimeException('szimulált tranziens DB-hiba');
        }
    });

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_mark_fail']));

    Http::assertSentCount(3);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents/5001/send'));
    expect($record->billingo_document_id)->toBe(5001);

    expect($record->emailed_at)->toBeNull()
        ->and($record->refresh()->emailed_at)->toBeNull();

    Log::shouldHaveReceived('error')->once()->withArgs(function (string $message, array $context) {
        return str_contains($message, 'emailed_at')
            && $context['stripe_invoice_id'] === 'in_mark_fail'
            && $context['billingo_document_id'] === 5001
            && $context['exception'] instanceof RuntimeException;
    });
});

test('F2-BILL-1 él-eset: a küldés hibája továbbra is buktatja a jobot, hogy a retry pótolja a kézbesítést', function () {
    Http::fake([
        'api.billingo.hu/v3/documents/*/send' => Http::response(['error' => 'Server error'], 500),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'TESZT-2026-1'], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
    ]);
    $user = billableUser();

    expect(fn () => app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_send_500'])))
        ->toThrow(RequestException::class);

    $record = BillingoInvoice::where('stripe_invoice_id', 'in_send_500')->first();
    expect($record->billingo_document_id)->toBe(5001)
        ->and($record->emailed_at)->toBeNull();
});

test('HUF számlán a kifizetett bruttó összeg és a konfigurált ÁFA jelenik meg, átváltás nélkül', function () {
    fakeBillingo();
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'amount_paid' => 299000,
        'currency' => 'huf',
    ]));

    Http::assertSent(function ($request) {
        if (! str_ends_with($request->url(), '/documents')) {
            return false;
        }

        $item = $request->data()['items'][0];

        return $request->data()['currency'] === 'HUF'
            && $request->data()['block_id'] === 99
            && ! array_key_exists('conversion_rate', $request->data())
            && $item['unit_price'] === 2990.0
            && $item['unit_price_type'] === 'gross'
            && $item['vat'] === 'AAM';
    });

    Http::assertNotSent(fn ($request) => str_contains($request->url(), '/currencies'));
});

test('devizás (nem HUF) számlán a teljesítés napi MNB-árfolyam kerül a conversion_rate-be', function () {
    fakeBillingo();
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'amount_paid' => 2990,
        'currency' => 'eur',
    ]));

    Http::assertSent(fn ($request) => str_contains($request->url(), '/currencies')
        && str_contains($request->url(), 'from=EUR')
        && str_contains($request->url(), 'to=HUF'));

    Http::assertSent(function ($request) {
        if (! str_ends_with($request->url(), '/documents')) {
            return false;
        }

        return $request->data()['currency'] === 'EUR'
            && $request->data()['conversion_rate'] === 390.5
            && $request->data()['items'][0]['unit_price'] === 29.9;
    });
});

test('a teljesítési dátum budapesti naptári nap szerint számolódik, nem UTC szerint', function () {
    fakeBillingo();
    $user = billableUser();

    $paidAt = Carbon::parse('2026-01-15 23:30:00', 'UTC')->timestamp;

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_midnight',
        'status_transitions' => ['paid_at' => $paidAt],
    ]));

    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents')
        && $request->data()['fulfillment_date'] === '2026-01-16'
        && $request->data()['due_date'] === '2026-01-16');
});

test('devizás számlán az MNB-árfolyam is a budapesti teljesítési napra kérődik le', function () {
    fakeBillingo();
    $user = billableUser();

    $paidAt = Carbon::parse('2026-01-15 23:30:00', 'UTC')->timestamp;

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_midnight_eur',
        'amount_paid' => 2990,
        'currency' => 'eur',
        'status_transitions' => ['paid_at' => $paidAt],
    ]));

    Http::assertSent(fn ($request) => str_contains($request->url(), '/currencies')
        && str_contains($request->url(), 'date=2026-01-16'));
});

test('nem támogatott (pl. zero-decimal) valutánál nem állít ki számlát, hanem kivételt dob', function () {
    fakeBillingo();
    $user = billableUser();

    expect(fn () => app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_jpy',
        'currency' => 'jpy',
    ])))->toThrow(RuntimeException::class, 'JPY');

    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents'));
});

test('érvénytelen árfolyam-válasznál nem állít ki számlát, hanem kivételt dob', function () {
    Http::fake([
        'api.billingo.hu/v3/currencies*' => Http::response(['detail' => 'no rate'], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
    ]);
    $user = billableUser();

    expect(fn () => app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_bad_rate',
        'amount_paid' => 2990,
        'currency' => 'eur',
    ])))->toThrow(RuntimeException::class, 'EUR→HUF');

    Http::assertNotSent(fn ($request) => str_ends_with($request->url(), '/documents'));
});

test('idempotens: a megismételt hívás nem állít ki második számlát', function () {
    fakeBillingo();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_dup']);

    $first = app(InvoiceGenerator::class)->generateForStripeInvoice($user, $invoice);
    $second = app(InvoiceGenerator::class)->generateForStripeInvoice($user, $invoice);

    expect($second->id)->toBe($first->id);
    expect(BillingoInvoice::where('stripe_invoice_id', 'in_dup')->count())->toBe(1);

    Http::assertSentCount(3);
});

test('a már mentett partnert újrahasználja, nem hoz létre újat', function () {
    fakeBillingo();
    $user = billableUser();
    $user->forceFill(['billingo_partner_id' => 555])->save();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice());

    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/partners'));
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents')
        && $request->data()['partner_id'] === 555);
});

test('a meglévő partnert a friss számlázási adatokkal frissíti számlázáskor', function () {
    fakeBillingo();
    $user = billableUser(['billing_name' => 'Új Név Kft.', 'billing_address' => 'Új utca 9.']);
    $user->forceFill(['billingo_partner_id' => 555])->save();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice());

    Http::assertSent(fn ($request) => $request->method() === 'PUT'
        && str_ends_with($request->url(), '/partners/555')
        && $request->data()['name'] === 'Új Név Kft.'
        && $request->data()['address']['address'] === 'Új utca 9.');
});

test('ha a mentett partnert a Billingo-fiókból törölték (404), újra létrehozza és számláz', function () {
    Http::fake([
        'api.billingo.hu/v3/partners/*' => Http::response(['error' => 'Partner not found'], 404),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 888], 200),
        'api.billingo.hu/v3/documents/*/send' => Http::response([], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'TESZT-2026-1'], 200),
    ]);
    $user = billableUser();
    $user->forceFill(['billingo_partner_id' => 555])->save();

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_gone_partner']));

    expect($record?->isIssued())->toBeTrue();
    expect($user->refresh()->billingo_partner_id)->toBe(888);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents')
        && $request->data()['partner_id'] === 888);
});

test('a partner-frissítés nem-404 hibáját továbbdobja, hogy a job újrapróbálja', function () {
    Http::fake([
        'api.billingo.hu/v3/partners/*' => Http::response(['error' => 'Server error'], 500),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 888], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001], 200),
    ]);
    $user = billableUser();
    $user->forceFill(['billingo_partner_id' => 555])->save();

    expect(fn () => app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_partner_500'])))
        ->toThrow(RequestException::class);

    expect($user->refresh()->billingo_partner_id)->toBe(555);
    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/partners'));
});

test('foglalt zárnál kivételt dob, hogy a job újrapróbáljon — nem csendes siker', function () {
    fakeBillingo();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_race']);

    $heldByOther = Cache::lock('billingo:issue:in_race', 120);
    expect($heldByOther->get())->toBeTrue();

    $generator = new InvoiceGenerator(app(BillingoClient::class), lockWaitSeconds: 0);

    expect(fn () => $generator->generateForStripeInvoice($user, $invoice))
        ->toThrow(LockTimeoutException::class);

    expect(BillingoInvoice::where('stripe_invoice_id', 'in_race')->exists())->toBeFalse();
    Http::assertNothingSent();

    $heldByOther->release();
});

test('cégnél az adószám rákerül a partnerre, magánszemélynél nem', function () {
    fakeBillingo();
    $company = billableUser(['billing_type' => 'company', 'billing_tax_number' => '12345678-2-42']);

    app(InvoiceGenerator::class)->generateForStripeInvoice($company, stripeInvoice());

    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/partners')
        && ($request->data()['taxcode'] ?? null) === '12345678-2-42');
});

test('konfig nélküli számlatömbnél az első invoice típusú tömböt kéri le', function () {
    fakeBillingo();
    config(['services.billingo.block_id' => 0]);
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice());

    Http::assertSent(fn ($request) => str_contains($request->url(), '/document-blocks'));
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents')
        && $request->data()['block_id'] === 42);
});

test('a sikeres fizetés webhookja a számlázó jobot sorba teszi, ha a Billingo be van kapcsolva', function () {
    Queue::fake();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_webhook', 'customer' => $user->stripe_id]);

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => $invoice],
    ])->assertOk();

    Queue::assertPushed(GenerateBillingoInvoice::class, function (GenerateBillingoInvoice $job) use ($user) {
        return $job->userId === $user->id
            && $job->billing instanceof BillingProfile
            && $job->billing->billingName === 'Teszt Elek'
            && $job->billing->email === $user->email
            && ($job->stripeInvoice['id'] ?? null) === 'in_webhook';
    });
});

test('W-L3: a jobra tett payload csak a szükséges mezőket tartja meg, az ügyfél-PII-t nem', function () {
    Queue::fake();
    $user = billableUser();
    $invoice = stripeInvoice([
        'id' => 'in_pii',
        'customer' => $user->stripe_id,
        'customer_email' => 'ugyfel@example.com',
        'customer_name' => 'Teszt Elek',
        'customer_address' => ['line1' => 'Fő utca 1', 'city' => 'Budapest'],
    ]);

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => $invoice],
    ])->assertOk();

    Queue::assertPushed(GenerateBillingoInvoice::class, function (GenerateBillingoInvoice $job) {
        $payload = $job->stripeInvoice;

        expect($payload['id'])->toBe('in_pii')
            ->and($payload['currency'])->toBe('huf')
            ->and($payload['amount_paid'])->toBe(299000)
            ->and($payload['lines']['data'][0]['description'])->toBe('topEwords Pro – havi');

        expect($payload)->not->toHaveKey('customer_email')
            ->and($payload)->not->toHaveKey('customer_name')
            ->and($payload)->not->toHaveKey('customer_address')
            ->and($payload)->not->toHaveKey('customer');

        return true;
    });
});

test('a sorba tett job végigfut és kiállítja a Billingo számlát', function () {
    fakeBillingo();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_webhook_job', 'customer' => $user->stripe_id]);

    (new GenerateBillingoInvoice($user, $invoice))->handle(app(InvoiceGenerator::class));

    $record = BillingoInvoice::where('stripe_invoice_id', 'in_webhook_job')->first();
    expect($record)->not->toBeNull()
        ->and($record->user_id)->toBe($user->id)
        ->and($record->billingo_document_id)->toBe(5001)
        ->and($record->isIssued())->toBeTrue();
});

test('0 összegű (trial-induló) számlára nem állít ki Billingo számlát', function () {
    fakeBillingo();
    $user = billableUser();

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_trial_start',
        'amount_paid' => 0,
        'total' => 0,
    ]));

    expect($record)->toBeNull();
    expect(BillingoInvoice::count())->toBe(0);

    Http::assertNothingSent();
});

test('a webhook a 0 összegű számlát kihagyja, a tényleges terhelést kiszámlázza', function () {
    fakeBillingo();
    $user = billableUser();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['id' => 'in_zero', 'amount_paid' => 0, 'total' => 0, 'customer' => $user->stripe_id])],
    ])->assertOk();

    expect(BillingoInvoice::where('stripe_invoice_id', 'in_zero')->exists())->toBeFalse();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['id' => 'in_charge', 'amount_paid' => 299000, 'total' => 299000, 'customer' => $user->stripe_id])],
    ])->assertOk();

    expect(BillingoInvoice::where('stripe_invoice_id', 'in_charge')->first()?->isIssued())->toBeTrue();
});

test('crash-utáni retry: ha a jelző beállt és a Billingóban már létezik a dokumentum, azt átveszi, nem állít ki másodikat', function () {
    Http::fake([
        'api.billingo.hu/v3/documents?query=*' => Http::response([
            'data' => [[
                'id' => 9001,
                'invoice_number' => 'MENTETT-2026-7',
                'comment' => 'stripe_invoice_id:in_crash',
            ]],
        ], 200),
        'api.billingo.hu/v3/documents/*/send' => Http::response([], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'UJ-2026-1'], 200),
        'api.billingo.hu/v3/partners/*' => Http::response([], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
        'api.billingo.hu/v3/currencies*' => Http::response(['conversation_rate' => 390.5], 200),
    ]);
    $user = billableUser();

    $record = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_crash',
        'issuing_started_at' => now()->subMinutes(2),
    ]);

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_crash']));

    expect($record->refresh()->billingo_document_id)->toBe(9001)
        ->and($record->invoice_number)->toBe('MENTETT-2026-7');
    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents'));
});

test('crash-utáni retry: ha a jelző beállt de a Billingóban nincs nyom, egyszer kiállítja', function () {
    Http::fake([
        'api.billingo.hu/v3/documents?query=*' => Http::response(['data' => []], 200),
        'api.billingo.hu/v3/documents/*/send' => Http::response([], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'UJ-2026-1'], 200),
        'api.billingo.hu/v3/partners/*' => Http::response([], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
        'api.billingo.hu/v3/currencies*' => Http::response(['conversation_rate' => 390.5], 200),
    ]);
    $user = billableUser();

    $record = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_clean_retry',
        'issuing_started_at' => now()->subMinutes(2),
    ]);

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_clean_retry']));

    expect($record->refresh()->billingo_document_id)->toBe(5001);
    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents')
        && $request->data()['comment'] === 'stripe_invoice_id:in_clean_retry');
});

test('tiszta első kiállításnál nem keres vissza a Billingóban, csak a jelzőt állítja be', function () {
    fakeBillingo();
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_first']));

    $record = BillingoInvoice::where('stripe_invoice_id', 'in_first')->first();
    expect($record->issuing_started_at)->not->toBeNull();

    Http::assertNotSent(fn ($request) => str_contains($request->url(), '/documents?query='));
});

test('kikapcsolt Billingo esetén a webhook nem állít ki számlát', function () {
    config(['services.billingo.enabled' => false]);
    $user = billableUser();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['customer' => $user->stripe_id])],
    ])->assertOk();

    expect(BillingoInvoice::count())->toBe(0);
});

test('ismeretlen customer pozitív terhelésénél critical riasztás megy, de a webhook 200-at ad', function () {
    Queue::fake();
    Log::spy();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice([
            'id' => 'in_orphan',
            'customer' => 'cus_nincs_ilyen',
            'amount_paid' => 299000,
        ])],
    ])->assertOk();

    Queue::assertNotPushed(GenerateBillingoInvoice::class);

    Log::shouldHaveReceived('critical')->once()->withArgs(function (string $message, array $context) {
        return str_contains($message, 'ismeretlen customer')
            && $context['stripe_customer'] === 'cus_nincs_ilyen'
            && $context['stripe_invoice_id'] === 'in_orphan';
    });
});

test('ismeretlen customer 0 összegű (trial-induló) számlájánál nincs riasztás', function () {
    Queue::fake();
    Log::spy();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice([
            'id' => 'in_orphan_zero',
            'customer' => 'cus_nincs_ilyen',
            'amount_paid' => 0,
            'total' => 0,
        ])],
    ])->assertOk();

    Log::shouldNotHaveReceived('critical');
});

test('kikapcsolt Billingónál ismeretlen customer sem riaszt', function () {
    config(['services.billingo.enabled' => false]);
    Log::spy();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['customer' => 'cus_nincs_ilyen', 'amount_paid' => 299000])],
    ])->assertOk();

    Log::shouldNotHaveReceived('critical');
});

test('W-L7: visszatérítés critical riasztást ad, de a webhook 200-at ad (kézi NAV-sztornó kell)', function () {
    Log::spy();

    $this->postJson('/stripe/webhook', [
        'type' => 'charge.refunded',
        'data' => ['object' => [
            'id' => 'ch_refund',
            'customer' => 'cus_valaki',
            'invoice' => 'in_eredeti',
            'amount_refunded' => 299000,
            'currency' => 'huf',
        ]],
    ])->assertOk();

    Log::shouldHaveReceived('critical')->once()->withArgs(function (string $message, array $context) {
        return str_contains($message, 'sztornó')
            && $context['stripe_charge_id'] === 'ch_refund'
            && $context['stripe_invoice_id'] === 'in_eredeti'
            && $context['amount_refunded_minor'] === 299000;
    });
});

test('W-L7: 0 összegű (tényleges visszatérítés nélküli) charge.refunded nem riaszt', function () {
    Log::spy();

    $this->postJson('/stripe/webhook', [
        'type' => 'charge.refunded',
        'data' => ['object' => ['id' => 'ch_zero', 'amount_refunded' => 0]],
    ])->assertOk();

    Log::shouldNotHaveReceived('critical');
});

test('W-L7: kikapcsolt Billingónál a visszatérítés sem riaszt', function () {
    config(['services.billingo.enabled' => false]);
    Log::spy();

    $this->postJson('/stripe/webhook', [
        'type' => 'charge.refunded',
        'data' => ['object' => ['id' => 'ch_no_billingo', 'amount_refunded' => 299000]],
    ])->assertOk();

    Log::shouldNotHaveReceived('critical');
});

test('BILL-L1: a Billingo-kérések explicit connect- és response-timeouttal épülnek', function () {
    $client = app(BillingoClient::class);
    $method = new ReflectionMethod($client, 'request');
    $pending = $method->invoke($client);

    $optionsProp = new ReflectionProperty($pending, 'options');
    $options = $optionsProp->getValue($pending);

    expect($options['connect_timeout'] ?? null)->toBe(10)
        ->and($options['timeout'] ?? null)->toBe(30);
});

test('BILL-L1: a hálózati timeout (ConnectionException) átjut a hívón, hogy a job retry kezelhesse', function () {
    Http::fake(function () {
        throw new ConnectionException('cURL error 28: Operation timed out');
    });

    expect(fn () => app(BillingoClient::class)->createDocument(['dummy' => true]))
        ->toThrow(ConnectionException::class);
});

test('T-10: a feldolgozásig törölt felhasználóra is kiállul a számla (valódi queue-körút)', function () {
    fakeBillingo();
    config(['queue.default' => 'database']);
    $user = billableUser(['billing_name' => 'Törölt Vevő Kft.', 'billing_zip' => '6720', 'billing_city' => 'Szeged']);
    $userId = $user->id;

    GenerateBillingoInvoice::dispatch(BillingProfile::fromUser($user), stripeInvoice(['id' => 'in_deleted_user']));
    $user->delete();

    $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--stop-when-empty' => true])
        ->assertSuccessful();

    $record = BillingoInvoice::where('stripe_invoice_id', 'in_deleted_user')->first();
    expect(User::find($userId))->toBeNull()
        ->and($record)->not->toBeNull()
        ->and($record->user_id)->toBeNull()
        ->and($record->isIssued())->toBeTrue()
        ->and(DB::table('jobs')->count())->toBe(0)
        ->and(DB::table('failed_jobs')->count())->toBe(0);

    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/partners')
        && $request->data()['name'] === 'Törölt Vevő Kft.'
        && $request->data()['address']['city'] === 'Szeged');
});

test('T-10: törölt felhasználónál is lefut a failed(), a Stripe invoice-azonosítóval naplózva', function () {
    Log::spy();
    Exceptions::fake();
    $user = billableUser();
    $userId = $user->id;

    $serialized = serialize(new GenerateBillingoInvoice(BillingProfile::fromUser($user), stripeInvoice(['id' => 'in_failed_ctx'])));
    $user->delete();

    $job = unserialize($serialized);
    $job->failed(new RuntimeException('Billingo 500'));

    Log::shouldHaveReceived('critical')->withArgs(fn (string $message, array $context): bool => $context['stripe_invoice_id'] === 'in_failed_ctx'
        && $context['user_id'] === $userId
        && $context['user_exists'] === false
        && $context['exception'] === 'Billingo 500');
    Exceptions::assertReported(fn (RuntimeException $e): bool => $e->getMessage() === 'Billingo 500');
});

test('T-10: élő felhasználónál a létrehozott partner-azonosító a userre mentődik', function () {
    fakeBillingo();
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice(BillingProfile::fromUser($user), stripeInvoice(['id' => 'in_profile_partner']));

    expect($user->refresh()->billingo_partner_id)->toBe(777);
});

test('T-10: a retry a userre időközben mentett partnert használja, nem hoz létre másodikat', function () {
    fakeBillingo();
    $user = billableUser();

    $profile = BillingProfile::fromUser($user);
    $user->forceFill(['billingo_partner_id' => 555])->save();

    app(InvoiceGenerator::class)->generateForStripeInvoice($profile, stripeInvoice(['id' => 'in_retry_partner']));

    Http::assertSent(fn ($request) => $request->method() === 'PUT' && str_ends_with($request->url(), '/partners/555'));
    Http::assertNotSent(fn ($request) => $request->method() === 'POST' && str_ends_with($request->url(), '/partners'));
});

function legacySerializedBillingJob(User $user, array $stripeInvoice): array
{
    return [
        'user' => new ModelIdentifier(User::class, $user->id, [], $user->getConnectionName()),
        'stripeInvoice' => $stripeInvoice,
    ];
}

test('T-10: a queue-ban maradt régi (User-t szerializáló) job élő usernél továbbra is számláz', function () {
    fakeBillingo();
    $user = billableUser();

    $job = (new ReflectionClass(GenerateBillingoInvoice::class))->newInstanceWithoutConstructor();
    $job->__unserialize(legacySerializedBillingJob($user, stripeInvoice(['id' => 'in_legacy_live'])));
    $job->handle(app(InvoiceGenerator::class));

    expect($job->userId)->toBe($user->id)
        ->and(BillingoInvoice::where('stripe_invoice_id', 'in_legacy_live')->first()?->isIssued())->toBeTrue();
});

test('T-10: a régi job törölt usernél sem dob deszerializáláskor — hangosan bukik, a failed() kontextussal fut', function () {
    Log::spy();
    Exceptions::fake();
    $user = billableUser();
    $legacy = legacySerializedBillingJob($user, stripeInvoice(['id' => 'in_legacy_gone']));
    $user->delete();

    $job = (new ReflectionClass(GenerateBillingoInvoice::class))->newInstanceWithoutConstructor();
    $job->__unserialize($legacy);

    expect($job->billing)->toBeNull()
        ->and(fn () => $job->handle(app(InvoiceGenerator::class)))->toThrow(RuntimeException::class, 'in_legacy_gone');

    $job->failed(null);

    Log::shouldHaveReceived('critical')->withArgs(fn (string $message, array $context): bool => $context['stripe_invoice_id'] === 'in_legacy_gone');
});
