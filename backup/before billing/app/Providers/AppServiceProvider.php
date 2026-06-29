<?php

namespace App\Providers;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Contracts\RegisterResponse;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->instance(RegisterResponse::class, new class implements RegisterResponse
        {
            public function toResponse($request): JsonResponse|RedirectResponse
            {
                return $request->wantsJson()
                    ? response()->json(['two_factor' => false])
                    : redirect()->route('onboarding');
            }
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->assertStripeWebhookSecured();

        Gate::define('admin', function (User $user): bool {
            $adminEmail = config('app.admin_email');

            return $adminEmail !== null && $user->email === $adminEmail;
        });
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
