<?php

use App\Models\Word;
use App\Services\WordFormMapService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Sleep;

beforeEach(function () {
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
    $see = Word::create(['word' => 'see', 'rank' => 30, 'verb_past' => 'saw']);
    $saw = Word::create(['word' => 'saw', 'rank' => 900]);

    expect($this->service->map()['forms']['saw'])->toBe($see->id)
        ->and($see->id)->toBeLessThan($saw->id);
});

test('rebuilds the map after the word list changes', function () {
    Word::create(['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya']);

    expect($this->service->map()['forms'])->not->toHaveKey('cat');

    Word::create(['word' => 'cat', 'rank' => 400, 'meaning_hu' => 'macska']);

    expect(app(WordFormMapService::class)->map()['forms'])->toHaveKey('cat');
});

test('a word list change overwrites the same cache row instead of leaving an orphan', function () {
    config(['cache.default' => 'database']);
    Cache::flush();

    Word::create(['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya']);
    app(WordFormMapService::class)->map();

    Word::create(['word' => 'cat', 'rank' => 400, 'meaning_hu' => 'macska']);
    expect(app(WordFormMapService::class)->map()['forms'])->toHaveKey('cat');

    Word::create(['word' => 'cow', 'rank' => 500, 'meaning_hu' => 'tehén']);
    expect(app(WordFormMapService::class)->map()['forms'])->toHaveKey('cow');

    expect(DB::table('cache')->where('key', 'like', '%word_form_map%')->count())->toBe(1);
});

test('an up-to-date cached map is served without touching the rebuild lock', function () {
    Word::create(['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya']);
    app(WordFormMapService::class)->map();

    Cache::lock('word_form_map:rebuild', 60)->get();
    Sleep::fake(syncWithCarbon: true);

    expect(app(WordFormMapService::class)->map()['forms'])->toHaveKey('dog');

    Sleep::assertNeverSlept();
});

test('a held rebuild lock does not block the analysis: the map is built without writing the cache', function () {
    Word::create(['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya']);

    Cache::lock('word_form_map:rebuild', 60)->get();

    Sleep::fake(syncWithCarbon: true);

    expect(app(WordFormMapService::class)->map()['forms'])->toHaveKey('dog')
        ->and(Cache::get('word_form_map'))->toBeNull();
});
