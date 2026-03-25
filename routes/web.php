<?php

use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::get('words', [App\Http\Controllers\WordController::class, 'index'])->name('words.index');
    Route::post('words/{word}/toggle', [App\Http\Controllers\WordController::class, 'toggle'])->name('words.toggle');
});

require __DIR__.'/settings.php';
