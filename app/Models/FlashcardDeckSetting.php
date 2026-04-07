<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'flashcard_deck_id',
    'new_cards_per_day',
    'max_reviews_per_day',
    'learning_steps',
    'graduating_interval',
    'easy_interval',
    'starting_ease',
    'easy_bonus',
    'hard_interval_modifier',
    'interval_modifier',
    'max_interval',
    'lapse_new_interval',
    'leech_threshold',
    'shuffle_cards',
])]
class FlashcardDeckSetting extends Model
{
    public function deck(): BelongsTo
    {
        return $this->belongsTo(FlashcardDeck::class, 'flashcard_deck_id');
    }

    protected function casts(): array
    {
        return [
            'learning_steps' => 'array',
        ];
    }
}
