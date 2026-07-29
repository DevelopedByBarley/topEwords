<?php

use App\Http\Controllers\AchievementController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DownloadController;
use App\Http\Controllers\OnboardingController;
use App\Http\Controllers\PlayerPairingController;
use App\Http\Controllers\PricingController;
use App\Http\Controllers\StripeWebhookController;
use App\Http\Middleware\EnsureOnboardingComplete;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

// ── Publikus oldalak ──────────────────────────────────────────────────────────

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::inertia('/guide', 'guide')->name('guide');
Route::inertia('/handbook', 'handbook')->name('handbook');
Route::inertia('/terms', 'legal/terms')->name('terms');
Route::inertia('/privacy', 'legal/privacy')->name('privacy');
Route::get('/pricing', [PricingController::class, 'index'])->name('pricing');
// Az aláírást a kontroller ellenőrzi (nem a `signed` middleware), hogy a lejárt
// aláírás ne nyers 403-as hibaoldal legyen közvetlenül egy sikeres fizetés után.
Route::get('/pricing/success', [PricingController::class, 'success'])->name('pricing.success');

Route::get('/sitemap.xml', function () {
    return response()->view('sitemap')->header('Content-Type', 'application/xml');
})->name('sitemap');

// ── Fizetés ───────────────────────────────────────────────────────────────────

Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('/pricing/checkout/{plan}', [PricingController::class, 'checkout'])->name('pricing.checkout')->middleware('throttle:20,1,pricing-checkout');
    Route::post('/pricing/portal', [PricingController::class, 'portal'])->name('pricing.portal')->middleware('throttle:10,1');
});

// Stripe webhook — CSRF alól kivéve, a Cashier aláírás-ellenőrzése védi
Route::post('stripe/webhook', [StripeWebhookController::class, 'handleWebhook'])->name('cashier.webhook');

// ── Admin ─────────────────────────────────────────────────────────────────────

Route::middleware(['auth', 'verified', 'can:admin'])->group(function () {
    Route::get('admin', [AdminController::class, 'index'])->name('admin');
    Route::post('admin/access', [AdminController::class, 'setAccess'])->name('admin.access.set');
    Route::post('admin/free-month', [AdminController::class, 'grantFreeMonth'])->name('admin.free-month.grant');
    Route::post('admin/invites', [AdminController::class, 'storeInvite'])->name('admin.invites.store');
    Route::delete('admin/invites/{invite}', [AdminController::class, 'destroyInvite'])->name('admin.invites.destroy');
    Route::patch('admin/reports/{report}', [AdminController::class, 'updateReportStatus'])->name('admin.reports.update-status');
});

// ── Desktop lejátszó összekötése ──────────────────────────────────────────────
// A jóváhagyás szándékosan a normál webes session-nel (auth + verified + CSRF)
// történik: a lejátszó a rendszer-böngészőt nyitja meg erre az oldalra, így a
// jelszó (és a 2FA) soha nem megy át az appon. A párosító API a routes/api.php-ban él.

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('player/connect', [PlayerPairingController::class, 'connect'])->name('player.connect');
    Route::post('player/connect', [PlayerPairingController::class, 'approve'])->name('player.approve')->middleware('throttle:10,1,player-approve');
});

// ── Letöltések (bővítmény, desktop lejátszó) — ADMIN-ONLY ─────────────────────
// A fájlok a private diskről jönnek, nincs publikus URL-jük.
//
// INDULÁSKOR ELREJTVE (2026-07-29): a bővítmény a Chrome Web Store-ból fog
// települni, a desktop lejátszót pedig egyelőre nem hirdetjük. A letöltő
// felület nem szűnt meg, csak `can:admin` mögé került — ez az egyetlen hely,
// ahonnan a friss build elérhető. A felhasználói letöltő-gombok (dashboard-
// banner, landing, kézikönyv, onboarding) ezzel együtt kikommentelve.
// Visszanyitáskor elég a `can:admin` levétele és a hívó felületek élesítése.

Route::middleware(['auth', 'verified', 'can:admin'])->group(function () {
    Route::inertia('downloads', 'downloads')->name('downloads.index');
    Route::get('downloads/{file}', [DownloadController::class, 'show'])->name('downloads.show')->middleware('throttle:20,1,downloads');
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
require __DIR__.'/report.php';
