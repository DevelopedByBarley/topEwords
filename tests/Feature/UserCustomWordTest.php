<?php

use App\Models\User;
use App\Models\UserCustomWord;
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

test('guests cannot access custom words routes', function () {
    auth()->logout();

    $this->post(route('custom-words.store'), ['word' => 'test', 'status' => 'learning'])
        ->assertRedirect(route('login'));
});
