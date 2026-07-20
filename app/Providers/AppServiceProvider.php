<?php

namespace App\Providers;

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

        Gate::define('admin', fn (User $user): bool => $user->isAdmin());
    }

    /**
     * Fail loudly if APP_ENV is set to an unrecognized value.
     *
     * ENV-1 / HDR-1 defense-in-depth: nearly every production hardening layer
     * (CSP + HSTS, the SESSION_SECURE_COOKIE fail-safe, Password::defaults(),
     * DB::prohibitDestructiveCommands, the Stripe live-key assert and the error
     * alert) keys off app()->isProduction(), which is a strict === 'production'
     * match. A typo — APP_ENV=prod / live / "production " — would SILENTLY drop
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
                .'value "production", so an unrecognized value silently disables '
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
     * an explicit, mistyped APP_DEBUG=true under APP_ENV=production.
     */
    public function assertDebugDisabledInProduction(): void
    {
        if (app()->isProduction() && config('app.debug')) {
            throw new \RuntimeException(
                'APP_ENV is production but APP_DEBUG is true. Detailed error pages '
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
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
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
