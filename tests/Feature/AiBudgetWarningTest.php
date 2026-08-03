<?php

use App\Models\User;
use App\Services\AiUsageService;
use Illuminate\Support\Facades\Http;

/**
 * Az AI-keret figyelmeztetése megosztott propon (`aiBudgetWarning`) megy minden
 * belső oldalra, de csak akkor tartalmaz adatot, ha a keret tényleg fogyni
 * kezdett — állandó keret-kijelző szándékosan nincs.
 */
function freeAiLimit(): int
{
    return (int) config('plans.limits.free.ai_budget_micros');
}

/**
 * Beállítja a felhasznált keretet úgy, hogy a periódus-váltó reset ne nullázza
 * (jövőbeli `ai_credits_reset_at`).
 *
 * @param  array<string, mixed>  $attributes
 */
function userWithAiUsage(int $usedMicros, array $attributes = []): User
{
    $user = User::factory()->create([
        'onboarding_completed_at' => now(),
        ...$attributes,
    ]);

    $user->forceFill([
        'ai_credits_used' => $usedMicros,
        'ai_credits_reset_at' => now()->addMonth(),
    ])->save();

    return $user;
}

test('a küszöb alatti keret-használatnál nincs figyelmeztetés', function () {
    $under = (int) floor(freeAiLimit() * (AiUsageService::WARNING_THRESHOLD_PERCENT - 5) / 100);

    $this->actingAs(userWithAiUsage($under))
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->where('aiBudgetWarning', null));
});

test('a küszöb elérésekor „low" figyelmeztetés megy ki a maradék százalékkal', function () {
    $used = (int) ceil(freeAiLimit() * AiUsageService::WARNING_THRESHOLD_PERCENT / 100);

    $this->actingAs(userWithAiUsage($used))
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->where('aiBudgetWarning.level', 'low')
            ->where('aiBudgetWarning.remaining_percent', 100 - AiUsageService::WARNING_THRESHOLD_PERCENT)
        );
});

test('a kimerült keret „exhausted" szintet és 0%-ot ad', function () {
    $this->actingAs(userWithAiUsage(freeAiLimit()))
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->where('aiBudgetWarning.level', 'exhausted')
            ->where('aiBudgetWarning.remaining_percent', 0)
        );
});

test('a maradék százalék felfelé kerekít, így a még használható keret sosem 0%', function () {
    // Egyetlen mikro-dollár maradt: a lefelé kerekítés itt 0%-ot adna, ami
    // kimerültnek mutatná a még használható keretet.
    $this->actingAs(userWithAiUsage(freeAiLimit() - 1))
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page
            ->where('aiBudgetWarning.level', 'low')
            ->where('aiBudgetWarning.remaining_percent', 1)
        );
});

test('korlátlan keretnél (admin) nincs figyelmeztetés', function () {
    config(['app.admin_email' => 'admin@example.com']);

    $admin = userWithAiUsage(freeAiLimit() * 10, [
        'email' => 'admin@example.com',
        'email_verified_at' => now(),
    ]);

    expect($admin->aiMonthlyLimit())->toBeNull();

    $this->actingAs($admin)
        ->get('/dashboard')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->where('aiBudgetWarning', null));
});

test('vendégként a prop null, nem hasal el a hiányzó felhasználón', function () {
    $this->get('/')
        ->assertSuccessful()
        ->assertInertia(fn ($page) => $page->where('aiBudgetWarning', null));
});

/*
|--------------------------------------------------------------------------
| Élő frissítés: az AI-végpontok válasza (`ai.budget` middleware)
|--------------------------------------------------------------------------
|
| A megosztott prop csak oldalváltáskor frissül, ezért a keretet fogyasztó
| végpontok a válaszukban is visszaadják a hívás UTÁNI keret-állapotot — így a
| sáv a keret elfogyásának pillanatában megjelenik, extra kérés nélkül.
*/

/**
 * A Gemini-válasz mockolása. inTok=300 + outTok=250 a gemini-2.5-flash-lite
 * áraival 130 mikro-dollár tényleges költség.
 */
function fakeGeminiForBudget(array $json): void
{
    config(['services.gemini.api_key' => 'test-key']);

    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                ['content' => ['parts' => [['text' => json_encode($json)]]]],
            ],
            'usageMetadata' => [
                'promptTokenCount' => 300,
                'candidatesTokenCount' => 250,
                'totalTokenCount' => 550,
            ],
        ]),
    ]);
}

test('a sikeres AI-hívás válasza tartalmazza a keret-állapotot, küszöb alatt null-ként', function () {
    fakeGeminiForBudget(['meaning_hu' => 'teszt', 'part_of_speech' => 'noun']);

    $this->actingAs(userWithAiUsage(0))
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertSuccessful()
        ->assertJson(['ai_budget_warning' => null]);
});

test('a küszöb fölötti hívás válasza a hívás utáni „low" állapotot adja', function () {
    fakeGeminiForBudget(['meaning_hu' => 'teszt', 'part_of_speech' => 'noun']);

    // A küszöb fölött, de a becsült foglalás még belefér a keretbe.
    $used = (int) floor(freeAiLimit() * 0.875);

    $this->actingAs(userWithAiUsage($used))
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertSuccessful()
        ->assertJsonPath('ai_budget_warning.level', 'low');
});

test('a keret-kimerülés 429-es válasza is közli az „exhausted" állapotot', function () {
    Http::fake();

    $this->actingAs(userWithAiUsage(freeAiLimit()))
        ->getJson(route('text-analysis.gemini-lookup', ['word' => 'test']))
        ->assertStatus(429)
        ->assertJsonPath('ai_budget_warning.level', 'exhausted');

    Http::assertNothingSent();
});

test('a keretet nem fogyasztó végpont válaszába nem kerül bele a kulcs', function () {
    $this->actingAs(userWithAiUsage(freeAiLimit()))
        ->getJson(route('text-analysis.word-lookup', ['word' => 'test']))
        ->assertSuccessful()
        ->assertJsonMissingPath('ai_budget_warning');
});
