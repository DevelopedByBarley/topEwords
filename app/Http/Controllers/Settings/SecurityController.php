<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;
use Laravel\Sanctum\PersonalAccessToken;

class SecurityController extends Controller implements HasMiddleware
{
    /**
     * Get the middleware that should be assigned to the controller.
     */
    public static function middleware(): array
    {
        return Features::canManageTwoFactorAuthentication()
            && Features::optionEnabled(Features::twoFactorAuthentication(), 'confirmPassword')
                ? [new Middleware('password.confirm', only: ['edit'])]
                : [];
    }

    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        $props = [
            'canManageTwoFactor' => Features::canManageTwoFactorAuthentication(),
            'playerDevices' => $this->playerDevices($request),
        ];

        if (Features::canManageTwoFactorAuthentication()) {
            $request->ensureStateIsValid();

            $props['twoFactorEnabled'] = $request->user()->hasEnabledTwoFactorAuthentication();
            $props['requiresConfirmation'] = Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm');
        }

        return Inertia::render('settings/security', $props);
    }

    /**
     * A felhasználó összekötött lejátszó-eszközeinek listája (a `player`
     * ability-re szűrt Sanctum-tokenek), a UI-nak megjelenítésre.
     *
     * @return array<int, array{id:int, name:string, last_used_at:?string, created_at:?string, expires_at:?string}>
     */
    private function playerDevices(Request $request): array
    {
        return $request->user()->tokens()
            // A lejárt tokent a guard már elutasítja, de a sora a napi prune-ig a
            // táblában marad — csatlakoztatott eszközként ne mutassuk.
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->orderByDesc('last_used_at')
            ->get()
            ->filter(fn ($token) => $this->isPlayerToken($token))
            ->map(fn ($token) => [
                'id' => $token->id,
                'name' => $token->name,
                'last_used_at' => $token->last_used_at?->toIso8601String(),
                'created_at' => $token->created_at?->toIso8601String(),
                'expires_at' => $token->expires_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /**
     * Egy összekötött lejátszó-eszköz tokenjének visszavonása. User-scoped
     * (csak a saját tokenjét), és csak `player`-ability-jű tokent enged törölni,
     * hogy az API-token végpont ne érinthessen más (pl. jövőbeli szélesebb
     * jogkörű) tokent.
     */
    public function revokePlayerDevice(Request $request, int $tokenId): RedirectResponse
    {
        $token = $request->user()->tokens()->whereKey($tokenId)->first();

        if ($token && $this->isPlayerToken($token)) {
            $token->delete();
        }

        return back();
    }

    /**
     * Az összes összekötött lejátszó-eszköz tokenjének visszavonása egy lépésben
     * (pl. eszközlopás után). Csak a `player`-ability-jű tokeneket törli.
     */
    public function revokeAllPlayerDevices(Request $request): RedirectResponse
    {
        $request->user()->tokens()
            ->get()
            ->filter(fn ($token) => $this->isPlayerToken($token))
            ->each(fn ($token) => $token->delete());

        return back();
    }

    /**
     * Igaz, ha a token KIZÁRÓLAG a `player` ability-vel bír. Szándékosan nem a
     * `->can('player')`-t használjuk: az egy `*`-tokenre is igaz volna, így egy
     * szélesebb jogkörű token véletlenül a lejátszó-eszközök közé kerülhetne /
     * innen törlődhetne.
     */
    private function isPlayerToken(PersonalAccessToken $token): bool
    {
        return $token->abilities === ['player'];
    }

    /**
     * Update the user's password.
     *
     * A remember token rotálása érvényteleníti a más eszközökön élő
     * „emlékezz rám" cookie-kat; az aktív sessionjeiket az
     * AuthenticateSession middleware lépteti ki a jelszóhash-váltás miatt.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->forceFill([
            'password' => $request->password,
            'remember_token' => Str::random(60),
        ])->save();

        return back();
    }
}
