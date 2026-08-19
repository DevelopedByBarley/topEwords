<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Http;

/**
 * Az admin gyors alak-kitöltő (`words.ai-fill`).
 *
 * A szólista sorában lévő gomb hívja, hogy a hiányzó alakokat végig lehessen
 * kattintani. A legfontosabb tulajdonsága, hogy MEGLÉVŐ értéket soha nem ír
 * felül — enélkül a végigkattintás lecserélné a felhalmozott jelentéseket és
 * példamondatokat arra, amit az AI épp mond.
 */
beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['app.admin_email' => 'admin@example.com']);

    $this->admin = User::factory()->create(['email' => 'admin@example.com']);
});

/** A „happy" lookup-válasza, tetszőleges mező-felülírásokkal. */
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

test('az admin kitölti egy szó hiányzó alakjait', function () {
    fakeHappyLookup();
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)
        ->postJson(route('words.ai-fill', $word))
        ->assertSuccessful()
        ->assertJsonPath('word.adj_comparative', 'happier')
        ->assertJsonPath('word.extra_forms', 'happily/happiness');

    $word->refresh();
    expect($word->adj_comparative)->toBe('happier');
    expect($word->adj_superlative)->toBe('happiest');
    expect($word->extra_forms)->toBe('happily/happiness');
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
        ->assertJsonPath('filled', ['adj_superlative', 'extra_forms']);

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

test('a képzett alakok a fail-closed szűrőn átesve kerülnek be', function () {
    fakeHappyLookup(['derived_forms' => '<script>alert(1)</script>, 12345, HAPPILY, happily']);
    $word = Word::create(['word' => 'happy', 'rank' => 500, 'part_of_speech' => 'adj']);

    $this->actingAs($this->admin)->postJson(route('words.ai-fill', $word))->assertSuccessful();

    expect($word->refresh()->extra_forms)->toBe('happily');
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
