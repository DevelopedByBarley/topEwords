<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\Billingo\BillingProfile;
use App\Services\Billingo\InvoiceGenerator;
use Illuminate\Contracts\Database\ModelIdentifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Aszinkron állítja ki a sikeres Stripe fizetéshez tartozó Billingo számlát. A
 * webhook szándékosan nem szinkronban számláz: ha a Billingo lassú vagy hibázik, a
 * Stripe nem kapna 200-at és újraküldené az eseményt. A tényleges idempotenciát az
 * InvoiceGenerator adja (stripe_invoice_id unique kulcs), így az újrapróbálás biztonságos.
 *
 * A job NEM a User modellt szerializálja, hanem a dispatch-kori számlázási pillanatképet
 * (BillingProfile): ha a felhasználó a feldolgozásig törlődik, a modell-újratöltés
 * ModelNotFoundException-t dobna még a job példányosítása előtt — a failed() nem futna le,
 * a NAV-számla pedig némán kiállítatlan maradna (F2-L3).
 */
class GenerateBillingoInvoice implements ShouldQueue
{
    use Queueable {
        __unserialize as restoreSerializedProperties;
    }

    /**
     * A job futásidejének felső korlátja másodpercben. Kisebb kell legyen, mint a kiállítási
     * zár TTL-je mínusz a zár-várakozás (InvoiceGenerator::LOCK_TTL_SECONDS − LOCK_WAIT_SECONDS),
     * és kisebb, mint a queue-kapcsolatok retry_after értéke — különben egy még futó példány
     * mellé a queue egy második példányt adhatna ki, amely a lejárt zár után második NAV-számlát
     * állíthatna ki. A viszonyt a BillingoJobTimingTest rögzíti.
     */
    public const TIMEOUT_SECONDS = 100;

    public int $timeout = self::TIMEOUT_SECONDS;

    /**
     * Timeoutnál a job ne bukjon el véglegesen: a lassú Billingo átmeneti hiba, a következő
     * próbálkozás (a crash-védett visszakereséssel) befejezi a kiállítást.
     */
    public bool $failOnTimeout = false;

    /**
     * Növekvő várakozású újrapróbálkozások — a Billingo átmeneti hibáját (5xx, rate
     * limit) kivárjuk, mielőtt a job véglegesen elbukik és a failed_jobs-ba kerül.
     *
     * @var array<int, int>
     */
    public array $backoff = [60, 300, 900];

    public int $tries = 4;

    /**
     * A vevő számlázási adatainak dispatch-kori pillanatképe. Csak a legacy (User modellt
     * szerializáló) payloadból visszaállított, időközben törölt felhasználónál null.
     */
    public ?BillingProfile $billing;

    /**
     * A számlázott felhasználó azonosítója — a failed() kontextusához akkor is megvan, ha a
     * pillanatkép nem állítható vissza.
     */
    public int $userId;

    /**
     * @param  User|BillingProfile  $customer  a vevő — User esetén a dispatch pillanatában pillanatkép készül belőle
     * @param  array<string, mixed>  $stripeInvoice  a Stripe invoice szűkített mezőhalmaza (lásd onlyNeededFields)
     */
    public function __construct(
        User|BillingProfile $customer,
        public array $stripeInvoice,
    ) {
        $this->billing = $customer instanceof User ? BillingProfile::fromUser($customer) : $customer;
        $this->userId = $this->billing->userId;
    }

    /**
     * A teljes Stripe invoice payload ügyfél-PII-t (customer_email/name/address) is tartalmaz,
     * amiből az InvoiceGenerator semmit sem használ (a partner-adatok a BillingProfile-ból jönnek). A
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
        if ($this->billing === null) {
            // Legacy payload, a felhasználó közben törlődött: számlázási adat nélkül nem állítható
            // ki a számla. Hangosan bukunk (retry → failed()), hogy a kézi pótlás kontextussal induljon.
            throw new RuntimeException(
                "GenerateBillingoInvoice: a user #{$this->userId} törlődött, a legacy job számlázási adatai nem állíthatók vissza (stripe invoice {$this->stripeInvoiceId()}) — kézi kiállítás kell!"
            );
        }

        $generator->generateForStripeInvoice($this->billing, $this->stripeInvoice);
    }

    /**
     * Minden próbálkozás kimerült: a számla véglegesen kiállítatlan maradt. NAV-kötelezettség
     * miatt ez nem maradhat észrevétlen — naplózzuk (Sentry/log), hogy kereshető és riasztható
     * legyen. Aszinkron (queue) módban a failed_jobs mellett ez adja a látható nyomot; szinkron
     * (dispatchSync) módban a kivétel amúgy is a webhook-válaszon és a logon keresztül felszínre kerül.
     */
    public function failed(?Throwable $exception): void
    {
        Log::critical('GenerateBillingoInvoice véglegesen elbukott — a NAV-számla kiállítatlan, kézi pótlás kell!', [
            'user_id' => $this->userId,
            'user_exists' => User::query()->whereKey($this->userId)->exists(),
            'stripe_invoice_id' => $this->stripeInvoiceId(),
            'exception' => $exception?->getMessage(),
        ]);

        report($exception ?? new RuntimeException(
            "GenerateBillingoInvoice véglegesen elbukott (user #{$this->userId}, stripe invoice {$this->stripeInvoiceId()})."
        ));
    }

    /**
     * Visszafelé kompatibilis deszerializálás: a korábbi verzió a User modellt szerializálta
     * (`user` kulcs, ModelIdentifier). Az ilyen, még a queue-ban várakozó jobokat nem a
     * SerializesModels modell-újratöltésére bízzuk (törölt usernél az dobna, és a failed() sem
     * futna), hanem itt, saját kezűleg képezünk belőlük pillanatképet.
     *
     * @param  array<string, mixed>  $values
     */
    public function __unserialize(array $values): void
    {
        $legacyUser = $values['user'] ?? null;
        unset($values['user']);

        $this->restoreSerializedProperties($values);

        if ($legacyUser instanceof ModelIdentifier && ! array_key_exists('billing', $values)) {
            $user = User::query()->find($legacyUser->id);

            $this->userId = (int) $legacyUser->id;
            $this->billing = $user instanceof User ? BillingProfile::fromUser($user) : null;
        }
    }

    private function stripeInvoiceId(): string
    {
        $invoiceId = $this->stripeInvoice['id'] ?? null;

        return is_string($invoiceId) && $invoiceId !== '' ? $invoiceId : 'unknown';
    }
}
