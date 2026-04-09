<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserBook extends Model
{
    public const PAGE_SIZE = 5000;

    protected $fillable = ['user_id', 'title', 'file_type', 'compressed_text', 'total_pages'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Return a specific PAGE_SIZE-character page (1-indexed). */
    public function getPage(int $page): string
    {
        $text = gzdecode($this->compressed_text);
        $offset = ($page - 1) * self::PAGE_SIZE;

        return mb_substr($text, $offset, self::PAGE_SIZE);
    }
}
