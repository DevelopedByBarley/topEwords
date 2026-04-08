<?php

namespace App\Http\Controllers;

use App\Http\Requests\SubmitFlashcardReviewRequest;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Services\AchievementService;
use App\Services\FlashcardSrsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FlashcardStudyController extends Controller
{
    public function __construct(private FlashcardSrsService $srs) {}

    public function show(Request $request, FlashcardDeck $deck): Response
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $settings = $deck->deckSettings ?? $request->user()->flashcardSettings ?? $this->srs->defaultSettings();

        $dueItems = $this->srs->getDueCards($deck->id, $settings);

        $cards = $dueItems->map(function (array $item) use ($settings): array {
            /** @var Flashcard $card */
            $card = $item['card'];
            $direction = $item['direction'];

            $review = $this->srs->getOrCreateReview($card, $direction);
            $previews = $this->srs->getButtonPreviews($review, $settings);

            $otherDirection = $direction === 'front_to_back' ? 'back_to_front' : 'front_to_back';
            $otherReview = $card->direction === 'both'
                ? $card->reviews->firstWhere('direction', $otherDirection)
                : null;

            return [
                'id' => $card->id,
                'front' => $card->front,
                'front_notes' => $card->front_notes,
                'front_speak' => $card->front_speak,
                'back' => $card->back,
                'back_notes' => $card->back_notes,
                'back_speak' => $card->back_speak,
                'study_direction' => $direction,
                'color' => $card->color,
                'review' => [
                    'state' => $review->state,
                    'interval' => $review->interval,
                    'lapses' => $review->lapses,
                    'is_leech' => $review->is_leech,
                ],
                'previews' => $previews,
                'other_side_due_at' => $otherReview?->due_at?->toIso8601String(),
            ];
        })->values()->all();

        return Inertia::render('flashcards/study', [
            'deck' => ['id' => $deck->id, 'name' => $deck->name],
            'cards' => $cards,
        ]);
    }

    public function submit(SubmitFlashcardReviewRequest $request, FlashcardDeck $deck): JsonResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $flashcard = Flashcard::where('id', $request->integer('flashcard_id'))
            ->where('deck_id', $deck->id)
            ->firstOrFail();

        $settings = $deck->deckSettings ?? $request->user()->flashcardSettings ?? $this->srs->defaultSettings();

        $review = $this->srs->getOrCreateReview($flashcard, $request->string('direction'));

        $this->srs->processReview($review, $request->integer('rating'), $settings);

        $newAchievements = app(AchievementService::class)->checkAndAward($request->user(), ['flashcard']);

        return response()->json(['ok' => true, 'achievements' => $newAchievements]);
    }
}
