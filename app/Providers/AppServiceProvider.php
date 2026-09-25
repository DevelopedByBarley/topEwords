<?php

namespace App\Providers;

use App\Jobs\GenerateBillingoInvoice;
use App\Models\User;
use App\Services\Billingo\BillingoClient;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // A Billingo kliens az API kulccsal — egy helyen, a konfigból feloldva.
        $this->app->singleton(BillingoClient::class, fn (): BillingoClient => new BillingoClient(
            (string) config('services.billingo.api_key'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->assertKnownEnvironment();
        $this->assertDebugDisabledInProduction();
        $this->configureDefaults();
        $this->assertStripeWebhookSecured();
        $this->assertStripeSecretMatchesEnvironment();
        $this->assertBillingoConfigured();
        $this->assertLogRetentionBounded();
        $this->assertQueueRetryAfterExceedsInvoiceTimeout();

        Gate::define('admin', fn (User $user): bool => $user->isAdmin());
    }

    /**
     * A környezetek, amelyekben a teljes hardening él (T-4 / F1-L2).
     *
     * A staging jellemzően éles adatmásolaton, publikusan elérhetően fut, ezért
     * ugyanazt a védelmet kapja, mint a production: erős jelszó-policy, a
     * destruktív parancsok tiltása, Secure session-cookie (config/session.php),
     * HSTS + CSP (SecurityHeaders), APP_DEBUG-tilalom, Billingo-, log- és
     * queue retry_after-guard.
     * Csak a production marad: a Stripe live-kulcs assert (a staging tipikusan
     * teszt-módú Stripe-kulccsal fut) és az admin hiba-riasztás (a staging hibái
     * ne ébresszék az üzemeltetőt).
     *
     * @var list<string>
     */
    public const HARDENED_ENVIRONMENTS = ['production', 'staging'];

    /**
     * Fail loudly if APP_ENV is set to an unrecognized value.
     *
     * ENV-1 / HDR-1 defense-in-depth: nearly every production hardening layer
     * (CSP + HSTS, the SESSION_SECURE_COOKIE fail-safe, Password::defaults(),
     * DB::prohibitDestructiveCommands, the Stripe live-key assert and the error
     * alert) keys off an exact environment match ('production', and since T-4
     * also 'staging' — see HARDENED_ENVIRONMENTS). A typo — APP_ENV=prod / live / "production " — would SILENTLY drop
     * all of them at once. An empty/unset APP_ENV fails safe to 'production'
     * (config/app.php), so the only dangerous state is an actively mistyped,
     * non-empty value; a boot-time whitelist turns that silent downgrade into a
     * hard boot failure. We never treat production itself as unknown.
     */
    public function assertKnownEnvironment(): void
    {
        $known = ['local', 'testing', 'staging', 'production'];

        if (! in_array(app()->environment(), $known, true)) {
            throw new \RuntimeException(sprintf(
                'APP_ENV is "%s", which is not a recognized environment (%s). '
                .'Production hardening (CSP/HSTS, secure cookies, strong-password '
                .'policy, destructive-command guard) only activates on the exact '
                .'values "production" / "staging", so an unrecognized value silently disables '
                .'it. Refusing to boot — fix APP_ENV.',
                app()->environment(),
                implode(', ', $known),
            ));
        }
    }

    /**
     * Fail loudly if APP_DEBUG is left on in production.
     *
     * ENV-2 defense-in-depth: config/app.php fails safe (APP_DEBUG defaults to
     * false), but a .env copied from .env.example ships APP_DEBUG=true. If that
     * line survives a production deploy, every 500 leaks a full Whoops/Ignition
     * stack trace and config values. The default is safe, so this only fires on
     * an explicit, mistyped APP_DEBUG=true under APP_ENV=production. T-4: a
     * publikus, éles adatmásolaton futó staging ugyanígy szivárogtatna, ezért
     * ott is tilos.
     */
    public function assertDebugDisabledInProduction(): void
    {
        if ($this->isHardenedEnvironment() && config('app.debug')) {
            throw new \RuntimeException(
                'APP_ENV is '.app()->environment().' but APP_DEBUG is true. Detailed error pages '
                .'would leak stack traces and config values on every exception. '
                .'Refusing to boot — set APP_DEBUG=false.'
            );
        }
    }

    /**
     * Fail loudly if Stripe is enabled but the webhook signing secret is missing.
     *
     * The stripe/* routes are CSRF-exempt, so Cashier's signature check is the only
     * thing authenticating incoming webhooks. Cashier attaches that middleware ONLY
     * when the secret is non-empty — an empty secret silently disables verification
     * and would accept forged webhooks (e.g. a free premium upgrade). Refuse to boot.
     */
    public function assertStripeWebhookSecured(): void
    {
        if (config('services.stripe.enabled') && empty(config('cashier.webhook.secret'))) {
            throw new \RuntimeException(
                'STRIPE_ENABLED is true but STRIPE_WEBHOOK_SECRET is empty. The stripe/* '
                .'webhook is CSRF-exempt, so an unset secret disables Stripe signature '
                .'verification and would accept forged webhooks. Set STRIPE_WEBHOOK_SECRET.'
            );
        }
    }

    /**
     * Fail loudly in production if the Stripe secret key is a TEST-mode key.
     *
     * REC-1 defense-in-depth: a test-mode (or wrong-account) STRIPE_SECRET makes the
     * Stripe API answer resource_missing for every live subscription retrieve, which
     * the daily cashier:reconcile-subscriptions would read as "deleted". The reconcile
     * command now has a blast-radius kill switch, but the far cheaper fix is to never
     * boot production with a mismatched key. We only assert when Stripe is enabled and
     * a secret is present (empty/local keys are the developer's concern, not this guard).
     */
    public function assertStripeSecretMatchesEnvironment(): void
    {
        if (! app()->isProduction() || ! config('services.stripe.enabled')) {
            return;
        }

        $secret = (string) config('cashier.secret');

        if ($secret !== '' && str_starts_with($secret, 'sk_test_')) {
            throw new \RuntimeException(
                'APP_ENV is production but STRIPE_SECRET is a test-mode key (sk_test_…). '
                .'A test/wrong-account key makes Stripe return resource_missing for every '
                .'live subscription, which the reconcile command would treat as a lost '
                .'cancellation. Refusing to boot — set the live STRIPE_SECRET (sk_live_…).'
            );
        }
    }

    /**
     * Fail loudly in production/staging if Billingo invoicing is enabled but misconfigured.
     *
     * T-33 / F9B-L2: üres API-kulccsal minden számlázó job bukna, a 0-s block_id pedig
     * a Billingo-fiók automatikusan választott tömbjébe küldené a NAV-számlát — több
     * tömbös éles fiókban akár rossz sorszámtartományba, naplóbejegyzés nélkül. Élesben
     * és stagingen ezért kötelező a kulcs és az explicit block_id; a lokális teszt-profil
     * (BLOCK_ID=0) továbbra is az automatikus tömbválasztást használhatja.
     */
    public function assertBillingoConfigured(): void
    {
        if (! $this->isHardenedEnvironment() || ! config('services.billingo.enabled')) {
            return;
        }

        if (empty(config('services.billingo.api_key')) || (int) config('services.billingo.block_id') <= 0) {
            throw new \RuntimeException(
                'BILLINGO_ENABLED is true but BILLINGO_API_KEY is empty or BILLINGO_BLOCK_ID is not '
                .'set (<= 0). In '.app()->environment().' the invoice block must be explicit: an '
                .'automatically picked block could issue NAV invoices into the wrong numbering '
                .'sequence. Refusing to boot — set BILLINGO_API_KEY and BILLINGO_BLOCK_ID.'
            );
        }
    }

    /**
     * Fail loudly in production/staging if the default log stack has unbounded retention.
     *
     * T-16 / F4-L2: az adatvédelmi tájékoztató legfeljebb 12 hónapos megőrzést ígér a
     * technikai naplókra (IP-cím, hibanapló). A `single` csatorna sosem forgatott,
     * korlátlanul növő fájlt ír, a `daily` csatorna 0 napos beállítása pedig szintén
     * korlátlan megőrzés (Monolog: 0 = nincs törlés). Az ígéret így nem múlhat egy
     * elfelejtett LOG_STACK soron: a ténylegesen írt csatornák között nem lehet `single`,
     * és minden `daily` csatorna 1–365 napot tarthat meg.
     */
    public function assertLogRetentionBounded(): void
    {
        if (! $this->isHardenedEnvironment()) {
            return;
        }

        foreach ($this->effectiveLogChannels() as $channel) {
            $driver = (string) config("logging.channels.{$channel}.driver");
            $days = (int) config("logging.channels.{$channel}.days", 0);

            if ($driver === 'single' || ($driver === 'daily' && ($days < 1 || $days > 365))) {
                throw new \RuntimeException(sprintf(
                    'The log channel "%s" (driver: %s, days: %d) keeps logs beyond the 12-month '
                    .'retention promised in the privacy policy. Refusing to boot — use '
                    .'LOG_STACK=daily with LOG_DAILY_DAYS between 1 and 365.',
                    $channel,
                    $driver,
                    $days,
                ));
            }
        }
    }

    /**
     * Fail loudly in production/staging if the queue's retry_after does not exceed the
     * Billingo invoice job's timeout.
     *
     * Ha a retry_after nem nagyobb a GenerateBillingoInvoice timeoutjánál, a queue egy még
     * futó számlázó jobot újra kiad egy másik workernek — a párhuzamos második futás
     * dupla NAV-számlát állíthat ki. A config/queue.php alapértéke biztonságos, de egy
     * DB_QUEUE_RETRY_AFTER / REDIS_QUEUE_RETRY_AFTER env-felülírás ezt csendben
     * visszahozná. Csak a retry_after-t ismerő database/redis driverre vonatkozik.
     */
    public function assertQueueRetryAfterExceedsInvoiceTimeout(): void
    {
        if (! $this->isHardenedEnvironment()) {
            return;
        }

        $connection = (string) config('queue.default');
        $driver = config("queue.connections.{$connection}.driver");

        if (! in_array($driver, ['database', 'redis'], true)) {
            return;
        }

        $retryAfter = (int) config("queue.connections.{$connection}.retry_after");

        if ($retryAfter <= GenerateBillingoInvoice::TIMEOUT_SECONDS) {
            throw new \RuntimeException(sprintf(
                'The "%s" queue connection has retry_after=%d, which does not exceed the Billingo '
                .'invoice job timeout (%d s). A still-running invoice job would be handed to a '
                .'second worker and could issue a duplicate NAV invoice. Refusing to boot — raise '
                .'DB_QUEUE_RETRY_AFTER / REDIS_QUEUE_RETRY_AFTER above %d.',
                $connection,
                $retryAfter,
                GenerateBillingoInvoice::TIMEOUT_SECONDS,
                GenerateBillingoInvoice::TIMEOUT_SECONDS,
            ));
        }
    }

    /**
     * Az alapértelmezett log-csatorna ténylegesen írt csatornái (a stack kibontva).
     *
     * @return list<string>
     */
    private function effectiveLogChannels(): array
    {
        $default = (string) config('logging.default');

        if (config("logging.channels.{$default}.driver") !== 'stack') {
            return [$default];
        }

        return array_values(array_map(
            fn (mixed $channel): string => trim((string) $channel),
            (array) config("logging.channels.{$default}.channels", []),
        ));
    }

    /**
     * Production vagy staging — a teljes hardening itt él (lásd HARDENED_ENVIRONMENTS).
     */
    private function isHardenedEnvironment(): bool
    {
        return app()->environment(self::HARDENED_ENVIRONMENTS);
    }

    /**
     * Configure default behaviors for production-ready applications.
     *
     * T-4: a destruktív parancsok tiltása és az erős jelszó-policy stagingen is él.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            $this->isHardenedEnvironment(),
        );

        Password::defaults(fn (): ?Password => $this->isHardenedEnvironment()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
