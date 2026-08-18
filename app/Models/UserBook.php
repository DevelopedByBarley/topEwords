<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserBook extends Model
{
    public const PAGE_SIZE = 5000;

    /**
     * Meddig keresünk visszafelé szóhatárt a lap nominális határánál. Ennél
     * hosszabb szóközmentes blokknál (base64-maradvány, ragasztott jelölés) a
     * nyers offseten vágunk: a keresés így sem fut végig a könyvön.
     */
    private const BOUNDARY_LOOKBACK = 200;

    protected $fillable = ['user_id', 'title', 'file_type', 'compressed_text', 'total_pages', 'text_size'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Return a specific PAGE_SIZE-character page (1-indexed). */
    public function getPage(int $page): string
    {
        return self::slicePage(@gzdecode($this->compressed_text) ?: '', $page);
    }

    /**
     * A `$page`. lap szövege, szóhatárra igazított határokkal.
     *
     * A nyers `mb_substr($text, ($page - 1) * PAGE_SIZE, PAGE_SIZE)` a lap
     * végén szó közepén vágott: a „have" `h`-ként zárta az egyik lapot és
     * `ave`-ként nyitotta a következőt — az olvasónak hibás szó, a
     * szóelemzőnek két hibás token. A határ ezért visszafelé a legközelebbi
     * szóhatárra ugrik.
     *
     * A lap kezdete és vége UGYANEZT a függvényt hívja ugyanarra a nominális
     * offsetre, ezért az `n`. lap pontosan ott végződik, ahol az `n + 1`.
     * kezdődik: se szöveg nem esik ki, se nem duplázódik, és a `total_pages`
     * (a nominális offsetekből számolt lapszám) is érvényes marad.
     */
    public static function slicePage(string $text, int $page): string
    {
        $length = mb_strlen($text);
        $start = self::wordBoundary($text, ($page - 1) * self::PAGE_SIZE, $length);
        $end = self::wordBoundary($text, $page * self::PAGE_SIZE, $length);

        return mb_substr($text, $start, max(0, $end - $start));
    }

    /** A nominális offset visszafelé a legközelebbi szóhatárra igazítva. */
    private static function wordBoundary(string $text, int $offset, int $length): int
    {
        if ($offset <= 0) {
            return 0;
        }

        if ($offset >= $length) {
            return $length;
        }

        // Az ablak utolsó karaktere a vágásnál álló karakter.
        $back = min($offset, self::BOUNDARY_LOOKBACK);
        $window = mb_str_split(mb_substr($text, $offset - $back, $back + 1));

        // A határ nem esik szó közé, ha a vágás előtti VAGY utáni karakter szóköz.
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
