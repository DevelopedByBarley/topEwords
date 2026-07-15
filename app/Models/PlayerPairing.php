<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Egy folyamatban lévő eszköz-párosítás a desktop lejátszóhoz.
 * A poll_secret-nek csak a SHA-256 hash-e kerül az adatbázisba; a nyers
 * titkot kizárólag a lejátszó ismeri, és a token-beváltáskor mutatja fel.
 */
#[Fillable(['user_code', 'poll_secret_hash', 'device_name', 'expires_at'])]
class PlayerPairing extends Model
{
    /** A párosítási kérelem érvényessége percben. */
    public const LIFETIME_MINUTES = 10;

    /**
     * A kiadott player-token élettartama napban. Rövidebb, mint a korábbi 1 év:
     * egy lopott/kiszivárgott token így magától lejár, és a felhasználó a
     * Beállítások → Összekötött eszközök alatt is bármikor visszavonhatja.
     */
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
