<?php

namespace App\Http\Controllers;

use App\Concerns\LimitsArraySize;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    use LimitsArraySize;

    private const WORDS_PER_LEVEL = 20;

    /**
     * The level test shows at most WORDS_PER_LEVEL words on each of the six
     * levels (120 ids), so this leaves plenty of headroom.
     */
    private const MAX_SUBMITTED_IDS = 500;

    /**
     * Replaces the per-element `exists:words,id` rule, which ran one query per
     * id (F6-L3), with a single query per field.
     *
     * @param  array<string, Collection<int, int>>  $idsByField
     *
     * @throws ValidationException
     */
    private function ensureWordIdsExist(array $idsByField): void
    {
        $errors = [];

        foreach ($idsByField as $field => $ids) {
            $uniqueIds = $ids->unique();

            if ($uniqueIds->isNotEmpty() && Word::whereIn('id', $uniqueIds)->count() !== $uniqueIds->count()) {
                $errors[$field] = __('validation.exists', ['attribute' => $field]);
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function show(Request $request): Response
    {
        $testEnabled = config('app.onboarding_enabled', true) !== false;

        $wordsByLevel = collect();
        $levelTotals = [];

        if ($testEnabled) {
            $availableLevels = Word::selectRaw('level, COUNT(*) as count')
                ->groupBy('level')
                ->having('count', '>=', self::WORDS_PER_LEVEL)
                ->orderBy('level')
                ->pluck('level');

            foreach ($availableLevels as $level) {
                $words = Word::where('level', $level)
                    ->inRandomOrder()
                    ->take(self::WORDS_PER_LEVEL)
                    ->get(['id', 'word', 'meaning_hu', 'level']);

                $wordsByLevel->put($level, $words->values());
                $levelTotals[$level] = Word::where('level', $level)->count();
            }
        }

        return Inertia::render('onboarding/index', [
            'wordsByLevel' => $wordsByLevel,
            'levelTotals' => $levelTotals,
            'testEnabled' => $testEnabled,
        ]);
    }

    public function complete(Request $request, AchievementService $achievements): RedirectResponse
    {
        $this->ensureArraySizeWithinLimits($request->all(), [
            'known_word_ids' => self::MAX_SUBMITTED_IDS,
            'shown_word_ids' => self::MAX_SUBMITTED_IDS,
        ]);

        $validated = $request->validate([
            'known_word_ids' => ['array'],
            'known_word_ids.*' => ['integer'],
            'shown_word_ids' => ['array'],
            'shown_word_ids.*' => ['integer'],
        ]);

        $user = $request->user();
        $knownIds = collect($validated['known_word_ids'] ?? []);
        $shownIds = collect($validated['shown_word_ids'] ?? []);

        $this->ensureWordIdsExist(['known_word_ids' => $knownIds, 'shown_word_ids' => $shownIds]);

        $wordIdsToMark = collect();

        if ($shownIds->isNotEmpty()) {
            $shownWords = Word::whereIn('id', $shownIds)->get(['id', 'level']);
            $shownByLevel = $shownWords->groupBy('level');

            foreach ($shownByLevel as $level => $levelWords) {
                $shownCount = $levelWords->count();
                $knownCount = $levelWords->filter(fn ($w) => $knownIds->contains($w->id))->count();
                $ratio = $shownCount > 0 ? $knownCount / $shownCount : 0;

                if ($ratio === 0.0) {
                    continue;
                }

                $totalInLevel = Word::where('level', $level)->count();
                $markCount = (int) round($ratio * $totalInLevel);

                // Mark the most frequent (lowest rank) words in this level
                $ids = Word::where('level', $level)
                    ->orderBy('rank')
                    ->take($markCount)
                    ->pluck('id');

                $wordIdsToMark = $wordIdsToMark->merge($ids);
            }
        }

        if ($wordIdsToMark->isNotEmpty()) {
            $now = now();
            $rows = $wordIdsToMark->unique()->map(fn ($id) => [
                'user_id' => $user->id,
                'word_id' => $id,
                'status' => 'known',
                'reviewed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->values()->all();

            DB::table('user_word')->upsert($rows, ['user_id', 'word_id'], ['status', 'reviewed_at', 'updated_at']);
        }

        $user->update(['onboarding_completed_at' => now()]);

        $newAchievements = $achievements->checkAndAward($user, ['vocab', 'known', 'level']);
        if (! empty($newAchievements)) {
            session()->flash('achievements', $newAchievements);
        }

        session()->flash('show_tour', true);

        return redirect()->route('dashboard');
    }
}
