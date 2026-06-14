<?php

use App\Models\User;
use App\Models\Word;

beforeEach(function () {
    $this->user = User::factory()->create();

    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'synonyms' => 'fruit', 'example_en' => 'I ate an apple.', 'example_hu' => 'Megettem egy almát.', 'verb_past' => null, 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'appear', 'meaning_hu' => 'megjelenik', 'synonyms' => null, 'example_en' => null, 'example_hu' => null, 'verb_past' => null, 'rank' => 2, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'run', 'meaning_hu' => 'fut', 'synonyms' => null, 'example_en' => null, 'example_hu' => null, 'verb_past' => 'ran', 'rank' => 3, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

test('lookup requires authentication', function () {
    $this->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJson(['error' => 'unauthenticated']);
});

test('lookup returns word with synonyms and example sentences', function () {
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'word' => 'apple',
            'meaning_hu' => 'alma',
            'synonyms' => 'fruit',
            'example_en' => 'I ate an apple.',
            'example_hu' => 'Megettem egy almát.',
            'is_custom' => false,
        ]);
});

test('lookup matches inflected verb forms', function () {
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'ran']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'word' => 'run']);
});

test('lookup finds custom words with example fields', function () {
    $this->user->customWords()->create([
        'word' => 'serendipity',
        'meaning_hu' => 'véletlen szerencse',
        'synonyms' => 'luck',
        'example_en' => 'What a serendipity!',
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'serendipity']))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'is_custom' => true,
            'synonyms' => 'luck',
            'example_en' => 'What a serendipity!',
        ]);
});

test('lookup reports not found for unknown words', function () {
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'xyzzy']))
        ->assertSuccessful()
        ->assertJson(['found' => false, 'word' => 'xyzzy']);
});

test('search returns prefix matches ordered by rank', function () {
    $response = $this->actingAs($this->user)
        ->getJson(route('extension.search', ['q' => 'app']))
        ->assertSuccessful()
        ->json();

    expect(collect($response['results'])->pluck('word')->all())->toBe(['apple', 'appear']);
});

test('search treats like wildcards literally', function () {
    $response = $this->actingAs($this->user)
        ->getJson(route('extension.search', ['q' => '%']))
        ->assertSuccessful()
        ->json();

    expect($response['results'])->toBeEmpty();
});

test('add-word creates a custom word', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), [
            'word' => 'serendipity',
            'meaning_hu' => 'véletlen szerencse',
            'part_of_speech' => 'noun',
            'noun_plural' => 'serendipities',
        ])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'word' => 'serendipity']);

    expect($this->user->customWords()->where('word', 'serendipity')->exists())->toBeTrue();
});

test('add-word rejects duplicates', function () {
    $this->user->customWords()->create(['word' => 'serendipity']);

    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity'])
        ->assertSuccessful()
        ->assertJson(['error' => 'duplicate']);
});

test('statuses returns the user word status map', function () {
    $apple = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($apple->id, ['status' => 'learning']);
    $this->user->customWords()->create(['word' => 'serendipity', 'status' => 'known']);

    $this->actingAs($this->user)
        ->getJson(route('extension.statuses'))
        ->assertSuccessful()
        ->assertJson([
            'statuses' => [
                'apple' => 'learning',
                'serendipity' => 'known',
            ],
        ]);
});

test('badge counts learning words including custom ones', function () {
    $apple = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($apple->id, ['status' => 'learning']);
    $this->user->customWords()->create(['word' => 'serendipity', 'status' => 'learning']);
    $this->user->customWords()->create(['word' => 'other', 'status' => 'known']);

    $this->actingAs($this->user)
        ->getJson(route('extension.badge'))
        ->assertSuccessful()
        ->assertJson(['count' => 2]);
});
