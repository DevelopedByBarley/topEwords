<?php

namespace App\Http\Controllers;

use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ReviewController extends Controller
{
    /**
     * Number of days between reviews per status.
     *
     * @var array<string, int>
     */
    private const INTERVALS = [
        'learning' => 1,
        'saved' => 3,
        'pronunciation' => 7,
        'known' => 14,
    ];

    /** Maximum words per review session. */
    private const MAX_PER_SESSION = 50;

    public function index(Request $request): Response
    {
        $user = $request->user();
        $today = Carbon::today();

        [$dueRegularIds, $dueCustomIds] = $this->getDueIds($user->id, $today);

        $dueCount = count($dueRegularIds) + count($dueCustomIds);
        $dueCounts = $this->getDueCounts($user->id, $today);

        $words = [];

        if ($request->boolean('start') && $dueCount > 0) {
            $regularIds = array_slice($dueRegularIds, 0, self::MAX_PER_SESSION);
            $customIds = array_slice($dueCustomIds, 0, max(0, self::MAX_PER_SESSION - count($regularIds)));

            $quizWords = count($regularIds) > 0
                ? Word::whereIn('id', $regularIds)
                    ->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu', 'synonyms', 'rank'])
                : collect();

            $customQuizWords = count($customIds) > 0
                ? UserCustomWord::where('user_id', $user->id)->whereIn('id', $customIds)
                    ->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'example_en', 'status'])
                : collect();

            $decoyPool = Word::whereNotNull('meaning_hu')
                ->whereNotIn('id', $quizWords->pluck('id'))
                ->inRandomOrder()
                ->limit(count($regularIds) * 4 + 12)
                ->pluck('meaning_hu')
                ->merge($customQuizWords->whereNotNull('meaning_hu')->pluck('meaning_hu'))
                ->shuffle()
                ->values()
                ->all();

            $wordStatuses = $user->knownWords()
                ->pluck('user_word.status', 'words.id')
                ->all();

            $regularMapped = $quizWords->map(function (Word $word, int $i) use ($decoyPool, $wordStatuses) {
                $decoys = array_slice($decoyPool, $i * 3, 3);
                $options = collect([$word->meaning_hu, ...$decoys])->shuffle()->values()->all();

                return [
                    'id' => $word->id,
                    'word' => $word->word,
                    'meaning_hu' => $word->meaning_hu,
                    'part_of_speech' => $word->part_of_speech,
                    'form_base' => $word->form_base,
                    'verb_past' => $word->verb_past,
                    'verb_past_participle' => $word->verb_past_participle,
                    'verb_present_participle' => $word->verb_present_participle,
                    'verb_third_person' => $word->verb_third_person,
                    'is_irregular' => $word->is_irregular,
                    'noun_plural' => $word->noun_plural,
                    'adj_comparative' => $word->adj_comparative,
                    'adj_superlative' => $word->adj_superlative,
                    'example_en' => $word->example_en,
                    'example_hu' => $word->example_hu,
                    'synonyms' => $word->synonyms,
                    'rank' => $word->rank,
                    'status' => $wordStatuses[$word->id] ?? null,
                    'is_custom' => false,
                    'options' => $options,
                ];
            });

            $offset = $regularMapped->count() * 3;
            $customMapped = $customQuizWords->values()->map(function (UserCustomWord $word, int $i) use ($decoyPool, $offset) {
                $decoys = array_slice($decoyPool, ($offset / 3 + $i) * 3, 3);
                $options = $word->meaning_hu
                    ? collect([$word->meaning_hu, ...$decoys])->shuffle()->values()->all()
                    : [];

                return [
                    'id' => 'custom_'.$word->id,
                    'word' => $word->word,
                    'meaning_hu' => $word->meaning_hu,
                    'part_of_speech' => $word->part_of_speech,
                    'form_base' => null,
                    'verb_past' => null,
                    'verb_past_participle' => null,
                    'verb_present_participle' => null,
                    'verb_third_person' => null,
                    'is_irregular' => false,
                    'noun_plural' => null,
                    'adj_comparative' => null,
                    'adj_superlative' => null,
                    'example_en' => $word->example_en,
                    'example_hu' => null,
                    'synonyms' => null,
                    'rank' => null,
                    'status' => $word->status,
                    'is_custom' => true,
                    'options' => $options,
                ];
            });

            $words = $regularMapped->concat($customMapped)->shuffle()->values()->all();
        }

        return Inertia::render('review/index', [
            'words' => $words,
            'dueCount' => $dueCount,
            'dueCounts' => $dueCounts,
            'intervals' => self::INTERVALS,
        ]);
    }

    public function complete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string'],
        ]);

        $user = $request->user();
        $today = Carbon::today()->toDateString();

        $regularIds = array_values(array_map('intval', array_filter($validated['ids'], fn ($id) => ! str_starts_with((string) $id, 'custom_'))));
        $customIds = array_values(array_map(fn ($id) => (int) substr($id, 7), array_filter($validated['ids'], fn ($id) => str_starts_with((string) $id, 'custom_'))));

        if (count($regularIds) > 0) {
            DB::table('user_word')
                ->where('user_id', $user->id)
                ->whereIn('word_id', $regularIds)
                ->update(['reviewed_at' => $today]);
        }

        if (count($customIds) > 0) {
            UserCustomWord::where('user_id', $user->id)
                ->whereIn('id', $customIds)
                ->update(['reviewed_at' => $today]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * @return array{0: int[], 1: int[]}
     */
    private function getDueIds(int $userId, Carbon $today): array
    {
        $regularIds = [];
        $customIds = [];

        foreach (self::INTERVALS as $status => $days) {
            $cutoff = $today->copy()->subDays($days)->toDateString();

            $ids = DB::table('user_word')
                ->where('user_id', $userId)
                ->where('status', $status)
                ->where(fn ($q) => $q->whereNull('reviewed_at')->orWhere('reviewed_at', '<=', $cutoff))
                ->pluck('word_id')
                ->map(fn ($id) => (int) $id)
                ->all();

            array_push($regularIds, ...$ids);

            $ids = DB::table('user_custom_words')
                ->where('user_id', $userId)
                ->where('status', $status)
                ->where(fn ($q) => $q->whereNull('reviewed_at')->orWhere('reviewed_at', '<=', $cutoff))
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            array_push($customIds, ...$ids);
        }

        shuffle($regularIds);
        shuffle($customIds);

        return [$regularIds, $customIds];
    }

    /**
     * @return array<string, int>
     */
    private function getDueCounts(int $userId, Carbon $today): array
    {
        $result = [];

        foreach (self::INTERVALS as $status => $days) {
            $cutoff = $today->copy()->subDays($days)->toDateString();

            $regular = DB::table('user_word')
                ->where('user_id', $userId)
                ->where('status', $status)
                ->where(fn ($q) => $q->whereNull('reviewed_at')->orWhere('reviewed_at', '<=', $cutoff))
                ->count();

            $custom = DB::table('user_custom_words')
                ->where('user_id', $userId)
                ->where('status', $status)
                ->where(fn ($q) => $q->whereNull('reviewed_at')->orWhere('reviewed_at', '<=', $cutoff))
                ->count();

            $result[$status] = $regular + $custom;
        }

        return $result;
    }
}
