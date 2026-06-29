<?php

namespace App\Services\Billingo;

use App\Models\BillingoInvoice;
use App\Models\User;
use Illuminate\Support\Facades\Date;

/**
 * Egy sikeresen kifizetett Stripe számlából NAV-kompatibilis Billingo számlát állít
 * ki. A felelőssége a leképezés (Stripe invoice + felhasználó számlázási adatai →
 * Billingo partner és dokumentum) és az idempotencia; a nyers HTTP-t a BillingoClient
 * végzi, így ez az osztály tesztben a klienst mockolva, hálózat nélkül ellenőrizhető.
 */
class InvoiceGenerator
{
    public function __construct(private BillingoClient $client) {}

    /**
     * Kiállítja (vagy idempotensen visszaadja) a Stripe számlához tartozó Billingo
     * számlát. A stripe_invoice_id unique kulcsra építve a többször kézbesített
     * webhook és az újrafutó job sem hoz létre második számlát.
     *
     * @param  array<string, mixed>  $stripeInvoice  a Stripe invoice objektum (webhook payload data.object)
     */
    public function generateForStripeInvoice(User $user, array $stripeInvoice): ?BillingoInvoice
    {
        $stripeInvoiceId = $stripeInvoice['id'] ?? null;

        if (! is_string($stripeInvoiceId) || $stripeInvoiceId === '') {
            return null;
        }

        // Foglalás: a unique kulcs miatt egy fizetéshez egy sor. Ha már létezik és ki
        // van állítva, azonnal visszaadjuk — nincs felesleges Billingo-hívás. Ha létezik,
        // de még nincs dokumentuma (korábbi attempt a hívás előtt/közben elhasalt),
        // ugyanezen a soron folytatjuk, így a job-újrapróbálás befejezi a számlázást.
        $record = BillingoInvoice::firstOrCreate(
            ['stripe_invoice_id' => $stripeInvoiceId],
            ['user_id' => $user->id],
        );

        if ($record->isIssued()) {
            return $record;
        }

        $document = $this->client->createDocument(
            $this->documentPayload($this->ensurePartner($user), $stripeInvoice),
        );

        $record->update([
            'billingo_document_id' => $document['id'] ?? null,
            'invoice_number' => $document['invoice_number'] ?? null,
        ]);

        return $record;
    }

    /**
     * A felhasználó Billingo partner-azonosítója: első alkalommal létrehozzuk a
     * számlázási adataiból és elmentjük, utána újrahasználjuk — így nem keletkezik
     * minden számlánál duplikált partner.
     */
    private function ensurePartner(User $user): int
    {
        if ($user->billingo_partner_id !== null) {
            return (int) $user->billingo_partner_id;
        }

        $partnerId = $this->client->createPartner($this->partnerPayload($user));

        // Rendszer által kezelt, nem fillable mező — szándékosan forceFill.
        $user->forceFill(['billingo_partner_id' => $partnerId])->save();

        return $partnerId;
    }

    /**
     * @return array<string, mixed>
     */
    private function partnerPayload(User $user): array
    {
        $payload = [
            'name' => $user->billing_name ?: $user->name,
            'address' => [
                'country_code' => $user->billing_country ?: 'HU',
                'post_code' => (string) $user->billing_zip,
                'city' => (string) $user->billing_city,
                'address' => (string) $user->billing_address,
            ],
            'emails' => [$user->email],
        ];

        // Adószám csak cégnél kötelező/értelmes — magánszemélynél nem küldjük.
        if ($user->billing_type === 'company' && $user->billing_tax_number) {
            $payload['taxcode'] = $user->billing_tax_number;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     * @return array<string, mixed>
     */
    private function documentPayload(int $partnerId, array $stripeInvoice): array
    {
        // A ténylegesen kifizetett bruttó összeg a hiteles forrás (kisebb egységben,
        // pl. centben), nem az appbeli ár — így kedvezmény/arányosítás is pontos.
        $grossMinor = (int) ($stripeInvoice['amount_paid'] ?? $stripeInvoice['total'] ?? 0);
        $currency = strtoupper((string) ($stripeInvoice['currency'] ?? 'EUR'));

        // A fizetés dátuma a teljesítési dátum; a számla azonnal kifizetett.
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
            'items' => [[
                'name' => $this->itemName($stripeInvoice),
                'unit_price' => round($grossMinor / 100, 2),
                'unit_price_type' => 'gross',
                'quantity' => 1,
                'unit' => 'db',
                'vat' => (string) config('services.billingo.vat'),
            ]],
        ];

        // Devizás számlánál (a Billingo-fiók alappénzneme HUF) a conversion_rate KÖTELEZŐ —
        // a Billingo nem konvertál automatikusan, enélkül 422-vel elutasít. A teljesítés
        // napi MNB-árfolyamot a Billingo saját végpontjáról kérjük, így a NAV-nak megfelelő
        // HUF-érték kerül a számlára. HUF-számlánál nincs átváltás, a mező elhagyható.
        if ($currency !== 'HUF') {
            $payload['conversion_rate'] = $this->client->exchangeRate($currency, 'HUF', $paidAt);
        }

        return $payload;
    }

    /**
     * A használandó számlatömb. Konfigban megadott id-t használjuk; ha nincs (0),
     * a Billingo első elérhető tömbjét kérjük le — teszt profilnál ez kényelmes.
     */
    private function blockId(): int
    {
        $configured = (int) config('services.billingo.block_id');

        return $configured > 0 ? $configured : $this->client->firstDocumentBlockId();
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
     * A teljesítés napja (Y-m-d) a Stripe fizetés időpontjából.
     *
     * @param  array<string, mixed>  $stripeInvoice
     */
    private function paidAt(array $stripeInvoice): string
    {
        $timestamp = $stripeInvoice['status_transitions']['paid_at']
            ?? $stripeInvoice['created']
            ?? null;

        return ($timestamp ? Date::createFromTimestamp($timestamp) : Date::now())->format('Y-m-d');
    }
}
