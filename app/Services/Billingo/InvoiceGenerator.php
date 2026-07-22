<?php

namespace App\Services\Billingo;

use App\Models\BillingoInvoice;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

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
                $document = $this->issueDocument($record, $user, $stripeInvoice, $stripeInvoiceId);

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

                // A küldés (visszavonhatatlan mellékhatás) UTÁNI jelölés-hiba nem szállhat
                // fel: a job elbukna, a queue-retry pedig emailed_at===null-t látva
                // MÁSODSZOR is kiküldené ugyanazt a levelet. Ezért a hibát helyben tartjuk
                // riasztó error-loggal (AlertAdminOfLoggedError e-mailez), és a job
                // sikeresen zárul — nincs retry, nincs dupla levél; a jelöletlen sort az
                // admin rendezi. A fordított sorrendet (jelölés a küldés ELŐTT) elvetettük:
                // az a dupla levél helyett némán ELVESZŐ levelet kockáztatna (crash a
                // jelölés után, a küldés előtt → minden későbbi futás kézbesítettnek
                // hinné). A send és a jelölés közti hard-kill ablak elvi maradvány (külső
                // hívás + DB nem tehető atomivá) — az legfeljebb dupla levél, sosem elvesző.
                try {
                    $record->update(['emailed_at' => Date::now()]);
                } catch (Throwable $e) {
                    // Az update() fill-je már beírta a memóriába — a visszaadott modell a
                    // DB-igazságot (jelöletlen) mutassa.
                    $record->emailed_at = null;

                    Log::error('A számla-e-mail kiment, de az emailed_at jelölés mentése elhasalt — a sor kézbesítetlennek látszik, kézi ellenőrzés kell (egy újrafuttatás újraküldené a levelet).', [
                        'user_id' => $user->id,
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
     * Kiállítja a Billingo dokumentumot crash-védelemmel. A Billingo v3-nak nincs
     * idempotency-key headere, és a NAV-számla a createDocument sikeres válaszakor MÁR ki
     * van adva — ha a worker a válasz és a helyi billingo_document_id mentése közti ablakban
     * meghal (OOM, deploy-restart), a retry isIssued()===false-t látna, és MÁSODIK számlát
     * állítana ki új sorszámmal (kézi sztornó). Ezért:
     *
     *   1. a createDocument ELŐTT perzisztáljuk az issuing_started_at jelzőt;
     *   2. ha a retry azt találja, hogy a jelző már be van állítva (egy korábbi attempt épp
     *      ebben az ablakban halhatott meg), előbb Billingo-oldalon visszakeressük a Stripe
     *      invoice-id-ra kiadott dokumentumot — ha megvan, azt vesszük át, új kiállítás nélkül.
     *
     * Az ablak így nem tűnik el teljesen (idempotency-key híján nem is lehet), csak a lehető
     * legszűkebbre szorul: kettős kiállítás csak akkor keletkezhet, ha a crash pont a
     * Billingo-válasz kézhezvétele ELŐTT történik ÉS a dokumentum mégis kiadódott — ilyenkor a
     * visszakeresés úgyis megtalálja.
     *
     * @param  array<string, mixed>  $stripeInvoice
     * @return array<string, mixed>
     */
    private function issueDocument(BillingoInvoice $record, User $user, array $stripeInvoice, string $stripeInvoiceId): array
    {
        // Egy korábbi, félbeszakadt attempt már megkezdte a kiállítást — előbb nézzük meg,
        // hogy a NAV-számla valójában kiadódott-e a Billingóban, mielőtt újat állítanánk ki.
        if ($record->issuing_started_at !== null) {
            $existing = $this->findIssuedDocument($stripeInvoiceId);

            if ($existing !== null) {
                return $existing;
            }
        }

        // A createDocument ELŐTT jelöljük, hogy a kiállítás megkezdődött. Így egy pont ezután
        // bekövetkező crash utáni retry a fenti visszakeresési ágra fut, nem állít ki vakon másodikat.
        $record->update(['issuing_started_at' => Date::now()]);

        return $this->client->createDocument(
            $this->documentPayload($this->ensurePartner($user), $stripeInvoice, $stripeInvoiceId),
        );
    }

    /**
     * Visszakeresi a Stripe invoice-id-hoz már kiadott Billingo dokumentumot, ha van. A
     * dokumentum comment mezőjébe a kiálláskor beírjuk a Stripe invoice-id-t, így az egyedi
     * horgony, amire a Billingo szabadszavas keresése ráilleszthető. Több találatnál (elvben
     * nem fordulhat elő) a comment pontos egyezését is ellenőrizzük, hogy részleges egyezés
     * ne adjon vissza idegen számlát.
     *
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

    /**
     * A dokumentum comment mezőjébe írt, a Stripe fizetéshez rendelt egyedi horgony, amire a
     * crash-utáni visszakeresés (findIssuedDocument) illeszt.
     */
    private function comment(string $stripeInvoiceId): string
    {
        return 'stripe_invoice_id:'.$stripeInvoiceId;
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

        if ($user->billing_phone) {
            $payload['phone'] = $user->billing_phone;
        }

        // Adószám és cégjegyzékszám csak cégnél kötelező/értelmes — magánszemélynél nem küldjük.
        if ($user->billing_type === 'company' && $user->billing_tax_number) {
            $payload['taxcode'] = $user->billing_tax_number;
        }

        if ($user->billing_type === 'company' && $user->billing_company_registration_number) {
            $payload['registration_number'] = $user->billing_company_registration_number;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $stripeInvoice
     * @return array<string, mixed>
     */
    private function documentPayload(int $partnerId, array $stripeInvoice, string $stripeInvoiceId): array
    {
        // A ténylegesen kifizetett bruttó összeg a hiteles forrás (kisebb egységben,
        // pl. centben), nem az appbeli ár — így kedvezmény/arányosítás is pontos.
        $grossMinor = $this->grossMinor($stripeInvoice);
        $currency = strtoupper((string) ($stripeInvoice['currency'] ?? 'EUR'));

        // A lenti round($grossMinor / 100) két tizedesjegyes valutát feltételez — a
        // Stripe a HUF-ot és az EUR-t így kezeli, de egy zero-decimal valuta (pl. JPY)
        // 1/100-ad összegű NAV-számlát kapna. Inkább bukjon hangosan a job (riasztással),
        // mint hogy rossz összegű számla szülessen.
        if (! in_array($currency, ['HUF', 'EUR'], true)) {
            throw new RuntimeException("Nem támogatott valuta a Billingo-számlázáshoz: {$currency}");
        }

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
            // A Stripe invoice-id horgonyként a comment mezőben — a crash-utáni helyreállítás
            // (findIssuedDocument) erre keres rá, hogy ne állítson ki második NAV-számlát.
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
     * A teljesítés napja (Y-m-d) a Stripe fizetés időpontjából, magyar
     * (Europe/Budapest) naptári nap szerint — a NAV-számla teljesítési dátuma és a
     * hozzá tartozó MNB-árfolyam-nap is ehhez igazodik. A Stripe UTC-timestampje
     * éjfél körül (pl. budapesti 00:30-as terhelésnél) egy nappal korábbi dátumot
     * adna.
     *
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
