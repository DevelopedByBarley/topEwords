<?php

use App\Models\Report;
use App\Models\User;
use App\Models\Word;
use Illuminate\Routing\Middleware\ThrottleRequests;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    Word::insert([
        ['word' => 'the', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

test('verified user can create a general report', function () {
    $this->post(route('report.store'), [
        'category' => 'bug',
        'description' => 'A dashboard nem tölt be.',
    ])->assertRedirect();

    $this->assertDatabaseHas('reports', [
        'user_id' => $this->user->id,
        'category' => 'bug',
        'description' => 'A dashboard nem tölt be.',
        'status' => 'open',
    ]);
});

test('verified user can create a word-specific report', function () {
    $word = Word::where('word', 'the')->firstOrFail();

    $this->post(route('report.store'), [
        'category' => 'word_data',
        'description' => 'Hibás a jelentés.',
        'word_id' => $word->id,
    ])->assertRedirect();

    $this->assertDatabaseHas('reports', [
        'user_id' => $this->user->id,
        'category' => 'word_data',
        'word_id' => $word->id,
        'status' => 'open',
    ]);
});

test('a json report gets a json receipt instead of a redirect', function () {
    // A szövegelemző szó-részletezője JSON-kérésként küldi a bejelentést: egy
    // redirect ott újrarántaná az oldalt, és a betöltött szöveg, az elemzés és a
    // könyv-lap (mind lokális kliens-state) elveszne.
    $word = Word::where('word', 'the')->firstOrFail();

    $this->postJson(route('report.store'), [
        'category' => 'word_data',
        'description' => 'Hibás a jelentés.',
        'word_id' => $word->id,
    ])
        ->assertOk()
        ->assertJson(['ok' => true]);

    $this->assertDatabaseHas('reports', [
        'user_id' => $this->user->id,
        'category' => 'word_data',
        'word_id' => $word->id,
    ]);
});

test('guest cannot create a report', function () {
    auth()->logout();

    $this->post(route('report.store'), [
        'category' => 'bug',
        'description' => 'Teszt.',
    ])->assertRedirect(route('login'));
});

test('unverified user cannot create a report', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)
        ->post(route('report.store'), [
            'category' => 'bug',
            'description' => 'Teszt.',
        ])
        ->assertRedirect(route('verification.notice'));
});

test('invalid category is rejected', function () {
    $this->post(route('report.store'), [
        'category' => 'not_a_real_category',
        'description' => 'Teszt.',
    ])->assertSessionHasErrors('category');
});

test('description over 2000 characters is rejected', function () {
    $this->post(route('report.store'), [
        'category' => 'bug',
        'description' => str_repeat('a', 2001),
    ])->assertSessionHasErrors('description');
});

test('word_data category without word_id is rejected', function () {
    $this->post(route('report.store'), [
        'category' => 'word_data',
        'description' => 'Teszt.',
    ])->assertSessionHasErrors('word_id');
});

test('nonexistent word_id is rejected', function () {
    $this->post(route('report.store'), [
        'category' => 'word_data',
        'description' => 'Teszt.',
        'word_id' => 999999,
    ])->assertSessionHasErrors('word_id');
});

test('client-sent status and user_id are ignored on create', function () {
    $otherUser = User::factory()->create();

    $this->post(route('report.store'), [
        'category' => 'bug',
        'description' => 'Teszt bejelentés.',
        'status' => 'resolved',
        'user_id' => $otherUser->id,
    ])->assertRedirect();

    $this->assertDatabaseHas('reports', [
        'user_id' => $this->user->id,
        'status' => 'open',
    ]);
});

test('report store endpoint is throttled', function () {
    for ($i = 0; $i < 10; $i++) {
        $this->post(route('report.store'), [
            'category' => 'bug',
            'description' => "Teszt bejelentés {$i}.",
        ])->assertRedirect();
    }

    $this->post(route('report.store'), [
        'category' => 'bug',
        'description' => 'Teszt bejelentés 11.',
    ])->assertStatus(429);
});

test('daily report limit is enforced', function () {
    Report::factory()->count(20)->create(['user_id' => $this->user->id]);

    $this->withoutMiddleware(ThrottleRequests::class)
        ->post(route('report.store'), [
            'category' => 'bug',
            'description' => 'Egy plusz.',
        ])->assertSessionHasErrors('description');

    expect(Report::where('user_id', $this->user->id)->count())->toBe(20);
});

test('admin can see reports on the admin index', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    Report::factory()->create(['user_id' => $this->user->id]);

    $this->actingAs($admin)
        ->get(route('admin'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('reports', 1));
});

test('admin can change a report status', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $report = Report::factory()->create(['user_id' => $this->user->id]);

    $this->actingAs($admin)
        ->patch(route('admin.reports.update-status', $report), ['status' => 'resolved'])
        ->assertRedirect();

    expect($report->refresh()->status)->toBe('resolved');
});

test('non-admin cannot reach the admin report status route', function () {
    $report = Report::factory()->create(['user_id' => $this->user->id]);

    $this->patch(route('admin.reports.update-status', $report), ['status' => 'resolved'])
        ->assertForbidden();

    expect($report->refresh()->status)->toBe('open');
});

test('admin cannot set an invalid report status', function () {
    config(['app.admin_email' => 'admin@example.com']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $report = Report::factory()->create(['user_id' => $this->user->id]);

    $this->actingAs($admin)
        ->patch(route('admin.reports.update-status', $report), ['status' => 'not_a_real_status'])
        ->assertSessionHasErrors('status');

    expect($report->refresh()->status)->toBe('open');
});
