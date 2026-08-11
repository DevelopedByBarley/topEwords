<?php

use App\Http\Controllers\PlayerPairingController;
use Illuminate\Support\Facades\Route;

// ── Desktop lejátszó összekötése ──────────────────────────────────────────────
// A jóváhagyás szándékosan a normál webes session-nel (auth + verified + CSRF)
// történik: a lejátszó a rendszer-böngészőt nyitja meg erre az oldalra, így a
// jelszó (és a 2FA) soha nem megy át az appon. A párosító API a routes/api.php-ban él.

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('player/connect', [PlayerPairingController::class, 'connect'])->name('player.connect');
    Route::post('player/connect', [PlayerPairingController::class, 'approve'])->name('player.approve')->middleware('throttle:10,1,player-approve');
});
