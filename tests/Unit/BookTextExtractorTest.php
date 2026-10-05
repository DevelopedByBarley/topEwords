<?php

use App\Services\BookTextExtractor;

beforeEach(function () {
    $this->extractor = new BookTextExtractor;
});

test('a forrás tördelését egy bekezdésbe olvasztja', function () {
    $html = "<body><p>It is a truth universally acknowledged, that a single man in\npossession of a good fortune, must be in want of a wife.</p>\n<p>However little known the feelings of such a man may be.</p></body>";

    $text = $this->extractor->extract($html);

    expect($text)->toBe(
        "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n".
        'However little known the feelings of such a man may be.'
    );
});

test('a kézi sortörés bekezdés-határ marad', function () {
    $html = '<body><p>TOR BOOKS BY ORSON SCOTT CARD<br/>Speaker for the Dead<br />Children of the Mind</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)->toBe("TOR BOOKS BY ORSON SCOTT CARD\nSpeaker for the Dead\nChildren of the Mind");
});

test('a duplán kódolt entitást is dekódolja', function () {
    $html = '<body><p>&amp;#8220;Ender&amp;#8217;s Game&amp;#8221; is a novel about a boy.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('Ender’s Game')
        ->not->toContain('&#');
});

test('megtartja a rövid, de mondatvégi írásjelre végződő sort', function () {
    $html = '<body><p>He was silent.</p><p>Ender nodded.</p><p>A long enough paragraph that no filter can touch it.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('He was silent.')
        ->toContain('Ender nodded.');
});

test('a fejezet <title>-je nem szivárog a szövegbe', function () {
    $html = '<html><head><title>Pride and prejudice | Project Gutenberg</title><meta charset="utf-8"/><link rel="stylesheet" href="0.css"/></head><body><p>It is a truth universally acknowledged.</p></body></html>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toBe('It is a truth universally acknowledged.')
        ->not->toContain('Project Gutenberg');
});

test('a header eltávolítása nem viszi el a fejezetet', function () {
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

test('az ismételt dekódolás körben limitált, és markup nem épül vissza', function () {
    $html = '<body><p>This line is multiply encoded: &amp;amp;amp;lt;script&amp;amp;amp;gt; and the rest stays text.</p></body>';

    $text = $this->extractor->extract($html);

    expect($text)
        ->toContain('&lt;script&gt;')
        ->not->toContain('<script>');
});

test('a jelölés nélküli szöveget is visszaadja', function () {
    $text = $this->extractor->extract('<body>Just plain text without any block element at all.</body>');

    expect($text)->toBe('Just plain text without any block element at all.');
});
