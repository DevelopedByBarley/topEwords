<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Egy szóhoz tartozó, determinisztikus AI-válasz gyorsítótár-sora. A táblanevet
 * explicit megadjuk, mert az Eloquent többes száma ("ai_word_caches") eltérne.
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
