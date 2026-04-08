<?php

namespace App\Http\Controllers;

use App\Models\User;
use Laravel\Cashier\Http\Controllers\WebhookController;

class StripeWebhookController extends WebhookController
{
    /**
     * Handle a completed Stripe Checkout session.
     * This fires for both subscription and one-time (lifetime) purchases.
     */
    public function handleCheckoutSessionCompleted(array $payload): void
    {
        $session = $payload['data']['object'];

        // One-time payment → lifetime access
        if (($session['mode'] ?? '') === 'payment') {
            $stripeId = $session['customer'] ?? null;

            if ($stripeId) {
                User::where('stripe_id', $stripeId)->update(['lifetime_access' => true]);
            }
        }
    }
}
