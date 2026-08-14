<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * INDULÁSKOR KIVEZETVE (2026-07-26): a kvíz nem része az induló
 * feature-körnek, és a biztonsági auditokból is ki van zárva.
 *
 * A kód nem törölt, csak elérhetetlen: a `words.quiz` és a
 * `words.quiz.complete` route a routes/words.php-ban ki van kommentelve, a
 * frontend pedig a resources/js/_pages-disabled/words/quiz.tsx alatt vár. A
 * kvíz-jelvények az AchievementService::HIDDEN_GROUPS mögött rejtve vannak.
 *
 * Visszahozáskor: a két route visszakommentelése, a quiz.tsx visszamozgatása a
 * resources/js/pages/words/ alá, a Wayfinder-akciók újragenerálása, és a
 * HIDDEN_GROUPS-ból a 'quiz' csoport kivétele.
 */
class QuizController extends Controller
{
    public function quiz(Request $request): Response
    {
        $status = $request->string('status')->trim()->lower()->value();
        $level = $request->integer('level') ?: null;
        $folderId = $request->integer('folder') ?: null;
        $user = $request->user();
        // Per-round quiz cap from the plan (null = unlimited on premium); 500 is
        // the technical ceiling since the word queries below fetch at most 500.
        $roundLimit = $user->planLimit('quiz_per_round');
        $maxCount = $roundLimit ?? 500;
        $count = min(max((int) $request->input('count', 0), 0), $maxCount);

        // Parse comma-separated ids param for manual word selection.
        // A kézi kiválasztás is plafonos: Free-n a plan-limit, prémiumon az
        // 500-as technikai plafon — kraftolt ?ids= URL-lel sem kérhető
        // korlátlan whereIn + óriás payload.
        $idsParam = $request->string('ids')->trim()->value();
        $selectedIds = $idsParam !== '' ? array_filter(array_map('trim', explode(',', $idsParam))) : [];
        if (count($selectedIds) > $maxCount) {
            $selectedIds = array_slice($selectedIds, 0, $maxCount);
        }
        $selectedRegularIds = array_values(array_map('intval', array_filter($selectedIds, fn ($id) => ! str_starts_with($id, 'custom_'))));
        $selectedCustomIds = array_values(array_map(fn ($id) => (int) substr($id, 7), array_filter($selectedIds, fn ($id) => str_starts_with($id, 'custom_'))));

        $wordStatuses = $user->knownWords()
            ->pluck('user_word.status', 'words.id')
            ->all();

        $folders = $user->folders()->withCount('words')->get()
            ->map(fn (Folder $folder) => [
                'id' => $folder->id,
                'name' => $folder->name,
                'words_count' => $folder->words_count,
            ]);

        $folderWordIds = $folderId !== null
            ? Folder::where('id', $folderId)->where('user_id', $user->id)
                ->first()
                ?->words()
                ->pluck('words.id')
                ->all() ?? []
            : null;

        $query = Word::whereNotNull('meaning_hu');

        if (in_array($status, ['known', 'learning', 'saved', 'pronunciation', 'practice'])) {
            $ids = array_keys(array_filter($wordStatuses, fn ($s) => $s === $status));
            $query->whereIn('id', $ids);
        } elseif ($status === 'marked') {
            $query->whereIn('id', array_keys($wordStatuses));
        }

        if ($level !== null) {
            $query->where('level', $level);
        }

        if ($folderWordIds !== null) {
            $query->whereIn('id', $folderWordIds);
        }

        // Custom words are included when no level/folder filter is active
        $includeCustom = $level === null && $folderWordIds === null;
        $customWordQuery = $includeCustom
            ? UserCustomWord::where('user_id', $user->id)->whereNotNull('meaning_hu')
            : null;

        if ($customWordQuery && in_array($status, ['known', 'learning', 'saved', 'pronunciation', 'practice'])) {
            $customWordQuery->where('status', $status);
        }

        $customAvailable = $customWordQuery?->count() ?? 0;
        $available = $query->count() + $customAvailable;

        // In setup mode (count=0, no ids): return selectable word list for manual picking
        $selectableWords = [];
        if ($count === 0 && count($selectedIds) === 0) {
            $regularSelectable = (clone $query)
                ->orderBy('rank')
                ->limit(500)
                ->get(['id', 'word', 'meaning_hu', 'rank'])
                ->map(fn (Word $w) => [
                    'id' => $w->id,
                    'word' => $w->word,
                    'meaning_hu' => $w->meaning_hu,
                    'rank' => $w->rank,
                    'status' => $wordStatuses[$w->id] ?? null,
                    'is_custom' => false,
                ]);

            $customSelectable = $customWordQuery
                ? (clone $customWordQuery)->orderBy('word')->limit(200)->get(['id', 'word', 'meaning_hu', 'status'])
                    ->map(fn (UserCustomWord $w) => [
                        'id' => 'custom_'.$w->id,
                        'word' => $w->word,
                        'meaning_hu' => $w->meaning_hu,
                        'rank' => null,
                        'status' => $w->status,
                        'is_custom' => true,
                    ])
                : collect();

            $selectableWords = $regularSelectable->concat($customSelectable)->values()->all();
        }

        $words = [];

        // Determine the effective count: either from ids or from count param
        $useSelectedIds = count($selectedIds) > 0;
        $effectiveCount = $useSelectedIds ? count($selectedIds) : $count;

        if ($effectiveCount > 0 && ($available > 0 || $useSelectedIds)) {
            if ($useSelectedIds) {
                // Use exactly the selected word IDs
                $quizWords = count($selectedRegularIds) > 0
                    ? Word::whereIn('id', $selectedRegularIds)->whereNotNull('meaning_hu')->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu', 'synonyms', 'rank'])
                    : collect();

                $customQuizWords = count($selectedCustomIds) > 0
                    ? UserCustomWord::where('user_id', $user->id)->whereIn('id', $selectedCustomIds)->whereNotNull('meaning_hu')->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'example_en', 'status'])
                    : collect();
            } else {
                // Proportionally split count between regular and custom words
                $customShare = $available > 0 ? (int) round($count * ($customAvailable / $available)) : 0;
                $regularShare = $count - $customShare;

                $quizWords = (clone $query)->inRandomOrder()->limit($regularShare)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu', 'synonyms', 'rank']);

                $customQuizWords = $customWordQuery
                    ? (clone $customWordQuery)->inRandomOrder()->limit($customShare)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'example_en', 'status'])
                    : collect();
            }

            $decoyPool = Word::whereNotNull('meaning_hu')
                ->whereNotIn('id', $quizWords->pluck('id'))
                ->inRandomOrder()
                ->limit($effectiveCount * 5)
                ->pluck('meaning_hu')
                ->merge($customQuizWords->pluck('meaning_hu'))
                ->unique()
                ->shuffle()
                ->values()
                ->all();

            /**
             * Walk the pool with a cursor so every word gets fresh decoys; skip
             * candidates matching the correct meaning, because different words
             * can share the same Hungarian translation.
             */
            $decoyCursor = 0;
            $buildOptions = function (string $meaning) use (&$decoyCursor, $decoyPool): array {
                $decoys = [];
                $poolSize = count($decoyPool);
                for ($scanned = 0; $scanned < $poolSize && count($decoys) < 3; $scanned++) {
                    $candidate = $decoyPool[$decoyCursor % $poolSize];
                    $decoyCursor++;
                    if ($candidate !== $meaning && ! in_array($candidate, $decoys, true)) {
                        $decoys[] = $candidate;
                    }
                }

                return collect([$meaning, ...$decoys])->shuffle()->values()->all();
            };

            $regularMapped = $quizWords->map(fn (Word $word) => [
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
                'options' => $buildOptions($word->meaning_hu),
            ]);

            $customMapped = $customQuizWords->values()->map(fn (UserCustomWord $word) => [
                'id' => 'custom_'.$word->id,
                'word' => $word->word,
                'meaning_hu' => $word->meaning_hu,
                'part_of_speech' => $word->part_of_speech,
                'form_base' => null,
                'verb_past' => null,
                'verb_past_participle' => null,
                'verb_present_participle' => null,
                'verb_third_person' => null,
                'is_irregular' => null,
                'noun_plural' => null,
                'adj_comparative' => null,
                'adj_superlative' => null,
                'example_en' => $word->example_en,
                'example_hu' => null,
                'synonyms' => null,
                'rank' => null,
                'status' => $word->status,
                'is_custom' => true,
                'options' => $buildOptions($word->meaning_hu),
            ]);

            $words = $regularMapped->concat($customMapped)->shuffle()->values()->all();
        }

        return Inertia::render('words/quiz', [
            'words' => $words,
            'available' => $available,
            'folders' => $folders,
            'selectableWords' => $selectableWords,
            'filters' => [
                'status' => $status,
                'level' => $level,
                'folder' => $folderId,
                'count' => $count,
                'ids' => implode(',', $selectedIds),
            ],
            'freeQuizLimit' => $roundLimit,
        ]);
    }

    public function complete(Request $request, AchievementService $service): JsonResponse
    {
        $request->validate(['perfect' => ['boolean']]);

        if ($request->user()->updateStreak()) {
            session()->flash('streak_triggered', $request->user()->streak);
        }

        $newAchievements = $service->checkAndAwardQuiz($request->user(), $request->boolean('perfect'));
        $newAchievements = [...$newAchievements, ...$service->checkAndAward($request->user(), ['streak'])];

        return response()->json(['achievements' => $newAchievements]);
    }
}
