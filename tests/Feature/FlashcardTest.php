<?php

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardSetting;
use App\Models\User;
use App\Services\FlashcardSrsService;
use Inertia\Inertia;
use Tests\TestCase;

// --- Deck CRUD ---

/**
 * Load the deferred `dueCounts` prop via an Inertia partial reload.
 */
function loadDueCounts(TestCase $test): array
{
    // Warm-up request so the Inertia asset version (Vite manifest hash) resolves.
    $test->get(route('flashcards.index'))->assertOk();

    return $test->get(route('flashcards.index'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => Inertia::getVersion(),
        'X-Inertia-Partial-Component' => 'flashcards/index',
        'X-Inertia-Partial-Data' => 'dueCounts',
    ])->json('props.dueCounts');
}

test('due count excludes uncalibrated imported cards', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Import Deck']);

    // An imported card with no review is pending calibration — not study-able yet.
    Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back', 'is_imported' => true]);
    // A normal new card is study-able.
    Flashcard::create(['deck_id' => $deck->id, 'front' => 'C', 'back' => 'D', 'direction' => 'front_to_back']);

    $dueCounts = loadDueCounts($this->actingAs($user));

    expect($dueCounts[$deck->id])->toBe(1);
});

test('due count respects the per-deck new cards daily limit', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Limited Deck']);
    $deck->deckSettings()->create(['new_cards_per_day' => 1]);

    foreach (['A', 'B', 'C'] as $front) {
        Flashcard::create(['deck_id' => $deck->id, 'front' => $front, 'back' => 'x', 'direction' => 'front_to_back']);
    }

    $dueCounts = loadDueCounts($this->actingAs($user));

    expect($dueCounts[$deck->id])->toBe(1);
});

test('a deck can get its own custom settings overriding the global defaults', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    // No per-deck override exists yet.
    expect($deck->deckSettings)->toBeNull();

    $this->actingAs($user)
        ->put(route('flashcards.settings.update', $deck), [
            'new_cards_per_day' => 5,
            'max_reviews_per_day' => 100,
            'learning_steps' => [1, 10, 1440],
            'graduating_interval' => 2,
            'easy_interval' => 7,
            'starting_ease' => 250,
            'easy_bonus' => 130,
            'hard_interval_modifier' => 120,
            'interval_modifier' => 90,
            'max_interval' => 200,
            'lapse_new_interval' => 0,
            'leech_threshold' => 8,
            // shuffle_cards omitted = unchecked → off for this deck, even though default is on
        ])
        ->assertRedirect(route('flashcards.show', $deck));

    $settings = $deck->fresh()->deckSettings;
    expect($settings)->not->toBeNull();
    expect($settings->new_cards_per_day)->toBe(5);
    expect($settings->learning_steps)->toBe([1, 10, 1440]);
    expect($settings->shuffle_cards)->toBeFalse();
});

test('a learning step above 1440 minutes is rejected on the indexed error key', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    // "2 nap" a paklidialógusban = 2880 perc — a hibának az elem-szintű
    // learning_steps.1 kulcson kell jönnie, mert a frontend azt jeleníti meg.
    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->put(route('flashcards.settings.update', $deck), [
            'new_cards_per_day' => 20,
            'max_reviews_per_day' => 200,
            'learning_steps' => [10, 2880],
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
        ->assertSessionHasErrors(['learning_steps.1'])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($deck->fresh()->deckSettings)->toBeNull();
});

test('non-increasing learning steps are rejected so hard cannot meet or exceed good', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $base = [
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'graduating_interval' => 1,
        'easy_interval' => 4,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 0,
        'leech_threshold' => 8,
    ];

    // Equal consecutive steps: the second step must be strictly greater.
    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->put(route('flashcards.settings.update', $deck), [...$base, 'learning_steps' => [10, 10]])
        ->assertSessionHasErrors(['learning_steps.1']);

    // Descending steps: rejected on the offending index.
    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->put(route('flashcards.settings.update', $deck), [...$base, 'learning_steps' => [10, 5]])
        ->assertSessionHasErrors(['learning_steps.1']);

    expect($deck->fresh()->deckSettings)->toBeNull();

    // A strictly increasing config still saves.
    $this->actingAs($user)
        ->put(route('flashcards.settings.update', $deck), [...$base, 'learning_steps' => [1, 10]])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->deckSettings->learning_steps)->toBe([1, 10]);
});

test('hard never exceeds good even for a legacy non-increasing learning-step config', function () {
    // Decks saved before the increasing-steps validation existed may still hold
    // [10, 10]; the scheduler must never schedule Hard past Good for them.
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [10, 10],
        'graduating_interval' => 1,
        'easy_interval' => 2,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 0,
        'leech_threshold' => 8,
    ]);

    $srs = new FlashcardSrsService;
    $hardM = new ReflectionMethod($srs, 'learningHardMinutes');
    $goodM = new ReflectionMethod($srs, 'learningGoodMinutes');

    foreach ([0, 1] as $step) {
        $review = new FlashcardReview([
            'state' => 'learning',
            'learning_step' => $step,
            'interval' => 0,
            'ease_factor' => 250,
            'repetitions' => 0,
            'lapses' => 0,
        ]);

        $hard = $hardM->invoke($srs, $review, $settings->learning_steps, $settings);
        $good = $goodM->invoke($srs, $review, $settings->learning_steps, $settings);

        expect($hard)->toBeLessThanOrEqual($good);
        expect($hard)->toBeGreaterThanOrEqual($settings->learning_steps[0]); // never below Again
    }
});

test('deck shuffle_cards can be turned off (unchecked checkbox)', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $deck->deckSettings()->create(['shuffle_cards' => true]);

    // An unchecked checkbox is omitted by the browser — simulate by not sending it.
    $this->actingAs($user)
        ->put(route('flashcards.settings.update', $deck), [
            'new_cards_per_day' => 20,
            'max_reviews_per_day' => 200,
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
        ->assertRedirect(route('flashcards.show', $deck));

    expect($deck->deckSettings()->first()->shuffle_cards)->toBeFalse();
});

test('user can view their decks', function () {
    $user = User::factory()->create();
    FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Test Deck']);

    $this->actingAs($user)
        ->get(route('flashcards.index'))
        ->assertOk()
        ->assertInertia(fn ($p) => $p->component('flashcards/index')->has('decks', 1));
});

test('user can create a deck', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Üzleti angol'])
        ->assertRedirect();

    expect(FlashcardDeck::where('user_id', $user->id)->first()->name)->toBe('Üzleti angol');
});

test('a deck created with a folder_id is attached to that folder', function () {
    $user = User::factory()->create();
    $folder = $user->flashcardFolders()->create(['name' => 'Nyelvvizsga']);

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Szókincs', 'folder_id' => $folder->id])
        ->assertRedirect();

    $deck = FlashcardDeck::where('user_id', $user->id)->firstOrFail();
    expect($folder->decks()->pluck('flashcard_decks.id')->all())->toBe([$deck->id]);
});

test('a deck created with an empty folder_id ends up in no folder', function () {
    $user = User::factory()->create();
    $user->flashcardFolders()->create(['name' => 'Nyelvvizsga']);

    // The new-deck dialog submits folder_id as '' when no folder is selected.
    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Szókincs', 'folder_id' => ''])
        ->assertRedirect()
        ->assertSessionDoesntHaveErrors();

    expect(FlashcardDeck::where('user_id', $user->id)->firstOrFail()->folders()->count())->toBe(0);
});

test('a deck cannot be attached to another users folder', function () {
    $user = User::factory()->create();
    $otherFolder = User::factory()->create()->flashcardFolders()->create(['name' => 'Idegen']);

    $this->actingAs($user)
        ->from(route('flashcards.index'))
        ->post(route('flashcards.store'), ['name' => 'Szókincs', 'folder_id' => $otherFolder->id])
        ->assertSessionHasErrors('folder_id');

    expect(FlashcardDeck::where('user_id', $user->id)->exists())->toBeFalse();
});

test('user cannot view another users deck', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $owner->id, 'name' => 'Secret']);

    $this->actingAs($other)
        ->get(route('flashcards.show', $deck))
        ->assertForbidden();
});

test('user can delete own deck', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'To Delete']);

    $this->actingAs($user)
        ->delete(route('flashcards.destroy', $deck))
        ->assertRedirect(route('flashcards.index'));

    expect(FlashcardDeck::find($deck->id))->toBeNull();
});

// --- Card CRUD ---

test('user can add a card to their deck', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.store', $deck), [
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
        ])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($deck->flashcards()->first()->front)->toBe('apple');
});

test('user can update a card', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both']);

    $this->actingAs($user)
        ->patch(route('flashcards.cards.update', [$deck, $card]), [
            'front' => 'apple updated',
            'back' => 'alma frissítve',
            'direction' => 'front_to_back',
        ])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($card->fresh()->front)->toBe('apple updated');
});

test('user can delete a card', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both']);

    $this->actingAs($user)
        ->delete(route('flashcards.cards.destroy', [$deck, $card]))
        ->assertRedirect(route('flashcards.show', $deck));

    expect(Flashcard::find($card->id))->toBeNull();
});

test('import from word without any word id fails validation instead of erroring', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->post(route('flashcards.cards.import', $deck), [])
        ->assertRedirect(route('flashcards.show', $deck))
        ->assertSessionHasErrors('word_id');

    expect($deck->flashcards()->count())->toBe(0);
});

// --- SRS Algorithm ---

test('new card graduates to review after good on last learning step', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
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
    ]);

    $review = new FlashcardReview([
        'state' => 'learning',
        'learning_step' => 1, // last step (index 1 of [1,10])
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $srs = new FlashcardSrsService;
    // Call private method via reflection
    $method = new ReflectionMethod($srs, 'learningGood');
    $method->invoke($srs, $review, $settings->learning_steps, $settings);

    expect($review->state)->toBe('review');
    expect($review->interval)->toBe(1);
});

test('review card increases interval on good rating', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
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
    ]);

    $review = new FlashcardReview([
        'state' => 'review',
        'interval' => 10,
        'ease_factor' => 250,
        'repetitions' => 3,
        'lapses' => 0,
    ]);

    $srs = new FlashcardSrsService;
    $method = new ReflectionMethod($srs, 'reviewGood');
    $method->invoke($srs, $review, $settings);

    // interval = round(10 * 250/100 * 100/100) = 25
    expect($review->interval)->toBe(25);
    expect($review->repetitions)->toBe(4);
});

test('forgotten card increments lapses and becomes relearning', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
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
    ]);

    $review = new FlashcardReview([
        'state' => 'review',
        'interval' => 20,
        'ease_factor' => 250,
        'lapses' => 0,
    ]);

    $srs = new FlashcardSrsService;
    $method = new ReflectionMethod($srs, 'reviewAgain');
    $method->invoke($srs, $review, $settings);

    expect($review->state)->toBe('relearning');
    expect($review->lapses)->toBe(1);
    expect($review->interval)->toBe(1); // lapse_new_interval=0 → reset to 1
});

test('lapsed card keeps relearning state and preserved interval through multiple learning steps', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 10],
        'graduating_interval' => 1,
        'easy_interval' => 4,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 50,
        'leech_threshold' => 8,
    ]);

    $review = new FlashcardReview([
        'state' => 'review',
        'interval' => 100,
        'ease_factor' => 230,
        'repetitions' => 5,
        'lapses' => 0,
        'learning_step' => 0,
    ]);

    $srs = new FlashcardSrsService;

    // Forgotten: relearning with the lapse-reduced interval (100 * 50% = 50) and ease penalty.
    $method = new ReflectionMethod($srs, 'reviewAgain');
    $method->invoke($srs, $review, $settings);

    expect($review->state)->toBe('relearning');
    expect($review->interval)->toBe(50);
    expect($review->ease_factor)->toBe(210);

    // First Good on step 0 of [1, 10]: must STAY relearning, not fall back to 'learning'.
    $learningGood = new ReflectionMethod($srs, 'learningGood');
    $learningGood->invoke($srs, $review, $settings->learning_steps, $settings);

    expect($review->state)->toBe('relearning');
    expect($review->learning_step)->toBe(1);

    // Second Good graduates: the preserved interval and penalized ease must survive,
    // instead of resetting to graduating_interval / starting_ease like a new card.
    $learningGood->invoke($srs, $review, $settings->learning_steps, $settings);

    expect($review->state)->toBe('review');
    expect($review->interval)->toBe(50);
    expect($review->ease_factor)->toBe(210);
});

test('lapsed card stays relearning after again and hard ratings during relearning', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 10],
        'graduating_interval' => 1,
        'easy_interval' => 4,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 50,
        'leech_threshold' => 8,
    ]);

    $srs = new FlashcardSrsService;

    $review = new FlashcardReview([
        'state' => 'relearning',
        'interval' => 50,
        'ease_factor' => 210,
        'repetitions' => 5,
        'lapses' => 1,
        'learning_step' => 1,
    ]);

    $again = new ReflectionMethod($srs, 'learningAgain');
    $again->invoke($srs, $review, $settings->learning_steps);
    expect($review->state)->toBe('relearning');

    $hard = new ReflectionMethod($srs, 'learningHard');
    $hard->invoke($srs, $review, $settings->learning_steps, $settings);
    expect($review->state)->toBe('relearning');
});

test('card is marked as leech after exceeding leech threshold', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 10],
        'graduating_interval' => 1,
        'easy_interval' => 4,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 0,
        'leech_threshold' => 3,
    ]);

    $review = new FlashcardReview([
        'state' => 'review',
        'interval' => 5,
        'ease_factor' => 250,
        'lapses' => 2, // one more → equals threshold
    ]);

    $srs = new FlashcardSrsService;
    $method = new ReflectionMethod($srs, 'reviewAgain');
    $method->invoke($srs, $review, $settings);

    expect($review->lapses)->toBe(3);
    expect($review->is_leech)->toBeTrue();
});

test('graduating interval uses the actual last step and matches the preview', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 1440], // last step is a full day (24h)
        'graduating_interval' => 1,
        'easy_interval' => 4,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 0,
        'leech_threshold' => 8,
    ]);

    $review = new FlashcardReview([
        'state' => 'learning',
        'learning_step' => 1, // last step of [1, 1440]
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $srs = new FlashcardSrsService;

    // What the Good button promised before answering.
    $preview = $srs->getButtonPreviews($review, $settings);

    $method = new ReflectionMethod($srs, 'learningGood');
    $method->invoke($srs, $review, $settings->learning_steps, $settings);

    // Hard lands at round(1440 * 1.5 / 1440) = 2 days, so Good graduates one day beyond
    // it (3 days) to stay distinct. Preview and actual must agree.
    expect($preview['good'])->toBe('3 nap');
    expect($review->interval)->toBe(3);
});

test('hard and good never collapse to the same interval when the last learning step is a full day', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 10, 1440], // final step is a full day
        'graduating_interval' => 1,
        'easy_interval' => 2,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 0,
        'leech_threshold' => 8,
    ]);

    $review = new FlashcardReview([
        'state' => 'learning',
        'learning_step' => 2, // last step of [1, 10, 1440]
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $preview = (new FlashcardSrsService)->getButtonPreviews($review, $settings);

    expect($preview['hard'])->toBe('2 nap');
    expect($preview['good'])->toBe('3 nap');
    expect($preview['hard'])->not->toBe($preview['good']);
});

test('hard does not render as "24 óra" when good graduates to a single day', function () {
    // A ~16 h final step (958 min) whose Hard (958 × 1.5 = 1437 min) was
    // previously clamped to just under a day and rounded to "24 óra" —
    // visually identical to Good's "1 nap". The fix keeps Hard a full hour
    // below the day boundary and rolls the label to days once it hits 24 h.
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [10, 958],
        'graduating_interval' => 1, // Good graduates to exactly 1 day
        'easy_interval' => 2,
        'starting_ease' => 250,
        'easy_bonus' => 130,
        'hard_interval_modifier' => 120,
        'interval_modifier' => 100,
        'max_interval' => 365,
        'lapse_new_interval' => 0,
        'leech_threshold' => 8,
    ]);

    $review = new FlashcardReview([
        'state' => 'learning',
        'learning_step' => 1, // last step of [10, 958]
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $preview = (new FlashcardSrsService)->getButtonPreviews($review, $settings);

    expect($preview['good'])->toBe('1 nap');
    expect($preview['hard'])->toBe('23 óra');
    expect($preview['hard'])->not->toBe('24 óra');
    expect($preview['hard'])->not->toBe($preview['good']);
});

test('formatMinutes rolls near-day minute values up to days instead of "24 óra"', function () {
    $format = new ReflectionMethod(FlashcardSrsService::class, 'formatMinutes');
    $srs = new FlashcardSrsService;

    // 1436–1439 min all round to 24.0 h; they must render as "1 nap", not "24 óra".
    expect($format->invoke($srs, 1439))->toBe('1 nap');
    expect($format->invoke($srs, 1436))->toBe('23.9 óra');
    expect($format->invoke($srs, 1380))->toBe('23 óra');
});

/**
 * Default SRS settings for scheduling tests, with per-test overrides.
 */
function makeSrsSettings(array $overrides = []): FlashcardSetting
{
    return new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
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
        ...$overrides,
    ]);
}

test('review buttons stay strictly ordered for a lapsed card at the ease floor', function (int $interval) {
    // Ease at the 130 floor vs Hard's 120 modifier: rounding used to make
    // Hard and Good tie at short intervals (e.g. round(3.6) = round(3.9) = 4).
    $settings = makeSrsSettings();
    $srs = new FlashcardSrsService;

    $makeReview = fn () => new FlashcardReview([
        'state' => 'review',
        'interval' => $interval,
        'ease_factor' => 130,
        'repetitions' => 3,
        'lapses' => 2,
    ]);

    $hardReview = $makeReview();
    (new ReflectionMethod($srs, 'reviewHard'))->invoke($srs, $hardReview, $settings);

    $goodReview = $makeReview();
    (new ReflectionMethod($srs, 'reviewGood'))->invoke($srs, $goodReview, $settings);

    $easyReview = $makeReview();
    (new ReflectionMethod($srs, 'reviewEasy'))->invoke($srs, $easyReview, $settings);

    expect($goodReview->interval)->toBeGreaterThan($hardReview->interval);
    expect($easyReview->interval)->toBeGreaterThan($goodReview->interval);

    // The button previews must promise exactly what answering schedules.
    $preview = $srs->getButtonPreviews($makeReview(), $settings);
    expect($preview['hard'])->toBe($hardReview->interval.' nap');
    expect($preview['good'])->toBe($goodReview->interval.' nap');
    expect($preview['easy'])->toBe($easyReview->interval.' nap');
})->with([1, 2, 3, 4, 10]);

test('good stays above hard even when a low interval modifier pushes its raw value below', function () {
    // interval_modifier 80 + ease 130: raw Good = round(10 × 1.3 × 0.8) = 10,
    // raw Hard = round(10 × 1.2) = 12 — without ordering, Hard would beat Good.
    $settings = makeSrsSettings(['interval_modifier' => 80]);
    $srs = new FlashcardSrsService;

    $review = new FlashcardReview([
        'state' => 'review',
        'interval' => 10,
        'ease_factor' => 130,
        'repetitions' => 3,
        'lapses' => 2,
    ]);

    $preview = $srs->getButtonPreviews($review, $settings);

    (new ReflectionMethod($srs, 'reviewGood'))->invoke($srs, $review, $settings);

    expect($preview['hard'])->toBe('12 nap');
    expect($preview['good'])->toBe('13 nap');
    expect($review->interval)->toBe(13);
});

test('learning hard never overtakes the good delay with tightly spaced steps', function () {
    // 1.5 × 10 = 15 minutes would overtake the next step's 12 minutes.
    $settings = makeSrsSettings(['learning_steps' => [10, 12]]);

    $review = new FlashcardReview([
        'state' => 'learning',
        'learning_step' => 0,
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $preview = (new FlashcardSrsService)->getButtonPreviews($review, $settings);

    expect($preview['hard'])->toBe('11 perc');
    expect($preview['good'])->toBe('12 perc');
});

test('relearning easy graduates one day beyond good', function () {
    $settings = makeSrsSettings(['lapse_new_interval' => 50]);
    $srs = new FlashcardSrsService;

    $makeReview = fn () => new FlashcardReview([
        'state' => 'relearning',
        'interval' => 50,
        'ease_factor' => 210,
        'repetitions' => 5,
        'lapses' => 1,
        'learning_step' => 1, // last step of [1, 10]
    ]);

    $preview = $srs->getButtonPreviews($makeReview(), $settings);
    expect($preview['good'])->toBe('50 nap');
    expect($preview['easy'])->toBe('51 nap');

    $review = $makeReview();
    (new ReflectionMethod($srs, 'learningEasy'))->invoke($srs, $review, $settings, $settings->learning_steps);

    expect($review->state)->toBe('review');
    expect($review->interval)->toBe(51);
    expect($review->ease_factor)->toBe(210);
});

test('both-direction card shows its second side the day it was introduced even at the new limit', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'a', 'back' => 'b', 'direction' => 'both']);

    $srs = new FlashcardSrsService;
    $settings = $srs->defaultSettings();
    $settings->new_cards_per_day = 1;

    // Introduce one direction today.
    $review = $srs->getOrCreateReview($card, 'front_to_back');
    $srs->processReview($review, FlashcardSrsService::GOOD, $settings);

    $due = $srs->getDueCards($deck->id, $settings);

    // The still-new other direction must remain available — it is the same physical
    // card already counted toward today's single new-card slot.
    expect($due->contains(fn ($item) => $item['direction'] === 'back_to_front'))->toBeTrue();
});

test('countDueCards matches the study queue getDueCards builds', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $srs = new FlashcardSrsService;
    $settings = $srs->defaultSettings();
    $settings->new_cards_per_day = 5;
    $settings->max_reviews_per_day = 2;

    $today = now()->toDateString();
    $yesterday = now()->subDay()->toDateString();

    $makeCard = fn (array $attributes) => Flashcard::create(array_merge(
        ['deck_id' => $deck->id, 'front' => uniqid(), 'back' => 'x', 'direction' => 'front_to_back'],
        $attributes,
    ));

    // 'both' card introduced today: its learning direction is not yet due, its other
    // direction is still new and comes through free (pre-counted toward the limit).
    $introducedToday = $makeCard(['direction' => 'both']);
    FlashcardReview::create(['flashcard_id' => $introducedToday->id, 'direction' => 'front_to_back', 'state' => 'learning', 'due_at' => now()->addHour(), 'introduced_on' => $today]);

    // Plain new cards; the 'both' one takes a single new-card slot but yields two items.
    $makeCard([]);
    $makeCard(['direction' => 'both']);
    $makeCard([]);

    // Imported card without any review — pending calibration, excluded entirely.
    $makeCard(['is_imported' => true]);

    // Imported 'both' card with one calibrated ('new') direction: that direction counts,
    // the review-less one is still awaiting calibration.
    $importedHalfCalibrated = $makeCard(['direction' => 'both', 'is_imported' => true]);
    FlashcardReview::create(['flashcard_id' => $importedHalfCalibrated->id, 'direction' => 'front_to_back', 'state' => 'new']);

    // Fifth new-card slot is taken by the half-calibrated import — this one is over the limit.
    $makeCard([]);

    // One due learning card; two due review cards against a review budget of one
    // (a third card was already reviewed today and shrinks max_reviews_per_day).
    $learningDue = $makeCard([]);
    FlashcardReview::create(['flashcard_id' => $learningDue->id, 'direction' => 'front_to_back', 'state' => 'learning', 'due_at' => now()->subMinute(), 'introduced_on' => $yesterday]);

    foreach (range(1, 2) as $i) {
        $reviewDue = $makeCard([]);
        FlashcardReview::create(['flashcard_id' => $reviewDue->id, 'direction' => 'front_to_back', 'state' => 'review', 'due_at' => now()->subMinute(), 'introduced_on' => $yesterday]);
    }

    $reviewedToday = $makeCard([]);
    FlashcardReview::create(['flashcard_id' => $reviewedToday->id, 'direction' => 'front_to_back', 'state' => 'review', 'due_at' => now()->addDay(), 'introduced_on' => $yesterday, 'reviewed_on' => $today]);

    // Stale review on a direction the card no longer studies — ignored by the queue.
    $staleDirection = $makeCard([]);
    FlashcardReview::create(['flashcard_id' => $staleDirection->id, 'direction' => 'back_to_front', 'state' => 'review', 'due_at' => now()->subMinute()]);

    $counts = $srs->countDueCards($deck->id, $settings);
    $queue = $srs->getDueCards($deck->id, $settings);

    // free 'both' second side (1) + three plain new (1+2+1) + calibrated import side (1)
    expect($counts['new'])->toBe(6)
        // due learning (1) + due review capped at the remaining budget (1)
        ->and($counts['review'])->toBe(2)
        // and the split mirrors the hydrated queue exactly
        ->and($counts['new'])->toBe($queue->filter(fn (array $item) => ! $item['review'] || $item['review']->state === 'new')->count())
        ->and($counts['review'])->toBe($queue->filter(fn (array $item) => $item['review'] && $item['review']->state !== 'new')->count());
});

test('deck show page reports due counts without hydrating the whole deck', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    Flashcard::create(['deck_id' => $deck->id, 'front' => 'new', 'back' => 'x', 'direction' => 'front_to_back']);

    $reviewCard = Flashcard::create(['deck_id' => $deck->id, 'front' => 'due', 'back' => 'x', 'direction' => 'front_to_back']);
    FlashcardReview::create(['flashcard_id' => $reviewCard->id, 'direction' => 'front_to_back', 'state' => 'review', 'due_at' => now()->subMinute(), 'introduced_on' => now()->subDay()->toDateString()]);

    $this->actingAs($user)
        ->get(route('flashcards.show', $deck))
        ->assertInertia(fn ($page) => $page
            ->component('flashcards/show')
            ->where('newDueCount', 1)
            ->where('reviewDueCount', 1));
});
