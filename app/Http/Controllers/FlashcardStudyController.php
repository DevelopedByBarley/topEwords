<?php

namespace App\Http\Controllers;

use App\Http\Requests\SubmitFlashcardReviewRequest;
use App\Models\Flashcard;
use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Services\AchievementService;
use App\Services\FlashcardSrsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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

    public function undo(Request $request, FlashcardDeck $deck): JsonResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'flashcard_id' => ['required', 'integer'],
            'direction' => ['required', 'in:front_to_back,back_to_front'],
        ]);

        $flashcard = Flashcard::where('id', $data['flashcard_id'])
            ->where('deck_id', $deck->id)
            ->firstOrFail();

        $review = FlashcardReview::where('flashcard_id', $flashcard->id)
            ->where('direction', $data['direction'])
            ->firstOrFail();

        $prev = $review->previous_state;

        if ($prev === null || $prev['state'] === 'new') {
            $review->delete();
        } else {
            $review->state = $prev['state'];
            $review->due_at = $prev['due_at'] ? Carbon::parse($prev['due_at']) : null;
            $review->interval = $prev['interval'];
            $review->ease_factor = $prev['ease_factor'];
            $review->repetitions = $prev['repetitions'];
            $review->lapses = $prev['lapses'];
            $review->learning_step = $prev['learning_step'];
            $review->is_leech = $prev['is_leech'];
            $review->introduced_on = $prev['introduced_on'] ?? null;
            $review->reviewed_on = $prev['reviewed_on'] ?? null;
            $review->previous_state = null;
            $review->save();
        }

        return response()->json(['ok' => true]);
    }
}
