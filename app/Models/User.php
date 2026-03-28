<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\TwoFactorAuthenticatable;

#[Fillable(['name', 'email', 'password', 'streak', 'last_activity_date'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class)->orderBy('name');
    }

    public function knownWords(): BelongsToMany
    {
        return $this->belongsToMany(Word::class, 'user_word')->withPivot('status')->withTimestamps();
    }

    public function updateStreak(): bool
    {
        $today = Carbon::today();
        $lastActivity = $this->last_activity_date;

        if ($lastActivity?->isToday()) {
            return false;
        }

        $this->streak = $lastActivity?->isYesterday() ? $this->streak + 1 : 1;
        $this->last_activity_date = $today;
        $this->save();

        return true;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'last_activity_date' => 'date',
        ];
    }
}
