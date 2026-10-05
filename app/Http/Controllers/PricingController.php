<?php

namespace App\Http\Controllers;

use App\Support\Billing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Cashier\Exceptions\IncompletePayment;
use Stripe\Exception\ApiErrorException;

class PricingController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if ($request->query('checkout') === 'cancelled') {
            return redirect()->route('pricing')->with('info', 'A fizetést megszakítottad – nem történt levonás. Bármikor visszatérhetsz.');
        }

        $trialDays = ($user?->isEligibleForSubscriptionTrial() ?? true)
            ? (int) config('registration.subscription_trial_days')
            : 0;

        return Inertia::render('pricing', [
            'hasActiveAccess' => $user?->hasActiveAccess() ?? false,
            'isOnTrial' => $user?->isOnAnyTrial() ?? false,
            'trialEndsAt' => $user?->currentTrialEndsAt()?->toIso8601String(),
            'isSubscribed' => $user?->activeSubscription() !== null,
            'stripeConfigured' => Billing::enabled(),
            'trialDays' => $trialDays,
        ]);
    }

    public function checkout(Request $request, string $plan): RedirectResponse|\Illuminate\Http\Response
    {
        abort_unless(Billing::enabled(), 404);
        abort_unless($plan === 'premium', 404);

        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        $subscription = $user->activeSubscription();

        if ($subscription !== null && $subscription->onGracePeriod()) {
            return redirect()->route('subscription.edit')->with('info', 'Az előfizetésed le van mondva, de a periódus végéig még aktív. A folytatáshoz vond vissza a lemondást — nem indul új terhelés.');
        }

        if ($subscription === null && ($user->plan_override === 'premium' || $user->lifetime_access)) {
            return redirect()->route('pricing')->with('info', 'Már aktív hozzáférésed van, nincs szükség fizetésre.');
        }

        if ($subscription === null && $user->hasPastDueSubscription()) {
            return redirect()->route('subscription.edit')->with('info', 'A meglévő előfizetésed sikertelen terhelés miatt szünetel. Új előfizetés helyett frissítsd a kártyaadataidat — sikeres terhelés után a hozzáférésed magától visszaáll.');
        }

        if (! $user->hasBillingDetails()) {
            return redirect()->route('billing.edit')->with('info', 'Kérlek add meg a számlázási adataidat a fizetés előtt.');
        }

        $request->validate(['accept_terms' => ['accepted']]);

        $user->forceFill(['terms_accepted_at' => now()])->save();

        $priceId = config('services.stripe.premium_price_id');

        if ($subscription !== null) {
            if ($subscription->stripe_price === $priceId) {
                return redirect()->route('pricing')->with('info', 'Már ez az aktív csomagod.');
            }

            try {
                $subscription->swap($priceId);
            } catch (IncompletePayment) {
                return redirect()->route('pricing')->with('error', 'A csomagváltáshoz banki megerősítés szükséges. Kérlek fejezd be a fizetést a számlázási portálon.');
            } catch (ApiErrorException $e) {
                report($e);

                return redirect()->route('pricing')->with('error', 'A csomagváltás most nem sikerült. Kérlek próbáld újra kicsit később.');
            }

            return redirect()->route('pricing')->with('success', 'Sikeres váltás Pro csomagra! Az összes funkció elérhető.');
        }

        $successUrl = URL::temporarySignedRoute('pricing.success', now()->addHours(25));

        $subscriptionBuilder = $user->newSubscription('premium', $priceId);

        $trialDays = (int) config('registration.subscription_trial_days');

        $trialEndsAt = $trialDays > 0 && $user->isEligibleForSubscriptionTrial()
            ? now()->addDays($trialDays)
            : null;

        if ($user->onGenericTrial() && $user->trial_ends_at->gt($trialEndsAt ?? now())) {
            $trialEndsAt = $user->trial_ends_at;
        }

        if ($trialEndsAt !== null) {
            $subscriptionBuilder->trialUntil($trialEndsAt);
        }

        try {
            $checkout = $subscriptionBuilder->checkout([
                'success_url' => $successUrl,
                'cancel_url' => route('pricing', ['checkout' => 'cancelled']),
            ]);
        } catch (ApiErrorException $e) {
            report($e);

            return redirect()->route('pricing')->with('error', 'A fizetés indítása most nem sikerült. Kérlek próbáld újra kicsit később.');
        }

        return Inertia::location($checkout->url);
    }

    public function success(Request $request): RedirectResponse
    {
        if (! $request->hasValidSignature()) {
            return redirect()->route('pricing')->with('info', 'Ez a link már lejárt. Ha a fizetésed sikeres volt, az előfizetésed aktív – az állapotát ezen az oldalon látod.');
        }

        if ($request->user()?->activeSubscription() === null) {
            return redirect()->route('pricing')->with('info', 'Köszönjük a fizetést! Az előfizetésed feldolgozás alatt – pár pillanat múlva aktívvá válik. Frissítsd az oldalt, ha még nem látod.');
        }

        return redirect()->route('pricing')->with('success', 'Sikeres fizetés! Köszönjük az előfizetést – a funkciók azonnal elérhetők.');
    }

    public function portal(Request $request): RedirectResponse|\Illuminate\Http\Response
    {
        if (! $request->user()->hasStripeId()) {
            return redirect()->route('pricing');
        }

        try {
            $portalUrl = $request->user()->billingPortalUrl(route('pricing'));
        } catch (ApiErrorException $e) {
            report($e);

            return redirect()->route('pricing')->with('error', 'A számlázási portál most nem érhető el. Kérlek próbáld újra kicsit később.');
        }

        return Inertia::location($portalUrl);
    }
}
