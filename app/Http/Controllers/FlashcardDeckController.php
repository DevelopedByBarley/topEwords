<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFlashcardDeckRequest;
use App\Http\Requests\UpdateFlashcardDeckRequest;
use App\Http\Requests\UpdateFlashcardDeckSettingsRequest;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Services\AchievementService;
use App\Services\FlashcardSrsService;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class FlashcardDeckController extends Controller
{
    public function index(Request $request, FlashcardSrsService $srs): Response
    {
        $user = $request->user();

        $decks = $user->flashcardDecks()
            ->withCount('flashcards')
            ->with('deckSettings')
            ->latest()
            ->get();

        $folders = $user->flashcardFolders()->withCount('decks')->get()
            ->map(fn ($folder) => [
                'id' => $folder->id,
                'name' => $folder->name,
                'decks_count' => $folder->decks_count,
            ]);

        $deckIds = $decks->pluck('id')->all();

        $deckFolderIds = DB::table('flashcard_deck_folder')
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
            // countDueCards mirrors the canonical study queue (getDueCards) so the
            // badge matches exactly what a study session will present: uncalibrated
            // imports are excluded and the per-deck daily limits are applied.
            'dueCounts' => Inertia::defer(function () use ($decks, $user, $srs) {
                $userSettings = $user->flashcardSettings;
                $defaultSettings = $srs->defaultSettings();

                $dueCounts = [];
                foreach ($decks as $deck) {
                    $settings = $deck->deckSettings ?? $userSettings ?? $defaultSettings;
                    $dueCounts[$deck->id] = array_sum($srs->countDueCards($deck->id, $settings));
                }

                return $dueCounts;
            }),
        ]);
    }

    public function store(StoreFlashcardDeckRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $folderId = $validated['folder_id'] ?? null;

        // A keret-ellenőrzés és az insert közös per-user zár alatt fut, hogy
        // párhuzamos POST-ok ne csússzanak át ugyanazon az elavult pakli-számon
        // (TOCTOU) — ugyanaz a minta, mint a kártya-úton (reserveFlashcardSlots).
        try {
            $deck = $request->user()->reserveFlashcardDeckSlot(
                fn () => $request->user()->flashcardDecks()->create(
                    collect($validated)->except('folder_id')->all()
                )
            );
        } catch (LockTimeoutException) {
            // Zár-torlódásnál barátságos hiba 500 helyett — a create el sem indult;
            // ugyanaz a minta, mint a kártya-utakon (LIMIT-L1).
            return back()->with('error', 'A paklijaidon épp egy másik művelet fut. Próbáld újra pár másodperc múlva.');
        }

        if ($deck === null) {
            $limit = $request->user()->planLimit('decks');

            return back()->with('error', "Elérted a csomagod pakli-keretét ({$limit} pakli). Válts magasabb csomagra a folytatáshoz.");
        }

        if ($folderId) {
            $folder = $request->user()->flashcardFolders()->find($folderId);
            if ($folder) {
                $deck->folders()->attach($folder->id);
            }
        }

        $newAchievements = app(AchievementService::class)->checkAndAward($request->user(), ['flashcard']);
        if ($newAchievements) {
            session()->flash('achievements', $newAchievements);
        }

        return to_route('flashcards.show', $deck);
    }

    public function show(Request $request, FlashcardDeck $deck, FlashcardSrsService $srs): Response
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        // A session lock korai feloldása, hogy a deferred props párhuzamos kérése ne blokkolódjon
        session()->save();

        $effectiveSettings = $deck->deckSettings ?? $request->user()->flashcardSettings ?? $srs->defaultSettings();
        $dueCounts = $srs->countDueCards($deck->id, $effectiveSettings);

        return Inertia::render('flashcards/show', [
            'deck' => $deck,
            'flashcards' => Inertia::defer(function () use ($deck) {
                return $deck->flashcards()->with('reviews')->get()->map(function ($card) {
                    $worstReview = $card->reviews->sortBy('due_at')->first();

                    return [
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
                        'review' => $worstReview ? [
                            'state' => $worstReview->state,
                            'interval' => $worstReview->interval,
                            'ease_factor' => $worstReview->ease_factor,
                            'repetitions' => $worstReview->repetitions,
                            'lapses' => $card->reviews->sum('lapses'),
                            'is_leech' => $card->reviews->contains('is_leech', true),
                            'due_at' => $worstReview->due_at?->toIso8601String(),
                            'introduced_on' => $worstReview->introduced_on,
                            'reviewed_on' => $worstReview->reviewed_on,
                            'previous_state' => $worstReview->previous_state,
                        ] : null,
                        'all_reviews' => $card->reviews->map(fn ($r) => [
                            'direction' => $r->direction,
                            'state' => $r->state,
                            'interval' => $r->interval,
                            'ease_factor' => $r->ease_factor,
                            'repetitions' => $r->repetitions,
                            'lapses' => $r->lapses,
                            'learning_step' => $r->learning_step,
                            'is_leech' => $r->is_leech,
                            'due_at' => $r->due_at?->toIso8601String(),
                            'introduced_on' => $r->introduced_on,
                            'reviewed_on' => $r->reviewed_on,
                            'previous_state' => $r->previous_state,
                        ])->values()->all(),
                    ];
                });
            }),
            'newDueCount' => $dueCounts['new'],
            'reviewDueCount' => $dueCounts['review'],
            'nextDueAt' => DB::table('flashcard_reviews')
                ->join('flashcards', 'flashcards.id', '=', 'flashcard_reviews.flashcard_id')
                ->where('flashcards.deck_id', $deck->id)
                ->where('flashcard_reviews.due_at', '>', now())
                ->min('flashcard_reviews.due_at'),
            'uncalibratedCount' => $deck->flashcards()
                ->uncalibrated()
                ->selectRaw(
                    'direction, (SELECT COUNT(*) FROM flashcard_reviews WHERE flashcard_reviews.flashcard_id = flashcards.id AND flashcard_reviews.state IN (?, ?, ?)) as rated_count',
                    Flashcard::ACTIVE_REVIEW_STATES
                )
                ->get()
                ->sum(fn ($c) => $c->direction === 'both' ? 2 - $c->rated_count : 1),
            'deckSettings' => $deck->deckSettings,
            // Baseline the deck inherits when it has no override — so the settings
            // dialog shows the effective values, not hardcoded defaults.
            'globalSettings' => $request->user()->flashcardSettings ?? $srs->defaultSettings(),
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

    public function updateSettings(UpdateFlashcardDeckSettingsRequest $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $deck->deckSettings()->updateOrCreate(
            ['flashcard_deck_id' => $deck->id],
            $request->validated(),
        );

        return to_route('flashcards.show', $deck);
    }

    public function destroySettings(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $deck->deckSettings()->delete();

        return to_route('flashcards.show', $deck);
    }

    public function destroy(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $deck->delete();

        return to_route('flashcards.index');
    }
}
