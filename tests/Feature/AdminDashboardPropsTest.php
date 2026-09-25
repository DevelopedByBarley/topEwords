<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use App\Services\AdminDashboardService;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Az admin-oldal user-listái csak a megjelenítéshez kellő mezőket küldhetik a
 * böngészőbe. A mostActive korábban a teljes users-sort küldte (stripe_id,
 * számlázási cím, adószám, telefon — F9C-L1), mert a withCount() `users.*`-ot
 * tett a lekérdezésbe. A zárt (etc() nélküli) prop-ellenőrzés minden új mezőre
 * elbukik.
 */
beforeEach(function () {
    config(['app.admin_email' => 'admin@example.com']);

    $this->admin = User::factory()->withTwoFactor()->create(['email' => 'admin@example.com']);

    User::factory()->withBilling()->create([
        'streak' => 5,
        'stripe_id' => 'cus_secret123',
    ]);
});

test('a mostActive csak a megjelenített mezőket küldi', function () {
    $this->actingAs($this->admin)
        ->get(route('admin'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('mostActive', 2)
            ->has('mostActive.0', fn (Assert $user) => $user
                ->hasAll(['id', 'name', 'email', 'streak', 'known_words_count'])
            )
        );
});

test('a topStreaks és a recentUsers sem küld számlázási vagy Stripe-adatot', function () {
    $this->actingAs($this->admin)
        ->get(route('admin'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('topStreaks.0', fn (Assert $user) => $user
                ->hasAll(['name', 'email', 'streak', 'last_activity_date'])
            )
            ->has('recentUsers.0', fn (Assert $user) => $user
                ->hasAll(['name', 'email', 'created_at', 'email_verified_at', 'streak', 'last_activity_date'])
            )
        );
});

test('az admin-oldal válaszában nem szerepel a stripe_id és a számlázási adat', function () {
    $response = $this->actingAs($this->admin)->get(route('admin'));

    $props = json_encode($response->viewData('page')['props']);

    expect($props)
        ->not->toContain('cus_secret123')
        ->not->toContain('billing_');
});

/**
 * Az accessUsers szerveroldalon keresett és lapozott (F9C-L4): korábban minden
 * /admin-betöltés a teljes userbázist (név + e-mail) küldte a böngészőbe.
 */
test('az accessUsers lapozott, és csak a megjelenítéshez kellő mezőket küldi', function () {
    User::factory()->count(AdminDashboardService::ACCESS_USERS_PER_PAGE + 5)->create();
    $totalUsers = User::count();

    $this->actingAs($this->admin)
        ->get(route('admin'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('accessSearch', '')
            ->has('accessUsers.data', AdminDashboardService::ACCESS_USERS_PER_PAGE)
            ->where('accessUsers.total', $totalUsers)
            ->where('accessUsers.current_page', 1)
            ->has('accessUsers.data.0', fn (Assert $user) => $user
                ->hasAll(['id', 'name', 'email', 'plan', 'plan_override', 'subscribed', 'subscription_plan', 'trial_ends_at'])
            )
        );
});

test('az accessUsers második oldala a maradékot adja', function () {
    User::factory()->count(AdminDashboardService::ACCESS_USERS_PER_PAGE + 5)->create();
    $remaining = User::count() - AdminDashboardService::ACCESS_USERS_PER_PAGE;

    $this->actingAs($this->admin)
        ->get(route('admin', ['access_page' => 2]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('accessUsers.data', $remaining)
            ->where('accessUsers.current_page', 2)
        );
});

test('az accessUsers név vagy e-mail szerint keres a szerveren', function () {
    User::factory()->count(10)->create();
    $byName = User::factory()->create(['name' => 'Kovács Zsuzsanna']);
    $byEmail = User::factory()->create(['name' => 'Zoltán Teszt', 'email' => 'zsuzsi.teszt@example.org']);

    $this->actingAs($this->admin)
        ->get(route('admin', ['access_search' => 'zsuzs']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('accessSearch', 'zsuzs')
            ->where('accessUsers.total', 2)
            ->where('accessUsers.data.0.id', $byName->id)
            ->where('accessUsers.data.1.id', $byEmail->id)
        );
});

test('a keresőben a LIKE-helyettesítők szó szerint értendők', function () {
    User::factory()->create(['name' => 'Valaki Más']);

    $this->actingAs($this->admin)
        ->get(route('admin', ['access_search' => '%']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('accessUsers.total', 0));
});

test('a partial reload csak a userlistát kéri le', function () {
    $this->actingAs($this->admin)
        ->get(route('admin', ['access_search' => 'admin']), [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => app(HandleInertiaRequests::class)->version(request()),
            'X-Inertia-Partial-Component' => 'admin/index',
            'X-Inertia-Partial-Data' => 'accessUsers,accessSearch',
        ])
        ->assertOk()
        ->assertJsonPath('props.accessUsers.total', 1)
        ->assertJsonPath('props.accessSearch', 'admin')
        ->assertJsonMissingPath('props.stats')
        ->assertJsonMissingPath('props.reports');
});
