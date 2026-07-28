<?php

use App\Models\User;
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
        'password.confirm.store' => 'throttle:6,1,password-update',
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

test('C-1: the password confirmation endpoint is rate limited', function () {
    // A fix nélkül ez a végpont korlátlan, néma jelszó-orákulum: egy eltérített
    // session birtokosa találgathat, és találat után nyílik a 2FA-letiltás,
    // a recovery-kódok kiolvasása és a végleges jelszócsere.
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
    // Él-eset a fixből: a szomszédos reset-route-ok IP-kulcsú `password-request`
    // limitert használnak. Ha azt örökölné ez a route is, egy user hat rossz
    // tippje kizárná az összes többi usert ugyanarról a NAT/céges IP-ről.
    // Az inline `throttle:6,1,...` a user id-re kulcsol — ezt rögzítjük.
    $attacker = User::factory()->create();
    $bystander = User::factory()->create();

    for ($i = 0; $i < 7; $i++) {
        $this->actingAs($attacker)
            ->post(route('password.confirm.store'), ['password' => "guess-{$i}"]);
    }

    // Az ártatlan user ugyanarról az IP-ről még mindig helyesen tud megerősíteni.
    $this->actingAs($bystander)
        ->post(route('password.confirm.store'), ['password' => 'password'])
        ->assertStatus(302);
});

test('C-1: confirm-password and password-update share one budget', function () {
    // Él-eset a fixből: mindkét végpont ugyanannak a fióknak a jelszavát
    // ellenőrzi, tehát ugyanaz az orákulum. Külön vödörrel a támadó percenként
    // 6 helyett 12 tippet kapna — ezért osztoznak a `password-update` néven.
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
    // Él-eset a fixből: ha a limiter a bcrypt UTÁN ülne, a 429 időzítésben
    // maradna orákulum. A middleware-sorrend: auth → throttle → controller.
    $route = Route::getRoutes()->getByName('password.confirm.store');
    $gathered = app('router')->gatherRouteMiddleware($route);

    $authIndex = array_search('Illuminate\Auth\Middleware\Authenticate:web', $gathered, true);
    $throttleIndex = array_search('Illuminate\Routing\Middleware\ThrottleRequests:6,1,password-update', $gathered, true);

    expect($authIndex)->not->toBeFalse()
        ->and($throttleIndex)->not->toBeFalse()
        // Az auth előbb fut, hogy a limiter a user id-re tudjon kulcsolni.
        ->and($throttleIndex)->toBeGreaterThan($authIndex);
});

test('C-1: the read-only confirmation status endpoint stays unthrottled', function () {
    // Szándékos aszimmetria: a státusz-végpont csak a session flaget olvassa,
    // jelszót nem ellenőriz, tehát nem orákulum. Ha valaha jelszót kezdene
    // ellenőrizni, ez a teszt már nem indokolja a throttle-mentességet.
    $route = Route::getRoutes()->getByName('password.confirmation');

    expect(collect($route->middleware())->contains(fn ($m) => str_starts_with($m, 'throttle')))
        ->toBeFalse();
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
