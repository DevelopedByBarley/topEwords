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
use Laravel\Cashier\Subscription;
use Laravel\Fortify\TwoFactorAuthenticatable;

// Entitlement/billing columns (lifetime_access, ai_access, plan_override, trial_ends_at,
// invite_id, stripe_*, ai_credit*, terms_accepted_at, billingo_partner_id) are intentionally NOT fillable — they are
// set explicitly server-side (admin actions, registration via forceFill, Cashier, checkout) so no
// request payload can grant itself paid access or forge consent via mass assignment.
#[Fillable(['name', 'email', 'password', 'streak', 'last_activity_date', 'quiz_completions', 'text_analyses', 'onboarding_completed_at', 'billing_name', 'billing_tax_number', 'billing_country', 'billing_zip', 'billing_city', 'billing_address', 'billing_type'])]
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
        return $this->belongsToMany(Word::class, 'user_word')->withPivot('status', 'importance')->withTimestamps();
    }

    public function achievements(): HasMany
    {
        return $this->hasMany(UserAchievement::class);
    }

    public function billingoInvoices(): HasMany
    {
        return $this->hasMany(BillingoInvoice::class)->latest();
    }

    /**
     * The user's active Stripe subscription, regardless of its type name.
     */
    public function activeSubscription(): ?Subscription
    {
        foreach (['premium', 'default'] as $type) {
            $subscription = $this->subscription($type);

            if ($subscription && $subscription->valid()) {
                return $subscription;
            }
        }

        return null;
    }

    /**
     * The paid plan from Stripe ('basic' | 'premium'), or null without subscription.
     *
     * A csomagot az előfizetés ára dönti el (nem a típusneve), így a
     * csomagváltás (swap) után is helyes marad.
     */
    public function subscriptionPlan(): ?string
    {
        $subscription = $this->activeSubscription();

        if ($subscription === null) {
            return null;
        }

        return $subscription->stripe_price === config('services.stripe.premium_price_id')
            ? 'premium'
            : 'basic';
    }

    /**
     * The user's effective plan: 'free' | 'basic' | 'premium'.
     *
     * Priority: admin override > lifetime access > Stripe subscription > trial.
     */
    public function currentPlan(): string
    {
        if (in_array($this->plan_override, ['basic', 'premium'], true)) {
            return $this->plan_override;
        }

        if ($this->lifetime_access) {
            return 'premium';
        }

        if ($plan = $this->subscriptionPlan()) {
            return $plan;
        }

        if ($this->onTrial()) {
            return 'basic';
        }

        return 'free';
    }

    public function hasActiveAccess(): bool
    {
        return $this->currentPlan() !== 'free';
    }

    public function hasAiAccess(): bool
    {
        return $this->ai_access
            || $this->currentPlan() === 'premium';
    }

    public function isAdmin(): bool
    {
        $adminEmail = config('app.admin_email');

        return $adminEmail !== null && $this->email === $adminEmail;
    }

    /**
     * The user's monthly AI cost budget in micro-dollars (1e6 = $1).
     * `null` means unlimited (admins).
     */
    public function aiMonthlyLimit(): ?int
    {
        if ($this->isAdmin()) {
            return null;
        }

        return $this->ai_credit_limit ?? (int) config('services.gemini.monthly_budget_micros');
    }

    public function isOnFreePlan(): bool
    {
        return ! $this->hasActiveAccess();
    }

    public function hasBillingDetails(): bool
    {
        return filled($this->billing_name)
            && filled($this->billing_zip)
            && filled($this->billing_city)
            && filled($this->billing_address);
    }

    public const FREE_FLASHCARD_LIMIT = 20;

    /**
     * Whether the user may add $count more cards to the deck under their plan.
     */
    public function canAddFlashcardsTo(FlashcardDeck $deck, int $count = 1): bool
    {
        return ! $this->isOnFreePlan()
            || $deck->flashcards()->count() + $count <= self::FREE_FLASHCARD_LIMIT;
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
            'ai_access' => 'boolean',
            'ai_credits_reset_at' => 'datetime',
            'onboarding_completed_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
        ];
    }
}
