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

test('words index shows all words by default', function () {
    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.total', 4)
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

test('toggling a word marks it as known', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.toggle', $word))
        ->assertRedirect();

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeTrue();
});

test('toggling a known word marks it as unknown', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id);

    $this->post(route('words.toggle', $word))
        ->assertRedirect();

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('words index shows correct known count', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id);

    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.known', 1)
            ->where('stats.total', 4)
        );
});

test('words index requires authentication', function () {
    $this->actingAs(User::factory()->create());
    auth()->logout();

    $this->get(route('words.index'))->assertRedirect(route('login'));
});
