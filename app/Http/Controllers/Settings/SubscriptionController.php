<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\BillingoInvoice;
use App\Services\AiUsageService;
use App\Services\Billingo\BillingoClient;
use Illuminate\Http\Client\HttpClientException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Stripe\Exception\ApiErrorException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SubscriptionController extends Controller
{
    public function edit(Request $request, AiUsageService $aiUsage): Response
    {
        $user = $request->user();
        $activeSub = $user->activeSubscription();

        $paymentMethod = null;

        if ($user->hasStripeId() && $user->pm_last_four !== null) {
            $paymentMethod = [
                'brand' => $user->pm_type,
                'last_four' => $user->pm_last_four,
            ];
        }

        // Kiállított (dokumentum-azonosítóval rendelkező) NAV-számlák — a még csak
        // lefoglalt, de be nem fejezett sorok nem tölthetők le, ezért kimaradnak.
        $invoices = $user->billingoInvoices()
            ->whereNotNull('billingo_document_id')
            ->latest()
            ->get()
            ->map(fn (BillingoInvoice $invoice): array => [
                'id' => $invoice->id,
                'number' => $invoice->invoice_number,
                'date' => $invoice->created_at->toIso8601String(),
            ]);

        return Inertia::render('settings/subscription', [
            'invoices' => $invoices,
            'hasActiveAccess' => $user->hasActiveAccess(),
            'isSubscribed' => $activeSub !== null,
            'isPremium' => $user->subscriptionPlan() === 'premium',
            'hasAiAccess' => $user->hasAiAccess(),
            'isOnTrial' => $user->isOnAnyTrial(),
            'trialEndsAt' => $user->currentTrialEndsAt()?->toIso8601String(),
            'aiUsage' => $user->hasAiAccess() ? $aiUsage->snapshot($user) : null,
            'paymentMethod' => $paymentMethod,
            'subscription' => $activeSub ? [
                'stripe_status' => $activeSub->stripe_status,
                'ends_at' => $activeSub->ends_at?->toIso8601String(),
                'cancel_at_period_end' => $activeSub->onGracePeriod(),
                'type' => $user->subscriptionPlan() === 'premium' ? 'premium' : 'default',
            ] : null,
        ]);
    }

    /**
     * Letölti a felhasználó egy kiállított NAV-számlájának PDF-jét a Billingóról.
     * Idegen számlánál is 404-et adunk (nem 403-at), hogy a válaszkód ne áruljon el
     * infót arról, hogy az adott ID létezik-e — így ID-tippeléssel nem enumerálható.
     */
    public function downloadInvoice(Request $request, BillingoInvoice $invoice, BillingoClient $client): StreamedResponse
    {
        abort_unless($invoice->user_id === $request->user()->id, 404);
        abort_unless($invoice->isIssued(), 404);

        // A Billingo-hívás hibája (hálózati timeout/DNS vagy hibás HTTP-válasz, pl. törölt
        // dokumentum) ne 500-azzon nyers stack trace-szel — érthető üzenettel dobjunk 404-et.
        // A HttpClientException a RequestException (HTTP-hibaválasz) és a ConnectionException
        // (hálózati timeout) közös őse, így mindkettőt elkapjuk.
        try {
            $pdf = $client->downloadDocument((int) $invoice->billingo_document_id);
        } catch (HttpClientException $e) {
            report($e);

            abort(404, 'A számla most nem tölthető le. Kérlek próbáld újra kicsit később.');
        }

        $fileName = 'szamla-'.str_replace('/', '-', (string) ($invoice->invoice_number ?: $invoice->id)).'.pdf';

        return response()->streamDownload(
            fn () => print ($pdf),
            $fileName,
            ['Content-Type' => 'application/pdf'],
        );
    }

    public function cancel(Request $request): RedirectResponse
    {
        $subscription = $request->user()->activeSubscription();

        if ($subscription === null) {
            return back();
        }

        // Már lemondva (grace period) — ne adjunk hamis "sikeresen lemondva" visszajelzést.
        if ($subscription->onGracePeriod()) {
            return back()->with('info', 'Az előfizetésed már le van mondva, az időszak végéig aktív marad.');
        }

        // Stripe API-hívás — hibája ne 500-azzon, hanem érthető üzenettel térjen vissza.
        try {
            $subscription->cancel();
        } catch (ApiErrorException $e) {
            report($e);

            return back()->with('error', 'A lemondás most nem sikerült. Kérlek próbáld újra kicsit később.');
        }

        return back()->with('success', 'Előfizetésed lemondva. Az időszak végéig még hozzáférsz a funkciókhoz.');
    }

    public function resume(Request $request): RedirectResponse
    {
        $subscription = $request->user()->activeSubscription();

        if ($subscription !== null && $subscription->onGracePeriod()) {
            // Stripe API-hívás — hibája ne 500-azzon, hanem érthető üzenettel térjen vissza.
            try {
                $subscription->resume();
            } catch (ApiErrorException $e) {
                report($e);

                return back()->with('error', 'A visszavonás most nem sikerült. Kérlek próbáld újra kicsit később.');
            }

            return back()->with('success', 'Lemondás visszavonva, az előfizetésed aktív marad.');
        }

        return back()->with('info', 'Nincs visszavonható lemondás.');
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
            $portalUrl = $request->user()->billingPortalUrl(route('subscription.edit'));
        } catch (ApiErrorException $e) {
            report($e);

            return back()->with('error', 'A számlázási portál most nem érhető el. Kérlek próbáld újra kicsit később.');
        }

        // A Stripe portál külső URL — Inertia POST-nál Inertia::location kell,
        // különben a kliens nem navigál (sima redirectnél "nem történik semmi").
        return Inertia::location($portalUrl);
    }
}
