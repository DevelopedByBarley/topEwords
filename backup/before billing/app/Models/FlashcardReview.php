<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'flashcard_id',
    'direction',
    'state',
    'due_at',
    'interval',
    'ease_factor',
    'repetitions',
    'lapses',
    'learning_step',
    'is_leech',
    'previous_state',
    'introduced_on',
    'reviewed_on',
])]
class FlashcardReview extends Model
{
    public function flashcard(): BelongsTo
    {
        return $this->belongsTo(Flashcard::class);
    }

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'is_leech' => 'boolean',
            'previous_state' => 'array',
        ];
    }
}
