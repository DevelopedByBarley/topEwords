<?php

use Illuminate\Support\Facades\Route;

test('HDR-4: the local disk does not register storage serve routes', function () {
    expect(config('filesystems.disks.local.serve'))->toBeFalse();

    $storageRoutes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => str_starts_with($route->uri(), 'storage/'));

    expect($storageRoutes)->toBeEmpty();
});
