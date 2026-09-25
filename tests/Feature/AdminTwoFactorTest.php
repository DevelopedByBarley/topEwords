<?php

use App\Http\Middleware\EnsureAdminHasTwoFactor;
use App\Models\User;
use App\Models\Word;

/**
 * Az admin-felület csak megerősített 2FA-val érhető el (F9C-L2): egy
 * kiszivárgott admin-jelszó önmagában ne adja a teljes userbázist, az ingyenes
 * Pro-hozzáférést és a közös szótár szerkesztését.
 */
beforeEach(function () {
    config(['app.admin_email' => 'admin@example.com']);
});

test('a 2FA nélküli admin a Biztonság oldalra kerül, flash-üzenettel', function () {
    $admin = User::factory()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('admin'))
        ->assertRedirect(route('security.edit'))
        ->assertSessionHas('error', EnsureAdminHasTwoFactor::MESSAGE);
});

test('lejárt jelszó-megerősítésnél előbb a megerősítésre, majd vissza az adminra', function () {
    $admin = User::factory()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->get(route('admin'))
        ->assertRedirect(route('password.confirm'))
        ->assertSessionHas('url.intended', route('admin'));
});

test('a bekapcsolt, de meg nem erősített 2FA nem elég', function () {
    $admin = User::factory()->create([
        'email' => 'admin@example.com',
        'two_factor_secret' => encrypt('secret'),
        'two_factor_confirmed_at' => null,
    ]);

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('admin'))
        ->assertRedirect(route('security.edit'));
});

test('a megerősített 2FA-s admin eléri az admin-oldalt', function () {
    $admin = User::factory()->withTwoFactor()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)->get(route('admin'))->assertOk();
});

test('a 2FA nélküli admin JSON-kérésre 403-at kap', function () {
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $word = Word::create(['word' => 'happy', 'rank' => 1]);

    $this->actingAs($admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertForbidden()
        ->assertJson(['message' => EnsureAdminHasTwoFactor::MESSAGE]);
});

test('a 2FA nélküli admin nem ír admin-végponton', function () {
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $target = User::factory()->create();

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('admin.access.set'), ['email' => $target->email, 'plan' => 'premium'])
        ->assertRedirect(route('security.edit'));

    expect($target->refresh()->plan_override)->toBeNull();
});

test('minden admin-route megkapja a 2FA-middleware-t', function (string $routeName) {
    $route = app('router')->getRoutes()->getByName($routeName);

    expect($route)->not->toBeNull()
        ->and($route->gatherMiddleware())->toContain('admin.2fa');
})->with([
    'admin',
    'admin.access.set',
    'admin.free-month.grant',
    'admin.invites.store',
    'admin.invites.destroy',
    'admin.reports.update-status',
    'downloads.index',
    'downloads.show',
    'words.update',
    'words.destroy',
    'words.ai-fill',
    'text-analysis.gemini-models',
]);

test('a nem-admin usert a middleware nem érinti', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('admin'))->assertForbidden();
    $this->actingAs($user)->get(route('dashboard'))->assertOk();
});

test('helyi környezetben a config kikapcsolhatja a kényszert', function () {
    app()->detectEnvironment(fn () => 'local');
    config(['app.admin_requires_two_factor' => false]);
    $admin = User::factory()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)->get(route('admin'))->assertOk();
});

test('helyi környezeten kívül a config nem kapcsolja ki a kényszert', function () {
    config(['app.admin_requires_two_factor' => false]);
    $admin = User::factory()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('admin'))
        ->assertRedirect(route('security.edit'));
});
