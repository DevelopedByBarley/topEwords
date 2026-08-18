<?php

/**
 * Őrszem-tesztek a szó-részletező egységességéhez.
 *
 * A lelet: ugyanarra a szóra a szólista modálja kiírta a további jelentéseket,
 * a szinonimákat, mind a 8 alakot és a magyar példamondatot, a szövegelemző
 * dialógusa viszont csak a jelentést és egy angol példamondatot — mert három,
 * egymástól elcsúszott másolat renderelte ugyanazt. Ugyanez volt az AI-kitöltés
 * körül: a szövegelemzőben saját, szűkebb másolat futott (nem volt `word`,
 * `form_base` és `extra_forms` mező, és a más szófajhoz tartozó AI-alakok
 * láthatatlanul mentek el).
 *
 * Ezek a tesztek nem a megjelenést védik, hanem azt, hogy MINDHÁROM felület a
 * KÖZÖS forrásból rendereljen — másolat ne szülessen újra. A fájl a szövegelemző
 * felület többi kliens-oldali őrszemét is tartalmazza (könyv-fül, szó-kulcs).
 */
function detailParitySource(string $relative): string
{
    return file_get_contents(resource_path($relative));
}

test('PARITY-1: a részletező kártyákat mindhárom felület a közös komponensből rendereli', function () {
    $shared = detailParitySource('js/components/words/word-detail-sections.tsx');

    // A közös komponens tartalmazza az összes szekciót…
    expect($shared)
        ->toContain('Magyar jelentés')
        ->toContain('Igealakok')
        ->toContain('Többes szám')
        ->toContain('Fokozás')
        ->toContain('Szinonimák')
        ->toContain('Példamondat');

    // …és a hívók csak ezt használják, saját másolat nélkül.
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
        // Közös űrlap: minden alak-mező, a szófajtól függetlenül.
        ->toContain('<WordFormFields')
        // Közös AI-lekérés + beolvasztás (nem saját fetch/merge).
        ->toContain("from '@/lib/gemini-word'")
        ->toContain('fetchGeminiWord')
        ->toContain('mergeGeminiData')
        ->not->toContain('gemini-lookup')
        // Közös státusz- és fontosság-vezérlő.
        ->toContain('<StatusButtons')
        ->toContain('<ImportanceStars');
});

test('PARITY-3: a szólista is a közös AI-kitöltést hívja', function () {
    expect(detailParitySource('js/pages/words/index.tsx'))
        ->toContain("from '@/lib/gemini-word'")
        ->toContain('fetchGeminiWord')
        // A korábbi kézzel összeállított URL és a lokális merge megszűnt.
        ->not->toContain('gemini-lookup')
        ->not->toContain('function mergeGeminiData');
});

test('BOOK-1: az „Új elemzés" könyv-módban nem hagyja üresen a fület', function () {
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    // Az eredmény zárása könyv-módban megtartja az olvasót (a reset() az
    // `fetchedSource`-ot törölte, az `activeBook`-ot nem — a fül üresen maradt).
    expect($page)->toContain("(mode === 'book' && activeBook)");

    // Tartalék: ha mégis nincs mit olvasni, a lista jön vissza, nem üres felület.
    expect($page)->toContain('(!activeBook || (fetchedSource === null && !isLoadingPage))');
});

test('BOOK-2: a könyv-lista mountoláskor is betöltődik', function () {
    // A lista korábban csak a fül-váltásból (switchMode) töltött. Ha a lap eleve
    // könyv-módban jött vissza (a mód a sessionStorage-ból áll helyre), a
    // `booksLoaded` örökre false maradt: a felület a betöltés-jelzőnél ragadt.
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    expect($page)->toContain("if (mode === 'book' && !booksLoaded) {");

    // …és a fül-váltás már nem indít második kérést ugyanarra.
    expect(substr_count($page, 'fetchBooks();'))->toBe(1);
});

test('WORD-1: a kattintott szó normalizált kulccsal megy a részletezőbe', function () {
    // A szövegben tipográfiai aposztróf áll („couldn’t"), a státusz-térkép kulcsai
    // viszont ASCII aposztrófosak (`tokenKey`). Nyers alakkal a modalból mentett
    // státusz olyan kulcsra került, amit a renderelés nem keres — a kiemelés csak
    // újraelemzés után frissült.
    $page = detailParitySource('js/pages/text-analysis/index.tsx');

    expect($page)
        ->toContain('setLookupWord(tokenKey(word));')
        ->not->toContain('setLookupWord(word.toLowerCase());');
});

test('BOOK-3: a lap-újratöltés megtartja a kiválasztott könyvet és a lapszámot', function () {
    // A sessionStorage csak a `mode`/`text`/`fetchedSource`/`result` négyest
    // tartotta meg, az `activeBook` viszont sima React-state volt: frissítés
    // után az elemzett lap ott maradt a képernyőn, de kiválasztott könyv nélkül
    // sem az olvasó, sem a lapozó nem rendert — a lap aljáról eltűnt az
    // „Előző/Következő oldal".
    $page = detailParitySource('js/pages/text-analysis/index.tsx');
    $types = detailParitySource('js/components/text-analysis/types.ts');

    // A mentett állapot alakja egy helyen van definiálva, és tartalmazza az olvasót.
    expect($types)
        ->toContain('export interface StoredSession')
        ->toContain('activeBook: UserBook | null;')
        ->toContain('bookPage: number;');

    // A lap ezt az alakot menti, és ebből indul a state.
    expect($page)
        ->toContain('const session: StoredSession = { mode, text, urlInput, fetchedSource, result, activeBook, bookPage, bookOverview };')
        ->toContain('useState<UserBook | null>(sessionData.activeBook ?? null)')
        ->toContain('useState(sessionData.bookPage ?? 1)')
        // Helyreállításkor nem indul új összesítő-kérés (az a napi elemzés-keretbe számítana).
        ->toContain("useState<VideoOverview | 'failed' | null>(sessionData.bookOverview ?? 'failed')");
});
