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

test('free plan is limited to one saved youtube transcript', function () {
    fakeYoutubeCaptions(10);

    $this->postJson(route('text-analysis.youtube.store'), ['url' => 'https://www.youtube.com/watch?v=abcdefghijk'])
        ->assertOk();

    $this->postJson(route('text-analysis.youtube.store'), ['url' => 'https://www.youtube.com/watch?v=lmnopqrstuv'])
        ->assertStatus(403);
});
