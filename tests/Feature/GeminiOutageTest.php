<?php

use App\Http\Controllers\TextAnalysisController;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertStatus(502);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'cat']))->assertStatus(502);
    Http::assertSentCount(8);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'sun']))
        ->assertServiceUnavailable()
        ->assertJson(['error' => 'Az AI-szolgáltatás átmenetileg nem elérhető. Próbáld újra pár perc múlva.']);

    Http::assertSentCount(8);

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
        ->pushStatus(503)->pushStatus(503)->pushStatus(503)->pushStatus(503)
        ->push($ok)
        ->pushStatus(503)->pushStatus(503)->pushStatus(503)->pushStatus(503)
        ->push($ok);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))->assertStatus(502);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'cat']))->assertSuccessful();
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'sun']))->assertStatus(502);
    $this->actingAs($user)->getJson(route('text-analysis.gemini-lookup', ['word' => 'sky']))->assertSuccessful();

    Http::assertSentCount(10);
});

test('a belső reserve()-en elbukó kérés (keret-race) ai_limit kóddal 429-et kap', function () {
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
