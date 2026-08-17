<?php

/**
 * A bővítmény content script moduljai (manifest.json content_scripts.js) EGY
 * közös globális lexikális scope-ban futnak a lapon. Ha két modul ugyanazon a
 * néven deklarál felső szintű `let`/`const`/`class`-t, a később betöltő fájl
 * teljes egészében eldobódik egy „Identifier X has already been declared"
 * SyntaxError-ral — a hibát semmi nem jelzi a felületen, csak a hozzá tartozó
 * funkció (modal, gyorsbillentyű) tűnik el némán.
 *
 * Ez a teszt a 1.33-as regresszió után született: a search-modal.js
 * `statusSaveInFlight` zára ütközött a lookup-popup.js azonos nevű zárával,
 * ezért a keresőmodal és a saját-szó felviteli űrlap sem YouTube-on, sem
 * Netflixen nem nyílt meg.
 */

/**
 * Egy content script felső szintű (nulla indentációs szintű) deklarált nevei.
 *
 * @return array<string, int> deklarált név => sorszám
 */
function extensionTopLevelDeclarations(string $file): array
{
    $names = [];

    foreach (file($file) as $index => $line) {
        if (preg_match('/^(?:async\s+)?(?:let|const|var|function|class)\s+([A-Za-z0-9_$]+)/', $line, $m) === 1) {
            $names[$m[1]] = $index + 1;
        }
    }

    return $names;
}

/**
 * @return array{content_scripts: array<int, array{matches: array<int, string>, js: array<int, string>}>}
 */
function extensionManifest(): array
{
    return json_decode(
        file_get_contents(base_path('chrome-extension/manifest.json')),
        true,
        512,
        JSON_THROW_ON_ERROR,
    );
}

test('a content script modulok nem deklarálnak ütköző felső szintű neveket', function () {
    $manifest = extensionManifest();

    expect($manifest['content_scripts'])->not->toBeEmpty();

    foreach ($manifest['content_scripts'] as $script) {
        $owners = [];
        $collisions = [];

        foreach ($script['js'] as $relative) {
            $path = base_path('chrome-extension/'.$relative);
            expect(is_readable($path))->toBeTrue("hiányzó modul: {$relative}");

            foreach (extensionTopLevelDeclarations($path) as $name => $line) {
                if (isset($owners[$name])) {
                    $collisions[] = "{$name} ({$owners[$name]} vs {$relative}:{$line})";
                }

                $owners[$name] = "{$relative}:{$line}";
            }
        }

        expect($collisions)->toBe([], implode(' + ', $script['matches']).' — ütköző deklarációk: '.implode(', ', $collisions));
    }
});

test('a kicsomagolt store-csomag azonos a forrással', function () {
    $packaged = base_path('chrome-extension/topwords-extension-1.0');

    if (! is_dir($packaged)) {
        $this->markTestSkipped('Nincs kicsomagolt csomag a repóban.');
    }

    $files = ['manifest.json', 'background.js', 'popup.html', 'popup.css', 'popup.js'];

    foreach (extensionManifest()['content_scripts'] as $script) {
        $files = array_merge($files, $script['js']);
    }

    foreach (array_unique($files) as $relative) {
        expect(md5_file($packaged.'/'.$relative))
            ->toBe(md5_file(base_path('chrome-extension/'.$relative)), "elavult csomag-fájl: {$relative}");
    }
});
