<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Cache\LockTimeoutException;
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
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\PersonalAccessToken;

// Entitlement/billing columns (lifetime_access, ai_access, plan_override, trial_ends_at,
// invite_id, stripe_*, ai_credit*, terms_accepted_at, billingo_partner_id) are intentionally NOT fillable — they are
// set explicitly server-side (admin actions, registration via forceFill, Cashier, checkout) so no
// request payload can grant itself paid access or forge consent via mass assignment.
#[Fillable(['name', 'email', 'password', 'streak', 'last_activity_date', 'quiz_completions', 'text_analyses', 'onboarding_completed_at', 'billing_name', 'billing_tax_number', 'billing_country', 'billing_zip', 'billing_city', 'billing_address', 'billing_type'])]
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
     * Van-e sikertelen terhelés miatt szünetelő (past_due) előfizetése.
     *
     * A Cashier deactivatePastDue=true defaultja miatt a past_due előfizetés már nem
     * valid() → az activeSubscription() null, ezért a valid()-et megkerülő dedikált
     * lekérdezés kell. A lemondott (ends_at kitöltött) előfizetésre nem szól.
     */
    public function hasPastDueSubscription(): bool
    {
        return $this->subscriptions()
            ->where('stripe_status', 'past_due')
            ->whereNull('ends_at')
            ->exists();
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

    /**
     * Admin = az ADMIN_EMAIL-lel egyező, MEGERŐSÍTETT e-mail-című fiók. A
     * verified-feltétel nélkül az admin-fiók hiányakor (friss deploy,
     * DB-visszaállítás) bárki admin-jogot szerezhetne az admin-emaillel való
     * regisztrációval vagy e-mail-átírással, hitelesítés nélkül.
     */
    public function isAdmin(): bool
    {
        $adminEmail = config('app.admin_email');

        return $adminEmail !== null
            && $this->email === $adminEmail
            && $this->hasVerifiedEmail();
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
     * Bármilyen próbaidőn van-e: generikus (admin-adta, users.trial_ends_at) vagy az
     * aktív Stripe-előfizetés trial szakaszában. A Cashier onTrial()-ja argumentum
     * nélkül csak a generikus trialt és a 'default' típusú előfizetés trialját nézi —
     * az app előfizetései viszont 'premium' típusúak, ezért az aktív előfizetést
     * külön kérdezzük meg. A UI trial-kijelzése ezt használja, ne az onTrial()-t.
     */
    public function isOnAnyTrial(): bool
    {
        return $this->onTrial() || ($this->activeSubscription()?->onTrial() ?? false);
    }

    /**
     * Az aktív próbaidő vége, forrástól függetlenül (generikus vagy előfizetéses).
     */
    public function currentTrialEndsAt(): ?CarbonInterface
    {
        if ($this->onTrial()) {
            return $this->trial_ends_at;
        }

        return $this->activeSubscription()?->trial_ends_at;
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

    /**
     * A checkout-kapu (PricingController) ezt használja: ha true, a fizetés lefut és
     * a Billingo NAV-számla generálódik. Ezért pontosan azokat a mezőket kell
     * megkövetelnie, amiket a jogi számla-payload (InvoiceGenerator::partnerPayload)
     * felhasznál — különben egy hiányos fiók átcsúszhat és hibás/hiányos számla készül:
     *  - billing_country: enélkül a payload némán 'HU'-ra esne vissza,
     *  - billing_type: enélkül a cég-ág (adószám) sosem futna le,
     *  - cégnél billing_tax_number: belföldi cégszámlán jogszabály szerint kötelező.
     */
    public function hasBillingDetails(): bool
    {
        $hasCore = filled($this->billing_name)
            && filled($this->billing_country)
            && filled($this->billing_zip)
            && filled($this->billing_city)
            && filled($this->billing_address)
            && filled($this->billing_type);

        if (! $hasCore) {
            return false;
        }

        return $this->billing_type !== 'company' || filled($this->billing_tax_number);
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
     * Atomically reserve $count card slots under the plan limit and run $insert
     * while the slots are held. The limit check and the insert share a per-user
     * lock so parallel create requests cannot both pass on the same stale count
     * (TOCTOU). Returns false without running $insert when the plan cap would be
     * exceeded; unlimited (Pro) plans skip the count entirely.
     *
     * @throws LockTimeoutException ha a zár a várakozási ablakon belül sem szabadul fel (torlódás, pl. párhuzamos nagy import) — ilyenkor $insert el sem indult; a webes hívók ezt barátságos "próbáld újra" hibává fordítják (LIMIT-L1), az extension-út a napi keret refundja után továbbdobja
     */
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

    /**
     * Whether the user may create another flashcard deck under their plan.
     */
    public function canAddFlashcardDeck(): bool
    {
        return $this->isWithinPlanLimit('decks', $this->flashcardDecks()->count());
    }

    /**
     * Atomically reserve one deck slot under the plan limit and run $create while
     * the slot is held, mirroring reserveFlashcardSlots. The limit check and the
     * insert share a per-user lock so parallel POSTs cannot both pass on the same
     * stale deck count (TOCTOU). Returns the created deck, or null when the plan
     * cap would be exceeded; unlimited (Pro) plans skip the count entirely.
     *
     * @param  \Closure(): FlashcardDeck  $create
     *
     * @throws LockTimeoutException ha a zár a várakozási ablakon belül sem szabadul fel — ilyenkor $create el sem indult; a hívó barátságos "próbáld újra" hibává fordítja (LIMIT-L1)
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

    /**
     * Whether extension WRITE operations (custom word + flashcard from the
     * extension) are still within the plan's shared daily quota. Az olvasás
     * (lookup/search/statuses) mindenkinek ingyenes; a Free napi keretet kap
     * (config: extension_writes_per_day), a Pro korlátlan. Ez csak gyors
     * előszűrés — a keretet ténylegesen a reserveExtensionWrite() foglalja le.
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
     * Egy bővítmény-írás atomi lefoglalása a napi keretből, közvetlenül az
     * insert előtt hívva. Add+increment, így párhuzamos kérések nem mehetnek
     * át ugyanazon az elavult számláló-értéken (SEC_AUDIT #R6). Betelt keretnél
     * false-t ad, és a foglalást visszaadja. Korlátlan csomagnál (Pro) nem
     * számolunk, hogy ne írjunk fölöslegesen a cache-be.
     */
    public function reserveExtensionWrite(): bool
    {
        $limit = $this->planLimit('extension_writes_per_day');

        if ($limit === null) {
            return true;
        }

        $key = $this->extensionWriteCacheKey();
        Cache::add($key, 0, now()->endOfDay());

        $count = Cache::increment($key);

        // A database cache store false-t ad, ha a sor épp hiányzik (éjféli prune /
        // cache:clear és az increment közti ablakban). Ilyenkor nem tudjuk biztosan
        // megszámolni a foglalást, ezért fail-closed: elutasítjuk. Enélkül a
        // (false > $limit) === false miatt az írás számlálatlanul átmenne (SEC_AUDIT L2).
        if ($count === false || $count > $limit) {
            Cache::decrement($key);

            return false;
        }

        return true;
    }

    /**
     * Egy korábban lefoglalt bővítmény-írás visszaadása a napi keretbe, ha az
     * insert végül nem valósult meg (pl. párhuzamos kérés miatti unique-ütközés).
     * Korlátlan csomagnál nincs számláló, így nincs mit visszaadni.
     */
    public function refundExtensionWrite(): void
    {
        if ($this->planLimit('extension_writes_per_day') === null) {
            return;
        }

        $key = $this->extensionWriteCacheKey();

        if (Cache::get($key, 0) > 0) {
            Cache::decrement($key);
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

    /**
     * A KIZÁRÓLAG `player` ability-jű Sanctum-tokenek visszavonása — jelszóváltás,
     * jelszó-reset és a Settings „Minden eszköz leválasztása" közös magja.
     * Szándékosan nem `->can('player')`: az egy `*`-tokenre is igaz volna, így
     * egy szélesebb jogkörű token is véletlenül törlődhetne (lásd
     * SecurityController::isPlayerToken()).
     */
    public function revokePlayerTokens(): void
    {
        $this->tokens()
            ->get()
            ->filter(fn (PersonalAccessToken $token) => $token->abilities === ['player'])
            ->each(fn (PersonalAccessToken $token) => $token->delete());
    }

    /**
     * A megjelenítéshez érvényes sorozat: 0, ha a legutóbbi aktivitás óta
     * kimaradt legalább egy nap (a nyers `streak` oszlopot csak a következő
     * aktivitás nullázza, ezért olvasáskor itt kell frissre számolni).
     */
    public function currentStreak(): int
    {
        $lastActivity = $this->last_activity_date;

        if ($lastActivity?->isToday() || $lastActivity?->isYesterday()) {
            return $this->streak;
        }

        return 0;
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
