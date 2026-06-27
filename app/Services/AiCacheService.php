<?php

namespace App\Services;

use App\Models\AiWordCache;
use Illuminate\Support\Str;

/**
 * Szóhoz kötött, determinisztikus AI-válaszok központi gyorsítótára.
 *
 * Egy szótár-appban ugyanazokat a szavakat nézik ki ezrek, és a szó-szintű
 * Gemini-válasz (jelentés, ragozás, flashcard) felhasználótól független. Az első
 * eredményt eltároljuk, az ismétlődő kéréseket DB-ből szolgáljuk ki: nulla
 * Gemini-költség, nulla blokkolt PHP-folyamat. NEM ezen át megy a felhasználó
 * egyedi mondatát értékelő hívás (mondat-/gyakorlat-ellenőrzés).
 */
class AiCacheService
{
    /**
     * Visszaadja a gyorsítótárazott választ, vagy lefuttatja és — ha jó minőségű —
     * eltárolja a generátort. Találat esetén a generátor le sem fut, így nincs
     * Gemini-hívás és nincs költségterhelés.
     *
     * @param  callable(): array{ok: bool, data: mixed, error: string, model?: string}  $generator  rendszerint egy callGemini() hívás
     * @param  (callable(array<string, mixed>): bool)|null  $isCacheable  extra feltétel az adatra: csak akkor tárol, ha true-t ad (pl. valódi szó). null = minden jól formált választ cache-el.
     * @return array{ok: bool, data: mixed, error: string, model?: string}
     */
    public function remember(string $task, string $word, int $promptVersion, string $model, callable $generator, ?callable $isCacheable = null): array
    {
        $key = $this->key($task, $word, $promptVersion);

        if ($cached = AiWordCache::firstWhere('cache_key', $key)) {
            return ['ok' => true, 'data' => $cached->response, 'error' => ''];
        }

        $result = $generator();

        // Minőség-kapu: csak sikeres, jól formált (tömb) választ tárolunk, hogy
        // egy csonka/hibás válasz ne ragadjon be a cache-be mindenki számára.
        // A hívó adhat extra feltételt is (pl. „valódi szó-e"), így egy
        // hallucinált, nem létező szóra adott válasz sem mérgezi a cache-t.
        // updateOrCreate (nem create): ha közben egy párhuzamos kérés ugyanezt a
        // szót már beszúrta, ez nem ütközik a unique kulcson, csak felülírja.
        $wellFormed = ($result['ok'] ?? false) === true && is_array($result['data'] ?? null);

        if ($wellFormed && ($isCacheable === null || $isCacheable($result['data']))) {
            AiWordCache::updateOrCreate(
                ['cache_key' => $key],
                [
                    'task' => $task,
                    'word' => Str::lower($word),
                    'prompt_version' => $promptVersion,
                    // A ténylegesen választ adó modell (eszkaláció esetén a fallback),
                    // ha a generátor visszaadta; különben a kért alapmodell.
                    'model' => $result['model'] ?? $model,
                    'response' => $result['data'],
                ],
            );
        }

        return $result;
    }

    /**
     * Cache-kulcs: task + normalizált szó + nyelv + prompt-verzió. A kisbetűsítés
     * maximalizálja a találatokat ("Dog" és "dog" ugyanaz a sor).
     */
    private function key(string $task, string $word, int $promptVersion): string
    {
        return $task.':'.Str::lower($word).':en:v'.$promptVersion;
    }
}
