<?php

use App\Http\Controllers\ExtensionController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:120,1,ext-read')->group(function () {
    Route::get('extension/lookup', [ExtensionController::class, 'lookup'])->name('extension.lookup');
    Route::get('extension/search', [ExtensionController::class, 'search'])->name('extension.search');
    Route::get('extension/statuses', [ExtensionController::class, 'statuses'])->name('extension.statuses');
    Route::get('extension/decks', [ExtensionController::class, 'decks'])->name('extension.decks');
});

Route::middleware('verified')->group(function () {
    Route::post('extension/add-word', [ExtensionController::class, 'addWord'])->name('extension.add-word')->middleware('throttle:20,1,ext-write');
    Route::post('extension/create-flashcard', [ExtensionController::class, 'createFlashcard'])->name('extension.create-flashcard')->middleware('throttle:20,1,ext-write');
});

Route::get('extension/youtube-transcript', [ExtensionController::class, 'youtubeTranscript'])->name('extension.youtube-transcript')->middleware('throttle:30,1,ext-yt');
