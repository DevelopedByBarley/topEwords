<?php

test('baseline hardening headers are sent on every response', function () {
    $response = $this->get(route('home'));

    $response->assertHeader('X-Frame-Options', 'DENY');
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    $response->assertHeader('X-Permitted-Cross-Domain-Policies', 'none');
    expect($response->headers->get('Permissions-Policy'))->toContain('geolocation=()');
});

test('CSP and HSTS are not sent outside production', function () {
    $response = $this->get(route('home'));

    expect($response->headers->has('Content-Security-Policy'))->toBeFalse();
    expect($response->headers->has('Strict-Transport-Security'))->toBeFalse();
});

test('CSP and HSTS are sent in production', function () {
    $this->app->detectEnvironment(fn () => 'production');

    $response = $this->get(route('home'));

    expect($response->headers->get('Content-Security-Policy'))
        ->toContain("frame-ancestors 'none'")
        ->toContain("object-src 'none'")
        ->toContain("base-uri 'self'")
        ->toContain("form-action 'self'");
    expect($response->headers->get('Strict-Transport-Security'))->toContain('max-age=31536000');
});
