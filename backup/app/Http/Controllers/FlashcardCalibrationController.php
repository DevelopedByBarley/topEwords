<?php

namespace App\Http\Controllers;

use App\Models\FlashcardDeck;
use App\Models\FlashcardReview;
use App\Models\FlashcardSetting;
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

        $batchSize = 50;
        $activeStates = ['learning', 'review', 'relearning'];

        $baseQuery = $deck->flashcards()
            ->where('is_imported', true)
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

        $totalRemaining = $baseQuery->count();

        if ($totalRemaining === 0) {
            return to_route('flashcards.show', $deck)->with('success', 'Nincs kalibrálásra váró kártya.');
        }

        $uncalibratedCards = (clone $baseQuery)
            ->limit($batchSize)
            ->with(['reviews' => fn ($q) => $q->whereIn('state', $activeStates)])
            ->get(['id', 'front', 'front_notes', 'back', 'back_notes', 'direction', 'color']);

        $settings = FlashcardSetting::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'calib_somewhat_min' => 3,
                'calib_somewhat_max' => 7,
                'calib_know_min' => 8,
                'calib_know_max' => 21,
                'calib_well_min' => 22,
                'calib_well_max' => 50,
            ]
        )->refresh();

        $expandedCards = $uncalibratedCards->flatMap(function ($card) {
            $base = [
                'id' => $card->id,
                'front' => $card->front,
                'front_notes' => $card->front_notes,
                'back' => $card->back,
                'back_notes' => $card->back_notes,
                'direction' => $card->direction,
                'color' => $card->color,
            ];

            if ($card->direction !== 'both') {
                return [array_merge($base, ['calibration_direction' => $card->direction, 'is_last_direction' => true])];
            }

            $ratedDirs = $card->reviews->pluck('direction')->toArray();
            $pending = array_values(array_filter(
                ['front_to_back', 'back_to_front'],
                fn ($d) => ! in_array($d, $ratedDirs, true)
            ));

            return array_map(function ($dir, $i) use ($base, $pending) {
                return array_merge($base, [
                    'calibration_direction' => $dir,
                    'is_last_direction' => $i === count($pending) - 1,
                ]);
            }, $pending, array_keys($pending));
        });

        return Inertia::render('flashcards/calibrate', [
            'deck' => ['id' => $deck->id, 'name' => $deck->name],
            'totalRemaining' => $totalRemaining,
            'cards' => $expandedCards->shuffle()->values()->all(),
            'calibIntervals' => [
                'somewhat_min' => $settings->calib_somewhat_min ?? 3,
                'somewhat_max' => $settings->calib_somewhat_max ?? 7,
                'know_min' => $settings->calib_know_min ?? 8,
                'know_max' => $settings->calib_know_max ?? 21,
                'well_min' => $settings->calib_well_min ?? 22,
                'well_max' => $settings->calib_well_max ?? 50,
            ],
        ]);
    }

    public function rate(Request $request, FlashcardDeck $deck): JsonResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'flashcard_id' => ['required', 'integer'],
            'rating' => ['required', 'integer', 'between:1,4'],
            'direction' => ['required', 'in:front_to_back,back_to_front'],
            'is_last_direction' => ['required', 'boolean'],
            'somewhat_min' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'somewhat_max' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'know_min' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'know_max' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'well_min' => ['sometimes', 'integer', 'min:1', 'max:365'],
            'well_max' => ['sometimes', 'integer', 'min:1', 'max:365'],
        ]);

        $settings = FlashcardSetting::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'calib_somewhat_min' => 3,
                'calib_somewhat_max' => 7,
                'calib_know_min' => 8,
                'calib_know_max' => 21,
                'calib_well_min' => 22,
                'calib_well_max' => 50,
            ]
        )->refresh();

        $intervalKeys = ['somewhat_min', 'somewhat_max', 'know_min', 'know_max', 'well_min', 'well_max'];
        $updates = [];
        foreach ($intervalKeys as $key) {
            if (isset($data[$key])) {
                $updates["calib_{$key}"] = $data[$key];
            }
        }
        if (! empty($updates)) {
            $settings->update($updates);
        }

        $card = $deck->flashcards()->findOrFail($data['flashcard_id']);

        if ($data['rating'] === 1) {
            if ($data['is_last_direction']) {
                $card->update(['is_imported' => false]);
            }

            return response()->json(['ok' => true]);
        }

        $somewhatMin = $settings->calib_somewhat_min;
        $somewhatMax = $settings->calib_somewhat_max;
        $knowMin = $settings->calib_know_min;
        $knowMax = $settings->calib_know_max;
        $wellMin = $settings->calib_well_min;
        $wellMax = $settings->calib_well_max;

        [$interval, $spreadMin, $spreadMax] = match ($data['rating']) {
            2 => [(int) round(($somewhatMin + $somewhatMax) / 2), $somewhatMin, $somewhatMax],
            3 => [(int) round(($knowMin + $knowMax) / 2), $knowMin, $knowMax],
            4 => [(int) round(($wellMin + $wellMax) / 2), $wellMin, $wellMax],
        };

        $daysOffset = random_int($spreadMin, $spreadMax);

        FlashcardReview::updateOrCreate(
            ['flashcard_id' => $card->id, 'direction' => $data['direction']],
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

        if ($data['is_last_direction']) {
            $card->update(['is_imported' => false]);
        }

        return response()->json(['ok' => true]);
    }

    public function skip(Request $request, FlashcardDeck $deck): RedirectResponse
    {
        abort_unless($deck->user_id === $request->user()->id, 403);

        $deck->flashcards()
            ->where('is_imported', true)
            ->whereDoesntHave('reviews', fn ($q) => $q->whereIn('state', ['learning', 'review', 'relearning']))
            ->update(['is_imported' => false]);

        return to_route('flashcards.show', $deck)->with('success', 'Kalibráció kihagyva — a kártyák bekerültek a tanulási sorba.');
    }
}
