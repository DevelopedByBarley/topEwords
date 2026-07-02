<?php

namespace App\Support;

class Billing
{
    /**
     * Whether Stripe billing is live and fully configured.
     *
     * A fizetés a STRIPE_ENABLED env kapcsolóval élesíthető; emellett valós
     * kulcs és a Pro ár-azonosító szükséges hozzá. Bármelyik hiányában a
     * fizetési felület rejtve marad a fronton.
     */
    public static function enabled(): bool
    {
        return (bool) config('services.stripe.enabled')
            && config('cashier.key') !== 'pk_test_placeholder'
            && config('cashier.key') !== null
            // A tényleges API-hívások (newSubscription, swap, portál) a secret kulcsot
            // használják — enélkül a fizetés 500-zal esne el, hiába van publishable kulcs.
            && filled(config('cashier.secret'))
            && config('services.stripe.premium_price_id') !== null;
    }
}
