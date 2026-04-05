<?php

namespace App\Http\Controllers;

use App\Http\Requests\SubmitFlashcardReviewRequest;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
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

        $settings = $request->user()->flashcardSettings ?? $this->srs->defaultSettings();
        $items = $this->srs->getDueCards($deck->id, $settings);

        return Inertia::render('flashcards/study', [
            'deck' => $deck,
            'cards' => $items->map(function (array $item) use ($settings) {
                /** @var Flashcard $card */
                $card = $item['card'];
                $direction = $item['direction'];
                $review = $item['review'] ?? $this->srs->getOrCreateReview($card, $direction);

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
                        'state' => $review->state ?? 'new',
                        'interval' => $review->interval ?? 0,
                        'lapses' => $review->lapses ?? 0,
                        'is_leech' => $review->is_leech ?? false,
                    ],
                    'previews' => $this->srs->getButtonPreviews($review, $settings),
                ];
            }),
        ]);
    }

    public function submit(SubmitFlashcardReviewRequest $request, FlashcardDeck $deck): JsonResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $flashcard = Flashcard::where('id', $request->flashcard_id)
            ->where('deck_id', $deck->id)
            ->firstOrFail();

        $settings = $request->user()->flashcardSettings ?? $this->srs->defaultSettings();
        $review = $this->srs->getOrCreateReview($flashcard, $request->direction);
        $this->srs->processReview($review, $request->rating, $settings);

        return response()->json(['ok' => true]);
    }
}
