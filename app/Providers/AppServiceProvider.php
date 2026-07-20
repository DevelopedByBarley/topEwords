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
        $this->configureDefaults();
        $this->assertStripeWebhookSecured();
        $this->assertStripeSecretMatchesEnvironment();

        Gate::define('admin', fn (User $user): bool => $user->isAdmin());
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
