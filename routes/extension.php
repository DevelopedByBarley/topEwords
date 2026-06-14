<?php

use App\Http\Controllers\ExtensionController;
use Illuminate\Support\Facades\Route;

// Chrome extension végpontok — az auth-ot a controller kezeli kézzel,
// hogy ne legyen redirect (a kliens JSON hibát vár).
Route::middleware('throttle:120,1')->group(function () {
    Route::get('extension/lookup', [ExtensionController::class, 'lookup'])->name('extension.lookup');
    Route::get('extension/search', [ExtensionController::class, 'search'])->name('extension.search');
    Route::get('extension/statuses', [ExtensionController::class, 'statuses'])->name('extension.statuses');
    Route::get('extension/badge', [ExtensionController::class, 'badge'])->name('extension.badge');
});

Route::post('extension/add-word', [ExtensionController::class, 'addWord'])->name('extension.add-word')->middleware('throttle:20,1');
