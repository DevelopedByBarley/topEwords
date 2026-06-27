<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['word', 'rank', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu'])]
class Word extends Model
{
    protected static function booted(): void
    {
        static::saving(function (Word $word): void {
            if ($word->isDirty('rank') || $word->level === null) {
                $word->level = self::levelForRank((int) $word->rank);
            }
        });
    }

    public static function levelForRank(int $rank): int
    {
        return match (true) {
            $rank <= 1000 => 1,
            $rank <= 2000 => 2,
            $rank <= 4000 => 3,
            $rank <= 6000 => 4,
            $rank <= 8000 => 5,
            default => 6,
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
