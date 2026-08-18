<?php

/**
 * Őrszem a lejátszó-gombok ikonjaira.
 *
 * A lelet: a TW felirat-kapcsoló és a mellette lévő átirat-gomb ikonja
 * elcsúszva jelent meg — a rajz a 36x36-os ikonmező BAL FELSŐ sarkába készült
 * (x 1..23, y 5..24), miközben a natív YouTube-gombok a mező közepére
 * rajzolnak. A gomb kattintható területe stimmelt, ezért a hiba csak szemre
 * látszott, tesztet nem érintett.
 *
 * A teszt a forrásból olvassa ki az ikonok téglalapjait, és azt kéri, hogy az
 * ikon TESTE (badge / hamburger-vonalak) a rajzmező közepén álljon. Az állapotot
 * jelző piros aláhúzás — a natív CC gomb mintájára — a test alatt lóg, ezért az
 * a középre igazításba nem számít bele, csak vízszintesen kell középen lennie.
 */

/**
 * A bővítmény lejátszó-ikonjai: minden olyan inline SVG, amiben állapotjelző
 * aláhúzás van. Az azonosításhoz szándékosan nem a sorszám kell: ha új gomb
 * születik, ez a teszt automatikusan azt is védi.
 *
 * @return array<string, array{width: float, height: float, body: array<int, array<string, float>>, underline: array<string, float>}>
 */
function extensionToggleIcons(): array
{
    $icons = [];

    foreach (['src/youtube.js', 'src/netflix.js'] as $relative) {
        $source = file_get_contents(base_path('chrome-extension/'.$relative));

        preg_match_all('/<svg[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"[^>]*>(.*?)<\/svg>/s', $source, $svgs, PREG_SET_ORDER);

        foreach ($svgs as $svg) {
            if (! str_contains($svg[3], 'underline')) {
                continue;
            }

            $body = [];
            $underline = null;

            preg_match_all('/<rect\b([^>]*)\/>/', $svg[3], $rects, PREG_SET_ORDER);

            foreach ($rects as $rect) {
                $box = [];

                foreach (['x', 'y', 'width', 'height'] as $attribute) {
                    preg_match('/\b'.$attribute.'="([\d.]+)"/', $rect[1], $value);
                    $box[$attribute] = (float) $value[1];
                }

                if (str_contains($rect[1], 'underline')) {
                    $underline = $box;
                } else {
                    $body[] = $box;
                }
            }

            expect($body)->not->toBeEmpty("{$relative}: ikon test nélkül");
            expect($underline)->not->toBeNull("{$relative}: aláhúzás nélkül");

            $icons[$relative.' #'.(count($icons) + 1)] = [
                'width' => (float) $svg[1],
                'height' => (float) $svg[2],
                'body' => $body,
                'underline' => $underline,
            ];
        }
    }

    return $icons;
}

test('a lejátszó-gombok ikonja a rajzmező közepén áll', function () {
    $icons = extensionToggleIcons();

    // Két YouTube-gomb (TW + átirat) és a Netflix lebegő kapcsolója.
    expect($icons)->toHaveCount(3);

    foreach ($icons as $label => $icon) {
        $left = min(array_column($icon['body'], 'x'));
        $right = max(array_map(fn (array $r): float => $r['x'] + $r['width'], $icon['body']));
        $top = min(array_column($icon['body'], 'y'));
        $bottom = max(array_map(fn (array $r): float => $r['y'] + $r['height'], $icon['body']));

        expect(($left + $right) / 2)->toBe($icon['width'] / 2, "{$label}: az ikon teste vízszintesen elcsúszott");
        expect(($top + $bottom) / 2)->toBe($icon['height'] / 2, "{$label}: az ikon teste függőlegesen elcsúszott");

        // Az aláhúzás középen, a test alatt — és még a rajzmezőn belül.
        $underlineCenter = $icon['underline']['x'] + $icon['underline']['width'] / 2;

        expect($underlineCenter)->toBe($icon['width'] / 2, "{$label}: az aláhúzás elcsúszott");
        expect($icon['underline']['y'])->toBeGreaterThan($bottom, "{$label}: az aláhúzás nem a test alatt van");
        expect($icon['underline']['y'] + $icon['underline']['height'])->toBeLessThanOrEqual($icon['height'], "{$label}: az aláhúzás kilóg a rajzmezőből");
    }
});

/**
 * Második lelet: a rajzmezőn belül középre igazított ikon MÉG nem elég — a
 * gombunk puszta `.ytp-button`-ként más méretű boxot kap, mint a szomszédai
 * (a YouTube a szélességet/paddingot gomb-specifikus osztályokon adja), így a
 * 100%-os SVG nagyobbra skálázódott és feljebb állt a natív ikonoknál.
 *
 * A megoldás: futásidőben MÉRJÜK a natív szomszéd gombot, és arra igazítjuk a
 * box + ikon méretét. Ez az őrszem azt védi, hogy a mérés meglegyen, minden
 * lejátszó-gombra lefusson, és ne csússzon vissza beégetett pixelekre.
 */
test('a lejátszó-gombok boxa a natív szomszédról van lemérve', function () {
    $source = file_get_contents(base_path('chrome-extension/src/youtube.js'));

    expect($source)->toContain('function syncYtToggleBox(btn)');

    preg_match('/function syncYtToggleBox\(btn\) \{(.*?)\n\}/s', $source, $sync);

    // Mérés a natív gombról — nem beégetett méret.
    expect($sync[1])->toContain('ytNativeControlButton()');
    expect($sync[1])->toContain('getBoundingClientRect()');

    // Mindkét YouTube-gomb állapot-frissítője igazítja a boxot, így a gombok a
    // vezérlősor újrarenderelésekor és mód-váltás után is a helyükön maradnak.
    foreach (['updateYtToggleState', 'updateYtPanelToggleState'] as $updater) {
        preg_match('/function '.$updater.'\(\) \{(.*?)\n\}/s', $source, $body);

        expect($body[1])->toContain('syncYtToggleBox(btn)');
    }

    // Méretváltás (átméretezés, teljes képernyő) DOM-mutáció nélkül is történhet.
    expect($source)->toContain("window.addEventListener('resize', ytBoxSyncHandler)");
    expect($source)->toContain("document.addEventListener('fullscreenchange', ytBoxSyncHandler)");
});
