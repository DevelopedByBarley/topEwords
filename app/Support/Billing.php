<?php

namespace App\Support;

class Billing
{
    public static function enabled(): bool
    {
        return (bool) config('services.stripe.enabled')
            && config('cashier.key') !== 'pk_test_placeholder'
            && config('cashier.key') !== null
            && filled(config('cashier.secret'))
            && config('services.stripe.premium_price_id') !== null;
    }
}
