<?php

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardSetting;
use App\Models\User;

test('user can view study page with due cards', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Test Deck']);
    Flashcard::create(['deck_id' => $deck->id, 'front' => 'Hello', 'back' => 'Szia', 'direction' => 'front_to_back']);

    $this->actingAs($user)
        ->get(route('flashcards.study', $deck))
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('flashcards/study')
            ->has('deck')
            ->has('cards')
        );
});

test('study page shows empty cards when none due', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Empty Deck']);

    $this->actingAs($user)
        ->get(route('flashcards.study', $deck))
        ->assertOk()
        ->assertInertia(fn ($p) => $p
            ->component('flashcards/study')
            ->has('cards', 0)
        );
});

test('user cannot study another users deck', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $owner->id, 'name' => 'Secret']);

    $this->actingAs($other)
        ->get(route('flashcards.study', $deck))
        ->assertForbidden();
});

test('user can submit a review rating', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'Hello', 'back' => 'Szia', 'direction' => 'front_to_back']);

    $this->actingAs($user)
        ->postJson(route('flashcards.study.submit', $deck), [
            'flashcard_id' => $card->id,
            'direction' => 'front_to_back',
            'rating' => 3,
        ])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect(FlashcardReview::where('flashcard_id', $card->id)->exists())->toBeTrue();
});

test('submitting again rating keeps card in learning state', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back']);

    $this->actingAs($user)
        ->postJson(route('flashcards.study.submit', $deck), [
            'flashcard_id' => $card->id,
            'direction' => 'front_to_back',
            'rating' => 1,
        ])
        ->assertOk();

    $review = FlashcardReview::where('flashcard_id', $card->id)->first();
    expect($review->state)->toBe('learning');
});

test('submitting easy rating graduates card to review state', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back']);

    $this->actingAs($user)
        ->postJson(route('flashcards.study.submit', $deck), [
            'flashcard_id' => $card->id,
            'direction' => 'front_to_back',
            'rating' => 4,
        ])
        ->assertOk();

    $review = FlashcardReview::where('flashcard_id', $card->id)->first();
    expect($review->state)->toBe('review');
});

test('user cannot submit review for another users card', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $owner->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back']);

    $this->actingAs($other)
        ->postJson(route('flashcards.study.submit', $deck), [
            'flashcard_id' => $card->id,
            'direction' => 'front_to_back',
            'rating' => 3,
        ])
        ->assertForbidden();
});

test('study respects new_cards_per_day setting', function () {
    $user = User::factory()->create();
    FlashcardSetting::factory()->for($user)->create(['new_cards_per_day' => 5]);
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    for ($i = 0; $i < 8; $i++) {
        Flashcard::create(['deck_id' => $deck->id, 'front' => "Word $i", 'back' => "Szo $i", 'direction' => 'front_to_back']);
    }

    $this->actingAs($user)
        ->get(route('flashcards.study', $deck))
        ->assertOk()
        ->assertInertia(fn ($p) => $p->has('cards', 5));
});
