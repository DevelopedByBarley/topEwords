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
        ['word' => 'the', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'of', 'rank' => 500, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'moderate', 'rank' => 3000, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'elaborate', 'rank' => 7500, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $beginner = Word::where('rank', 1)->first();
    $intermediate = Word::where('rank', 3000)->first();
    $user->knownWords()->attach($beginner->id, ['status' => 'known']);
    $user->knownWords()->attach($intermediate->id, ['status' => 'learning']);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->has('levelStats', 3)
            ->where('totalKnown', 1)
            ->where('levelStats.0.label', 'Kezdő')
            ->where('levelStats.0.known', 1)
            ->where('levelStats.0.learning', 0)
            ->where('levelStats.1.label', 'Középhaladó')
            ->where('levelStats.1.learning', 1)
            ->where('levelStats.2.label', 'Haladó')
            ->where('levelStats.2.known', 0)
        );
});
