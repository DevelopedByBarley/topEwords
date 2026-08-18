<?php

use App\Models\AiWordCache;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
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

test('ragozott alak beírásakor az alapszóra lemmatizál és jelzi a cserét', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'base_form' => 'help',
            'meaning_hu' => 'segít',
            'part_of_speech' => 'verb',
            'example_en' => 'She helped me.',
            'example_hu' => 'Segített nekem.',
            'verb_past' => 'helped',
            'verb_present_participle' => 'helping',
            'verb_third_person' => 'helps',
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'helped']))
        ->assertSuccessful()
        ->assertJson([
            'is_real_word' => true,
            'base_form' => 'help',
            'normalized_from_input' => 'help',
            'verb_past' => 'helped',
        ]);
});

test('alapszó beírásakor nincs csere-jelzés (normalized_from_input null)', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'base_form' => 'help',
            'meaning_hu' => 'segít',
            'part_of_speech' => 'verb',
            'example_en' => 'She helps me.',
            'example_hu' => 'Segít nekem.',
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'help']))
        ->assertSuccessful()
        ->assertJson([
            'base_form' => 'help',
            'normalized_from_input' => null,
        ]);
});

test('érvénytelen/üres base_form esetén a beírt szóra esik vissza', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'base_form' => '',
            'meaning_hu' => 'kutya',
            'part_of_speech' => 'noun',
            'example_en' => 'The dog runs.',
            'example_hu' => 'A kutya fut.',
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertSuccessful()
        ->assertJson([
            'base_form' => 'dog',
            'normalized_from_input' => null,
        ]);
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

test('nem-admin felhasználó is elérheti a practiceCheck-et', function () {
    // Őrszem: a végpontot két ÉLŐ felület hívja (szólista PracticeModal +
    // flashcard szabad-írás doboz), ezért NEM admin-only. A korábbi
    // admin-gate minden rendes felhasználónak 403-at adott.
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

test('a nem hitelesített kérés a practiceCheck-en 401-et kap', function () {
    Http::fake();

    $this->postJson(route('words.practice.check'), [
        'words' => [['word' => 'run', 'meaning_hu' => 'fut']],
        'text' => 'I run every morning before work.',
    ])->assertUnauthorized();

    Http::assertNothingSent();
});

// --- derived_forms: azonos tövű, más szófajú képzett alakok ---
// A modell a ragozási mezőkbe nem férő alakokat (pl. „happy" → „happily")
// ebben a mezőben adja vissza; ezek az extra_forms oszlopba kerülnek, ezért a
// külső szolgáltatótól jövő szabad szöveget fail-closed szűrjük.

/** @return array<string, mixed> A „happy" lookup válasza, tetszőleges derived_forms-szal. */
function happyLookupResponse(string $derivedForms): array
{
    return [
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'is_real_word' => true,
            'base_form' => 'happy',
            'meaning_hu' => 'boldog',
            'part_of_speech' => 'adj',
            'example_en' => 'She is happy.',
            'example_hu' => 'Boldog.',
            'adj_comparative' => 'happier',
            'adj_superlative' => 'happiest',
            'derived_forms' => $derivedForms,
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 200],
    ];
}

test('a képzett alakok kisbetűsítve, deduplikálva, /-szeparálva jönnek vissza', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('Happily, happiness, HAPPILY')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => 'happily/happiness']);
});

test('a képzett alakok közül kimarad a lemma és a többi alak-mező által lefedett', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('happy, happier, happiest, happily')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => 'happily']);
});

test('a nem szóalakú képzett alakokat eldobjuk (fail-closed)', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('<script>alert(1)</script>, very happy indeed, 12345, happily')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    // Csak az egyszavas, betűkből álló alak marad: a HTML, a többszavas
    // kifejezés és a számsor mind kiesik.
    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => 'happily']);
});

test('a képzett alakok száma és hossza korlátozott (nem csonkolhat oszlopot)', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('one, two, three, four, five, six')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    $response = $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => 'one/two/three/four']);

    expect(mb_strlen($response->json('derived_forms')))->toBeLessThanOrEqual(255);
});

test('üres vagy hiányzó derived_forms esetén null a mező', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => null]);
});
