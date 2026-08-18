<?php

use App\Models\User;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\YouTubeCaptionService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

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

test('lookup normalizes the typographic apostrophe of the page text', function () {
    // A weblapok szövegében nem ASCII aposztróf áll („couldn’t"), a tárolt alak
    // viszont ASCII — normalizálás nélkül a bővítmény hamis „nincs találat"-ot
    // mutatott a saját szóra is.
    $this->user->customWords()->create([
        'word' => "couldn't",
        'meaning_hu' => 'nem tudott',
        'status' => 'learning',
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => "couldn\u{2019}t"]))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'is_custom' => true,
            'word' => "couldn't",
            'status' => 'learning',
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

// A popup részletező panelje ezekből az alakokból építi az „Igealakok",
// „Többes szám" és „Fokozás" blokkot. A globális és a saját szó külön
// lekérdezésből jön, ezért mindkét ágat külön őrizzük.
test('lookup exposes the inflected forms of a global word', function () {
    Word::create([
        'word' => 'test',
        'meaning_hu' => 'teszt',
        'part_of_speech' => 'noun',
        'form_base' => 'test',
        'verb_past' => 'tested',
        'verb_past_participle' => 'tested',
        'verb_present_participle' => 'testing',
        'verb_third_person' => 'tests',
        'noun_plural' => 'tests',
        'is_irregular' => false,
        'rank' => 835,
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'test']))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'form_base' => 'test',
            'verb_past' => 'tested',
            'verb_past_participle' => 'tested',
            'verb_present_participle' => 'testing',
            'verb_third_person' => 'tests',
            'noun_plural' => 'tests',
            'is_irregular' => false,
            'rank' => 835,
        ]);
});

test('lookup exposes the inflected forms of a custom word', function () {
    $this->user->customWords()->create([
        'word' => 'serendipity',
        'meaning_hu' => 'véletlen szerencse',
        'noun_plural' => 'serendipities',
        'is_irregular' => true,
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'serendipity']))
        ->assertSuccessful()
        ->assertJson([
            'found' => true,
            'is_custom' => true,
            'noun_plural' => 'serendipities',
            'is_irregular' => true,
        ]);
});

test('search exposes the inflected forms of both global and custom words', function () {
    Word::create([
        'word' => 'good',
        'meaning_hu' => 'jó',
        'part_of_speech' => 'adj',
        'adj_comparative' => 'better',
        'adj_superlative' => 'best',
        'is_irregular' => true,
        'rank' => 50,
    ]);

    $this->user->customWords()->create([
        'word' => 'goose',
        'meaning_hu' => 'liba',
        'noun_plural' => 'geese',
    ]);

    $results = collect(
        $this->actingAs($this->user)
            ->getJson(route('extension.search', ['q' => 'goo']))
            ->assertSuccessful()
            ->json('results')
    )->keyBy('word');

    expect($results['good'])
        ->toMatchArray([
            'adj_comparative' => 'better',
            'adj_superlative' => 'best',
            'is_irregular' => true,
        ])
        ->and($results['goose'])
        ->toMatchArray([
            'is_custom' => true,
            'noun_plural' => 'geese',
            'is_irregular' => false,
        ]);
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

test('add-word returns every surface form so the client can highlight inflections at once', function () {
    // A token-alapú kliens (player) a felvitel után a válasz `forms` mezőjéből
    // színezi a képernyőn látszó alakot — a ragozott és a lemmatizáláskor mentett
    // eredeti alaknak (extra_forms) is köztük kell lennie, különben csak a puszta
    // alapszó válna zöldre, a beírt „successfully" nem.
    $forms = $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), [
            'word' => 'successful',
            'meaning_hu' => 'sikeres',
            'part_of_speech' => 'adj',
            'adj_comparative' => 'more successful',
            'extra_forms' => 'successfully',
        ])
        ->assertSuccessful()
        ->json('forms');

    expect($forms)->toContain('successful')->toContain('successfully');
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

test('add-word survives a concurrent duplicate insert without 500 and refunds the reserved quota', function () {
    // A $exists előszűrés és az insert között egy párhuzamos kérés ugyanazt a szót
    // beszúrja; a (user_id, word) unique index elkapja a mienket. A kontrollernek
    // duplikátumot kell jeleznie 500 helyett, és vissza kell adnia a lefoglalt
    // napi keretet (#L1). A versenyt egy creating-eseménnyel modellezzük: épp az
    // insert előtt visszük be a konfliktáló sort.
    $free = User::factory()->create();
    $start = 2;
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $start, now()->endOfDay());

    UserCustomWord::creating(function (UserCustomWord $word) use ($free) {
        // Csak egyszer, és csak a mi felhasználónk soránál — a beszúrást közvetlen DB-vel
        // végezzük, hogy ne triggereljük újra ezt az eseményt.
        static $done = false;
        if (! $done && $word->user_id === $free->id) {
            $done = true;
            DB::table('user_custom_words')->insert([
                'user_id' => $free->id,
                'word' => $word->word,
                'meaning_hu' => 'másik jelentés',
                'status' => 'known',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    });

    $this->actingAs($free)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse'])
        ->assertSuccessful()
        ->assertJson(['error' => 'duplicate']);

    // A lefoglalt keret visszakerült: nem maradt elveszett napi slot.
    expect($free->extensionWritesToday())->toBe($start)
        ->and($free->customWords()->count())->toBe(1);

    UserCustomWord::flushEventListeners();
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

test('create-flashcard returns a 403 limit error and refunds the daily quota when the card cap is full', function () {
    $free = User::factory()->create();
    $deck = $free->flashcardDecks()->create(['name' => 'Angol szavak']);

    // Kártyakeret betöltve, de napi írás-keret bőven van.
    $cardLimit = $free->planLimit('flashcards');
    $deck->flashcards()->createMany(collect(range(1, $cardLimit))->map(fn ($i) => [
        'front' => "F{$i}", 'back' => "B{$i}", 'direction' => 'front_to_back',
    ])->all());

    $this->actingAs($free)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $deck->id,
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
        ])
        ->assertForbidden()
        ->assertJson(['error' => 'limit']);

    // Nem jött létre új kártya, és a napi keret sem fogyott el (a foglalás visszakerült).
    expect($deck->flashcards()->count())->toBe($cardLimit)
        ->and($free->extensionWritesToday())->toBe(0);
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
        ->assertJson(['found' => true, 'word' => 'apple']);
});

test('lookup reports can_write:true for a free user with quota remaining', function () {
    // A Free user az UI-ban is kap írás-lehetőséget, amíg van a napi keretből —
    // a szerver can_write jele (canWriteFromExtension) tükrözi a valós kvótát,
    // nem a csomag prémium voltát.
    $this->actingAs(User::factory()->create())
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'can_write' => true]);
});

test('lookup reports can_write:false once a free user exhausts the daily write quota', function () {
    $free = User::factory()->create();
    $limit = $free->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->actingAs($free)
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'can_write' => false]);
});

test('search reports can_write reflecting the free user daily quota', function () {
    $free = User::factory()->create();

    $this->actingAs($free)
        ->getJson(route('extension.search', ['q' => 'app']))
        ->assertSuccessful()
        ->assertJson(['can_write' => true]);

    $limit = $free->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$free->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->actingAs($free)
        ->getJson(route('extension.search', ['q' => 'app']))
        ->assertSuccessful()
        ->assertJson(['can_write' => false]);
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

test('the retired badge endpoint is gone', function () {
    // A számláló-badge-et a 43b7621 kivezette az ikonról; a szerveroldali
    // /extension/badge végpont sem maradt, mert a kliens egyetlen kódútja
    // sem hívja. Őrszem: ne kerüljön vissza észrevétlenül.
    expect(Route::has('extension.badge'))->toBeFalse();

    $this->actingAs($this->user)
        ->getJson('/extension/badge')
        ->assertNotFound();
});

test('the extension payload no longer ships the unused has_active_access flag', function () {
    // A jogosultság-jelet a can_write / has_ai_access adja; a has_active_access
    // mezőt senki nem olvasta (bővítmény, player, web), ezért kivezettük.
    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'apple']))
        ->assertSuccessful()
        ->assertJsonMissingPath('has_active_access');

    $this->actingAs($this->user)
        ->getJson(route('extension.search', ['q' => 'app']))
        ->assertSuccessful()
        ->assertJsonMissingPath('has_active_access');
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

// ── SSRF guard (felirat-lánc, SSRF-1) ────────────────────────────────────────
//
// A feliratfájl cél-URL-je a YouTube válaszából jön (`captionTracks[].baseUrl`),
// tehát egy megbízhatónak FELTÉTELEZETT partner adatából. A lánc viszont nem
// blind: a letöltött tartalom parseolt szegmensekként visszamegy a kliensnek,
// ezért egy nem-YouTube `baseUrl` exfiltrációs csatorna lenne. Ezek az őrszem-
// tesztek a `fetchCaptionBody` allowlistjét és redirect-tilalmát védik.

/**
 * Watch-oldal HTML a page-scraping ághoz, a megadott `baseUrl`-lel.
 * A timedtext- és az innertube-ág üresen felel, hogy a lánc eddig eljusson.
 */
function watchPageWithCaptionUrl(string $baseUrl): string
{
    return '<html><head><title>Test Video - YouTube</title></head><body><script>'
        .'var x = {"captionTracks":[{"baseUrl":"'.$baseUrl.'","languageCode":"en"}]};'
        .'</script></body></html>';
}

test('SSRF-1: the caption chain refuses a baseUrl pointing off YouTube', function () {
    Http::fake([
        '*api/timedtext*' => Http::response(''),
        '*youtubei/v1/player*' => Http::response(''),
        '*youtube.com/watch*' => Http::response(
            watchPageWithCaptionUrl('http://169.254.169.254/latest/meta-data/')
        ),
        '*' => Http::response('SECRET_TOKEN=abc123 leaked metadata body'),
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertStatus(422)
        ->assertJson(['error' => 'no_captions']);

    // A lényeg: a metadata-host felé EGYETLEN kérés sem indult.
    Http::assertNotSent(fn ($request) => str_contains($request->url(), '169.254.169.254'));
});

test('SSRF-1: the caption chain refuses a plain-http YouTube baseUrl', function () {
    Http::fake([
        '*api/timedtext*' => Http::response(''),
        '*youtubei/v1/player*' => Http::response(''),
        '*youtube.com/watch*' => Http::response(
            watchPageWithCaptionUrl('http://www.youtube.com/api/timedtext?v=abcdefghijk')
        ),
        '*' => Http::response(''),
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertStatus(422);

    Http::assertNotSent(fn ($request) => str_starts_with($request->url(), 'http://'));
});

test('SSRF-1: the caption download disables redirect following', function () {
    // Enélkül a Guzzle default 5 hopot követne — `http`-re és belső címre is —,
    // vagyis az allowlist egyetlen `Location:` fejléccel megkerülhető lenne.
    //
    // A `Http::fake()` nem játszik le valódi redirect-láncot, ezért a fake-elt
    // válasz nem bizonyítana semmit: közvetlenül a kimenő kérés beállítását
    // mérjük a `PendingRequest`-en (ugyanaz a módszer, amivel az audit a
    // hiányzó `allow_redirects`-et kimutatta).
    $method = new ReflectionMethod(YouTubeCaptionService::class, 'fetchCaptionBody');
    $source = file($method->getFileName());
    $body = implode('', array_slice(
        $source,
        $method->getStartLine() - 1,
        $method->getEndLine() - $method->getStartLine() + 1,
    ));

    expect($body)->toContain('withoutRedirecting()');

    // És hogy ez a futó kliensen is érvényes: a Guzzle `allow_redirects`
    // opciója false-ra van állítva.
    $pending = Http::timeout(15)->withoutRedirecting();
    $options = (new ReflectionProperty($pending, 'options'))->getValue($pending);

    expect($options['allow_redirects'])->toBeFalse();
});

test('SSRF-1: a legitimate YouTube caption baseUrl still works', function () {
    // A guard nem lehet olyan szigorú, hogy a valós utat is elvágja.
    Http::fake([
        '*api/timedtext*' => Http::response('{"events":[{"tStartMs":0,"segs":[{"utf8":"allowed host"}]}]}'),
        '*youtubei/v1/player*' => Http::response(''),
        '*youtube.com/watch*' => Http::response(
            watchPageWithCaptionUrl('https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en')
        ),
        '*' => Http::response(''),
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.youtube-transcript', ['v' => 'abcdefghijk']))
        ->assertSuccessful()
        ->assertJsonPath('segments.0.x', 'allowed host');
});

test('L1: an unverified user cannot write via the extension write endpoints', function () {
    // A weboldal és a player-ikrek `verified` middleware-t követelnek az írásra;
    // ugyanez kell a bővítmény add-word/create-flashcard végpontjain is, hogy a
    // megerősítetlen fiók se hozhasson létre tartalmat. JSON-kérésnél a middleware
    // 403-at ad (nem HTML-redirectet), amit a kliens 'unverified'-ként kezel.
    $unverified = User::factory()->premium()->unverified()->create();
    $deck = $unverified->flashcardDecks()->create(['name' => 'Angol szavak']);

    $this->actingAs($unverified)
        ->postJson(route('extension.add-word'), ['word' => 'apple', 'meaning_hu' => 'alma'])
        ->assertForbidden();

    $this->actingAs($unverified)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $deck->id,
            'front' => 'apple',
            'back' => 'alma',
            'direction' => 'both',
        ])
        ->assertForbidden();

    expect($unverified->customWords()->count())->toBe(0);
    expect($deck->flashcards()->count())->toBe(0);
});

test('L1: a verified user can still write via the extension endpoints', function () {
    // Regresszió-őr: a verified-kapu ne zárja ki a megerősített fiókot. A
    // beforeEach `$this->user`-je premium + verified (a factory alap).
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), ['word' => 'serendipity', 'meaning_hu' => 'véletlen szerencse'])
        ->assertSuccessful()
        ->assertJson(['ok' => true]);
});

// --- extra_forms: a lemmatizáláskor eldobott beírt alak felismerése ---
// A felhasználó „successfully"-t vitt fel; az AI a „successful" lemmára váltott,
// és a beírt eredeti alakot az extra_forms-ba mentettük. A szó-felismerésnek
// (lookup / statuses / search) a beírt „successfully"-re is találnia kell.

test('add-word stores the original inflected form in extra_forms', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), [
            'word' => 'successful',
            'meaning_hu' => 'sikeres',
            'extra_forms' => 'successfully',
        ])
        ->assertSuccessful()
        ->assertJson(['ok' => true, 'word' => 'successful']);

    expect($this->user->customWords()->where('word', 'successful')->value('extra_forms'))
        ->toBe('successfully');
});

test('add-word normalizes extra_forms: lowercased, deduped, lemma dropped', function () {
    $this->actingAs($this->user)
        ->postJson(route('extension.add-word'), [
            'word' => 'successful',
            'meaning_hu' => 'sikeres',
            // A lemma önmaga és a duplikátum kiesik, a maradék kisbetűs lesz.
            'extra_forms' => 'SUCCESSFUL/Successfully/successfully',
        ])
        ->assertSuccessful();

    expect($this->user->customWords()->where('word', 'successful')->value('extra_forms'))
        ->toBe('successfully');
});

test('lookup matches a custom word by its extra_forms', function () {
    $this->user->customWords()->create([
        'word' => 'successful',
        'meaning_hu' => 'sikeres',
        'status' => 'known',
        'extra_forms' => 'successfully',
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.lookup', ['word' => 'successfully']))
        ->assertSuccessful()
        ->assertJson(['found' => true, 'word' => 'successful', 'is_custom' => true, 'status' => 'known']);
});

test('statuses maps an extra_form to the word status', function () {
    $this->user->customWords()->create([
        'word' => 'successful',
        'meaning_hu' => 'sikeres',
        'status' => 'known',
        'extra_forms' => 'successfully',
    ]);

    $this->actingAs($this->user)
        ->getJson(route('extension.statuses'))
        ->assertSuccessful()
        ->assertJson(['statuses' => [
            'successful' => 'known',
            'successfully' => 'known',
        ]]);
});

test('search finds a custom word by its extra_forms', function () {
    $this->user->customWords()->create([
        'word' => 'successful',
        'meaning_hu' => 'sikeres',
        'extra_forms' => 'successfully',
    ]);

    $results = $this->actingAs($this->user)
        ->getJson(route('extension.search', ['q' => 'successfully']))
        ->assertSuccessful()
        ->json('results');

    expect(collect($results)->pluck('word'))->toContain('successful');
});

// A popup lenyitható találata ezekből a mezőkből építi a részletező panelt
// (jelentés, példamondat, státusz-gombok, fontosság-csillagok) — ezért a
// keresésnek egy körben, második kérés nélkül vissza kell adnia mindet.
test('search returns the details the popup expands, including importance', function () {
    $apple = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($apple->id, ['status' => 'learning', 'importance' => 3]);

    $result = collect(
        $this->actingAs($this->user)
            ->getJson(route('extension.search', ['q' => 'apple']))
            ->assertSuccessful()
            ->json('results')
    )->firstWhere('word', 'apple');

    expect($result)->toMatchArray([
        'is_custom' => false,
        'meaning_hu' => 'alma',
        'synonyms' => 'fruit',
        'example_en' => 'I ate an apple.',
        'example_hu' => 'Megettem egy almát.',
        'status' => 'learning',
        'importance' => 3,
    ]);
});

test('search returns a marked word without importance as null', function () {
    $apple = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($apple->id, ['status' => 'known']);

    $result = collect(
        $this->actingAs($this->user)
            ->getJson(route('extension.search', ['q' => 'apple']))
            ->assertSuccessful()
            ->json('results')
    )->firstWhere('word', 'apple');

    expect($result['status'])->toBe('known')
        ->and($result['importance'])->toBeNull();
});

test('search returns the details of a custom word too', function () {
    $this->user->customWords()->create([
        'word' => 'apricot',
        'meaning_hu' => 'sárgabarack',
        'synonyms' => 'fruit',
        'example_en' => 'The apricot is ripe.',
        'example_hu' => 'A sárgabarack megérett.',
        'status' => 'saved',
        'importance' => 5,
    ]);

    $result = collect(
        $this->actingAs($this->user)
            ->getJson(route('extension.search', ['q' => 'apricot']))
            ->assertSuccessful()
            ->json('results')
    )->firstWhere('word', 'apricot');

    expect($result)->toMatchArray([
        'is_custom' => true,
        'synonyms' => 'fruit',
        'example_en' => 'The apricot is ripe.',
        'example_hu' => 'A sárgabarack megérett.',
        'status' => 'saved',
        'importance' => 5,
    ]);
});
