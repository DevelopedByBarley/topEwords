<?php

namespace App\Services;

use App\Models\Flashcard;
use App\Models\FlashcardDeckSetting;
use App\Models\FlashcardReview;
use App\Models\FlashcardSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class FlashcardSrsService
{
    // Rating constants
    const AGAIN = 1;

    const HARD = 2;

    const GOOD = 3;

    const EASY = 4;

    public function defaultSettings(): FlashcardSetting
    {
        return new FlashcardSetting([
            'new_cards_per_day' => 20,
            'max_reviews_per_day' => 200,
            'learning_steps' => [1, 10],
            'graduating_interval' => 1,
            'easy_interval' => 4,
            'starting_ease' => 250,
            'easy_bonus' => 130,
            'hard_interval_modifier' => 120,
            'interval_modifier' => 100,
            'max_interval' => 365,
            'lapse_new_interval' => 0,
            'leech_threshold' => 8,
            'shuffle_cards' => false,
        ]);
    }

    /**
     * Returns preview labels for each rating button without saving.
     *
     * @return array{again: string, hard: string, good: string, easy: string}
     */
    public function getButtonPreviews(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): array
    {
        $steps = array_map('intval', $settings->learning_steps);
        $isLearning = in_array($review->state, ['new', 'learning', 'relearning']);

        if ($isLearning) {
            $step = min($review->learning_step ?? 0, count($steps) - 1);
            $nextStep = $step + 1;
            $isRelearning = $review->state === 'relearning';

            $again = $this->formatMinutes($steps[0]);
            $hard = $this->formatMinutes(max($steps[0] + 1, (int) round($steps[$step] * 1.5)));

            if ($nextStep < count($steps)) {
                $good = $this->formatMinutes($steps[$nextStep]);
            } elseif ($isRelearning) {
                $good = $this->formatDays(max(1, $review->interval));
            } else {
                $good = $this->formatDays($settings->graduating_interval);
            }

            $easy = $isRelearning
                ? $this->formatDays(max(1, $review->interval))
                : $this->formatDays($settings->easy_interval);
        } else {
            $interval = $review->interval;
            $ease = $review->ease_factor;

            $againInterval = max(1, (int) round($interval * $settings->lapse_new_interval / 100));
            $hardInterval = min(
                max($interval + 1, (int) round($interval * $settings->hard_interval_modifier / 100)),
                $settings->max_interval
            );
            $goodInterval = min(
                max($interval + 1, (int) round($interval * $ease / 100 * $settings->interval_modifier / 100)),
                $settings->max_interval
            );
            $easyInterval = min(
                max($goodInterval + 1, (int) round($interval * $ease / 100 * $settings->easy_bonus / 100 * $settings->interval_modifier / 100)),
                $settings->max_interval
            );

            $again = $this->formatMinutes($steps[0]).' (→ '.$this->formatDays($againInterval).')';
            $hard = $this->formatDays($hardInterval);
            $good = $this->formatDays($goodInterval);
            $easy = $this->formatDays($easyInterval);
        }

        return compact('again', 'hard', 'good', 'easy');
    }

    private function formatMinutes(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes.' perc';
        }

        if ($minutes >= 1440) {
            return $this->formatDays((int) round($minutes / 1440));
        }

        $hours = round($minutes / 60, 1);

        return $hours.' óra';
    }

    private function formatDays(int $days): string
    {
        if ($days === 1) {
            return '1 nap';
        }

        return $days.' nap';
    }

    public function processReview(FlashcardReview $review, int $rating, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $today = Carbon::today()->toDateString();

        $review->previous_state = [
            'state' => $review->state,
            'due_at' => $review->due_at?->toIso8601String(),
            'interval' => $review->interval,
            'ease_factor' => $review->ease_factor,
            'repetitions' => $review->repetitions,
            'lapses' => $review->lapses,
            'learning_step' => $review->learning_step,
            'is_leech' => $review->is_leech,
            'introduced_on' => $review->introduced_on,
            'reviewed_on' => $review->reviewed_on,
        ];

        // Track when the card first left 'new' state (once only)
        if ($review->state === 'new' && $review->introduced_on === null) {
            $review->introduced_on = $today;
        }

        $review->reviewed_on = $today;

        match ($review->state) {
            'new', 'learning', 'relearning' => $this->processLearning($review, $rating, $settings),
            'review' => $this->processReview_($review, $rating, $settings),
            default => null,
        };

        $review->save();
    }

    /**
     * Get or create a FlashcardReview for a specific direction.
     */
    public function getOrCreateReview(Flashcard $flashcard, string $direction): FlashcardReview
    {
        return FlashcardReview::firstOrCreate(
            ['flashcard_id' => $flashcard->id, 'direction' => $direction],
            [
                'state' => 'new',
                'due_at' => null,
                'interval' => 0,
                'ease_factor' => 250,
                'repetitions' => 0,
                'lapses' => 0,
                'learning_step' => 0,
                'is_leech' => false,
            ]
        );
    }

    /**
     * Returns all directions a flashcard should be studied in.
     *
     * @return string[]
     */
    public function directionsFor(Flashcard $flashcard): array
    {
        return $flashcard->direction === 'both'
            ? ['front_to_back', 'back_to_front']
            : [$flashcard->direction];
    }

    /**
     * Fetch the study items due in the given deck.
     * Each item is ['card' => Flashcard, 'direction' => string, 'review' => FlashcardReview|null].
     *
     * @return Collection<int, array{card: Flashcard, direction: string, review: FlashcardReview|null}>
     */
    public function getDueCards(int $deckId, FlashcardSetting|FlashcardDeckSetting $settings): Collection
    {
        $now = Carbon::now();
        $today = Carbon::today()->toDateString();

        $cards = Flashcard::where('deck_id', $deckId)
            ->with('reviews')
            ->get();

        // Count how many unique cards were already introduced / reviewed today.
        // We count per physical card (not per direction) so that a 'both'-direction
        // card doesn't consume two slots toward the daily limit.
        $newCardIdsIntroducedToday = [];
        $reviewCardIdsDoneToday = [];

        foreach ($cards as $card) {
            foreach ($card->reviews as $review) {
                if ($review->introduced_on === $today) {
                    $newCardIdsIntroducedToday[$card->id] = true;
                }
                if ($review->reviewed_on === $today && $review->introduced_on !== null && $review->introduced_on < $today) {
                    $reviewCardIdsDoneToday[$card->id] = true;
                }
            }
        }

        $effectiveNewLimit = max(0, $settings->new_cards_per_day - count($newCardIdsIntroducedToday));
        $effectiveReviewLimit = max(0, $settings->max_reviews_per_day - count($reviewCardIdsDoneToday));

        $newItems = collect();
        $learningItems = collect();
        $reviewItems = collect();

        foreach ($cards as $card) {
            foreach ($this->directionsFor($card) as $direction) {
                $review = $card->reviews->firstWhere('direction', $direction);

                if (! $review || $review->state === 'new') {
                    // Imported cards with no review are pending calibration — exclude from new queue
                    if ($card->is_imported && ! $review) {
                        continue;
                    }
                    $newItems->push(['card' => $card, 'direction' => $direction, 'review' => $review]);
                } elseif (in_array($review->state, ['learning', 'relearning'])) {
                    if (! $review->due_at || $review->due_at->lte($now)) {
                        $learningItems->push(['card' => $card, 'direction' => $direction, 'review' => $review]);
                    }
                } elseif ($review->state === 'review' && $review->due_at?->lte($now)) {
                    $reviewItems->push(['card' => $card, 'direction' => $direction, 'review' => $review]);
                }
            }
        }

        $result = $this->takeByUniqueCards($newItems, $effectiveNewLimit)
            ->merge($learningItems)
            ->merge($this->takeByUniqueCards($reviewItems, $effectiveReviewLimit))
            ->values();

        if ($settings->shuffle_cards) {
            return $this->shuffleNoAdjacentPairs($result);
        }

        return $result;
    }

    /**
     * Shuffle items ensuring no two adjacent items share the same card ID.
     * A 'both'-direction card produces two items with the same card ID; this method
     * guarantees they are never placed next to each other (as long as there are at
     * least two distinct card IDs in the collection).
     *
     * Strategy: Fisher–Yates shuffle, then a repair pass that moves same-card-ID
     * neighbours to a random non-adjacent position. Bounded by n² iterations so
     * it always terminates even if the arrangement is impossible (e.g. only one
     * unique card ID present).
     *
     * @param  Collection<int, array{card: Flashcard, direction: string, review: FlashcardReview|null}>  $items
     * @return Collection<int, array{card: Flashcard, direction: string, review: FlashcardReview|null}>
     */
    private function shuffleNoAdjacentPairs(Collection $items): Collection
    {
        $arr = $items->shuffle()->values()->all();
        $n = count($arr);

        if ($n <= 2) {
            return collect($arr);
        }

        for ($iter = 0; $iter < $n * $n; $iter++) {
            $conflict = -1;
            for ($i = 0; $i < $n - 1; $i++) {
                if ($arr[$i]['card']->id === $arr[$i + 1]['card']->id) {
                    $conflict = $i;
                    break;
                }
            }

            if ($conflict === -1) {
                break; // No conflicts — done
            }

            // Positions that are not immediately adjacent to the conflict
            $candidates = array_values(array_filter(
                range(0, $n - 1),
                fn ($j) => $j !== $conflict && $j !== $conflict + 1
            ));

            if (empty($candidates)) {
                break; // Only one unique card ID — impossible to resolve
            }

            $target = $candidates[array_rand($candidates)];
            [$arr[$conflict + 1], $arr[$target]] = [$arr[$target], $arr[$conflict + 1]];
        }

        return collect($arr);
    }

    /**
     * Take items from a collection until $limit unique card IDs have been collected.
     * This ensures a 'both'-direction card only counts as one toward the daily limit.
     *
     * @param  Collection<int, array{card: Flashcard, direction: string, review: FlashcardReview|null}>  $items
     * @return Collection<int, array{card: Flashcard, direction: string, review: FlashcardReview|null}>
     */
    private function takeByUniqueCards(Collection $items, int $limit): Collection
    {
        $seenCardIds = [];
        $result = [];

        foreach ($items as $item) {
            $cardId = $item['card']->id;

            if (! array_key_exists($cardId, $seenCardIds)) {
                if (count($seenCardIds) >= $limit) {
                    continue;
                }

                $seenCardIds[$cardId] = true;
            }

            $result[] = $item;
        }

        return collect($result);
    }

    private function processLearning(FlashcardReview $review, int $rating, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $steps = array_map('intval', $settings->learning_steps); // array of minutes

        match ($rating) {
            self::AGAIN => $this->learningAgain($review, $steps),
            self::HARD => $this->learningHard($review, $steps),
            self::GOOD => $this->learningGood($review, $steps, $settings),
            self::EASY => $this->learningEasy($review, $settings),
        };
    }

    private function learningAgain(FlashcardReview $review, array $steps): void
    {
        $review->state = 'learning';
        $review->learning_step = 0;
        $review->due_at = Carbon::now()->addMinutes($steps[0]);
    }

    private function learningHard(FlashcardReview $review, array $steps): void
    {
        $safeStep = min($review->learning_step, count($steps) - 1);
        $review->state = 'learning';
        $minutes = max($steps[0] + 1, (int) round($steps[$safeStep] * 1.5));
        $review->due_at = Carbon::now()->addMinutes($minutes);
    }

    private function learningGood(FlashcardReview $review, array $steps, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $nextStep = $review->learning_step + 1;

        if ($nextStep >= count($steps)) {
            $isRelearning = $review->state === 'relearning';

            $review->state = 'review';
            $review->learning_step = 0;
            $review->repetitions = max(1, $review->repetitions);

            if ($isRelearning) {
                // Relearning card: interval and ease were already set by reviewAgain — just reschedule.
                $review->due_at = Carbon::now()->addDays(max(1, $review->interval));
            } else {
                // New card graduating for the first time.
                $review->interval = $settings->graduating_interval;
                $review->ease_factor = $settings->starting_ease;
                $review->due_at = Carbon::now()->addDays($settings->graduating_interval);
            }
        } else {
            $review->state = 'learning';
            $review->learning_step = $nextStep;
            $review->due_at = Carbon::now()->addMinutes($steps[$nextStep]);
        }
    }

    private function learningEasy(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $isRelearning = $review->state === 'relearning';

        $review->state = 'review';
        $review->learning_step = 0;
        $review->repetitions = max(1, $review->repetitions);

        if ($isRelearning) {
            // Relearning card: schedule with current interval (set by reviewAgain), ease stays.
            $review->due_at = Carbon::now()->addDays(max(1, $review->interval));
        } else {
            // New card graduating easy.
            $review->interval = $settings->easy_interval;
            $review->ease_factor = $settings->starting_ease;
            $review->due_at = Carbon::now()->addDays($settings->easy_interval);
        }
    }

    private function processReview_(FlashcardReview $review, int $rating, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        match ($rating) {
            self::AGAIN => $this->reviewAgain($review, $settings),
            self::HARD => $this->reviewHard($review, $settings),
            self::GOOD => $this->reviewGood($review, $settings),
            self::EASY => $this->reviewEasy($review, $settings),
        };
    }

    private function reviewAgain(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $review->lapses++;
        $review->ease_factor = max(130, $review->ease_factor - 20);
        $review->state = 'relearning';
        $review->learning_step = 0;
        $review->interval = max(1, (int) round($review->interval * $settings->lapse_new_interval / 100));

        $steps = array_map('intval', $settings->learning_steps);
        $review->due_at = Carbon::now()->addMinutes($steps[0]);
        $review->is_leech = $review->lapses >= $settings->leech_threshold;
    }

    private function reviewHard(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $newInterval = max(
            $review->interval + 1,
            (int) round($review->interval * $settings->hard_interval_modifier / 100)
        );
        $review->interval = min($newInterval, $settings->max_interval);
        $review->ease_factor = max(130, $review->ease_factor - 15);
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function reviewGood(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $newInterval = (int) round(
            $review->interval * $review->ease_factor / 100 * $settings->interval_modifier / 100
        );
        $review->interval = min(max($review->interval + 1, $newInterval), $settings->max_interval);
        $review->repetitions++;
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function reviewEasy(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $goodInterval = min(
            max($review->interval + 1, (int) round($review->interval * $review->ease_factor / 100 * $settings->interval_modifier / 100)),
            $settings->max_interval
        );
        $easyInterval = (int) round(
            $review->interval * $review->ease_factor / 100
            * $settings->easy_bonus / 100
            * $settings->interval_modifier / 100
        );
        $review->interval = min(max($goodInterval + 1, $easyInterval), $settings->max_interval);
        $review->ease_factor = min(999, $review->ease_factor + 15);
        $review->repetitions++;
        $review->due_at = Carbon::now()->addDays($review->interval);
    }
}
