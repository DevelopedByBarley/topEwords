<?php

use App\Http\Controllers\DownloadController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'can:admin', 'admin.2fa'])->group(function () {
    Route::inertia('downloads', 'downloads')->name('downloads.index');
    Route::get('downloads/{file}', [DownloadController::class, 'show'])->name('downloads.show')->middleware('throttle:20,1,downloads');
});
