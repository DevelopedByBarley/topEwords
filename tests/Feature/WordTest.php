<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use App\Models\Word;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    Word::insert([
        ['word' => 'the', 'rank' => 1, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'of', 'rank' => 2, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'apple', 'rank' => 3, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'banana', 'rank' => 4, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'moderate', 'rank' => 3000, 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'elaborate', 'rank' => 7500, 'created_at' => now(), 'updated_at' => now()],
    ]);
});

test('words index page is accessible', function () {
    $this->get(route('words.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('words/index')
            ->has('words')
            ->has('stats')
            ->has('filters')
        );
});

test('words include meaning in response', function () {
    Word::where('word', 'apple')->update(['meaning_hu' => 'alma']);

    $this->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->where('words.data.0.word', 'apple')
            ->where('words.data.0.meaning_hu', 'alma')
        );
});

test('words index shows all words by default', function () {
    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.total', 6)
            ->where('stats.known', 0)
        );
});

test('words can be filtered by letter', function () {
    $this->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'apple')
        );
});

test('words can be searched', function () {
    $this->get(route('words.index', ['search' => 'ba']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'banana')
        );
});

test('main word list search matches substrings, not just prefixes', function () {
    // "rat" a "modeRATe" és "elaboRATe" belsejében van — prefix-kereséssel egyik
    // sem jönne, substring-kereséssel mindkettő (mint a saját szavaknál).
    $this->get(route('words.index', ['search' => 'rat']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 2)
        );
});

test('setting word status to known marks it', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'known'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'known')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('setting word status to learning marks it', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'learning'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'learning')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('setting word status to saved marks it', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'saved'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'saved')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('setting the same status again removes it', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->post(route('words.status', $word), ['status' => 'known'])
        ->assertRedirect();

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('extension JSON request gets a JSON ack instead of a redirect', function () {
    $word = Word::where('word', 'the')->first();

    $this->postJson(route('words.status', $word), ['status' => 'known'])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => 'known', 'forms' => ['the']]);

    expect($this->user->knownWords()->wherePivot('status', 'known')->where('word_id', $word->id)->exists())->toBeTrue();
});

test('empty status removes the word (extension un-toggle)', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'saved']);

    $this->postJson(route('words.status', $word), ['status' => ''])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => null, 'forms' => ['the']]);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('empty status removes a word regardless of its current status (no practice re-toggle)', function () {
    // A gyakorlás-oldal "eltávolítás" gombja explicit üres státuszt küld, nem a 'practice'
    // toggle-t. Így ha a szó időközben máshol (másik fül) más státuszra váltott, az
    // eltávolítás akkor is levesz — sosem állítja vissza tévedésből practice-re.
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->postJson(route('words.status', $word), ['status' => null])
        ->assertOk()
        ->assertExactJson(['ok' => true, 'status' => null, 'forms' => ['the']]);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('extension status response returns all inflected forms for cache patching', function () {
    // A bővítmény ezekkel az alakokkal foltozza helyben a státusz-cache-t, így a
    // teljes térkép újraletöltése elmarad. Minden ragozott alaknak szerepelnie kell.
    $word = Word::create([
        'word' => 'run',
        'rank' => 5000,
        'verb_past' => 'ran',
        'verb_present_participle' => 'running',
        'verb_third_person' => 'runs',
    ]);

    $response = $this->postJson(route('words.status', $word), ['status' => 'learning'])
        ->assertOk()
        ->assertJson(['ok' => true, 'status' => 'learning']);

    expect($response->json('forms'))
        ->toContain('run', 'ran', 'running', 'runs');
});

test('inertia request still receives a redirect, not JSON', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.status', $word), ['status' => 'known'], ['X-Inertia' => 'true', 'X-Requested-With' => 'XMLHttpRequest'])
        ->assertRedirect();
});

test('extension-origin status write consumes the daily extension quota', function () {
    $word = Word::where('word', 'the')->first();

    $this->postJson(route('words.status', $word), ['status' => 'known'], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect($this->user->extensionWritesToday())->toBe(1);
});

test('extension-origin status write is blocked once the free daily quota is exhausted', function () {
    $word = Word::where('word', 'the')->first();
    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('words.status', $word), ['status' => 'known'], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('extension-origin status removal stays free even over the exhausted quota', function () {
    // A levétel nem fogyaszt keretet, hogy a betelt keret ne akadályozza a visszavonást.
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);
    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('words.status', $word), ['status' => ''], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertOk()
        ->assertJson(['ok' => true, 'status' => null]);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('web status writes do not consume the extension quota', function () {
    // A gyakorlás-oldal fetch-e is a JSON-ágat használja, de app-originnel érkezik
    // — nem számíthat extension-írásnak, betelt extension-keretnél is működnie kell.
    $word = Word::where('word', 'the')->first();
    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('words.status', $word), ['status' => 'known'], ['Origin' => config('app.url')])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeTrue()
        ->and($this->user->extensionWritesToday())->toBe($limit);
});

test('a premium user status-writes from the extension without quota', function () {
    $premium = User::factory()->premium()->create();
    $word = Word::where('word', 'the')->first();

    $this->actingAs($premium)
        ->postJson(route('words.status', $word), ['status' => 'known'], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect($premium->knownWords()->where('word_id', $word->id)->exists())->toBeTrue()
        ->and($premium->extensionWritesToday())->toBe(0);
});

test('extension-origin status write refunds the quota when the pivot write throws', function () {
    // M3: ha az írás a keret-foglalás UTÁN dob, a slot nem ragadhat benn — különben
    // a Free user hamis „elfogyott a napi kereted" hibát kapna a következő íráskor.
    $word = Word::where('word', 'the')->first();

    // A bejelentkezett usert úgy mockoljuk, hogy a pivot-írás dobjon; a keret-
    // számláló a valódi cache-en fut, így ellenőrizhető, hogy visszaáll.
    $user = $this->user;
    $mock = Mockery::mock($user)->makePartial();
    $mock->shouldReceive('knownWords')->andThrow(new RuntimeException('DB down'));
    $this->actingAs($mock);

    expect($user->extensionWritesToday())->toBe(0);

    $this->withoutExceptionHandling();

    try {
        $this->postJson(route('words.status', $word), ['status' => 'known'], ['Origin' => 'chrome-extension://abcdefghijklmnop']);
    } catch (RuntimeException $e) {
        // várt
    }

    // A foglalás lefutott (increment), majd a hiba után a refund visszaadta.
    expect($user->extensionWritesToday())->toBe(0);
});

test('word write endpoints carry the shared per-user throttle limiter', function () {
    foreach (['words.status', 'words.importance', 'custom-words.store', 'custom-words.update', 'custom-words.status', 'custom-words.importance', 'custom-words.destroy'] as $name) {
        $route = Route::getRoutes()->getByName($name);

        expect($route)->not->toBeNull()
            ->and($route->middleware())->toContain('throttle:300,1,word-writes');
    }
});

test('words index shows correct status counts', function () {
    $words = Word::whereIn('word', ['the', 'of', 'apple'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known']);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'learning']);
    $this->user->knownWords()->attach($words['apple']->id, ['status' => 'saved']);

    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->where('stats.known', 1)
            ->where('stats.learning', 1)
            ->where('stats.saved', 1)
            ->where('stats.total', 6)
        );
});

test('words can be filtered by level', function () {
    Word::where('word', 'moderate')->update(['level' => 3]);
    Word::where('word', 'elaborate')->update(['level' => 6]);

    $this->get(route('words.index', ['level' => 3]))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'moderate')
            ->where('filters.level', 3)
        );
});

test('level filter excludes other levels', function () {
    Word::where('word', 'moderate')->update(['level' => 3]);
    Word::where('word', 'elaborate')->update(['level' => 6]);

    $this->get(route('words.index', ['level' => 1]))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 4)
            ->where('filters.level', 1)
        );
});

test('words can be filtered by status known', function () {
    $words = Word::whereIn('word', ['the', 'of'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known']);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'learning']);

    $this->get(route('words.index', ['status' => 'known']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'the')
            ->where('filters.status', 'known')
        );
});

test('words can be filtered by status learning', function () {
    $words = Word::whereIn('word', ['the', 'of'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known']);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'learning']);

    $this->get(route('words.index', ['status' => 'learning']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'of')
            ->where('filters.status', 'learning')
        );
});

test('words can be filtered by status saved', function () {
    $word = Word::where('word', 'apple')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'saved']);

    $this->get(route('words.index', ['status' => 'saved']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'apple')
            ->where('filters.status', 'saved')
        );
});

test('status filter returns no words when user has none with that status', function () {
    $this->get(route('words.index', ['status' => 'known']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 0)
        );
});

test('marked pages are returned correctly', function () {
    // Insert 101 words so there are 2 pages (100 per page)
    $rows = array_map(fn ($i) => ['word' => 'word'.$i, 'rank' => $i, 'created_at' => now(), 'updated_at' => now()], range(1, 101));
    Word::insert($rows);

    // Mark the first word (page 1) and the last word by rank (last page)
    $firstWord = Word::orderBy('rank')->first();
    $lastWord = Word::orderByDesc('rank')->first();
    $this->user->knownWords()->attach($firstWord->id, ['status' => 'known']);
    $this->user->knownWords()->attach($lastWord->id, ['status' => 'learning']);

    $totalWords = Word::count();
    $lastPage = (int) ceil($totalWords / 100);

    $this->get(route('words.index', ['per_page' => 100]))
        ->assertInertia(fn ($page) => $page
            ->has('markedPages')
            ->where('markedPages', [1, $lastPage])
        );
});

test('partial reload returns fresh page and letter annotations with stats', function () {
    // A szólista státusz-váltás után only:[words,stats,markedPages,completedPages,
    // markedLetters,flash] partial reloadot kér; ez a teszt garantálja, hogy ezek
    // a propok partial válaszban is frissen visszajönnek (nem optional/deferred).
    $this->user->knownWords()->attach(Word::where('word', 'the')->first()->id, ['status' => 'known']);
    $this->user->knownWords()->attach(Word::where('word', 'apple')->first()->id, ['status' => 'practice']);

    $version = app(HandleInertiaRequests::class)->version(request()) ?? '';

    $response = $this->get(route('words.index'), [
        'X-Inertia' => 'true',
        'X-Inertia-Version' => $version,
        'X-Inertia-Partial-Component' => 'words/index',
        'X-Inertia-Partial-Data' => 'words,stats,markedPages,completedPages,markedLetters,flash',
    ])
        ->assertOk();

    // Partial (JSON) Inertia-válasznál nincs view, ezért assertInertia helyett
    // közvetlenül a props-okat ellenőrizzük.
    $response->assertJsonPath('props.markedPages', [1])
        ->assertJsonPath('props.stats.known', 1)
        ->assertJsonPath('props.stats.practice', 1)
        ->assertJsonMissingPath('props.folders');

    expect(collect($response->json('props.markedLetters'))->sort()->values()->all())->toBe(['A', 'T'])
        ->and($response->json('props.completedPages'))->toBeArray();
});

test('words index requires authentication', function () {
    $this->actingAs(User::factory()->create());
    auth()->logout();

    $this->get(route('words.index'))->assertRedirect(route('login'));
});

test('search endpoint returns matching words', function () {
    $this->getJson(route('words.search', ['q' => 'app']))
        ->assertOk()
        ->assertJsonFragment(['word' => 'apple', 'is_custom' => false]);
});

test('search endpoint escapes LIKE wildcards', function () {
    // A `_` joker jelöletlenül minden (legalább 2 karakteres) szóra illeszkedne;
    // escape-elve viszont szó szerinti aláhúzásra keres, amiből egy sincs.
    $this->getJson(route('words.search', ['q' => '__']))
        ->assertOk()
        ->assertExactJson([]);
});

test('index search escapes LIKE wildcards', function () {
    $this->get(route('words.index', ['search' => '__']))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 0)
        );
});

test('setting importance saves an unmarked word as known', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.importance', $word), ['importance' => 3])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('status', 'known')->wherePivot('importance', 3)->where('word_id', $word->id)->exists())->toBeTrue();
});

test('clearing importance on an unmarked word does not create a pivot', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.importance', $word), ['importance' => null])
        ->assertRedirect();

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('status marking is free and unlimited', function () {
    // Korábban 50 mentett szónál elakadt; a státuszozás most ingyenes és korlátlan.
    $filler = collect(range(1, 50))->map(fn ($i) => [
        'word' => 'fill'.$i, 'rank' => 10000 + $i, 'created_at' => now(), 'updated_at' => now(),
    ]);
    Word::insert($filler->all());
    $fillerIds = Word::where('word', 'like', 'fill%')->pluck('id');
    $this->user->knownWords()->attach($fillerIds->mapWithKeys(fn ($id) => [$id => ['status' => 'known']])->all());

    $word = Word::where('word', 'elaborate')->first();

    $this->post(route('words.status', $word), ['status' => 'known'])
        ->assertRedirect()
        ->assertSessionMissing('error');

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeTrue()
        ->and($this->user->knownWords()->count())->toBe(51);
});

test('importance updates an already saved word', function () {
    $word = Word::where('word', 'elaborate')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'learning']);

    $this->post(route('words.importance', $word), ['importance' => 4])
        ->assertRedirect()
        ->assertSessionMissing('error');

    expect($this->user->knownWords()->wherePivot('importance', 4)->where('word_id', $word->id)->exists())->toBeTrue();
});

test('importance returns JSON for extension/JSON callers instead of a redirect', function () {
    // A bővítmény fetch-e Accept: application/json-t küld; korábban a végpont
    // back()-et adott, a fetch a 302-t HTML-oldalra követte, r.json() elhasalt,
    // és a kliens hibát látva visszaállította a csillagokat — noha a mentés ment.
    $word = Word::where('word', 'the')->first();

    $this->postJson(route('words.importance', $word), ['importance' => 3])
        ->assertOk()
        ->assertJson(['ok' => true, 'importance' => 3]);

    expect($this->user->knownWords()->wherePivot('importance', 3)->where('word_id', $word->id)->exists())->toBeTrue();
});

test('clearing importance via JSON returns ok with null importance', function () {
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known', 'importance' => 5]);

    $this->postJson(route('words.importance', $word), ['importance' => null])
        ->assertOk()
        ->assertJson(['ok' => true, 'importance' => null]);

    expect($this->user->knownWords()->wherePivot('importance', null)->where('word_id', $word->id)->exists())->toBeTrue();
});

test('inertia importance request still receives a redirect, not JSON', function () {
    $word = Word::where('word', 'the')->first();

    $this->post(route('words.importance', $word), ['importance' => 2], ['X-Inertia' => 'true', 'X-Requested-With' => 'XMLHttpRequest'])
        ->assertRedirect();

    expect($this->user->knownWords()->wherePivot('importance', 2)->where('word_id', $word->id)->exists())->toBeTrue();
});

test('extension-origin importance write on an unmarked word consumes the daily extension quota', function () {
    // EXT-M1: ez az ág új 'known' sort hoz létre, ezért ugyanúgy a keretbe számít,
    // mint a státusz-felvétel — különben a csillagozás keret nélküli felvételi út.
    $word = Word::where('word', 'the')->first();

    $this->postJson(route('words.importance', $word), ['importance' => 3], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertOk()
        ->assertJson(['ok' => true, 'importance' => 3]);

    expect($this->user->extensionWritesToday())->toBe(1);
});

test('extension-origin importance write on an unmarked word is blocked once the quota is exhausted', function () {
    $word = Word::where('word', 'the')->first();
    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('words.importance', $word), ['importance' => 3], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertForbidden()
        ->assertJson(['error' => 'plan']);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeFalse();
});

test('extension-origin importance change on an already saved word stays free over the exhausted quota', function () {
    // Meglévő jelölés módosítása nem vesz fel új szót, ezért nem fogyaszt keretet.
    $word = Word::where('word', 'the')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'learning']);
    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('words.importance', $word), ['importance' => 4], ['Origin' => 'chrome-extension://abcdefghijklmnop'])
        ->assertOk()
        ->assertJson(['ok' => true, 'importance' => 4]);

    expect($this->user->knownWords()->wherePivot('importance', 4)->where('word_id', $word->id)->exists())->toBeTrue()
        ->and($this->user->extensionWritesToday())->toBe($limit);
});

test('web importance writes do not consume the extension quota', function () {
    $word = Word::where('word', 'the')->first();
    $limit = $this->user->planLimit('extension_writes_per_day');
    Cache::put("extension_writes_daily_{$this->user->id}_".today()->format('Y-m-d'), $limit, now()->endOfDay());

    $this->postJson(route('words.importance', $word), ['importance' => 3], ['Origin' => config('app.url')])
        ->assertOk()
        ->assertJson(['ok' => true]);

    expect($this->user->knownWords()->where('word_id', $word->id)->exists())->toBeTrue()
        ->and($this->user->extensionWritesToday())->toBe($limit);
});

test('extension-origin importance write refunds the quota when the pivot write throws', function () {
    $word = Word::where('word', 'the')->first();

    // Az első knownWords()-hívás a meglévő jelölés lekérdezése (ez még a foglalás
    // ELŐTT fut) — csak a második, a tényleges pivot-írás dobjon, különben a teszt
    // a foglalásig sem jutna el, és a refundot nem is vizsgálná.
    $user = $this->user;
    $calls = 0;
    $mock = Mockery::mock($user)->makePartial();
    $mock->shouldReceive('knownWords')->andReturnUsing(function () use ($user, &$calls) {
        $calls++;

        if ($calls === 1) {
            return $user->knownWords();
        }

        throw new RuntimeException('DB down');
    });
    $this->actingAs($mock);

    $this->withoutExceptionHandling();

    try {
        $this->postJson(route('words.importance', $word), ['importance' => 3], ['Origin' => 'chrome-extension://abcdefghijklmnop']);
    } catch (RuntimeException $e) {
        // várt
    }

    // A foglalás lefutott (increment), majd a hiba után a refund visszaadta.
    expect($calls)->toBeGreaterThan(1)
        ->and($user->extensionWritesToday())->toBe(0);
});

test('words can be filtered by importance', function () {
    $words = Word::whereIn('word', ['the', 'of'])->get()->keyBy('word');
    $this->user->knownWords()->attach($words['the']->id, ['status' => 'known', 'importance' => 5]);
    $this->user->knownWords()->attach($words['of']->id, ['status' => 'known', 'importance' => 2]);

    $this->get(route('words.index', ['importance' => 5]))
        ->assertInertia(fn ($page) => $page
            ->where('words.total', 1)
            ->where('words.data.0.word', 'the')
            ->where('words.data.0.importance', 5)
            ->where('filters.importance', 5)
        );
});

test('custom words and stats are included on the index', function () {
    $this->user->customWords()->createMany([
        ['word' => 'ephemeral', 'meaning_hu' => 'illékony', 'status' => 'learning', 'importance' => 3],
        ['word' => 'apricot', 'meaning_hu' => 'sárgabarack', 'status' => 'known'],
    ]);

    $this->get(route('words.index'))
        ->assertInertia(fn ($page) => $page
            ->count('customWords', 2)
            ->where('customStats.total', 2)
            ->where('customStats.known', 1)
            ->where('customStats.learning', 1)
        );
});

test('custom words follow the active search, letter, status and importance filters', function () {
    $this->user->customWords()->createMany([
        ['word' => 'ephemeral', 'meaning_hu' => 'illékony', 'status' => 'learning', 'importance' => 3],
        ['word' => 'apricot', 'meaning_hu' => 'sárgabarack', 'status' => 'known'],
    ]);

    // Keresés: substring-egyezés, kis/nagybetű-független
    $this->get(route('words.index', ['search' => 'PHEM']))
        ->assertInertia(fn ($page) => $page
            ->count('customWords', 1)
            ->where('customWords.0.word', 'ephemeral')
        );

    // Kezdőbetű
    $this->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->count('customWords', 1)
            ->where('customWords.0.word', 'apricot')
        );

    // Státusz
    $this->get(route('words.index', ['status' => 'known']))
        ->assertInertia(fn ($page) => $page
            ->count('customWords', 1)
            ->where('customWords.0.word', 'apricot')
        );

    // Fontosság
    $this->get(route('words.index', ['importance' => 3]))
        ->assertInertia(fn ($page) => $page
            ->count('customWords', 1)
            ->where('customWords.0.word', 'ephemeral')
        );
});

test('folder filter hides custom words because they cannot be foldered', function () {
    $this->user->customWords()->create(['word' => 'ephemeral', 'meaning_hu' => 'illékony']);
    $folder = $this->user->folders()->create(['name' => 'Teszt mappa']);

    $this->get(route('words.index', ['folder' => $folder->id]))
        ->assertInertia(fn ($page) => $page
            ->count('customWords', 0)
            ->where('customStats.total', 1)
        );
});

test('upserted words get their level computed from rank without needing a fix pass', function () {
    // Mirrors ImportWords::handle, which bypasses the saving event via upsert()
    // and must therefore write the level explicitly to avoid drift.
    Word::upsert([
        ['word' => 'common', 'rank' => 500, 'level' => Word::levelForRank(500), 'created_at' => now(), 'updated_at' => now()],
        ['word' => 'rare', 'rank' => 9000, 'level' => Word::levelForRank(9000), 'created_at' => now(), 'updated_at' => now()],
    ], ['word'], ['rank', 'level', 'updated_at']);

    expect(Word::where('word', 'common')->value('level'))->toBe(1);
    expect(Word::where('word', 'rare')->value('level'))->toBe(6);
});

// --- extra_forms a fő szólistán: a képzett alakok admin-oldali karbantartása ---
// A „happily" korábban sehogy nem volt felvihető: a fő listában lévő „happy"
// miatt saját szóként elutasult, adminból pedig a mező sem az AI-válaszban, sem
// az űrlapon nem létezett. A szerkesztés most írja, az index visszaadja.

/** @return User A `words.update` route-hoz szükséges, admin jogú felhasználó. */
function wordListAdmin(): User
{
    config(['app.admin_email' => 'admin@example.com']);

    return User::factory()->create(['email' => 'admin@example.com']);
}

test('admin can store extra_forms on a main list word', function () {
    $this->actingAs(wordListAdmin());
    $word = Word::where('word', 'apple')->firstOrFail();

    $this->patch(route('words.update', $word), [
        'word' => 'happy',
        'extra_forms' => 'happily/happiness',
    ])->assertRedirect();

    expect($word->fresh()->extra_forms)->toBe('happily/happiness');
});

test('a mentett extra_forms a szó-felismerésbe is bekerül', function () {
    $this->actingAs(wordListAdmin());
    $word = Word::where('word', 'apple')->firstOrFail();

    $this->patch(route('words.update', $word), [
        'word' => 'happy',
        'extra_forms' => 'happily',
    ])->assertRedirect();

    $this->post(route('words.status', $word->fresh()), ['status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'a happy and happily done task'])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.happy', 'known')
        ->assertJsonPath('tokenStatuses.happily', 'known');
});

test('a szólista válasza tartalmazza az extra_forms-ot (a szerkesztés ne törölje)', function () {
    // Az admin szerkesztő a teljes űrlapot visszaküldi: ha az index nem adná
    // vissza a mezőt, a mentés üresre írná a meglévő képzett alakokat.
    Word::where('word', 'apple')->update(['extra_forms' => 'apples']);

    $this->get(route('words.index', ['letter' => 'A']))
        ->assertInertia(fn ($page) => $page
            ->where('words.data.0.word', 'apple')
            ->where('words.data.0.extra_forms', 'apples')
        );
});

test('a nem admin nem írhatja a fő szólista szavát', function () {
    $word = Word::where('word', 'apple')->firstOrFail();

    $this->patch(route('words.update', $word), ['extra_forms' => 'hacked'])
        ->assertForbidden();

    expect($word->fresh()->extra_forms)->toBeNull();
});

test('a túl hosszú extra_forms elutasul (oszlop-korlát)', function () {
    $this->actingAs(wordListAdmin());
    $word = Word::where('word', 'apple')->firstOrFail();

    $this->patch(route('words.update', $word), [
        'word' => 'apple',
        'extra_forms' => str_repeat('a', 256),
    ])->assertSessionHasErrors('extra_forms');

    expect($word->fresh()->extra_forms)->toBeNull();
});

test('a nem szóalakú extra_forms bejegyzések némán kiesnek', function () {
    // A mezőt több út is írja (űrlap, admin, bővítmény, AI-kitöltés), ezért a
    // szűrés a modell határán van: HTML-t, számsort, jelsort nem engedünk a
    // felismerő térképbe, de ettől a szó mentése még sikerül.
    $this->actingAs(wordListAdmin());
    $word = Word::where('word', 'apple')->firstOrFail();

    $this->patch(route('words.update', $word), [
        'word' => 'happy',
        'extra_forms' => '<script>alert(1)</script>/12345/HAPPILY/happily/happiness',
    ])->assertRedirect();

    expect($word->fresh()->extra_forms)->toBe('happily/happiness');
});
