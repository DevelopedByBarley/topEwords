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

    // Szó-írások (státusz, fontosság, saját szó CRUD) közös percenkénti sapkája:
    // minden hívás streak-update + achievement-ellenőrzést futtat, és az Origint
    // elhagyó szkriptelt extension-kvóta-kerülésnek is ez a plafonja.
    Route::middleware('throttle:60,1,word-writes')->group(function () {
        Route::post('words/{word}/status', [WordController::class, 'status'])->name('words.status');
        Route::post('words/{word}/importance', [WordController::class, 'importance'])->name('words.importance');

        // Saját szavak
        Route::post('custom-words', [UserCustomWordController::class, 'store'])->name('custom-words.store');
        Route::patch('custom-words/{customWord}', [UserCustomWordController::class, 'update'])->name('custom-words.update');
        Route::post('custom-words/{customWord}/status', [UserCustomWordController::class, 'status'])->name('custom-words.status');
        Route::post('custom-words/{customWord}/importance', [UserCustomWordController::class, 'importance'])->name('custom-words.importance');
        Route::delete('custom-words/{customWord}', [UserCustomWordController::class, 'destroy'])->name('custom-words.destroy');
    });

    // Gyakorlások: szabad írás, mondatkiegészítés, kvíz
    //
    // INDULÁSKOR KIVEZETVE (2026-07-26): a kvíz, a mondatkiegészítés, a szabad
    // írás és a rendhagyó igék nem részei az induló feature-körnek. A kód NEM
    // törölt, csak elérhetetlen: a route-ok kikommentelve, a sidebar-linkek
    // elrejtve. Ezek a felületek a biztonsági auditból is KI VANNAK ZÁRVA,
    // amíg nem kerülnek vissza. Visszahozáskor a route-okat itt kell
    // visszakommentelni, és a hozzájuk tartozó Wayfinder-akciókat újragenerálni.
    //
    // Route::get('words/practice', [WordController::class, 'practice'])->name('words.practice');
    // Route::get('words/cloze', [ClozeController::class, 'index'])->name('words.cloze')->middleware('throttle:60,1,words-play');
    // Route::post('words/cloze/complete', [ClozeController::class, 'complete'])->name('words.cloze.complete')->middleware('throttle:30,1,words-cloze');
    // Route::get('words/quiz', [WordController::class, 'quiz'])->name('words.quiz')->middleware('throttle:60,1,words-play');
    // Route::post('words/quiz/complete', [QuizController::class, 'complete'])->name('words.quiz.complete')->middleware('throttle:30,1,words-quiz');
    // Route::get('irregular-verbs', [IrregularVerbController::class, 'index'])->name('irregular-verbs.index');

    // Marad: a szövegelemző mondat-ellenőrzője nem gyakorlási felület.
    Route::post('words/sentence-check', [TextAnalysisController::class, 'sentenceCheck'])->name('words.sentence-check')->middleware('throttle:30,1,ta-ai');

    // Marad: a KÜLÖNÁLLÓ words/practice OLDAL kivezetve, de ez a végpont NEM
    // csak azé volt — a szólista soraiba (PracticeModal) és a flashcard-oldal
    // szabad-írás dobozába is be van építve, és mindkettő ÉLŐ felület. A hívók
    // hardcode-olt fetch('/words/practice/check')-et használnak, nem Wayfindert,
    // ezért a route kikommentelése némán 404-et okozott mindkét helyen.
    Route::post('words/practice/check', [TextAnalysisController::class, 'practiceCheck'])->name('words.practice.check')->middleware('throttle:30,1,words-practice');

    // Szó-mappák
    Route::post('folders', [FolderController::class, 'store'])->name('folders.store');
    Route::patch('folders/{folder}', [FolderController::class, 'update'])->name('folders.update');
    Route::delete('folders/{folder}', [FolderController::class, 'destroy'])->name('folders.destroy');
    Route::patch('folders/{folder}/words/{word}', [FolderWordController::class, 'update'])->name('folders.words.update');
});
