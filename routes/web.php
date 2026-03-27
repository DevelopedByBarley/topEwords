<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\WordController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('words', [WordController::class, 'index'])->name('words.index');
    Route::post('words/{word}/status', [WordController::class, 'status'])->name('words.status');
});

require __DIR__.'/settings.php';
