<?php

use App\Models\User;
use App\Models\UserBook;
use App\Models\Word;
use App\Models\YoutubeTranscript;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->actingAs($this->user);

    // All rows must have identical keys for Word::insert()
    $base = [
        'meaning_hu' => null, 'extra_meanings' => null, 'synonyms' => null,
        'part_of_speech' => null, 'form_base' => null, 'verb_past' => null,
        'verb_past_participle' => null, 'verb_present_participle' => null,
        'verb_third_person' => null, 'is_irregular' => 0, 'noun_plural' => null,
        'adj_comparative' => null, 'adj_superlative' => null,
        'example_en' => null, 'example_hu' => null,
        'created_at' => now(), 'updated_at' => now(),
    ];

    Word::insert([
        array_merge($base, ['word' => 'run', 'rank' => 100, 'meaning_hu' => 'futni', 'verb_past' => 'ran', 'verb_present_participle' => 'running', 'verb_third_person' => 'runs']),
        array_merge($base, ['word' => 'quick', 'rank' => 200, 'meaning_hu' => 'gyors', 'adj_comparative' => 'quicker', 'adj_superlative' => 'quickest']),
        array_merge($base, ['word' => 'dog', 'rank' => 300, 'meaning_hu' => 'kutya', 'noun_plural' => 'dogs']),
        array_merge($base, ['word' => 'the', 'rank' => 1, 'meaning_hu' => 'a/az']),
        array_merge($base, ['word' => 'cut', 'rank' => 400, 'meaning_hu' => 'vág', 'verb_past' => 'cut', 'verb_present_participle' => 'cutting', 'verb_third_person' => 'cuts']),
        // Dual-class word: primarily a noun, but also carries its verb forms.
        array_merge($base, ['word' => 'interest', 'rank' => 500, 'meaning_hu' => 'érdeklődés', 'part_of_speech' => 'noun', 'noun_plural' => 'interests', 'verb_past' => 'interested', 'verb_past_participle' => 'interested', 'verb_present_participle' => 'interesting', 'verb_third_person' => 'interests']),
    ]);
});

test('text analysis page is accessible', function () {
    $this->get(route('text-analysis.show'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('text-analysis/index'));
});

test('analyze returns json with comprehension stats', function () {
    $this->postJson(route('text-analysis.analyze'), ['text' => 'the quick dog'])
        ->assertOk()
        ->assertJsonStructure(['comprehension', 'totalWords', 'uniqueWords', 'knownCount', 'learningCount', 'tokenStatuses', 'topUnknown']);
});

test('known words increase comprehension', function () {
    $word = Word::where('word', 'run')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'run run run'])
        ->assertOk()
        ->assertJsonPath('comprehension', 100)
        ->assertJsonPath('knownCount', 3)
        ->assertJsonPath('tokenStatuses.run', 'known');
});

test('word forms are recognized via variant columns', function () {
    $word = Word::where('word', 'run')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'running ran runs'])
        ->assertOk()
        ->assertJsonPath('knownCount', 3)
        ->assertJsonPath('tokenStatuses.running', 'known')
        ->assertJsonPath('tokenStatuses.ran', 'known')
        ->assertJsonPath('tokenStatuses.runs', 'known');
});

test('verb forms of a noun word are recognized in analysis', function () {
    // "interest" is stored as a noun but carries verb inflections on the same
    // row. Matching reads all form columns regardless of part_of_speech, so the
    // verb forms must resolve to the same status as the base word.
    $word = Word::where('word', 'interest')->first();
    $this->user->knownWords()->attach($word->id, ['status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'interested interesting interests'])
        ->assertOk()
        ->assertJsonPath('knownCount', 3)
        ->assertJsonPath('tokenStatuses.interested', 'known')
        ->assertJsonPath('tokenStatuses.interesting', 'known')
        ->assertJsonPath('tokenStatuses.interests', 'known');
});

test('apostrophe custom words get their status in the token map', function () {
    $this->user->customWords()->create(['word' => "I'm", 'status' => 'known']);
    $this->user->customWords()->create(['word' => "can't", 'status' => 'learning']);

    $this->postJson(route('text-analysis.analyze'), ['text' => "I'm sure I can't run"])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.i\'m', 'known')
        ->assertJsonPath('tokenStatuses.can\'t', 'learning');
});

test('custom word extra_forms are recognized in the token map', function () {
    // A „successfully"-t „successful" lemma alatt vettük fel, a beírt alakot az
    // extra_forms őrzi — a szövegelemzésnek mindkét alakra színeznie kell.
    $this->user->customWords()->create([
        'word' => 'successful',
        'status' => 'known',
        'extra_forms' => 'successfully',
    ]);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'a successful and successfully done task'])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.successful', 'known')
        ->assertJsonPath('tokenStatuses.successfully', 'known');
});

test('curly apostrophe in text matches a straight-apostrophe custom word', function () {
    $this->user->customWords()->create(['word' => "we'll", 'status' => 'known']);

    $this->postJson(route('text-analysis.analyze'), ['text' => "we\u{2019}ll see"])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.we\'ll', 'known');
});

test('words not in top 10k are classified as not_in_list', function () {
    $this->postJson(route('text-analysis.analyze'), ['text' => 'supercalifragilistic'])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.supercalifragilistic', 'not_in_list');
});

test('unknown words in top 10k appear in topUnknown list', function () {
    $response = $this->postJson(route('text-analysis.analyze'), ['text' => 'quick quick dog']);

    $words = array_column($response->json('topUnknown'), 'word');
    expect($words)->toContain('quick');
});

test('analyze requires text field', function () {
    $this->postJson(route('text-analysis.analyze'), [])
        ->assertUnprocessable();
});

test('analyze rejects text longer than 15000 characters', function () {
    $this->postJson(route('text-analysis.analyze'), ['text' => str_repeat('a ', 8000)])
        ->assertUnprocessable();
});

test('guests cannot access text analysis', function () {
    auth()->logout();

    $this->get(route('text-analysis.show'))->assertRedirect(route('login'));
    $this->postJson(route('text-analysis.analyze'), ['text' => 'hello world'])->assertUnauthorized();
});

function fakeYoutubeCaptions(int $lines = 120): void
{
    $events = [];
    for ($i = 0; $i < $lines; $i++) {
        $events[] = ['tStartMs' => $i * 3000, 'segs' => [['utf8' => "the quick dog line {$i}"]]];
    }

    // A `baseUrl` allowlistás YouTube-hostra mutat, mert az éles válasz is olyat
    // ad, és a `fetchCaptionBody` SSRF-guardja csak ilyet tölt le (SSRF-1).
    // Fiktív host (pl. `caption.test`) itt nem valósághű: a guard elvetné.
    Http::fake([
        'https://www.youtube.com/youtubei/v1/player*' => Http::response([
            'captions' => ['playerCaptionsTracklistRenderer' => ['captionTracks' => [
                ['languageCode' => 'en', 'baseUrl' => 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en'],
            ]]],
        ]),
        'https://www.youtube.com/api/timedtext*' => Http::response(json_encode(['events' => $events]), 200),
        'https://www.youtube.com/watch*' => Http::response(
            '<html><head><title>My Video - YouTube</title></head><body>"INNERTUBE_API_KEY":"AIzaTest123"</body></html>'
        ),
    ]);
}

test('youtube captions are saved as a timestamped, paginated transcript', function () {
    fakeYoutubeCaptions(120);

    $response = $this->postJson(route('text-analysis.youtube.store'), [
        'url' => 'https://www.youtube.com/watch?v=abcdefghijk',
    ]);

    $response->assertOk()
        ->assertJsonPath('transcript.total_pages', 3)
        ->assertJsonPath('transcript.title', 'My Video')
        ->assertJsonPath('transcript.video_id', 'abcdefghijk')
        ->assertJsonPath('page', 1)
        ->assertJsonPath('segments.0.t', 0)
        ->assertJsonPath('segments.0.x', 'the quick dog line 0');

    expect($response->json('segments'))->toHaveCount(50);

    $transcript = YoutubeTranscript::where('user_id', $this->user->id)->first();
    expect($transcript)->not->toBeNull();

    // Második oldal a felirat-lapozó végponton keresztül
    $this->getJson(route('text-analysis.youtube.page', ['transcript' => $transcript->id, 'page' => 2]))
        ->assertOk()
        ->assertJsonPath('page', 2)
        ->assertJsonPath('segments.0.x', 'the quick dog line 50');
});

test('youtube overview returns whole-video comprehension', function () {
    $this->user->knownWords()->attach(Word::where('word', 'dog')->first()->id, ['status' => 'known']);
    fakeYoutubeCaptions(10);

    $store = $this->postJson(route('text-analysis.youtube.store'), [
        'url' => 'https://www.youtube.com/watch?v=abcdefghijk',
    ])->assertOk();

    $transcript = YoutubeTranscript::where('user_id', $this->user->id)->first();

    $this->getJson(route('text-analysis.youtube.overview', ['transcript' => $transcript->id]))
        ->assertOk()
        ->assertJsonStructure(['comprehension', 'totalWords', 'uniqueWords', 'knownCount', 'learningCount'])
        ->assertJsonPath('knownCount', 10); // "dog" 10 sorban, mind ismert
});

test('youtube endpoint rejects non-youtube urls', function () {
    $this->postJson(route('text-analysis.youtube.store'), ['url' => 'https://example.com/article'])
        ->assertStatus(422)
        ->assertJsonPath('error', 'Érvénytelen YouTube link.');
});

test('an oversized caption download is refused, not parsed (CAP-2)', function () {
    // A feliratletöltésnek nem volt byte-sapkája: a YouTube (vagy egy hibás
    // válasz) tetszőleges méretű törzset tölthetett a memóriába.
    //
    // A sapkának KÉT rétege van: a curl progress-callback (valódi kapcsolaton
    // menet közben szakít) és a letöltés utáni méret-ellenőrzés. Ez a teszt a
    // másodikat hajtja — ugyanaz a minta, mint a fetch-source méret-sapkájánál.
    Http::fake([
        'https://www.youtube.com/youtubei/v1/player*' => Http::response([
            'captions' => ['playerCaptionsTracklistRenderer' => ['captionTracks' => [
                ['languageCode' => 'en', 'baseUrl' => 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en'],
            ]]],
        ]),
        'https://www.youtube.com/api/timedtext*' => Http::response(str_repeat('x', 8 * 1024 * 1024 + 1), 200),
        'https://www.youtube.com/watch*' => Http::response(
            '<html><head><title>Huge Video - YouTube</title></head><body>"INNERTUBE_API_KEY":"AIzaTest123"</body></html>'
        ),
    ]);

    $this->postJson(route('text-analysis.youtube.store'), [
        'url' => 'https://www.youtube.com/watch?v=abcdefghijk',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'A felirat túl nagy a feldolgozáshoz.');

    // A túl nagy felirat nem kerül feldolgozásra és nem is mentődik el.
    expect(YoutubeTranscript::where('user_id', $this->user->id)->count())->toBe(0);
});

test('a caption exactly at the cap is still accepted (CAP-2 határeset)', function () {
    // Határeset: a sapka a SZIGORÚAN nagyobb méretet tiltja, a pontosan akkorát
    // nem. Enélkül egy off-by-one hiba némán levágna legitim feliratokat.
    // A törzs itt szemétnek számít (nem parse-olható felirat), ezért a kérés
    // „nincs használható felirat" 422-vel zárul — a lényeg, hogy NEM a
    // méret-sapka utasítja el.
    Http::fake([
        'https://www.youtube.com/youtubei/v1/player*' => Http::response([
            'captions' => ['playerCaptionsTracklistRenderer' => ['captionTracks' => [
                ['languageCode' => 'en', 'baseUrl' => 'https://www.youtube.com/api/timedtext?v=abcdefghijk&lang=en'],
            ]]],
        ]),
        'https://www.youtube.com/api/timedtext*' => Http::response(str_repeat('x', 8 * 1024 * 1024), 200),
        'https://www.youtube.com/watch*' => Http::response(
            '<html><head><title>Edge Video - YouTube</title></head><body>"INNERTUBE_API_KEY":"AIzaTest123"</body></html>'
        ),
    ]);

    $this->postJson(route('text-analysis.youtube.store'), [
        'url' => 'https://www.youtube.com/watch?v=abcdefghijk',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'Ehhez a videóhoz nem érhetők el angol feliratok, vagy a felirat nem feldolgozható.');
});

test('a normal-length youtube transcript is still saved (CAP-1/CAP-2 ellenpróba)', function () {
    // A sapkák nem törhetik el a valós működést: a normál hosszúságú felirat
    // ugyanúgy letöltődik, lapozódik és mentődik.
    fakeYoutubeCaptions(120);

    $this->postJson(route('text-analysis.youtube.store'), [
        'url' => 'https://www.youtube.com/watch?v=abcdefghijk',
    ])
        ->assertOk()
        ->assertJsonPath('transcript.total_pages', 3);

    expect(YoutubeTranscript::where('user_id', $this->user->id)->count())->toBe(1);
});

test('book overview returns whole-book comprehension', function () {
    $this->user->knownWords()->attach(Word::where('word', 'dog')->first()->id, ['status' => 'known']);

    $text = str_repeat('the quick dog ', 10); // a "dog" 10-szer szerepel, ismert
    $book = UserBook::create([
        'user_id' => $this->user->id,
        'title' => 'Teszt könyv',
        'file_type' => 'pdf',
        'compressed_text' => gzencode($text, 6),
        'total_pages' => 1,
        'text_size' => strlen($text),
    ]);

    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))
        ->assertOk()
        ->assertJsonStructure(['comprehension', 'totalWords', 'uniqueWords', 'knownCount', 'learningCount'])
        ->assertJsonPath('knownCount', 10)
        // Az összesítőbe csak a számok kellenek, a token-térképek nem.
        ->assertJsonMissingPath('tokenStatuses')
        ->assertJsonMissingPath('phraseStatuses');
});

test('book overview is cached so repeated calls skip the full re-analysis', function () {
    $this->user->knownWords()->attach(Word::where('word', 'dog')->first()->id, ['status' => 'known']);

    $text = str_repeat('the quick dog ', 10);
    $book = UserBook::create([
        'user_id' => $this->user->id,
        'title' => 'Teszt könyv',
        'file_type' => 'pdf',
        'compressed_text' => gzencode($text, 6),
        'total_pages' => 1,
        'text_size' => strlen($text),
    ]);

    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))
        ->assertOk()
        ->assertJsonPath('knownCount', 10);

    // Új ismert szó a TTL-en belül: a cache-elt összesítő még a korábbi számokat adja.
    $this->user->knownWords()->attach(Word::where('word', 'quick')->first()->id, ['status' => 'known']);

    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))
        ->assertOk()
        ->assertJsonPath('knownCount', 10);
});

test('book overview caps the analysed text length as a memory guard', function () {
    $this->user->knownWords()->attach(Word::where('word', 'dog')->first()->id, ['status' => 'known']);

    // 600 000 × "dog " = 2,4 M karakter; a 2 M-es sapka pontosan 500 000 teljes szót enged be.
    $text = str_repeat('dog ', 600_000);
    $book = UserBook::create([
        'user_id' => $this->user->id,
        'title' => 'Nagy könyv',
        'file_type' => 'pdf',
        'compressed_text' => gzencode($text, 6),
        'total_pages' => 1,
        'text_size' => strlen($text),
    ]);

    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))
        ->assertOk()
        ->assertJsonPath('totalWords', 500_000)
        ->assertJsonPath('knownCount', 500_000);
});

test('book overview is throttled', function () {
    $book = UserBook::create([
        'user_id' => $this->user->id,
        'title' => 'Teszt könyv',
        'file_type' => 'pdf',
        'compressed_text' => gzencode('the quick dog', 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    for ($i = 0; $i < 10; $i++) {
        $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))->assertOk();
    }

    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))
        ->assertStatus(429);
});

test('free plan is capped at the configured number of saved youtube transcripts', function () {
    fakeYoutubeCaptions(10);
    $limit = (int) config('plans.limits.free.youtube_transcripts');

    // 11 karakteres, érvényes videó-ID-k (keret + 1 a túllépéshez).
    $ids = ['abcdefghijk', 'lmnopqrstuv', 'wxyz01234ab', 'cdefghij567', 'klmno890pqr'];

    // A keretig menthető.
    for ($i = 0; $i < $limit; $i++) {
        $this->postJson(route('text-analysis.youtube.store'), ['url' => 'https://www.youtube.com/watch?v='.$ids[$i]])
            ->assertOk();
    }

    // A kereten túl 403.
    $this->postJson(route('text-analysis.youtube.store'), ['url' => 'https://www.youtube.com/watch?v='.$ids[$limit]])
        ->assertStatus(403);
});

// ── SSRF guard (fetch-source) ────────────────────────────────────────────────

test('fetch-source rejects a private/reserved IP host', function () {
    Http::fake(); // nothing should ever be fetched

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://127.0.0.1/secret'])
        ->assertStatus(422);

    Http::assertNothingSent();
});

test('fetch-source rejects a redirect to an internal address', function () {
    // First (public) hop redirects to a link-local/internal address.
    Http::fake([
        'http://93.184.216.34/*' => Http::response('', 302, ['Location' => 'http://169.254.169.254/latest/meta-data/']),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/article'])
        ->assertStatus(422);
});

test('fetch-source extracts text from a public page', function () {
    Http::fake([
        'http://93.184.216.34/*' => Http::response(
            '<html><body><article><p>This is a sufficiently long article paragraph that survives the short-line filter.</p></article></body></html>',
            200,
        ),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/article'])
        ->assertOk()
        ->assertJsonPath('text', fn ($text) => str_contains($text, 'sufficiently long article paragraph'));
});

test('fetch-source rejects non-text content', function () {
    Http::fake([
        'http://93.184.216.34/*' => Http::response('%PDF-1.7 binary payload', 200, ['Content-Type' => 'application/pdf']),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/file.pdf'])
        ->assertStatus(422)
        ->assertJsonPath('error', 'A megadott cím nem weboldalra mutat (nem szöveges tartalom).');
});

test('fetch-source a cikk törzsét adja vissza, a lap kerete nélkül', function () {
    // A kinyerést az ArticleTextExtractor végzi; itt az a kérdés, hogy a
    // végponton át is a cikk jön-e, és nem a menü/lábléc.
    Http::fake([
        'http://93.184.216.34/*' => Http::response(
            '<html><body><nav><a>Kezdőlap</a><a>Sport</a></nav><main><p>The council approved the budget after a long debate.</p></main><footer>Copyright 2026</footer></body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/article'])
        ->assertOk()
        ->assertJsonPath('text', 'The council approved the budget after a long debate.');
});

test('fetch-source kimondja, ha a lap JS-ből rendereli a tartalmát', function () {
    // Üres kinyerés korábban néma, üres előnézet lett — a felhasználó nem
    // tudta, miért nincs semmi.
    Http::fake([
        'http://93.184.216.34/*' => Http::response(
            '<html><body><div id="root"></div><script>renderApp()</script></body></html>',
            200,
            ['Content-Type' => 'text/html'],
        ),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/spa'])
        ->assertStatus(422)
        ->assertJsonPath('error', fn (string $error) => str_contains($error, 'JavaScripttel'));
});

test('fetch-source rejects a response body over the size cap', function () {
    Http::fake([
        'http://93.184.216.34/*' => Http::response(str_repeat('a', 2 * 1024 * 1024 + 1), 200, ['Content-Type' => 'text/html']),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/huge'])
        ->assertStatus(422)
        ->assertJsonPath('error', 'A megadott oldal túl nagy a beolvasáshoz.');
});

test('fetch-source rejects a non-web port (SSRF-LOW-2)', function () {
    // Port-allowlist nélkül a szerver forrás-IP-jéről időzítés-alapú
    // port-felderítés volt végezhető publikus hostokon.
    Http::fake(); // semmit nem szabad lekérni

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34:3306/'])
        ->assertStatus(422);

    Http::assertNothingSent();
});

test('fetch-source rejects a redirect to a non-web port (SSRF-LOW-2)', function () {
    // Él-eset: a belépő URL szabályos, de az átirányítás visz tiltott portra.
    // A port-ellenőrzés az assertPublicHost-ban van, amit a safeFetch HOPONKÉNT
    // hív — így a redirect sem kerülheti meg.
    Http::fake([
        'http://93.184.216.34/article' => Http::response('', 302, ['Location' => 'http://93.184.216.34:6379/']),
        // A tiltott portra menő hívást a guardnak MEG KELL előznie; ha mégis
        // kimenne, ez a fake fogná el (különben valós kapcsolatra futna ki).
        'http://93.184.216.34:6379/*' => Http::response('leaked', 200, ['Content-Type' => 'text/html']),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34/article'])
        ->assertStatus(422);

    // A lelet lényege: a tiltott portot a szerver soha ne is érintse meg.
    Http::assertNotSent(fn ($request) => str_contains($request->url(), ':6379'));
});

test('fetch-source allows the standard web ports', function () {
    // Ellenpróba: az allowlist nem törheti el a normál működést — a 8080 is
    // engedélyezett, és az explicit :80 sem esik ki.
    Http::fake([
        'http://93.184.216.34:8080/*' => Http::response(
            '<html><body><article><p>This is a sufficiently long article paragraph that survives the short-line filter.</p></article></body></html>',
            200,
        ),
    ]);

    $this->postJson(route('text-analysis.fetch-source'), ['url' => 'http://93.184.216.34:8080/article'])
        ->assertOk();
});

// ── Multi-word custom phrases must not hijack a plain word ────────────────────

test('a multi-word custom phrase does not hijack a plain word in analysis', function () {
    $cut = Word::where('word', 'cut')->firstOrFail();
    $this->user->knownWords()->attach($cut->id, ['status' => 'known']);

    // Phrasal verb stored with single-word conjugations (real data shape).
    $this->user->customWords()->create([
        'word' => 'cut through',
        'status' => 'learning',
        'verb_past' => 'cut',
        'verb_third_person' => 'cuts',
        'verb_present_participle' => 'cutting',
    ]);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'I want to cut the rope'])
        ->assertOk()
        ->assertJsonPath('tokenStatuses.cut', 'known');
});

test('analysis returns phrase statuses for multi-word custom phrases present in the text', function () {
    $this->user->customWords()->create([
        'word' => 'cut through',
        'status' => 'learning',
        'verb_past' => 'cut', // single-word form must not leak into token coloring
    ]);

    $this->postJson(route('text-analysis.analyze'), ['text' => 'They will cut through the noise'])
        ->assertOk()
        ->assertJsonPath('phraseStatuses.cut through', 'learning')
        // The bare token "cut" keeps its own (word-list) status, not the phrase's.
        ->assertJsonPath('tokenStatuses.cut', 'in_list');
});

test('analysis returns phrase statuses for a five-word custom phrase present in the text', function () {
    // A kliens kiemelés-plafonja (MAX_PHRASE_WORDS) 5 szó — a backend nem
    // korlátoz hosszra, így egy 5 szavas kifejezésnek is el kell jutnia a
    // phraseStatuses térképbe, hogy a szövegben kifestődhessen.
    $this->user->customWords()->create([
        'word' => 'closing in on you now',
        'status' => 'learning',
    ]);

    $this->postJson(route('text-analysis.analyze'), [
        'text' => 'The walls are closing in on you now completely',
    ])
        ->assertOk()
        ->assertJsonPath('phraseStatuses.closing in on you now', 'learning');
});

test('looking up a plain word does not return a multi-word custom phrase', function () {
    $cut = Word::where('word', 'cut')->firstOrFail();
    $this->user->knownWords()->attach($cut->id, ['status' => 'known']);

    $this->user->customWords()->create([
        'word' => 'cut through',
        'status' => 'learning',
        'verb_past' => 'cut',
    ]);

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'cut']))
        ->assertOk()
        ->assertJsonPath('type', 'word')
        ->assertJsonPath('word', 'cut')
        ->assertJsonPath('status', 'known');
});

test('every word lookup outcome carries a type field', function () {
    // A szóelemző dialógus (word-lookup-dialog.tsx) a `type` meglétén
    // különbözteti meg az érvényes találatot a hiba-JSON-tól: minden
    // sikeres válasznak (word / custom / not_found) tartalmaznia kell.
    $this->user->customWords()->create(['word' => 'ephemeral', 'status' => 'learning']);

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'dog']))
        ->assertOk()
        ->assertJsonPath('type', 'word');

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'ephemeral']))
        ->assertOk()
        ->assertJsonPath('type', 'custom');

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'xyzzyx']))
        ->assertOk()
        ->assertJsonPath('type', 'not_found');
});

test('a word lookup returns the same field set the word list detail modal renders', function () {
    // A szövegelemző dialógusa ugyanazt a részletező nézetet rendereli, mint a
    // szólista modálja (WordDetailSections). Ha ezek a mezők nem jönnek le, ott
    // némán eltűnnek az alakok, a szinonimák és a magyar példamondat.
    $interest = Word::where('word', 'interest')->firstOrFail();
    $interest->update([
        'extra_meanings' => 'kamat, érdek',
        'synonyms' => 'curiosity, concern',
        'example_en' => 'She showed interest.',
        'example_hu' => 'Érdeklődést mutatott.',
        'is_irregular' => 0,
    ]);
    $this->user->knownWords()->attach($interest->id, ['status' => 'learning', 'importance' => 4]);

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'interests']))
        ->assertOk()
        ->assertJson([
            'type' => 'word',
            'id' => $interest->id,
            'word' => 'interest',
            'meaning_hu' => 'érdeklődés',
            'extra_meanings' => 'kamat, érdek',
            'synonyms' => 'curiosity, concern',
            'part_of_speech' => 'noun',
            'noun_plural' => 'interests',
            'verb_past' => 'interested',
            'verb_past_participle' => 'interested',
            'verb_present_participle' => 'interesting',
            'verb_third_person' => 'interests',
            'is_irregular' => false,
            'example_en' => 'She showed interest.',
            'example_hu' => 'Érdeklődést mutatott.',
            'rank' => 500,
            'status' => 'learning',
            'importance' => 4,
        ]);
});

test('a word lookup marks an irregular verb and reports a missing pivot as empty', function () {
    $run = Word::where('word', 'run')->firstOrFail();
    $run->update(['is_irregular' => 1]);

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'ran']))
        ->assertOk()
        ->assertJsonPath('is_irregular', true)
        // Nincs pivot: se státusz, se csillag — a dialógus üres gombsort mutat.
        ->assertJsonPath('status', null)
        ->assertJsonPath('importance', null);
});

test('a custom word lookup returns its forms and importance', function () {
    $custom = $this->user->customWords()->create([
        'word' => 'ephemeral',
        'meaning_hu' => 'tünékeny',
        'extra_meanings' => 'rövid életű',
        'synonyms' => 'fleeting, transient',
        'part_of_speech' => 'adj',
        'adj_comparative' => 'more ephemeral',
        'adj_superlative' => 'most ephemeral',
        'example_en' => 'An ephemeral joy.',
        'example_hu' => 'Tünékeny öröm.',
        'is_irregular' => false,
        'status' => 'saved',
        'importance' => 2,
    ]);

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'ephemeral']))
        ->assertOk()
        ->assertJson([
            'type' => 'custom',
            'id' => $custom->id,
            'word' => 'ephemeral',
            'extra_meanings' => 'rövid életű',
            'synonyms' => 'fleeting, transient',
            'adj_comparative' => 'more ephemeral',
            'adj_superlative' => 'most ephemeral',
            'example_hu' => 'Tünékeny öröm.',
            'is_irregular' => false,
            'status' => 'saved',
            'importance' => 2,
        ]);
});

test('unauthenticated word lookup returns 401 json instead of a fake result', function () {
    auth()->logout();

    $this->getJson(route('text-analysis.word-lookup', ['word' => 'dog']))
        ->assertUnauthorized()
        ->assertJsonMissingPath('type');
});

function geminiSuccess(array $payload): array
{
    return ['candidates' => [['content' => ['parts' => [['text' => json_encode($payload)]]]]]];
}

test('gemini lookup retries a transient 503 then succeeds', function () {
    $this->user->forceFill(['ai_access' => true])->save();

    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::sequence()
            ->push(['error' => 'overloaded'], 503)
            ->push(geminiSuccess(['meaning_hu' => 'kutya', 'part_of_speech' => 'noun']), 200),
    ]);

    $this->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertOk()
        ->assertJsonPath('meaning_hu', 'kutya')
        ->assertJsonPath('part_of_speech', 'noun');

    Http::assertSentCount(2);
});

test('gemini lookup passes through cross-class form fields for a noun', function () {
    $this->user->forceFill(['ai_access' => true])->save();

    // The model returns a noun whose verb forms also exist (e.g. "interest").
    // The controller must NOT strip the verb forms just because the primary
    // part_of_speech is "noun".
    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response(geminiSuccess([
            'is_real_word' => true,
            'meaning_hu' => 'érdeklődés',
            'part_of_speech' => 'noun',
            'noun_plural' => 'interests',
            'verb_past' => 'interested',
            'verb_present_participle' => 'interesting',
            'verb_third_person' => 'interests',
        ]), 200),
    ]);

    $this->getJson(route('text-analysis.gemini-lookup', ['word' => 'interest']))
        ->assertOk()
        ->assertJsonPath('part_of_speech', 'noun')
        ->assertJsonPath('noun_plural', 'interests')
        ->assertJsonPath('verb_past', 'interested')
        ->assertJsonPath('verb_present_participle', 'interesting')
        ->assertJsonPath('verb_third_person', 'interests');
});

test('gemini lookup returns 502 after both primary and fallback exhaust 503s', function () {
    $this->user->forceFill(['ai_access' => true])->save();

    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response(['error' => 'overloaded'], 503),
    ]);

    $this->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    // A primary 2 próbája + a fallback 2 próbája = 4 hívás, mind 503 → 502.
    Http::assertSentCount(4);
});

test('gemini lookup does not retry a non-retryable 400', function () {
    $this->user->forceFill(['ai_access' => true])->save();

    Http::fake([
        'generativelanguage.googleapis.com/*' => Http::response(['error' => 'bad request'], 400),
    ]);

    $this->getJson(route('text-analysis.gemini-lookup', ['word' => 'dog']))
        ->assertStatus(502);

    Http::assertSentCount(1);
});

test('youtube transcript can be deleted by its owner', function () {
    $transcript = YoutubeTranscript::create([
        'user_id' => $this->user->id,
        'video_id' => 'abcdefghijk',
        'title' => 'My Video',
        'compressed_segments' => gzencode(json_encode([['t' => 0, 'x' => 'the quick dog']]), 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    $this->deleteJson(route('text-analysis.youtube.destroy', ['transcript' => $transcript->id]))
        ->assertOk()
        ->assertJsonPath('ok', true);

    expect(YoutubeTranscript::find($transcript->id))->toBeNull();
});

test('youtube transcript of another user cannot be deleted', function () {
    $other = User::factory()->create();
    $transcript = YoutubeTranscript::create([
        'user_id' => $other->id,
        'video_id' => 'abcdefghijk',
        'title' => 'Más videója',
        'compressed_segments' => gzencode(json_encode([['t' => 0, 'x' => 'the quick dog']]), 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    $this->deleteJson(route('text-analysis.youtube.destroy', ['transcript' => $transcript->id]))
        ->assertForbidden();

    expect(YoutubeTranscript::find($transcript->id))->not->toBeNull();
});

test('book can be deleted by its owner', function () {
    $book = UserBook::create([
        'user_id' => $this->user->id,
        'title' => 'Teszt könyv',
        'file_type' => 'pdf',
        'compressed_text' => gzencode('the quick dog', 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    $this->deleteJson(route('text-analysis.books.destroy', ['book' => $book->id]))
        ->assertOk()
        ->assertJsonPath('ok', true);

    expect(UserBook::find($book->id))->toBeNull();
});

test('book of another user cannot be deleted', function () {
    $other = User::factory()->create();
    $book = UserBook::create([
        'user_id' => $other->id,
        'title' => 'Más könyve',
        'file_type' => 'pdf',
        'compressed_text' => gzencode('the quick dog', 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    $this->deleteJson(route('text-analysis.books.destroy', ['book' => $book->id]))
        ->assertForbidden();

    expect(UserBook::find($book->id))->not->toBeNull();
});

test('book overview consumes the daily analysis quota and blocks over the free limit', function () {
    // M1: a teljes-könyv megértés ugyanúgy elemzési esemény, ezért a napi
    // text_analyses_per_day keretbe számít — különben a beillesztett-szöveg
    // "napi 2" korlát megkerülhető lenne könyv-úton.
    $makeBook = fn (string $title) => UserBook::create([
        'user_id' => $this->user->id,
        'title' => $title,
        'file_type' => 'pdf',
        'compressed_text' => gzencode('the quick dog', 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    $limit = $this->user->planLimit('text_analyses_per_day'); // free = 2
    expect($limit)->toBe(2);

    for ($i = 1; $i <= $limit; $i++) {
        $this->getJson(route('text-analysis.books.overview', ['book' => $makeBook("Könyv $i")->id]))
            ->assertOk();
    }

    $key = "text_analysis_daily_{$this->user->id}_".today()->format('Y-m-d');
    expect((int) Cache::get($key))->toBe($limit);

    // A keret fölött egy friss (nem cache-elt) könyv-overview 403-at ad.
    $this->getJson(route('text-analysis.books.overview', ['book' => $makeBook('Túllépő')->id]))
        ->assertForbidden()
        ->assertJsonPath('error', 'limit_reached');
});

test('cached book overview does not re-consume the daily analysis quota', function () {
    // Cache-találatnál nincs új elemzés, így a keret sem fogy tovább.
    $book = UserBook::create([
        'user_id' => $this->user->id,
        'title' => 'Teszt könyv',
        'file_type' => 'pdf',
        'compressed_text' => gzencode('the quick dog', 6),
        'total_pages' => 1,
        'text_size' => 13,
    ]);

    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))->assertOk();
    $this->getJson(route('text-analysis.books.overview', ['book' => $book->id]))->assertOk();

    $key = "text_analysis_daily_{$this->user->id}_".today()->format('Y-m-d');
    expect((int) Cache::get($key))->toBe(1);
});

test('youtube overview consumes the daily analysis quota', function () {
    fakeYoutubeCaptions(10);
    $this->postJson(route('text-analysis.youtube.store'), [
        'url' => 'https://www.youtube.com/watch?v=abcdefghijk',
    ])->assertOk();

    $transcript = YoutubeTranscript::where('user_id', $this->user->id)->first();

    $this->getJson(route('text-analysis.youtube.overview', ['transcript' => $transcript->id]))
        ->assertOk();

    $key = "text_analysis_daily_{$this->user->id}_".today()->format('Y-m-d');
    expect((int) Cache::get($key))->toBe(1);
});
