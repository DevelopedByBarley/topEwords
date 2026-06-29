<?php

use App\Http\Controllers\ExtensionController;
use Illuminate\Support\Facades\Route;

// Chrome extension végpontok — az auth-ot a controller kezeli kézzel,
// hogy ne legyen redirect (a kliens JSON hibát vár).
// Külön throttle-prefix vödrök, hogy a gyakori olvasó-hívások ne merítsék ki
// az írás/feltöltés végpontok limitjét (a Laravel inline throttle alapból
// felhasználónként EGY közös vödröt használ minden route-ra).
Route::middleware('throttle:120,1,ext-read')->group(function () {
    Route::get('extension/lookup', [ExtensionController::class, 'lookup'])->name('extension.lookup');
    Route::get('extension/search', [ExtensionController::class, 'search'])->name('extension.search');
    Route::get('extension/statuses', [ExtensionController::class, 'statuses'])->name('extension.statuses');
    Route::get('extension/badge', [ExtensionController::class, 'badge'])->name('extension.badge');
    Route::get('extension/decks', [ExtensionController::class, 'decks'])->name('extension.decks');
});

Route::post('extension/add-word', [ExtensionController::class, 'addWord'])->name('extension.add-word')->middleware('throttle:20,1,ext-write');
Route::post('extension/create-flashcard', [ExtensionController::class, 'createFlashcard'])->name('extension.create-flashcard')->middleware('throttle:20,1,ext-write');

// Felirat-letöltés (YouTube-ot ér el, ezért szigorúbb limit).
Route::get('extension/youtube-transcript', [ExtensionController::class, 'youtubeTranscript'])->name('extension.youtube-transcript')->middleware('throttle:30,1,ext-yt');
