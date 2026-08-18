<?php

use App\Services\BookTextExtractor;

/**
 * Az EPUB-fejezetek szöveggé alakítása.
 *
 * A tesztek a korábbi `htmlToCleanText()` + `cleanExtractedText()` páros mért
 * hibáit fedik: OLVASHATÓSÁG (mi lesz bekezdés), MIT SZED KI (amit korábban
 * némán elvesztett), MIT DOB EL (előzéklap, kolofón, licenc) és BIZTONSÁG.
 */
beforeEach(function () {
    $this->extractor = new BookTextExtractor;
});

// ── Olvashatóság: mi lesz bekezdés ───────────────────────────────────────────

test('a forrás tördelését egy bekezdésbe olvasztja', function () {
    // A Gutenberg-EPUB ~70 karakterenként sortörést tesz a forrásba. Korábban
    // ezek mind bekezdés-határként mentek tovább: 11 231 sortörés 14 valódi
    // bekezdés-határra, és a frontend az első lapból 79 fél mondatos `<p>`-t
    // rendert.
    $html = "<body><p>It is a truth universally acknowledged, that a single man in\npossession of a good fortune, must be in want of a wife.</p>\n<p>However little known the feelings of such a man may be.</p></body>";

    $text = $this->extractor->extract($html);

    expect($text)->toBe(
        "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n".
        'However little known the feelings of such a man may be.'
    );
});

test('a kézi sortörés bekezdés-határ marad', function () {
    // A `<br>` korábban SZÓKÖZZÉ olvadt, ezért a `<br/>`-rel tördelt
    // előzéklapok, blurbök és cím-listák egyetlen összefolyó szövegfallá lettek.
    $html = '<body><p>TOR BOOKS BY ORSON SCOTT CARD<br/>Speaker for the Dead<br />Children of the Mind</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)->toBe("TOR BOOKS BY ORSON SCOTT CARD\nSpeaker for the Dead\nChildren of the Mind");
});

// ── Mit szed ki ──────────────────────────────────────────────────────────────

test('a duplán kódolt entitást is dekódolja', function () {
    // A forrásban `&amp;#8217;` áll: egyetlen dekódolás után `&#8217;` MARADT
    // szövegként, és a szóelemző „Ender" + „s" tokent kapott az „Ender's"
    // helyett.
    $html = '<body><p>&amp;#8220;Ender&amp;#8217;s Game&amp;#8221; is a novel about a boy.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('Ender’s Game')
        ->not->toContain('&#');
});

test('megtartja a rövid, de mondatvégi írásjelre végződő sort', function () {
    // A 15 karakteres sorszűrő a „He was silent." (14 karakter) típusú
    // mondatokat némán eldobta.
    $html = '<body><p>He was silent.</p><p>Ender nodded.</p><p>A long enough paragraph that no filter can touch it.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('He was silent.')
        ->toContain('Ender nodded.');
});

// ── Mit dob el ───────────────────────────────────────────────────────────────

test('a fejezet <title>-je nem szivárog a szövegbe', function () {
    // A `head` nem volt a drop-listán, ezért a cím MINDEN fejezet első
    // „bekezdése" lett: „Pride and prejudice | Project Gutenberg".
    $html = '<html><head><title>Pride and prejudice | Project Gutenberg</title><meta charset="utf-8"/><link rel="stylesheet" href="0.css"/></head><body><p>It is a truth universally acknowledged.</p></body></html>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe('It is a truth universally acknowledged.')
        ->not->toContain('Project Gutenberg');
});

test('a header eltávolítása nem viszi el a fejezetet', function () {
    // A drop-minta `head` alternatívája a `<header>`-re is illeszkedne, ha nem
    // követné tag-név-határ: akkor a `</head>`-ig MINDENT elvinne.
    $html = '<html><body><header>Chapter navigation links</header><p>Real prose that must survive the drop.</p></body></html>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe('Real prose that must survive the drop.')
        ->not->toContain('Chapter navigation');
});

test('a szögletes zárójeles kolofón-sorokat eldobja', function () {
    $html = '<body><p>[Colophon: GEORGE ALLEN PUBLISHER, LONDON]</p><p>[Copyright 1894 by George Allen.]</p><p>It is a truth universally acknowledged.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)->toBe('It is a truth universally acknowledged.');
});

test('az előzéklap jogi sorait eldobja', function () {
    $html = '<body><p>All rights reserved.</p><p>ISBN 0-812-55070-6</p><p>Library of Congress Cataloging-in-Publication Data</p><p>Printed in the United States of America</p><p>It is a truth universally acknowledged.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)->toBe('It is a truth universally acknowledged.');
});

test('a jogi kulcsszó-szűrő nem nyúl a valódi bekezdésekhez', function () {
    // A minta szövegrészletre illeszkedik, ezért csak rövid sorokra alkalmazzuk:
    // egy valódi bekezdés, ami mellékesen említi a „first edition" fordulatot,
    // nem eshet ki.
    $prose = 'He turned the book over in his hands and remembered the first edition his father had kept on the top shelf, the one nobody was ever allowed to open, and he wondered whether it was still there after all these years.';
    $html = "<body><p>{$prose}</p></body>";

    $text = $this->extractor->extract($html);

    expect($text)->toBe($prose);
});

test('a Gutenberg-markereken kívüli licencszöveget levágja', function () {
    $html = <<<'HTML'
        <body>
            <p>This eBook is for the use of anyone anywhere in the United States and most other parts of the world at no cost.</p>
            <p>*** START OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***</p>
            <p>It is a truth universally acknowledged, that a single man must be in want of a wife.</p>
            <p>*** END OF THE PROJECT GUTENBERG EBOOK PRIDE AND PREJUDICE ***</p>
            <p>Please read the full license before you redistribute this work in any form.</p>
        </body>
        HTML;

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe('It is a truth universally acknowledged, that a single man must be in want of a wife.')
        ->not->toContain('This eBook is for the use')
        ->not->toContain('Please read the full license');
});

test('a képeket, scripteket és URL-sorokat eldobja', function () {
    $html = '<body><script>var a = 1;</script><style>p { color: red; }</style><p>Chapter<img src="ornament.png" alt="ornament"/>One begins here.</p><p>www.tor-forge.com</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe('Chapter One begins here.')
        ->not->toContain('tor-forge')
        ->not->toContain('var a');
});

// ── Biztonság ────────────────────────────────────────────────────────────────

test('az ismételt dekódolás körben limitált, és markup nem épül vissza', function () {
    // Négyszeresen kódolt jelölés: három kör után szövegként marad. A dekódolás
    // a `strip_tags()` UTÁN fut, ezért a dekódolt `<`/`>` karakterekből tag
    // semmiképp nem értelmeződik — a kimenet sima szöveg.
    $html = '<body><p>This line is multiply encoded: &amp;amp;amp;lt;script&amp;amp;amp;gt; and the rest stays text.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('&lt;script&gt;')
        ->not->toContain('<script>');
});

test('a jelölés nélküli szöveget is visszaadja', function () {
    // Blokkelem nélküli fejezet (nyers szöveg a body-ban): üres kimenetnél ez is
    // jobb — a hívó a 60 karakteres alsó korláttal dönt a fejezet sorsáról.
    $text = $this->extractor->extract('<body>Just plain text without any block element at all.</body>');

    expect($text)->toBe('Just plain text without any block element at all.');
});
