<?php

/**
 * A jogi tájékoztatás és a bővítmény-publikáláshoz kötött formai elvárások
 * őrszem-tesztjei. Ezek a szövegek/mezők jogi és Chrome Web Store-követelmények
 * (AI-tájékoztatás + a külső AI-ra vonatkozó felelősség-kizárás, adatfeldolgozók
 * megnevezése, 132 karakteres store-leírás), ezért véletlen törlésük ne
 * csendben, hanem piros teszttel derüljön ki.
 */
function legalPage(string $name): string
{
    return file_get_contents(resource_path("js/pages/legal/{$name}.tsx"));
}

function extensionFile(string $path): string
{
    return file_get_contents(base_path("chrome-extension/{$path}"));
}

test('a jogi oldalak vendégként is elérhetők', function (string $url, string $component) {
    $this->get($url)
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component($component));
})->with([
    ['/terms', 'legal/terms'],
    ['/privacy', 'legal/privacy'],
]);

test('az ÁSZF tájékoztat az AI használatáról és kizárja a külső AI-ért a felelősséget', function () {
    $terms = legalPage('terms');

    // A prettier tetszőleges ponton töri a sorokat, ezért rövid, tördelés-tűrő
    // horgonyokra állítunk (a teljes mondatra állítva a teszt formázásra bukna).
    expect($terms)
        ->toContain('intelligenciát (AI) használ')
        ->toContain('Google (Gemini API)')
        ->toContain('felelősséget nem vállal')
        ->toContain('hallucináció');
});

test('az ÁSZF a fizetős előfizetést és az elállási jogot is rendezi', function () {
    $terms = legalPage('terms');

    expect($terms)
        ->toContain('fizetős (Pro) előfizetés')
        ->toContain('45/2014')
        ->not->toContain('teljes egészében ingyenes');
});

test('az adatkezelési tájékoztató megnevezi az adatfeldolgozókat, kitöltetlen helyőrző nélkül', function () {
    $privacy = legalPage('privacy');

    expect($privacy)
        ->toContain('Stripe')
        ->toContain('Gemini API')
        ->toContain('Billingo')
        ->toContain('Rackhost')
        ->not->toContain('[tárhelyszolgáltató');
});

test('a jogi oldalak megnevezik a szolgáltatót az Ekertv. szerinti kötelező adatokkal', function (string $page) {
    // Ekertv. 4. §: név, székhely, nyilvántartási szám és elektronikus elérhetőség
    // nélkül a szolgáltatás jogsértő. A GDPR ugyanezt kéri az adatkezelőről.
    expect(legalPage($page))
        ->toContain('Szaniszló Árpád egyéni vállalkozó')
        ->toContain('3881 Abaújszántó')
        ->toContain('58300488')
        ->toContain('45715428-1-25');
})->with(['terms', 'privacy']);

test('a checkout kifejezett nyilatkozatot kér a teljesítés azonnali megkezdéséről', function () {
    // A 45/2014. Korm. rendelet szerinti elállási kivétel csak akkor
    // érvényesíthető, ha a felhasználó a megrendeléskor kifejezetten kéri az
    // azonnali teljesítést, és tudomásul veszi az elállási jog elvesztését.
    // A szerveroldali kikényszerítést a PricingCheckoutGatekeeperTest fedi.
    $pricing = file_get_contents(resource_path('js/pages/pricing.tsx'));

    expect($pricing)
        ->toContain('hozzájárulok a')
        ->toContain('azonnali')
        ->toContain('14 napos elállási jogomat')
        ->toContain('accept_terms');
});

test('a bővítmény manifestje megfelel a Chrome Web Store formai korlátainak', function () {
    $manifest = json_decode(extensionFile('manifest.json'), true, 512, JSON_THROW_ON_ERROR);

    // A store a 132 karakternél hosszabb leírást elutasítja.
    expect(mb_strlen($manifest['description']))->toBeLessThanOrEqual(132)
        ->and($manifest['manifest_version'])->toBe(3)
        ->and($manifest['host_permissions'])->toBe(['https://topwords.eu/*'])
        ->and($manifest)->not->toHaveKey('externally_connectable')
        ->and($manifest)->not->toHaveKey('web_accessible_resources');
});

test('a bővítmény popupja tájékoztat az AI-ról és a jogi oldalakra mutat', function () {
    $popup = extensionFile('popup.html');

    expect($popup)
        ->toContain('Google Gemini')
        ->toContain('felelősséget nem vállal')
        ->toContain('https://topwords.eu/privacy')
        ->toContain('https://topwords.eu/terms');
});

test('a bővítmény az AI-generált tartalom mellett is kiírja a felelősség-kizárást', function () {
    expect(extensionFile('src/shared.js'))
        ->toContain('AI_DISCLAIMER_HTML')
        ->toContain('felelősséget nem vállal');

    // Ott jelenik meg, ahol a generált tartalom látszik: AI-flashcard előnézet
    // és a kereső AI-kitöltő űrlapja.
    expect(extensionFile('src/flashcard-modal.js'))->toContain('AI_DISCLAIMER_HTML');
    expect(extensionFile('src/search-modal.js'))->toContain('AI_DISCLAIMER_HTML');
});

test('a felirat-gyorsgesztusok csak valódi felhasználói eseményre indulnak', function () {
    // Szintetikus egérrel egy rosszindulatú oldal különben státuszt írathatna
    // (hosszú-nyomás / dupla-klikk ág).
    $gestures = str(extensionFile('src/shared.js'))
        ->after('function attachCaptionWordGestures')
        ->value();

    expect(substr_count($gestures, 'isTrusted'))->toBe(3);
});
