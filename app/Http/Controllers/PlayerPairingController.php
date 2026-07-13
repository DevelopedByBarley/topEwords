<?php

namespace App\Http\Controllers;

use App\Models\PlayerPairing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A desktop lejátszó fiók-bekötése eszköz-párosítással (device-flow minta).
 *
 * A folyamat úgy van felépítve, hogy a lejátszó SOHA ne lásson jelszót, és a
 * token SOHA ne utazzon URL-ben:
 *   1. Az app (vendégként) párosítást kér → kap egy rövid user_code-ot (ezt a
 *      felhasználó a böngészőben összeveti az appban látottal) és egy nagy
 *      entrópiájú poll_secret-et (ebből csak SHA-256 hash kerül az adatbázisba).
 *   2. A felhasználó a RENDSZER-böngészőben, a normál topwords session-nel
 *      (2FA-val együtt) jóváhagyja a kódot.
 *   3. Az app a poll_secret-tel beváltja a párosítást egy `player` ability-re
 *      szűkített Sanctum tokenre; a párosítási sor törlődik, így a beváltás
 *      egyszer használatos.
 */
class PlayerPairingController extends Controller
{
    /**
     * Karakterkészlet a user_code-hoz: könnyen összeolvasható karakterek nélkül
     * (nincs I/L/O/0/1), mert a felhasználónak vizuálisan kell egyeztetnie.
     */
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    /**
     * Párosítási kérelem indítása a lejátszóból (vendég végpont, IP-throttle).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_name' => ['required', 'string', 'max:100'],
        ]);

        // A lejárt kérelmek takarítása — a tábla így magától kicsi marad.
        PlayerPairing::where('expires_at', '<', now())->delete();

        $userCode = $this->generateUniqueUserCode();
        $pollSecret = bin2hex(random_bytes(32));

        PlayerPairing::create([
            'user_code' => $userCode,
            'poll_secret_hash' => hash('sha256', $pollSecret),
            'device_name' => $this->sanitizeDeviceName($data['device_name']),
            'expires_at' => now()->addMinutes(PlayerPairing::LIFETIME_MINUTES),
        ]);

        return response()->json([
            'user_code' => $userCode,
            'poll_secret' => $pollSecret,
            'verification_url' => route('player.connect'),
            'expires_in' => PlayerPairing::LIFETIME_MINUTES * 60,
            'poll_interval' => 3,
        ]);
    }

    /**
     * A jóváhagyó oldal a böngészőben (auth + verified). A kódot a felhasználó
     * KÉZZEL írja be a lejátszóból — szándékosan nincs URL-paraméter és
     * előkitöltés, hogy egy phishing-link ne tehesse egy-kattintásossá egy
     * idegen párosítás jóváhagyását. Az oldal a jóváhagyás előtt semmit nem
     * árul el a párosításról.
     */
    public function connect(): Response
    {
        return Inertia::render('player/connect');
    }

    /**
     * Párosítás jóváhagyása a bejelentkezett felhasználó session-jével (CSRF-fel
     * védett web POST). Innentől a lejátszó beválthatja a poll_secret-jét.
     */
    public function approve(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20'],
        ]);

        $code = $this->normalizeUserCode($data['code']);

        $pairing = $code === '' ? null : PlayerPairing::where('user_code', $code)->first();

        if (! $pairing || $pairing->isExpired()) {
            return back()->withErrors([
                'code' => 'Ez a kód nem található vagy lejárt. Indítsd újra az összekötést a lejátszóban.',
            ]);
        }

        if ($pairing->isApproved()) {
            return back()->withErrors([
                'code' => 'Ezt a kódot már jóváhagyták. Ha nem te voltál, indítsd újra az összekötést a lejátszóban.',
            ]);
        }

        $pairing->forceFill([
            'user_id' => $request->user()->id,
            'approved_at' => now(),
        ])->save();

        return back()->with('success', "A(z) „{$pairing->device_name}” eszköz összekötve. Visszatérhetsz a lejátszóba.");
    }

    /**
     * A lejátszó pollozó végpontja: a poll_secret beváltása tokenre (vendég
     * végpont, IP-throttle). A titkot csak hash-ben hasonlítjuk; siker esetén a
     * párosítási sor törlődik, így a beváltás egyszer használatos.
     */
    public function exchange(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_code' => ['required', 'string', 'max:20'],
            'poll_secret' => ['required', 'string', 'max:128'],
        ]);

        $pairing = PlayerPairing::where('poll_secret_hash', hash('sha256', $data['poll_secret']))
            ->where('user_code', $this->normalizeUserCode($data['user_code']))
            ->first();

        if (! $pairing) {
            return response()->json(['error' => 'not_found'], 404);
        }

        if ($pairing->isExpired()) {
            $pairing->delete();

            return response()->json(['error' => 'expired'], 410);
        }

        if (! $pairing->isApproved()) {
            return response()->json(['status' => 'pending']);
        }

        $user = $pairing->user;
        $token = $user->createToken(
            'topwords Player – '.$pairing->device_name,
            ['player'],
            now()->addYear(),
        );

        $pairing->delete();

        return response()->json([
            'status' => 'approved',
            'token' => $token->plainTextToken,
            'token_type' => 'Bearer',
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Minimális fiók-info a lejátszónak (token-auth). Szándékosan nem a teljes
     * User modellt adjuk vissza, csak amit a lejátszó UI ténylegesen megjelenít.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'name' => $request->user()->name,
            'email' => $request->user()->email,
            'has_active_access' => $request->user()->hasActiveAccess(),
            'can_write' => $request->user()->canWriteFromExtension(),
        ]);
    }

    /**
     * A lejátszó kijelentkeztetése: az aktuális token visszavonása. A kliens
     * ettől függetlenül törli a helyben tárolt tokent — ez a szerver-oldali fele.
     */
    public function disconnect(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Ütközésbiztos user_code (XXXX-XXXX). Az ütközés ~10 perces ablakban és
     * 31^8-as kódtérben gyakorlatilag kizárt, de az unique index miatt ellenőrzünk.
     */
    private function generateUniqueUserCode(): string
    {
        do {
            $raw = '';

            for ($i = 0; $i < 8; $i++) {
                $raw .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }

            $code = substr($raw, 0, 4).'-'.substr($raw, 4);
        } while (PlayerPairing::where('user_code', $code)->exists());

        return $code;
    }

    /**
     * A felhasználó által gépelt/beillesztett kód kanonikus alakra hozása
     * (kisbetű, szóköz, hiányzó vagy dupla kötőjel mind elfogadott).
     */
    private function normalizeUserCode(string $code): string
    {
        $clean = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $code));

        if (strlen($clean) !== 8) {
            return '';
        }

        return substr($clean, 0, 4).'-'.substr($clean, 4);
    }

    /**
     * Az eszköznév a jóváhagyó oldalon és a token-listában jelenik meg, ezért a
     * vezérlőkaraktereket eldobjuk, a hosszt pedig korlátozzuk.
     */
    private function sanitizeDeviceName(string $deviceName): string
    {
        $clean = trim((string) preg_replace('/\p{C}+/u', '', $deviceName));

        return $clean === '' ? 'topwords Player' : mb_substr($clean, 0, 100);
    }
}
