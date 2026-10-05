<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserBook extends Model
{
    public const PAGE_SIZE = 5000;

    private const BOUNDARY_LOOKBACK = 200;

    protected $fillable = ['user_id', 'title', 'file_type', 'compressed_text', 'total_pages', 'text_size'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function getPage(int $page): string
    {
        return self::slicePage(@gzdecode($this->compressed_text) ?: '', $page);
    }

    public static function slicePage(string $text, int $page): string
    {
        $length = mb_strlen($text);
        $start = self::wordBoundary($text, ($page - 1) * self::PAGE_SIZE, $length);
        $end = self::wordBoundary($text, $page * self::PAGE_SIZE, $length);

        return mb_substr($text, $start, max(0, $end - $start));
    }

    private static function wordBoundary(string $text, int $offset, int $length): int
    {
        if ($offset <= 0) {
            return 0;
        }

        if ($offset >= $length) {
            return $length;
        }

        $back = min($offset, self::BOUNDARY_LOOKBACK);
        $window = mb_str_split(mb_substr($text, $offset - $back, $back + 1));

        if (self::isSpace($window[$back]) || self::isSpace($window[$back - 1])) {
            return $offset;
        }

        for ($i = $back - 2; $i >= 0; $i--) {
            if (self::isSpace($window[$i])) {
                return $offset - $back + $i + 1;
            }
        }

        return $offset;
    }

    private static function isSpace(string $char): bool
    {
        return preg_match('/[\s\p{Z}]/u', $char) === 1;
    }
}
