<?php

namespace App\Services\Billingo;

use App\Models\BillingoInvoice;
use App\Models\User;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class InvoiceGenerator
{
    public const LOCK_TTL_SECONDS = 120;

    public const LOCK_WAIT_SECONDS = 10;

    public function __construct(
        private BillingoClient $client,
        private int $lockWaitSeconds = self::LOCK_WAIT_SECONDS,
    ) {}

    /**
     * @param  array<string, mixed>  $stripeInvoice
     */
    public function generateForStripeInvoice(User|BillingProfile $customer, array $stripeInvoice): ?BillingoInvoice
    {
        $profile = $customer instanceof User ? BillingProfile::fromUser($customer) : $customer;
        $stripeInvoiceId = $stripeInvoice['id'] ?? null;

        if (! is_string($stripeInvoiceId) || $stripeInvoiceId === '') {
            return null;
        }

        if ($this->grossMinor($stripeInvoice) <= 0) {
            return null;
        }

        $lock = Cache::lock("billingo:issue:{$stripeInvoiceId}", self::LOCK_TTL_SECONDS);

        $lock->block($this->lockWaitSeconds);

        try {
            $record = BillingoInvoice::firstOrCreate(
                ['stripe_invoice_id' => $stripeInvoiceId],
                ['user_id' => $this->existingUserId($profile)],
            );

            if (! $record->isIssued()) {
                $document = $this->issueDocument($record, $profile, $stripeInvoice, $stripeInvoiceId);

                $record->update([
                    'billingo_document_id' => $document['id'] ?? null,
                    'invoice_number' => $document['invoice_number'] ?? null,
                ]);
            }

            if ($record->isIssued() && $record->emailed_at === null) {
                $this->client->sendDocument((int) $record->billingo_document_id);

                try {
                    $record->update(['emailed_at' => Date::now()]);
                } catch (Throwable $e) {
                    $record->emailed_at = null;

                    Log::error('A számla-e-mail kiment, de az emailed_at jelölés mentése elhasalt — a sor kézbesítetlennek látszik, kézi ellenőrzés kell (egy újrafuttatás újraküldené a levelet).', [
                        'user_id' => $profile->userId,
                        'stripe_invoice_id' => $stripeInvoiceId,
                        'billingo_document_id' => $record->billingo_document_id,
                        'exception' => $e,
                    ]);
                }
            }

            return $record;
        } finally {
            $lock->release();
        }
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     * @return array<string, mixed>
     */
    private function issueDocument(BillingoInvoice $record, BillingProfile $profile, array $stripeInvoice, string $stripeInvoiceId): array
    {
        if ($record->issuing_started_at !== null) {
            $existing = $this->findIssuedDocument($stripeInvoiceId);

            if ($existing !== null) {
                return $existing;
            }
        }

        $record->update(['issuing_started_at' => Date::now()]);

        return $this->client->createDocument(
            $this->documentPayload($this->ensurePartner($profile), $stripeInvoice, $stripeInvoiceId),
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findIssuedDocument(string $stripeInvoiceId): ?array
    {
        foreach ($this->client->listDocuments($stripeInvoiceId) as $document) {
            if (($document['comment'] ?? null) === $this->comment($stripeInvoiceId)) {
                return $document;
            }
        }

        return null;
    }

    private function comment(string $stripeInvoiceId): string
    {
        return 'stripe_invoice_id:'.$stripeInvoiceId;
    }

    private function ensurePartner(BillingProfile $profile): int
    {
        $payload = $this->partnerPayload($profile);
        $savedPartnerId = User::query()->whereKey($profile->userId)->value('billingo_partner_id')
            ?? $profile->billingoPartnerId;

        if ($savedPartnerId !== null) {
            $partnerId = (int) $savedPartnerId;

            try {
                $this->client->updatePartner($partnerId, $payload);

                return $partnerId;
            } catch (RequestException $e) {
                if ($e->response->status() !== 404) {
                    throw $e;
                }

                Log::warning('A mentett Billingo partner nem létezik (404), újra létrehozzuk.', [
                    'user_id' => $profile->userId,
                    'billingo_partner_id' => $partnerId,
                ]);
            }
        }

        $partnerId = $this->client->createPartner($payload);

        User::query()->whereKey($profile->userId)->update(['billingo_partner_id' => $partnerId]);

        return $partnerId;
    }

    /**
     * @return array<string, mixed>
     */
    private function partnerPayload(BillingProfile $profile): array
    {
        $payload = [
            'name' => $profile->billingName ?: $profile->name,
            'address' => [
                'country_code' => $profile->billingCountry ?: 'HU',
                'post_code' => (string) $profile->billingZip,
                'city' => (string) $profile->billingCity,
                'address' => (string) $profile->billingAddress,
            ],
            'emails' => [$profile->email],
        ];

        if ($profile->billingPhone) {
            $payload['phone'] = $profile->billingPhone;
        }

        if ($profile->billingType === 'company' && $profile->billingTaxNumber) {
            $payload['taxcode'] = $profile->billingTaxNumber;
        }

        if ($profile->billingType === 'company' && $profile->billingCompanyRegistrationNumber) {
            $payload['registration_number'] = $profile->billingCompanyRegistrationNumber;
        }

        return $payload;
    }

    private function existingUserId(BillingProfile $profile): ?int
    {
        return User::query()->whereKey($profile->userId)->exists() ? $profile->userId : null;
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     * @return array<string, mixed>
     */
    private function documentPayload(int $partnerId, array $stripeInvoice, string $stripeInvoiceId): array
    {
        $grossMinor = $this->grossMinor($stripeInvoice);
        $currency = strtoupper((string) ($stripeInvoice['currency'] ?? 'EUR'));

        if (! in_array($currency, ['HUF', 'EUR'], true)) {
            throw new RuntimeException("Nem támogatott valuta a Billingo-számlázáshoz: {$currency}");
        }

        $paidAt = $this->paidAt($stripeInvoice);

        $payload = [
            'partner_id' => $partnerId,
            'block_id' => $this->blockId(),
            'type' => 'invoice',
            'fulfillment_date' => $paidAt,
            'due_date' => $paidAt,
            'payment_method' => 'online_bankcard',
            'language' => 'hu',
            'currency' => $currency,
            'electronic' => true,
            'paid' => true,
            'comment' => $this->comment($stripeInvoiceId),
            'items' => [[
                'name' => $this->itemName($stripeInvoice),
                'unit_price' => round($grossMinor / 100, 2),
                'unit_price_type' => 'gross',
                'quantity' => 1,
                'unit' => 'db',
                'vat' => (string) config('services.billingo.vat'),
            ]],
        ];

        if ($currency !== 'HUF') {
            $payload['conversion_rate'] = $this->client->exchangeRate($currency, 'HUF', $paidAt);
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     */
    private function grossMinor(array $stripeInvoice): int
    {
        return (int) ($stripeInvoice['amount_paid'] ?? $stripeInvoice['total'] ?? 0);
    }

    private function blockId(): int
    {
        $configured = (int) config('services.billingo.block_id');

        return $configured > 0 ? $configured : $this->client->firstInvoiceBlockId();
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     */
    private function itemName(array $stripeInvoice): string
    {
        $description = $stripeInvoice['lines']['data'][0]['description'] ?? null;

        return is_string($description) && $description !== ''
            ? $description
            : (string) config('services.billingo.item_name');
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     */
    private function paidAt(array $stripeInvoice): string
    {
        $timestamp = $stripeInvoice['status_transitions']['paid_at']
            ?? $stripeInvoice['created']
            ?? null;

        return ($timestamp ? Date::createFromTimestamp($timestamp) : Date::now())
            ->setTimezone('Europe/Budapest')
            ->format('Y-m-d');
    }
}
