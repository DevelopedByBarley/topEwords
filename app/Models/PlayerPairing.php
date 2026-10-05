<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_code', 'poll_secret_hash', 'device_name', 'expires_at'])]
class PlayerPairing extends Model
{
    public const LIFETIME_MINUTES = 10;

    public const TOKEN_LIFETIME_DAYS = 90;

    protected function casts(): array
    {
        return [
            'approved_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isApproved(): bool
    {
        return $this->approved_at !== null && $this->user_id !== null;
    }
}
