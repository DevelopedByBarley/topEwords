<?php

namespace App\Models;

use Database\Factories\FlashcardSettingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
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
    'calib_somewhat_min',
    'calib_somewhat_max',
    'calib_know_min',
    'calib_know_max',
    'calib_well_min',
    'calib_well_max',
])]
class FlashcardSetting extends Model
{
    /** @use HasFactory<FlashcardSettingFactory> */
    use HasFactory;

    protected $attributes = [
        'calib_somewhat_min' => 3,
        'calib_somewhat_max' => 7,
        'calib_know_min' => 8,
        'calib_know_max' => 21,
        'calib_well_min' => 22,
        'calib_well_max' => 50,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'learning_steps' => 'array',
        ];
    }
}
