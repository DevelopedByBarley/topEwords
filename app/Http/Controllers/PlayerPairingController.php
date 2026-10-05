<?php

namespace App\Http\Controllers;

use App\Models\PlayerPairing;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlayerPairingController extends Controller
{
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_name' => ['required', 'string', 'max:100'],
        ]);

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

    public function connect(): Response
    {
        return Inertia::render('player/connect');
    }

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

        if (PlayerPairing::whereKey($pairing->getKey())->delete() !== 1) {
            return response()->json(['error' => 'not_found'], 404);
        }

        $token = $user->createToken(
            'topwords Player – '.$pairing->device_name,
            ['player'],
            now()->addDays(PlayerPairing::TOKEN_LIFETIME_DAYS),
        );

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

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'name' => $request->user()->name,
            'email' => $request->user()->email,
            'has_active_access' => $request->user()->hasActiveAccess(),
            'can_write' => $request->user()->canWriteFromExtension(),
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

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

    private function normalizeUserCode(string $code): string
    {
        $clean = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $code));

        if (strlen($clean) !== 8) {
            return '';
        }

        return substr($clean, 0, 4).'-'.substr($clean, 4);
    }

    private function sanitizeDeviceName(string $deviceName): string
    {
        $clean = trim((string) preg_replace('/\p{C}+/u', '', $deviceName));

        return $clean === '' ? 'topwords Player' : mb_substr($clean, 0, 100);
    }
}
