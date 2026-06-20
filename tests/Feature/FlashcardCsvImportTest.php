<?php

use App\Models\FlashcardDeck;
use App\Models\User;
use Illuminate\Http\UploadedFile;

test('user can import valid rows from a CSV', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $csv = UploadedFile::fake()->createWithContent('cards.csv', "hello,szia\nworld,világ\n");

    $this->actingAs($user)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $csv])
        ->assertRedirect(route('flashcards.show', $deck));

    expect($deck->flashcards()->count())->toBe(2);
});

test('CSV import skips rows whose field exceeds the length cap', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $tooLong = str_repeat('a', 10001);
    $csv = UploadedFile::fake()->createWithContent('cards.csv', "{$tooLong},back\nok,fine\n");

    $this->actingAs($user)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $csv])
        ->assertRedirect();

    // The oversized row is skipped; the valid one is imported.
    expect($deck->flashcards()->count())->toBe(1);
    expect($deck->flashcards()->first()->front)->toContain('ok');
});

test('user cannot import into another users deck', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $owner->id, 'name' => 'Secret']);

    $csv = UploadedFile::fake()->createWithContent('cards.csv', "a,b\n");

    $this->actingAs($other)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $csv])
        ->assertForbidden();

    expect($deck->flashcards()->count())->toBe(0);
});
