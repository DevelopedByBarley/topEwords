<?php

/**
 * @return array<string, string>
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
    $config = file_get_contents(resource_path('js/lib/scroll-trigger.ts'));

    expect($config)->toContain('ignoreMobileResize: true');
});

test('PERF-2: minden GSAP-fogyasztó a közös modulon át regisztrál', function () {
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

test('PERF-3: a kártyasor memoizált', function () {
    $source = file_get_contents(resource_path('js/components/flashcards/card-row.tsx'));

    expect($source)->toContain('export default memo(CardRow)');
});

test('PERF-3: a paklinézet nem ad inline függvényt a memoizált kártyasornak', function () {
    $source = file_get_contents(resource_path('js/pages/flashcards/show.tsx'));

    preg_match('/<CardRow\b(.*?)\/>/s', $source, $match);

    expect($match)->not->toBeEmpty('A <CardRow /> hívás nem található a paklinézetben.');
    expect($match[1])->not->toContain(
        '=>',
        'Inline arrow a CardRow propjai közt — ez kiüti a sor memoizálását.'
    );
});
