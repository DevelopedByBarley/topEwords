<?php

use App\Models\User;
use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);
});

test('user can add a custom word', function () {
    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
        'status' => 'learning',
    ])->assertRedirect();

    $this->assertDatabaseHas('user_custom_words', [
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
        'status' => 'learning',
    ]);
});

test('custom word persists form columns across word classes', function () {
    // "interest" is primarily a noun, but also a verb. Its verb forms must be
    // saved even though part_of_speech is "noun", so analysis/highlighting can
    // recognise "interested"/"interesting" too.
    $this->post(route('custom-words.store'), [
        'word' => 'interest',
        'meaning_hu' => 'érdeklődés',
        'part_of_speech' => 'noun',
        'status' => 'known',
        'noun_plural' => 'interests',
        'verb_past' => 'interested',
        'verb_past_participle' => 'interested',
        'verb_present_participle' => 'interesting',
        'verb_third_person' => 'interests',
    ])->assertRedirect();

    $this->assertDatabaseHas('user_custom_words', [
        'user_id' => $this->user->id,
        'word' => 'interest',
        'part_of_speech' => 'noun',
        'noun_plural' => 'interests',
        'verb_past' => 'interested',
        'verb_present_participle' => 'interesting',
        'verb_third_person' => 'interests',
    ]);
});

test('a 500 character example sentence is accepted and persisted', function () {
    $example = str_repeat('a', 500);

    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
        'status' => 'learning',
        'example_en' => $example,
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect(UserCustomWord::where('user_id', $this->user->id)->where('word', 'ephemeral')->value('example_en'))
        ->toBe($example);
});

test('an example sentence over 500 characters is rejected with a validation error', function () {
    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
        'status' => 'learning',
        'example_en' => str_repeat('a', 501),
    ])->assertSessionHasErrors('example_en');

    $this->assertDatabaseMissing('user_custom_words', [
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
    ]);
});

test('duplicate word for same user is rejected', function () {
    UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'status' => 'known',
    ])->assertSessionHasErrors('word');
});

test('different users can have the same custom word', function () {
    $other = User::factory()->create();
    UserCustomWord::create(['user_id' => $other->id, 'word' => 'ephemeral', 'status' => 'learning']);

    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
        'status' => 'known',
    ])->assertRedirect();

    expect(UserCustomWord::where('word', 'ephemeral')->count())->toBe(2);
});

test('JSON store request reports validation failure as 422 with a message', function () {
    // A szóelemző dialógus (word-lookup-dialog.tsx) erre a szerződésre épít:
    // JSON-kérésnél a validációs hiba 422 + kitöltött `message` mező.
    $this->postJson(route('custom-words.store'), [
        'word' => 'ephemeral',
        'status' => 'known',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('meaning_hu')
        ->assertJson(fn ($json) => $json->whereType('message', 'string')->etc());
});

test('meaning_hu is required when adding a custom word', function () {
    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'status' => 'known',
    ])->assertSessionHasErrors('meaning_hu');

    $this->assertDatabaseMissing('user_custom_words', [
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
    ]);
});

test('user can update their custom word', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->patch(route('custom-words.update', $word), [
        'meaning_hu' => 'múlandó',
    ])->assertRedirect();

    expect($word->fresh()->meaning_hu)->toBe('múlandó');
});

test('renaming a custom word to another own custom word is rejected with validation error', function () {
    UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'serendipity',
        'status' => 'learning',
    ]);

    $this->patch(route('custom-words.update', $word), [
        'word' => 'ephemeral',
    ])->assertSessionHasErrors('word');

    expect($word->fresh()->word)->toBe('serendipity');
});

test('updating a custom word without renaming passes the uniqueness check', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->patch(route('custom-words.update', $word), [
        'word' => 'ephemeral',
        'meaning_hu' => 'múlandó',
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect($word->fresh()->meaning_hu)->toBe('múlandó');
});

test('renaming a custom word to a main list word form is rejected', function () {
    Word::create(['word' => 'run', 'rank' => 5000, 'verb_past' => 'ran']);

    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->patch(route('custom-words.update', $word), ['word' => 'run'])
        ->assertSessionHasErrors('word');

    $this->patch(route('custom-words.update', $word), ['word' => 'Ran'])
        ->assertSessionHasErrors('word');

    expect($word->fresh()->word)->toBe('ephemeral');
});

test('custom word stays editable if its word later appears in the main list', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'run',
        'status' => 'learning',
    ]);

    Word::create(['word' => 'run', 'rank' => 5000]);

    $this->patch(route('custom-words.update', $word), [
        'word' => 'run',
        'meaning_hu' => 'futni',
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect($word->fresh()->meaning_hu)->toBe('futni');
});

test('renaming a custom word to another users custom word is allowed', function () {
    $other = User::factory()->create();
    UserCustomWord::create(['user_id' => $other->id, 'word' => 'ephemeral', 'status' => 'learning']);

    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'serendipity',
        'status' => 'learning',
    ]);

    $this->patch(route('custom-words.update', $word), ['word' => 'ephemeral'])
        ->assertRedirect()->assertSessionHasNoErrors();

    expect($word->fresh()->word)->toBe('ephemeral');
});

test('user cannot update another users custom word', function () {
    $other = User::factory()->create();
    $word = UserCustomWord::create([
        'user_id' => $other->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->patch(route('custom-words.update', $word), [
        'meaning_hu' => 'múlandó',
    ])->assertForbidden();
});

test('user can change status of custom word', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->post(route('custom-words.status', $word), ['status' => 'known'])
        ->assertRedirect();

    expect($word->fresh()->status)->toBe('known');
});

test('toggling same status removes the status (sets to null)', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'known',
    ]);

    $this->post(route('custom-words.status', $word), ['status' => 'known'])
        ->assertRedirect();

    expect($word->fresh()->status)->toBeNull();
});

test('extension-origin custom word status write consumes the daily extension quota and blocks over it', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => null,
    ]);

    $this->postJson(route('custom-words.status', $word), ['status' => 'known'], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect($this->user->extensionWritesToday())->toBe(1);

    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('custom-words.status', $word), ['status' => 'learning'], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    expect($word->fresh()->status)->toBe('known');
});

test('extension JSON request gets a JSON ack for custom word status', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => null,
    ]);

    $this->postJson(route('custom-words.status', $word), ['status' => 'known'])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => 'known', 'forms' => ['ephemeral']]);

    expect($word->fresh()->status)->toBe('known');
});

test('custom word importance returns JSON for extension/JSON callers', function () {
    // Ugyanaz a hiba, mint a globális szónál: a fetch a redirectet HTML-oldalra
    // követte volna. A JSON-ág kell, hogy a csillagozás ne mutasson hamis hibát.
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->postJson(route('custom-words.importance', $word), ['importance' => 4])
        ->assertOk()
        ->assertJson(['ok' => true, 'importance' => 4]);

    expect($word->fresh()->importance)->toBe(4);
});

test('web (inertia) custom word importance still redirects', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->post(route('custom-words.importance', $word), ['importance' => 2], ['X-Inertia' => 'true', 'X-Requested-With' => 'XMLHttpRequest'])
        ->assertRedirect();

    expect($word->fresh()->importance)->toBe(2);
});

test('user cannot set importance on another users custom word', function () {
    $other = User::factory()->create();
    $word = UserCustomWord::create([
        'user_id' => $other->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->postJson(route('custom-words.importance', $word), ['importance' => 4])
        ->assertForbidden();
});

test('empty status removes a custom word status (extension un-toggle)', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'saved',
    ]);

    $this->postJson(route('custom-words.status', $word), ['status' => ''])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => null, 'forms' => ['ephemeral']]);

    expect($word->fresh()->status)->toBeNull();
});

test('user can delete their custom word', function () {
    $word = UserCustomWord::create([
        'user_id' => $this->user->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->delete(route('custom-words.destroy', $word))->assertRedirect();

    $this->assertModelMissing($word);
});

test('user cannot delete another users custom word', function () {
    $other = User::factory()->create();
    $word = UserCustomWord::create([
        'user_id' => $other->id,
        'word' => 'ephemeral',
        'status' => 'learning',
    ]);

    $this->delete(route('custom-words.destroy', $word))->assertForbidden();
});

test('extension-origin custom word creation consumes the daily extension quota and blocks over it', function () {
    // M4: az /extension/add-word megkerülhető lenne a webes custom-words.store-ra
    // váltva; extension-originből ez az út is a közös napi keretbe számít.
    $this->postJson(route('custom-words.store'), [
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
    ], ['Origin' => 'chrome-extension://abcdefghijklmnop'])->assertRedirect();

    expect($this->user->extensionWritesToday())->toBe(1);

    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('custom-words.store'), [
        'word' => 'serendipity',
        'meaning_hu' => 'szerencsés véletlen',
    ], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    $this->assertDatabaseMissing('user_custom_words', [
        'user_id' => $this->user->id,
        'word' => 'serendipity',
    ]);
});

test('web-origin custom word creation does not consume the extension quota', function () {
    // A weboldalról (nem extension-origin) indított felvétel nem fogyaszt keretet.
    $this->post(route('custom-words.store'), [
        'word' => 'ephemeral',
        'meaning_hu' => 'illékony',
    ])->assertRedirect();

    expect($this->user->extensionWritesToday())->toBe(0);
});

test('guests cannot access custom words routes', function () {
    auth()->logout();

    $this->post(route('custom-words.store'), ['word' => 'test', 'status' => 'learning'])
        ->assertRedirect(route('login'));
});
