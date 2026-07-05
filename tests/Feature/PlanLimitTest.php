<?php

use App\Models\User;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Support\Facades\Cache;

test('every plan defines every limit key so a typo key never becomes unlimited', function () {
    $limits = config('plans.limits');
    $keys = array_keys($limits['free']);

    foreach (['free', 'premium'] as $plan) {
        expect(array_keys($limits[$plan]))->toEqualCanonicalizing($keys);
    }
});

test('planLimit reads the limit for the current plan', function () {
    expect(User::factory()->create()->planLimit('decks'))->toBe(5)
        ->and(User::factory()->premium()->create()->planLimit('decks'))->toBeNull();
});

test('isWithinPlanLimit treats null as unlimited and enforces the boundary otherwise', function () {
    $free = User::factory()->create();

    expect($free->isWithinPlanLimit('decks', current: 4, adding: 1))->toBeTrue()
        ->and($free->isWithinPlanLimit('decks', current: 5, adding: 1))->toBeFalse();

    $premium = User::factory()->premium()->create();

    expect($premium->isWithinPlanLimit('decks', current: 9999, adding: 1))->toBeTrue();
});

test('deck creation limit follows the plan', function () {
    $free = User::factory()->create();
    $free->flashcardDecks()->createMany(collect(range(1, 4))->map(fn ($i) => ['name' => "D{$i}"])->all());

    expect($free->canAddFlashcardDeck())->toBeTrue();

    $free->flashcardDecks()->create(['name' => 'D5']);

    expect($free->canAddFlashcardDeck())->toBeFalse();
});

test('free user is blocked from creating a sixth deck via the endpoint', function () {
    $user = User::factory()->create();
    $user->flashcardDecks()->createMany(collect(range(1, 5))->map(fn ($i) => ['name' => "D{$i}"])->all());

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Hatodik'])
        ->assertSessionHas('error');

    expect($user->flashcardDecks()->count())->toBe(5);
});

test('extension writes follow a shared daily quota, unlimited on Pro', function () {
    $free = User::factory()->create();
    $freeLimit = $free->planLimit('extension_writes_per_day');

    // A napi keret alatt még mehet.
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $freeLimit - 1, now()->endOfDay());
    expect($free->canWriteFromExtension())->toBeTrue();

    // A keretet elérve elzár.
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $freeLimit, now()->endOfDay());
    expect($free->canWriteFromExtension())->toBeFalse();

    // A Pro (null = korlátlan) sosem fogy el, és nem is számol.
    $pro = User::factory()->premium()->create();
    Cache::put("extension_writes_daily_{$pro->id}_".today()->format('Y-m-d'), 9999, now()->endOfDay());
    expect($pro->canWriteFromExtension())->toBeTrue();

    expect($pro->reserveExtensionWrite())->toBeTrue();
    expect($pro->extensionWritesToday())->toBe(9999); // korlátlan → nem növel
});

test('reserveExtensionWrite atomically consumes the daily quota and refunds at the cap', function () {
    $free = User::factory()->create();
    $freeLimit = $free->planLimit('extension_writes_per_day');

    // Egy hellyel a keret alatt: a foglalás átmegy és növeli a számlálót.
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $freeLimit - 1, now()->endOfDay());
    expect($free->reserveExtensionWrite())->toBeTrue()
        ->and($free->extensionWritesToday())->toBe($freeLimit);

    // Betelt keretnél elutasít, és a számláló nem szalad túl (visszaadja a foglalást).
    expect($free->reserveExtensionWrite())->toBeFalse()
        ->and($free->extensionWritesToday())->toBe($freeLimit);
});

test('quiz round size is capped by the plan', function () {
    Word::insert(collect(range(1, 40))->map(fn ($i) => [
        'word' => "qw{$i}",
        'meaning_hu' => "j{$i}",
        'rank' => $i,
        'created_at' => now(),
        'updated_at' => now(),
    ])->all());

    $freeProps = $this->actingAs(User::factory()->create())
        ->get(route('words.quiz', ['count' => 50]))->viewData('page')['props'];
    expect($freeProps['words'])->toHaveCount(10)
        ->and($freeProps['freeQuizLimit'])->toBe(10);

    $premiumProps = $this->actingAs(User::factory()->premium()->create())
        ->get(route('words.quiz', ['count' => 50]))->viewData('page')['props'];
    expect($premiumProps['words'])->toHaveCount(40)
        ->and($premiumProps['freeQuizLimit'])->toBeNull();
});

test('cloze round size is capped by the plan', function () {
    Word::insert(collect(range(1, 40))->map(fn ($i) => [
        'word' => "clozeword{$i}",
        'meaning_hu' => "j{$i}",
        'example_en' => "This is clozeword{$i} here.",
        'rank' => $i,
        'created_at' => now(),
        'updated_at' => now(),
    ])->all());

    $freeProps = $this->actingAs(User::factory()->create())
        ->get(route('words.cloze', ['count' => 50]))->viewData('page')['props'];
    expect($freeProps['items'])->toHaveCount(10)
        ->and($freeProps['freeClozeLimit'])->toBe(10);

    $premiumProps = $this->actingAs(User::factory()->premium()->create())
        ->get(route('words.cloze', ['count' => 50]))->viewData('page')['props'];
    expect($premiumProps['items'])->toHaveCount(40)
        ->and($premiumProps['freeClozeLimit'])->toBeNull();
});

test('daily text analysis is capped per plan', function (string $state, int $limit) {
    $user = $state === 'free'
        ? User::factory()->create()
        : User::factory()->{$state}()->create();

    $cacheKey = "text_analysis_daily_{$user->id}_".today()->format('Y-m-d');

    // One below the cap still succeeds.
    Cache::put($cacheKey, $limit - 1, now()->endOfDay());
    $this->actingAs($user)
        ->postJson(route('text-analysis.analyze'), ['text' => 'the quick dog'])
        ->assertOk();

    // At the cap it is blocked.
    Cache::put($cacheKey, $limit, now()->endOfDay());
    $this->actingAs($user)
        ->postJson(route('text-analysis.analyze'), ['text' => 'the quick dog'])
        ->assertForbidden()
        ->assertJson(['error' => 'limit_reached']);
})->with([
    'free' => ['free', 2],
    'premium' => ['premium', 50],
]);

test('a failed text analysis does not consume the daily quota', function () {
    $user = User::factory()->create();
    $cacheKey = "text_analysis_daily_{$user->id}_".today()->format('Y-m-d');

    $this->mock(AchievementService::class)
        ->shouldReceive('checkAndAwardAnalysis')
        ->andThrow(new RuntimeException('analysis blew up'));

    $this->withoutExceptionHandling();

    expect(fn () => $this->actingAs($user)
        ->postJson(route('text-analysis.analyze'), ['text' => 'the quick dog'])
    )->toThrow(RuntimeException::class);

    expect(Cache::get($cacheKey))->toBe(0);
});

test('saved book limit is reported per plan', function (string $state, int $limit) {
    $user = $state === 'free'
        ? User::factory()->create()
        : User::factory()->{$state}()->create();

    $this->actingAs($user)
        ->getJson(route('text-analysis.books.index'))
        ->assertOk()
        ->assertJsonPath('bookLimit', $limit);
})->with([
    'free' => ['free', 1],
    'premium' => ['premium', 7],
]);

test('saved youtube transcript limit is reported per plan', function (string $state, int $limit) {
    $user = $state === 'free'
        ? User::factory()->create()
        : User::factory()->{$state}()->create();

    $this->actingAs($user)
        ->getJson(route('text-analysis.youtube.index'))
        ->assertOk()
        ->assertJsonPath('youtubeLimit', $limit);
})->with([
    'free' => ['free', 3],
    'premium' => ['premium', 40],
]);
