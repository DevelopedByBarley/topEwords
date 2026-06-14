<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    Word::insert([
        ['word' => 'the', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

test('streak starts at zero', function () {
    $this->user->refresh();
    expect($this->user->streak)->toBe(0);
    expect($this->user->last_activity_date)->toBeNull();
});

test('first word interaction starts streak at 1', function () {
    $word = Word::first();

    $this->post(route('words.status', $word), ['status' => 'known']);

    $this->user->refresh();
    expect($this->user->streak)->toBe(1);
    expect($this->user->last_activity_date->isToday())->toBeTrue();
});

test('same day interaction does not increase streak', function () {
    $word = Word::first();
    $this->user->update(['streak' => 3, 'last_activity_date' => Carbon::today()]);

    $this->post(route('words.status', $word), ['status' => 'known']);

    $this->user->refresh();
    expect($this->user->streak)->toBe(3);
});

test('consecutive day interaction increases streak', function () {
    $word = Word::first();
    $this->user->update(['streak' => 5, 'last_activity_date' => Carbon::yesterday()]);

    $this->post(route('words.status', $word), ['status' => 'known']);

    $this->user->refresh();
    expect($this->user->streak)->toBe(6);
});

test('gap in days resets streak to 1', function () {
    $word = Word::first();
    $this->user->update(['streak' => 10, 'last_activity_date' => Carbon::today()->subDays(3)]);

    $this->post(route('words.status', $word), ['status' => 'known']);

    $this->user->refresh();
    expect($this->user->streak)->toBe(1);
});

test('removing a word status does not update streak', function () {
    $word = Word::first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);
    $this->user->update(['streak' => 5, 'last_activity_date' => Carbon::yesterday()]);

    $this->post(route('words.status', $word), ['status' => 'known']);

    $this->user->refresh();
    expect($this->user->streak)->toBe(5);
});

test('streak_triggered is flashed when streak updates', function () {
    $word = Word::first();

    $this->post(route('words.status', $word), ['status' => 'known']);

    expect(session('streak_triggered'))->toBe(1);
});

test('streak_triggered is not flashed when already active today', function () {
    Word::insert([['word' => 'hello', 'rank' => 2, 'created_at' => now(), 'updated_at' => now()]]);
    $word2 = Word::where('word', 'hello')->first();
    $this->user->update(['streak' => 3, 'last_activity_date' => Carbon::today()]);

    $this->post(route('words.status', $word2), ['status' => 'known']);

    expect(session('streak_triggered'))->toBeNull();
});

test('dashboard includes streak', function () {
    $this->user->update(['streak' => 7]);

    $this->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page
            ->component('dashboard')
            ->where('streak', 7)
        );
});
