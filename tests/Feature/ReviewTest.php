<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('completing a review marks own words as reviewed today', function () {
    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);
    $word = Word::first();
    $this->user->knownWords()->attach($word->id, ['status' => 'learning']);

    $custom = $this->user->customWords()->create(['word' => 'sajátszó', 'status' => 'learning']);

    $this->postJson(route('review.complete'), [
        'ids' => [(string) $word->id, 'custom_'.$custom->id],
    ])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);

    expect(DB::table('user_word')->where('user_id', $this->user->id)->where('word_id', $word->id)->value('reviewed_at'))
        ->toBe(today()->toDateString())
        ->and(DB::table('user_custom_words')->where('id', $custom->id)->value('reviewed_at'))
        ->toBe(today()->toDateString());
});

test('F1-L8: review complete rejects more ids than a session can contain', function () {
    // A kör legfeljebb 50 szót ad ki (MAX_PER_SESSION) — 51 id-nek 422 jár,
    // a korlátlan whereIn-t a validációs plafon fogja meg.
    $ids = array_map(fn (int $i) => (string) $i, range(1, 51));

    $this->postJson(route('review.complete'), ['ids' => $ids])
        ->assertStatus(422)
        ->assertJsonValidationErrors('ids');
});

test('F1-L8: review complete rejects oversized id strings', function () {
    $this->postJson(route('review.complete'), ['ids' => [str_repeat('a', 33)]])
        ->assertStatus(422)
        ->assertJsonValidationErrors('ids.0');
});

test('F1-L8/L9: review routes carry a throttle limiter', function () {
    $expected = [
        'review.index' => 'throttle:60,1,words-play',
        'review.complete' => 'throttle:30,1,words-review',
    ];

    foreach ($expected as $name => $middleware) {
        $route = Route::getRoutes()->getByName($name);

        expect($route)->not->toBeNull()
            ->and($route->middleware())->toContain($middleware);
    }
});

test('the review page renders', function () {
    $this->get(route('review.index'))->assertOk();
});
