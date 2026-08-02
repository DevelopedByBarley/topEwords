<?php

use App\Models\User;
use App\Services\AiUsageService;

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
