<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

use function Pest\Laravel\actingAs;

test('shows the onboarding with the level test enabled by default', function () {
    config(['app.onboarding_enabled' => true]);

    $user = User::factory()->withoutOnboarding()->create();

    actingAs($user)
        ->get(route('onboarding'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('onboarding/index')
            ->where('testEnabled', true)
        );
});

test('still shows the features and theme steps when the level test is disabled', function () {
    config(['app.onboarding_enabled' => false]);

    $user = User::factory()->withoutOnboarding()->create();

    actingAs($user)
        ->get(route('onboarding'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('onboarding/index')
            ->where('testEnabled', false)
            ->where('wordsByLevel', [])
        );

    expect($user->fresh()->onboarding_completed_at)->toBeNull();
});

test('completing the onboarding marks it done and redirects to the dashboard', function () {
    $user = User::factory()->withoutOnboarding()->create();

    actingAs($user)
        ->post(route('onboarding.complete'), [
            'known_word_ids' => [],
            'shown_word_ids' => [],
        ])
        ->assertRedirect(route('dashboard', absolute: false));

    expect($user->fresh()->onboarding_completed_at)->not->toBeNull();
});
