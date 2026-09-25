<?php

/**
 * Az árazó oldal kézzel írt számokat ígér a csomag-keretekről. A Pro
 * könyv-kvótája 7-ről 3-ra ment, az oldal viszont továbbra is 7-et hirdetett
 * (F9B-L1) — vagyis többet ígértünk, mint amennyit a rendszer ad. Ez a teszt
 * az oldal és a config/plans.php összhangját őrzi.
 */
function pricingSource(): string
{
    // A sortöréseket összevonjuk: a Prettier bármikor átformázhatja a sorokat.
    return preg_replace('/\s+/', ' ', file_get_contents(resource_path('js/pages/pricing.tsx')));
}

test('az árazó oldalon hirdetett csomag-keretek megegyeznek a config/plans.php értékeivel', function () {
    $pricing = pricingSource();
    $free = config('plans.limits.free');
    $pro = config('plans.limits.premium');

    expect($pricing)
        ->toContain("value: '{$free['flashcards']}', label: 'tanulókártya, {$free['decks']} csomagban'")
        ->toContain("value: '{$free['text_analyses_per_day']}', label: 'szövegelemzés naponta'")
        ->toContain("value: '{$free['books']}', label: 'mentett könyv, {$free['youtube_transcripts']} YouTube-felirat'")
        ->toContain("value: '{$free['extension_writes_per_day']}', label: 'mentés naponta a Chrome-bővítményből'")
        ->toContain("value: '{$pro['text_analyses_per_day']}', label: 'szövegelemzés naponta'")
        ->toContain("value: '{$pro['books']}', label: 'mentett könyv, {$pro['youtube_transcripts']} YouTube-felirat'");
});

test('az árazó oldal csak a ténylegesen korlátlan Pro-kereteket hirdeti korlátlannak', function () {
    $pricing = pricingSource();
    $pro = config('plans.limits.premium');

    expect($pro['flashcards'])->toBeNull()
        ->and($pro['decks'])->toBeNull()
        ->and($pro['extension_writes_per_day'])->toBeNull();

    expect($pricing)
        ->toContain("value: 'Korlátlan', label: 'tanulókártya és kártyacsomag'")
        ->toContain("value: 'Korlátlan', label: 'mentés a Chrome-bővítményből'");
});
