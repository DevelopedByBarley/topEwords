<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Auth;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

function clozeProps($test, array $params = []): array
{
    return $test->get(route('words.cloze', $params))->viewData('page')['props'];
}

/**
 * @param  int  $count  Hány szó készüljön
 * @param  bool  $usable  Szerepeljen-e a szó a saját példamondatában
 */
function insertClozeWords(int $count, bool $usable = true, string $prefix = 'clz'): void
{
    Word::insert(collect(range(1, $count))->map(fn ($i) => [
        'word' => "{$prefix}{$i}",
        'meaning_hu' => "jelentés{$i}",
        'example_en' => $usable ? "This is {$prefix}{$i} indeed." : 'A sentence without the target.',
        'rank' => $i,
        'created_at' => now(),
        'updated_at' => now(),
    ])->all());
}

test('cloze manual ids selection is capped at the plan limit for free users', function () {
    insertClozeWords(15);

    $ids = Word::pluck('id')->implode(',');
    $props = clozeProps($this, ['ids' => $ids]);

    expect($props['items'])->toHaveCount(10)
        ->and($props['freeClozeLimit'])->toBe(10);
});

test('cloze manual ids selection is capped at the 500 technical ceiling for premium', function () {
    $this->actingAs(User::factory()->premium()->create());
    insertClozeWords(505);

    $ids = Word::pluck('id')->implode(',');
    $props = clozeProps($this, ['ids' => $ids]);

    expect($props['items'])->toHaveCount(500)
        ->and($props['freeClozeLimit'])->toBeNull();
});

test('words whose example does not contain any form are dropped and reported via missingCount', function () {
    insertClozeWords(1, usable: true, prefix: 'good');
    insertClozeWords(1, usable: false, prefix: 'bad');

    $ids = Word::pluck('id')->implode(',');
    $props = clozeProps($this, ['ids' => $ids]);

    expect($props['items'])->toHaveCount(1)
        ->and($props['items'][0]['word'])->toBe('good1')
        ->and($props['missingCount'])->toBe(1);
});

test('count mode backfills dropped words from the overfetched pool', function () {
    insertClozeWords(3, usable: true, prefix: 'good');
    insertClozeWords(1, usable: false, prefix: 'bad');

    $props = clozeProps($this, ['count' => 2]);

    expect($props['items'])->toHaveCount(2)
        ->and($props['missingCount'])->toBe(0);
});

test('count mode reports the shortfall when the pool is exhausted', function () {
    insertClozeWords(1, usable: true, prefix: 'good');
    insertClozeWords(2, usable: false, prefix: 'bad');

    $props = clozeProps($this, ['count' => 3]);

    expect($props['items'])->toHaveCount(1)
        ->and($props['missingCount'])->toBe(2);
});

test('cloze complete updates the streak and returns achievements', function () {
    expect((int) $this->user->streak)->toBe(0);

    $this->postJson(route('words.cloze.complete'))
        ->assertOk()
        ->assertJsonStructure(['achievements']);

    $this->user->refresh();

    expect($this->user->streak)->toBe(1)
        ->and($this->user->last_activity_date?->isToday())->toBeTrue();
});

test('cloze complete does not double-count the same day', function () {
    $this->postJson(route('words.cloze.complete'))->assertOk();
    $this->postJson(route('words.cloze.complete'))->assertOk();

    expect($this->user->refresh()->streak)->toBe(1);
});

test('cloze complete requires authentication', function () {
    Auth::logout();

    $this->post(route('words.cloze.complete'))->assertRedirect(route('login'));
});

test('setup does not flag truncation when the selectable list fits', function () {
    insertClozeWords(20);

    $props = clozeProps($this);

    expect($props['selectableWords'])->toHaveCount(20)
        ->and($props['selectableTruncated'])->toBeFalse();
});

test('setup flags truncation when more than 500 regular words match', function () {
    insertClozeWords(501);

    $props = clozeProps($this);

    expect($props['selectableWords'])->toHaveCount(500)
        ->and($props['selectableTruncated'])->toBeTrue();
});
