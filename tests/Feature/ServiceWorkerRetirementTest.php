<?php

test('SW-2: a sw.js nem tartalmaz workbox-precache-t és navigációs oldal-cache-t', function () {
    $serviceWorker = file_get_contents(public_path('sw.js'));

    expect($serviceWorker)
        ->not->toContain('pages-cache')
        ->not->toContain('precacheAndRoute')
        ->not->toContain('NetworkFirst')
        ->not->toContain('workbox');
});

test('SW-2: a sw.js takarít és deregisztrálja magát', function () {
    $serviceWorker = file_get_contents(public_path('sw.js'));

    expect($serviceWorker)
        ->toContain('caches.delete')
        ->toContain('registration.unregister')
        ->toContain('skipWaiting');
});

test('SW-2: a workbox-futtatókörnyezet és az offline oldal nincs többé kiszolgálva', function () {
    expect(glob(public_path('workbox-*.js')))->toBeEmpty()
        ->and(file_exists(public_path('offline.html')))->toBeFalse();
});

test('SW-2: a sw.js szintaktikailag érvényes JavaScript', function () {
    exec('node --check '.escapeshellarg(public_path('sw.js')).' 2>&1', $output, $exitCode);

    expect($exitCode)->toBe(0, 'A sw.js szintaktikai hibás: '.implode("\n", $output));
})->skip(fn () => exec('command -v node') === '', 'Node nem érhető el ebben a környezetben.');
