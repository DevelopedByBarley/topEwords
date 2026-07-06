<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Models\BillingoInvoice;
use App\Models\User;
use App\Services\Billingo\BillingoClient;
use App\Services\Billingo\InvoiceGenerator;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
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

test('kikapcsolt Billingo esetén a webhook nem állít ki számlát', function () {
    config(['services.billingo.enabled' => false]);
    $user = billableUser();

    $this->postJson('/stripe/webhook', [
        'type' => 'invoice.payment_succeeded',
        'data' => ['object' => stripeInvoice(['customer' => $user->stripe_id])],
    ])->assertOk();

    expect(BillingoInvoice::count())->toBe(0);
});
