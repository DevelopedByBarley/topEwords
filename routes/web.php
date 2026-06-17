<?php

use App\Http\Controllers\AchievementController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\PricingController;
use App\Http\Controllers\StripeWebhookController;
use App\Http\Middleware\EnsureOnboardingComplete;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

// ── Publikus oldalak ──────────────────────────────────────────────────────────

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::inertia('/guide', 'guide')->name('guide');
Route::inertia('/terms', 'legal/terms')->name('terms');
Route::inertia('/privacy', 'legal/privacy')->name('privacy');
Route::get('/pricing', [PricingController::class, 'index'])->name('pricing');
Route::get('/pricing/success', [PricingController::class, 'success'])->name('pricing.success')->middleware('signed');

Route::get('/sitemap.xml', function () {
    return response()->view('sitemap')->header('Content-Type', 'application/xml');
})->name('sitemap');

// ── Fizetés ───────────────────────────────────────────────────────────────────

Route::middleware('auth')->group(function () {
    Route::post('/pricing/checkout/{plan}', [PricingController::class, 'checkout'])->name('pricing.checkout')->middleware('throttle:20,1,pricing-checkout');
    Route::post('/pricing/portal', [PricingController::class, 'portal'])->name('pricing.portal');
});

// Stripe webhook — CSRF alól kivéve, a Cashier aláírás-ellenőrzése védi
Route::post('stripe/webhook', [StripeWebhookController::class, 'handleWebhook'])->name('cashier.webhook');

// ── Admin ─────────────────────────────────────────────────────────────────────

Route::middleware(['auth', 'can:admin'])->group(function () {
    Route::get('admin', [AdminController::class, 'index'])->name('admin');
    Route::post('admin/ai-access', [AdminController::class, 'toggleAiAccess'])->name('admin.ai-access.toggle');
    Route::post('admin/access', [AdminController::class, 'setAccess'])->name('admin.access.set');
});

// ── Onboarding, dashboard, eredmények ─────────────────────────────────────────

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('onboarding', [OnboardingController::class, 'show'])->name('onboarding');
    Route::post('onboarding', [OnboardingController::class, 'complete'])->name('onboarding.complete');
});

Route::middleware(['auth', 'verified', EnsureOnboardingComplete::class])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('achievements', [AchievementController::class, 'index'])->name('achievements.index');
});

// ── Domain route-fájlok ───────────────────────────────────────────────────────

require __DIR__.'/words.php';
require __DIR__.'/flashcards.php';
require __DIR__.'/text-analysis.php';
require __DIR__.'/extension.php';
require __DIR__.'/settings.php';

// TEMP: helyi vizuális ellenőrzéshez — törlendő!
if (app()->environment('local')) {
    Route::get('/dev-login', function () {
        Auth::loginUsingId(User::first()->id);

        return redirect(request()->query('redirect', '/dashboard'));
    });
}
