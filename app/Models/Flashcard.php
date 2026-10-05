<?php

namespace App\Models;

use App\Support\HtmlSanitizer;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['deck_id', 'word_id', 'front', 'front_notes', 'front_speak', 'back', 'back_notes', 'back_speak', 'direction', 'color'])]
class Flashcard extends Model
{
    public const ACTIVE_REVIEW_STATES = ['learning', 'review', 'relearning'];

    public function deck(): BelongsTo
    {
        return $this->belongsTo(FlashcardDeck::class, 'deck_id');
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(Word::class);
    }

    protected function front(): Attribute
    {
        return self::sanitizedHtml();
    }

    protected function back(): Attribute
    {
        return self::sanitizedHtml();
    }

    protected function frontNotes(): Attribute
    {
        return self::sanitizedHtml();
    }

    protected function backNotes(): Attribute
    {
        return self::sanitizedHtml();
    }

    private static function sanitizedHtml(): Attribute
    {
        return Attribute::make(set: fn (?string $value): ?string => HtmlSanitizer::clean($value));
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(FlashcardReview::class);
    }

    public function scopeUncalibrated(Builder $query): Builder
    {
        $activeStates = self::ACTIVE_REVIEW_STATES;

        return $query->where('is_imported', true)
            ->where(function ($q) use ($activeStates) {
                $q->where(function ($q2) use ($activeStates) {
                    $q2->where('direction', '!=', 'both')
                        ->whereDoesntHave('reviews', fn ($r) => $r->whereIn('state', $activeStates));
                })->orWhere(function ($q2) use ($activeStates) {
                    $q2->where('direction', 'both')
                        ->whereRaw(
                            '(SELECT COUNT(*) FROM flashcard_reviews WHERE flashcard_reviews.flashcard_id = flashcards.id AND flashcard_reviews.state IN (?, ?, ?)) < 2',
                            $activeStates
                        );
                });
            });
    }
}
