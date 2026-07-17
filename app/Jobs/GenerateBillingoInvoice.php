<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Billingo\InvoiceGenerator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Aszinkron állítja ki a sikeres Stripe fizetéshez tartozó Billingo számlát. A
 * webhook szándékosan nem szinkronban számláz: ha a Billingo lassú vagy hibázik, a
 * Stripe nem kapna 200-at és újraküldené az eseményt. A tényleges idempotenciát az
 * InvoiceGenerator adja (stripe_invoice_id unique kulcs), így az újrapróbálás biztonságos.
 */
class GenerateBillingoInvoice implements ShouldQueue
{
    use Queueable;

    /**
     * Növekvő várakozású újrapróbálkozások — a Billingo átmeneti hibáját (5xx, rate
     * limit) kivárjuk, mielőtt a job véglegesen elbukik és a failed_jobs-ba kerül.
     *
     * @var array<int, int>
     */
    public array $backoff = [60, 300, 900];

    public int $tries = 4;

    /**
     * @param  array<string, mixed>  $stripeInvoice  a Stripe invoice szűkített mezőhalmaza (lásd onlyNeededFields)
     */
    public function __construct(
        public User $user,
        public array $stripeInvoice,
    ) {}

    /**
     * A teljes Stripe invoice payload ügyfél-PII-t (customer_email/name/address) is tartalmaz,
     * amiből az InvoiceGenerator semmit sem használ (a partner-adatok a User-ből jönnek). A
     * teljes objektum szerializálva a `jobs`/`failed_jobs` táblában maradna — végleges bukásnál
     * korlátlanul —, fölöslegesen szélesítve a backup/log-shipping PII-felületet. Ezért a
     * dispatch előtt csak a generator által ténylegesen olvasott mezőket tartjuk meg.
     *
     * @param  array<string, mixed>  $stripeInvoice
     * @return array<string, mixed>
     */
    public static function onlyNeededFields(array $stripeInvoice): array
    {
        return [
            'id' => $stripeInvoice['id'] ?? null,
            'currency' => $stripeInvoice['currency'] ?? null,
            'amount_paid' => $stripeInvoice['amount_paid'] ?? null,
            'total' => $stripeInvoice['total'] ?? null,
            'created' => $stripeInvoice['created'] ?? null,
            'lines' => [
                'data' => [
                    ['description' => $stripeInvoice['lines']['data'][0]['description'] ?? null],
                ],
            ],
            'status_transitions' => [
                'paid_at' => $stripeInvoice['status_transitions']['paid_at'] ?? null,
            ],
        ];
    }

    public function handle(InvoiceGenerator $generator): void
    {
        $generator->generateForStripeInvoice($this->user, $this->stripeInvoice);
    }

    /**
     * Minden próbálkozás kimerült: a számla véglegesen kiállítatlan maradt. NAV-kötelezettség
     * miatt ez nem maradhat észrevétlen — naplózzuk (Sentry/log), hogy kereshető és riasztható
     * legyen. Aszinkron (queue) módban a failed_jobs mellett ez adja a látható nyomot; szinkron
     * (dispatchSync) módban a kivétel amúgy is a webhook-válaszon és a logon keresztül felszínre kerül.
     */
    public function failed(?\Throwable $exception): void
    {
        $invoiceId = $this->stripeInvoice['id'] ?? 'unknown';

        report($exception ?? new \RuntimeException(
            "GenerateBillingoInvoice véglegesen elbukott (user #{$this->user->id}, stripe invoice {$invoiceId})."
        ));
    }
}
