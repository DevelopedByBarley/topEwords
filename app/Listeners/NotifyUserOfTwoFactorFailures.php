<?php

namespace App\Listeners;

use App\Models\User;
use App\Notifications\TwoFactorChallengeFailing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;

/**
 * Sorozatos hibás 2FA-kód esetén szól a fióktulajdonosnak (F9C-L5).
 *
 * A challenge-ig csak az jut el, aki a jelszót már ismeri — N hibás kód egy
 * órán belül tehát nagy valószínűséggel azt jelenti, hogy a jelszó kiszivárgott,
 * és valaki a második faktort próbálja. Ezt csak a felhasználó tudja megállítani
 * (jelszócsere), ezért neki megy e-mail; a naplóba is kerül egy warning, hogy
 * az üzemeltető is lássa.
 *
 * Óránként legfeljebb egy levél: a számláló az első hibánál indul, és csak a
 * küszöb elérésekor küld — a támadó így nem tudja levelekkel elárasztani az
 * áldozat postafiókját.
 */
class NotifyUserOfTwoFactorFailures
{
    public const THRESHOLD = 5;

    private const CACHE_KEY_PREFIX = 'two-factor-failures';

    public function __construct(private Request $request) {}

    public function handle(TwoFactorAuthenticationFailed $event): void
    {
        $user = $event->user;

        if (! $user instanceof User) {
            return;
        }

        $cacheKey = self::CACHE_KEY_PREFIX.":{$user->id}";

        // Az add() atomi, és csak az első hibánál indítja az egyórás ablakot.
        Cache::add($cacheKey, 0, now()->addHour());
        $failures = (int) Cache::increment($cacheKey);

        if ($failures !== self::THRESHOLD) {
            return;
        }

        Log::warning('Sorozatos hibás kétlépcsős kód', [
            'user_id' => $user->id,
            'failures' => $failures,
            'ip' => $this->request->ip(),
        ]);

        $user->notifyNow(new TwoFactorChallengeFailing($failures, $this->request->ip()));
    }
}
