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
    public function register(): void
    {
        $this->app->singleton(BillingoClient::class, fn (): BillingoClient => new BillingoClient(
            (string) config('services.billingo.api_key'),
        ));
    }

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
     * @var list<string>
     */
    public const HARDENED_ENVIRONMENTS = ['production', 'staging'];

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

    private function isHardenedEnvironment(): bool
    {
        return app()->environment(self::HARDENED_ENVIRONMENTS);
    }

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
