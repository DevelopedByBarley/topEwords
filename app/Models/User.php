<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Cashier\Billable;
use Laravel\Fortify\TwoFactorAuthenticatable;

#[Fillable(['name', 'email', 'password', 'streak', 'last_activity_date', 'quiz_completions', 'text_analyses', 'lifetime_access'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use Billable, HasFactory, Notifiable, TwoFactorAuthenticatable;

    public function folders(): HasMany
    {
        return $this->hasMany(Folder::class)->orderBy('name');
    }

    public function flashcardSettings(): HasOne
    {
        return $this->hasOne(FlashcardSetting::class);
    }

    public function flashcardDecks(): HasMany
    {
        return $this->hasMany(FlashcardDeck::class);
    }

    public function flashcardFolders(): HasMany
    {
        return $this->hasMany(FlashcardFolder::class)->orderBy('name');
    }

    public function customWords(): HasMany
    {
        return $this->hasMany(UserCustomWord::class)->orderBy('word');
    }

    public function knownWords(): BelongsToMany
    {
        return $this->belongsToMany(Word::class, 'user_word')->withPivot('status')->withTimestamps();
    }

    public function achievements(): HasMany
    {
        return $this->hasMany(UserAchievement::class);
    }

    public function hasActiveAccess(): bool
    {
        // Payment temporarily disabled — everyone has access
        return true;
        // return $this->lifetime_access
        //     || $this->onTrial()
        //     || $this->subscribed('default');
    }

    public function isOnFreePlan(): bool
    {
        // Payment temporarily disabled
        return false;
        // return ! $this->hasActiveAccess();
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
            'trial_ends_at' => 'datetime',
            'lifetime_access' => 'boolean',
        ];
    }
}
