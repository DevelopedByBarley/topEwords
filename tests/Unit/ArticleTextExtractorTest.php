<?php

use App\Services\ArticleTextExtractor;

beforeEach(function () {
    $this->extractor = new ArticleTextExtractor;
});

test('a valódi cikket választja, nem a DOM-sorrendben első ajánló-kártyát', function () {
    $html = <<<'HTML'
        <html><body>
            <article class="teaser"><h3>Related: Five things to know</h3></article>
            <article class="story">
                <p>The government announced a new policy today.</p>
                <p>Officials said it would take effect next year.</p>
            </article>
        </body></html>
        HTML;

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('The government announced a new policy today.')
        ->toContain('Officials said it would take effect next year.')
        ->not->toContain('Five things to know');
});

test('a blokkhatárokon nem ragasztja össze a szavakat', function () {
    $html = '<body><main><p>First paragraph here.</p><p>Second paragraph here.</p></main></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe("First paragraph here.\n\nSecond paragraph here.")
        ->not->toMatch('/here\.Second/');
});

test('megtartja a rövid bekezdéseket és a párbeszédet', function () {
    $html = '<body><article><p>"Are you coming?" she asked.</p><p>"No," he said.</p></article></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('"Are you coming?" she asked.')
        ->toContain('"No," he said.');
});

test('minifikált HTML-ből is kiszedi a cikket', function () {
    $html = '<body><div class="menu"><a>Home</a><a>Sport</a></div><main><p>The council approved the budget after a long debate.</p></main></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe('The council approved the budget after a long debate.')
        ->not->toContain('Home');
});

test('a saját div-jükben álló bekezdéseket mind megtartja', function () {
    $html = '<body>'.str_repeat('<div class="row"><p>Ez egy elég hosszú bekezdés ahhoz, hogy számítson.</p></div>', 20).'</body>';

    $text = $this->extractor->extract($html);

    expect(substr_count($text, 'Ez egy elég hosszú bekezdés'))->toBe(20);
});

test('eldobja a boilerplate-et a cikk körül', function (string $noise) {
    $html = "<body><div class=\"wrap\">{$noise}<article><p>The council approved the budget after a long debate last night.</p></article></div></body>";

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('The council approved the budget')
        ->not->toContain('ZAJ');
})->with([
    'nav' => '<nav><a>ZAJ menüpont</a></nav>',
    'footer' => '<footer>ZAJ copyright 2026 minden jog fenntartva</footer>',
    'cookie-sáv' => '<div class="cookie-banner">ZAJ we use cookies to improve your experience</div>',
    'komment-szekció' => '<section id="comments"><p>ZAJ user123: I disagree with this article</p></section>',
    'ajánló-lista' => '<div class="related-articles"><p>ZAJ more from this section today</p></div>',
    'oldalsáv' => '<aside><p>ZAJ hirdetés és feliratkozás a hírlevélre</p></aside>',
    'aria-navigáció' => '<div role="navigation"><p>ZAJ ugrás a tartalomra és a lábléchez</p></div>',
    'svg-szöveg' => '<svg><text>ZAJ ikon felirat</text></svg>',
]);

test('a class-minta nem törölhet dokumentum-szintű elemet', function () {
    $html = '<html class="vector-feature-main-menu-pinned-clientpref-1"><body class="skin-vector"><article><p>The council approved the budget after a long debate.</p></article></body></html>';

    expect($this->extractor->extract($html))->toContain('The council approved the budget');
});

test('a tartalom keretét nem dobja el, ha a minta rá is illeszkedik', function () {
    $html = '<body><div class="content-header"><p>Ez a cikk teljes szövege, ami a lap tartalmának lényegében az egésze.</p></div></body>';

    expect($this->extractor->extract($html))->toContain('Ez a cikk teljes szövege');
});

test('nem bontja ki a külső entitást (XXE)', function () {
    $html = '<!DOCTYPE html [<!ENTITY leak SYSTEM "file:///etc/passwd">]><html><body><article><p>Ez a cikk törzse, elég hosszú ahhoz, hogy számítson.</p><p>&leak;</p></article></body></html>';

    expect($this->extractor->extract($html))
        ->toContain('Ez a cikk törzse')
        ->not->toContain('root:');
});

test('az entitás-bomba nem fejlődik ki', function () {
    $html = '<!DOCTYPE html [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]><html><body><p>&c;</p></body></html>';

    expect(mb_strlen($this->extractor->extract($html)))->toBeLessThan(100);
});

test('a mélyen ágyazott lap nem köti le a CPU-t', function () {
    $html = '<html><body>'.str_repeat('<div>', 50000).'x'.str_repeat('</div>', 50000).'</body></html>';

    $start = microtime(true);
    $this->extractor->extract($html);
    $elapsed = (microtime(true) - $start) * 1000;

    expect($elapsed)->toBeLessThan(500.0);
});

test('a sapka fölötti lap sem marad szöveg nélkül, és ott sem ragadnak össze a szavak', function () {
    $filler = str_repeat('<span>x</span>', 30000);
    $html = "<html><body>{$filler}<p>First paragraph here.</p><p>Second paragraph here.</p></body></html>";

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('First paragraph here.')
        ->toContain('Second paragraph here.')
        ->not->toMatch('/here\.Second/');
});

test('nem ad vissza markupot', function () {
    $html = '<body><article><p>Ez a cikk <strong>törzse</strong>, elég hosszú ahhoz, hogy számítson.</p><p><img src=x onerror=alert(1)>Második bekezdés a cikkben.</p></article></body>';

    expect($this->extractor->extract($html))
        ->not->toContain('<')
        ->not->toContain('onerror');
});

test('üres és nem-HTML bemenetre nem hasal el', function (string $input, string $expected) {
    expect($this->extractor->extract($input))->toBe($expected);
})->with([
    'üres' => ['', ''],
    'nyers szöveg' => ['csak sima szöveg', 'csak sima szöveg'],
    'szemét' => ['<<<>>>', '<<<>>>'],
]);
