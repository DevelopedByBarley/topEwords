<?php

namespace App\Services;

use App\Models\Flashcard;
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
        ]);
    }

    /**
     * Returns preview labels for each rating button without saving.
     *
     * @return array{again: string, hard: string, good: string, easy: string}
     */
    public function getButtonPreviews(FlashcardReview $review, FlashcardSetting $settings): array
    {
        $steps = array_map('intval', $settings->learning_steps);
        $isLearning = in_array($review->state, ['new', 'learning', 'relearning']);

        if ($isLearning) {
            $step = $review->learning_step ?? 0;
            $nextStep = $step + 1;

            $again = $this->formatMinutes($steps[0]);
            $hard = $this->formatMinutes(max($steps[0] + 1, (int) round($steps[$step] * 1.5)));
            $good = $nextStep < count($steps)
                ? $this->formatMinutes($steps[$nextStep])
                : $this->formatDays($settings->graduating_interval);
            $easy = $this->formatDays($settings->easy_interval);
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
                max($interval + 1, (int) round($interval * $ease / 100 * $settings->easy_bonus / 100 * $settings->interval_modifier / 100)),
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

    public function processReview(FlashcardReview $review, int $rating, FlashcardSetting $settings): void
    {
        match ($review->state) {
            'new', 'learning', 'relearning' => $this->processLearning($review, $rating, $settings),
            'review' => $this->processReview_($review, $rating, $settings),
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
    public function getDueCards(int $deckId, FlashcardSetting $settings): Collection
    {
        $now = Carbon::now();
        $cards = Flashcard::where('deck_id', $deckId)
            ->with('reviews')
            ->get();

        $newItems = collect();
        $learningItems = collect();
        $reviewItems = collect();

        foreach ($cards as $card) {
            foreach ($this->directionsFor($card) as $direction) {
                $review = $card->reviews->firstWhere('direction', $direction);

                if (! $review || $review->state === 'new') {
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

        return $newItems->take($settings->new_cards_per_day)
            ->merge($learningItems)
            ->merge($reviewItems->take($settings->max_reviews_per_day))
            ->values();
    }

    private function processLearning(FlashcardReview $review, int $rating, FlashcardSetting $settings): void
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
        $review->state = 'learning';
        $minutes = max($steps[0] + 1, (int) round($steps[$review->learning_step] * 1.5));
        $review->due_at = Carbon::now()->addMinutes($minutes);
    }

    private function learningGood(FlashcardReview $review, array $steps, FlashcardSetting $settings): void
    {
        $nextStep = $review->learning_step + 1;

        if ($nextStep >= count($steps)) {
            // Graduate to review
            $review->state = 'review';
            $review->interval = $settings->graduating_interval;
            $review->repetitions = 1;
            $review->ease_factor = $settings->starting_ease;
            $review->learning_step = 0;
            $review->due_at = Carbon::now()->addDays($settings->graduating_interval);
        } else {
            $review->state = 'learning';
            $review->learning_step = $nextStep;
            $review->due_at = Carbon::now()->addMinutes($steps[$nextStep]);
        }
    }

    private function learningEasy(FlashcardReview $review, FlashcardSetting $settings): void
    {
        $review->state = 'review';
        $review->interval = $settings->easy_interval;
        $review->repetitions = 1;
        $review->ease_factor = $settings->starting_ease;
        $review->learning_step = 0;
        $review->due_at = Carbon::now()->addDays($settings->easy_interval);
    }

    private function processReview_(FlashcardReview $review, int $rating, FlashcardSetting $settings): void
    {
        match ($rating) {
            self::AGAIN => $this->reviewAgain($review, $settings),
            self::HARD => $this->reviewHard($review, $settings),
            self::GOOD => $this->reviewGood($review, $settings),
            self::EASY => $this->reviewEasy($review, $settings),
        };
    }

    private function reviewAgain(FlashcardReview $review, FlashcardSetting $settings): void
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

    private function reviewHard(FlashcardReview $review, FlashcardSetting $settings): void
    {
        $newInterval = max(
            $review->interval + 1,
            (int) round($review->interval * $settings->hard_interval_modifier / 100)
        );
        $review->interval = min($newInterval, $settings->max_interval);
        $review->ease_factor = max(130, $review->ease_factor - 15);
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function reviewGood(FlashcardReview $review, FlashcardSetting $settings): void
    {
        $newInterval = (int) round(
            $review->interval * $review->ease_factor / 100 * $settings->interval_modifier / 100
        );
        $review->interval = min(max($review->interval + 1, $newInterval), $settings->max_interval);
        $review->repetitions++;
        $review->due_at = Carbon::now()->addDays($review->interval);
    }

    private function reviewEasy(FlashcardReview $review, FlashcardSetting $settings): void
    {
        $newInterval = (int) round(
            $review->interval * $review->ease_factor / 100
            * $settings->easy_bonus / 100
            * $settings->interval_modifier / 100
        );
        $review->interval = min(max($review->interval + 1, $newInterval), $settings->max_interval);
        $review->ease_factor = min(999, $review->ease_factor + 15);
        $review->repetitions++;
        $review->due_at = Carbon::now()->addDays($review->interval);
    }
}
