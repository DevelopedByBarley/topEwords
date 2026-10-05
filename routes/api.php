<?php

use App\Http\Controllers\ExtensionController;
use App\Http\Controllers\PlayerPairingController;
use App\Http\Controllers\TextAnalysisController;
use Illuminate\Support\Facades\Route;

Route::post('player/pair', [PlayerPairingController::class, 'store'])
    ->name('player.pair')
    ->middleware('throttle:10,1,player-pair');
Route::post('player/pair/exchange', [PlayerPairingController::class, 'exchange'])
    ->name('player.pair.exchange')
    ->middleware('throttle:30,1,player-poll');

Route::middleware(['auth:sanctum', 'abilities:player'])->group(function () {
    Route::middleware('throttle:120,1,player-read')->group(function () {
        Route::get('player/me', [PlayerPairingController::class, 'me'])->name('player.me');
        Route::get('player/lookup', [ExtensionController::class, 'lookup'])->name('player.lookup');
        Route::get('player/statuses', [ExtensionController::class, 'statuses'])->name('player.statuses');
        Route::get('player/search', [ExtensionController::class, 'search'])->name('player.search');
        Route::get('player/decks', [ExtensionController::class, 'decks'])->name('player.decks');
    });

    Route::middleware('verified')->group(function () {
        Route::middleware('throttle:30,1,player-ai')->group(function () {
            Route::get('player/gemini-lookup', [TextAnalysisController::class, 'geminiWordLookup'])->name('player.gemini-lookup');
            Route::get('player/gemini-flashcard', [TextAnalysisController::class, 'geminiFlashcard'])->name('player.gemini-flashcard');
        });

        Route::middleware('throttle:60,1,player-status')->group(function () {
            Route::post('player/update-status', [ExtensionController::class, 'updateStatus'])->name('player.update-status');
            Route::post('player/update-importance', [ExtensionController::class, 'updateImportance'])->name('player.update-importance');
        });

        Route::post('player/add-word', [ExtensionController::class, 'addWord'])
            ->name('player.add-word')
            ->middleware('throttle:20,1,player-write');
        Route::post('player/create-flashcard', [ExtensionController::class, 'createFlashcard'])
            ->name('player.create-flashcard')
            ->middleware('throttle:20,1,player-write');
    });

    Route::post('player/disconnect', [PlayerPairingController::class, 'disconnect'])
        ->name('player.disconnect')
        ->middleware('throttle:20,1,player-write');
});
