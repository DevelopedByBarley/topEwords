<?php

use App\Http\Controllers\Settings\BillingController;
use App\Http\Controllers\Settings\FlashcardController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\SubscriptionController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/billing', [BillingController::class, 'edit'])->name('billing.edit');
    Route::put('settings/billing', [BillingController::class, 'update'])->name('billing.update');

    Route::get('settings/security', [SecurityController::class, 'edit'])->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1,password-update')
        ->name('user-password.update');

    Route::delete('settings/security/player-devices', [SecurityController::class, 'revokeAllPlayerDevices'])
        ->middleware('throttle:10,1,player-device-revoke')
        ->name('security.player-devices.destroy-all');

    Route::delete('settings/security/player-devices/{tokenId}', [SecurityController::class, 'revokePlayerDevice'])
        ->whereNumber('tokenId')
        ->middleware('throttle:10,1,player-device-revoke')
        ->name('security.player-devices.destroy');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');

    Route::get('settings/flashcards', [FlashcardController::class, 'edit'])->name('flashcard-settings.edit');
    Route::put('settings/flashcards', [FlashcardController::class, 'update'])->name('flashcard-settings.update');

    Route::get('settings/subscription', [SubscriptionController::class, 'edit'])->name('subscription.edit');
    Route::post('settings/subscription/cancel', [SubscriptionController::class, 'cancel'])->name('subscription.cancel')->middleware('throttle:10,1,subscription-manage');
    Route::post('settings/subscription/resume', [SubscriptionController::class, 'resume'])->name('subscription.resume')->middleware('throttle:10,1,subscription-manage');
    Route::post('settings/subscription/portal', [SubscriptionController::class, 'portal'])->name('subscription.portal')->middleware('throttle:10,1');
    Route::get('settings/subscription/invoices/{invoice}', [SubscriptionController::class, 'downloadInvoice'])->name('subscription.invoice.download')->middleware('throttle:30,1');
});
