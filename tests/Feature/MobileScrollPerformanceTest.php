<?php

/**
 * Őrszem-tesztek a mobil görgetés-akadás javításához.
 *
 * A lelet: régebbi iPhone-on minden oldal akadt görgetés közben. Az ok a
 * `backdrop-filter` volt — a sima `blur` egyszer rajzolódik és cache-elődik,
 * a `backdrop-blur` viszont az elem MÖGÖTTI pixeleket mossa el, tehát minden
 * frame-ben újra kell számolni, amíg a háttér mozog. A `sticky`/`fixed`
 * elemeknél ez garantáltan minden görgetett frame-et érint.
 *
 * A tesztek nem stílust védenek, hanem a mobil frame-budgetet: a
 * `backdrop-blur` csak akkor maradhat, ha breakpoint-prefix mögé van téve
 * (desktopon fut csak), vagy ha az elem mobilon eleve `hidden`.
 */

/**
 * A vizsgált kliens-források. A kivezetett oldalak (`_pages-disabled`)
 * szándékosan kimaradnak — azok nincsenek route-olva.
 *
 * @return array<string, string> fájl-útvonal => tartalom
 */
function frontendSources(): array
{
    $directory = new RecursiveDirectoryIterator(resource_path('js'));
    $sources = [];

    foreach (new RecursiveIteratorIterator($directory) as $file) {
        $path = $file->getPathname();

        if (! str_ends_with($path, '.tsx') || str_contains($path, '_pages-disabled')) {
            continue;
        }

        $sources[$path] = file_get_contents($path);
    }

    return $sources;
}

test('PERF-1: a backdrop-blur mobilon nem fut', function () {
    $offenders = [];

    foreach (frontendSources() as $path => $source) {
        /*
         * Osztálylistánként vizsgálunk, nem soronként: egy `backdrop-blur`
         * akkor van rendben, ha ugyanabban az osztálylistában breakpoint-
         * prefixet kapott, vagy az elem mobilon `hidden`.
         */
        preg_match_all('/(?:className|class)=(?:"([^"]*)"|\{`([^`]*)`\}|\{\'([^\']*)\'\})/s', $source, $matches, PREG_SET_ORDER);

        foreach ($matches as $match) {
            $classList = $match[1].($match[2] ?? '').($match[3] ?? '');

            if (! str_contains($classList, 'backdrop-blur')) {
                continue;
            }

            $isDesktopOnly = preg_match('/\b(?:sm|md|lg|xl|2xl):backdrop-blur/', $classList) === 1;
            $isHiddenOnMobile = preg_match('/(?:^|\s)hidden(?:\s|$)/', $classList) === 1;

            if (! $isDesktopOnly && ! $isHiddenOnMobile) {
                $offenders[] = basename($path).': '.$classList;
            }
        }
    }

    expect($offenders)->toBeEmpty(
        "Prefix nélküli backdrop-blur — minden görgetett frame-ben újramosódik mobilon:\n".implode("\n", $offenders)
    );
});

test('PERF-2: a landing GSAP-triggerei nem méreznek újra görgetés közben', function () {
    /*
     * A mobil böngészők `resize`-t dobnak, amikor görgetéskor be-/kicsúszik az
     * URL-sáv. A ScrollTrigger alapból erre az ÖSSZES triggert újraméri —
     * a landing ~25 triggerénél ez kényszerített layout a görgetés első
     * pillanatában. Az `ignoreMobileResize` ezt kapcsolja ki.
     */
    $config = file_get_contents(resource_path('js/lib/scroll-trigger.ts'));

    expect($config)->toContain('ignoreMobileResize: true');
});

test('PERF-2: minden GSAP-fogyasztó a közös modulon át regisztrál', function () {
    /*
     * Az `ignoreMobileResize` globális, de csak akkor érvényesül, ha lefut.
     * Ha egy komponens megkerüli a közös modult és közvetlenül a 'gsap'-ból
     * importál, a saját `registerPlugin`-jével a config némán kimaradhat.
     */
    $direct = [];

    foreach (frontendSources() as $path => $source) {
        if (preg_match("/from '(?:gsap|gsap\/ScrollTrigger)'/", $source) === 1) {
            $direct[] = basename($path);
        }
    }

    expect($direct)->toBeEmpty(
        'Közvetlen gsap-import a @/lib/scroll-trigger helyett: '.implode(', ', $direct)
    );
});

/*
 * PERF-3 lelet: a paklinézetben a „Több betöltése" korlátlanul halmozza a
 * sorokat, a hero visszaszámlálója viszont ötmásodpercenként állapotot írt —
 * vagyis rendszeresen újrarenderelt minden betöltött kártyasort. Ha ez épp
 * görgetés közben futott le, a hosszú JS-task megette a frame-budgetet.
 */
test('PERF-3: a kártyasor memoizált', function () {
    $source = file_get_contents(resource_path('js/components/flashcards/card-row.tsx'));

    expect($source)->toContain('export default memo(CardRow)');
});

test('PERF-3: a paklinézet nem ad inline függvényt a memoizált kártyasornak', function () {
    /*
     * A `memo` csak akkor fog, ha a lefelé adott propok referenciája is
     * állandó: egy inline arrow (`onEdit={(c) => …}`) minden szülő-renderben
     * új függvény, és ezzel újrarendereli az összes sort.
     */
    $source = file_get_contents(resource_path('js/pages/flashcards/show.tsx'));

    preg_match('/<CardRow\b(.*?)\/>/s', $source, $match);

    expect($match)->not->toBeEmpty('A <CardRow /> hívás nem található a paklinézetben.');
    expect($match[1])->not->toContain(
        '=>',
        'Inline arrow a CardRow propjai közt — ez kiüti a sor memoizálását.'
    );
});
