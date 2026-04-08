<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PricingController extends Controller
{
    // Stripe price IDs — set these once you create products in the Stripe dashboard
    private const MONTHLY_PRICE_ID = 'price_1TJz7dI38BdKXLU03a7PwGE4';

    private const LIFETIME_PRICE_ID = 'price_1TJz9OI38BdKXLU07komC43Z';

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('pricing', [
            'hasActiveAccess' => $user?->hasActiveAccess() ?? false,
            'isOnTrial' => $user?->onTrial() ?? false,
            'trialEndsAt' => $user?->trial_ends_at?->toIso8601String(),
            'isSubscribed' => $user?->subscribed('default') ?? false,
            'hasLifetime' => $user?->lifetime_access ?? false,
            'stripeConfigured' => config('cashier.key') !== 'pk_test_placeholder'
                && str_starts_with(self::MONTHLY_PRICE_ID, 'price_'),
        ]);
    }

    public function checkout(Request $request, string $plan): RedirectResponse|\Illuminate\Http\Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        if ($user->hasActiveAccess() && $user->subscribed('default')) {
            return redirect()->route('pricing')->with('info', 'Már aktív előfizetésed van.');
        }

        if ($plan === 'monthly') {
            $checkout = $user->newSubscription('default', self::MONTHLY_PRICE_ID)
                ->checkout([
                    'success_url' => route('pricing').'?success=1',
                    'cancel_url' => route('pricing'),
                ]);
        } elseif ($plan === 'lifetime') {
            $checkout = $user->checkout(self::LIFETIME_PRICE_ID, [
                'success_url' => route('pricing').'?success=1',
                'cancel_url' => route('pricing'),
            ]);
        } else {
            abort(404);
        }

        return Inertia::location($checkout->url);
    }

    public function portal(Request $request): RedirectResponse
    {
        return $request->user()->redirectToBillingPortal(route('pricing'));
    }
}
