<?php

use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    // Bejelentés-beküldés egyedi throttle-ja: alacsonyabb gyakoriságú, szándékos
    // user-akció, mint a szó-írások (60/perc) — szigorúbb sapka a spam ellen.
    Route::post('report', [ReportController::class, 'store'])
        ->name('report.store')
        ->middleware('throttle:10,1,report-store');

    Route::inertia('report', 'report/index')->name('report.index');
});
