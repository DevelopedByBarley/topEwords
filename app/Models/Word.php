<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['word', 'rank', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu'])]
class Word extends Model
{
    public function knownByUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_word');
    }

    public function folders(): BelongsToMany
    {
        return $this->belongsToMany(Folder::class, 'folder_word');
    }
}
