<?php

use App\Models\User;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

/**
 * A teljesítmények kiosztása a tényleges felhasználói utakon: a szint-jelvények
 * nem csak az onboardingon, hanem minden „known" felvételnél megszerezhetők, és
 * a JSON-os kliensek a válaszban kapják meg az új jelvényeket.
 */
beforeEach(function () {
    // Word::create (nem insert), hogy a saving-hook kitöltse a `level` oszlopot.
    $this->apple = Word::create(['word' => 'apple', 'rank' => 1, 'meaning_hu' => 'alma']);
    $this->run = Word::create(['word' => 'run', 'rank' => 2, 'meaning_hu' => 'fut']);
    Word::create(['word' => 'house', 'rank' => 1500, 'meaning_hu' => 'ház']);

    $this->user = User::factory()->premium()->create();
    $this->user->knownWords()->attach($this->apple->id, ['status' => 'known']);
});

test('a szint utolsó szavának webes jelölése kiosztja a szint-jelvényt', function () {
    $response = $this->actingAs($this->user)
        ->postJson(route('words.status', $this->run), ['status' => 'known'])
        ->assertSuccessful();

    expect(collect($response->json('achievements'))->pluck('key'))->toContain('level_1_complete')
        ->and($this->user->achievements()->pluck('achievement_key'))
        ->toContain('level_1_complete')
        ->not->toContain('level_2_complete');
});

test('nem-known státusz nem teljesít szintet', function () {
    $this->actingAs($this->user)
        ->postJson(route('words.status', $this->run), ['status' => 'learning'])
        ->assertSuccessful();

    expect($this->user->achievements()->pluck('achievement_key'))->not->toContain('level_1_complete');
});

test('JSON-kérésnél a jelvények a válaszba kerülnek, nem a sessionbe', function () {
    $this->actingAs($this->user)
        ->postJson(route('words.status', $this->run), ['status' => 'known'])
        ->assertSuccessful()
        ->assertJsonStructure(['ok', 'status', 'forms', 'achievements'])
        ->assertSessionMissing('achievements');
});

test('Inertia-kérésnél a jelvények flash-ként mennek tovább', function () {
    $this->actingAs($this->user)
        ->from(route('words.index'))
        ->post(route('words.status', $this->run), ['status' => 'known'])
        ->assertRedirect(route('words.index'))
        ->assertSessionHas('achievements', fn (array $achievements): bool => collect($achievements)->contains('key', 'level_1_complete'));
});

test('webes csillagozással felvett új szó könyveli a streaket és a jelvényt', function () {
    $response = $this->actingAs($this->user)
        ->postJson(route('words.importance', $this->run), ['importance' => 4])
        ->assertSuccessful();

    expect($this->user->refresh()->streak)->toBe(1)
        ->and($this->user->last_activity_date?->isToday())->toBeTrue()
        ->and(collect($response->json('achievements'))->pluck('key'))->toContain('level_1_complete');
});

test('meglévő jelölés csillagozása nem aktivitás', function () {
    $this->actingAs($this->user)
        ->postJson(route('words.importance', $this->apple), ['importance' => 4])
        ->assertSuccessful()
        ->assertJsonPath('achievements', []);

    expect($this->user->refresh()->streak)->toBe(0);
});

test('a bővítményes jelölés is kiosztja a szint-jelvényt', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-status'), ['id' => $this->run->id, 'is_custom' => false, 'status' => 'known'])
        ->assertSuccessful();

    expect($this->user->achievements()->pluck('achievement_key'))->toContain('level_1_complete');
});

test('a szint-ellenőrzés a hat szintre két lekérdezéssel fut', function () {
    $service = app(AchievementService::class);

    DB::enableQueryLog();
    $awarded = $service->checkAndAward($this->user, ['level']);
    $queries = collect(DB::getQueryLog())->pluck('query');
    DB::disableQueryLog();

    // 1 a már megszerzett jelvények listája + 2 a szint-összesítés (korábban 12).
    expect($awarded)->toBe([])
        ->and($queries)->toHaveCount(3);
});
