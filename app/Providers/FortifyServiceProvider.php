<?php

namespace App\Providers;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Http\Responses\RegisterResponse;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Laravel\Fortify\Contracts\RegisterResponse as RegisterResponseContract;
use Laravel\Fortify\Features;
use Laravel\Fortify\Fortify;

class FortifyServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Email-verification-first flow: do not keep the user logged in after
        // registration; send them to login with a "confirm your email" notice.
        $this->app->singleton(RegisterResponseContract::class, RegisterResponse::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureActions();
        $this->configureViews();
        $this->configureRateLimiting();
        $this->configureRouteThrottling();
    }

    /**
     * Configure Fortify actions.
     */
    private function configureActions(): void
    {
        Fortify::resetUserPasswordsUsing(ResetUserPassword::class);
        Fortify::createUsersUsing(CreateNewUser::class);
    }

    /**
     * Configure Fortify views.
     */
    private function configureViews(): void
    {
        Fortify::loginView(fn (Request $request) => Inertia::render('auth/login', [
            'canResetPassword' => Features::enabled(Features::resetPasswords()),
            'canRegister' => Features::enabled(Features::registration()),
            'status' => $request->session()->get('status'),
        ]));

        Fortify::resetPasswordView(fn (Request $request) => Inertia::render('auth/reset-password', [
            'email' => $request->email,
            'token' => $request->route('token'),
        ]));

        Fortify::requestPasswordResetLinkView(fn (Request $request) => Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::registerView(fn (Request $request) => Inertia::render('auth/register', [
            'inviteOnly' => (bool) config('registration.invite_only'),
            'invite' => $request->query('invite', ''),
        ]));

        Fortify::verifyEmailView(fn (Request $request) => Inertia::render('auth/verify-email', [
            'status' => $request->session()->get('status'),
        ]));

        Fortify::twoFactorChallengeView(fn () => Inertia::render('auth/two-factor-challenge'));

        Fortify::confirmPasswordView(fn () => Inertia::render('auth/confirm-password'));
    }

    /**
     * Configure rate limiting.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('two-factor', function (Request $request) {
            // A `login.id` a challenge-flow rendes menetében mindig ki van töltve,
            // de egy rendellenes belépésnél (közvetlen POST session nélkül) null
            // lenne — az IP-fallback nélkül minden ilyen kérés egy közös vödörbe
            // esne. Az IP-re esünk vissza, ahogy a `login` limiter is teszi.
            return Limit::perMinute(5)->by($request->session()->get('login.id') ?? $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $throttleKey = Str::transliterate(Str::lower($request->input(Fortify::username())).'|'.$request->ip());

            return Limit::perMinute(5)->by($throttleKey);
        });

        // Fortify does not throttle registration or the password-reset request;
        // limit them by IP to curb mass account creation and email-bombing.
        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));
        RateLimiter::for('password-request', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
    }

    /**
     * Attach throttle middleware to Fortify's registration, password-reset and
     * password-confirmation routes, which Fortify itself registers without any
     * rate limiting. Done after booting so the routes are already registered.
     *
     * Why `password.confirm.store` uses an inline `throttle:6,1,...` instead of
     * the named `password-request` limiter used by its neighbours: that limiter
     * keys purely on the IP (see `configureRateLimiting`), which is correct for
     * the guest-facing reset routes but wrong here. This route sits behind
     * `auth`, so an IP-keyed bucket would let one user's six wrong guesses lock
     * out every other user behind the same NAT/office IP — trading a password
     * oracle for a denial-of-service on legitimate users. The inline form
     * matches what `ThrottleRequests::resolveRequestSignature()` does for
     * authenticated requests: it keys on the user id, so the limit is per
     * account and NAT neighbours are unaffected.
     *
     * The 6/minute budget and the `password-update` naming mirror the existing
     * `PUT settings/password` route (routes/settings.php:26) — the closest
     * analogue in the codebase: also authenticated, also verifying a password
     * (`current_password`). Reusing that bucket name is deliberate: both routes
     * are password-verification oracles for the same account, so they SHOULD
     * share one budget rather than each offering an independent 6 guesses.
     *
     * Rejected alternative: adding a new named limiter (e.g. `password-confirm`)
     * to `configureRateLimiting()`. It would have been a third pattern for the
     * same problem, and a separate bucket would hand an attacker 12 guesses per
     * minute across the two endpoints instead of 6.
     */
    private function configureRouteThrottling(): void
    {
        $this->app->booted(function () {
            $throttles = [
                'register.store' => 'throttle:register',
                'password.email' => 'throttle:password-request',
                'password.update' => 'throttle:password-request',
                'password.confirm.store' => 'throttle:6,1,password-update',
            ];

            foreach (Route::getRoutes() as $route) {
                if ($middleware = ($throttles[$route->getName()] ?? null)) {
                    $route->middleware($middleware);
                }
            }
        });
    }
}
