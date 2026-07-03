<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile');
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();

        $user->fill($request->validated());

        $emailChanged = $user->isDirty('email');

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        // E-mail-váltáskor azonnal küldjük a megerősítő levelet — a verify-email
        // oldal szövege kiküldött levélre hivatkozik, e nélkül az sosem létezne.
        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        // Cancel every still-live Stripe subscription before deleting the user. Cashier
        // does not cancel automatically on model deletion, so an orphaned subscription
        // would keep charging the customer's card after their account is gone. We cancel
        // anything that is not already terminally dead — this deliberately includes
        // past_due/incomplete subscriptions (which valid() would skip) because Stripe may
        // still be attempting to collect on those. If a cancellation fails, the exception
        // propagates and the account is NOT deleted, so the user can retry instead of
        // ending up with a live subscription and no account.
        $user->subscriptions()
            ->whereNotIn('stripe_status', ['canceled', 'incomplete_expired'])
            ->get()
            ->each->cancelNow();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
