<?php

use App\Models\AiWordCache;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['app.admin_email' => 'admin@example.com']);
});

/**
 * Egyetlen sikeres Gemini-választ ad vissza, majd minden további hívásnál hibázik.
 * Így a cache-találatot bizonyítjuk: a második kérés nem érhet el Geminit.
 */
function fakeGeminiOnce(array $json): void
{
    Http::fakeSequence('generativelanguage.googleapis.com/*')
        ->push([
            'candidates' => [['content' => ['parts' => [['text' => json_encode($json)]]]]],
            'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 250],
        ])
        ->pushStatus(500);
}

test('a context nélküli szólekérdezés második hívása cache-ből jön, Gemini-hívás nélkül', function () {
    fakeGeminiOnce(['meaning_hu' => 'kutya', 'part_of_speech' => 'noun']);
    $user = User::factory()->create(['ai_access' => true]);

    $first = $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']));
    $first->assertSuccessful()->assertJson(['meaning_hu' => 'kutya']);

    expect(AiWordCache::where('cache_key', 'lookup:dog:en:v4')->exists())->toBeTrue();

    // A második hívás cache-ből jön: ha Geminihez fordulna, az 500-as fake hibázna.
    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertSuccessful()
        ->assertJson(['meaning_hu' => 'kutya']);

    Http::assertSentCount(1);
});

test('a cache-találat nem terheli a felhasználó AI-keretét', function () {
    fakeGeminiOnce(['meaning_hu' => 'kutya', 'part_of_speech' => 'noun']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertSuccessful();
    $afterFirst = $user->fresh()->ai_credits_used;
    expect($afterFirst)->toBe(130); // 300*0.10 + 250*0.40

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertSuccessful();

    // A második (cache-elt) hívás nem növelte a keretet.
    expect($user->fresh()->ai_credits_used)->toBe($afterFirst);
});

test('a context-tal érkező szólekérdezés nem cache-elődik', function () {
    fakeGeminiOnce(['meaning_hu' => 'kutya', 'context_explanation' => 'itt: háziállat']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog', 'context' => 'I walked the dog.']))
        ->assertSuccessful();

    expect(AiWordCache::count())->toBe(0);
});

test('hibás Gemini-választ nem tárol a cache', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response('error', 500)]);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    expect(AiWordCache::count())->toBe(0);
});

test('a flashcard és a word insight külön cache-sort kap ugyanarra a szóra', function () {
    fakeGeminiOnce(['areas' => [], 'register_hu' => 'neutral', 'tip_hu' => 'tipp']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.word-insight', ['word' => 'run']))->assertSuccessful();

    expect(AiWordCache::where('cache_key', 'insight:run:en:v2')->exists())->toBeTrue();

    // Második insight-hívás cache-ből (a fake második válasza 500 lenne).
    $this->actingAs($user)->getJson(route('text-analysis.word-insight', ['word' => 'run']))->assertSuccessful();
    Http::assertSentCount(1);
});

test('egy nem létező szóra adott insight-választ nem tárol a cache', function () {
    fakeGeminiOnce(['is_real_word' => false, 'areas' => [], 'register_hu' => '', 'tip_hu' => '']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.word-insight', ['word' => 'asdfgh']))
        ->assertSuccessful();

    // A hallucinált insight nem mérgezheti meg a megosztott cache-t.
    expect(AiWordCache::count())->toBe(0);
});

test('a valódi szóra adott insight cache-elődik, a második hívás onnan jön', function () {
    fakeGeminiOnce(['is_real_word' => true, 'areas' => [], 'register_hu' => 'neutral', 'tip_hu' => 'tipp']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.word-insight', ['word' => 'run']))->assertSuccessful();

    expect(AiWordCache::where('cache_key', 'insight:run:en:v2')->exists())->toBeTrue();

    // A második hívás cache-ből jön: ha Geminihez fordulna, az 500-as fake hibázna.
    $this->actingAs($user)->getJson(route('text-analysis.word-insight', ['word' => 'run']))->assertSuccessful();
    Http::assertSentCount(1);
});

test('a fix előtt cache-elt insight-sor (is_real_word nélkül) továbbra is kiszolgálódik', function () {
    // Visszafelé kompatibilitás: a kulcs (insight:dog:en:v2) nem változott, így a
    // régi, is_real_word mező nélküli sorok bent maradtak. A `?? true` miatt ezek
    // érvényes találatként szolgálódnak ki, nem esnek ki és nem generálnak új hívást.
    AiWordCache::create([
        'cache_key' => 'insight:dog:en:v2',
        'task' => 'insight',
        'word' => 'dog',
        'prompt_version' => 2,
        'model' => 'gemini-2.5-flash-lite',
        'response' => ['areas' => [], 'register_hu' => 'neutral', 'tip_hu' => 'régi tipp'],
    ]);
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([], 500)]);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.word-insight', ['word' => 'dog']))
        ->assertSuccessful()
        ->assertJson(['tip_hu' => 'régi tipp']);

    Http::assertNothingSent();
});

test('egy nem létező szóra adott AI-választ nem tárol a cache', function () {
    fakeGeminiOnce(['is_real_word' => false, 'meaning_hu' => '']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'asdfgh']))
        ->assertSuccessful()
        ->assertJson(['is_real_word' => false])
        ->assertJsonMissing(['meaning_hu' => '']);

    // A hallucinált válasz nem mérgezheti meg a megosztott cache-t.
    expect(AiWordCache::count())->toBe(0);
});

test('a nem létező szó minden hívásnál újra értékelődik (nincs negatív cache)', function () {
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode(['is_real_word' => false])]]]]],
            'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 250],
        ]),
    ]);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'asdfgh']))->assertJson(['is_real_word' => false]);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'asdfgh']))->assertJson(['is_real_word' => false]);

    // Nincs cache-elve → mindkét hívás Geminihez fordul.
    Http::assertSentCount(2);
});

test('a szólekérdezés strukturált JSON sémát küld a Gemininek', function () {
    fakeGeminiOnce(['meaning_hu' => 'kutya', 'part_of_speech' => 'noun']);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertSuccessful();

    Http::assertSent(function ($request) {
        $config = $request['generationConfig'] ?? [];

        return ($config['responseMimeType'] ?? null) === 'application/json'
            && ($config['responseSchema']['type'] ?? null) === 'OBJECT'
            && in_array('verb', $config['responseSchema']['properties']['part_of_speech']['enum'] ?? [], true);
    });
});

test('a valódi szóra generált flashcard cache-elődik, a második hívás onnan jön', function () {
    fakeGeminiOnce([
        'is_real_word' => true,
        'cloze_sentences' => [['sentence' => 'I _____ daily.', 'hints' => ['fut']]],
        'answer_options' => ['fut'],
        'word_forms' => ['base' => 'run'],
    ]);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.gemini-flashcard', ['word' => 'run']))->assertSuccessful();

    expect(AiWordCache::where('cache_key', 'flashcard:run:en:v3')->exists())->toBeTrue();

    // A második hívás cache-ből jön (a fake második válasza 500 lenne).
    $this->actingAs($user)->getJson(route('text-analysis.gemini-flashcard', ['word' => 'run']))->assertSuccessful();
    Http::assertSentCount(1);
});

test('egy nem létező szóra a flashcard nem cache-elődik, és jelzi a hibát', function () {
    fakeGeminiOnce(['is_real_word' => false]);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-flashcard', ['word' => 'asdfgh']))
        ->assertSuccessful()
        ->assertJson(['is_real_word' => false])
        ->assertJsonMissing(['front' => '']);

    // A hallucinált flashcard nem mérgezheti meg a megosztott cache-t.
    expect(AiWordCache::count())->toBe(0);
});

test('az ai:cache:clear parancs feladat szerint törli a sorokat', function () {
    AiWordCache::create(['cache_key' => 'lookup:dog:en:v1', 'task' => 'lookup', 'word' => 'dog', 'prompt_version' => 1, 'model' => 'gemini-2.5-flash-lite', 'response' => ['meaning_hu' => 'kutya']]);
    AiWordCache::create(['cache_key' => 'insight:dog:en:v1', 'task' => 'insight', 'word' => 'dog', 'prompt_version' => 1, 'model' => 'gemini-2.5-flash-lite', 'response' => ['tip_hu' => 'x']]);

    $this->artisan('ai:cache:clear', ['--task' => 'lookup'])->assertSuccessful();

    expect(AiWordCache::where('task', 'lookup')->count())->toBe(0);
    expect(AiWordCache::where('task', 'insight')->count())->toBe(1);
});
