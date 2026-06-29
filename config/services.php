<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'gemini' => (function () {
        // Feladatonkénti modellpár: a primary-vel indulunk, és kapacitás-hibára
        // (503/429/5xx) átesünk a fallback-re — másik kapacitás-pool, jó eséllyel
        // nem ugyanakkor terhelt. Mindkettő .env-ből felülírható: a per-feladat
        // változó (pl. GEMINI_MODEL_LOOKUP) elsőbbséget élvez, üresen a globális
        // GEMINI_MODEL_PRIMARY / GEMINI_MODEL_FALLBACK örökli, az meg a beégetett
        // alapot. Üres fallback = nincs eszkaláció, csak a primary fut.
        // A `?:` lánc azért kell, mert egy .env-ben üresként hagyott kulcsra az
        // env() üres stringet ad (nem a defaultot) — így az üres érték is helyesen
        // a következő szintre esik: per-feladat → globális → beégetett alap.
        $model = fn (string $task, string $defaultPrimary, string $defaultFallback): array => [
            'primary' => env('GEMINI_MODEL_'.$task) ?: env('GEMINI_MODEL_PRIMARY') ?: $defaultPrimary,
            'fallback' => env('GEMINI_FALLBACK_'.$task) ?: env('GEMINI_MODEL_FALLBACK') ?: $defaultFallback,
        ];

        return [
            'api_key' => env('GEMINI_API_KEY'),
            // Havi AI-költségkeret felhasználónként, mikro-dollárban tárolva (1e6 = $1).
            // A tényleges Gemini token-költségből fogy (input/output × modell-ár).
            'monthly_budget_micros' => (int) round(((float) env('GEMINI_MONTHLY_BUDGET_USD', 1.00)) * 1_000_000),
            'models' => [
                'lookup' => $model('LOOKUP', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'),
                'insight' => $model('INSIGHT', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'),
                'flashcard' => $model('FLASHCARD', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'),
                'sentence' => $model('SENTENCE', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'),
                'practice' => $model('PRACTICE', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'),
            ],
        ];
    })(),

    'stripe' => [
        // Fizetés be/ki kapcsolása — élesítéskor STRIPE_ENABLED=true a .env-ben
        'enabled' => env('STRIPE_ENABLED', false),
        'basic_price_id' => env('STRIPE_STARTER_PRICE_ID'),
        'premium_price_id' => env('STRIPE_PRO_PRICE_ID'),
    ],

    'billingo' => [
        // NAV-kompatibilis magyar számlázás (Billingo v3 REST API). A sikeres Stripe
        // fizetés (invoice.payment_succeeded webhook) után aszinkron állít ki számlát.
        // Külön kapcsoló a Stripe-tól: a fizetés mehet anélkül is, hogy számlázunk.
        'enabled' => env('BILLINGO_ENABLED', false),
        'api_key' => env('BILLINGO_API_KEY'),
        // Számlatömb azonosító. Üresen hagyva a kliens automatikusan az első elérhető
        // tömböt használja — teszt profilnál így nem kell kézzel kikeresni az id-t.
        'block_id' => (int) env('BILLINGO_BLOCK_ID', 0),
        // A számlatétel ÁFA-kulcsa. Egyéni vállalkozónál tipikusan "AAM" (alanyi
        // adómentes); ÁFA-körösnél pl. "27%". Konfigból jön, hogy kód nélkül váltható.
        'vat' => env('BILLINGO_VAT', 'AAM'),
        // A számlatétel megnevezése, ha a Stripe sor nem ad használhatót.
        'item_name' => env('BILLINGO_ITEM_NAME', 'topEwords előfizetés'),
    ],

];
