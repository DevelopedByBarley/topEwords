<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Services\Billingo\InvoiceGenerator;

/**
 * T-34 (F9B-L3): a dupla NAV-számla elleni zár biztonsági sávja nem maradhat implicit.
 *
 * Ha a job futhat még, amikor a kiállítási zár lejár, vagy a queue a még futó példány
 * mellé egy másodikat ad ki (retry_after ≤ timeout), két folyamat is kiállíthat számlát
 * ugyanarra a fizetésre. A viszonyt ezek a tesztek rögzítik, hogy egy későbbi konstans-
 * vagy konfigváltozás hangosan bukjon.
 */
test('a job deklarált timeoutja van, és timeoutnál nem bukik el véglegesen', function () {
    $job = new ReflectionClass(GenerateBillingoInvoice::class);
    $defaults = $job->getDefaultProperties();

    expect($defaults['timeout'])->toBe(GenerateBillingoInvoice::TIMEOUT_SECONDS)
        ->and($defaults['timeout'])->toBeGreaterThan(0)
        ->and($defaults['failOnTimeout'])->toBeFalse();
});

test('a kiállítási zár TTL-je legalább a job timeoutja + a zár-várakozás', function () {
    expect(InvoiceGenerator::LOCK_TTL_SECONDS)
        ->toBeGreaterThanOrEqual(GenerateBillingoInvoice::TIMEOUT_SECONDS + InvoiceGenerator::LOCK_WAIT_SECONDS);
});

test('a queue-kapcsolat retry_after értéke nagyobb a job timeoutjánál', function (string $connection) {
    expect((int) config("queue.connections.{$connection}.retry_after"))
        ->toBeGreaterThan(GenerateBillingoInvoice::TIMEOUT_SECONDS);
})->with(['database', 'redis']);
