<?php

return [

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
        $model = fn (string $task, string $defaultPrimary, string $defaultFallback): array => [
            'primary' => env('GEMINI_MODEL_'.$task) ?: env('GEMINI_MODEL_PRIMARY') ?: $defaultPrimary,
            'fallback' => env('GEMINI_FALLBACK_'.$task) ?: env('GEMINI_MODEL_FALLBACK') ?: $defaultFallback,
        ];

        return [
            'api_key' => env('GEMINI_API_KEY'),
            'request_deadline_seconds' => (float) env('GEMINI_REQUEST_DEADLINE', 30.0),
            'breaker' => [
                'failure_threshold' => (int) env('GEMINI_BREAKER_THRESHOLD', 5),
                'cooldown_seconds' => (int) env('GEMINI_BREAKER_COOLDOWN', 120),
            ],
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
        'enabled' => env('STRIPE_ENABLED', false),
        'premium_price_id' => env('STRIPE_PRO_PRICE_ID'),
    ],

    'billingo' => [
        'enabled' => env('BILLINGO_ENABLED', false),
        'api_key' => env('BILLINGO_API_KEY'),
        'block_id' => (int) env('BILLINGO_BLOCK_ID', 0),
        'vat' => env('BILLINGO_VAT', 'AAM'),
        'item_name' => env('BILLINGO_ITEM_NAME', 'topEwords előfizetés'),
    ],

];
