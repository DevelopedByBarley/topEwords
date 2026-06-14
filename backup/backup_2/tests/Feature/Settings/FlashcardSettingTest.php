<?php

use App\Models\FlashcardSetting;
use App\Models\User;

test('flashcard settings page is displayed', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('flashcard-settings.edit'))
        ->assertOk();
});

test('flashcard settings page shows defaults when no settings exist', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('flashcard-settings.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('settings/flashcards')
            ->where('settings.new_cards_per_day', 20)
            ->where('settings.max_reviews_per_day', 200)
            ->where('settings.starting_ease', 250)
        );
});

test('flashcard settings can be created', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('flashcard-settings.update'), [
            'new_cards_per_day' => 30,
            'max_reviews_per_day' => 150,
            'learning_steps' => [1, 10],
            'graduating_interval' => 2,
            'easy_interval' => 5,
            'starting_ease' => 230,
            'easy_bonus' => 140,
            'hard_interval_modifier' => 115,
            'interval_modifier' => 100,
            'max_interval' => 180,
            'lapse_new_interval' => 10,
            'leech_threshold' => 6,
        ])
        ->assertRedirect(route('flashcard-settings.edit'));

    expect($user->fresh()->flashcardSettings)
        ->new_cards_per_day->toBe(30)
        ->max_reviews_per_day->toBe(150)
        ->starting_ease->toBe(230);
});

test('flashcard settings can be updated', function () {
    $user = User::factory()->create();
    FlashcardSetting::factory()->for($user)->create(['new_cards_per_day' => 20]);

    $this->actingAs($user)
        ->put(route('flashcard-settings.update'), [
            'new_cards_per_day' => 50,
            'max_reviews_per_day' => 300,
            'learning_steps' => [1, 10],
            'graduating_interval' => 1,
            'easy_interval' => 4,
            'starting_ease' => 250,
            'easy_bonus' => 130,
            'hard_interval_modifier' => 120,
            'interval_modifier' => 100,
            'max_interval' => 365,
            'lapse_new_interval' => 0,
            'leech_threshold' => 8,
        ])
        ->assertRedirect(route('flashcard-settings.edit'));

    expect(FlashcardSetting::where('user_id', $user->id)->count())->toBe(1);
    expect($user->fresh()->flashcardSettings->new_cards_per_day)->toBe(50);
});

test('flashcard settings validation rejects invalid data', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->put(route('flashcard-settings.update'), [
            'new_cards_per_day' => 0,
            'max_reviews_per_day' => -1,
            'learning_steps' => [],
            'graduating_interval' => 0,
            'easy_interval' => 0,
            'starting_ease' => 100,
            'easy_bonus' => 50,
            'hard_interval_modifier' => 50,
            'interval_modifier' => 5,
            'max_interval' => 0,
            'lapse_new_interval' => 200,
            'leech_threshold' => 0,
        ])
        ->assertSessionHasErrors([
            'new_cards_per_day',
            'max_reviews_per_day',
            'learning_steps',
            'graduating_interval',
            'easy_interval',
            'starting_ease',
            'easy_bonus',
            'hard_interval_modifier',
            'interval_modifier',
            'max_interval',
            'lapse_new_interval',
            'leech_threshold',
        ]);
});
