<?php

use App\Models\User;
use App\Services\AiUsageService;
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
    config(['app.admin_email' => 'admin@example.com']);
});

test('ai lookup is blocked when the monthly budget is reached', function () {
    Http::fake();
    // Free user: a kis "kóstoló" havi keret (config-alapú) kimerítve.
    $user = User::factory()->create();
    $limit = (int) config('plans.limits.free.ai_budget_micros');
    $user->forceFill(['ai_credits_used' => $limit, 'ai_credits_reset_at' => now()->addMonth()])->save();

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertStatus(429)
        ->assertJson(['error' => 'ai_limit', 'used' => $limit, 'limit' => $limit, 'remaining' => 0, 'percent' => 100]);

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

test('a refund cannot push the unsigned usage counter below zero', function () {
    // Race: a reset() zeroed the counter between reserve() and refund(). The
    // refund would decrement an already-zero UNSIGNED column, which throws an
    // out-of-range 500 in MySQL strict mode. It must clamp at zero instead.
    $user = User::factory()->create(['ai_access' => true]);
    $user->forceFill(['ai_credits_used' => 0, 'ai_credits_reset_at' => now()->addMonth()])->save();

    app(AiUsageService::class)->refund($user, 5000);

    expect($user->fresh()->ai_credits_used)->toBe(0);
    expect($user->ai_credits_used)->toBe(0); // in-memory model stays clamped too
});

test('a foglalás nem csúszhat a keret fölé, ha a becslés már nem fér bele', function () {
    // A keret határán: a nyers „<limit" feltétel átengedett volna egy olyan foglalást is,
    // amelynek becslése túllóg a kereten (a settle() csak utólag korrigál). A limit-becslés
    // feltétel ezt már a foglalásnál megtagadja, így a számláló nem megy a limit fölé.
    $service = app(AiUsageService::class);
    $user = User::factory()->create();
    $limit = (int) config('plans.limits.free.ai_budget_micros');
    // 1 mikrodollárral a limit alatt állunk, de a becslés 10 000 — nem férhet be.
    $user->forceFill(['ai_credits_used' => $limit - 1, 'ai_credits_reset_at' => now()->addMonth()])->save();

    expect($service->reserve($user, 10_000))->toBeFalse()
        ->and($user->fresh()->ai_credits_used)->toBe($limit - 1); // változatlan, nem lépte túl

    // Épp befér: a becslés pontosan a maradék kerettel egyenlő → átmegy, és a limitig tölt.
    $user->forceFill(['ai_credits_used' => $limit - 10_000, 'ai_credits_reset_at' => now()->addMonth()])->save();

    expect($service->reserve($user, 10_000))->toBeTrue()
        ->and($user->fresh()->ai_credits_used)->toBe($limit);
});

test('a settle to a smaller actual cost clamps the counter at zero, never negative', function () {
    // Same race but via settle(): reservation was 5000, reset() zeroed it, then
    // the real cost (130) reconciles with a negative delta that would underflow.
    $user = User::factory()->create(['ai_access' => true]);
    $user->forceFill(['ai_credits_used' => 0, 'ai_credits_reset_at' => now()->addMonth()])->save();

    app(AiUsageService::class)->settle($user, estimatedMicros: 5000, actualMicros: 130);

    expect($user->fresh()->ai_credits_used)->toBe(0);
});

test('subscription settings page exposes the ai budget percentage', function () {
    $user = User::factory()->create();
    // A keret felét elhasználva 50%-ot kell mutatnia, csomagtól függetlenül.
    $limit = (int) config('plans.limits.free.ai_budget_micros');
    $user->forceFill(['ai_credits_used' => intdiv($limit, 2), 'ai_credits_reset_at' => now()->addMonth()])->save();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
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

test('word insight is blocked once the monthly budget is reached', function () {
    // Az AI mindenkinek elérhető (kóstoló); a korlát a havi keret, nem a hozzáférés.
    Http::fake();
    $user = User::factory()->create();
    $limit = (int) config('plans.limits.free.ai_budget_micros');
    $user->forceFill(['ai_credits_used' => $limit, 'ai_credits_reset_at' => now()->addMonth()])->save();

    $this->actingAs($user)
        ->getJson(route('text-analysis.word-insight', ['word' => 'run']))
        ->assertStatus(429)
        ->assertJson(['error' => 'ai_limit']);

    Http::assertNothingSent();
});

test('free users get a usage snapshot reflecting their taste budget', function () {
    $user = User::factory()->create();
    $limit = (int) config('plans.limits.free.ai_budget_micros');

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('subscription.edit'))
        ->assertInertia(fn ($page) => $page
            ->where('aiUsage.limit', $limit)
            ->where('aiUsage.unlimited', false)
        );
});

test('az esedékes havi reset nem ír vissza más, memóriában módosult mezőt', function () {
    // A resetIfDue korábban forceFill()->save()-vel a TELJES dirty modelt írta:
    // egy párhuzamos kérés alatt memóriában módosult mező elavult értéke is a
    // DB-be került volna. A célzott UPDATE csak a két számláló-mezőt írhatja.
    $user = User::factory()->create(['name' => 'Eredeti Név']);
    $user->forceFill(['ai_credits_used' => 5000, 'ai_credits_reset_at' => now()->subDay()])->save();

    $user->name = 'Elavult memóriabeli érték';

    app(AiUsageService::class)->allows($user);

    expect($user->fresh()->name)->toBe('Eredeti Név')
        ->and($user->fresh()->ai_credits_used)->toBe(0)
        ->and($user->ai_credits_used)->toBe(0);
});

// ── AI-L1: a biztonsági blokk sem ingyenes ───────────────────────────────────

test('a biztonsági blokk a tényleges token-költséget számolja el, nem refundál teljesen', function () {
    // A kérés eljutott a modellhez, tehát a Gemini kiszámlázza a promptot — a
    // korábbi teljes refund() nullára írta a keretet (AI-L1), amivel blokkolt
    // kérések ismételgetésével a havi keret megkerülhető volt.
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'promptFeedback' => ['blockReason' => 'SAFETY'],
        'usageMetadata' => ['promptTokenCount' => 300, 'candidatesTokenCount' => 0],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    // 300 input token * 0.10 + 0 output = 30 mikro-dollár. A fix nélkül ez 0 lenne.
    expect($user->fresh()->ai_credits_used)->toBe(30);
});

test('a blokkolt válasz usageMetadata nélkül is elszámolódik (becsléssel)', function () {
    // Él-eset: a Gemini blokknál elhagyhatja a usageMetadata-t. Ilyenkor a
    // prompt hosszából becsülünk — a lényeg, hogy NE essen vissza teljes
    // refundra (0-ra), mert az újra megnyitná az AI-L1 rést.
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'promptFeedback' => ['blockReason' => 'SAFETY'],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    $this->actingAs($user)
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    expect($user->fresh()->ai_credits_used)->toBeGreaterThan(0);
});

test('a blokk-elszámolás nem viszi negatívba a számlálót párhuzamos reset mellett', function () {
    // Él-eset: egy reset() nullázza a számlálót a reserve() és a blokk-settle()
    // között. Az ai_credits_used UNSIGNED, így a levonásnak 0-n kell megállnia,
    // nem out-of-range hibát dobnia.
    Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
        'promptFeedback' => ['blockReason' => 'SAFETY'],
        'usageMetadata' => ['promptTokenCount' => 10, 'candidatesTokenCount' => 0],
    ])]);

    $user = User::factory()->create(['ai_access' => true]);

    // A settle() a foglalásnál kisebb tényleges költséget von vissza; ha közben
    // a számláló 0, a clamp lép életbe.
    app(AiUsageService::class)->settle($user, estimatedMicros: 5000, actualMicros: 1);

    expect($user->fresh()->ai_credits_used)->toBe(0);
});
