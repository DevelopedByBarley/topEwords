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

class GenerateBillingoInvoice implements ShouldQueue
{
    use Queueable {
        __unserialize as restoreSerializedProperties;
    }

    public const TIMEOUT_SECONDS = 100;

    public int $timeout = self::TIMEOUT_SECONDS;

    public bool $failOnTimeout = false;

    /**
     * @var array<int, int>
     */
    public array $backoff = [60, 300, 900];

    public int $tries = 4;

    public ?BillingProfile $billing;

    public int $userId;

    /**
     * @param  array<string, mixed>  $stripeInvoice
     */
    public function __construct(
        User|BillingProfile $customer,
        public array $stripeInvoice,
    ) {
        $this->billing = $customer instanceof User ? BillingProfile::fromUser($customer) : $customer;
        $this->userId = $this->billing->userId;
    }

    /**
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
            throw new RuntimeException(
                "GenerateBillingoInvoice: a user #{$this->userId} törlődött, a legacy job számlázási adatai nem állíthatók vissza (stripe invoice {$this->stripeInvoiceId()}) — kézi kiállítás kell!"
            );
        }

        $generator->generateForStripeInvoice($this->billing, $this->stripeInvoice);
    }

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
