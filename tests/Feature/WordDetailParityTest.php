<?php

function detailParitySource(string $relative): string
{
    return file_get_contents(resource_path($relative));
}

test('PARITY-1: a részletező kártyákat mindhárom felület a közös komponensből rendereli', function () {
    $shared = detailParitySource('js/components/words/word-detail-sections.tsx');

    expect($shared)
        ->toContain('Magyar jelentés')
        ->toContain('Igealakok')
        ->toContain('Többes szám')
        ->toContain('Fokozás')
        ->toContain('Szinonimák')
        ->toContain('Példamondat');

    foreach ([
        'js/pages/words/index.tsx',
        'js/components/text-analysis/word-lookup-dialog.tsx',
    ] as $relative) {
        $source = detailParitySource($relative);

        expect($source)->toContain('<WordDetailSections');
        expect(substr_count($source, 'Igealakok'))->toBe(0, "{$relative} saját alak-blokkot rendereli");
        expect(substr_count($source, 'Szinonimák'))->toBe(0, "{$relative} saját szinonima-blokkot rendereli");
    }
});

test('PARITY-2: a szövegelemző a szólista közös űrlapját és AI-kitöltését használja', function () {
    $dialog = detailParitySource('js/components/text-analysis/word-lookup-dialog.tsx');

    expect($dialog)
        ->toContain('<WordFormFields')
        ->toContain("from '@/lib/gemini-word'")
        ->toContain('fetchGeminiWord')
        ->toContain('mergeGeminiData')
        ->not->toContain('gemini-lookup')
        ->toContain('<StatusButtons')
        ->toContain('<ImportanceStars');
});

test('PARITY-3: a szólista is a közös AI-kitöltést hívja', function () {
    expect(detailParitySource('js/pages/words/index.tsx'))
        ->toContain("from '@/lib/gemini-word'")
        ->toContain('fetchGeminiWord')
        ->not->toContain('gemini-lookup')
        ->not->toContain('function mergeGeminiData');
});

test('BOOK-1: az „Új elemzés" könyv-módban nem hagyja üresen a fület', function () {
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    expect($page)->toContain("(mode === 'book' && activeBook)");

    expect($page)->toContain('(!activeBook || (fetchedSource === null && !isLoadingPage))');
});

test('BOOK-2: a könyv-lista mountoláskor is betöltődik', function () {
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    expect($page)->toContain("if (mode === 'book' && !booksLoaded) {");

    expect(substr_count($page, 'fetchBooks();'))->toBe(1);
});

test('WORD-1: a kattintott szó normalizált kulccsal megy a részletezőbe', function () {
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    expect($page)
        ->toContain('setLookupWord(tokenKey(word));')
        ->not->toContain('setLookupWord(word.toLowerCase());');
});

test('BOOK-3: a lap-újratöltés megtartja a kiválasztott könyvet és a lapszámot', function () {
    $page = detailParitySource('js/pages/text-analysis/index.tsx');
    $types = detailParitySource('js/components/text-analysis/types.ts');

    expect($types)
        ->toContain('export interface StoredSession')
        ->toContain('activeBook: UserBook | null;')
        ->toContain('bookPage: number;');

    expect($page)
        ->toContain('const session: StoredSession = { mode, text, urlInput, fetchedSource, result, activeBook, bookPage, bookOverview };')
        ->toContain('useState<UserBook | null>(sessionData.activeBook ?? null)')
        ->toContain('useState(sessionData.bookPage ?? 1)')
        ->toContain("useState<VideoOverview | 'failed' | null>(sessionData.bookOverview ?? 'failed')");
});

test('WORD-2: az újonnan felvitt szó/kifejezés azonnal a választott státuszt kapja', function () {
    $dialog = detailParitySource('js/components/text-analysis/word-lookup-dialog.tsx');
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    expect($dialog)
        ->toContain('onCustomAdded: (word: string, status: WordStatus) => void;')
        ->toContain('onCustomAdded(word, form.status);');

    expect($page)
        ->toContain('const handleCustomAdded = (word: string, status: WordStatus) => {')
        ->toContain("handleLookupStatusChange(word, null, status, 'not_in_list');")
        ->toContain('phraseStatuses[phraseKey(word)] = nextStatus;')
        ->not->toContain("tokenStatuses: { ...prev.tokenStatuses, [word]: 'not_in_list' }");
});
