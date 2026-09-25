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
    /**
     * A kiállítási zár élettartama. Legalább a job timeoutja + a zár-várakozás legyen
     * (GenerateBillingoInvoice::TIMEOUT_SECONDS + LOCK_WAIT_SECONDS): így a zár nem járhat le,
     * amíg a tartója még legálisan futhat, és egy átfedő második futás nem állíthat ki második
     * NAV-számlát. A viszonyt teszt rögzíti (BillingoJobTimingTest).
     */
    public const LOCK_TTL_SECONDS = 120;

    /**
     * Ennyit vár a zárra egy második folyamat, mielőtt LockTimeoutException-nel feladja.
     */
    public const LOCK_WAIT_SECONDS = 10;

    public function __construct(
        private BillingoClient $client,
        private int $lockWaitSeconds = self::LOCK_WAIT_SECONDS,
    ) {}

    /**
     * Kiállítja (vagy idempotensen visszaadja) a Stripe számlához tartozó Billingo
     * számlát. A stripe_invoice_id unique kulcsra építve a többször kézbesített
     * webhook és az újrafutó job sem hoz létre második számlát.
     *
     * A vevő adatai a dispatch-kori pillanatképből (BillingProfile) jönnek, így a számla a
     * feldolgozásig törölt felhasználóra is kiállítható (NAV-kötelezettség). Kényelmi okból
     * User is átadható — abból itt azonnal pillanatkép készül.
     *
     * @param  array<string, mixed>  $stripeInvoice  a Stripe invoice objektum (webhook payload data.object)
     *
     * @throws LockTimeoutException ha a zár a várakozási időn belül sem szabadul fel — a hívó job-próbálkozás elbukik, és a queue backoff után újrapróbálja
     */
    public function generateForStripeInvoice(User|BillingProfile $customer, array $stripeInvoice): ?BillingoInvoice
    {
        $profile = $customer instanceof User ? BillingProfile::fromUser($customer) : $customer;
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
        $lock = Cache::lock("billingo:issue:{$stripeInvoiceId}", self::LOCK_TTL_SECONDS);

        // Rövid várakozással szerezzük meg: ha egy másik folyamat épp ezt a számlát
        // állítja ki, kivárjuk, és az idempotens ág már kiállítottként látja. Ha viszont
        // a zár nem szabadul fel (a tartóját hard-kill érte — OOM, deploy-restart —, és a
        // zár a TTL-ig beragadt), a LockTimeoutException buktatja a job-próbálkozást, így
        // a backoff utáni újrapróba a zár lejárta után befejezi a kiállítást. Csendes
        // kihagyás (return null) itt riasztás nélkül nyelné el a NAV-számlát: a queue a
        // retry_after után újra kiadja a hard-killelt jobot, és ha az a még élő zárba
        // ütközne, „sikerrel" zárulna — több próbálkozás nélkül.
        $lock->block($this->lockWaitSeconds);

        try {
            // Foglalás: a unique kulcs miatt egy fizetéshez egy sor. Ha már létezik és ki
            // van állítva, azonnal visszaadjuk — nincs felesleges Billingo-hívás. Ha létezik,
            // de még nincs dokumentuma (korábbi attempt a hívás előtt/közben elhasalt),
            // ugyanezen a soron folytatjuk, így a job-újrapróbálás befejezi a számlázást.
            // Törölt felhasználónál a user_id NULL (a FK nullOnDelete — ugyanaz az állapot,
            // amit a fiók-törlés a már meglévő számla-sorokon előidéz); a számla így is kiállul.
            $record = BillingoInvoice::firstOrCreate(
                ['stripe_invoice_id' => $stripeInvoiceId],
                ['user_id' => $this->existingUserId($profile)],
            );

            // Ki nem állított számlát most állítunk ki; a már kiállítottat (korábbi sikeres
            // attempt) nem hozzuk létre újra — de az e-mailes kézbesítés alább így is lefut,
            // ha az korábban nem sikerült.
            if (! $record->isIssued()) {
                $document = $this->issueDocument($record, $profile, $stripeInvoice, $stripeInvoiceId);

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
    private function issueDocument(BillingoInvoice $record, BillingProfile $profile, array $stripeInvoice, string $stripeInvoiceId): array
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
            $this->documentPayload($this->ensurePartner($profile), $stripeInvoice, $stripeInvoiceId),
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
     *
     * Ha a felhasználó még létezik, a mentett azonosítót frissen az adatbázisból olvassuk,
     * nem a pillanatképből: egy korábbi, a partner létrehozása után elbukott próbálkozás már
     * elmenthette, és a retry különben második partnert hozna létre. Törölt felhasználónál a
     * pillanatkép azonosítója az egyetlen forrás.
     */
    private function ensurePartner(BillingProfile $profile): int
    {
        $payload = $this->partnerPayload($profile);
        $savedPartnerId = User::query()->whereKey($profile->userId)->value('billingo_partner_id')
            ?? $profile->billingoPartnerId;

        // Meglévő partnernél nem hozunk létre újat (az duplikálná a vevőt), de a
        // számlázási adatok a settingsben azóta változhattak (cím/név/adószám) —
        // számlázáskor frissítjük, hogy a számla mindig a friss adatokkal menjen ki.
        if ($savedPartnerId !== null) {
            $partnerId = (int) $savedPartnerId;

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
                    'user_id' => $profile->userId,
                    'billingo_partner_id' => $partnerId,
                ]);
            }
        }

        $partnerId = $this->client->createPartner($payload);

        // Rendszer által kezelt, nem fillable mező — query-szintű update (nincs mass-assignment
        // szűrés). Törölt felhasználónál nincs sor, amit frissíteni kellene: 0 érintett sor.
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

        // Adószám és cégjegyzékszám csak cégnél kötelező/értelmes — magánszemélynél nem küldjük.
        if ($profile->billingType === 'company' && $profile->billingTaxNumber) {
            $payload['taxcode'] = $profile->billingTaxNumber;
        }

        if ($profile->billingType === 'company' && $profile->billingCompanyRegistrationNumber) {
            $payload['registration_number'] = $profile->billingCompanyRegistrationNumber;
        }

        return $payload;
    }

    /**
     * A pillanatkép felhasználójának azonosítója, ha még létezik — különben null.
     */
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
     * a Billingo első `invoice` típusú tömbjét kérjük le — teszt profilnál ez kényelmes.
     * Élesben/stagingen a boot-guard (AppServiceProvider) kötelezővé teszi a block_id-t.
     */
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
