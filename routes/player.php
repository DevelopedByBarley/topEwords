<?php

use App\Http\Controllers\PlayerPairingController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('player/connect', [PlayerPairingController::class, 'connect'])->name('player.connect');
    Route::post('player/connect', [PlayerPairingController::class, 'approve'])->name('player.approve')->middleware('throttle:10,1,player-approve');
});
