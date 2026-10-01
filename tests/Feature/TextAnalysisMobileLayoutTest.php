<?php

/**
 * Őrszem-tesztek a szövegelemzés mobilos olvasójához.
 *
 * A lelet: telefonon a felirat/könyv lapja egy 320 px-es, belső görgetésű
 * dobozban ült, a lapozó- és elemző-gombok pedig több sorba törve a doboz
 * alatt — hosszú lapnál a gombokhoz a szöveg végéig kellett görgetni. A
 * tesztek a javítás lényegét védik: mobilon nincs belső görgetés, a gombsor a
 * közös, alulra rögzített sávban van, és az oldal helyet ad neki.
 */

/**
 * @return array<string, string> komponens-név => forrás
 */
function textAnalysisReaders(): array
{
    return [
        'YoutubeReader' => file_get_contents(resource_path('js/components/text-analysis/youtube-panel.tsx')),
        'BookReader' => file_get_contents(resource_path('js/components/text-analysis/book-panel.tsx')),
    ];
}

test('az olvasók belső görgetése csak md-től él', function (string $reader) {
    $source = textAnalysisReaders()[$reader];

    expect($source)
        ->toContain('md:max-h-104 md:overflow-y-auto')
        ->not->toMatch('/(?<![\w:-])max-h-80(?![\w-])/')
        ->not->toMatch('/(?<![\w:-])overflow-y-auto(?![\w-])/');
})->with(['YoutubeReader', 'BookReader']);

test('az olvasók a közös rögzített lapozósávot és görgetés-visszaállítást használják', function (string $reader) {
    $source = textAnalysisReaders()[$reader];

    expect($source)
        ->toContain('<ReaderActions')
        ->toContain('useReaderScrollReset')
        ->not->toContain("'Oldal elemzése'");
})->with(['YoutubeReader', 'BookReader']);

test('a lapozósáv mobilon az alsó navigáció fölé rögzül, md-től visszaáll a folyamba', function () {
    $source = file_get_contents(resource_path('js/components/text-analysis/reader-controls.tsx'));

    expect($source)
        ->toContain('fixed inset-x-0 bottom-(--bottom-nav-offset)')
        ->toContain('md:static');
});

test('nyitott olvasónál az oldal helyet ad a rögzített sávnak', function () {
    $source = file_get_contents(resource_path('js/pages/text-analysis/index.tsx'));

    expect($source)
        ->toContain('const isReaderOpen')
        ->toContain("isReaderOpen ? 'pb-20' : ''");
});
