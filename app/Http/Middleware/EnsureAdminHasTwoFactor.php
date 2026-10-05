<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Laravel\Fortify\Features;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminHasTwoFactor
{
    public const MESSAGE = 'Az admin-felület csak bekapcsolt és megerősített kétlépcsős azonosítással érhető el. Kapcsold be itt, a Biztonság oldalon.';

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null
            || ! $user->can('admin')
            || $user->hasEnabledTwoFactorAuthentication()
            || ! $this->isEnforced()) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => self::MESSAGE, 'error' => self::MESSAGE], 403);
        }

        if ($this->securityPageNeedsPasswordConfirmation($request)) {
            $request->session()->put('url.intended', $request->isMethod('GET')
                ? $request->fullUrl()
                : route('security.edit'));

            return redirect()->route('password.confirm');
        }

        return redirect()->route('security.edit')->with('error', self::MESSAGE);
    }

    private function isEnforced(): bool
    {
        return ! app()->environment('local')
            || (bool) config('app.admin_requires_two_factor', true);
    }

    private function securityPageNeedsPasswordConfirmation(Request $request): bool
    {
        if (! Features::canManageTwoFactorAuthentication()
            || ! Features::optionEnabled(Features::twoFactorAuthentication(), 'confirmPassword')) {
            return false;
        }

        $secondsSinceConfirmation = Date::now()->unix() - $request->session()->get('auth.password_confirmed_at', 0);

        return $secondsSinceConfirmation > (int) config('auth.password_timeout', 10800);
    }
}
