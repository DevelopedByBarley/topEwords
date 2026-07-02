<?php

use App\Support\Billing;

function fullyConfiguredBilling(): void
{
    config([
        'services.stripe.enabled' => true,
        'cashier.key' => 'pk_test_real',
        'cashier.secret' => 'sk_test_real',
        'services.stripe.premium_price_id' => 'price_premium',
    ]);
}

test('billing is enabled when fully configured', function () {
    fullyConfiguredBilling();

    expect(Billing::enabled())->toBeTrue();
});

test('billing is disabled when the stripe secret key is missing', function () {
    fullyConfiguredBilling();
    config(['cashier.secret' => null]);

    expect(Billing::enabled())->toBeFalse();
});

test('billing is disabled when a price id is missing', function () {
    fullyConfiguredBilling();
    config(['services.stripe.premium_price_id' => null]);

    expect(Billing::enabled())->toBeFalse();
});
