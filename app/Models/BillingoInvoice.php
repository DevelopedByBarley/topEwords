<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy Stripe fizetéshez kiállított Billingo számla helyi nyilvántartása. A
 * stripe_invoice_id unique kulcs adja az idempotenciát: egy fizetéshez pontosan
 * egy sor, így a többször kézbesített webhook és az újrafutó job sem duplikál.
 */
class BillingoInvoice extends Model
{
    protected $fillable = [
        'user_id',
        'stripe_invoice_id',
        'billingo_document_id',
        'invoice_number',
        'emailed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'billingo_document_id' => 'integer',
            'emailed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * A Billingo számla már sikeresen ki van állítva (van dokumentum-azonosítója),
     * szemben a még csak lefoglalt, de be nem fejezett sorral.
     */
    public function isIssued(): bool
    {
        return $this->billingo_document_id !== null;
    }
}
