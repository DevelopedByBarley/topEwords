<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;

// inTok=300 + outTok=250 a gemini-2.5-flash-lite áraival:
// 300*0.10 + 250*0.40 = 130 mikro-dollár.
function fakeGemini(array $json, int $inputTokens = 300, int $outputTokens = 250): void
{
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                ['content' => ['parts' => [['text' => json_encode($json)]]]],
            ],
            'usageMetadata' => [
                'promptTokenCount' => $inputTokens,
                'candidatesTokenCount' => $outputTokens,
                'totalTokenCount' => $inputTokens + $outputTokens,
            ],
        ]),
    ]);
}

beforeEach(function () {
    config(['services.gemini.api_key' => 'test-key']);
    config(['services.gemini.monthly_budget_micros' => 500000]); // $0.50
    config(['app.admin_email' => 'admin@example.com']);
});

test('ai lookup is blocked when the monthly budget is reached', function () {
    Http::fake();
    $user = User::factory()->create(['ai_access' => true]);
    $user->forceFill(['ai_credits_used' => 500000, 'ai_credits_reset_at' => now()->addMonth()])->save();

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertStatus(429)
        ->assertJson(['error' => 'ai_limit', 'used' => 500000, 'limit' => 500000, 'remaining' => 0, 'percent' => 100]);

    // A keret fölött nem szabad Geminit hívni.
    Http::assertNothingSent();
});

test('a successful ai lookup adds the actual cost in micro-dollars', function () {
    fakeGemini(['meaning_hu' => 'teszt', 'part_of_speech' => 'noun'], inputTokens: 300, outputTokens: 250);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertSuccessful();

    // 300*0.10 + 250*0.40 = 130 mikro-dollár.
    expect($user->fresh()->ai_credits_used)->toBe(130);
});

test('a failed ai call refunds the reservation and does not consume budget', function () {
    // Both attempts fail → the pre-charged reservation must be released.
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response('error', 500)]);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertStatus(502);

    expect($user->fresh()->ai_credits_used)->toBe(0);
});

test('admins have an unlimited budget and are not charged', function () {
    fakeGemini(['meaning_hu' => 'teszt', 'part_of_speech' => 'noun']);
    $admin = User::factory()->create(['email' => 'admin@example.com']);
    $admin->forceFill(['ai_credits_used' => 9999, 'ai_credits_reset_at' => now()->addMonth()])->save();

    $this->actingAs($admin)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertSuccessful();

    expect($admin->fresh()->ai_credits_used)->toBe(9999);
});

test('usage resets after the period elapses', function () {
    fakeGemini(['meaning_hu' => 'teszt', 'part_of_speech' => 'noun'], inputTokens: 300, outputTokens: 250);
    $user = User::factory()->create(['ai_access' => true]);
    $user->forceFill(['ai_credits_used' => 500000, 'ai_credits_reset_at' => now()->subDay()])->save();

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertSuccessful();

    // Lejárt időszak → nullázódott, majd ez a hívás 130 mikro-dollárral növelte.
    expect($user->fresh()->ai_credits_used)->toBe(130);
});

test('subscription settings page exposes the ai budget percentage', function () {
    $user = User::factory()->create(['ai_access' => true]);
    $user->forceFill(['ai_credits_used' => 250000, 'ai_credits_reset_at' => now()->addMonth()])->save();

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn ($page) => $page
            ->where('aiUsage.percent', 50)
            ->where('aiUsage.unlimited', false)
        );
});

test('word insight is available to ai-access users and charges the budget', function () {
    fakeGemini(['areas' => [], 'register_hu' => 'neutral', 'tip_hu' => 'tipp'], inputTokens: 400, outputTokens: 300);
    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.word-insight', ['word' => 'run']))
        ->assertSuccessful();

    // 400*0.10 + 300*0.40 = 160 mikro-dollár.
    expect($user->fresh()->ai_credits_used)->toBe(160);
});

test('word insight is forbidden for users without ai access', function () {
    Http::fake();
    $user = User::factory()->create(['ai_access' => false]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.word-insight', ['word' => 'run']))
        ->assertForbidden();

    Http::assertNothingSent();
});

test('free users without ai access do not get a usage snapshot', function () {
    $user = User::factory()->create(['ai_access' => false]);

    $this->actingAs($user)
        ->get(route('subscription.edit'))
        ->assertInertia(fn ($page) => $page->where('aiUsage', null));
});
