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
        ->push([
            'candidates' => [[
                'content' => ['parts' => [['text' => '{"is_real_word":true,"meaning_hu":"kuty']]],
                'finishReason' => 'MAX_TOKENS',
            ]],
        ])
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

    Http::assertSent(fn ($request) => ($request['generationConfig']['maxOutputTokens'] ?? 0) === 1050);
});

test('a primary modell 503-jára átesik a fallback modellre és sikerül', function () {
    config(['services.gemini.models.lookup' => [
        'primary' => 'gemini-2.5-flash-lite',
        'fallback' => 'gemini-2.5-flash',
    ]]);

    Http::fake([
        '*models/gemini-2.5-flash-lite:generateContent*' => Http::response([
            'error' => ['message' => 'This model is currently experiencing high demand'],
        ], 503),
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

    Http::assertSent(fn ($request) => str_contains($request->url(), 'gemini-2.5-flash:generateContent'));

    expect(AiWordCache::firstWhere('word', 'dog')?->model)->toBe('gemini-2.5-flash');
});

test('a hívás-deadline átlépése leállítja az újrapróbát és a fallbacket', function () {
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
        '*models/gemini-2.5-flash:generateContent*' => Http::response(['ok' => true]),
    ]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

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
            'grammar_issues' => ['Hiányzik egy névelő.'],
        ]);

    Http::assertSent(fn ($request) => ($request['generationConfig']['responseSchema']['properties']['grammar_issues']['type'] ?? null) === 'ARRAY');
});

test('a practiceCheck kimeneti kerete elég egy 3000 karakteres szöveg teljes javítására', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'candidates' => [['content' => ['parts' => [['text' => json_encode([
            'words' => [['word' => 'run', 'used' => true, 'correct' => true, 'feedback_hu' => 'Jól használtad!']],
            'grammar_issues' => [],
            'overall_hu' => 'Ügyes vagy!',
            'corrected_text' => null,
        ])]]]]],
        'usageMetadata' => ['promptTokenCount' => 1050, 'candidatesTokenCount' => 1170],
    ])]);

    $this->actingAs(User::factory()->create(['ai_access' => true]))
        ->postJson(route('words.practice.check'), [
            'words' => [['word' => 'run', 'meaning_hu' => 'fut']],
            'text' => str_repeat('I run every morning before work. ', 90),
        ])
        ->assertSuccessful();

    Http::assertSentCount(1);
    Http::assertSent(fn ($request) => $request['generationConfig']['maxOutputTokens'] === 1600);
});

test('nem-admin felhasználó is elérheti a practiceCheck-et', function () {
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

/** @return array<string, mixed> */
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

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => 'happily']);
});

test('a képzett alakok száma és hossza korlátozott (nem csonkolhat oszlopot)', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('one, two, three, four, five, six, seven, eight')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    $response = $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful()
        ->assertJson(['derived_forms' => 'one/two/three/four/five/six']);

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

test('a prompt minden képzés-típust kér, és pontatlanság esetén kihagyást ír elő', function () {
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response(
        happyLookupResponse('happily')
    )]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'happy']))
        ->assertSuccessful();

    Http::assertSent(function ($request) {
        $prompt = (string) data_get($request->data(), 'contents.0.parts.0.text');

        foreach (['Adverb', 'Abstract noun', 'Agent noun', 'Adjective', 'Negated form'] as $kind) {
            expect($prompt)->toContain($kind);
        }

        expect($prompt)->toContain('two derivation steps away');

        expect($prompt)->toContain('OMIT rather than guess');
        expect($prompt)->toContain('a missing form is far better than a wrong one');

        expect($prompt)->toContain('for "hard" do NOT list "hardly"');

        return true;
    });
});
