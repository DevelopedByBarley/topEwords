<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class YoutubeTranscript extends Model
{
    /** Ennyi időbélyeges felirat-sor jut egy oldalra. */
    public const SEGMENTS_PER_PAGE = 50;

    protected $fillable = ['user_id', 'video_id', 'title', 'compressed_segments', 'total_pages', 'text_size'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Az összes időbélyeges szegmens kitömörítve.
     *
     * @return array<int, array{t: int, x: string}>
     */
    public function segments(): array
    {
        return json_decode(gzdecode($this->compressed_segments), true) ?: [];
    }

    /**
     * Egy oldal (1-indexelt): a szegmens-szelet + a hozzá tartozó sima szöveg.
     *
     * @return array{segments: array<int, array{t: int, x: string}>, text: string}
     */
    public function getPage(int $page): array
    {
        $offset = ($page - 1) * self::SEGMENTS_PER_PAGE;
        $segments = array_values(array_slice($this->segments(), $offset, self::SEGMENTS_PER_PAGE));
        $text = implode(' ', array_map(fn ($s) => $s['x'] ?? '', $segments));

        return ['segments' => $segments, 'text' => $text];
    }
}
