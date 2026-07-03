<?php

namespace App\Models;

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
use Laravel\Cashier\Billable;
use Laravel\Cashier\Subscription;
use Laravel\Fortify\TwoFactorAuthenticatable;

// Entitlement/billing columns (lifetime_access, ai_access, plan_override, trial_ends_at,
// invite_id, stripe_*, ai_credit*, terms_accepted_at, billingo_partner_id) are intentionally NOT fillable — they are
// set explicitly server-side (admin actions, registration via forceFill, Cashier, checkout) so no
// request payload can grant itself paid access or forge consent via mass assignment.
#[Fillable(['name', 'email', 'password', 'streak', 'last_activity_date', 'quiz_completions', 'text_analyses', 'onboarding_completed_at', 'billing_name', 'billing_tax_number', 'billing_country', 'billing_zip', 'billing_city', 'billing_address', 'billing_type'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
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

    /**
     * Minden kártya a felhasználó összes paklijából — az ingyenes összesített
     * kártyakeret számolásához (paklitól függetlenül).
     */
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
     * The paid plan tier, or null without a subscription. Egyetlen fizetős
     * csomag van (Pro), így minden aktív előfizetés = 'premium', függetlenül a
     * típusnévtől és az ártól (a régi Standard-árú előfizetés is Pro-t kap).
     */
    public function subscriptionPlan(): ?string
    {
        return $this->activeSubscription() !== null ? 'premium' : null;
    }

    /**
     * The user's effective plan: 'free' | 'premium'.
     *
     * Priority: admin override > lifetime access > Stripe subscription > trial.
     */
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

    /**
     * AI minden csomagon elérhető — a Free is kap kóstolót. A valódi korlát a
     * havi költségkeret (aiMonthlyLimit): a Free kicsi, a Pro nagyobb keretet
     * kap, és az AiUsageService ezt tartatja be. Ezért ez mindig igaz.
     */
    public function hasAiAccess(): bool
    {
        return true;
    }

    public function isAdmin(): bool
    {
        $adminEmail = config('app.admin_email');

        return $adminEmail !== null && $this->email === $adminEmail;
    }

    /**
     * The user's monthly AI cost budget in micro-dollars (1e6 = $1). Csomag
     * szerint (config/plans.php: ai_budget_micros) — a Free kis kóstolót, a Pro
     * a teljes keretet kapja. Per-user felülírás: ai_credit_limit. `null` =
     * korlátlan (admin).
     */
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

    /**
     * A próbaidő csak az első előfizetéshez jár. A Cashier előfizetés-rekord a
     * lemondás után is megmarad, így a megléte jelzi a korábbi előfizetést —
     * lemondás + újra-előfizetés ismételgetésével ezért nem szerezhető
     * korlátlan ingyenes próbaidő.
     */
    public function isEligibleForSubscriptionTrial(): bool
    {
        return ! $this->subscriptions()->exists();
    }

    public function hasBillingDetails(): bool
    {
        return filled($this->billing_name)
            && filled($this->billing_zip)
            && filled($this->billing_city)
            && filled($this->billing_address);
    }

    /**
     * The plan's numeric limit for a feature from config/plans.php, keyed by the
     * user's current plan. `null` means unlimited. currentPlan() only ever returns
     * free|premium, so the key is guaranteed to exist (a test guards config
     * completeness), which keeps this fail-closed against typo'd keys.
     */
    public function planLimit(string $key): ?int
    {
        return config("plans.limits.{$this->currentPlan()}.{$key}");
    }

    /**
     * Whether adding $adding more of $key stays within the plan limit, given the
     * user's $current count. Unlimited (null) always passes.
     */
    public function isWithinPlanLimit(string $key, int $current, int $adding = 1): bool
    {
        $limit = $this->planLimit($key);

        return $limit === null || $current + $adding <= $limit;
    }

    /**
     * Whether the user may add $count more cards under their plan. The card budget
     * is a single total across all decks; premium is unlimited.
     */
    public function canAddFlashcards(int $count = 1): bool
    {
        return $this->isWithinPlanLimit('flashcards', $this->flashcards()->count(), $count);
    }

    /**
     * Whether the user may create another flashcard deck under their plan.
     */
    public function canAddFlashcardDeck(): bool
    {
        return $this->isWithinPlanLimit('decks', $this->flashcardDecks()->count());
    }

    /**
     * Whether extension WRITE operations (custom word + flashcard from the
     * extension) are still within the plan's shared daily quota. Az olvasás
     * (lookup/search/statuses) mindenkinek ingyenes; a Free napi keretet kap
     * (config: extension_writes_per_day), a Pro korlátlan. A sikeres írás
     * beszámítását recordExtensionWrite() végzi.
     */
    public function canWriteFromExtension(): bool
    {
        $limit = $this->planLimit('extension_writes_per_day');

        return $limit === null || $this->extensionWritesToday() < $limit;
    }

    /**
     * A bővítményből ma indított írások száma (közös számláló: egyéni szó +
     * flashcard). Naptári napra jár, éjfélkor lejár.
     */
    public function extensionWritesToday(): int
    {
        return (int) Cache::get($this->extensionWriteCacheKey(), 0);
    }

    /**
     * Egy sikeres bővítmény-írás beszámítása a napi keretbe. Korlátlan
     * csomagnál (Pro) nem számolunk, hogy ne írjunk fölöslegesen a cache-be.
     */
    public function recordExtensionWrite(): void
    {
        if ($this->planLimit('extension_writes_per_day') === null) {
            return;
        }

        Cache::put($this->extensionWriteCacheKey(), $this->extensionWritesToday() + 1, now()->endOfDay());
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
