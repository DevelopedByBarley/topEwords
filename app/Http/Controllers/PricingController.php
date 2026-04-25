<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class PricingController extends Controller
{
    // Stripe price IDs — set these in the Stripe dashboard
    private const BASIC_PRICE_ID = 'price_1TJz7dI38BdKXLU03a7PwGE4';

    private const PREMIUM_PRICE_ID = 'price_1TJz9OI38BdKXLU07komC43Z';

    public function index(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('pricing', [
            'hasActiveAccess' => $user?->hasActiveAccess() ?? false,
            'isOnTrial' => $user?->onTrial() ?? false,
            'trialEndsAt' => $user?->trial_ends_at?->toIso8601String(),
            'isSubscribed' => $user?->subscribed('default') || $user?->subscribed('premium') ?? false,
            'isPremium' => $user?->subscribed('premium') ?? false,
            'hasAiAccess' => $user?->hasAiAccess() ?? false,
            'stripeConfigured' => config('cashier.key') !== 'pk_test_placeholder'
                && str_starts_with(self::BASIC_PRICE_ID, 'price_'),
        ]);
    }

    public function checkout(Request $request, string $plan): RedirectResponse|\Illuminate\Http\Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        $successUrl = URL::temporarySignedRoute('pricing.success', now()->addMinutes(10));

        if ($plan === 'basic') {
            if ($user->subscribed('default')) {
                return redirect()->route('pricing')->with('info', 'Már aktív alap előfizetésed van.');
            }

            $checkout = $user->newSubscription('default', self::BASIC_PRICE_ID)
                ->checkout([
                    'success_url' => $successUrl,
                    'cancel_url' => route('pricing'),
                ]);
        } elseif ($plan === 'premium') {
            if ($user->subscribed('premium')) {
                return redirect()->route('pricing')->with('info', 'Már aktív prémium előfizetésed van.');
            }

            $checkout = $user->newSubscription('premium', self::PREMIUM_PRICE_ID)
                ->checkout([
                    'success_url' => $successUrl,
                    'cancel_url' => route('pricing'),
                ]);
        } else {
            abort(404);
        }

        return Inertia::location($checkout->url);
    }

    public function success(Request $request): RedirectResponse
    {
        return redirect()->route('pricing')->with('success', 'Sikeres fizetés! Köszönjük a vásárlást.');
    }

    public function portal(Request $request): RedirectResponse
    {
        return $request->user()->redirectToBillingPortal(route('pricing'));
    }
}
