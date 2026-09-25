<?php

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/*
 * Őrszem a túlméretes tömbök elleni védelemre (F9D-L1, F6-L2, F6-L3).
 * A Laravel a `foo.*` szabályokat a validáció ELŐTT elemenként kibontja,
 * négyzetes költséggel, ezért a szabálylistában lévő `max:` nem véd: a
 * méretet külön, előzetes lépésben kell ellenőrizni. A tesztek ezért nem
 * csak a státuszt, hanem az IDŐT is rögzítik.
 */

const OVERSIZED_COUNT = 20_000;
// A javítás előtt 20 000 elem 17 s fölött futott, utána ~0,1–0,5 s. A 3 s-os
// küszöb egyértelműen elválasztja a kettőt, és tűri a hideg indulást is.
const MAX_ALLOWED_MS = 3_000;

function elapsedMs(Closure $callback): float
{
    $start = hrtime(true);
    $callback();

    return (hrtime(true) - $start) / 1e6;
}

dataset('bulk card routes', [
    'bulk-delete' => ['flashcards.cards.bulk-delete', []],
    'bulk-reset' => ['flashcards.cards.bulk-reset', []],
    'bulk-reverse' => ['flashcards.cards.bulk-reverse', []],
    'bulk-direction' => ['flashcards.cards.bulk-direction', ['direction' => 'both']],
    'bulk-move' => ['flashcards.cards.bulk-move', ['target_deck_id' => 'TARGET']],
]);

test('a bulk card action rejects an oversized ids array quickly and changes nothing', function (string $routeName, array $extra) {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $target = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Target']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'front_to_back']);

    $extra = array_map(fn ($value) => $value === 'TARGET' ? $target->id : $value, $extra);
    $ids = array_merge([$card->id], range(1_000_000, 1_000_000 + OVERSIZED_COUNT));

    $ms = elapsedMs(fn () => $this->actingAs($user)
        ->post(route($routeName, $deck), ['ids' => $ids, ...$extra])
        ->assertRedirect()
        ->assertSessionHas('error'));

    expect($ms)->toBeLessThan(MAX_ALLOWED_MS)
        ->and(Flashcard::count())->toBe(1)
        ->and($card->fresh()->deck_id)->toBe($deck->id);
})->with('bulk card routes');

test('a bulk card action still accepts an ids array at the limit', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'front_to_back']);

    $ids = array_merge([$card->id], range(1_000_000, 1_000_000 + 5_000 - 2));

    $ms = elapsedMs(fn () => $this->actingAs($user)
        ->post(route('flashcards.cards.bulk-delete', $deck), ['ids' => $ids])
        ->assertRedirect(route('flashcards.show', $deck))
        ->assertSessionHas('success', '1 kártya törölve.'));

    expect($ms)->toBeLessThan(MAX_ALLOWED_MS)
        ->and(Flashcard::count())->toBe(0);
});

test('a bulk card action one id over the limit is rejected', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);
    $card = Flashcard::create(['deck_id' => $deck->id, 'front' => 'apple', 'back' => 'alma', 'direction' => 'front_to_back']);

    $ids = array_merge([$card->id], range(1_000_000, 1_000_000 + 5_000 - 1));

    $this->actingAs($user)
        ->post(route('flashcards.cards.bulk-delete', $deck), ['ids' => $ids])
        ->assertSessionHas('error', 'Egyszerre legfeljebb 5 000 kártyán végezhető tömeges művelet.');

    expect(Flashcard::count())->toBe(1);
});

test('the bulk card actions share a per-minute rate limit with a friendly flash message', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    // A keret az öt végponton közös, ezért váltakozva hívjuk őket.
    $routes = ['flashcards.cards.bulk-delete', 'flashcards.cards.bulk-reset', 'flashcards.cards.bulk-reverse'];

    for ($i = 0; $i < 30; $i++) {
        $this->actingAs($user)
            ->post(route($routes[$i % 3], $deck), ['ids' => [1]])
            ->assertRedirect(route('flashcards.show', $deck));
    }

    $this->actingAs($user)
        ->from(route('flashcards.show', $deck))
        ->withHeader('X-Inertia', 'true')
        ->post(route('flashcards.cards.bulk-direction', $deck), ['ids' => [1], 'direction' => 'both'])
        ->assertRedirect(route('flashcards.show', $deck))
        ->assertSessionHas('error', fn (string $message) => str_starts_with($message, 'Túl gyorsan érkeztek a kérések'));
});

test('practice check rejects an oversized words array quickly without calling the AI', function () {
    Http::fake();
    $user = User::factory()->create(['ai_access' => true]);

    $words = array_fill(0, OVERSIZED_COUNT, ['word' => 'dog', 'meaning_hu' => 'kutya']);

    $ms = elapsedMs(fn () => $this->actingAs($user)
        ->postJson(route('words.practice.check'), [
            'words' => $words,
            'text' => 'I walk my dog every day.',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('words'));

    expect($ms)->toBeLessThan(MAX_ALLOWED_MS);
    Http::assertNothingSent();
});

test('onboarding rejects oversized id arrays quickly with a constant number of queries', function () {
    $user = User::factory()->withoutOnboarding()->create();
    $ids = range(1, OVERSIZED_COUNT);

    DB::enableQueryLog();

    $ms = elapsedMs(fn () => $this->actingAs($user)
        ->post(route('onboarding.complete'), [
            'known_word_ids' => $ids,
            'shown_word_ids' => $ids,
        ])
        ->assertSessionHasErrors(['known_word_ids', 'shown_word_ids']));

    expect($ms)->toBeLessThan(MAX_ALLOWED_MS)
        ->and(count(DB::getQueryLog()))->toBeLessThan(10)
        ->and($user->fresh()->onboarding_completed_at)->toBeNull();
});

test('onboarding checks word ids with a single query and still rejects unknown ids', function () {
    $user = User::factory()->withoutOnboarding()->create();
    $words = collect(range(1, 100))->map(fn (int $rank) => Word::create([
        'word' => 'word'.$rank,
        'meaning_hu' => 'szó'.$rank,
        'rank' => $rank,
    ]));
    $ids = $words->pluck('id')->all();

    DB::enableQueryLog();

    $this->actingAs($user)
        ->post(route('onboarding.complete'), [
            'known_word_ids' => $ids,
            'shown_word_ids' => $ids,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('dashboard', absolute: false));

    $queries = collect(DB::getQueryLog())->pluck('query');
    $perIdExistsQueries = $queries->filter(fn (string $query) => str_contains($query, 'from "words" where "id" = ?'));

    // A régi `exists:words,id` szabály id-nként egy lekérdezést futtatott (itt 200-at).
    expect($perIdExistsQueries)->toBeEmpty()
        ->and($queries->count())->toBeLessThan(50)
        ->and(DB::table('user_word')->where('user_id', $user->id)->count())->toBe(100);

    $otherUser = User::factory()->withoutOnboarding()->create();

    $this->actingAs($otherUser)
        ->post(route('onboarding.complete'), [
            'known_word_ids' => [$ids[0], 999_999],
            'shown_word_ids' => [$ids[0]],
        ])
        ->assertSessionHasErrors('known_word_ids');

    expect($otherUser->fresh()->onboarding_completed_at)->toBeNull();
});

test('flashcard settings reject an oversized learning steps array quickly', function (string $method, Closure $url) {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $ms = elapsedMs(fn () => $this->actingAs($user)
        ->{$method}($url($deck), [
            'new_cards_per_day' => 20,
            'max_reviews_per_day' => 200,
            'learning_steps' => range(1, OVERSIZED_COUNT),
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
        ->assertSessionHasErrors('learning_steps'));

    expect($ms)->toBeLessThan(MAX_ALLOWED_MS);
})->with([
    'global settings' => ['put', fn () => route('flashcard-settings.update')],
    'deck settings' => ['put', fn (FlashcardDeck $deck) => route('flashcards.settings.update', $deck)],
]);
