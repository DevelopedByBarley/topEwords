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

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        // Havi AI-költségkeret felhasználónként, mikro-dollárban tárolva (1e6 = $1).
        // A tényleges Gemini token-költségből fogy (input/output × modell-ár).
        'monthly_budget_micros' => (int) round(((float) env('GEMINI_MONTHLY_BUDGET_USD', 0.50)) * 1_000_000),
    ],

    'stripe' => [
        // Fizetés be/ki kapcsolása — élesítéskor STRIPE_ENABLED=true a .env-ben
        'enabled' => env('STRIPE_ENABLED', false),
        'basic_price_id' => env('STRIPE_STARTER_PRICE_ID'),
        'premium_price_id' => env('STRIPE_PRO_PRICE_ID'),
    ],

];
