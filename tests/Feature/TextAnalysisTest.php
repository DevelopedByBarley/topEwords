<?php

use App\Models\User;
use App\Models\UserBook;
use App\Models\Word;
use App\Models\YoutubeTranscript;
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

    Http::fake([
        'https://www.youtube.com/youtubei/v1/player*' => Http::response([
            'captions' => ['playerCaptionsTracklistRenderer' => ['captionTracks' => [
                ['languageCode' => 'en', 'baseUrl' => 'https://caption.test/track'],
            ]]],
        ]),
        'https://caption.test/*' => Http::response(json_encode(['events' => $events]), 200),
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
        ->assertJsonPath('knownCount', 10);
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
