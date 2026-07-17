<?php

test('F1-L6: session cookie secure flag defaults to on in production', function () {
    // A config fail-safe: élesben akkor is Secure a session-cookie, ha a
    // deployer nem állítja be a SESSION_SECURE_COOKIE env-változót.
    $originalEnv = $_ENV['APP_ENV'] ?? 'testing';
    $originalServer = $_SERVER['APP_ENV'] ?? 'testing';

    $_ENV['APP_ENV'] = $_SERVER['APP_ENV'] = 'production';

    try {
        $config = require base_path('config/session.php');

        expect($config['secure'])->toBeTrue();
    } finally {
        $_ENV['APP_ENV'] = $originalEnv;
        $_SERVER['APP_ENV'] = $originalServer;
    }
});

test('F1-L6: session cookie secure flag stays off outside production unless set', function () {
    // APP_ENV=testing alatt fut — a default nem törheti el a lokális HTTP-t.
    expect(config('session.secure'))->toBeFalse();
});
