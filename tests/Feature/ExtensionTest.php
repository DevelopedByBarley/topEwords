<?php

use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    // Alap: Pro (korlátlan) felhasználó, hogy a bővítmény írás-végpontjai
    // (add-word, create-flashcard) ne ütközzenek a napi keretbe. Az olvasás
    // mindenkinek megy; a Free napi írás-kvótáját külön tesztek fedik le.
    $this->user = User::factory()->premium()->create();

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

test('lookup matches slash-separated alternative verb forms', function () {
    Word::create([
        'word' => 'get',
        'meaning_hu' => 'kap',
        'verb_past' => 'got',
        'verb_past_participle' => 'got/gotten',
        'rank' => 4,
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'gotten']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'word' => 'get']);
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

test('lookup finds a custom phrase clicked from captions with NBSP separators', function () {
    $this->user->customWords()->create([
        'word' => 'get rid of',
        'meaning_hu' => 'megszabadul valamitől',
        'status' => 'saved',
    ]);

    // A felirat-tokenek NBSP-vel jönnek; a lookupnak normalizálnia kell.
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => "get\u{00A0}rid\u{00A0}of"]))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'is_custom' => true,
            'word' => 'get rid of',
            'meaning_hu' => 'megszabadul valamitől',
        ]);
});

test('add-word normalizes phrase whitespace before storing', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => "get\u{00A0}rid  of", 'meaning_hu' => 'megszabadul valamitől'])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'word' => 'get rid of']);

    expect($this->user->customWords()->where('word', 'get rid of')->exists())->toBeTrue();
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
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse'])
        ->assertSuccessful();

    expect($this->user->customWords()->where('word', 'serendipity')->first()->status)->toBe('known');
});

test('add-word requires a meaning', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('meaning_hu');

    expect($this->user->customWords()->where('word', 'serendipity')->exists())->toBeFalse();
});

test('add-word rejects an invalid status', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse', 'status' => 'bogus'])
        ->assertStatus(422);
});

test('add-word rejects duplicates', function () {
    $this->user->customWords()->create(['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse']);

    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse'])
        ->assertSuccessful()
        ->assertJson(['error' => 'duplicate']);
});

test('add-word is blocked once a free user exhausts the daily write quota', function () {
    $free = User::factory()->create();
    $limit = $free->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->actingAs($free)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse'])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    expect($free->customWords()->count())->toBe(0);
});

test('create-flashcard is blocked once a free user exhausts the daily write quota', function () {
    $free = User::factory()->create();
    $deck = $free->flashcardDecks()->create(['name' => 'Angol szavak']);
    $limit = $free->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->actingAs($free)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $deck->id,
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
        ])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    expect($deck->flashcards()->count())->toBe(0);
});

test('a free user can write from the extension until the daily quota runs out', function () {
    $free = User::factory()->create();
    $limit = $free->planLimit('extension_writes_per_day');
    // Egy hellyel a keret alatt: az utolsó írás még átmegy és betölti a keretet.
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit - 1, now()->endOfDay());

    $this->actingAs($free)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse'])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);

    expect($free->customWords()->count())->toBe(1)
        ->and($free->extensionWritesToday())->toBe($limit);
});

test('reads stay free for everyone: a free user can still look up words', function () {
    $this->actingAs(User::factory()->create())
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'word' => 'apple', 'has_active_access' => false]);
});

test('decks returns the user own decks and ai access', function () {
    $this->user->flashcardDecks()->create(['name' => 'Angol szavak']);
    $this->user->flashcardDecks()->create(['name' => 'Kifejezések']);
    User::factory()->create()->flashcardDecks()->create(['name' => 'Más felhasználó']);

    $response = $this->actingAs($this->user)
        ->getJson(route('extension.decks'))
        ->assertSuccessful()
        ->assertJsonCount(2, 'decks')
        ->assertJsonStructure(['decks' => [['id', 'name']], 'has_ai_access']);

    expect(collect($response->json('decks'))->pluck('name')->all())
        ->toBe(['Angol szavak', 'Kifejezések']);
});

test('create-flashcard adds a card to the chosen deck', function () {
    $deck = $this->user->flashcardDecks()->create(['name' => 'Angol szavak']);
    $apple = Word::where('word', 'apple')->first();

    $this->actingAs($this->user)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $deck->id,
            'word_id' => $apple->id,
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
        ])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);

    $card = $deck->flashcards()->first();
    expect($card->front)->toBe('apple');
    expect($card->back)->toBe('alma');
    expect($card->word_id)->toBe($apple->id);
});

test('create-flashcard rejects a deck the user does not own', function () {
    $foreignDeck = User::factory()->create()->flashcardDecks()->create(['name' => 'Idegen']);

    $this->actingAs($this->user)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $foreignDeck->id,
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
        ])
        ->assertNotFound()
        ->assertJson(['error' => 'deck_not_found']);

    expect($foreignDeck->flashcards()->count())->toBe(0);
});

test('create-flashcard requires front, back and a valid direction', function () {
    $deck = $this->user->flashcardDecks()->create(['name' => 'Angol szavak']);

    $this->actingAs($this->user)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $deck->id,
            'front' => 'apple',
            'direction' => 'sideways',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['back', 'direction']);
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

test('statuses maps each slash-separated alternative form separately', function () {
    $get = Word::create([
        'word' => 'get',
        'meaning_hu' => 'kap',
        'verb_past' => 'got',
        'verb_past_participle' => 'got/gotten',
        'rank' => 4,
    ]);
    $this->user->knownWords()->attach($get->id, ['status' => 'known']);

    $statuses = $this->actingAs($this->user)
        ->getJson(route('extension.statuses'))
        ->assertSuccessful()
        ->json('statuses');

    expect($statuses)->toMatchArray(['get' => 'known', 'got' => 'known', 'gotten' => 'known'])
        ->not->toHaveKey('got/gotten');
});

test('statuses excludes periphrastic comparatives so they are not treated as phrases', function () {
    // A "desperate" középfoka körülírásos ("more desperate") — ez szóközös, ezért
    // nem kerülhet a térképbe, különben a kliens kifejezésként emelné ki.
    $desperate = Word::create([
        'word' => 'desperate',
        'meaning_hu' => 'kétségbeesett',
        'adj_comparative' => 'more desperate',
        'adj_superlative' => 'most desperate',
        'rank' => 99,
    ]);
    $this->user->knownWords()->attach($desperate->id, ['status' => 'known']);

    $response = $this->actingAs($this->user)
        ->getJson(route('extension.statuses'))
        ->assertSuccessful()
        ->assertJson(['statuses' => ['desperate' => 'known']]);

    expect($response->json('statuses'))->not->toHaveKey('more desperate');
    expect($response->json('statuses'))->not->toHaveKey('most desperate');
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
        ->postJson(route('extension.add-word'), ['word' => 'isolationtest', 'meaning_hu' => 'teszt'])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);
});

test('youtube transcript is available to authenticated free users', function () {
    Http::fake([
        '*api/timedtext*' => Http::response('{"events":[{"tStartMs":0,"segs":[{"utf8":"hello world"}]}]}'),
        '*youtube.com/watch*' => Http::response('<html><head><title>Test Video - YouTube</title></head></html>'),
        '*' => Http::response(''),
    ]);

    $this->actingAs($this->user) // free plan
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertSuccessful()
        ->assertJsonPath('segments.0.x', 'hello world');
});

test('youtube transcript requires authentication', function () {
    Http::fake();

    $this->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertStatus(401)
        ->assertJson(['error' => 'unauthenticated']);

    Http::assertNothingSent();
});

test('youtube transcript validates the video id', function () {
    Http::fake();

    $this->actingAs(User::factory()->premium()->create())
        ->getJson(route('extension.youtube-transcript', ['v' => 'too-short']))
        ->assertStatus(422)
        ->assertJson(['error' => 'invalid_video_id']);
});

test('youtube transcript is cached per video and shared across users', function () {
    Http::fake([
        '*api/timedtext*' => Http::response('{"events":[{"tStartMs":0,"segs":[{"utf8":"hello world"}]}]}'),
        '*youtube.com/watch*' => Http::response('<html><head><title>Test Video - YouTube</title></head></html>'),
        '*' => Http::response(''),
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertSuccessful()
        ->assertJsonPath('title', 'Test Video');

    $scrapeRequestCount = count(Http::recorded());

    // A cím a caption-letöltés watch-oldalából jön, nem külön kérésből (#M7):
    // pontosan egy watch-oldal letöltés történt.
    expect(Http::recorded(fn ($request) => str_contains($request->url(), 'youtube.com/watch')))->toHaveCount(1);

    // Másik user ugyanazzal a videóval a cache-ből kap választ, scrape nélkül.
    $this->actingAs(User::factory()->premium()->create())
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertSuccessful()
        ->assertJsonPath('title', 'Test Video')
        ->assertJsonPath('segments.0.x', 'hello world');

    expect(Http::recorded())->toHaveCount($scrapeRequestCount);
});

test('youtube transcript failure is negative-cached so retries do not re-scrape', function () {
    Http::fake(['*' => Http::response('')]);

    $this->actingAs($this->user)
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertStatus(422)
        ->assertJson(['error' => 'no_captions']);

    $scrapeRequestCount = count(Http::recorded());

    $this->actingAs($this->user)
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertStatus(422)
        ->assertJson(['error' => 'no_captions']);

    expect(Http::recorded())->toHaveCount($scrapeRequestCount);
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
