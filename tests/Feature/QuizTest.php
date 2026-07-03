<?php

use App\Models\User;
use App\Models\UserCustomWord;
use App\Models\Word;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'pear', 'meaning_hu' => 'körte', 'rank' => 2, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'plum', 'meaning_hu' => 'szilva', 'rank' => 3, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'grape', 'meaning_hu' => 'szőlő', 'rank' => 4, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'peach', 'meaning_hu' => 'barack', 'rank' => 5, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'cherry', 'meaning_hu' => 'cseresznye', 'rank' => 6, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'nomeaning', 'meaning_hu' => null, 'rank' => 7, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

function quizProps($test, array $params = []): array
{
    return $test->get(route('words.quiz', $params))->viewData('page')['props'];
}

test('quiz setup mode returns availability and selectable words', function () {
    $this->get(route('words.quiz'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('words/quiz')
            ->where('available', 6)
            ->has('selectableWords', 6)
            ->where('words', [])
            ->where('filters.count', 0)
            ->where('filters.ids', '')
        );
});

test('quiz with count returns that many words with options containing the correct meaning', function () {
    $props = quizProps($this, ['count' => 3]);

    expect($props['words'])->toHaveCount(3);

    foreach ($props['words'] as $word) {
        expect($word['options'])->toHaveCount(4)
            ->and($word['options'])->toContain($word['meaning_hu']);
    }
});

test('quiz can be started with manually selected word ids', function () {
    $ids = Word::whereIn('word', ['apple', 'pear'])->pluck('id')->implode(',');

    $props = quizProps($this, ['ids' => $ids]);

    expect($props['words'])->toHaveCount(2)
        ->and(collect($props['words'])->pluck('word')->sort()->values()->all())->toBe(['apple', 'pear'])
        ->and($props['filters']['ids'])->toBe($ids);

    foreach ($props['words'] as $word) {
        expect($word['options'])->toHaveCount(4)
            ->and($word['options'])->toContain($word['meaning_hu']);
    }
});

test('quiz with ids includes the users own custom words', function () {
    $custom = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'doohickey',
        'meaning_hu' => 'izé',
        'status' => 'learning',
    ]);

    $props = quizProps($this, ['ids' => 'custom_'.$custom->id]);

    expect($props['words'])->toHaveCount(1)
        ->and($props['words'][0]['word'])->toBe('doohickey')
        ->and($props['words'][0]['is_custom'])->toBeTrue()
        ->and($props['words'][0]['options'])->toContain('izé');
});

test('quiz with ids ignores custom words of other users', function () {
    $custom = UserCustomWord::create([
        'user_id' => User::factory()->create()->id,
        'word' => 'secret',
        'meaning_hu' => 'titok',
        'status' => 'learning',
    ]);

    $props = quizProps($this, ['ids' => 'custom_'.$custom->id]);

    expect($props['words'])->toBeEmpty();
});

test('quiz with ids skips words without a hungarian meaning', function () {
    $ids = Word::whereIn('word', ['apple', 'nomeaning'])->pluck('id')->implode(',');

    $props = quizProps($this, ['ids' => $ids]);

    expect($props['words'])->toHaveCount(1)
        ->and($props['words'][0]['word'])->toBe('apple');
});

test('quiz respects the status filter', function () {
    $appleId = Word::where('word', 'apple')->value('id');
    $this->user->knownWords()->attach($appleId, ['status' => 'learning']);

    $props = quizProps($this, ['status' => 'learning', 'count' => 10]);

    expect($props['words'])->toHaveCount(1)
        ->and($props['words'][0]['word'])->toBe('apple');
});

test('quiz options never duplicate an answer even when meanings collide', function () {
    Word::insert(collect(range(1, 10))->map(fn (int $i) => [
        'word' => 'apple-clone-'.$i,
        'meaning_hu' => 'alma',
        'rank' => 100 + $i,
        'created_at' => now(),
        'updated_at' => now(),
    ])->all());

    $appleId = Word::where('word', 'apple')->value('id');

    $props = quizProps($this, ['ids' => (string) $appleId]);

    $options = $props['words'][0]['options'];

    expect($options)->toBe(array_values(array_unique($options)))
        ->and(array_count_values($options)['alma'])->toBe(1);
});

test('layout exposes the csrf token meta tag used by fetch posts', function () {
    // Several pages (quiz complete, review, flashcard import, text-analysis) read
    // the X-CSRF-TOKEN header value from this meta tag — without it every such
    // POST is silently rejected with 419.
    $this->get(route('words.quiz'))
        ->assertOk()
        ->assertSee('<meta name="csrf-token" content="', false);
});

test('quiz complete awards achievements and increments the counter', function () {
    $this->postJson(route('words.quiz.complete'), ['perfect' => true])
        ->assertSuccessful()
        ->assertJsonStructure(['achievements']);

    expect($this->user->fresh()->quiz_completions)->toBe(1)
        ->and($this->user->achievements()->where('achievement_key', 'quiz_perfect')->exists())->toBeTrue();
});

test('quiz complete validates the perfect flag', function () {
    $this->postJson(route('words.quiz.complete'), ['perfect' => 'not-a-bool'])
        ->assertUnprocessable();
});

test('quiz requires authentication', function () {
    auth()->logout();

    $this->get(route('words.quiz'))->assertRedirect(route('login'));
});
