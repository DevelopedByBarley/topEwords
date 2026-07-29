<?php

use App\Models\User;
use App\Models\UserAchievement;
use App\Services\AchievementService;

/**
 * A kivezetett funkciók (jelenleg: kvíz) teljesítményei nem jelenhetnek meg a
 * Teljesítmények oldalon, és nem is számíthatnak bele a haladásba — a
 * route-juk nélkül elérhetetlen célok lennének.
 */
function onboardedUser(): User
{
    return User::factory()->create(['onboarding_completed_at' => now()]);
}

test('a kivezetett csoportok teljesítményei nem látszanak a listában', function () {
    $response = $this->actingAs(onboardedUser())->get('/achievements');

    $response->assertSuccessful();

    $groupKeys = collect($response->viewData('page')['props']['grouped'])->pluck('key');

    expect($groupKeys)->not->toContain('quiz')
        ->and($groupKeys)->toContain('flashcard');
});

test('a haladás csak a látható teljesítményekből számol', function () {
    $user = onboardedUser();

    // Egy korábban (a kivezetés előtt) megszerzett kvíz-jelvény nem tolhatja
    // 100% fölé a haladást.
    UserAchievement::create([
        'user_id' => $user->id,
        'achievement_key' => 'quiz_first',
        'unlocked_at' => now(),
    ]);

    $props = $this->actingAs($user)->get('/achievements')->viewData('page')['props'];

    expect($props['totalUnlocked'])->toBe(0)
        ->and($props['totalAchievements'])->toBe(count(AchievementService::visibleAchievements()))
        ->and($props['totalAchievements'])->toBeLessThan(count(AchievementService::ACHIEVEMENTS));
});

test('a kivezetett csoport jelvényeit nem osztja ki a szolgáltatás', function () {
    $user = onboardedUser();
    $user->forceFill(['quiz_completions' => 50])->save();

    $awarded = app(AchievementService::class)->checkAndAward($user);

    expect(collect($awarded)->pluck('key'))->not->toContain('quiz_first', 'quiz_10', 'quiz_50')
        ->and($user->achievements()->pluck('achievement_key'))->not->toContain('quiz_first');
});
