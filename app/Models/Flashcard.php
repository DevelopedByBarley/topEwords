<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['deck_id', 'word_id', 'front', 'front_notes', 'front_speak', 'back', 'back_notes', 'back_speak', 'direction', 'color'])]
class Flashcard extends Model
{
    public function deck(): BelongsTo
    {
        return $this->belongsTo(FlashcardDeck::class, 'deck_id');
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(Word::class);
    }

    public function review(): HasOne
    {
        return $this->hasOne(FlashcardReview::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(FlashcardReview::class);
    }
}
