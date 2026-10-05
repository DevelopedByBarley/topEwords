<?php

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardSetting;
use App\Models\User;
use App\Models\Word;
use App\Services\FlashcardSrsService;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Tests\TestCase;

function loadDueCounts(TestCase $test): array
{
    $test->get(route('flashcards.index'))->assertOk();

    return $test->get(route('flashcards.index'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => Inertia::getVersion(),
        'X-Inertia-Partial-Component' => 'flashcards/index',
        'X-Inertia-Partial-Data' => 'dueCounts',
    ])->json('props.dueCounts');
}

test('the deck list exposes the next due timestamp per deck', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Scheduled Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back']);

    FlashcardReview::create([
        'flashcard_id' => $card->id, 'direction' => 'front_to_back',
        'state' => 'review', 'due_at' => now()->addDays(3),
    ]);
    $other = Flashcard::create(['deck_id' => $deck->id, 'front' => 'C', 'back' => 'D', 'direction' => 'front_to_back']);
    FlashcardReview::create([
        'flashcard_id' => $other->id, 'direction' => 'front_to_back',
        'state' => 'review', 'due_at' => now()->addHours(5),
    ]);

    $test = $this->actingAs($user);
    $test->get(route('flashcards.index'))->assertOk();

    $nextDueAt = $test->get(route('flashcards.index'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => Inertia::getVersion(),
        'X-Inertia-Partial-Component' => 'flashcards/index',
        'X-Inertia-Partial-Data' => 'nextDueAt',
    ])->json('props.nextDueAt');

    expect($nextDueAt[$deck->id])
        ->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/')
        ->and(Carbon::parse($nextDueAt[$deck->id])->diffInHours(now(), true))->toBeLessThan(6);
});

test('the deck page exposes the next due timestamp as offset-aware ISO8601', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Scheduled Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back']);
    FlashcardReview::create([
        'flashcard_id' => $card->id, 'direction' => 'front_to_back',
        'state' => 'review', 'due_at' => now()->addHours(2),
    ]);

    $this->actingAs($user)
        ->get(route('flashcards.show', $deck))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where(
            'nextDueAt',
            fn ($value) => (bool) preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/', $value),
        ));
});

test('the deck page reports a null next due date when nothing is scheduled', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Fresh Deck']);
    Flashcard::create(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back']);

    $this->actingAs($user)
        ->get(route('flashcards.show', $deck))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('nextDueAt', null));
});

test('due count excludes uncalibrated imported cards', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Import Deck']);

    Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'A', 'back' => 'B', 'direction' => 'front_to_back', 'is_imported' => true]);
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

    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->put(route('flashcards.settings.update', $deck), [...$base, 'learning_steps' => [10, 10]])
        ->assertSessionHasErrors(['learning_steps.1']);

    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->put(route('flashcards.settings.update', $deck), [...$base, 'learning_steps' => [10, 5]])
        ->assertSessionHasErrors(['learning_steps.1']);

    expect($deck->fresh()->deckSettings)->toBeNull();

    $this->actingAs($user)
        ->put(route('flashcards.settings.update', $deck), [...$base, 'learning_steps' => [1, 10]])
        ->assertSessionHasNoErrors();

    expect($deck->fresh()->deckSettings->learning_steps)->toBe([1, 10]);
});

test('hard never exceeds good even for a legacy non-increasing learning-step config', function () {
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
        expect($hard)->toBeGreaterThanOrEqual($settings->learning_steps[0]);
    }
});

test('deck shuffle_cards can be turned off (unchecked checkbox)', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $deck->deckSettings()->create(['shuffle_cards' => true]);

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

test('user can rename their own deck without leaving the current page', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Old name', 'description' => 'Old description']);

    $this->actingAs($user)
        ->from(route('flashcards.index'))
        ->patch(route('flashcards.update', $deck), [
            'name' => 'New name',
            'description' => 'New description',
        ])
        ->assertRedirect(route('flashcards.index'));

    $deck->refresh();

    expect($deck->name)->toBe('New name')
        ->and($deck->description)->toBe('New description');
});

test('user cannot rename someone elses deck', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $owner->id, 'name' => 'Owned']);

    $this->actingAs($other)
        ->patch(route('flashcards.update', $deck), ['name' => 'Hijacked'])
        ->assertForbidden();

    expect($deck->fresh()->name)->toBe('Owned');
});

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

test('store ignores a smuggled is_imported flag from the request payload', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.store', $deck), [
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
            'is_imported' => true,
        ])
        ->assertRedirect(route('flashcards.show', $deck));

    expect((bool) $deck->flashcards()->first()->is_imported)->toBeFalse();
});

test('update ignores a smuggled is_imported flag from the request payload', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both']);

    $this->actingAs($user)
        ->patch(route('flashcards.cards.update', [$deck, $card]), [
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
            'is_imported' => true,
        ])
        ->assertRedirect(route('flashcards.show', $deck));

    expect((bool) $card->fresh()->is_imported)->toBeFalse();
});

test('csv import still marks cards as imported after is_imported left the fillable', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $file = UploadedFile::fake()->createWithContent('cards.csv', "apple,alma\npear,körte\n");

    $this->actingAs($user)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $file])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($deck->flashcards()->count())->toBe(2)
        ->and($deck->flashcards()->where('is_imported', true)->count())->toBe(2);
});

test('calibration graduates an imported card by clearing is_imported', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'front_to_back', 'is_imported' => true]);

    $this->actingAs($user)
        ->postJson(route('flashcards.calibrate.rate', $deck), [
            'flashcard_id' => $card->id,
            'rating' => 3,
            'direction' => 'front_to_back',
            'is_last_direction' => true,
        ])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect((bool) $card->fresh()->is_imported)->toBeFalse();
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

test('bulk reverse marks the reversed copies as imported so they enter calibration first', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'front_to_back', 'is_imported' => false]);

    $this->actingAs($user)
        ->post(route('flashcards.cards.bulk-reverse', $deck), ['ids' => [$card->id]])
        ->assertRedirect(route('flashcards.show', $deck));

    $reversed = $deck->flashcards()->where('front', 'alma')->first();
    expect($reversed)->not->toBeNull()
        ->and((bool) $reversed->is_imported)->toBeTrue();
});

test('bulk direction change to one-way deletes the now-orphaned opposite review', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both']);
    FlashcardReview::create(['flashcard_id' => $card->id, 'direction' => 'front_to_back', 'state' => 'review']);
    FlashcardReview::create(['flashcard_id' => $card->id, 'direction' => 'back_to_front', 'state' => 'review']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.bulk-direction', $deck), ['ids' => [$card->id], 'direction' => 'front_to_back'])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($card->reviews()->pluck('direction')->all())->toBe(['front_to_back']);
});

test('bulk direction change to both keeps every review', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'front_to_back']);
    FlashcardReview::create(['flashcard_id' => $card->id, 'direction' => 'front_to_back', 'state' => 'review']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.bulk-direction', $deck), ['ids' => [$card->id], 'direction' => 'both'])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($card->reviews()->count())->toBe(1);
});

test('resetting an imported card keeps it in the calibration queue', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both', 'is_imported' => true]);
    FlashcardReview::create(['flashcard_id' => $card->id, 'direction' => 'front_to_back', 'state' => 'review']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.reset', [$deck, $card]))
        ->assertRedirect(route('flashcards.show', $deck));

    expect((bool) $card->fresh()->is_imported)->toBeTrue()
        ->and($card->reviews()->count())->toBe(0);
});

test('resetting a manually created card does not force it into calibration', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both', 'is_imported' => false]);
    FlashcardReview::create(['flashcard_id' => $card->id, 'direction' => 'front_to_back', 'state' => 'review']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.reset', [$deck, $card]))
        ->assertRedirect(route('flashcards.show', $deck));

    expect((bool) $card->fresh()->is_imported)->toBeFalse()
        ->and($card->reviews()->count())->toBe(0);
});

test('bulk reset preserves each card imported flag', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $imported = Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'both', 'is_imported' => true]);
    $manual = Flashcard::forceCreate(['deck_id' => $deck->id, 'front' => 'pear', 'back' => 'körte', 'direction' => 'both', 'is_imported' => false]);
    FlashcardReview::create(['flashcard_id' => $imported->id, 'direction' => 'front_to_back', 'state' => 'review']);
    FlashcardReview::create(['flashcard_id' => $manual->id, 'direction' => 'front_to_back', 'state' => 'review']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.bulk-reset', $deck), ['ids' => [$imported->id, $manual->id]])
        ->assertRedirect(route('flashcards.show', $deck));

    expect((bool) $imported->fresh()->is_imported)->toBeTrue()
        ->and((bool) $manual->fresh()->is_imported)->toBeFalse()
        ->and($imported->reviews()->count())->toBe(0)
        ->and($manual->reviews()->count())->toBe(0);
});

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
        'learning_step' => 1,
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $srs = new FlashcardSrsService;
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
    expect($review->interval)->toBe(1);
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

    $method = new ReflectionMethod($srs, 'reviewAgain');
    $method->invoke($srs, $review, $settings);

    expect($review->state)->toBe('relearning');
    expect($review->interval)->toBe(50);
    expect($review->ease_factor)->toBe(210);

    $learningGood = new ReflectionMethod($srs, 'learningGood');
    $learningGood->invoke($srs, $review, $settings->learning_steps, $settings);

    expect($review->state)->toBe('relearning');
    expect($review->learning_step)->toBe(1);

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
        'lapses' => 2,
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
        'learning_steps' => [1, 1440],
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
        'learning_step' => 1,
        'interval' => 0,
        'ease_factor' => 250,
        'repetitions' => 0,
        'lapses' => 0,
    ]);

    $srs = new FlashcardSrsService;

    $preview = $srs->getButtonPreviews($review, $settings);

    $method = new ReflectionMethod($srs, 'learningGood');
    $method->invoke($srs, $review, $settings->learning_steps, $settings);

    expect($preview['good'])->toBe('3 nap');
    expect($review->interval)->toBe(3);
});

test('hard and good never collapse to the same interval when the last learning step is a full day', function () {
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [1, 10, 1440],
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
        'learning_step' => 2,
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
    $settings = new FlashcardSetting([
        'new_cards_per_day' => 20,
        'max_reviews_per_day' => 200,
        'learning_steps' => [10, 958],
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
        'learning_step' => 1,
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

    expect($format->invoke($srs, 1439))->toBe('1 nap');
    expect($format->invoke($srs, 1436))->toBe('23.9 óra');
    expect($format->invoke($srs, 1380))->toBe('23 óra');
});

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

    $preview = $srs->getButtonPreviews($makeReview(), $settings);
    expect($preview['hard'])->toBe($hardReview->interval.' nap');
    expect($preview['good'])->toBe($goodReview->interval.' nap');
    expect($preview['easy'])->toBe($easyReview->interval.' nap');
})->with([1, 2, 3, 4, 10]);

test('good stays above hard even when a low interval modifier pushes its raw value below', function () {
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
        'learning_step' => 1,
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

    $review = $srs->getOrCreateReview($card, 'front_to_back');
    $srs->processReview($review, FlashcardSrsService::GOOD, $settings);

    $due = $srs->getDueCards($deck->id, $settings);

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

    $makeCard = fn (array $attributes) => Flashcard::forceCreate(array_merge(
        ['deck_id' => $deck->id, 'front' => uniqid(), 'back' => 'x', 'direction' => 'front_to_back'],
        $attributes,
    ));

    $introducedToday = $makeCard(['direction' => 'both']);
    FlashcardReview::create(['flashcard_id' => $introducedToday->id, 'direction' => 'front_to_back', 'state' => 'learning', 'due_at' => now()->addHour(), 'introduced_on' => $today]);

    $makeCard([]);
    $makeCard(['direction' => 'both']);
    $makeCard([]);

    $makeCard(['is_imported' => true]);

    $importedHalfCalibrated = $makeCard(['direction' => 'both', 'is_imported' => true]);
    FlashcardReview::create(['flashcard_id' => $importedHalfCalibrated->id, 'direction' => 'front_to_back', 'state' => 'new']);

    $makeCard([]);

    $learningDue = $makeCard([]);
    FlashcardReview::create(['flashcard_id' => $learningDue->id, 'direction' => 'front_to_back', 'state' => 'learning', 'due_at' => now()->subMinute(), 'introduced_on' => $yesterday]);

    foreach (range(1, 2) as $i) {
        $reviewDue = $makeCard([]);
        FlashcardReview::create(['flashcard_id' => $reviewDue->id, 'direction' => 'front_to_back', 'state' => 'review', 'due_at' => now()->subMinute(), 'introduced_on' => $yesterday]);
    }

    $reviewedToday = $makeCard([]);
    FlashcardReview::create(['flashcard_id' => $reviewedToday->id, 'direction' => 'front_to_back', 'state' => 'review', 'due_at' => now()->addDay(), 'introduced_on' => $yesterday, 'reviewed_on' => $today]);

    $staleDirection = $makeCard([]);
    FlashcardReview::create(['flashcard_id' => $staleDirection->id, 'direction' => 'back_to_front', 'state' => 'review', 'due_at' => now()->subMinute()]);

    $counts = $srs->countDueCards($deck->id, $settings);
    $queue = $srs->getDueCards($deck->id, $settings);

    expect($counts['new'])->toBe(6)
        ->and($counts['review'])->toBe(2)
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

test('import from word answers a json request with the new card instead of redirecting', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $word = Word::create(['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1]);

    $response = $this->actingAs($user)
        ->postJson(route('flashcards.cards.import', $deck), ['word_id' => $word->id])
        ->assertCreated();

    $card = $deck->flashcards()->sole();

    expect($response->json('card_id'))->toBe($card->id)
        ->and($card->word_id)->toBe($word->id)
        ->and($card->front)->toBe('apple')
        ->and($card->back)->toBe('alma');
});

test('import from custom word answers a json request with the new card', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $customWord = $user->customWords()->create(['word' => 'gizmo', 'meaning_hu' => 'kütyü']);

    $this->actingAs($user)
        ->postJson(route('flashcards.cards.import', $deck), ['custom_word_id' => $customWord->id])
        ->assertCreated();

    expect($deck->flashcards()->sole()->front)->toBe('gizmo');
});

test('json import from word reports the card limit as a json error', function () {
    config(['plans.limits.free.flashcards' => 0]);

    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $word = Word::create(['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1]);

    $this->actingAs($user)
        ->postJson(route('flashcards.cards.import', $deck), ['word_id' => $word->id])
        ->assertForbidden()
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'kártyakeret'));

    expect($deck->flashcards()->count())->toBe(0);
});

test('json import into another user deck is forbidden', function () {
    $owner = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $owner->id, 'name' => 'Deck']);
    $word = Word::create(['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('flashcards.cards.import', $deck), ['word_id' => $word->id])
        ->assertForbidden();

    expect($deck->flashcards()->count())->toBe(0);
});
