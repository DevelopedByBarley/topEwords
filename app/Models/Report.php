<?php

namespace App\Models;

use Database\Factories\ReportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'word_id', 'category', 'description'])]
class Report extends Model
{
    /** @use HasFactory<ReportFactory> */
    use HasFactory;

    protected $attributes = ['status' => 'open'];

    public const CATEGORIES = ['bug', 'missing_feature', 'word_data', 'other'];

    /**
     * A kategóriák emberi neve — az admin-értesítő levélhez. A felületek saját
     * (magyar) címkéiket viszik, ez a szerver-oldali szövegek forrása.
     *
     * @var array<string, string>
     */
    public const CATEGORY_LABELS = [
        'bug' => 'Hiba a rendszerben',
        'missing_feature' => 'Hiányzó funkció',
        'word_data' => 'Hibás szóadat',
        'other' => 'Egyéb',
    ];

    public const STATUSES = ['open', 'resolved'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(Word::class);
    }
}
