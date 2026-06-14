<?php

use App\Models\User;
use App\Models\Word;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    // All rows must have identical keys for Word::insert()
    $base = [
        'meaning_hu' => null, 'extra_meanings' => null, 'synonyms' => null,
        'part_of_speech' => null, 'form_base' => null, 'verb_past' => null,
        'verb_past_participle' => null, 'verb_present_participle' => null,
        'verb_third_person' => null, 'is_irregular' => 0, 'noun_plural' => null,
        'adj_comparative' => null, 'adj_superlative' => null,
        'example_en' => null, 'example_hu' => null,
        'created_at' => now(), 'updated_at' => now(),
    ];

    Word::insert([
        array_merge($base, ['word' => 'run', 'rank' => 100, 'meaning_hu' => 'futni', 'verb_past' => 'ran', 'verb_present_participle' => 'running', 'verb_third_person' => 'runs']),
        array_merge($base, ['word' => 'quick', 'rank' => 200, 'meaning_hu' => 'gyors', 'adj_comparative' => 'quicker', 'adj_superlative' => 'quickest']),
        array_merge($base, ['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya', 'noun_plural' => 'dogs']),
        array_merge($base, ['word' => 'the', 'rank' => 1, 'meaning_hu' => 'a/az']),
    ]);
});

test('text analysis page is accessible', function () {
    $this->get(route('text-analysis.show'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('text-analysis/index'));
});

test('analyze returns json with comprehension stats', function () {
    $this->postJson(route('text-analysis.analyze'), ['text' => 'the quick dog'])
        ->assertOk()
        ->assertJsonStructure(['comprehension', 'totalWords', 'uniqueWords', 'knownCount', 'learningCount', 'tokenStatuses', 'topUnknown']);
});

test('known words increase comprehension', function () {
    $word = Word::where('word', 'run')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'run run run'])
        ->assertOk()
        ->assertJsonPath('comprehension', 100)
        ->assertJsonPath('knownCount', 3)
        ->assertJsonPath('tokenStatuses.run', 'known');
});

test('word forms are recognized via variant columns', function () {
    $word = Word::where('word', 'run')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'running ran runs'])
        ->assertOk()
        ->assertJsonPath('knownCount', 3)
        ->assertJsonPath('tokenStatuses.running', 'known')
        ->assertJsonPath('tokenStatuses.ran', 'known')
        ->assertJsonPath('tokenStatuses.runs', 'known');
});

test('words not in top 10k are classified as not_in_list', function () {
    $this->postJson(route('text-analysis.analyze'), ['text' => 'supercalifragilistic'])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.supercalifragilistic', 'not_in_list');
});

test('unknown words in top 10k appear in topUnknown list', function () {
    $response = $this->postJson(route('text-analysis.analyze'), ['text' => 'quick quick dog']);

    $words = array_column($response->json('topUnknown'), 'word');
    expect($words)->toContain('quick');
});

test('analyze requires text field', function () {
    $this->postJson(route('text-analysis.analyze'), [])
        ->assertUnprocessable();
});

test('analyze rejects text longer than 15000 characters', function () {
    $this->postJson(route('text-analysis.analyze'), ['text' => str_repeat('a ', 8000)])
        ->assertUnprocessable();
});

test('guests cannot access text analysis', function () {
    auth()->logout();

    $this->get(route('text-analysis.show'))->assertRedirect(route('login'));
    $this->postJson(route('text-analysis.analyze'), ['text' => 'hello world'])->assertUnauthorized();
});
