<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    // Alap: Pro felhasználó, hogy a napi írás-keret ne szóljon bele az alap-
    // esetekbe; a Free-kvótát külön tesztek fedik le. A player végpontokat a
    // lejátszó `player` ability-jű Sanctum tokennel hívja.
    $this->user = User::factory()->premium()->create();

    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'verb_past' => null, 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'run', 'meaning_hu' => 'fut', 'verb_past' => 'ran', 'rank' => 2, 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->apple = Word::where('word', 'apple')->firstOrFail();
});

// ── Auth ─────────────────────────────────────────────────────────────────────

test('update-status requires authentication', function () {
    $this->postJson(route('player.update-status'), ['id' => 1, 'is_custom' => false, 'status' => 'known'])
        ->assertUnauthorized();
});

test('update-status rejects tokens without the player ability', function () {
    Sanctum::actingAs($this->user, ['other-ability']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => 'known'])
        ->assertForbidden();
});

test('update-importance requires authentication', function () {
    $this->postJson(route('player.update-importance'), ['id' => 1, 'is_custom' => false, 'importance' => 3])
        ->assertUnauthorized();
});

// ── Státusz: szótári szó ─────────────────────────────────────────────────────

test('update-status sets a status on a dictionary word', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => 'learning'])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'status' => 'learning']);

    $pivot = $this->user->knownWords()->wherePivot('word_id', $this->apple->id)->first()?->pivot;

    expect($pivot->status)->toBe('learning');
});

test('update-status returns the surface forms of the changed word', function () {
    Sanctum::actingAs($this->user, ['player']);

    $run = Word::where('word', 'run')->firstOrFail();

    $forms = $this->postJson(route('player.update-status'), ['id' => $run->id, 'is_custom' => false, 'status' => 'known'])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'status' => 'known'])
        ->json('forms');

    expect($forms)->toContain('run')->toContain('ran');
});

test('re-sending the active status removes it', function () {
    Sanctum::actingAs($this->user, ['player']);
    $this->user->knownWords()->attach($this->apple->id, ['status' => 'learning']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => 'learning'])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'status' => null]);

    expect($this->user->knownWords()->wherePivot('word_id', $this->apple->id)->exists())->toBeFalse();
});

test('an empty status removes the marking', function () {
    Sanctum::actingAs($this->user, ['player']);
    $this->user->knownWords()->attach($this->apple->id, ['status' => 'known']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => ''])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'status' => null]);

    expect($this->user->knownWords()->wherePivot('word_id', $this->apple->id)->exists())->toBeFalse();
});

test('update-status rejects an invalid status value', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => 'hacked'])
        ->assertUnprocessable();
});

test('update-status returns 404 for an unknown word id', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-status'), ['id' => 999999, 'is_custom' => false, 'status' => 'known'])
        ->assertNotFound();
});

test('update-status updates the streak when a status is set', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => 'known'])
        ->assertSuccessful();

    expect($this->user->refresh()->streak)->toBe(1)
        ->and($this->user->last_activity_date?->isToday())->toBeTrue();
});

// ── Státusz: saját szó ───────────────────────────────────────────────────────

test('update-status sets a status on an own custom word', function () {
    Sanctum::actingAs($this->user, ['player']);
    $custom = $this->user->customWords()->create(['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse']);

    $this->postJson(route('player.update-status'), ['id' => $custom->id, 'is_custom' => true, 'status' => 'saved'])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'status' => 'saved']);

    expect($custom->refresh()->status)->toBe('saved');
});

test('update-status cannot touch another user\'s custom word', function () {
    Sanctum::actingAs($this->user, ['player']);
    $other = User::factory()->create();
    $foreign = $other->customWords()->create(['word' => 'secret', 'meaning_hu' => 'titok', 'status' => 'known']);

    $this->postJson(route('player.update-status'), ['id' => $foreign->id, 'is_custom' => true, 'status' => 'learning'])
        ->assertNotFound();

    expect($foreign->refresh()->status)->toBe('known');
});

// ── Státusz: napi írás-keret ─────────────────────────────────────────────────

test('status set is blocked once a free user exhausts the daily write quota', function () {
    $free = User::factory()->create();
    $limit = $free->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());
    Sanctum::actingAs($free, ['player']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => 'known'])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    expect($free->knownWords()->wherePivot('word_id', $this->apple->id)->exists())->toBeFalse();
});

test('status removal is allowed even with an exhausted quota', function () {
    $free = User::factory()->create();
    $free->knownWords()->attach($this->apple->id, ['status' => 'known']);
    $limit = $free->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());
    Sanctum::actingAs($free, ['player']);

    $this->postJson(route('player.update-status'), ['id' => $this->apple->id, 'is_custom' => false, 'status' => ''])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'status' => null]);
});

// ── Fontosság ────────────────────────────────────────────────────────────────

test('update-importance sets importance on an already marked word', function () {
    Sanctum::actingAs($this->user, ['player']);
    $this->user->knownWords()->attach($this->apple->id, ['status' => 'learning']);

    $this->postJson(route('player.update-importance'), ['id' => $this->apple->id, 'is_custom' => false, 'importance' => 4])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'importance' => 4]);

    $pivot = $this->user->knownWords()->wherePivot('word_id', $this->apple->id)->first()->pivot;

    expect($pivot->importance)->toBe(4)
        ->and($pivot->status)->toBe('learning');
});

test('update-importance marks an unmarked word as known', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-importance'), ['id' => $this->apple->id, 'is_custom' => false, 'importance' => 5])
        ->assertSuccessful();

    $pivot = $this->user->knownWords()->wherePivot('word_id', $this->apple->id)->first()->pivot;

    expect($pivot->status)->toBe('known')
        ->and($pivot->importance)->toBe(5);
});

test('removing importance from an unmarked word does not create a marking', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-importance'), ['id' => $this->apple->id, 'is_custom' => false, 'importance' => null])
        ->assertSuccessful();

    expect($this->user->knownWords()->wherePivot('word_id', $this->apple->id)->exists())->toBeFalse();
});

test('update-importance sets importance on an own custom word', function () {
    Sanctum::actingAs($this->user, ['player']);
    $custom = $this->user->customWords()->create(['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse']);

    $this->postJson(route('player.update-importance'), ['id' => $custom->id, 'is_custom' => true, 'importance' => 2])
        ->assertSuccessful();

    expect($custom->refresh()->importance)->toBe(2);
});

test('update-importance cannot touch another user\'s custom word', function () {
    Sanctum::actingAs($this->user, ['player']);
    $other = User::factory()->create();
    $foreign = $other->customWords()->create(['word' => 'secret', 'meaning_hu' => 'titok']);

    $this->postJson(route('player.update-importance'), ['id' => $foreign->id, 'is_custom' => true, 'importance' => 5])
        ->assertNotFound();

    expect($foreign->refresh()->importance)->toBeNull();
});

test('update-importance rejects an out-of-range value', function () {
    Sanctum::actingAs($this->user, ['player']);

    $this->postJson(route('player.update-importance'), ['id' => $this->apple->id, 'is_custom' => false, 'importance' => 6])
        ->assertUnprocessable();
});
