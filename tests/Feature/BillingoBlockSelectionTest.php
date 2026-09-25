<?php

use App\Services\Billingo\BillingoClient;
use Illuminate\Http\Client\StrayRequestException;
use Illuminate\Support\Facades\Http;

/**
 * T-33 / F9B-L2: BILLINGO_BLOCK_ID=0 mellett az automatikus tömbválasztás csak
 * `invoice` típusú tömböt vehet — díjbekérő, sztornó vagy más típusú tömb nem
 * kaphat NAV-számlát. Ha nincs ilyen tömb, hangosan bukik.
 */
test('az automatikus választás átugorja a nem invoice típusú tömböket', function () {
    Http::fake([
        'api.billingo.hu/v3/document-blocks*' => Http::response(['data' => [
            ['id' => 10, 'type' => 'proforma'],
            ['id' => 11, 'type' => 'cancellation'],
            ['id' => 12, 'type' => 'invoice'],
            ['id' => 13, 'type' => 'invoice'],
        ]], 200),
    ]);

    expect((new BillingoClient('test-key'))->firstInvoiceBlockId())->toBe(12);
});

test('hangosan bukik, ha nincs invoice típusú tömb', function (array $blocks) {
    Http::fake([
        'api.billingo.hu/v3/document-blocks*' => Http::response(['data' => $blocks], 200),
    ]);

    expect(fn () => (new BillingoClient('test-key'))->firstInvoiceBlockId())
        ->toThrow(RuntimeException::class, 'BILLINGO_BLOCK_ID');
})->with([
    'üres lista' => [[]],
    'csak díjbekérő' => [[['id' => 10, 'type' => 'proforma']]],
    'típus nélküli tömb' => [[['id' => 42]]],
]);

test('T-7: mock nélküli Billingo-hívás nem megy ki, hanem hangosan elbukik', function () {
    // Http::fake() nélkül a globális preventStrayRequests (tests/TestCase.php) megfogja
    // a kérést — egy elfelejtett mock sem érhet el valódi külső szolgáltatást.
    expect(fn () => (new BillingoClient('test-key'))->firstInvoiceBlockId())
        ->toThrow(StrayRequestException::class);
});

test('T-7: a tesztkörnyezetben a Billingo alapból ki van kapcsolva', function () {
    expect(config('services.billingo.enabled'))->toBeFalsy();
});
