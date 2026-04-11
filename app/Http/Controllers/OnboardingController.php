<?php

namespace App\Http\Controllers;

use App\Models\Word;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OnboardingController extends Controller
{
    private const WORDS_PER_LEVEL = 20;

    public function show(): Response
    {
        $wordsByLevel = collect();

        $availableLevels = Word::selectRaw('level, COUNT(*) as count')
            ->groupBy('level')
            ->having('count', '>=', self::WORDS_PER_LEVEL)
            ->orderBy('level')
            ->pluck('level');

        $levelTotals = [];

        foreach ($availableLevels as $level) {
            $words = Word::where('level', $level)
                ->inRandomOrder()
                ->take(self::WORDS_PER_LEVEL)
                ->get(['id', 'word', 'meaning_hu', 'level']);

            $wordsByLevel->put($level, $words->values());
            $levelTotals[$level] = Word::where('level', $level)->count();
        }

        return Inertia::render('onboarding/index', [
            'wordsByLevel' => $wordsByLevel,
            'levelTotals' => $levelTotals,
        ]);
    }

    public function complete(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'known_word_ids' => ['array'],
            'known_word_ids.*' => ['integer', 'exists:words,id'],
            'shown_word_ids' => ['array'],
            'shown_word_ids.*' => ['integer', 'exists:words,id'],
        ]);

        $user = $request->user();
        $knownIds = collect($validated['known_word_ids'] ?? []);
        $shownIds = collect($validated['shown_word_ids'] ?? []);

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

        return redirect()->route('dashboard');
    }
}
