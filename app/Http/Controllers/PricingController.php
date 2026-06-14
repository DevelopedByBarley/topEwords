<?php

namespace App\Http\Controllers;

use App\Support\Billing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Cashier\Exceptions\IncompletePayment;

class PricingController extends Controller
{
    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        // A Stripe Checkout megszakításakor ide tér vissza (?checkout=cancelled).
        // Átirányítunk, hogy a flash üzenet kijusson (a share() a controller
        // előtt fut, így az azonos kérésen belüli flash nem látszana) és a
        // query paraméter is eltűnjön az URL-ből.
        if ($request->query('checkout') === 'cancelled') {
            return redirect()->route('pricing')->with('info', 'A fizetést megszakítottad – nem történt levonás. Bármikor visszatérhetsz.');
        }

        return Inertia::render('pricing', [
            'hasActiveAccess' => $user?->hasActiveAccess() ?? false,
            'isOnTrial' => $user?->onTrial() ?? false,
            'trialEndsAt' => $user?->trial_ends_at?->toIso8601String(),
            'isSubscribed' => $user?->activeSubscription() !== null,
            'isPremium' => $user?->subscriptionPlan() === 'premium',
            'hasAiAccess' => $user?->hasAiAccess() ?? false,
            'stripeConfigured' => Billing::enabled(),
        ]);
    }

    public function checkout(Request $request, string $plan): RedirectResponse|\Illuminate\Http\Response
    {
        abort_unless(Billing::enabled(), 404);
        abort_unless(in_array($plan, ['basic', 'premium'], true), 404);

        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        $priceId = $plan === 'premium'
            ? config('services.stripe.premium_price_id')
            : config('services.stripe.basic_price_id');

        // Meglévő előfizetésnél nem új előfizetést indítunk (dupla számlázás!),
        // hanem a meglévőt váltjuk át a másik csomag árára.
        $subscription = $user->activeSubscription();

        if ($subscription !== null) {
            if ($user->subscriptionPlan() === $plan) {
                return redirect()->route('pricing')->with('info', 'Már ez az aktív csomagod.');
            }

            try {
                $subscription->swap($priceId);
            } catch (IncompletePayment) {
                // SCA/3DS megerősítés szükséges — a számlázási portálon zárható le
                return redirect()->route('pricing')->with('error', 'A csomagváltáshoz banki megerősítés szükséges. Kérlek fejezd be a fizetést a számlázási portálon.');
            }

            $message = $plan === 'premium'
                ? 'Sikeres váltás Prémium csomagra! Az AI funkciók mostantól elérhetők.'
                : 'Sikeres váltás Alap csomagra.';

            return redirect()->route('pricing')->with('success', $message);
        }

        $successUrl = URL::temporarySignedRoute('pricing.success', now()->addMinutes(10));

        $checkout = $user->newSubscription($plan === 'premium' ? 'premium' : 'default', $priceId)
            ->checkout([
                'success_url' => $successUrl,
                'cancel_url' => route('pricing', ['checkout' => 'cancelled']),
            ]);

        return Inertia::location($checkout->url);
    }

    public function success(Request $request): RedirectResponse
    {
        return redirect()->route('pricing')->with('success', 'Sikeres fizetés! Köszönjük az előfizetést – a funkciók azonnal elérhetők.');
    }

    public function portal(Request $request): RedirectResponse
    {
        // Stripe ügyfél nélkül a portál hívása kivételt dobna
        if (! $request->user()->hasStripeId()) {
            return redirect()->route('pricing');
        }

        return $request->user()->redirectToBillingPortal(route('pricing'));
    }
}
