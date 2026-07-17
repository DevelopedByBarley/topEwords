<?php

use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

test('FA-L3: the two-factor limiter falls back to the IP when the login id is missing', function () {
    // Rendellenes flow (van session, de nincs benne login.id): a kulcs ne null
    // legyen — különben minden ilyen kérés egy közös vödörbe esne. IP-re esik vissza.
    $limiter = RateLimiter::limiter('two-factor');

    $request = Request::create('/two-factor-challenge', 'POST');
    $request->server->set('REMOTE_ADDR', '203.0.113.7');
    $request->setLaravelSession(new Store('test', new ArraySessionHandler(60)));

    $limit = $limiter($request);

    expect($limit->key)->toBe('203.0.113.7');
});

test('registration and password-reset routes carry a throttle limiter', function () {
    $expected = [
        'register.store' => 'throttle:register',
        'password.email' => 'throttle:password-request',
        'password.update' => 'throttle:password-request',
    ];

    foreach ($expected as $name => $middleware) {
        $route = Route::getRoutes()->getByName($name);

        expect($route)->not->toBeNull()
            ->and($route->middleware())->toContain($middleware);
    }
});

test('the password reset request endpoint is rate limited', function () {
    // Limit is 5/min per IP — the 6th request must be throttled.
    for ($i = 0; $i < 5; $i++) {
        $this->post(route('password.email'), ['email' => 'nobody@example.com']);
    }

    $this->post(route('password.email'), ['email' => 'nobody@example.com'])
        ->assertStatus(429);
});

test('F1-L1: the password reset submit endpoint is rate limited', function () {
    // A tényleges jelszó-átíró bekülde ugyanazt az 5/perc/IP limitert kapja,
    // mint a link-kérés — token-brute-force ellen.
    $payload = [
        'token' => 'invalid-token',
        'email' => 'nobody@example.com',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ];

    for ($i = 0; $i < 5; $i++) {
        $this->post(route('password.update'), $payload);
    }

    $this->post(route('password.update'), $payload)->assertStatus(429);
});
