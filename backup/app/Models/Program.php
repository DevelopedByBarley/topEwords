<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Program extends Model
{
    protected $fillable = [
        'slug', 'name', 'description',
        'price_adult', 'price_child', 'child_age_min', 'child_age_max',
        'duration', 'available_days', 'group_size', 'youtube_embed', 'active', 'views', 'sort_order',
    ];

    protected $casts = [
        'name' => 'array',
        'description' => 'array',
        'available_days' => 'array',
        'duration' => 'array',
        'active' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::deleting(function (Program $program) {
            $program->images->each(fn ($image) => $image->delete());
            Storage::disk('public')->deleteDirectory("programs/{$program->id}");
        });
    }

    public function topics(): BelongsToMany
    {
        return $this->belongsToMany(Topic::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProgramImage::class)->orderBy('sort_order');
    }

    public function coverImage(): HasOne
    {
        return $this->hasOne(ProgramImage::class)->where('is_cover', true);
    }

    public function youtubeEmbedUrl(): string
    {
        $input = trim($this->youtube_embed ?? '');
        if (! $input) {
            return '';
        }

        // already an embed URL
        if (str_contains($input, 'youtube.com/embed/')) {
            return $input;
        }

        // watch?v= or youtu.be/ → extract ID
        if (preg_match('/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/', $input, $m)) {
            return 'https://www.youtube.com/embed/'.$m[1];
        }

        // bare 11-char ID
        if (preg_match('/^[a-zA-Z0-9_-]{11}$/', $input)) {
            return 'https://www.youtube.com/embed/'.$input;
        }

        return '';
    }

    public function getTranslation(string $field, ?string $locale = null): string
    {
        $locale ??= app()->getLocale();
        $value = $this->$field;

        return ($value[$locale] ?? '') ?: ($value['hu'] ?? '');
    }
}
