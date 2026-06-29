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
     */
    public function exchangeRate(string $from, string $to, ?string $date = null): float
    {
        return (float) $this->request()
            ->get('/currencies', array_filter([
                'from' => $from,
                'to' => $to,
                'date' => $date,
            ]))
            ->throw()
            ->json('conversation_rate');
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl(self::BASE_URL)
            ->withHeaders(['X-API-KEY' => $this->apiKey])
            ->acceptJson()
            ->asJson();
    }
}
