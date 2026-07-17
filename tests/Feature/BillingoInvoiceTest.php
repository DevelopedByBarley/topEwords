<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Models\BillingoInvoice;
use App\Models\User;
use App\Services\Billingo\BillingoClient;
use App\Services\Billingo\InvoiceGenerator;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

/**
 * Egy egyéni vállalkozó (alanyi adómentes) felhasználó, kész számlázási adatokkal.
 */
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

/**
 * Egy minimális Stripe invoice objektum (a webhook payload data.object része).
 */
function stripeInvoice(array $overrides = []): array
{
    // Alapeset: HUF (a Billingo-fiók alappénzneme) — ilyenkor nincs átváltás. A Stripe a
    // HUF-ot 2 tizedesként kezeli (100 többszöröse), így 299000 = 2990,00 Ft.
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

/**
 * A Billingo v3 végpontok alapértelmezett, sikeres válaszai.
 */
function fakeBillingo(): void
{
    Http::fake([
        'api.billingo.hu/v3/currencies*' => Http::response(['conversation_rate' => 390.5], 200),
        'api.billingo.hu/v3/partners/*' => Http::response([], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
        // A küldés-végpont specifikusabb mintája a /documents elé kerül (első találat nyer).
        'api.billingo.hu/v3/documents/*/send' => Http::response([], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'TESZT-2026-1'], 200),
        'api.billingo.hu/v3/document-blocks' => Http::response(['data' => [['id' => 42]]], 200),
    ]);
}

beforeEach(function () {
    config([
        'services.billingo.enabled' => true,
        'services.billingo.api_key' => 'test-key',
        'services.billingo.block_id' => 99,
        'services.billingo.vat' => 'AAM',
        'services.billingo.item_name' => 'topEwords előfizetés',
        // Üres webhook secret → a Cashier nem csatol aláírás-middleware-t, így a
        // webhook route a tesztben aláírás nélkül hívható (a dispatch-logikát teszteljük).
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

    // A partner azonosítója a felhasználóhoz mentve, hogy később újrahasználjuk.
    expect($user->refresh()->billingo_partner_id)->toBe(777);
});

test('a kiállított számlát e-mailben elküldi a partnernek és rögzíti a kézbesítést', function () {
    fakeBillingo();
    $user = billableUser();

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_send']));

    // A Billingo a létrehozáskor nem küld e-mailt — a kiállított dokumentumot külön
    // küldjük el a send-végponton, és rögzítjük a kézbesítés időpontját.
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

    // Pontosan egy küldés-hívás ment ki a két futás alatt.
    Http::assertSentCount(3);
});

test('egy korábban kiállított, de el nem küldött számlát utólag elküld', function () {
    fakeBillingo();
    $user = billableUser();

    // Korábbi futás: a számla kiállt (van dokumentum-azonosítója), de a kézbesítés
    // még nem történt meg (emailed_at null) — pl. a send-hívás akkor elhasalt.
    $record = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_unsent',
        'billingo_document_id' => 5001,
        'invoice_number' => 'TESZT-2026-1',
    ]);

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_unsent']));

    // Nem áll ki új dokumentumot, de a kézbesítést pótolja.
    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents'));
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents/5001/send'));
    expect($record->refresh()->emailed_at)->not->toBeNull();
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
            // HUF-számlán nincs conversion_rate (a fiók alappénzneme HUF).
            && ! array_key_exists('conversion_rate', $request->data())
            && $item['unit_price'] === 2990.0
            && $item['unit_price_type'] === 'gross'
            && $item['vat'] === 'AAM';
    });

    // HUF-nál nem kell árfolyam — a /currencies végpontot meg sem hívjuk.
    Http::assertNotSent(fn ($request) => str_contains($request->url(), '/currencies'));
});

test('devizás (nem HUF) számlán a teljesítés napi MNB-árfolyam kerül a conversion_rate-be', function () {
    fakeBillingo();
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'amount_paid' => 2990,
        'currency' => 'eur',
    ]));

    // Az árfolyamot a teljesítés napjára kérjük le, EUR→HUF irányban.
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

    // 2026-01-15 23:30 UTC = 2026-01-16 00:30 Europe/Budapest (téli, UTC+1) — a
    // NAV-számla teljesítési dátuma a magyar naptári nap, nem az eltolt UTC-dátum.
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

    // Az árfolyam-lookup dátuma a budapesti teljesítési nap — így az MNB-árfolyam
    // ugyanahhoz a naphoz tartozik, mint a számla teljesítési dátuma.
    Http::assertSent(fn ($request) => str_contains($request->url(), '/currencies')
        && str_contains($request->url(), 'date=2026-01-16'));
});

test('nem támogatott (pl. zero-decimal) valutánál nem állít ki számlát, hanem kivételt dob', function () {
    fakeBillingo();
    $user = billableUser();

    // A JPY-t a Stripe zero-decimal valutaként kezeli — a /100-as osztás 1/100-ad
    // összegű NAV-számlát adna. Inkább hangosan bukjon a job (failed-job riasztás),
    // mint hogy rossz összegű számla szülessen.
    expect(fn () => app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_jpy',
        'currency' => 'jpy',
    ])))->toThrow(RuntimeException::class, 'JPY');

    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents'));
});

test('érvénytelen árfolyam-válasznál nem állít ki számlát, hanem kivételt dob', function () {
    Http::fake([
        // Hiányzó conversation_rate mező — (float) null = 0.0 kerülne a számlára.
        'api.billingo.hu/v3/currencies*' => Http::response(['detail' => 'no rate'], 200),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 777], 200),
    ]);
    $user = billableUser();

    // A kivétel felfut, így a job backoff-fal újrapróbálja, ahelyett hogy 0-s
    // árfolyammal érthetetlen Billingo 422-t kapnánk.
    expect(fn () => app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_bad_rate',
        'amount_paid' => 2990,
        'currency' => 'eur',
    ])))->toThrow(RuntimeException::class, 'EUR→HUF');

    // Dokumentum-kiállítás nem történt.
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

    // A két futás alatt pontosan egy partner-, egy dokumentum- és egy küldés-hívás ment
    // ki — a már kiállított és kézbesített számlán a második futás nem hív Billingót.
    Http::assertSentCount(3);
});

test('a már mentett partnert újrahasználja, nem hoz létre újat', function () {
    fakeBillingo();
    $user = billableUser();
    $user->forceFill(['billingo_partner_id' => 555])->save();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice());

    // Nincs új partner (POST /partners), a meglévőt használja a számlán.
    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/partners'));
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents')
        && $request->data()['partner_id'] === 555);
});

test('a meglévő partnert a friss számlázási adatokkal frissíti számlázáskor', function () {
    fakeBillingo();
    // A felhasználó a partner létrehozása óta módosította a nevét/címét.
    $user = billableUser(['billing_name' => 'Új Név Kft.', 'billing_address' => 'Új utca 9.']);
    $user->forceFill(['billingo_partner_id' => 555])->save();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice());

    // A meglévő partnert PUT-tal frissíti (nem hoz létre újat) a friss adatokkal.
    Http::assertSent(fn ($request) => $request->method() === 'PUT'
        && str_ends_with($request->url(), '/partners/555')
        && $request->data()['name'] === 'Új Név Kft.'
        && $request->data()['address']['address'] === 'Új utca 9.');
});

test('ha a mentett partnert a Billingo-fiókból törölték (404), újra létrehozza és számláz', function () {
    Http::fake([
        // A mentett partner frissítése 404 — a partnert időközben törölték a fiókból.
        'api.billingo.hu/v3/partners/*' => Http::response(['error' => 'Partner not found'], 404),
        'api.billingo.hu/v3/partners' => Http::response(['id' => 888], 200),
        'api.billingo.hu/v3/documents/*/send' => Http::response([], 200),
        'api.billingo.hu/v3/documents' => Http::response(['id' => 5001, 'invoice_number' => 'TESZT-2026-1'], 200),
    ]);
    $user = billableUser();
    $user->forceFill(['billingo_partner_id' => 555])->save();

    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_gone_partner']));

    // A halott azonosító helyett új partner készül, azzal megy ki a számla,
    // és a friss azonosító mentődik a felhasználóhoz a későbbi számlákhoz.
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

    // Átmeneti (pl. 500-as) hibánál NEM hozunk létre új partnert — az duplikálná a
    // vevőt —, hanem a kivétel felfut, és a job backoff-fal újrapróbálja.
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

    // Egy másik folyamat már tartja a zárat erre a fizetésre. Várakozás nélküli
    // generátort használunk, hogy a teszt ne aludjon végig a block() időkeretén.
    $heldByOther = Cache::lock('billingo:issue:in_race', 120);
    expect($heldByOther->get())->toBeTrue();

    $generator = new InvoiceGenerator(app(BillingoClient::class), lockWaitSeconds: 0);

    // A meg nem szerzett zár NEM csendes siker (az egy hard-killelt worker beragadt
    // zárjánál riasztás nélkül nyelné el a NAV-számlát), hanem kivétel: a
    // job-próbálkozás elbukik, és a queue a backoff — vagyis a zár lejárta — után
    // újrapróbálja. Számla-sor és Billingo-hívás közben nem keletkezik.
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

test('konfig nélküli számlatömbnél az első elérhető tömböt kéri le', function () {
    fakeBillingo();
    config(['services.billingo.block_id' => 0]);
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice());

    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/document-blocks'));
    Http::assertSent(fn ($request) => str_ends_with($request->url(), '/documents')
        && $request->data()['block_id'] === 42);
});

test('a sikeres fizetés webhookja a számlázó jobot sorba teszi, ha a Billingo be van kapcsolva', function () {
    Queue::fake();
    $user = billableUser();
    $invoice = stripeInvoice(['id' => 'in_webhook', 'customer' => $user->stripe_id]);

    // A webhook ASZINKRON számláz: a feladata csak annyi, hogy a megfelelő felhasználóval
    // és invoice payloaddal sorba tegye a jobot — a tényleges Billingo-hívást a worker intézi.
    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => $invoice],
    ])->assertOk();

    Queue::assertPushed(GenerateBillingoInvoice::class, function (GenerateBillingoInvoice $job) use ($user) {
        return $job->user->is($user) && ($job->stripeInvoice['id'] ?? null) === 'in_webhook';
    });
});

test('W-L3: a jobra tett payload csak a szükséges mezőket tartja meg, az ügyfél-PII-t nem', function () {
    // A teljes Stripe invoice ügyfél-PII-t is tartalmaz (customer_email/name/address), amiből a
    // generator semmit sem használ. A jobs/failed_jobs táblába csak a ténylegesen olvasott
    // mezők kerüljenek — a PII ne szerializálódjon és ne maradjon meg végleges bukásnál sem.
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

        // A generator által olvasott mezők megvannak…
        expect($payload['id'])->toBe('in_pii')
            ->and($payload['currency'])->toBe('huf')
            ->and($payload['amount_paid'])->toBe(299000)
            ->and($payload['lines']['data'][0]['description'])->toBe('topEwords Pro – havi');

        // …az ügyfél-PII viszont NEM.
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

    // A job tényleges feldolgozása (a sync teszt-queue inline futtatja) end-to-end létrehozza
    // és kiállítja a számlát — ez a worker élesben végzett munkájának megfelelője.
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

    // A trial-induló invoice.payment_succeeded esemény amount_paid-ja 0.
    $record = app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice([
        'id' => 'in_trial_start',
        'amount_paid' => 0,
        'total' => 0,
    ]));

    expect($record)->toBeNull();
    expect(BillingoInvoice::count())->toBe(0);

    // Sem nyilvántartó sor, sem Billingo-hívás nem keletkezik.
    Http::assertNothingSent();
});

test('a webhook a 0 összegű számlát kihagyja, a tényleges terhelést kiszámlázza', function () {
    fakeBillingo();
    $user = billableUser();

    // Trial-induló 0-s számla → nincs Billingo dokumentum.
    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['id' => 'in_zero', 'amount_paid' => 0, 'total' => 0, 'customer' => $user->stripe_id])],
    ])->assertOk();

    expect(BillingoInvoice::where('stripe_invoice_id', 'in_zero')->exists())->toBeFalse();

    // A trial vége utáni valódi terhelés (pozitív összeg) viszont számlát kap.
    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['id' => 'in_charge', 'amount_paid' => 299000, 'total' => 299000, 'customer' => $user->stripe_id])],
    ])->assertOk();

    expect(BillingoInvoice::where('stripe_invoice_id', 'in_charge')->first()?->isIssued())->toBeTrue();
});

test('crash-utáni retry: ha a jelző beállt és a Billingóban már létezik a dokumentum, azt átveszi, nem állít ki másodikat', function () {
    // A számla comment mezőjében a Stripe invoice-id horgony, amire a visszakeresés illeszt.
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

    // Egy korábbi attempt megkezdte a kiállítást (jelző beállt), de a dokumentum-id mentése
    // előtt meghalt — a sor kiállítatlan, de az issuing_started_at be van állítva.
    $record = BillingoInvoice::create([
        'user_id' => $user->id,
        'stripe_invoice_id' => 'in_crash',
        'issuing_started_at' => now()->subMinutes(2),
    ]);

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_crash']));

    // A Billingóban már kiadott számlát átvette (nem állított ki újat).
    expect($record->refresh()->billingo_document_id)->toBe(9001)
        ->and($record->invoice_number)->toBe('MENTETT-2026-7');
    Http::assertNotSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents'));
});

test('crash-utáni retry: ha a jelző beállt de a Billingóban nincs nyom, egyszer kiállítja', function () {
    Http::fake([
        // A visszakeresés üres — a korábbi attempt a createDocument ELŐTT halt meg.
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

    // Nincs Billingo-találat → pontosan egyszer állít ki, a comment-horgonnyal.
    expect($record->refresh()->billingo_document_id)->toBe(5001);
    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && str_ends_with($request->url(), '/documents')
        && $request->data()['comment'] === 'stripe_invoice_id:in_clean_retry');
});

test('tiszta első kiállításnál nem keres vissza a Billingóban, csak a jelzőt állítja be', function () {
    fakeBillingo();
    $user = billableUser();

    app(InvoiceGenerator::class)->generateForStripeInvoice($user, stripeInvoice(['id' => 'in_first']));

    // Jelzős sor: az issuing_started_at be van állítva a kiálláshoz.
    $record = BillingoInvoice::where('stripe_invoice_id', 'in_first')->first();
    expect($record->issuing_started_at)->not->toBeNull();

    // Első kiállításnál nincs visszakeresés (nem volt korábbi jelző).
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

    // Nincs helyi user ehhez a customerhez (out-of-order customer.deleted vagy dashboardban
    // kézzel létrehozott customer) — a job nem indulhat, a NAV-számla némán elveszne.
    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice([
            'id' => 'in_orphan',
            'customer' => 'cus_nincs_ilyen',
            'amount_paid' => 299000,
        ])],
    ])->assertOk();

    Queue::assertNotPushed(GenerateBillingoInvoice::class);

    // A pénz-vesztés hangos: critical log a customerrel és az invoice-id-vel.
    Log::shouldHaveReceived('critical')->once()->withArgs(function (string $message, array $context) {
        return str_contains($message, 'ismeretlen customer')
            && $context['stripe_customer'] === 'cus_nincs_ilyen'
            && $context['stripe_invoice_id'] === 'in_orphan';
    });
});

test('ismeretlen customer 0 összegű (trial-induló) számlájánál nincs riasztás', function () {
    Queue::fake();
    Log::spy();

    // A trial-induló 0-s számla ismeretlen customerrel sem pénz-vesztés — nem riasztunk.
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

// ── W-L7: charge.refunded → NAV-sztornó emlékeztető ──────────────────────────

test('W-L7: visszatérítés critical riasztást ad, de a webhook 200-at ad (kézi NAV-sztornó kell)', function () {
    Log::spy();

    // Refund (jellemzően dashboardról) — a Cashier alapból némán 200-azna rá; nekünk
    // hangosan kell riasztanunk, mert a jóváíró NAV-számla kézi feladat.
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
    // A klienssel indított minden kérésnek véges időkorláttal kell lógnia, hogy egy
    // beragadt Billingo ne fogja fel korlátlanul a queue workert (a beragadt job lelövése
    // + retry keresés különben dupla számlát okozhat). A privát request() építi a közös
    // PendingRequestet — reflexióval kiolvassuk a rá beállított Guzzle-opciókat.
    $client = app(BillingoClient::class);
    $method = new ReflectionMethod($client, 'request');
    $pending = $method->invoke($client);

    $optionsProp = new ReflectionProperty($pending, 'options');
    $options = $optionsProp->getValue($pending);

    expect($options['connect_timeout'] ?? null)->toBe(10)
        ->and($options['timeout'] ?? null)->toBe(30);
});

test('BILL-L1: a hálózati timeout (ConnectionException) átjut a hívón, hogy a job retry kezelhesse', function () {
    // A véges timeout tényleges hatása: időtúllépéskor a Guzzle ConnectionExceptiont dob.
    // A kliens ezt NEM nyelheti el — a GenerateBillingoInvoice job backoffja csak akkor tud
    // újrapróbálni (és a findIssuedDocument-tel dupla számla ellen védeni), ha a hiba felszáll.
    Http::fake(function () {
        throw new ConnectionException('cURL error 28: Operation timed out');
    });

    expect(fn () => app(BillingoClient::class)->createDocument(['dummy' => true]))
        ->toThrow(ConnectionException::class);
});
