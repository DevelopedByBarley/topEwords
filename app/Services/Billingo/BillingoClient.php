<?php

namespace App\Services\Billingo;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Vékony HTTP kliens a Billingo v3 REST API-hoz. Szándékosan nem egy generált SDK:
 * mindössze néhány végpont kell (partner, dokumentum, számlatömb), így a natív
 * Laravel HTTP kliens átláthatóbb, függőség nélküli és tesztben Http::fake()-kel
 * triviálisan mockolható. Üzleti logika nincs benne — azt az InvoiceGenerator adja.
 */
class BillingoClient
{
    private const BASE_URL = 'https://api.billingo.hu/v3';

    public function __construct(private string $apiKey) {}

    /**
     * Létrehoz egy partnert (vevőt), és visszaadja a Billingo partner-azonosítóját.
     *
     * @param  array<string, mixed>  $payload
     */
    public function createPartner(array $payload): int
    {
        return (int) $this->request()
            ->post('/partners', $payload)
            ->throw()
            ->json('id');
    }

    /**
     * Frissíti egy meglévő partner (vevő) adatait. A felhasználó a számlázási adatait
     * (név/cím/adószám) később módosíthatja; a számlázáskor ezzel szinkronizáljuk, hogy
     * a számla a friss adatokkal menjen ki — új partner létrehozása (duplikáció) nélkül.
     *
     * @param  array<string, mixed>  $payload
     */
    public function updatePartner(int $id, array $payload): void
    {
        $this->request()
            ->put("/partners/{$id}", $payload)
            ->throw();
    }

    /**
     * Kiállít egy dokumentumot (számlát), és visszaadja a teljes Billingo választ.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createDocument(array $payload): array
    {
        return $this->request()
            ->post('/documents', $payload)
            ->throw()
            ->json();
    }

    /**
     * Rákeres a már kiállított dokumentumokra egy szabadszavas kifejezéssel, és visszaadja
     * a találatok `data` tömbjét. A crash-utáni helyreállításnál használjuk: ha egy attempt
     * a createDocument sikeres válasza UTÁN, de a helyi dokumentum-id mentése ELŐTT hal meg,
     * a retry innen kérdezi vissza, hogy a NAV-számla valójában kiadódott-e — így nem áll ki
     * másodikat. A keresés a dokumentum comment mezőjében tárolt Stripe invoice-id-ra megy.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listDocuments(string $query): array
    {
        return $this->request()
            ->get('/documents', ['query' => $query])
            ->throw()
            ->json('data') ?? [];
    }

    /**
     * Elküldi a kiállított dokumentumot (számlát) a partnernek e-mailben. A Billingo a
     * /documents létrehozáskor NEM küld e-mailt — ez külön, explicit hívás. Üres törzzsel
     * a partneren tárolt e-mail címekre megy ki. Idempotens kézbesítést a hívó biztosít
     * (emailed_at), hogy az újrapróba ne küldje ki kétszer.
     */
    public function sendDocument(int $id): void
    {
        $this->request()
            ->post("/documents/{$id}/send")
            ->throw();
    }

    /**
     * Letölti a kiállított dokumentum (számla) PDF-jét, és visszaadja a nyers bináris
     * tartalmat. A Billingo a /documents/{id}/download végponton application/pdf-et ad
     * vissza (nem JSON) — a felhasználó a settingsben innen tölti le a saját számláit.
     */
    public function downloadDocument(int $id): string
    {
        return $this->request()
            ->get("/documents/{$id}/download")
            ->throw()
            ->body();
    }

    /**
     * Az első elérhető számlatömb azonosítója. Akkor használjuk, ha a konfigban nincs
     * explicit block_id megadva — teszt profilnál így nem kell kézzel kikeresni.
     */
    public function firstDocumentBlockId(): int
    {
        return (int) $this->request()
            ->get('/document-blocks')
            ->throw()
            ->json('data.0.id');
    }

    /**
     * Árfolyam: 1 egység $from hány $to az adott napon (üres dátumnál a mai). Devizás
     * (nem a Billingo-fiók alappénznemében kiállított) számlánál a Billingo kötelezően
     * kéri a conversion_rate-et, és nem konvertál magától — ezért a teljesítés napi
     * MNB-árfolyamot innen kérjük le. A válasz mezőneve a Billingónál `conversation_rate`.
     *
     * @throws \RuntimeException ha a válaszból hiányzik vagy nem pozitív az árfolyam —
     *                           0.0 továbbengedése érthetetlen Billingo 422-t okozna a számlán.
     */
    public function exchangeRate(string $from, string $to, ?string $date = null): float
    {
        $rate = (float) $this->request()
            ->get('/currencies', array_filter([
                'from' => $from,
                'to' => $to,
                'date' => $date,
            ]))
            ->throw()
            ->json('conversation_rate');

        if ($rate <= 0) {
            throw new \RuntimeException(
                "A Billingo nem adott érvényes {$from}→{$to} árfolyamot (kapott érték: {$rate})."
            );
        }

        return $rate;
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl(self::BASE_URL)
            ->withHeaders(['X-API-KEY' => $this->apiKey])
            ->acceptJson()
            ->asJson();
    }
}
