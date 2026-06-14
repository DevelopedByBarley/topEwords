<?php

use App\Http\Controllers\FlashcardCalibrationController;
use App\Http\Controllers\FlashcardCardController;
use App\Http\Controllers\FlashcardCsvController;
use App\Http\Controllers\FlashcardDeckController;
use App\Http\Controllers\FlashcardFolderController;
use App\Http\Controllers\FlashcardFolderDeckController;
use App\Http\Controllers\FlashcardStudyController;
use App\Http\Middleware\EnsureOnboardingComplete;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', EnsureOnboardingComplete::class])->group(function () {
    // Paklik
    Route::get('flashcards', [FlashcardDeckController::class, 'index'])->name('flashcards.index');
    Route::post('flashcards', [FlashcardDeckController::class, 'store'])->name('flashcards.store');
    Route::get('flashcards/{deck}', [FlashcardDeckController::class, 'show'])->name('flashcards.show');
    Route::patch('flashcards/{deck}', [FlashcardDeckController::class, 'update'])->name('flashcards.update');
    Route::delete('flashcards/{deck}', [FlashcardDeckController::class, 'destroy'])->name('flashcards.destroy');
    Route::put('flashcards/{deck}/settings', [FlashcardDeckController::class, 'updateSettings'])->name('flashcards.settings.update');
    Route::delete('flashcards/{deck}/settings', [FlashcardDeckController::class, 'destroySettings'])->name('flashcards.settings.destroy');

    // Kártyák
    Route::post('flashcards/{deck}/cards', [FlashcardCardController::class, 'store'])->name('flashcards.cards.store');
    Route::post('flashcards/{deck}/cards/import', [FlashcardCardController::class, 'importFromWord'])->name('flashcards.cards.import');
    Route::patch('flashcards/{deck}/cards/{flashcard}', [FlashcardCardController::class, 'update'])->name('flashcards.cards.update');
    Route::post('flashcards/{deck}/cards/{flashcard}/reset', [FlashcardCardController::class, 'resetProgress'])->name('flashcards.cards.reset');
    Route::post('flashcards/{deck}/cards/{flashcard}/move', [FlashcardCardController::class, 'move'])->name('flashcards.cards.move');
    Route::post('flashcards/{deck}/cards/{flashcard}/duplicate', [FlashcardCardController::class, 'duplicate'])->name('flashcards.cards.duplicate');
    Route::delete('flashcards/{deck}/cards/{flashcard}', [FlashcardCardController::class, 'destroy'])->name('flashcards.cards.destroy');
    Route::post('flashcards/{deck}/cards/bulk-delete', [FlashcardCardController::class, 'bulkDelete'])->name('flashcards.cards.bulk-delete');
    Route::post('flashcards/{deck}/cards/bulk-reset', [FlashcardCardController::class, 'bulkReset'])->name('flashcards.cards.bulk-reset');
    Route::post('flashcards/{deck}/cards/bulk-move', [FlashcardCardController::class, 'bulkMove'])->name('flashcards.cards.bulk-move');
    Route::post('flashcards/{deck}/cards/bulk-reverse', [FlashcardCardController::class, 'bulkReverse'])->name('flashcards.cards.bulk-reverse');
    Route::post('flashcards/{deck}/cards/bulk-direction', [FlashcardCardController::class, 'bulkDirection'])->name('flashcards.cards.bulk-direction');

    // CSV import / export
    Route::post('flashcards/{deck}/csv-import', [FlashcardCsvController::class, 'import'])->name('flashcards.csv.import');
    Route::get('flashcards/{deck}/csv-export', [FlashcardCsvController::class, 'export'])->name('flashcards.csv.export');

    // Kalibráció
    Route::get('flashcards/{deck}/calibrate', [FlashcardCalibrationController::class, 'show'])->name('flashcards.calibrate');
    Route::post('flashcards/{deck}/calibrate', [FlashcardCalibrationController::class, 'rate'])->name('flashcards.calibrate.rate');
    Route::post('flashcards/{deck}/calibrate/skip', [FlashcardCalibrationController::class, 'skip'])->name('flashcards.calibrate.skip');

    // Tanulás
    Route::get('flashcards/{deck}/study', [FlashcardStudyController::class, 'show'])->name('flashcards.study');
    Route::post('flashcards/{deck}/study', [FlashcardStudyController::class, 'submit'])->name('flashcards.study.submit');
    Route::post('flashcards/{deck}/study/undo', [FlashcardStudyController::class, 'undo'])->name('flashcards.study.undo');

    // Pakli-mappák
    Route::post('flashcards/folders', [FlashcardFolderController::class, 'store'])->name('flashcards.folders.store');
    Route::patch('flashcards/folders/{flashcardFolder}', [FlashcardFolderController::class, 'update'])->name('flashcards.folders.update');
    Route::delete('flashcards/folders/{flashcardFolder}', [FlashcardFolderController::class, 'destroy'])->name('flashcards.folders.destroy');
    Route::patch('flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}', [FlashcardFolderDeckController::class, 'update'])->name('flashcards.folders.decks.update');
});
