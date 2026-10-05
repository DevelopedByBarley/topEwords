<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['app.admin_email' => 'admin@example.com']);

    $this->admin = User::factory()->withTwoFactor()->create(['email' => 'admin@example.com']);
});

function checkedWord(string $word, int $rank): Word
{
    $row = Word::create(['word' => $word, 'rank' => $rank]);
    $row->forms_checked_at = now();
    $row->save();

    return $row;
}

function lookupPayload(array $fields): array
{
    return [
        'candidates' => [['content' => ['parts' => [['text' => json_encode($fields)]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ];
}

function fakeLookupsByWord(array $byWord): void
{
    Http::fake(function ($request) use ($byWord) {
        $prompt = (string) data_get($request->data(), 'contents.0.parts.0.text');
        preg_match('/for the English word "([^"]+)"/', $prompt, $match);

        return Http::response(lookupPayload($byWord[$match[1] ?? ''] ?? ['is_real_word' => false]));
    });
}

function fakeHappyLookup(array $overrides = []): void
{
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'base_form' => 'happy',
            'meaning_hu' => 'AI-JELENTÉS',
            'extra_meanings' => 'AI-TOVÁBBI',
            'synonyms' => 'glad, content',
            'part_of_speech' => 'adj',
            'example_en' => 'AI EXAMPLE',
            'example_hu' => 'AI PÉLDA',
            'adj_comparative' => 'happier',
            'adj_superlative' => 'happiest',
            'derived_forms' => 'happily, happiness',
            ...$overrides,
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ])]);
}

test('az admin kitölti egy szó hiányzó ragozott alakjait', function () {
    fakeHappyLookup();
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('word.adj_comparative', 'happier');

    $word->refresh();
    expect($word->adj_comparative)->toBe('happier');
    expect($word->adj_superlative)->toBe('happiest');
});

test('a képzett alak ÖNÁLLÓ szó lesz a fő listában, saját jelentéssel', function () {
    fakeLookupsByWord([
        'basic' => [
            'is_real_word' => true,
            'base_form' => 'basic',
            'meaning_hu' => 'alapvető',
            'part_of_speech' => 'adj',
            'example_en' => 'A basic rule.',
            'example_hu' => 'Egy alapvető szabály.',
            'derived_forms' => 'basically',
        ],
        'basically' => [
            'is_real_word' => true,
            'base_form' => 'basically',
            'meaning_hu' => 'alapvetően',
            'part_of_speech' => 'adv',
            'example_en' => 'Basically, it works.',
            'example_hu' => 'Alapvetően működik.',
        ],
    ]);

    $word = Word::create(['word' => 'basic', 'rank' => 70, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('created', ['basically']);

    expect($word->refresh()->extra_forms)->toBeNull();

    $derived = Word::firstWhere('word', 'basically');
    expect($derived)->not->toBeNull();
    expect($derived->meaning_hu)->toBe('alapvetően');
    expect($derived->part_of_speech)->toBe('adv');
    expect($derived->derived_from_word_id)->toBe($word->id);
    expect($derived->rank)->toBeGreaterThan($word->rank);
    expect($derived->level)->toBe(7);
    expect($this->admin->knownWords()->where('words.id', $derived->id)->exists())->toBeFalse();
});

test('a törölt tő nem viszi magával a képzett alakot', function () {
    fakeLookupsByWord([
        'basic' => [
            'is_real_word' => true, 'base_form' => 'basic', 'meaning_hu' => 'alapvető',
            'part_of_speech' => 'adj', 'example_en' => 'A basic rule.', 'example_hu' => 'Alapszabály.',
            'derived_forms' => 'basically',
        ],
        'basically' => [
            'is_real_word' => true, 'base_form' => 'basically', 'meaning_hu' => 'alapvetően',
            'part_of_speech' => 'adv', 'example_en' => 'Basically, yes.', 'example_hu' => 'Alapvetően igen.',
        ],
    ]);

    $word = Word::create(['word' => 'basic', 'rank' => 70, 'part_of_speech' => 'adj']);
    $this->actingAs($this->admin)->postJson(route('words.ai-fill', $word))->assertSuccessful();

    $this->actingAs($this->admin)->delete(route('words.destroy', $word))->assertRedirect();

    $derived = Word::firstWhere('word', 'basically');
    expect($derived)->not->toBeNull();
    expect($derived->derived_from_word_id)->toBeNull();
});

test('a nem admin nem törölhet fő listás szót', function () {
    Http::fake();
    $word = Word::create(['word' => 'basic', 'rank' => 70]);

    $this->actingAs(User::factory()->create())
        ->delete(route('words.destroy', $word))
        ->assertForbidden();

    expect(Word::whereKey($word->id)->exists())->toBeTrue();
});

test('a már létező képzett alakot nem duplikáljuk', function () {
    fakeLookupsByWord([
        'real' => [
            'is_real_word' => true,
            'base_form' => 'real',
            'meaning_hu' => 'valódi',
            'part_of_speech' => 'adj',
            'example_en' => 'A real story.',
            'example_hu' => 'Egy valódi történet.',
            'derived_forms' => 'really',
        ],
    ]);

    Word::create(['word' => 'really', 'rank' => 681, 'part_of_speech' => 'adv']);
    $word = Word::create(['word' => 'real', 'rank' => 679, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('created', [])
        ->assertJsonPath('skipped', ['really']);

    expect(Word::where('word', 'really')->count())->toBe(1);
    expect(Word::firstWhere('word', 'really')->derived_from_word_id)->toBeNull();
    expect($word->refresh()->extra_forms)->toBeNull();
});

test('a meglévő alakot nem írja felül', function () {
    fakeHappyLookup();
    $word = Word::create([
        'word' => 'happy',
        'rank' => 500,
        'part_of_speech' => 'adj',
        'adj_comparative' => 'KEZZEL-BEIRT',
    ]);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('filled', ['adj_superlative']);

    expect($word->refresh()->adj_comparative)->toBe('KEZZEL-BEIRT');
});

test('a jelentéshez, példamondathoz és szófajhoz hozzá sem nyúl', function () {
    fakeHappyLookup();
    $word = Word::create([
        'word' => 'happy',
        'rank' => 500,
        'part_of_speech' => 'adj',
        'meaning_hu' => 'boldog',
        'extra_meanings' => 'vidám',
        'synonyms' => 'vidor',
        'example_en' => 'Eredeti mondat.',
        'example_hu' => 'Eredeti fordítás.',
    ]);

    $this->actingAs($this->admin)->postJson(route('words.ai-fill', $word))->assertSuccessful();

    $word->refresh();
    expect($word->meaning_hu)->toBe('boldog');
    expect($word->extra_meanings)->toBe('vidám');
    expect($word->synonyms)->toBe('vidor');
    expect($word->example_en)->toBe('Eredeti mondat.');
    expect($word->example_hu)->toBe('Eredeti fordítás.');
    expect($word->part_of_speech)->toBe('adj');
});

test('a második kattintásnak már nincs mit tennie (idempotens)', function () {
    fakeHappyLookup();
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)->postJson(route('words.ai-fill', $word))->assertSuccessful();

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('filled', []);
});

test('a képzett alakok a fail-closed szűrőn átesve lesznek önálló szóvá', function () {
    fakeHappyLookup(['derived_forms' => '<script>alert(1)</script>, 12345, HAPPILY, happily']);
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('created', ['happily']);

    expect(Word::whereNotNull('derived_from_word_id')->pluck('word')->all())->toBe(['happily']);
});

test('nem valódi szóra nem ír semmit', function () {
    fakeHappyLookup(['is_real_word' => false]);
    $word = Word::create(['word' => 'asdfgh', 'rank' => 9999]);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertStatus(422);

    expect($word->refresh()->extra_forms)->toBeNull();
});

test('a nem admin nem hívhatja', function () {
    Http::fake();
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs(User::factory()->create())
        ->postJson(route('words.ai-fill', $word))
        ->assertForbidden();

    Http::assertNothingSent();
    expect($word->refresh()->extra_forms)->toBeNull();
});

test('a vendéget nem engedi be', function () {
    Http::fake();
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->postJson(route('words.ai-fill', $word))->assertUnauthorized();

    Http::assertNothingSent();
});

test('a kitöltés akkor is megjelöli a szót, ha nem volt mit tölteni', function () {
    fakeHappyLookup(['adj_comparative' => '', 'adj_superlative' => '', 'derived_forms' => '']);
    $word = Word::create(['word' => 'the', 'rank' => 1, 'part_of_speech' => 'det']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('filled', [])
        ->assertJsonPath('word.forms_checked', true);

    expect($word->refresh()->forms_checked_at)->not->toBeNull();
});

test('a szólista visszaadja, hogy a szó át van-e nézve', function () {
    Word::create(['word' => 'apple', 'rank' => 1]);
    checkedWord('apricot', 2);

    $this->actingAs($this->admin)
        ->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->where('words.data.0.word', 'apple')
            ->where('words.data.0.forms_checked', false)
            ->where('words.data.1.word', 'apricot')
            ->where('words.data.1.forms_checked', true)
        );
});

test('a forms=unchecked szűrő csak az át nem nézett szavakat adja', function () {
    Word::create(['word' => 'apple', 'rank' => 1]);
    checkedWord('apricot', 2);

    $this->actingAs($this->admin)
        ->get(route('words.index', ['forms' => 'unchecked']))
        ->assertInertia(fn ($page) => $page
            ->count('words.data', 1)
            ->where('words.data.0.word', 'apple')
            ->where('filters.forms', 'unchecked')
        );
});

test('a forms=checked szűrő csak az átnézetteket adja', function () {
    Word::create(['word' => 'apple', 'rank' => 1]);
    checkedWord('apricot', 2);

    $this->actingAs($this->admin)
        ->get(route('words.index', ['forms' => 'checked']))
        ->assertInertia(fn ($page) => $page
            ->count('words.data', 1)
            ->where('words.data.0.word', 'apricot')
        );
});

test('érvénytelen forms értéket figyelmen kívül hagyunk', function () {
    Word::create(['word' => 'apple', 'rank' => 1]);
    checkedWord('apricot', 2);

    $this->actingAs($this->admin)
        ->get(route('words.index', ['forms' => 'DROP TABLE words']))
        ->assertInertia(fn ($page) => $page
            ->count('words.data', 2)
            ->where('filters.forms', '')
        );
});

test('a kitöltött szó kiesik a „nincs ellenőrizve" listából', function () {
    fakeHappyLookup();
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->get(route('words.index', ['forms' => 'unchecked']))
        ->assertInertia(fn ($page) => $page->count('words.data', 1));

    $this->actingAs($this->admin)->postJson(route('words.ai-fill', $word))->assertSuccessful();

    $unchecked = Word::whereNull('forms_checked_at')->pluck('word')->all();

    expect($unchecked)->not->toContain('happy');
    expect($unchecked)->toContain('happily');
});
