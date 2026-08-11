<?php

use App\Http\Controllers\AchievementController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OnboardingController;
use App\Http\Middleware\EnsureOnboardingComplete;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
    Route::post('onboarding', [OnboardingController::class, 'complete'])->name('onboarding.complete');
});

Route::middleware(['auth', 'verified', EnsureOnboardingComplete::class])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('achievements', [AchievementController::class, 'index'])->name('achievements.index');
});
