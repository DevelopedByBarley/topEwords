<?php

use App\Models\User;
use App\Models\Word;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('dashboard returns level stats and totals', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    Word::insert([
        ['word' => 'the', 'rank' => 1, 'level' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'of', 'rank' => 500, 'level' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'moderate', 'rank' => 3000, 'level' => 3, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'elaborate', 'rank' => 7500, 'level' => 4, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $beginner = Word::where('rank', 1)->first();
    $intermediate = Word::where('rank', 3000)->first();
    $user->knownWords()->attach($beginner->id, ['status' => 'known']);
    $user->knownWords()->attach($intermediate->id, ['status' => 'learning']);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->has('levelStats', 6)
            ->where('totalKnown', 1)
            ->where('levelStats.0.label', 'Top 1 000')
            ->where('levelStats.0.known', 1)
            ->where('levelStats.0.learning', 0)
            ->where('levelStats.2.label', '2 001 – 4 000')
            ->where('levelStats.2.learning', 1)
            ->where('levelStats.3.label', '4 001 – 6 000')
            ->where('levelStats.3.known', 0)
        );
});
