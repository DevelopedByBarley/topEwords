<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillingoInvoice extends Model
{
    protected $fillable = [
        'user_id',
        'stripe_invoice_id',
        'billingo_document_id',
        'invoice_number',
        'issuing_started_at',
        'emailed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'billingo_document_id' => 'integer',
            'issuing_started_at' => 'datetime',
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

    public function isIssued(): bool
    {
        return $this->billingo_document_id !== null;
    }
}
