<?php

namespace App\Services\Billingo;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class BillingoClient
{
    private const BASE_URL = 'https://api.billingo.hu/v3';

    private const CONNECT_TIMEOUT_SECONDS = 10;

    private const REQUEST_TIMEOUT_SECONDS = 30;

    public function __construct(private string $apiKey) {}

    /**
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
     * @param  array<string, mixed>  $payload
     */
    public function updatePartner(int $id, array $payload): void
    {
        $this->request()
            ->put("/partners/{$id}", $payload)
            ->throw();
    }

    /**
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
     * @return array<int, array<string, mixed>>
     */
    public function listDocuments(string $query): array
    {
        return $this->request()
            ->get('/documents', ['query' => $query])
            ->throw()
            ->json('data') ?? [];
    }

    public function sendDocument(int $id): void
    {
        $this->request()
            ->post("/documents/{$id}/send")
            ->throw();
    }

    public function downloadDocument(int $id): string
    {
        return $this->request()
            ->get("/documents/{$id}/download")
            ->throw()
            ->body();
    }

    public function firstInvoiceBlockId(): int
    {
        $blocks = $this->request()
            ->get('/document-blocks', ['per_page' => 100])
            ->throw()
            ->json('data') ?? [];

        $invoiceBlock = collect($blocks)
            ->first(fn (mixed $block): bool => is_array($block)
                && ($block['type'] ?? null) === 'invoice'
                && (int) ($block['id'] ?? 0) > 0);

        $invoiceBlockId = (int) ($invoiceBlock['id'] ?? 0);

        if ($invoiceBlockId <= 0) {
            throw new \RuntimeException(
                'A Billingo-fiókban nincs "invoice" típusú számlatömb, ezért a számla nem '
                .'állítható ki automatikusan választott tömbbe. Állítsd be a BILLINGO_BLOCK_ID-t.'
            );
        }

        return $invoiceBlockId;
    }

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
            ->connectTimeout(self::CONNECT_TIMEOUT_SECONDS)
            ->timeout(self::REQUEST_TIMEOUT_SECONDS)
            ->acceptJson()
            ->asJson();
    }
}
