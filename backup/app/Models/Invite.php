<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['code', 'label', 'max_uses', 'expires_at'])]
class Invite extends Model
{
    /**
     * The users who registered using this invite.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Whether the invite can still be used (uses left and not expired).
     */
    public function isUsable(): bool
    {
        if ($this->uses >= $this->max_uses) {
            return false;
        }

        return $this->expires_at === null || $this->expires_at->isFuture();
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }
}
