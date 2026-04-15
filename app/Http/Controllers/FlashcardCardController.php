<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFlashcardRequest;
use App\Http\Requests\UpdateFlashcardRequest;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FlashcardCardController extends Controller
{
    public function store(StoreFlashcardRequest $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        if ($request->user()->isOnFreePlan() && $deck->flashcards()->count() >= 20) {
            return back()->with('error', 'Ingyenes fiókkal paklinként max 20 kártyát adhatsz hozzá. Frissíts prémiumra a korlátlan hozzáféréshez.');
        }

        $deck->flashcards()->create($request->validated());

        return to_route('flashcards.show', $deck);
    }

    public function importFromWord(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'word_id' => ['nullable', 'integer', 'exists:words,id'],
            'custom_word_id' => ['nullable', 'integer', 'exists:user_custom_words,id'],
        ]);

        if (! empty($data['custom_word_id'])) {
            $customWord = UserCustomWord::where('id', $data['custom_word_id'])
                ->where('user_id', $request->user()->id)
                ->firstOrFail();

            $deck->flashcards()->create([
                'front' => $customWord->word,
                'back' => $customWord->meaning_hu ?? '',
                'direction' => 'both',
            ]);

            session()->flash('flash', ['type' => 'success', 'message' => '"'.$customWord->word.'" hozzáadva a "'.$deck->name.'" deckhez.']);

            return back();
        }

        $word = Word::findOrFail($data['word_id']);

        $deck->flashcards()->create([
            'word_id' => $word->id,
            'front' => $word->word,
            'back' => $word->meaning_hu ?? '',
            'direction' => 'both',
        ]);

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

        $flashcard->reviews()->delete();

        return to_route('flashcards.show', $deck);
    }

    public function move(Request $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

        $targetDeckId = $request->validate([
            'target_deck_id' => ['required', 'integer', 'exists:flashcard_decks,id'],
        ])['target_deck_id'];

        $targetDeck = FlashcardDeck::findOrFail($targetDeckId);
        abort_unless($targetDeck->user_id === $request->user()->id, 403);

        $flashcard->update(['deck_id' => $targetDeckId]);

        return to_route('flashcards.show', $deck);
    }

    public function duplicate(Request $request, FlashcardDeck $deck, Flashcard $flashcard): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);
        abort_unless($flashcard->deck_id === $deck->id, 403);

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

        $deck->flashcards()->whereIn('id', $ids)->delete();

        return to_route('flashcards.show', $deck)->with('success', count($ids).' kártya törölve.');
    }

    public function bulkReset(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ])['ids'];

        $cards = $deck->flashcards()->whereIn('id', $ids)->get();
        foreach ($cards as $card) {
            $card->reviews()->delete();
        }

        return to_route('flashcards.show', $deck)->with('success', count($ids).' kártya haladása visszaállítva.');
    }

    public function bulkReverse(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
        ])['ids'];

        $deck->flashcards()->whereIn('id', $ids)->each(function (Flashcard $card) use ($deck) {
            $deck->flashcards()->create([
                'front' => $card->back,
                'front_notes' => $card->back_notes,
                'front_speak' => $card->back_speak,
                'back' => $card->front,
                'back_notes' => $card->front_notes,
                'back_speak' => $card->front_speak,
                'direction' => $card->direction,
                'color' => $card->color,
            ]);
        });

        return to_route('flashcards.show', $deck)->with('success', count($ids).' fordított másolat létrehozva.');
    }

    public function bulkMove(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer'],
            'target_deck_id' => ['required', 'integer', 'exists:flashcard_decks,id'],
        ]);

        $targetDeck = FlashcardDeck::findOrFail($validated['target_deck_id']);
        abort_unless($targetDeck->user_id === $request->user()->id, 403);

        $deck->flashcards()->whereIn('id', $validated['ids'])->update(['deck_id' => $targetDeck->id]);

        return to_route('flashcards.show', $deck)->with('success', count($validated['ids']).' kártya áthelyezve.');
    }
}
