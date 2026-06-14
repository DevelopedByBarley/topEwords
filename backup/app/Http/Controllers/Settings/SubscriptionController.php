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
        $basicSub = $user->subscription('default');
        $premiumSub = $user->subscription('premium');
        $activeSub = $premiumSub ?? $basicSub;

        return Inertia::render('settings/subscription', [
            'hasActiveAccess' => $user->hasActiveAccess(),
            'isSubscribed' => $user->subscribed('default') || $user->subscribed('premium'),
            'isPremium' => $user->subscribed('premium'),
            'hasAiAccess' => $user->hasAiAccess(),
            'isOnTrial' => $user->onTrial(),
            'trialEndsAt' => $user->trial_ends_at?->toIso8601String(),
            'subscription' => $activeSub ? [
                'stripe_status' => $activeSub->stripe_status,
                'ends_at' => $activeSub->ends_at?->toIso8601String(),
                'cancel_at_period_end' => (bool) $activeSub->ends_at,
                'type' => $premiumSub ? 'premium' : 'default',
            ] : null,
        ]);
    }

    public function cancel(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->subscribed('premium')) {
            $user->subscription('premium')->cancel();
        } elseif ($user->subscribed('default')) {
            $user->subscription('default')->cancel();
        }

        return back()->with('success', 'Előfizetésed lemondva. A hónap végéig még hozzáférsz a funkciókhoz.');
    }

    public function portal(Request $request): RedirectResponse
    {
        return $request->user()->redirectToBillingPortal(route('subscription.edit'));
    }
}
