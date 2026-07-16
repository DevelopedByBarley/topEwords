<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

// A player AI-végpontjai ugyanazokat a controller-metódusokat használják, mint a
// webes szövegelemző (AiCacheTest, AiUsageTest fedi a mélyebb viselkedést); itt
// azt bizonyítjuk, hogy a lejátszó tokenes útvonalán is elérhetők és kapuzottak.

beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['app.admin_email' => 'admin@example.com']);
});

/** Sikeres Gemini-választ hamisít a player AI-tesztekhez. */
function fakePlayerGemini(array $json): void
{
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => json_encode($json)]]]]],
            'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 250],
        ]),
    ]);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

test('player gemini-lookup requires authentication', function () {
    $this->getJson(route('player.gemini-lookup', ['word' => 'dog']))
        ->assertUnauthorized();
});

test('player gemini-flashcard requires authentication', function () {
    $this->getJson(route('player.gemini-flashcard', ['word' => 'dog']))
        ->assertUnauthorized();
});

test('player gemini-lookup rejects tokens without the player ability', function () {
    Sanctum::actingAs(User::factory()->create(), ['other-ability']);

    $this->getJson(route('player.gemini-lookup', ['word' => 'dog']))
        ->assertForbidden();
});

// ── AI-kitöltés (gemini-lookup) ──────────────────────────────────────────────

test('player gemini-lookup returns dictionary data with a player token', function () {
    fakePlayerGemini(['is_real_word' => true, 'meaning_hu' => 'kutya', 'part_of_speech' => 'noun']);
    Sanctum::actingAs(User::factory()->create(), ['player']);

    $this->getJson(route('player.gemini-lookup', ['word' => 'dog']))
        ->assertSuccessful()
        ->assertJson(['is_real_word' => true, 'meaning_hu' => 'kutya', 'part_of_speech' => 'noun']);
});

test('player gemini-lookup flags a non-existent word', function () {
    fakePlayerGemini(['is_real_word' => false]);
    Sanctum::actingAs(User::factory()->create(), ['player']);

    $this->getJson(route('player.gemini-lookup', ['word' => 'asdfgh']))
        ->assertSuccessful()
        ->assertJson(['is_real_word' => false]);
});

// ── AI-flashcard (gemini-flashcard) ──────────────────────────────────────────

test('player gemini-flashcard returns generated front and back with a player token', function () {
    fakePlayerGemini([
        'is_real_word' => true,
        'cloze_sentences' => [['sentence' => 'I _______ every day.', 'hints' => ['fut']]],
        'answer_options' => ['fut', 'szalad'],
        'word_forms' => ['base' => 'run'],
    ]);
    Sanctum::actingAs(User::factory()->create(), ['player']);

    $response = $this->getJson(route('player.gemini-flashcard', ['word' => 'run']))
        ->assertSuccessful()
        ->json();

    expect($response['front'])->toContain('I _______ every day.')
        ->and($response['back'])->toContain('run');
});

// ── Havi AI-keret ────────────────────────────────────────────────────────────

test('player gemini-lookup is blocked when the monthly AI budget is exhausted', function () {
    Http::fake();
    $user = User::factory()->create();
    $limit = (int) config('plans.limits.free.ai_budget_micros');
    $user->forceFill(['ai_credits_used' => $limit, 'ai_credits_reset_at' => now()->addMonth()])->save();
    Sanctum::actingAs($user, ['player']);

    $this->getJson(route('player.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(429)
        ->assertJson(['error' => 'ai_limit']);

    Http::assertNothingSent();
});
