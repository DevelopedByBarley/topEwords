<?php

use App\Models\AiWordCache;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['services.gemini.monthly_budget_micros' => 500000]); // $0.50
    config(['app.admin_email' => 'admin@example.com']);
});

test('csonkolt (MAX_TOKENS) válasz után magasabb token-kerettel újrapróbál', function () {
    Http::fakeSequence('generativelanguage.googleapis.com/*')
        // Első válasz: csonka JSON + MAX_TOKENS → bump + újrapróba.
        ->push([
            'candidates' => [[
                'content' => ['parts' => [['text' => '{"is_real_word":true,"meaning_hu":"kuty']]],
                'finishReason' => 'MAX_TOKENS',
            ]],
        ])
        // Második válasz: teljes, érvényes JSON a megemelt kerettel.
        ->push([
            'candidates' => [[
                'content' => ['parts' => [['text' => json_encode(['is_real_word' => true, 'meaning_hu' => 'kutya', 'part_of_speech' => 'noun'])]]],
                'finishReason' => 'STOP',
            ]],
            'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 250],
        ]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertSuccessful()
        ->assertJson(['meaning_hu' => 'kutya']);

    Http::assertSentCount(2);

    // A lookup alap kerete 700 → a csonkolás miatti újrapróba 1050-re emeli.
    Http::assertSent(fn ($request) => ($request['generationConfig']['maxOutputTokens'] ?? 0) === 1050);
});

test('a primary modell 503-jára átesik a fallback modellre és sikerül', function () {
    config(['services.gemini.models.lookup' => [
        'primary' => 'gemini-2.5-flash-lite',
        'fallback' => 'gemini-2.5-flash',
    ]]);

    Http::fake([
        // A primary modell túlterhelt (503) minden próbán.
        '*models/gemini-2.5-flash-lite:generateContent*' => Http::response([
            'error' => ['message' => 'This model is currently experiencing high demand'],
        ], 503),
        // A fallback (másik kapacitás-pool) válaszol.
        '*models/gemini-2.5-flash:generateContent*' => Http::response([
            'candidates' => [[
                'content' => ['parts' => [['text' => json_encode(['is_real_word' => true, 'meaning_hu' => 'kutya', 'part_of_speech' => 'noun'])]]],
                'finishReason' => 'STOP',
            ]],
            'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 250],
        ]),
    ]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertSuccessful()
        ->assertJson(['meaning_hu' => 'kutya']);

    // A primary 2 próbája 503, majd a fallback egy hívásból sikerül.
    Http::assertSent(fn ($request) => str_contains($request->url(), 'gemini-2.5-flash:generateContent'));

    // A cache a ténylegesen választ adó fallback modellt rögzíti.
    expect(AiWordCache::firstWhere('word', 'dog')?->model)->toBe('gemini-2.5-flash');
});

test('a hívás-deadline átlépése leállítja az újrapróbát és a fallbacket', function () {
    // Nulla keret: az első próba mindig lefut, de utána a deadline azonnal leállít,
    // így a primary újrapróbája és a fallback modell már SOSEM hívódik meg.
    config(['services.gemini.request_deadline_seconds' => 0.0]);
    config(['services.gemini.models.lookup' => [
        'primary' => 'gemini-2.5-flash-lite',
        'fallback' => 'gemini-2.5-flash',
    ]]);

    Http::fake([
        '*models/gemini-2.5-flash-lite:generateContent*' => Http::response([
            'error' => ['message' => 'high demand'],
        ], 503),
        '*models/gemini-2.5-flash:generateContent*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode(['is_real_word' => true, 'meaning_hu' => 'kutya'])]]], 'finishReason' => 'STOP']],
        ]),
    ]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    // Pontosan egy HTTP-hívás: az első primary próba; a deadline minden továbbit levág.
    Http::assertSentCount(1);
    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'gemini-2.5-flash:generateContent'));
    expect(AiWordCache::count())->toBe(0);
});

test('a "none" fallback kikapcsolja az eszkalációt — csak a primary fut', function () {
    config(['services.gemini.models.lookup' => [
        'primary' => 'gemini-2.5-flash-lite',
        'fallback' => 'none',
    ]]);

    Http::fake([
        '*models/gemini-2.5-flash-lite:generateContent*' => Http::response([
            'error' => ['message' => 'high demand'],
        ], 503),
        // Ha mégis ide esne, kiderülne — de nem szabad hívnia.
        '*models/gemini-2.5-flash:generateContent*' => Http::response(['ok' => true]),
    ]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    // Csak a primary (lite) modellt hívja, a fallback flash-t soha.
    Http::assertNotSent(fn ($request) => str_contains($request->url(), 'gemini-2.5-flash:generateContent'));
});

test('többszavas kifejezés átmegy a lookup-on és valódinak fogadja el', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'meaning_hu' => 'próbáld megállni a nevetést',
            'part_of_speech' => 'phrase',
            'example_en' => 'Try to not laugh during the meeting.',
            'example_hu' => 'Próbáld megállni a nevetést a megbeszélés alatt.',
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'try to not laugh']))
        ->assertSuccessful()
        ->assertJson(['is_real_word' => true, 'meaning_hu' => 'próbáld megállni a nevetést']);

    // A lazított szabály a promptban: a természetes többszavas kifejezés is valódi.
    Http::assertSent(fn ($request) => str_contains($request['contents'][0]['parts'][0]['text'] ?? '', 'multi-word English phrase'));
});

test('biztonsági blokk (blockReason) azonnal hibát ad, újrapróba nélkül', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'promptFeedback' => ['blockReason' => 'SAFETY'],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    // Egyetlen hívás: a blokkolt promptot nincs értelme újrapróbálni.
    Http::assertSentCount(1);
    expect(AiWordCache::count())->toBe(0);
});

test('a SAFETY finishReason is azonnal hibát ad, újrapróba nélkül', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['finishReason' => 'SAFETY']],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    Http::assertSentCount(1);
});

test('a sentenceCheck strukturált JSON sémát küld a Gemininek', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'usage_ok' => true,
            'grammar_ok' => true,
            'feedback_hu' => 'Szuper, helyesen használtad!',
            'grammar_note_hu' => null,
            'corrected_sentence' => null,
            'example_sentence' => 'I run every morning.',
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 120, 'candidatesTokenCount' => 60],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->postJson(route('words.sentence-check'), ['word' => 'run', 'sentence' => 'I run every day.'])
        ->assertSuccessful()
        ->assertJson(['usage_ok' => true, 'feedback_hu' => 'Szuper, helyesen használtad!']);

    Http::assertSent(function ($request) {
        $config = $request['generationConfig'] ?? [];

        return ($config['responseMimeType'] ?? null) === 'application/json'
            && ($config['responseSchema']['properties']['usage_ok']['type'] ?? null) === 'BOOLEAN';
    });
});

test('a practiceCheck strukturált sémát küld és üres grammar_issues-t szűr', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'words' => [['word' => 'run', 'used' => true, 'correct' => true, 'feedback_hu' => 'Jól használtad!']],
            'grammar_issues' => ['Hiányzik egy névelő.', '', '  '],
            'overall_hu' => 'Ügyes vagy!',
            'corrected_text' => null,
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 150, 'candidatesTokenCount' => 80],
    ])]);

    $admin = User::factory()->create(['email' => 'admin@example.com']);

    $this->actingAs($admin)
        ->postJson(route('words.practice.check'), [
            'words' => [['word' => 'run', 'meaning_hu' => 'fut']],
            'text' => 'I run every morning before work.',
        ])
        ->assertSuccessful()
        ->assertJson([
            'overall_hu' => 'Ügyes vagy!',
            'grammar_issues' => ['Hiányzik egy névelő.'], // az üres elemek kiszűrve
        ]);

    Http::assertSent(fn ($request) => ($request['generationConfig']['responseSchema']['properties']['grammar_issues']['type'] ?? null) === 'ARRAY');
});

test('AI-hozzáférésű (nem admin) felhasználó használhatja a practiceCheck-et', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'words' => [['word' => 'run', 'used' => true, 'correct' => true, 'feedback_hu' => 'Jól használtad!']],
            'grammar_issues' => [],
            'overall_hu' => 'Ügyes vagy!',
            'corrected_text' => null,
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 150, 'candidatesTokenCount' => 80],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->postJson(route('words.practice.check'), [
            'words' => [['word' => 'run', 'meaning_hu' => 'fut']],
            'text' => 'I run every morning before work.',
        ])
        ->assertSuccessful()
        ->assertJson(['overall_hu' => 'Ügyes vagy!']);
});

test('AI-hozzáférés nélküli felhasználó 403-at kap a practiceCheck-en', function () {
    $user = User::factory()->create(['ai_access' => false]);

    $this->actingAs($user)
        ->postJson(route('words.practice.check'), [
            'words' => [['word' => 'run', 'meaning_hu' => 'fut']],
            'text' => 'I run every morning before work.',
        ])
        ->assertForbidden();
});
