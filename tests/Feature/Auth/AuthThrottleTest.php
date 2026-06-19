<?php

use Illuminate\Support\Facades\Route;

test('registration and password-reset request routes carry a throttle limiter', function () {
    $expected = [
        'register.store' => 'throttle:register',
        'password.email' => 'throttle:password-request',
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
