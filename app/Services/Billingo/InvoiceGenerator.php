<?php

namespace App\Services\Billingo;

use App\Models\BillingoInvoice;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Log;

/**
 * Egy sikeresen kifizetett Stripe számlából NAV-kompatibilis Billingo számlát állít
 * ki. A felelőssége a leképezés (Stripe invoice + felhasználó számlázási adatai →
 * Billingo partner és dokumentum) és az idempotencia; a nyers HTTP-t a BillingoClient
 * végzi, így ez az osztály tesztben a klienst mockolva, hálózat nélkül ellenőrizhető.
 */
class InvoiceGenerator
{
    public function __construct(
        private BillingoClient $client,
        private int $lockWaitSeconds = 10,
    ) {}

    /**
     * Kiállítja (vagy idempotensen visszaadja) a Stripe számlához tartozó Billingo
     * számlát. A stripe_invoice_id unique kulcsra építve a többször kézbesített
     * webhook és az újrafutó job sem hoz létre második számlát.
     *
     * @param  array<string, mixed>  $stripeInvoice  a Stripe invoice objektum (webhook payload data.object)
     *
     * @throws LockTimeoutException ha a zár a várakozási időn belül sem szabadul fel — a hívó job-próbálkozás elbukik, és a queue backoff után újrapróbálja
     */
    public function generateForStripeInvoice(User $user, array $stripeInvoice): ?BillingoInvoice
    {
        $stripeInvoiceId = $stripeInvoice['id'] ?? null;

        if (! is_string($stripeInvoiceId) || $stripeInvoiceId === '') {
            return null;
        }

        // A trial-induló (subscription_create) és a teljesen kedvezményezett előfizetésekre
        // a Stripe 0 összegű invoice-ról is invoice.payment_succeeded-et küld. NAV-számlát
        // ilyenkor nem állítunk ki, és nyilvántartó sort sem hozunk létre — csak tényleges,
        // pozitív összegű terhelésről születik számla.
        if ($this->grossMinor($stripeInvoice) <= 0) {
            return null;
        }

        // Atomi zár egy fizetésre: a unique kulcs csak a duplikált SORT előzi meg, a
        // Billingo createDocument-hívást nem. Ha a Stripe a lassú feldolgozás közben
        // újraküldi az eseményt (vagy két worker párhuzamosan fut), két folyamat is
        // láthatná isIssued()===false-nak, és MINDKETTŐ kiállítana egy NAV-számlát. A zár
        // garantálja, hogy egy fizetéshez egyszerre csak egy folyamat számlázzon.
        $lock = Cache::lock("billingo:issue:{$stripeInvoiceId}", 120);

        // Rövid várakozással szerezzük meg: ha egy másik folyamat épp ezt a számlát
        // állítja ki, kivárjuk, és az idempotens ág már kiállítottként látja. Ha viszont
        // a zár nem szabadul fel (a tartóját hard-kill érte — OOM, deploy-restart —, és a
        // zár a TTL-ig beragadt), a LockTimeoutException buktatja a job-próbálkozást, így
        // a backoff utáni újrapróba a zár lejárta után befejezi a kiállítást. Csendes
        // kihagyás (return null) itt riasztás nélkül nyelné el a NAV-számlát: a database
        // queue már 90 mp után újra kiadja a hard-killelt jobot, az a még élő 120 mp-es
        // zárba ütközne, és „sikerrel" zárulna — több próbálkozás nélkül.
        $lock->block($this->lockWaitSeconds);

        try {
            // Foglalás: a unique kulcs miatt egy fizetéshez egy sor. Ha már létezik és ki
            // van állítva, azonnal visszaadjuk — nincs felesleges Billingo-hívás. Ha létezik,
            // de még nincs dokumentuma (korábbi attempt a hívás előtt/közben elhasalt),
            // ugyanezen a soron folytatjuk, így a job-újrapróbálás befejezi a számlázást.
            $record = BillingoInvoice::firstOrCreate(
                ['stripe_invoice_id' => $stripeInvoiceId],
                ['user_id' => $user->id],
            );

            // Ki nem állított számlát most állítunk ki; a már kiállítottat (korábbi sikeres
            // attempt) nem hozzuk létre újra — de az e-mailes kézbesítés alább így is lefut,
            // ha az korábban nem sikerült.
            if (! $record->isIssued()) {
                $document = $this->client->createDocument(
                    $this->documentPayload($this->ensurePartner($user), $stripeInvoice),
                );

                $record->update([
                    'billingo_document_id' => $document['id'] ?? null,
                    'invoice_number' => $document['invoice_number'] ?? null,
                ]);
            }

            // A Billingo a dokumentum létrehozásakor NEM küld e-mailt — a kiállított számlát
            // külön végponton küldjük el a partnernek. Csak egyszer (emailed_at): a
            // job-újrapróba nem küldi ki kétszer, de egy kiállított, mégis kézbesítetlen
            // számla egy későbbi futáson utólag is kimegy.
            if ($record->isIssued() && $record->emailed_at === null) {
                $this->client->sendDocument((int) $record->billingo_document_id);
                $record->update(['emailed_at' => Date::now()]);
            }

            return $record;
        } finally {
            $lock->release();
        }
    }

    /**
     * A felhasználó Billingo partner-azonosítója: első alkalommal létrehozzuk a
     * számlázási adataiból és elmentjük, utána újrahasználjuk — így nem keletkezik
     * minden számlánál duplikált partner.
     */
    private function ensurePartner(User $user): int
    {
        $payload = $this->partnerPayload($user);

        // Meglévő partnernél nem hozunk létre újat (az duplikálná a vevőt), de a
        // számlázási adatok a settingsben azóta változhattak (cím/név/adószám) —
        // számlázáskor frissítjük, hogy a számla mindig a friss adatokkal menjen ki.
        if ($user->billingo_partner_id !== null) {
            $partnerId = (int) $user->billingo_partner_id;

            try {
                $this->client->updatePartner($partnerId, $payload);

                return $partnerId;
            } catch (RequestException $e) {
                if ($e->response->status() !== 404) {
                    throw $e;
                }

                // A partnert időközben törölték a Billingo-fiókból — a mentett azonosító
                // örökre halott, minden újrapróba ugyanígy bukna, és a felhasználó
                // számlázása kézi beavatkozásig állna. Eldobjuk, és alább újra létrehozzuk.
                Log::warning('A mentett Billingo partner nem létezik (404), újra létrehozzuk.', [
                    'user_id' => $user->id,
                    'billingo_partner_id' => $partnerId,
                ]);
            }
        }

        $partnerId = $this->client->createPartner($payload);

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
        $grossMinor = $this->grossMinor($stripeInvoice);
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
     * A ténylegesen kifizetett bruttó összeg a legkisebb pénznemegységben (pl. cent).
     * A kifizetett összeg a hiteles forrás; ennek híján a számla teljes összege.
     *
     * @param  array<string, mixed>  $stripeInvoice
     */
    private function grossMinor(array $stripeInvoice): int
    {
        return (int) ($stripeInvoice['amount_paid'] ?? $stripeInvoice['total'] ?? 0);
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
