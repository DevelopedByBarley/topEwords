<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Topic extends Model
{
    protected $fillable = ['slug', 'name'];

    protected $casts = [
        'name' => 'array',
    ];

    protected static function booted(): void
    {
        static::saving(function (Topic $topic) {
            if (empty($topic->slug) && !empty($topic->name['en'] ?? $topic->name['hu'])) {
                $topic->slug = Str::slug($topic->name['en'] ?? $topic->name['hu']);
            }
        });
    }

    public function programs(): BelongsToMany
    {
        return $this->belongsToMany(Program::class);
    }

    public function getTranslation(?string $locale = null): string
    {
        $locale ??= app()->getLocale();

        return ($this->name[$locale] ?? '') ?: ($this->name['hu'] ?? '');
    }
}
