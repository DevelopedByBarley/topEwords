<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Cache;

test('every plan defines every limit key so a typo key never becomes unlimited', function () {
    $limits = config('plans.limits');
    $keys = array_keys($limits['free']);

    foreach (['free', 'basic', 'premium'] as $plan) {
        expect(array_keys($limits[$plan]))->toEqualCanonicalizing($keys);
    }
});

test('planLimit reads the limit for the current plan', function () {
    expect(User::factory()->create()->planLimit('decks'))->toBe(5)
        ->and(User::factory()->basic()->create()->planLimit('decks'))->toBe(50)
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

test('basic user gets the higher deck allowance', function () {
    $user = User::factory()->basic()->create();
    $user->flashcardDecks()->createMany(collect(range(1, 5))->map(fn ($i) => ['name' => "D{$i}"])->all());

    $this->actingAs($user)
        ->post(route('flashcards.store'), ['name' => 'Hatodik'])
        ->assertSessionHasNoErrors();

    expect($user->flashcardDecks()->count())->toBe(6);
});

test('extension writes are gated to paid plans', function () {
    expect(User::factory()->create()->canWriteFromExtension())->toBeFalse()
        ->and(User::factory()->basic()->create()->canWriteFromExtension())->toBeTrue()
        ->and(User::factory()->premium()->create()->canWriteFromExtension())->toBeTrue();
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

    $basicProps = $this->actingAs(User::factory()->basic()->create())
        ->get(route('words.quiz', ['count' => 50]))->viewData('page')['props'];
    expect($basicProps['words'])->toHaveCount(40)
        ->and($basicProps['freeQuizLimit'])->toBe(100);

    $premiumProps = $this->actingAs(User::factory()->premium()->create())
        ->get(route('words.quiz', ['count' => 50]))->viewData('page')['props'];
    expect($premiumProps['freeQuizLimit'])->toBeNull();
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
    expect($freeProps['items'])->toHaveCount(5)
        ->and($freeProps['freeClozeLimit'])->toBe(5);

    $basicProps = $this->actingAs(User::factory()->basic()->create())
        ->get(route('words.cloze', ['count' => 50]))->viewData('page')['props'];
    expect($basicProps['items'])->toHaveCount(40)
        ->and($basicProps['freeClozeLimit'])->toBe(100);

    $premiumProps = $this->actingAs(User::factory()->premium()->create())
        ->get(route('words.cloze', ['count' => 50]))->viewData('page')['props'];
    expect($premiumProps['freeClozeLimit'])->toBeNull();
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
    'basic' => ['basic', 20],
    'premium' => ['premium', 50],
]);

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
    'basic' => ['basic', 2],
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
    'basic' => ['basic', 15],
    'premium' => ['premium', 40],
]);
