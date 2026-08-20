<?php

namespace App\Models;

use App\Concerns\NormalizesExtraForms;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['word', 'rank', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'extra_forms', 'example_en', 'example_hu', 'derived_from_word_id'])]
class Word extends Model
{
    use NormalizesExtraForms;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'forms_checked_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Word $word): void {
            if ($word->isDirty('rank') || $word->level === null) {
                $word->level = self::levelForRank((int) $word->rank);
            }
        });
    }

    /**
     * A frekvencia-lista mérete. Az ennél nagyobb rang már nem gyakorisági hely:
     * ide az admin alak-kitöltő által beszúrt képzett alakok kerülnek.
     */
    public const FREQUENCY_LIST_SIZE = 10000;

    /**
     * A rang-sávhoz tartozó szint. A 7. szint nem frekvencia-sáv: ide az admin
     * alak-kitöltő által beszúrt képzett alakok kerülnek, amelyek a 10 000-es
     * frekvencia-lista UTÁN kapnak rangot — így nem hazudjuk azt, hogy a
     * „8 001 – 10 000" sávba tartoznának.
     */
    public static function levelForRank(int $rank): int
    {
        return match (true) {
            $rank <= 1000 => 1,
            $rank <= 2000 => 2,
            $rank <= 4000 => 3,
            $rank <= 6000 => 4,
            $rank <= 8000 => 5,
            $rank <= self::FREQUENCY_LIST_SIZE => 6,
            default => 7,
        };
    }

    public function knownByUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_word');
    }

    public function folders(): BelongsToMany
    {
        return $this->belongsToMany(Folder::class, 'folder_word');
    }
}
