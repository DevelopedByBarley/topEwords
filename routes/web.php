<?php

use App\Http\Controllers\AchievementController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\ClozeController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ExtensionController;
use App\Http\Controllers\FlashcardCardController;
use App\Http\Controllers\FlashcardCsvController;
use App\Http\Controllers\FlashcardDeckController;
use App\Http\Controllers\FlashcardFolderController;
use App\Http\Controllers\FlashcardFolderDeckController;
use App\Http\Controllers\FlashcardStudyController;
use App\Http\Controllers\FolderController;
use App\Http\Controllers\FolderWordController;
use App\Http\Controllers\IrregularVerbController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\TextAnalysisController;
use App\Http\Controllers\UserCustomWordController;
use App\Http\Controllers\WordController;
use Illuminate\Support\Facades\Route;
use Laravel\Fortify\Features;

Route::inertia('/', 'welcome', [
    'canRegister' => Features::enabled(Features::registration()),
])->name('home');

Route::inertia('/terms', 'legal/terms')->name('terms');
Route::inertia('/privacy', 'legal/privacy')->name('privacy');

Route::get('/sitemap.xml', function () {
    return response()->view('sitemap')->header('Content-Type', 'application/xml');
})->name('sitemap');

Route::middleware(['auth', 'can:admin'])->get('admin', [AdminController::class, 'index'])->name('admin');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('words', [WordController::class, 'index'])->name('words.index');
    Route::get('words/cloze', [ClozeController::class, 'index'])->name('words.cloze');
    Route::get('words/quiz', [WordController::class, 'quiz'])->name('words.quiz');
    Route::post('words/quiz/complete', [QuizController::class, 'complete'])->name('words.quiz.complete');
    Route::get('words/search', [WordController::class, 'search'])->name('words.search');
    Route::post('words/{word}/status', [WordController::class, 'status'])->name('words.status');

    // Flashcard decks
    Route::get('flashcards', [FlashcardDeckController::class, 'index'])->name('flashcards.index');
    Route::post('flashcards', [FlashcardDeckController::class, 'store'])->name('flashcards.store');
    Route::get('flashcards/{deck}', [FlashcardDeckController::class, 'show'])->name('flashcards.show');
    Route::patch('flashcards/{deck}', [FlashcardDeckController::class, 'update'])->name('flashcards.update');
    Route::delete('flashcards/{deck}', [FlashcardDeckController::class, 'destroy'])->name('flashcards.destroy');
    Route::put('flashcards/{deck}/settings', [FlashcardDeckController::class, 'updateSettings'])->name('flashcards.settings.update');
    Route::delete('flashcards/{deck}/settings', [FlashcardDeckController::class, 'destroySettings'])->name('flashcards.settings.destroy');

    // Flashcard cards
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

    // CSV import / export
    Route::post('flashcards/{deck}/csv-import', [FlashcardCsvController::class, 'import'])->name('flashcards.csv.import');
    Route::get('flashcards/{deck}/csv-export', [FlashcardCsvController::class, 'export'])->name('flashcards.csv.export');

    // Study session
    Route::get('flashcards/{deck}/study', [FlashcardStudyController::class, 'show'])->name('flashcards.study');
    Route::post('flashcards/{deck}/study', [FlashcardStudyController::class, 'submit'])->name('flashcards.study.submit');

    // Flashcard folders
    Route::post('flashcards/folders', [FlashcardFolderController::class, 'store'])->name('flashcards.folders.store');
    Route::patch('flashcards/folders/{flashcardFolder}', [FlashcardFolderController::class, 'update'])->name('flashcards.folders.update');
    Route::delete('flashcards/folders/{flashcardFolder}', [FlashcardFolderController::class, 'destroy'])->name('flashcards.folders.destroy');
    Route::patch('flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}', [FlashcardFolderDeckController::class, 'update'])->name('flashcards.folders.decks.update');

    Route::get('extension/lookup', [ExtensionController::class, 'lookup'])->name('extension.lookup');

    Route::get('review', [ReviewController::class, 'index'])->name('review.index');
    Route::post('review/complete', [ReviewController::class, 'complete'])->name('review.complete');

    Route::get('achievements', [AchievementController::class, 'index'])->name('achievements.index');

    Route::get('irregular-verbs', [IrregularVerbController::class, 'index'])->name('irregular-verbs.index');

    Route::get('text-analysis', [TextAnalysisController::class, 'show'])->name('text-analysis.show');
    Route::post('text-analysis/fetch-source', [TextAnalysisController::class, 'fetchSource'])->name('text-analysis.fetch-source');
    Route::post('text-analysis/analyze', [TextAnalysisController::class, 'analyze'])->name('text-analysis.analyze');
    Route::get('text-analysis/word-lookup', [TextAnalysisController::class, 'wordLookup'])->name('text-analysis.word-lookup');

    // Custom words
    Route::post('custom-words', [UserCustomWordController::class, 'store'])->name('custom-words.store');
    Route::patch('custom-words/{customWord}', [UserCustomWordController::class, 'update'])->name('custom-words.update');
    Route::post('custom-words/{customWord}/status', [UserCustomWordController::class, 'status'])->name('custom-words.status');
    Route::delete('custom-words/{customWord}', [UserCustomWordController::class, 'destroy'])->name('custom-words.destroy');

    Route::post('folders', [FolderController::class, 'store'])->name('folders.store');
    Route::patch('folders/{folder}', [FolderController::class, 'update'])->name('folders.update');
    Route::delete('folders/{folder}', [FolderController::class, 'destroy'])->name('folders.destroy');
    Route::patch('folders/{folder}/words/{word}', [FolderWordController::class, 'update'])->name('folders.words.update');
});

require __DIR__.'/settings.php';
