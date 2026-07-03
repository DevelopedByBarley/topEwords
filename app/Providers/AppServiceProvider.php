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
