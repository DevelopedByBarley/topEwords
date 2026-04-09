<?php

namespace App\Services;

use App\Models\FlashcardReview;
use App\Models\User;
use App\Models\UserAchievement;
use App\Models\Word;

class AchievementService
{
    /**
     * All achievement definitions.
     *
     * @var array<string, array{title: string, description: string, icon: string, group: string}>
     */
    public const ACHIEVEMENTS = [
        // Streak
        'streak_3' => ['title' => '3 napos sorozat', 'description' => '3 egymást követő napon tanultál.', 'icon' => '🔥', 'group' => 'streak'],
        'streak_7' => ['title' => 'Heti sorozat', 'description' => '7 egymást követő napon tanultál.', 'icon' => '🔥', 'group' => 'streak'],
        'streak_14' => ['title' => 'Két hetes sorozat', 'description' => '14 egymást követő napon tanultál.', 'icon' => '🔥', 'group' => 'streak'],
        'streak_30' => ['title' => 'Havi sorozat', 'description' => '30 egymást követő napon tanultál.', 'icon' => '🔥', 'group' => 'streak'],
        'streak_100' => ['title' => '100 napos sorozat', 'description' => '100 egymást követő napon tanultál.', 'icon' => '🏆', 'group' => 'streak'],

        // Total vocabulary (any status)
        'vocab_10' => ['title' => 'Első lépések', 'description' => '10 szót jelöltél meg.', 'icon' => '📖', 'group' => 'vocab'],
        'vocab_50' => ['title' => 'Szókincsfejlesztő', 'description' => '50 szót jelöltél meg.', 'icon' => '📖', 'group' => 'vocab'],
        'vocab_100' => ['title' => 'Százas klub', 'description' => '100 szót jelöltél meg.', 'icon' => '📚', 'group' => 'vocab'],
        'vocab_500' => ['title' => 'Szókincs-bajnok', 'description' => '500 szót jelöltél meg.', 'icon' => '📚', 'group' => 'vocab'],
        'vocab_1000' => ['title' => 'Ezres klub', 'description' => '1000 szót jelöltél meg.', 'icon' => '🏆', 'group' => 'vocab'],

        // Known words
        'known_10' => ['title' => 'Első ismert szavak', 'description' => '10 szót ismersz.', 'icon' => '✅', 'group' => 'known'],
        'known_50' => ['title' => '50 szót tudom', 'description' => '50 szót ismersz.', 'icon' => '✅', 'group' => 'known'],
        'known_100' => ['title' => '100 szót tudom', 'description' => '100 szót ismersz.', 'icon' => '✅', 'group' => 'known'],
        'known_500' => ['title' => '500 szót tudom', 'description' => '500 szót ismersz.', 'icon' => '🌟', 'group' => 'known'],
        'known_1000' => ['title' => '1000 szót tudom', 'description' => '1000 szót ismersz.', 'icon' => '🏆', 'group' => 'known'],

        // Custom words
        'custom_first' => ['title' => 'Saját szó', 'description' => 'Hozzáadtad az első saját szavadat.', 'icon' => '✏️', 'group' => 'custom'],
        'custom_10' => ['title' => '10 saját szó', 'description' => '10 saját szót adtál hozzá.', 'icon' => '✏️', 'group' => 'custom'],
        'custom_50' => ['title' => '50 saját szó', 'description' => '50 saját szót adtál hozzá.', 'icon' => '✏️', 'group' => 'custom'],

        // Flashcards
        'flashcard_first_deck' => ['title' => 'Első pakli', 'description' => 'Létrehoztad az első flashcard paklidat.', 'icon' => '🃏', 'group' => 'flashcard'],
        'flashcard_reviews_10' => ['title' => '10 flashcard', 'description' => '10 flashcard kártyát tanultál meg.', 'icon' => '🃏', 'group' => 'flashcard'],
        'flashcard_reviews_100' => ['title' => '100 flashcard', 'description' => '100 flashcard kártyát tanultál meg.', 'icon' => '🃏', 'group' => 'flashcard'],
        'flashcard_reviews_500' => ['title' => '500 flashcard', 'description' => '500 flashcard kártyát tanultál meg.', 'icon' => '🏆', 'group' => 'flashcard'],

        // Quiz
        'quiz_first' => ['title' => 'Első kvíz', 'description' => 'Teljesítetted az első kvízedet.', 'icon' => '🎯', 'group' => 'quiz'],
        'quiz_10' => ['title' => '10 kvíz', 'description' => '10 kvízt teljesítettél.', 'icon' => '🎯', 'group' => 'quiz'],
        'quiz_50' => ['title' => '50 kvíz', 'description' => '50 kvízt teljesítettél.', 'icon' => '🏆', 'group' => 'quiz'],
        'quiz_perfect' => ['title' => 'Tökéletes kvíz', 'description' => 'Minden választ jól megadtál egy kvízben.', 'icon' => '⭐', 'group' => 'quiz'],

        // Text analysis
        'analysis_first' => ['title' => 'Első elemzés', 'description' => 'Elvégezted az első szövegelemzésedet.', 'icon' => '📄', 'group' => 'analysis'],
        'analysis_10' => ['title' => '10 elemzés', 'description' => '10 szöveget elemeztél.', 'icon' => '📄', 'group' => 'analysis'],
        'analysis_comprehension_90' => ['title' => 'Folyékony olvasó', 'description' => 'Elértél 90%+ érthetőséget egy elemzésen.', 'icon' => '🌟', 'group' => 'analysis'],

        // Level completion
        'level_1_complete' => ['title' => 'Kezdő – teljesítve', 'description' => 'Az összes Kezdő szintű szót megtanultad.', 'icon' => '🟢', 'group' => 'level'],
        'level_2_complete' => ['title' => 'Alapszint – teljesítve', 'description' => 'Az összes Alapszintű szót megtanultad.', 'icon' => '🔵', 'group' => 'level'],
        'level_3_complete' => ['title' => 'Középszint – teljesítve', 'description' => 'Az összes Középszintű szót megtanultad.', 'icon' => '🟡', 'group' => 'level'],
        'level_4_complete' => ['title' => 'Haladó – teljesítve', 'description' => 'Az összes Haladó szintű szót megtanultad.', 'icon' => '🟠', 'group' => 'level'],
        'level_5_complete' => ['title' => 'Szakértő – teljesítve', 'description' => 'Az összes Szakértő szintű szót megtanultad.', 'icon' => '🟣', 'group' => 'level'],
        'level_6_complete' => ['title' => 'Mester – teljesítve', 'description' => 'Az összes Mester szintű szót megtanultad.', 'icon' => '🏆', 'group' => 'level'],
    ];

    /**
     * Check and award all applicable achievements for the given trigger groups.
     * Returns newly unlocked achievements.
     *
     * @param  string[]  $groups
     * @return array<int, array{key: string, title: string, description: string, icon: string}>
     */
    public function checkAndAward(User $user, array $groups = []): array
    {
        $alreadyUnlocked = $user->achievements()->pluck('achievement_key')->flip();
        $newlyUnlocked = [];

        foreach (self::ACHIEVEMENTS as $key => $achievement) {
            if ($alreadyUnlocked->has($key)) {
                continue;
            }

            if (! empty($groups) && ! in_array($achievement['group'], $groups, true)) {
                continue;
            }

            if ($this->passes($key, $user)) {
                UserAchievement::create([
                    'user_id' => $user->id,
                    'achievement_key' => $key,
                    'unlocked_at' => now(),
                ]);

                $newlyUnlocked[] = ['key' => $key, ...$achievement];
            }
        }

        return $newlyUnlocked;
    }

    private function passes(string $key, User $user): bool
    {
        return match ($key) {
            // Streak
            'streak_3' => $user->streak >= 3,
            'streak_7' => $user->streak >= 7,
            'streak_14' => $user->streak >= 14,
            'streak_30' => $user->streak >= 30,
            'streak_100' => $user->streak >= 100,

            // Total vocab (main words with any status + custom words with any status)
            'vocab_10' => $this->totalMarkedWords($user) >= 10,
            'vocab_50' => $this->totalMarkedWords($user) >= 50,
            'vocab_100' => $this->totalMarkedWords($user) >= 100,
            'vocab_500' => $this->totalMarkedWords($user) >= 500,
            'vocab_1000' => $this->totalMarkedWords($user) >= 1000,

            // Known words
            'known_10' => $this->totalKnownWords($user) >= 10,
            'known_50' => $this->totalKnownWords($user) >= 50,
            'known_100' => $this->totalKnownWords($user) >= 100,
            'known_500' => $this->totalKnownWords($user) >= 500,
            'known_1000' => $this->totalKnownWords($user) >= 1000,

            // Custom words
            'custom_first' => $user->customWords()->count() >= 1,
            'custom_10' => $user->customWords()->count() >= 10,
            'custom_50' => $user->customWords()->count() >= 50,

            // Flashcards
            'flashcard_first_deck' => $user->flashcardDecks()->count() >= 1,
            'flashcard_reviews_10' => $this->totalFlashcardReviews($user) >= 10,
            'flashcard_reviews_100' => $this->totalFlashcardReviews($user) >= 100,
            'flashcard_reviews_500' => $this->totalFlashcardReviews($user) >= 500,

            // Quiz
            'quiz_first' => $user->quiz_completions >= 1,
            'quiz_10' => $user->quiz_completions >= 10,
            'quiz_50' => $user->quiz_completions >= 50,
            'quiz_perfect' => false, // handled exclusively via checkAndAwardQuiz() with $perfect flag

            // Text analysis
            'analysis_first' => $user->text_analyses >= 1,
            'analysis_10' => $user->text_analyses >= 10,
            'analysis_comprehension_90' => false, // checked via extra param, see checkAndAwardAnalysis()

            // Level completion
            'level_1_complete' => $this->isLevelComplete($user, 1),
            'level_2_complete' => $this->isLevelComplete($user, 2),
            'level_3_complete' => $this->isLevelComplete($user, 3),
            'level_4_complete' => $this->isLevelComplete($user, 4),
            'level_5_complete' => $this->isLevelComplete($user, 5),
            'level_6_complete' => $this->isLevelComplete($user, 6),

            default => false,
        };
    }

    private function totalMarkedWords(User $user): int
    {
        $main = $user->knownWords()->count();
        $custom = $user->customWords()->whereNotNull('status')->count();

        return $main + $custom;
    }

    private function totalKnownWords(User $user): int
    {
        $main = $user->knownWords()->wherePivot('status', 'known')->count();
        $custom = $user->customWords()->where('status', 'known')->count();

        return $main + $custom;
    }

    /**
     * Called after a quiz is completed. Increments counter and checks quiz achievements.
     *
     * @return array<int, array{key: string, title: string, description: string, icon: string}>
     */
    public function checkAndAwardQuiz(User $user, bool $perfect): array
    {
        $user->increment('quiz_completions');
        $user->refresh();

        $newlyUnlocked = $this->checkAndAward($user, ['quiz']);

        if ($perfect && ! $user->achievements()->where('achievement_key', 'quiz_perfect')->exists()) {
            UserAchievement::create([
                'user_id' => $user->id,
                'achievement_key' => 'quiz_perfect',
                'unlocked_at' => now(),
            ]);
            $newlyUnlocked[] = ['key' => 'quiz_perfect', ...self::ACHIEVEMENTS['quiz_perfect']];
        }

        return $newlyUnlocked;
    }

    /**
     * Called after text analysis. Increments counter and checks analysis achievements.
     *
     * @return array<int, array{key: string, title: string, description: string, icon: string}>
     */
    public function checkAndAwardAnalysis(User $user, int $comprehension): array
    {
        $user->increment('text_analyses');
        $user->refresh();

        $newlyUnlocked = $this->checkAndAward($user, ['analysis']);

        if ($comprehension >= 90 && ! $user->achievements()->where('achievement_key', 'analysis_comprehension_90')->exists()) {
            UserAchievement::create([
                'user_id' => $user->id,
                'achievement_key' => 'analysis_comprehension_90',
                'unlocked_at' => now(),
            ]);
            $newlyUnlocked[] = ['key' => 'analysis_comprehension_90', ...self::ACHIEVEMENTS['analysis_comprehension_90']];
        }

        return $newlyUnlocked;
    }

    private function isLevelComplete(User $user, int $level): bool
    {
        $total = Word::where('level', $level)->count();

        if ($total === 0) {
            return false;
        }

        $known = $user->knownWords()
            ->wherePivot('status', 'known')
            ->where('level', $level)
            ->count();

        return $known >= $total;
    }

    private function totalFlashcardReviews(User $user): int
    {
        return FlashcardReview::whereHas(
            'flashcard.deck',
            fn ($q) => $q->where('user_id', $user->id)
        )->count();
    }
}
