<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFlashcardRequest;
use App\Http\Requests\UpdateFlashcardRequest;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FlashcardCardController extends Controller
{
    /**
     * The plan-aware "card limit reached" message, naming the user's actual cap.
     */
    private function limitMessage(Request $request): string
    {
        $limit = $request->user()->planLimit('flashcards');

        return "Elérted a csomagod kártyakeretét (összesen {$limit} kártya). Válts magasabb csomagra a folytatáshoz.";
    }

    public function store(StoreFlashcardRequest $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $reserved = $request->user()->reserveFlashcardSlots(1, function () use ($deck, $request) {
            $deck->flashcards()->create($request->validated());
        });

        if (! $reserved) {
            return back()->with('error', $this->limitMessage($request));
        }

        return to_route('flashcards.show', $deck);
    }

    public function importFromWord(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'word_id' => ['required_without:custom_word_id', 'nullable', 'integer', 'exists:words,id'],
            'custom_word_id' => ['required_without:word_id', 'nullable', 'integer', 'exists:user_custom_words,id'],
        ]);

        if (! empty($data['custom_word_id'])) {
            $customWord = UserCustomWord::where('id', $data['custom_word_id'])
                ->where('user_id', $request->user()->id)
                ->firstOrFail();

            $attributes = [
                'front' => $customWord->word,
                'back' => $customWord->meaning_hu ?? '',
                'direction' => 'both',
            ];
        } else {
            $word = Word::findOrFail($data['word_id']);

            $attributes = [
                'word_id' => $word->id,
                'front' => $word->word,
                'back' => $word->meaning_hu ?? '',
                'direction' => 'both',
            ];
        }

        /** @var Flashcard|null $flashcard */
        $flashcard = null;
        $reserved = $request->user()->reserveFlashcardSlots(1, function () use ($deck, $attributes, &$flashcard) {
            $flashcard = $deck->flashcards()->create($attributes);
        });

        if (! $reserved || $flashcard === null) {
            return back()->with('error', $this->limitMessage($request));
        }

        session()->flash('imported_card_id', $flashcard->id);

        return to_route('flashcards.show', $deck);
    }

    public function update(UpdateFlashcardRequest $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

        $flashcard->update($request->validated());

        return to_route('flashcards.show', $deck);
    }

    public function resetProgress(Request $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

        // A review-k törlése önmagában visszaviszi a kártyát a megfelelő sorba: egy
        // importált kártya (is_imported=true) review nélkül újra a kalibrációs sorba
        // esik, egy kézzel létrehozott (is_imported=false) a normál új-kártya sorba.
        // Az is_imported-ot NEM piszkáljuk — különben egy sosem-importált kártya
        // reset után váratlanul kalibrációt követelne (#F1, korrigálja az #R8-at).
        $flashcard->reviews()->delete();

        return to_route('flashcards.show', $deck);
    }

    public function move(Request $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

        $validated = $request->validate([
            'target_deck_id' => ['required', 'integer', 'exists:flashcard_decks,id'],
            'reset_progress' => ['boolean'],
        ]);

        $targetDeck = FlashcardDeck::findOrFail($validated['target_deck_id']);
        abort_unless($targetDeck->user_id === $request->user()->id, 403);

        $flashcard->update(['deck_id' => $validated['target_deck_id']]);

        if ($validated['reset_progress'] ?? false) {
            $flashcard->reviews()->delete();
        }

        return to_route('flashcards.show', $deck);
    }

    public function duplicate(Request $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

        $reserved = $request->user()->reserveFlashcardSlots(1, function () use ($deck, $flashcard) {
            $deck->flashcards()->create([
                'word_id' => $flashcard->word_id,
                'front' => $flashcard->front,
                'front_notes' => $flashcard->front_notes,
                'front_speak' => $flashcard->front_speak,
                'back' => $flashcard->back,
                'back_notes' => $flashcard->back_notes,
                'back_speak' => $flashcard->back_speak,
                'direction' => $flashcard->direction,
                'color' => $flashcard->color,
            ]);
        });

        if (! $reserved) {
            return back()->with('error', $this->limitMessage($request));
        }

        return to_route('flashcards.show', $deck);
    }

    public function destroy(Request $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

        $flashcard->delete();

        return to_route('flashcards.show', $deck);
    }

    public function bulkDelete(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ])['ids'];

        $deleted = $deck->flashcards()->whereIn('id', $ids)->delete();

        return to_route('flashcards.show', $deck)->with('success', $deleted.' kártya törölve.');
    }

    public function bulkReset(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ])['ids'];

        $ownedIds = $deck->flashcards()->whereIn('id', $ids)->pluck('id');
        // Csak a review-kat töröljük; az is_imported-ot nem írjuk felül, hogy a
        // sosem-importált kártyák reset után ne kerüljenek kalibrációs sorba (#F1).
        FlashcardReview::whereIn('flashcard_id', $ownedIds)->delete();

        return to_route('flashcards.show', $deck)->with('success', $ownedIds->count().' kártya haladása visszaállítva.');
    }

    public function bulkReverse(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ])['ids'];

        $cards = $deck->flashcards()->whereIn('id', $ids)->get();

        $now = now();
        $reserved = $request->user()->reserveFlashcardSlots($cards->count(), function () use ($deck, $cards, $now) {
            $deck->flashcards()->insert($cards->map(fn (Flashcard $card) => [
                'deck_id' => $deck->id,
                'front' => $card->back,
                'front_notes' => $card->back_notes,
                'front_speak' => $card->back_speak,
                'back' => $card->front,
                'back_notes' => $card->front_notes,
                'back_speak' => $card->front_speak,
                'direction' => $card->direction,
                'color' => $card->color,
                // A fordított másolat is importált kártyaként indul, hogy a többi
                // tömeges import-úthoz hasonlóan előbb a kalibrációs sorba menjen (#R5).
                'is_imported' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all());
        });

        if (! $reserved) {
            return back()->with('error', $this->limitMessage($request));
        }

        return to_route('flashcards.show', $deck)->with('success', $cards->count().' fordított másolat létrehozva.');
    }

    public function bulkDirection(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
            'direction' => ['required', 'in:front_to_back,back_to_front,both'],
        ]);

        $ownedIds = $deck->flashcards()->whereIn('id', $validated['ids'])->pluck('id');
        $updated = $deck->flashcards()->whereIn('id', $ownedIds)->update(['direction' => $validated['direction']]);

        // Egyirányúra váltásnál a másik irány review-sora árván maradna (a study-sorból
        // kiesik, de a statisztikát és a due-számlálót torzítaná). A 'both' minden irányt
        // megtart, így ott nincs mit takarítani (#R6).
        if ($validated['direction'] !== 'both' && $ownedIds->isNotEmpty()) {
            FlashcardReview::whereIn('flashcard_id', $ownedIds)
                ->where('direction', '!=', $validated['direction'])
                ->delete();
        }

        return to_route('flashcards.show', $deck)->with('success', $updated.' kártya iránya frissítve.');
    }

    public function bulkMove(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
            'target_deck_id' => ['required', 'integer', 'exists:flashcard_decks,id'],
            'reset_progress' => ['boolean'],
        ]);

        $targetDeck = FlashcardDeck::findOrFail($validated['target_deck_id']);
        abort_unless($targetDeck->user_id === $request->user()->id, 403);

        $ownedIds = $deck->flashcards()->whereIn('id', $validated['ids'])->pluck('id');
        $moved = $deck->flashcards()->whereIn('id', $ownedIds)->update(['deck_id' => $targetDeck->id]);

        if (($validated['reset_progress'] ?? false) && $ownedIds->isNotEmpty()) {
            FlashcardReview::whereIn('flashcard_id', $ownedIds)->delete();
        }

        return to_route('flashcards.show', $deck)->with('success', $moved.' kártya áthelyezve.');
    }
}
