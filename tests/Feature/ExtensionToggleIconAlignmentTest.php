<?php

/**
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

    expect($icons)->toHaveCount(3);

    foreach ($icons as $label => $icon) {
        $left = min(array_column($icon['body'], 'x'));
        $right = max(array_map(fn (array $r): float => $r['x'] + $r['width'], $icon['body']));
        $top = min(array_column($icon['body'], 'y'));
        $bottom = max(array_map(fn (array $r): float => $r['y'] + $r['height'], $icon['body']));

        expect(($left + $right) / 2)->toBe($icon['width'] / 2, "{$label}: az ikon teste vízszintesen elcsúszott");
        expect(($top + $bottom) / 2)->toBe($icon['height'] / 2, "{$label}: az ikon teste függőlegesen elcsúszott");

        $underlineCenter = $icon['underline']['x'] + $icon['underline']['width'] / 2;

        expect($underlineCenter)->toBe($icon['width'] / 2, "{$label}: az aláhúzás elcsúszott");
        expect($icon['underline']['y'])->toBeGreaterThan($bottom, "{$label}: az aláhúzás nem a test alatt van");
        expect($icon['underline']['y'] + $icon['underline']['height'])->toBeLessThanOrEqual($icon['height'], "{$label}: az aláhúzás kilóg a rajzmezőből");
    }
});

test('a lejátszó-gombok boxa a natív szomszédról van lemérve', function () {
    $source = file_get_contents(base_path('chrome-extension/src/youtube.js'));

    expect($source)->toContain('function syncYtToggleBox(btn)');

    preg_match('/function syncYtToggleBox\(btn\) \{(.*?)\n\}/s', $source, $sync);

    expect($sync[1])->toContain('ytNativeControlButton()');
    expect($sync[1])->toContain('getBoundingClientRect()');

    foreach (['updateYtToggleState', 'updateYtPanelToggleState'] as $updater) {
        preg_match('/function '.$updater.'\(\) \{(.*?)\n\}/s', $source, $body);

        expect($body[1])->toContain('syncYtToggleBox(btn)');
    }

    expect($source)->toContain("window.addEventListener('resize', ytBoxSyncHandler)");
    expect($source)->toContain("document.addEventListener('fullscreenchange', ytBoxSyncHandler)");
});
