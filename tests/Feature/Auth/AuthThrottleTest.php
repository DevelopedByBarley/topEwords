<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

test('FA-L3: the two-factor limiter falls back to the IP when the login id is missing', function () {
    $limiter = RateLimiter::limiter('two-factor');

    $request = Request::create('/two-factor-challenge', 'POST');
    $request->server->set('REMOTE_ADDR', '203.0.113.7');
    $request->setLaravelSession(new Store('test', new ArraySessionHandler(60)));

    [$perMinute, $perHour] = $limiter($request);

    expect($perMinute->key)->toBe('203.0.113.7')
        ->and($perHour->key)->toBe('hour:203.0.113.7');
});

test('F9C-L5: a two-factor limiter órás plafont is ad, a login.id-hez kötve', function () {
    $limiter = RateLimiter::limiter('two-factor');

    $request = Request::create('/two-factor-challenge', 'POST');
    $session = new Store('test', new ArraySessionHandler(60));
    $session->put('login.id', 42);
    $request->setLaravelSession($session);

    [$perMinute, $perHour] = $limiter($request);

    expect($perMinute->key)->toBe(42)
        ->and($perMinute->maxAttempts)->toBe(5)
        ->and($perHour->key)->toBe('hour:42')
        ->and($perHour->maxAttempts)->toBe(30)
        ->and($perHour->decaySeconds)->toBe(3600);
});

test('F9C-L5: a 2FA-challenge óránként legfeljebb 30 próbát enged, percenkénti szünetekkel is', function () {
    $user = User::factory()->withTwoFactor()->create();

    $this->post(route('login'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));

    for ($minute = 0; $minute < 6; $minute++) {
        for ($i = 0; $i < 5; $i++) {
            $this->post(route('two-factor.login.store'), ['recovery_code' => "wrong-{$minute}-{$i}"])
                ->assertRedirect();
        }

        $this->travel(61)->seconds();
    }

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'wrong-final'])
        ->assertStatus(429);
});

test('F9C-L5: a login-limit IP-váltással sem kerülhető meg (csak e-mailre kulcsolt vödör)', function () {
    $user = User::factory()->create();

    for ($i = 1; $i <= 20; $i++) {
        $this->withServerVariables(['REMOTE_ADDR' => "203.0.113.{$i}"])
            ->post(route('login.store'), ['email' => $user->email, 'password' => "wrong-{$i}"]);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.1'])
        ->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong-final'])
        ->assertStatus(429);

    $other = User::factory()->create();

    $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.1'])
        ->post(route('login.store'), ['email' => $other->email, 'password' => 'wrong'])
        ->assertStatus(302);
});

test('registration and password-reset routes carry a throttle limiter', function () {
    $expected = [
        'register.store' => 'throttle:register',
        'password.email' => 'throttle:password-request',
        'password.update' => 'throttle:password-request',
        'password.confirm.store' => 'throttle:6,1,password-update',
    ];

    foreach ($expected as $name => $middleware) {
        $route = Route::getRoutes()->getByName($name);

        expect($route)->not->toBeNull()
            ->and($route->middleware())->toContain($middleware);
    }
});

test('the password reset request endpoint is rate limited', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->post(route('password.email'), ['email' => 'nobody@example.com']);
    }

    $this->post(route('password.email'), ['email' => 'nobody@example.com'])
        ->assertStatus(429);
});

test('C-1: the password confirmation endpoint is rate limited', function () {
    $user = User::factory()->create();

    for ($i = 0; $i < 6; $i++) {
        $this->actingAs($user)
            ->post(route('password.confirm.store'), ['password' => "guess-{$i}"]);
    }

    $this->actingAs($user)
        ->post(route('password.confirm.store'), ['password' => 'guess-7'])
        ->assertStatus(429);
});

test('C-1: the confirm-password limiter is per user, not per IP', function () {
    $attacker = User::factory()->create();
    $bystander = User::factory()->create();

    for ($i = 0; $i < 7; $i++) {
        $this->actingAs($attacker)
            ->post(route('password.confirm.store'), ['password' => "guess-{$i}"]);
    }

    $this->actingAs($bystander)
        ->post(route('password.confirm.store'), ['password' => 'password'])
        ->assertStatus(302);
});

test('C-1: confirm-password and password-update share one budget', function () {
    $user = User::factory()->create();

    for ($i = 0; $i < 6; $i++) {
        $this->actingAs($user)
            ->post(route('password.confirm.store'), ['password' => "guess-{$i}"]);
    }

    $this->actingAs($user)
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])
        ->assertStatus(429);
});

test('C-1: the throttle runs before the password check, so 429 leaks nothing', function () {
    $route = Route::getRoutes()->getByName('password.confirm.store');
    $gathered = app('router')->gatherRouteMiddleware($route);

    $authIndex = array_search('Illuminate\Auth\Middleware\Authenticate:web', $gathered, true);
    $throttleIndex = array_search('Illuminate\Routing\Middleware\ThrottleRequests:6,1,password-update', $gathered, true);

    expect($authIndex)->not->toBeFalse()
        ->and($throttleIndex)->not->toBeFalse()
        ->and($throttleIndex)->toBeGreaterThan($authIndex);
});

test('C-1: the read-only confirmation status endpoint stays unthrottled', function () {
    $route = Route::getRoutes()->getByName('password.confirmation');

    expect(collect($route->middleware())->contains(fn ($m) => str_starts_with($m, 'throttle')))
        ->toBeFalse();
});

test('F1-L1: the password reset submit endpoint is rate limited', function () {
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
