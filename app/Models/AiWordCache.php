<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
