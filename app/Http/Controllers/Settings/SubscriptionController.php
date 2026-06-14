<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SubscriptionController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();
        $activeSub = $user->activeSubscription();

        return Inertia::render('settings/subscription', [
            'hasActiveAccess' => $user->hasActiveAccess(),
            'isSubscribed' => $activeSub !== null,
            'isPremium' => $user->subscriptionPlan() === 'premium',
            'hasAiAccess' => $user->hasAiAccess(),
            'isOnTrial' => $user->onTrial(),
            'trialEndsAt' => $user->trial_ends_at?->toIso8601String(),
            'subscription' => $activeSub ? [
                'stripe_status' => $activeSub->stripe_status,
                'ends_at' => $activeSub->ends_at?->toIso8601String(),
                'cancel_at_period_end' => $activeSub->onGracePeriod(),
                'type' => $user->subscriptionPlan() === 'premium' ? 'premium' : 'default',
            ] : null,
        ]);
    }

    public function cancel(Request $request): RedirectResponse
    {
        $subscription = $request->user()->activeSubscription();

        if ($subscription !== null && ! $subscription->onGracePeriod()) {
            $subscription->cancel();
        }

        return back()->with('success', 'Előfizetésed lemondva. Az időszak végéig még hozzáférsz a funkciókhoz.');
    }

    public function resume(Request $request): RedirectResponse
    {
        $subscription = $request->user()->activeSubscription();

        if ($subscription !== null && $subscription->onGracePeriod()) {
            $subscription->resume();

            return back()->with('success', 'Lemondás visszavonva, az előfizetésed aktív marad.');
        }

        return back();
    }

    public function portal(Request $request): RedirectResponse
    {
        // Stripe ügyfél nélkül a portál hívása kivételt dobna
        if (! $request->user()->hasStripeId()) {
            return redirect()->route('pricing');
        }

        return $request->user()->redirectToBillingPortal(route('subscription.edit'));
    }
}
