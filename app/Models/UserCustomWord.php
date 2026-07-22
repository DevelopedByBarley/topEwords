<?php

namespace App\Models;

use App\Concerns\NormalizesExtraForms;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms',
    'part_of_speech', 'example_en', 'example_hu', 'status', 'importance',
    'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle',
    'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative',
    'extra_forms',
])]
class UserCustomWord extends Model
{
    use NormalizesExtraForms;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
