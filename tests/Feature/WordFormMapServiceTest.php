<?php

use App\Models\Word;
use App\Services\WordFormMapService;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    // A térkép-cache kulcsa a szólista ujjlenyomatából képződik; a tesztek közti
    // (array-cache) átszivárgás kizárásához minden teszt tiszta cache-sel indul.
    Cache::flush();

    $this->service = app(WordFormMapService::class);
});

test('maps every inflected form to its word id', function () {
    $word = Word::create([
        'word' => 'run', 'rank' => 100, 'meaning_hu' => 'futni',
        'verb_past' => 'ran', 'verb_present_participle' => 'running', 'verb_third_person' => 'runs',
    ]);

    $map = $this->service->map();

    expect($map['forms']['run'])->toBe($word->id)
        ->and($map['forms']['ran'])->toBe($word->id)
        ->and($map['forms']['running'])->toBe($word->id)
        ->and($map['forms']['runs'])->toBe($word->id)
        ->and($map['words'][$word->id])->toMatchArray([
            'word' => 'run',
            'rank' => 100,
            'meaning_hu' => 'futni',
        ]);
});

test('maps slash-separated alternative forms as separate keys', function () {
    $word = Word::create([
        'word' => 'get', 'rank' => 10, 'meaning_hu' => 'kap',
        'verb_past' => 'got', 'verb_past_participle' => 'got/gotten',
    ]);

    $map = $this->service->map();

    expect($map['forms']['got'])->toBe($word->id)
        ->and($map['forms']['gotten'])->toBe($word->id)
        ->and($map['forms'])->not->toHaveKey('got/gotten');
});

test('lowercases form keys so case-variant tokens resolve', function () {
    $word = Word::create(['word' => 'English', 'rank' => 50, 'meaning_hu' => 'angol']);

    expect($this->service->map()['forms']['english'])->toBe($word->id);
});

test('on a shared form the lower-id word wins deterministically', function () {
    // "see" (verb) past tense is "saw"; "saw" (noun, a tool) is also a base word.
    $see = Word::create(['word' => 'see', 'rank' => 30, 'verb_past' => 'saw']);
    $saw = Word::create(['word' => 'saw', 'rank' => 900]);

    // Both words contain the form "saw"; the earlier-inserted (lower id) wins.
    expect($this->service->map()['forms']['saw'])->toBe($see->id)
        ->and($see->id)->toBeLessThan($saw->id);
});

test('rebuilds the map after the word list changes', function () {
    Word::create(['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya']);

    expect($this->service->map()['forms'])->not->toHaveKey('cat');

    // Új szó → változó ujjlenyomat → új cache-kulcs. Friss példányon kérjük le,
    // hogy a kérés-szintű memoizálást megkerüljük (új kérést szimulálva).
    Word::create(['word' => 'cat', 'rank' => 400, 'meaning_hu' => 'macska']);

    expect(app(WordFormMapService::class)->map()['forms'])->toHaveKey('cat');
});
