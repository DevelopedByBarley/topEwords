<?php

use App\Models\User;
use App\Models\UserCustomWord;

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
        'status' => 'known',
    ])->assertRedirect();

    expect(UserCustomWord::where('word', 'ephemeral')->count())->toBe(2);
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
