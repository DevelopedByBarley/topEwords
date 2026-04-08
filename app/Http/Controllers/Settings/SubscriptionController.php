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

        return Inertia::render('settings/subscription', [
            'hasActiveAccess' => $user->hasActiveAccess(),
            'isSubscribed' => $user->subscribed('default'),
            'hasLifetime' => (bool) $user->lifetime_access,
            'isOnTrial' => $user->onTrial(),
            'trialEndsAt' => $user->trial_ends_at?->toIso8601String(),
            'subscription' => $user->subscription('default') ? [
                'stripe_status' => $user->subscription('default')->stripe_status,
                'ends_at' => $user->subscription('default')->ends_at?->toIso8601String(),
                'cancel_at_period_end' => (bool) $user->subscription('default')->ends_at,
            ] : null,
        ]);
    }

    public function cancel(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->subscribed('default')) {
            $user->subscription('default')->cancel();
        }

        return back()->with('success', 'Előfizetésed lemondva. A hónap végéig még hozzáférsz a prémium funkciókhoz.');
    }

    public function portal(Request $request): RedirectResponse
    {
        return $request->user()->redirectToBillingPortal(route('subscription.edit'));
    }
}
