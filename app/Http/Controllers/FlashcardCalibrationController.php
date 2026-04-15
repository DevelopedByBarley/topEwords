<?php

namespace App\Http\Controllers;

use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class FlashcardCalibrationController extends Controller
{
    public function show(Request $request, FlashcardDeck $deck): Response|RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        // Only show imported cards that haven't been calibrated or studied yet
        // (cards with only 'new' state reviews are still uncalibrated)
        $uncalibratedCards = $deck->flashcards()
            ->where('is_imported', true)
            ->whereDoesntHave('reviews', fn ($q) => $q->whereIn('state', ['learning', 'review', 'relearning']))
            ->get(['id', 'front', 'front_notes', 'back', 'back_notes', 'direction', 'color']);

        if ($uncalibratedCards->isEmpty()) {
            return to_route('flashcards.show', $deck)->with('success', 'Nincs kalibrálásra váró kártya.');
        }

        return Inertia::render('flashcards/calibrate', [
            'deck' => ['id' => $deck->id, 'name' => $deck->name],
            'cards' => $uncalibratedCards->map(fn ($card) => [
                'id' => $card->id,
                'front' => $card->front,
                'front_notes' => $card->front_notes,
                'back' => $card->back,
                'back_notes' => $card->back_notes,
                'direction' => $card->direction,
                'color' => $card->color,
            ])->values()->all(),
        ]);
    }

    /**
     * Rate a single card during calibration.
     * rating 1 = don't know  → stays new (no review created)
     * rating 2 = somewhat    → review state, interval 7 days, spread 3–14 days
     * rating 3 = know it     → review state, interval 30 days, spread 15–60 days
     */
    public function rate(Request $request, FlashcardDeck $deck): JsonResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'flashcard_id' => ['required', 'integer'],
            'rating' => ['required', 'integer', 'between:1,3'],
        ]);

        $card = $deck->flashcards()->findOrFail($data['flashcard_id']);

        if ($data['rating'] === 1) {
            return response()->json(['ok' => true]);
        }

        [$interval, $spreadMin, $spreadMax] = $data['rating'] === 2
            ? [7, 3, 14]
            : [30, 15, 60];

        $daysOffset = random_int($spreadMin, $spreadMax);
        $directions = $card->direction === 'both'
            ? ['front_to_back', 'back_to_front']
            : [$card->direction];

        foreach ($directions as $direction) {
            FlashcardReview::updateOrCreate(
                ['flashcard_id' => $card->id, 'direction' => $direction],
                [
                    'state' => 'review',
                    'interval' => $interval,
                    'ease_factor' => 250,
                    'repetitions' => 1,
                    'lapses' => 0,
                    'learning_step' => 0,
                    'is_leech' => false,
                    'introduced_on' => Carbon::today()->toDateString(),
                    'reviewed_on' => Carbon::today()->toDateString(),
                    'due_at' => Carbon::today()->addDays($daysOffset),
                ]
            );
        }

        return response()->json(['ok' => true]);
    }
}
