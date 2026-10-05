<?php

function publicPage(string $path): string
{
    return file_get_contents(resource_path("js/{$path}"));
}

test('minden publikus oldal elérhető vendégként', function (string $url, string $component) {
    $this->get($url)
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component($component));
})->with([
    ['/', 'welcome'],
    ['/pricing', 'pricing'],
    ['/guide', 'guide'],
    ['/handbook', 'handbook'],
    ['/terms', 'legal/terms'],
    ['/privacy', 'legal/privacy'],
]);

test('a publikus oldalak a közös keretet használják', function (string $file) {
    expect(publicPage($file))->toContain('PublicLayout');
})->with([
    'pages/pricing.tsx',
    'pages/guide.tsx',
    'pages/handbook.tsx',
    'components/public/legal-page.tsx',
]);

test('a főoldal a közös fejlécet és láblécet rendereli', function () {
    expect(publicPage('pages/welcome.tsx'))
        ->toContain('<PublicHeader variant="transparent" />')
        ->toContain('<PublicFooter />');
});

test('a kézikönyv nem az alkalmazás keretét kapja vendégként', function () {
    expect(publicPage('app.tsx'))->toContain("case name === 'handbook':");

    expect(publicPage('pages/handbook.tsx'))
        ->toContain('if (isGuest) {')
        ->not->toContain('Handbook.layout');
});

test('a főoldal nem visz párhuzamos tananyag-oldalt', function () {
    expect(publicPage('pages/welcome.tsx'))
        ->not->toContain("useState<'home' | 'videos'>")
        ->not->toContain('VIDEO_RAW');
});

test('a szekció-navigáció billentyűzettel is elérhető', function () {
    $welcome = publicPage('pages/welcome.tsx');

    expect($welcome)
        ->toContain('aria-label="Szekciók"')
        ->toContain('Ugrás a tartalomra');

    expect(publicPage('layouts/public-layout.tsx'))
        ->toContain('Ugrás a tartalomra')
        ->toContain('<main id="main"');
});

test('az árazás nem hirdet kivezetett funkciókat', function () {
    expect(publicPage('pages/pricing.tsx'))
        ->not->toContain('kvíz')
        ->not->toContain('Kvíz')
        ->not->toContain('szókiegészítős')
        ->not->toContain('cloze');
});

test('a Manrope betűkészlet be is töltődik, amit a főoldal használ', function () {
    expect(publicPage('pages/welcome.tsx'))->toContain("font-['Manrope'");

    expect(file_get_contents(resource_path('views/app.blade.php')))
        ->toContain('family=manrope:');
});

test('a sitemap tartalmazza a publikus oldalakat', function () {
    $sitemap = $this->get('/sitemap.xml')->assertOk()->getContent();

    foreach (['/', '/pricing', '/guide', '/handbook', '/terms', '/privacy'] as $path) {
        expect($sitemap)->toContain("https://topwords.eu{$path}");
    }
});

test('a jogi oldalak minden pontja horgonyozható', function (string $page, int $expectedSections) {
    $source = publicPage("pages/legal/{$page}.tsx");

    expect(substr_count($source, '<section id="'))->toBe($expectedSections)
        ->and(substr_count($source, "id: '"))->toBe($expectedSections);
})->with([
    ['terms', 14],
    ['privacy', 10],
]);
