<?php

/**
 * SW-2 őrszem-tesztek: a kivezetett PWA service worker tombstone-állapotát
 * rögzítik. A `public/sw.js` statikus fájl, ezért a tartalmát ellenőrizzük —
 * ez az egyetlen pont, ahol egy jövőbeli, véletlen visszaesés (a régi workbox-
 * kimenet visszakerülése vagy a fájl néma törlése) tetten érhető.
 */
test('SW-2: a sw.js nem tartalmaz workbox-precache-t és navigációs oldal-cache-t', function () {
    $serviceWorker = file_get_contents(public_path('sw.js'));

    // A konkrét kockázat, ami a leletet adta: a "pages-cache" NetworkFirst
    // denylist nélkül a bejelentkezett oldalak HTML-jét is lemezre írta.
    expect($serviceWorker)
        ->not->toContain('pages-cache')
        ->not->toContain('precacheAndRoute')
        ->not->toContain('NetworkFirst')
        ->not->toContain('workbox');
});

test('SW-2: a sw.js takarít és deregisztrálja magát', function () {
    $serviceWorker = file_get_contents(public_path('sw.js'));

    // A tombstone három kötelező lépése. Ha bármelyik kiesik, a korábban
    // telepített service workerek a felhasználók böngészőjében maradnának.
    expect($serviceWorker)
        ->toContain('caches.delete')
        ->toContain('registration.unregister')
        ->toContain('skipWaiting');
});

test('SW-2: a workbox-futtatókörnyezet és az offline oldal nincs többé kiszolgálva', function () {
    // A tombstone nem importál workboxot; ha ezek a fájlok visszakerülnek,
    // az azt jelzi, hogy egy PWA-build újra generál a projektbe.
    expect(glob(public_path('workbox-*.js')))->toBeEmpty()
        ->and(file_exists(public_path('offline.html')))->toBeFalse();
});

test('SW-2: a sw.js szintaktikailag érvényes JavaScript', function () {
    // A tombstone él-esete: ha maga a takarító service worker hibás, a böngésző
    // az install fázisban elhasal, és a RÉGI service worker marad aktív —
    // vagyis a fix némán hatástalan lenne. A `node --check` ezt fogja meg.
    exec('node --check '.escapeshellarg(public_path('sw.js')).' 2>&1', $output, $exitCode);

    expect($exitCode)->toBe(0, 'A sw.js szintaktikai hibás: '.implode("\n", $output));
})->skip(fn () => exec('command -v node') === '', 'Node nem érhető el ebben a környezetben.');
