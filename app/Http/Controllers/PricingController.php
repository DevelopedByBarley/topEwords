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

        // A Stripe Checkout megszakításakor ide tér vissza (?checkout=cancelled).
        // Átirányítunk, hogy a flash üzenet kijusson (a share() a controller
        // előtt fut, így az azonos kérésen belüli flash nem látszana) és a
        // query paraméter is eltűnjön az URL-ből.
        if ($request->query('checkout') === 'cancelled') {
            return redirect()->route('pricing')->with('info', 'A fizetést megszakítottad – nem történt levonás. Bármikor visszatérhetsz.');
        }

        // A trial csak az első előfizetéshez jár — a visszatérő (korábban már
        // előfizetett) felhasználónak 0-t adunk, hogy a UI ne hirdessen olyan
        // próbaidőt, amit a checkout már nem adna meg.
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
        // Egyetlen fizetős csomag van (Pro = 'premium'); minden más 404.
        abort_unless($plan === 'premium', 404);

        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        if (! $user->hasBillingDetails()) {
            return redirect()->route('billing.edit')->with('info', 'Kérlek add meg a számlázási adataidat a fizetés előtt.');
        }

        // Akinek admin-adta (plan_override) vagy élethosszig tartó (lifetime_access) hozzáférése
        // van, annak nincs Stripe-előfizetése — a swap-ág ezért nem fogná meg, és fölöslegesen
        // indítana fizetős előfizetést azért, amit már ingyen megkap. Szerveroldalon elzárjuk.
        if ($user->activeSubscription() === null && $user->hasActiveAccess()) {
            return redirect()->route('pricing')->with('info', 'Már aktív hozzáférésed van, nincs szükség fizetésre.');
        }

        // A 14 napos elállási jogról való lemondás kifejezett hozzájárulása kötelező, és
        // szerveroldalon is kikényszerítjük — a kliensoldali pipa közvetlen POST-tal megkerülhető.
        $request->validate(['accept_terms' => ['accepted']]);

        // Naplózható nyomot hagyunk a hozzájárulásról (terms_accepted_at nem fillable).
        $user->forceFill(['terms_accepted_at' => now()])->save();

        $priceId = config('services.stripe.premium_price_id');

        // Meglévő előfizetésnél nem új előfizetést indítunk (dupla számlázás!),
        // hanem a meglévőt átváltjuk a Pro árra (pl. régi Standard-árú előfizetés).
        $subscription = $user->activeSubscription();

        if ($subscription !== null) {
            if ($subscription->stripe_price === $priceId) {
                return redirect()->route('pricing')->with('info', 'Már ez az aktív csomagod.');
            }

            try {
                $subscription->swap($priceId);
            } catch (IncompletePayment) {
                // SCA/3DS megerősítés szükséges — a számlázási portálon zárható le
                return redirect()->route('pricing')->with('error', 'A csomagváltáshoz banki megerősítés szükséges. Kérlek fejezd be a fizetést a számlázási portálon.');
            } catch (ApiErrorException $e) {
                // A Stripe oldali hiba (pl. törölt ár, hálózati hiba) ne dőljön 500-ba a
                // felhasználónak — naplózzuk, és érthető üzenettel térünk vissza.
                report($e);

                return redirect()->route('pricing')->with('error', 'A csomagváltás most nem sikerült. Kérlek próbáld újra kicsit később.');
            }

            return redirect()->route('pricing')->with('success', 'Sikeres váltás Pro csomagra! Az összes funkció elérhető.');
        }

        // 25 óra: a Stripe Checkout session 24 óráig él, a lassan fizető user is
        // érvényes aláírással érkezzen vissza — rövidebb lejáratnál a sikeres
        // fizetés UTÁN kapna hibát a visszairányításkor.
        $successUrl = URL::temporarySignedRoute('pricing.success', now()->addHours(25));

        $subscriptionBuilder = $user->newSubscription('premium', $priceId);

        // Első előfizetéskor próbaidő: a kártyát elkérik, de csak a trial végén
        // számláznak. A trial alatt a felhasználó a választott fizetett csomagot kapja.
        // Csak az első előfizetéshez jár (isEligibleForSubscriptionTrial) — különben
        // lemondás + újra-előfizetés ismételgetésével korlátlan ingyen Pro szerezhető.
        $trialDays = (int) config('registration.subscription_trial_days');

        if ($trialDays > 0 && $user->isEligibleForSubscriptionTrial()) {
            // A Stripe Checkout minimum 48 óra (2 nap) próbaidőt enged — kisebb beállított
            // értéket felkerekítünk, különben a Checkout session létrehozása hibára futna.
            $subscriptionBuilder->trialDays(max(2, $trialDays));
        }

        // A Cashier előbb létrehozza (és elmenti) a Stripe-ügyfelet, majd nyitja a Checkout
        // sessiont. Ha utóbbi Stripe-hiba miatt elhasal (pl. törölt ár), a kezeletlen kivétel
        // 500-at adna és árva ügyfelet hagyna. Elkapjuk, naplózzuk, és érthető üzenettel
        // küldjük vissza a felhasználót — a következő próbálkozás az elmentett stripe_id-t
        // használja újra, így nem szaporodnak az árva ügyfelek.
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
        // Az aláírást itt ellenőrizzük a `signed` middleware helyett: lejárt/hibás
        // aláírásnál a nyers 403-as hibaoldal helyett — ami közvetlenül egy SIKERES
        // fizetés után fogadná a felhasználót — kecsesen a pricing oldalra irányítunk,
        // ahol az (időközben webhookon létrejött) előfizetés állapota amúgy is látszik.
        if (! $request->hasValidSignature()) {
            return redirect()->route('pricing')->with('info', 'Ez a link már lejárt. Ha a fizetésed sikeres volt, az előfizetésed aktív – az állapotát ezen az oldalon látod.');
        }

        // Az előfizetést a Stripe webhook (checkout.session.completed) hozza létre, ami a
        // visszairányításhoz képest pár másodperc késéssel futhat le. Ha még nincs aktív
        // előfizetés, "feldolgozás alatt" üzenetet adunk a megtévesztő "azonnal elérhető" helyett.
        if ($request->user()?->activeSubscription() === null) {
            return redirect()->route('pricing')->with('info', 'Köszönjük a fizetést! Az előfizetésed feldolgozás alatt – pár pillanat múlva aktívvá válik. Frissítsd az oldalt, ha még nem látod.');
        }

        return redirect()->route('pricing')->with('success', 'Sikeres fizetés! Köszönjük az előfizetést – a funkciók azonnal elérhetők.');
    }

    public function portal(Request $request): RedirectResponse|\Illuminate\Http\Response
    {
        // Stripe ügyfél nélkül a portál hívása kivételt dobna
        if (! $request->user()->hasStripeId()) {
            return redirect()->route('pricing');
        }

        // A portál-URL kérése Stripe API-hívás — hibája (pl. a Customer Portal nincs
        // live módban konfigurálva) ne 500-azzon, hanem érthető üzenettel térjen vissza.
        try {
            $portalUrl = $request->user()->billingPortalUrl(route('pricing'));
        } catch (ApiErrorException $e) {
            report($e);

            return redirect()->route('pricing')->with('error', 'A számlázási portál most nem érhető el. Kérlek próbáld újra kicsit később.');
        }

        // A Stripe portál külső URL — Inertia POST-nál Inertia::location kell,
        // különben a kliens nem navigál (sima redirectnél "nem történik semmi").
        return Inertia::location($portalUrl);
    }
}
