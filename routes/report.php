<?php

use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('report', [ReportController::class, 'store'])
        ->name('report.store')
        ->middleware('throttle:10,1,report-store');

    Route::inertia('report', 'report/index')->name('report.index');
});
