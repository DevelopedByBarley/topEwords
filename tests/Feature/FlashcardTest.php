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
    $hard->invoke($srs, $review, $settings->learning_steps);
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
