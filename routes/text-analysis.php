<?php

use App\Http\Controllers\TextAnalysisController;
use App\Http\Middleware\EnsureOnboardingComplete;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', EnsureOnboardingComplete::class])->group(function () {
    Route::get('text-analysis', [TextAnalysisController::class, 'show'])->name('text-analysis.show');
    Route::post('text-analysis/fetch-source', [TextAnalysisController::class, 'fetchSource'])->name('text-analysis.fetch-source')->middleware('throttle:30,1');
    Route::post('text-analysis/analyze', [TextAnalysisController::class, 'analyze'])->name('text-analysis.analyze')->middleware('throttle:30,1');
    Route::get('text-analysis/word-lookup', [TextAnalysisController::class, 'wordLookup'])->name('text-analysis.word-lookup');
    Route::get('text-analysis/gemini-lookup', [TextAnalysisController::class, 'geminiWordLookup'])->name('text-analysis.gemini-lookup')->middleware('throttle:30,1');
    Route::get('text-analysis/gemini-flashcard', [TextAnalysisController::class, 'geminiFlashcard'])->name('text-analysis.gemini-flashcard')->middleware('throttle:30,1');
    Route::get('text-analysis/gemini-models', [TextAnalysisController::class, 'geminiListModels'])->name('text-analysis.gemini-models')->middleware('throttle:30,1');
    Route::get('text-analysis/word-insight', [TextAnalysisController::class, 'wordInsight'])->name('text-analysis.word-insight')->middleware('throttle:30,1');

    // Könyvek (EPUB/PDF feltöltés és olvasás)
    Route::get('text-analysis/books', [TextAnalysisController::class, 'listBooks'])->name('text-analysis.books.index');
    Route::post('text-analysis/books', [TextAnalysisController::class, 'uploadBook'])->name('text-analysis.books.store')->middleware('throttle:10,1');
    Route::get('text-analysis/books/{book}/page', [TextAnalysisController::class, 'getBookPage'])->name('text-analysis.books.page');
    Route::delete('text-analysis/books/{book}', [TextAnalysisController::class, 'deleteBook'])->name('text-analysis.books.destroy');
});
