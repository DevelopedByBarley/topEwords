<?php

namespace App\Services;

use App\Models\Flashcard;
use App\Models\FlashcardDeckSetting;
use App\Models\FlashcardReview;
use App\Models\FlashcardSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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
            'shuffle_cards' => true,
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
            $hard = $this->formatMinutes($this->learningHardMinutes($review, $steps, $settings));

            if ($nextStep < count($steps)) {
                $good = $this->formatMinutes($steps[$nextStep]);
            } elseif ($isRelearning) {
                $good = $this->formatDays(max(1, $review->interval));
            } else {
                $good = $this->formatDays($this->graduatingInterval($settings, $steps, $step));
            }

            $easy = $isRelearning
                ? $this->formatDays($this->relearningEasyInterval($review, $settings))
                : $this->formatDays($this->easyInterval($settings, $steps, $step));
        } else {
            $againInterval = max(1, (int) round($review->interval * $settings->lapse_new_interval / 100));

            $again = $this->formatMinutes($steps[0]).' (→ '.$this->formatDays($againInterval).')';
            $hard = $this->formatDays($this->hardIntervalFor($review, $settings));
            $good = $this->formatDays($this->goodIntervalFor($review, $settings));
            $easy = $this->formatDays($this->easyIntervalFor($review, $settings));
        }

        return compact('again', 'hard', 'good', 'easy');
    }

    private function formatMinutes(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes.' perc';
        }

        $hours = round($minutes / 60, 1);

        // Round to days once the displayed hour count reaches a full day, so a
        // near-day delay (e.g. 1439 min → 23.98 h → "24 óra") never renders the
        // same as Good's "1 nap". Comparing the rounded hours, not the raw
        // minutes, closes the 1436–1439 min gap the >= 1440 check left open.
        if ($hours >= 24) {
            return $this->formatDays((int) round($minutes / 1440));
        }

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
            $this->defaultReviewAttributes()
        );
    }

    /**
     * Unsaved review instance with default values — for previews without touching the DB.
     */
    public function newReviewFor(Flashcard $flashcard, string $direction): FlashcardReview
    {
        return new FlashcardReview([
            'flashcard_id' => $flashcard->id,
            'direction' => $direction,
            ...$this->defaultReviewAttributes(),
        ]);
    }

    /** @return array<string, mixed> */
    private function defaultReviewAttributes(): array
    {
        return [
            'state' => 'new',
            'due_at' => null,
            'interval' => 0,
            'ease_factor' => 250,
            'repetitions' => 0,
            'lapses' => 0,
            'learning_step' => 0,
            'is_leech' => false,
        ];
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

        // Cards already started today (one direction of a 'both' card) are pre-counted,
        // so their remaining new direction comes through without consuming another slot.
        $result = $this->takeByUniqueCards($newItems, $settings->new_cards_per_day, $newCardIdsIntroducedToday)
            ->merge($learningItems)
            ->merge($this->takeByUniqueCards($reviewItems, $effectiveReviewLimit))
            ->values();

        if ($settings->shuffle_cards) {
            return $this->shuffleNoAdjacentPairs($result);
        }

        return $result;
    }

    /**
     * Count the study items getDueCards() would return, without hydrating models.
     *
     * Mirrors getDueCards() exactly (calibration exclusion, per-direction items,
     * unique-card daily limits) but aggregates the reviews per card in SQL, so
     * large decks are never fully loaded just to render a badge number.
     *
     * @return array{new: int, review: int} 'new' = items without a review or in 'new'
     *                                      state; 'review' = due learning/relearning/review items
     */
    public function countDueCards(int $deckId, FlashcardSetting|FlashcardDeckSetting $settings): array
    {
        $now = Carbon::now()->toDateTimeString();
        $today = Carbon::today()->toDateString();

        // A review only counts as a study item if its direction is one the card still
        // uses (getDueCards() iterates directionsFor() and skips stale directions).
        // The IS NOT NULL guard keeps the LEFT JOIN's all-NULL row (card without any
        // review) from slipping through the 'both' branch. The daily-limit trackers
        // (introduced_on / reviewed_on) intentionally look at every review, matching
        // the unfiltered loop in getDueCards().
        $matchesDirection = "flashcard_reviews.id IS NOT NULL AND (flashcards.direction = 'both' OR flashcard_reviews.direction = flashcards.direction)";

        $cards = DB::table('flashcards')
            ->leftJoin('flashcard_reviews', 'flashcard_reviews.flashcard_id', '=', 'flashcards.id')
            ->where('flashcards.deck_id', $deckId)
            ->groupBy('flashcards.id', 'flashcards.direction', 'flashcards.is_imported')
            ->orderBy('flashcards.id')
            ->selectRaw("
                CASE WHEN flashcards.direction = 'both' THEN 2 ELSE 1 END as direction_count,
                flashcards.is_imported,
                COUNT(CASE WHEN {$matchesDirection} THEN 1 END) as review_rows,
                COUNT(CASE WHEN {$matchesDirection} AND flashcard_reviews.state = 'new' THEN 1 END) as new_state_rows,
                COUNT(CASE WHEN {$matchesDirection} AND flashcard_reviews.state IN ('learning', 'relearning') AND (flashcard_reviews.due_at IS NULL OR flashcard_reviews.due_at <= ?) THEN 1 END) as learning_due,
                COUNT(CASE WHEN {$matchesDirection} AND flashcard_reviews.state = 'review' AND flashcard_reviews.due_at <= ? THEN 1 END) as review_due,
                MAX(CASE WHEN flashcard_reviews.introduced_on = ? THEN 1 ELSE 0 END) as introduced_today,
                MAX(CASE WHEN flashcard_reviews.reviewed_on = ? AND flashcard_reviews.introduced_on < ? THEN 1 ELSE 0 END) as reviewed_today
            ", [$now, $now, $today, $today, $today])
            ->get();

        // Same budget arithmetic as takeByUniqueCards(): cards introduced today are
        // pre-counted toward the new limit, so only (limit - introducedToday) further
        // unique cards may enter the new queue; reviews done today shrink that limit.
        $newBudget = max(0, $settings->new_cards_per_day - $cards->where('introduced_today', 1)->count());
        $reviewBudget = max(0, $settings->max_reviews_per_day - $cards->where('reviewed_today', 1)->count());

        $newCount = 0;
        $reviewCount = 0;

        foreach ($cards as $card) {
            // Directions with a 'new' review, plus directions with no review at all —
            // except on imported cards, where review-less directions await calibration.
            $missingDirections = $card->is_imported ? 0 : $card->direction_count - $card->review_rows;
            $newItems = $card->new_state_rows + $missingDirections;

            if ($newItems > 0) {
                if ($card->introduced_today) {
                    // Already counted toward today's limit — remaining directions come through free.
                    $newCount += $newItems;
                } elseif ($newBudget > 0) {
                    $newCount += $newItems;
                    $newBudget--;
                }
            }

            $reviewCount += $card->learning_due;

            if ($card->review_due > 0 && $reviewBudget > 0) {
                $reviewCount += $card->review_due;
                $reviewBudget--;
            }
        }

        return ['new' => $newCount, 'review' => $reviewCount];
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
     * @param  array<int, bool>  $preCountedCardIds  Card IDs that already count toward the limit (included for free)
     * @return Collection<int, array{card: Flashcard, direction: string, review: FlashcardReview|null}>
     */
    private function takeByUniqueCards(Collection $items, int $limit, array $preCountedCardIds = []): Collection
    {
        $seenCardIds = $preCountedCardIds;
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
            self::HARD => $this->learningHard($review, $steps, $settings),
            self::GOOD => $this->learningGood($review, $steps, $settings),
            self::EASY => $this->learningEasy($review, $settings, $steps),
        };
    }

    private function learningAgain(FlashcardReview $review, array $steps): void
    {
        $review->state = $this->learningStateFor($review);
        $review->learning_step = 0;
        $review->due_at = Carbon::now()->addMinutes($steps[0]);
    }

    private function learningHard(FlashcardReview $review, array $steps, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $review->state = $this->learningStateFor($review);
        $review->due_at = Carbon::now()->addMinutes($this->learningHardMinutes($review, $steps, $settings));
    }

    /**
     * Hard delay during learning: 1.5× the current step, clamped into the
     * [Again, Good) window so the buttons always keep Again <= Hard < Good,
     * even with tightly spaced or non-increasing learning steps (e.g. [10, 10]
     * or [10, 11], where 1.5 × 10 would tie or overtake Good).
     *
     * Ordering is the hard invariant, in priority Hard < Good, then Hard >= Again:
     *   - The natural 1.5× value is first floored to Again, then capped just
     *     below Good, so Hard never meets or exceeds Good.
     *   - When Good leaves no whole-minute room above Again (a degenerate
     *     non-increasing config such as [10, 10]), Hard falls back to Again
     *     rather than dipping below it — Hard = Again is acceptable, Hard < Again
     *     is not. Such configs are rejected on save; this only guards decks that
     *     stored them before that validation existed.
     *
     * When Good graduates to whole days, Hard stays a full hour below the day
     * boundary instead of a single minute, so "Nehéz" never rounds up to the
     * same label Good's "1 nap" shows (1439 min would display as "24 óra").
     */
    private function learningHardMinutes(FlashcardReview $review, array $steps, FlashcardSetting|FlashcardDeckSetting $settings): int
    {
        $step = min($review->learning_step ?? 0, count($steps) - 1);
        $again = $steps[0];
        $goodMinutes = $this->learningGoodMinutes($review, $steps, $settings);
        $hardCeiling = $goodMinutes >= 1440
            ? max(60, $goodMinutes - 60)
            : $goodMinutes - 1;

        $natural = max($again + 1, (int) round($steps[$step] * 1.5));

        // Cap below Good first; if that pushed Hard under Again, restore Again
        // (still strictly below Good whenever Good > Again).
        return max($again, min($natural, $hardCeiling));
    }

    /**
     * The delay (in minutes) Good would schedule from the current learning step.
     */
    private function learningGoodMinutes(FlashcardReview $review, array $steps, FlashcardSetting|FlashcardDeckSetting $settings): int
    {
        $step = min($review->learning_step ?? 0, count($steps) - 1);
        $nextStep = $step + 1;

        if ($nextStep < count($steps)) {
            return $steps[$nextStep];
        }

        $days = $review->state === 'relearning'
            ? max(1, $review->interval)
            : $this->graduatingInterval($settings, $steps, $step);

        return $days * 1440;
    }

    /**
     * A lapsed card must stay 'relearning' through every learning step, otherwise
     * graduation would treat it as a brand-new card and reset its interval and ease.
     */
    private function learningStateFor(FlashcardReview $review): string
    {
        return $review->state === 'relearning' ? 'relearning' : 'learning';
    }

    private function learningGood(FlashcardReview $review, array $steps, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $nextStep = $review->learning_step + 1;

        if ($nextStep >= count($steps)) {
            $isRelearning = $review->state === 'relearning';
            // Capture the current step before resetting so the graduating interval
            // matches what getButtonPreviews showed for this rating.
            $currentStep = min($review->learning_step, count($steps) - 1);

            $review->state = 'review';
            $review->learning_step = 0;
            $review->repetitions = max(1, $review->repetitions);

            if ($isRelearning) {
                // Relearning card: interval and ease were already set by reviewAgain — just reschedule.
                $review->due_at = Carbon::now()->addDays(max(1, $review->interval));
            } else {
                // New card graduating for the first time.
                $interval = $this->graduatingInterval($settings, $steps, $currentStep);
                $review->interval = $interval;
                $review->ease_factor = $settings->starting_ease;
                $review->due_at = Carbon::now()->addDays($interval);
            }
        } else {
            $review->state = $this->learningStateFor($review);
            $review->learning_step = $nextStep;
            $review->due_at = Carbon::now()->addMinutes($steps[$nextStep]);
        }
    }

    private function learningEasy(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings, array $steps): void
    {
        $isRelearning = $review->state === 'relearning';
        // Capture the current step before resetting so the easy interval matches
        // what getButtonPreviews showed for this rating.
        $currentStep = min($review->learning_step, count($steps) - 1);

        $review->state = 'review';
        $review->learning_step = 0;
        $review->repetitions = max(1, $review->repetitions);

        if ($isRelearning) {
            // Relearning card: the preserved interval plus an extra day, ease stays.
            $review->interval = $this->relearningEasyInterval($review, $settings);
            $review->due_at = Carbon::now()->addDays($review->interval);
        } else {
            // New card graduating easy — must be at least 1 more day than graduating via Good.
            $interval = $this->easyInterval($settings, $steps, $currentStep);
            $review->interval = $interval;
            $review->ease_factor = $settings->starting_ease;
            $review->due_at = Carbon::now()->addDays($interval);
        }
    }

    /**
     * Graduating interval via Good — kept strictly above what Hard would show.
     *
     * When the final learning step is itself a day or more, Hard already lands in
     * multi-day territory (step × 1.5). Good must graduate to at least one day beyond
     * Hard, otherwise both ratings collapse onto the same interval and the buttons
     * become indistinguishable. When Hard is still sub-day (the common case), Hard is
     * shown in minutes, so Good only needs the configured graduating interval.
     */
    private function graduatingInterval(FlashcardSetting|FlashcardDeckSetting $settings, array $steps, int $currentStep): int
    {
        $safeStep = min($currentStep, count($steps) - 1);
        $hardMinutes = max($steps[0] + 1, (int) round($steps[$safeStep] * 1.5));
        $hardInDays = $hardMinutes >= 1440 ? (int) round($hardMinutes / 1440) : 0;
        $minFromHard = $hardInDays > 0 ? $hardInDays + 1 : 0;

        return max($settings->graduating_interval, $minFromHard);
    }

    /**
     * Easy interval — always at least 1 day more than the graduating (Good) interval.
     */
    private function easyInterval(FlashcardSetting|FlashcardDeckSetting $settings, array $steps, int $currentStep): int
    {
        return max($settings->easy_interval, $this->graduatingInterval($settings, $steps, $currentStep) + 1);
    }

    /**
     * Easy on a relearning card: one day beyond the preserved (Good) interval,
     * so Easy always beats Good, capped at max_interval.
     */
    private function relearningEasyInterval(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): int
    {
        return min(max(1, $review->interval) + 1, $settings->max_interval);
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
        $review->interval = $this->hardIntervalFor($review, $settings);
        $review->ease_factor = max(130, $review->ease_factor - 15);
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function reviewGood(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $review->interval = $this->goodIntervalFor($review, $settings);
        $review->repetitions++;
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function reviewEasy(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): void
    {
        $review->interval = $this->easyIntervalFor($review, $settings);
        $review->ease_factor = min(999, $review->ease_factor + 15);
        $review->repetitions++;
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function hardIntervalFor(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): int
    {
        return min(
            max($review->interval + 1, (int) round($review->interval * $settings->hard_interval_modifier / 100)),
            $settings->max_interval
        );
    }

    /**
     * Good interval — kept strictly above Hard, otherwise the two buttons collapse.
     *
     * A lapsed card's ease can drop to the 130 floor while Hard's default modifier
     * is 120; at short intervals rounding makes the raw values tie (e.g. 3 days:
     * round(3.6) = round(3.9) = 4), and a low interval_modifier can even push the
     * raw Good below Hard. Both intervals can still meet at max_interval.
     */
    private function goodIntervalFor(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): int
    {
        $byEase = (int) round($review->interval * $review->ease_factor / 100 * $settings->interval_modifier / 100);

        return min(
            max($this->hardIntervalFor($review, $settings) + 1, $byEase),
            $settings->max_interval
        );
    }

    /**
     * Easy interval — kept strictly above Good the same way Good is kept above Hard.
     */
    private function easyIntervalFor(FlashcardReview $review, FlashcardSetting|FlashcardDeckSetting $settings): int
    {
        $byEase = (int) round(
            $review->interval * $review->ease_factor / 100
            * $settings->easy_bonus / 100
            * $settings->interval_modifier / 100
        );

        return min(
            max($this->goodIntervalFor($review, $settings) + 1, $byEase),
            $settings->max_interval
        );
    }
}
