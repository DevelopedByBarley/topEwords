<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFlashcardDeckRequest;
use App\Http\Requests\UpdateFlashcardDeckRequest;
use App\Models\FlashcardDeck;
use App\Services\FlashcardSrsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FlashcardDeckController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $decks = $user->flashcardDecks()
            ->withCount('flashcards')
            ->latest()
            ->get();

        $folders = $user->flashcardFolders()->withCount('decks')->get()
            ->map(fn ($folder) => [
                'id' => $folder->id,
                'name' => $folder->name,
                'decks_count' => $folder->decks_count,
            ]);

        $deckIds = $decks->pluck('id')->all();

        $deckFolderIds = \DB::table('flashcard_deck_folder')
            ->join('flashcard_folders', 'flashcard_folders.id', '=', 'flashcard_deck_folder.flashcard_folder_id')
            ->where('flashcard_folders.user_id', $user->id)
            ->whereIn('flashcard_deck_folder.flashcard_deck_id', $deckIds)
            ->get(['flashcard_deck_folder.flashcard_deck_id', 'flashcard_deck_folder.flashcard_folder_id'])
            ->groupBy('flashcard_deck_id')
            ->map(fn ($rows) => $rows->pluck('flashcard_folder_id')->all())
            ->all();

        return Inertia::render('flashcards/index', [
            'decks' => $decks,
            'folders' => $folders,
            'deckFolderIds' => $deckFolderIds,
        ]);
    }

    public function store(StoreFlashcardDeckRequest $request): RedirectResponse
    {
        $deck = $request->user()->flashcardDecks()->create($request->validated());

        return to_route('flashcards.show', $deck);
    }

    public function show(Request $request, FlashcardDeck $deck, FlashcardSrsService $srs): Response
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $flashcards = $deck->flashcards()->with('reviews', 'word')->get();

        $settings = $request->user()->flashcardSettings ?? $srs->defaultSettings();
        $dueCount = $srs->getDueCards($deck->id, $settings)->count();

        return Inertia::render('flashcards/show', [
            'deck' => $deck,
            'flashcards' => $flashcards->map(fn ($card) => [
                'id' => $card->id,
                'front' => $card->front,
                'front_notes' => $card->front_notes,
                'front_speak' => $card->front_speak,
                'back' => $card->back,
                'back_notes' => $card->back_notes,
                'back_speak' => $card->back_speak,
                'direction' => $card->direction,
                'color' => $card->color,
                'word_id' => $card->word_id,
                // For 'both' cards show the worst (earliest due) of the two reviews
                'review' => $card->reviews->sortBy('due_at')->first() ? [
                    'state' => $card->reviews->sortBy('due_at')->first()->state,
                    'interval' => $card->reviews->sortBy('due_at')->first()->interval,
                    'lapses' => $card->reviews->sum('lapses'),
                    'is_leech' => $card->reviews->contains('is_leech', true),
                    'due_at' => $card->reviews->sortBy('due_at')->first()->due_at?->toIso8601String(),
                ] : null,
            ]),
            'dueCount' => $dueCount,
            'otherDecks' => $request->user()->flashcardDecks()
                ->where('id', '!=', $deck->id)
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function update(UpdateFlashcardDeckRequest $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $deck->update($request->validated());

        return to_route('flashcards.show', $deck);
    }

    public function destroy(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $deck->delete();

        return to_route('flashcards.index');
    }
}
