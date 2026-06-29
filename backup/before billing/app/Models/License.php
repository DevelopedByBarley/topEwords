<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class License extends Model
{
    protected $fillable = ['key', 'client_name', 'active', 'expires_at'];

    protected $casts = [
        'active'     => 'boolean',
        'expires_at' => 'datetime',
    ];

    public static function generateKey(): string
    {
        return Str::upper(Str::random(8) . '-' . Str::random(8) . '-' . Str::random(8));
    }

    public function isActive(): bool
    {
        return $this->active
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
