<?php

// Induláskor kivezetve (lásd a gyakorlás-blokk kommentjét lentebb):
// use App\Http\Controllers\ClozeController;
// use App\Http\Controllers\IrregularVerbController;
// use App\Http\Controllers\QuizController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\FolderWordController;
use App\Http\Controllers\TextAnalysisController;
use App\Http\Controllers\UserCustomWordController;
use App\Http\Controllers\WordController;
use App\Http\Middleware\EnsureOnboardingComplete;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', EnsureOnboardingComplete::class])->group(function () {
    // Top 10 000 szó
    Route::get('words', [WordController::class, 'index'])->name('words.index');
    Route::get('words/search', [WordController::class, 'search'])->name('words.search');
    Route::patch('words/{word}', [WordController::class, 'update'])->name('words.update')->middleware('can:admin');

    Route::delete('words/{word}', [WordController::class, 'destroy'])->name('words.destroy')->middleware('can:admin');

    // Admin gyors alak-kitöltő: egy kattintás = egy szó HIÁNYZÓ alak-mezői.
    // Meglévő értéket nem ír felül, ezért végigkattintható a lista anélkül, hogy
    // a felhalmozott jelentések és példamondatok cserélődnének.
    Route::post('words/{word}/ai-fill', [TextAnalysisController::class, 'adminFillWordForms'])
        ->name('words.ai-fill')
        ->middleware(['can:admin', 'throttle:60,1,admin-ai-fill', 'ai.budget']);

    Route::middleware('throttle:300,1,word-writes')->group(function () {
        Route::post('words/{word}/status', [WordController::class, 'status'])->name('words.status');
        Route::post('words/{word}/importance', [WordController::class, 'importance'])->name('words.importance');

        // Saját szavak
        Route::post('custom-words', [UserCustomWordController::class, 'store'])->name('custom-words.store');
        Route::patch('custom-words/{customWord}', [UserCustomWordController::class, 'update'])->name('custom-words.update');
        Route::post('custom-words/{customWord}/status', [UserCustomWordController::class, 'status'])->name('custom-words.status');
        Route::post('custom-words/{customWord}/importance', [UserCustomWordController::class, 'importance'])->name('custom-words.importance');
        Route::delete('custom-words/{customWord}', [UserCustomWordController::class, 'destroy'])->name('custom-words.destroy');
    });

    Route::post('words/sentence-check', [TextAnalysisController::class, 'sentenceCheck'])->name('words.sentence-check')->middleware(['throttle:30,1,ta-ai', 'ai.budget']);

    Route::post('words/practice/check', [TextAnalysisController::class, 'practiceCheck'])->name('words.practice.check')->middleware(['throttle:30,1,words-practice', 'ai.budget']);

    // Folders
    Route::post('folders', [FolderController::class, 'store'])->name('folders.store');
    Route::patch('folders/{folder}', [FolderController::class, 'update'])->name('folders.update');
    Route::delete('folders/{folder}', [FolderController::class, 'destroy'])->name('folders.destroy');
    Route::patch('folders/{folder}/words/{word}', [FolderWordController::class, 'update'])->name('folders.words.update');
});
