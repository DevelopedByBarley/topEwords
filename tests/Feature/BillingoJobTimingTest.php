<?php

use App\Jobs\GenerateBillingoInvoice;
use App\Services\Billingo\InvoiceGenerator;

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
