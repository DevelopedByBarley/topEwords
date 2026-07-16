<?php

use App\Http\Controllers\TextAnalysisController;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Tartós Gemini-kiesés forgatókönyvei: riasztható error-log a teljes
 * lánc-kudarcról, circuit breaker a worker-kimerülés ellen, és a belső
 * reserve()-race helyes (429-es) hibaalakja.
 */
beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['app.admin_email' => 'admin@example.com']);
});

function fakeGeminiOutage(): void
{
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'error' => ['message' => 'The model is overloaded.'],
        ], 503),
    ]);
}

test('teljes lánc-kudarc error szinten logol, hogy az admin-riasztás kimenjen', function () {
    // Az AlertAdminOfLoggedError csak error+ szintre riaszt; a próbánkénti
    // warning nem elég — a lánc végső kudarcának error-nak kell lennie.
    Log::spy();
    fakeGeminiOutage();

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    Log::shouldHaveReceived('error')
        ->once()
        ->withArgs(fn ($message) => $message === 'Gemini full chain failure');
});

test('a küszöbnyi lánc-kudarc kinyitja a breakert: azonnali 503 Gemini-hívás és keret-terhelés nélkül', function () {
    config(['services.gemini.breaker.failure_threshold' => 2]);
    fakeGeminiOutage();

    $user = User::factory()->create(['ai_access' => true]);

    // Két teljes lánc-kudarc (kérésenként 2 modell × 2 próba = 4 hívás).
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertStatus(502);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'cat']))->assertStatus(502);
    Http::assertSentCount(8);

    // A breaker nyitva: azonnali 503, upstream-hívás nélkül.
    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'sun']))
        ->assertServiceUnavailable()
        ->assertJson(['error' => 'Az AI-szolgáltatás átmenetileg nem elérhető. Próbáld újra pár perc múlva.']);

    Http::assertSentCount(8);

    // A blokkolt kérés a havi AI-keretet sem foglalja (a kudarcok refundáltak).
    expect($user->fresh()->ai_credits_used)->toBe(0);
});

test('sikeres válasz nullázza a breaker kudarc-számlálóját', function () {
    config(['services.gemini.breaker.failure_threshold' => 2]);

    $ok = [
        'candidates' => [[
            'content' => ['parts' => [['text' => json_encode(['is_real_word' => true, 'meaning_hu' => 'kutya', 'part_of_speech' => 'noun'])]]],
            'finishReason' => 'STOP',
        ]],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 250],
    ];

    Http::fakeSequence('generativelanguage.googleapis.com/*')
        // 1. kérés: teljes kudarc (kudarc #1).
        ->pushStatus(503)->pushStatus(503)->pushStatus(503)->pushStatus(503)
        // 2. kérés: siker → a számláló nullázódik.
        ->push($ok)
        // 3. kérés: teljes kudarc — de ez megint csak a #1, nem éri el a küszöböt.
        ->pushStatus(503)->pushStatus(503)->pushStatus(503)->pushStatus(503)
        // 4. kérés: a breaker zárva maradt, az upstream-hívás lefut.
        ->push($ok);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertStatus(502);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'cat']))->assertSuccessful();
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'sun']))->assertStatus(502);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'sky']))->assertSuccessful();

    Http::assertSentCount(10);
});

test('a belső reserve()-en elbukó kérés (keret-race) ai_limit kóddal 429-et kap', function () {
    // Az aiLimitGuard elő-szűrőjét megkerülve hívjuk a callGeminit — így
    // szimulálható a guard és a reserve() közti race, amikor a keret időközben
    // kimerült: a válasznak a guarddal azonos alakú 429-nek kell lennie, nem 502-nek.
    Http::fake();

    $limit = (int) config('plans.limits.free.ai_budget_micros');
    $user = User::factory()->create();
    $user->forceFill(['ai_credits_used' => $limit, 'ai_credits_reset_at' => now()->addMonth()])->save();

    $controller = app(TextAnalysisController::class);

    $result = (new ReflectionMethod($controller, 'callGemini'))
        ->invoke($controller, 'test-key', 'prompt', 100, 'gemini-2.5-flash-lite', null, 0.3, null, $user);

    expect($result['ok'])->toBeFalse()
        ->and($result['error_code'])->toBe('ai_limit');

    $response = (new ReflectionMethod($controller, 'aiFailureResponse'))
        ->invoke($controller, $result, $user);

    expect($response->getStatusCode())->toBe(429)
        ->and($response->getData(true)['error'])->toBe('ai_limit')
        ->and($response->getData(true))->toHaveKeys(['message', 'used', 'limit', 'remaining']);

    Http::assertNothingSent();
});
