<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->user = User::factory()->create();

    Word::insert([
        ['word' => 'apple', 'meaning_hu' => 'alma', 'synonyms' => 'fruit', 'example_en' => 'I ate an apple.', 'example_hu' => 'Megettem egy almát.', 'verb_past' => null, 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'appear', 'meaning_hu' => 'megjelenik', 'synonyms' => null, 'example_en' => null, 'example_hu' => null, 'verb_past' => null, 'rank' => 2, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'run', 'meaning_hu' => 'fut', 'synonyms' => null, 'example_en' => null, 'example_hu' => null, 'verb_past' => 'ran', 'rank' => 3, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

test('lookup requires authentication', function () {
    $this->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertUnauthorized()
        ->assertJson(['error' => 'unauthenticated']);
});

test('lookup returns word with synonyms and example sentences', function () {
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'word' => 'apple',
            'meaning_hu' => 'alma',
            'synonyms' => 'fruit',
            'example_en' => 'I ate an apple.',
            'example_hu' => 'Megettem egy almát.',
            'is_custom' => false,
        ]);
});

test('lookup matches inflected verb forms', function () {
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'ran']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'word' => 'run']);
});

test('lookup finds custom words with example fields', function () {
    $this->user->customWords()->create([
        'word' => 'serendipity',
        'meaning_hu' => 'véletlen szerencse',
        'synonyms' => 'luck',
        'example_en' => 'What a serendipity!',
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'serendipity']))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'is_custom' => true,
            'synonyms' => 'luck',
            'example_en' => 'What a serendipity!',
        ]);
});

test('lookup reports not found for unknown words', function () {
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'xyzzy']))
        ->assertSuccessful()
        ->assertJson(['found' => false, 'word' => 'xyzzy']);
});

test('search returns prefix matches ordered by rank', function () {
    $response = $this->actingAs($this->user)
        ->getJson(route('extension.search', ['q' => 'app']))
        ->assertSuccessful()
        ->json();

    expect(collect($response['results'])->pluck('word')->all())->toBe(['apple', 'appear']);
});

test('search treats like wildcards literally', function () {
    $response = $this->actingAs($this->user)
        ->getJson(route('extension.search', ['q' => '%']))
        ->assertSuccessful()
        ->json();

    expect($response['results'])->toBeEmpty();
});

test('add-word creates a custom word', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), [
            'word' => 'serendipity',
            'meaning_hu' => 'véletlen szerencse',
            'part_of_speech' => 'noun',
            'noun_plural' => 'serendipities',
        ])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'word' => 'serendipity']);

    expect($this->user->customWords()->where('word', 'serendipity')->exists())->toBeTrue();
});

test('add-word stores the chosen status and importance', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), [
            'word' => 'serendipity',
            'meaning_hu' => 'véletlen szerencse',
            'status' => 'practice',
            'importance' => 4,
        ])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);

    $custom = $this->user->customWords()->where('word', 'serendipity')->first();
    expect($custom->status)->toBe('practice');
    expect($custom->importance)->toBe(4);
});

test('add-word defaults to known status when none chosen', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity'])
        ->assertSuccessful();

    expect($this->user->customWords()->where('word', 'serendipity')->first()->status)->toBe('known');
});

test('add-word rejects an invalid status', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'status' => 'bogus'])
        ->assertStatus(422);
});

test('add-word rejects duplicates', function () {
    $this->user->customWords()->create(['word' => 'serendipity']);

    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity'])
        ->assertSuccessful()
        ->assertJson(['error' => 'duplicate']);
});

test('statuses returns the user word status map', function () {
    $apple = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($apple->id, ['status' => 'learning']);
    $this->user->customWords()->create(['word' => 'serendipity', 'status' => 'known']);

    $this->actingAs($this->user)
        ->getJson(route('extension.statuses'))
        ->assertSuccessful()
        ->assertJson([
            'statuses' => [
                'apple' => 'learning',
                'serendipity' => 'known',
            ],
        ]);
});

test('statuses includes multi-word phrases without hijacking single words', function () {
    // A kifejezés bekerül a térképbe, de a ragozott-alak oszlopai (form_base "use")
    // nem mappelhetik a sima "use" szót a kifejezés státuszára.
    $this->user->customWords()->create([
        'word' => 'used to',
        'status' => 'practice',
        'form_base' => 'use',
    ]);

    $response = $this->actingAs($this->user)
        ->getJson(route('extension.statuses'))
        ->assertSuccessful()
        ->assertJson(['statuses' => ['used to' => 'practice']]);

    expect($response->json('statuses'))->not->toHaveKey('use');
    expect($response->json('statuses'))->not->toHaveKey('used');
});

test('badge counts learning words including custom ones', function () {
    $apple = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($apple->id, ['status' => 'learning']);
    $this->user->customWords()->create(['word' => 'serendipity', 'status' => 'learning']);
    $this->user->customWords()->create(['word' => 'other', 'status' => 'known']);

    $this->actingAs($this->user)
        ->getJson(route('extension.badge'))
        ->assertSuccessful()
        ->assertJson(['count' => 2]);
});

test('frequent extension reads do not exhaust the add-word limit', function () {
    // A read végpontok (ext-read vödör) nem oszthatják az add-word (ext-write)
    // limitjét — különben a gyakori lookup/statuses hívások blokkolnák a felvitelt.
    for ($i = 0; $i < 25; $i++) {
        $this->actingAs($this->user)
            ->getJson(route('extension.statuses'))
            ->assertSuccessful();
    }

    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'isolationtest'])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);
});

test('youtube transcript is gated behind premium access', function () {
    Http::fake();

    $this->actingAs($this->user) // free plan
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertStatus(403)
        ->assertJson(['error' => 'premium']);

    Http::assertNothingSent();
});

test('youtube transcript validates the video id', function () {
    Http::fake();

    $this->actingAs(User::factory()->premium()->create())
        ->getJson(route('extension.youtube-transcript', ['v' => 'too-short']))
        ->assertStatus(422)
        ->assertJson(['error' => 'invalid_video_id']);
});

test('youtube transcript returns timestamped segments for premium users', function () {
    Http::fake([
        '*api/timedtext*' => Http::response('{"events":[{"tStartMs":0,"segs":[{"utf8":"hello world"}]},{"tStartMs":2000,"segs":[{"utf8":"second line"}]}]}'),
        '*youtube.com/watch*' => Http::response('<html><head><title>Test Video - YouTube</title></head></html>'),
        '*' => Http::response(''),
    ]);

    $this->actingAs(User::factory()->premium()->create())
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertSuccessful()
        ->assertJson([
            'title' => 'Test Video',
            'segments' => [
                ['t' => 0, 'x' => 'hello world'],
                ['t' => 2, 'x' => 'second line'],
            ],
        ]);
});
