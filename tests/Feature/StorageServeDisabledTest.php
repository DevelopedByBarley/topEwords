<?php

use Illuminate\Support\Facades\Route;

/**
 * HDR-4 / STORAGE-2 (Fázis 8): a `local` disk `serve => false`, mert az app
 * sosem szolgál ki fájlt róla. Ez az őrszem-teszt rögzíti, hogy a keret NE
 * regisztrálja a middleware-nélküli storage/{path} GET+PUT route-okat — ha
 * valaki visszaállítaná a serve => true-t, ez a teszt bukik.
 */
test('HDR-4: the local disk does not register storage serve routes', function () {
    expect(config('filesystems.disks.local.serve'))->toBeFalse();

    $storageRoutes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'storage/'));

    expect($storageRoutes)->toBeEmpty();
});
