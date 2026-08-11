<?php

use App\Http\Controllers\DownloadController;
use Illuminate\Support\Facades\Route;

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
