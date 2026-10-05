<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Laravel\Cashier\Billable;
use Laravel\Cashier\Subscription;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\PersonalAccessToken;

#[Fillable(['name', 'email', 'password', 'streak', 'last_activity_date', 'quiz_completions', 'text_analyses', 'onboarding_completed_at', 'billing_name', 'billing_tax_number', 'billing_country', 'billing_zip', 'billing_city', 'billing_address', 'billing_phone', 'billing_company_registration_number', 'billing_type'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use Billable, HasApiTokens, HasFactory, Notifiable, TwoFactorAuthenticatable;

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

    public function flashcards(): HasManyThrough
    {
        return $this->hasManyThrough(Flashcard::class, FlashcardDeck::class, 'user_id', 'deck_id');
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
        return $this->belongsToMany(Word::class, 'user_word')->withPivot('status', 'importance')->withTimestamps();
    }

    public function achievements(): HasMany
    {
        return $this->hasMany(UserAchievement::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    public function billingoInvoices(): HasMany
    {
        return $this->hasMany(BillingoInvoice::class)->latest();
    }

    public function activeSubscription(): ?Subscription
    {
        $validSubscriptions = $this->subscriptions
            ->whereIn('type', ['premium', 'default'])
            ->filter(fn (Subscription $subscription): bool => $subscription->valid())
            ->sortBy([['created_at', 'asc'], ['id', 'asc']]);

        return $validSubscriptions->first(fn (Subscription $subscription): bool => $subscription->ends_at === null)
            ?? $validSubscriptions->first();
    }

    public function hasPastDueSubscription(): bool
    {
        return $this->subscriptions()
            ->where('stripe_status', 'past_due')
            ->whereNull('ends_at')
            ->exists();
    }

    public function subscriptionPlan(): ?string
    {
        return $this->activeSubscription() !== null ? 'premium' : null;
    }

    public function currentPlan(): string
    {
        if ($this->plan_override === 'premium') {
            return 'premium';
        }

        if ($this->lifetime_access) {
            return 'premium';
        }

        if ($this->subscriptionPlan() !== null) {
            return 'premium';
        }

        if ($this->onTrial()) {
            return 'premium';
        }

        return 'free';
    }

    public function hasActiveAccess(): bool
    {
        return $this->currentPlan() !== 'free';
    }

    public function hasAiAccess(): bool
    {
        return true;
    }

    public function isAdmin(): bool
    {
        $adminEmail = config('app.admin_email');

        return $adminEmail !== null
            && $this->email === $adminEmail
            && $this->hasVerifiedEmail();
    }

    public function aiMonthlyLimit(): ?int
    {
        if ($this->isAdmin()) {
            return null;
        }

        return $this->ai_credit_limit ?? (int) $this->planLimit('ai_budget_micros');
    }

    public function isOnFreePlan(): bool
    {
        return ! $this->hasActiveAccess();
    }

    public function isOnAnyTrial(): bool
    {
        return $this->onTrial() || ($this->activeSubscription()?->onTrial() ?? false);
    }

    public function currentTrialEndsAt(): ?CarbonInterface
    {
        if ($this->onTrial()) {
            return $this->trial_ends_at;
        }

        return $this->activeSubscription()?->trial_ends_at;
    }

    public function isEligibleForSubscriptionTrial(): bool
    {
        return ! $this->subscriptions()->exists();
    }

    public function hasBillingDetails(): bool
    {
        $hasCore = filled($this->billing_name)
            && filled($this->billing_country)
            && filled($this->billing_zip)
            && filled($this->billing_city)
            && filled($this->billing_address)
            && filled($this->billing_phone)
            && filled($this->billing_type);

        if (! $hasCore) {
            return false;
        }

        if ($this->billing_type !== 'company') {
            return true;
        }

        return filled($this->billing_tax_number) && filled($this->billing_company_registration_number);
    }

    public function planLimit(string $key): ?int
    {
        return config("plans.limits.{$this->currentPlan()}.{$key}");
    }

    public function isWithinPlanLimit(string $key, int $current, int $adding = 1): bool
    {
        $limit = $this->planLimit($key);

        return $limit === null || $current + $adding <= $limit;
    }

    public function canAddFlashcards(int $count = 1): bool
    {
        return $this->isWithinPlanLimit('flashcards', $this->flashcards()->count(), $count);
    }

    public function reserveFlashcardSlots(int $count, \Closure $insert): bool
    {
        if ($this->planLimit('flashcards') === null) {
            $insert();

            return true;
        }

        return (bool) Cache::lock("plan-limit:flashcards:{$this->id}", 15)
            ->block(10, function () use ($count, $insert): bool {
                if (! $this->canAddFlashcards($count)) {
                    return false;
                }

                $insert();

                return true;
            });
    }

    public function canAddFlashcardDeck(): bool
    {
        return $this->isWithinPlanLimit('decks', $this->flashcardDecks()->count());
    }

    /**
     * @param  \Closure(): FlashcardDeck  $create
     */
    public function reserveFlashcardDeckSlot(\Closure $create): ?FlashcardDeck
    {
        if ($this->planLimit('decks') === null) {
            return $create();
        }

        return Cache::lock("plan-limit:decks:{$this->id}", 15)
            ->block(10, function () use ($create): ?FlashcardDeck {
                if (! $this->canAddFlashcardDeck()) {
                    return null;
                }

                return $create();
            });
    }

    public function canWriteFromExtension(): bool
    {
        $limit = $this->planLimit('extension_writes_per_day');

        return $limit === null || $this->extensionWritesToday() < $limit;
    }

    public function extensionWritesToday(): int
    {
        return (int) Cache::get($this->extensionWriteCacheKey(), 0);
    }

    public function reserveExtensionWrite(): bool
    {
        $limit = $this->planLimit('extension_writes_per_day');

        if ($limit === null) {
            return true;
        }

        $key = $this->extensionWriteCacheKey();
        Cache::add($key, 0, now()->endOfDay());

        $count = Cache::increment($key);

        if ($count === false || $count > $limit) {
            Cache::decrement($key);

            return false;
        }

        return true;
    }

    public function refundExtensionWrite(): void
    {
        if ($this->planLimit('extension_writes_per_day') === null) {
            return;
        }

        $key = $this->extensionWriteCacheKey();

        $count = Cache::decrement($key);

        if ($count !== false && $count < 0) {
            Cache::put($key, 0, now()->endOfDay());
        }
    }

    private function extensionWriteCacheKey(): string
    {
        return "extension_writes_daily_{$this->id}_".today()->format('Y-m-d');
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

    public function revokePlayerTokens(): void
    {
        $this->tokens()
            ->get()
            ->filter(fn (PersonalAccessToken $token) => $token->abilities === ['player'])
            ->each(fn (PersonalAccessToken $token) => $token->delete());
    }

    public function deleteSessions(): void
    {
        DB::connection(config('session.connection'))
            ->table(config('session.table', 'sessions'))
            ->where('user_id', $this->getKey())
            ->delete();
    }

    public function currentStreak(): int
    {
        $lastActivity = $this->last_activity_date;

        if ($lastActivity?->isToday() || $lastActivity?->isYesterday()) {
            return $this->streak;
        }

        return 0;
    }

    /**
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
            'ai_access' => 'boolean',
            'ai_credits_reset_at' => 'datetime',
            'onboarding_completed_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
        ];
    }
}
