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

    expect($deck->flashcards()->count())->toBe(1);
    expect($deck->flashcards()->first()->front)->toContain('ok');
});

test('CSV import is rejected when it would exceed the plan card budget', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $deck->flashcards()->insert(collect(range(1, 49))->map(fn ($i) => [
        'deck_id' => $deck->id,
        'front' => "f{$i}",
        'back' => "b{$i}",
        'direction' => 'front_to_back',
        'created_at' => now(),
        'updated_at' => now(),
    ])->all());

    $csv = UploadedFile::fake()->createWithContent('cards.csv', "one,egy\ntwo,kettő\n");

    $this->actingAs($user)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $csv])
        ->assertRedirect()
        ->assertSessionHas('error');

    expect($deck->flashcards()->count())->toBe(49);
});

test('CSV import normalizes Windows-1252 encoded fields to UTF-8', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $csv = UploadedFile::fake()->createWithContent(
        'cards.csv',
        "k\xe1v\xe9,k\xf6sz\xf6n\xf6m\n"
    );

    $this->actingAs($user)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $csv])
        ->assertRedirect(route('flashcards.show', $deck));

    $card = $deck->flashcards()->first();
    expect($card->front)->toContain('kávé');
    expect($card->back)->toContain('köszönöm');
});

test('CSV import leaves already-UTF-8 fields untouched', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $csv = UploadedFile::fake()->createWithContent('cards.csv', "kávé,étkező\n");

    $this->actingAs($user)
        ->post(route('flashcards.csv.import', $deck), ['csv_file' => $csv])
        ->assertRedirect(route('flashcards.show', $deck));

    $card = $deck->flashcards()->first();
    expect($card->front)->toContain('kávé');
    expect($card->back)->toContain('étkező');
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
