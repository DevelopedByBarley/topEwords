<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Egy szóhoz tartozó, determinisztikus AI-válasz gyorsítótár-sora. A táblanevet
 * explicit megadjuk, mert az Eloquent többes száma ("ai_word_caches") eltérne.
 *
 * AI-L3 (tudatosan vállalt LOW): a táblának SZÁNDÉKOSAN nincs automatikus
 * takarítása / TTL-je. A cache üzleti célja a Gemini-terhelés és -költség
 * levétele, és minden törölt sor egy jövőbeli AI-hívás; a hízás korlátja pedig
 * természetes, mert a kikeresett szókészlet véges (egy szó egy sor, felhasználók
 * között megosztva). Elvetett alternatíva: `Prunable` + napi `model:prune` —
 * mivel az `updated_at` a beírás, nem az utolsó olvasás ideje (a
 * AiCacheService::remember() találatnál csak olvas), egy TTL a legaktívabban
 * kiszolgált szavakat is újragenerálásra kényszerítené. Karbantartásra a kézi,
 * célzott `ai:cache:clear` parancs áll rendelkezésre (task/szó szűrővel).
 * Maradvány-kockázat: a tábla lassan, monoton nő — üzemeltetési (sorszám-)
 * megfigyelés kérdése, nem kódé.
 */
class AiWordCache extends Model
{
    protected $table = 'ai_word_cache';

    protected $fillable = [
        'cache_key',
        'task',
        'word',
        'language',
        'prompt_version',
        'model',
        'response',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'response' => 'array',
            'prompt_version' => 'integer',
        ];
    }
}
