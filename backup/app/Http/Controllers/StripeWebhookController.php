<?php

namespace App\Http\Controllers;

use Laravel\Cashier\Http\Controllers\WebhookController;

class StripeWebhookController extends WebhookController
{
    /**
     * Subscription events are handled automatically by Cashier.
     * This override exists for any custom webhook logic if needed in the future.
     */
}
