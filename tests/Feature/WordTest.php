<?php

use App\Models\User;
use App\Models\Word;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    Word::insert([
        ['word' => 'the', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'of', 'rank' => 2, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'apple', 'rank' => 3, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'banana', 'rank' => 4, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'moderate', 'rank' => 3000, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'elaborate', 'rank' => 7500, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

test('words index page is accessible', function () {
    $this->get(route('words.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('words/index')
            ->has('words')
            ->has('stats')
            ->has('filters')
        );
});

test('words include meaning in response', function () {
    Word::where('word', 'apple')->update(['meaning_hu' => 'alma']);

    $this->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->where('words.data.0.word', 'apple')
            ->where('words.data.0.meaning_hu', 'alma')
        );
});

test('words index shows all words by default', function () {
    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.total', 6)
            ->where('stats.known', 0)
        );
});

test('words can be filtered by letter', function () {
    $this->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'apple')
        );
});

test('words can be searched', function () {
    $this->get(route('words.index', ['search' => 'ba']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'banana')
        );
});

test('setting word status to known marks it', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'known'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'known')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('setting word status to learning marks it', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'learning'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'learning')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('setting word status to saved marks it', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'saved'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'saved')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('setting the same status again removes it', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->post(route('words.status', $word), ['status' => 'known'])
        ->assertRedirect();

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('extension JSON request gets a JSON ack instead of a redirect', function () {
    $word = Word::where('word', 'the')->first();

    $this->postJson(route('words.status', $word), ['status' => 'known'])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => 'known']);

    expect($this->user->knownWords()->wherePivot('status', 'known')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('empty status removes the word (extension un-toggle)', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'saved']);

    $this->postJson(route('words.status', $word), ['status' => ''])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => null]);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('inertia request still receives a redirect, not JSON', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'known'], ['X-Inertia' => 'true', 'X-Requested-With' => 'XMLHttpRequest'])
        ->assertRedirect();
});

test('words index shows correct status counts', function () {
    $words = Word::whereIn('word', ['the', 'of', 'apple'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known']);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'learning']);
    $this->user->knownWords()->attach($words['apple']->id, ['status' => 'saved']);

    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.known', 1)
            ->where('stats.learning', 1)
            ->where('stats.saved', 1)
            ->where('stats.total', 6)
        );
});

test('words can be filtered by level', function () {
    Word::where('word', 'moderate')->update(['level' => 3]);
    Word::where('word', 'elaborate')->update(['level' => 6]);

    $this->get(route('words.index', ['level' => 3]))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'moderate')
            ->where('filters.level', 3)
        );
});

test('level filter excludes other levels', function () {
    Word::where('word', 'moderate')->update(['level' => 3]);
    Word::where('word', 'elaborate')->update(['level' => 6]);

    $this->get(route('words.index', ['level' => 1]))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 4)
            ->where('filters.level', 1)
        );
});

test('words can be filtered by status known', function () {
    $words = Word::whereIn('word', ['the', 'of'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known']);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'learning']);

    $this->get(route('words.index', ['status' => 'known']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'the')
            ->where('filters.status', 'known')
        );
});

test('words can be filtered by status learning', function () {
    $words = Word::whereIn('word', ['the', 'of'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known']);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'learning']);

    $this->get(route('words.index', ['status' => 'learning']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'of')
            ->where('filters.status', 'learning')
        );
});

test('words can be filtered by status saved', function () {
    $word = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'saved']);

    $this->get(route('words.index', ['status' => 'saved']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'apple')
            ->where('filters.status', 'saved')
        );
});

test('status filter returns no words when user has none with that status', function () {
    $this->get(route('words.index', ['status' => 'known']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 0)
        );
});

test('marked pages are returned correctly', function () {
    // Insert 101 words so there are 2 pages (100 per page)
    $rows = array_map(fn ($i) => ['word' => 'word'.$i, 'rank' => $i, 'created_at' => now(), 'updated_at' => now()], range(1, 101));
    Word::insert($rows);

    // Mark the first word (page 1) and the last word by rank (last page)
    $firstWord = Word::orderBy('rank')->first();
    $lastWord = Word::orderByDesc('rank')->first();
    $this->user->knownWords()->attach($firstWord->id, ['status' => 'known']);
    $this->user->knownWords()->attach($lastWord->id, ['status' => 'learning']);

    $totalWords = Word::count();
    $lastPage = (int) ceil($totalWords / 100);

    $this->get(route('words.index', ['per_page' => 100]))
        ->assertInertia(fn ($page) => $page
            ->has('markedPages')
            ->where('markedPages', [1, $lastPage])
        );
});

test('words index requires authentication', function () {
    $this->actingAs(User::factory()->create());
    auth()->logout();

    $this->get(route('words.index'))->assertRedirect(route('login'));
});
