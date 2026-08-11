<?php

use App\Http\Controllers\PricingController;
use App\Http\Controllers\StripeWebhookController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('/pricing/checkout/{plan}', [PricingController::class, 'checkout'])->name('pricing.checkout')->middleware('throttle:20,1,pricing-checkout');
    Route::post('/pricing/portal', [PricingController::class, 'portal'])->name('pricing.portal')->middleware('throttle:10,1');
});

// Stripe webhook — CSRF alól kivéve, a Cashier aláírás-ellenőrzése védi
Route::post('stripe/webhook', [StripeWebhookController::class, 'handleWebhook'])->name('cashier.webhook');
