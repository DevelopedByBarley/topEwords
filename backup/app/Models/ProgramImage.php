<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ProgramImage extends Model
{
    protected $fillable = ['program_id', 'path', 'is_cover', 'sort_order'];

    protected $casts = ['is_cover' => 'boolean'];

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function url(): string
    {
        return Storage::url($this->path);
    }

    protected static function booted(): void
    {
        static::deleting(function (ProgramImage $image) {
            Storage::disk('public')->delete($image->path);
        });
    }
}
