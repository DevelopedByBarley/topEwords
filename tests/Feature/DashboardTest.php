<?php

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;
use App\Models\Word;
use Inertia\Inertia;
use Tests\TestCase;

/**
 * Load the deferred `dueFlashcards` prop via an Inertia partial reload.
 *
 * @return array{cards: int, decks: int}
 */
function loadDueFlashcards(TestCase $test): array
{
    // Warm-up request so the Inertia asset version (Vite manifest hash) resolves.
    $test->get(route('dashboard'))->assertOk();

    return $test->get(route('dashboard'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => Inertia::getVersion(),
        'X-Inertia-Partial-Component' => 'dashboard',
        'X-Inertia-Partial-Data' => 'dueFlashcards',
    ])->json('props.dueFlashcards');
}

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

test('dashboard flags the streak as pending when today has no activity yet', function () {
    $user = User::factory()->create([
        'streak' => 5,
        'last_activity_date' => now()->subDay()->toDateString(),
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            // A sorozat még él (tegnapi aktivitás), de ma még nincs meg —
            // erre épül a „ma még nem tanultál” figyelmeztetés.
            ->where('streak', 5)
            ->where('studiedToday', false)
            ->where('lastActivityDate', now()->subDay()->toDateString())
        );
});

test('dashboard reports today activity when the user already studied', function () {
    $user = User::factory()->create([
        'streak' => 3,
        'last_activity_date' => now()->toDateString(),
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('streak', 3)
            ->where('studiedToday', true)
        );
});

test('dashboard reports no activity for a brand new user', function () {
    $user = User::factory()->create(['streak' => 0, 'last_activity_date' => null]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->where('studiedToday', false)
            ->where('lastActivityDate', null)
        );
});

test('dashboard counts due flashcards across decks', function () {
    $user = User::factory()->create();

    $first = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Első']);
    Flashcard::create(['deck_id' => $first->id, 'front' => 'a', 'back' => 'b', 'direction' => 'front_to_back']);
    Flashcard::create(['deck_id' => $first->id, 'front' => 'c', 'back' => 'd', 'direction' => 'front_to_back']);

    $second = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Második']);
    Flashcard::create(['deck_id' => $second->id, 'front' => 'e', 'back' => 'f', 'direction' => 'front_to_back']);

    // Üres pakli: nincs esedékes kártyája, ezért a deck-számba sem számít bele.
    FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Üres']);

    expect(loadDueFlashcards($this->actingAs($user)))->toBe(['cards' => 3, 'decks' => 2]);
});

test('dashboard due flashcard count ignores other users decks', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $foreign = FlashcardDeck::create(['user_id' => $other->id, 'name' => 'Idegen']);
    Flashcard::create(['deck_id' => $foreign->id, 'front' => 'a', 'back' => 'b', 'direction' => 'front_to_back']);

    expect(loadDueFlashcards($this->actingAs($user)))->toBe(['cards' => 0, 'decks' => 0]);
});

test('dashboard is not slowed down by the deferred due count on first render', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        // A deferred prop az első válaszban szándékosan nincs benne.
        ->assertInertia(fn ($page) => $page->missing('dueFlashcards'));
});
