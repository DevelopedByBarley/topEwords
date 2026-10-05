<?php

use App\Http\Controllers\PricingController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::inertia('/guide', 'guide')->name('guide');
Route::inertia('/handbook', 'handbook')->name('handbook');
Route::inertia('/terms', 'legal/terms')->name('terms');
Route::inertia('/privacy', 'legal/privacy')->name('privacy');
Route::get('/pricing', [PricingController::class, 'index'])->name('pricing');
Route::get('/pricing/success', [PricingController::class, 'success'])->name('pricing.success');
