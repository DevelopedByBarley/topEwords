<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Az `is_imported` SZÁNDÉKOSAN nincs a fillable-ban: rendszer-vezérelt SRS-besorolási
 * flag, amit kizárólag a tömeges import (query-builder `insert`, mass-assignt megkerüli)
 * és a kalibráció (explicit `$card->is_imported = ...; save()`) állít — sosem user-payload.
 * A user-facing `store`/`update` a `validated()`-en megy át, ami nem tartalmazza; a fillable-ból
 * való kizárás ezt STRUKTURÁLISAN garantálja, nem a FormRequest-fegyelemre bízza (MA-4).
 * Elvetett alternatíva: a fillable-ban hagyni és a FormRequest hiányzó szabályára hagyatkozni —
 * az egy jövőbeli `$request->all()`-alapú create-helyen néma keret-megkerülést nyitna.
 */
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

    public function reviews(): HasMany
    {
        return $this->hasMany(FlashcardReview::class);
    }

    /**
     * Importált kártyák, amelyeknek még nincs minden irányban aktív (kalibrált) review-ja.
     */
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
