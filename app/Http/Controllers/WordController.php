<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WordController extends Controller
{
    private const ALLOWED_PER_PAGE = [20, 50, 100, 200, 300, 400, 500, 1000];

    private const DEFAULT_PER_PAGE = 50;

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->lower()->value();
        $letter = $request->string('letter')->trim()->upper()->value();
        $level = $request->integer('level') ?: null;
        $statusFilter = $request->string('status')->trim()->lower()->value();
        $folderId = $request->integer('folder') ?: null;
        $perPage = in_array((int) $request->input('per_page'), self::ALLOWED_PER_PAGE)
            ? (int) $request->input('per_page')
            : self::DEFAULT_PER_PAGE;

        $user = $request->user();

        $wordStatuses = $user->knownWords()
            ->pluck('user_word.status', 'words.id')
            ->all();

        $statusFilteredIds = $statusFilter !== ''
            ? array_keys(array_filter($wordStatuses, fn ($s) => $s === $statusFilter))
            : null;

        $folderWordIds = $folderId !== null
            ? Folder::where('id', $folderId)->where('user_id', $user->id)
                ->first()
                ?->words()
                ->pluck('words.id')
                ->all() ?? []
            : null;

        // Base query without letter filter — used for markedLetters so all letter buttons can be annotated
        $baseWithoutLetter = Word::query()
            ->when($search !== '', fn ($q) => $q->where('word', 'like', strtoupper($search).'%'))
            ->when($level !== null, fn ($q) => $q->where('level', $level))
            ->when($statusFilteredIds !== null, fn ($q) => $q->whereIn('id', $statusFilteredIds))
            ->when($folderWordIds !== null, fn ($q) => $q->whereIn('id', $folderWordIds));

        // Full query including the active letter filter — used for pagination and word list
        $baseQuery = (clone $baseWithoutLetter)
            ->when($search === '' && $letter !== '' && $letter !== 'ALL', fn ($q) => $q->where('word', 'like', $letter.'%'));

        $words = (clone $baseQuery)
            ->orderBy('rank')
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Word $word) => [
                'id' => $word->id,
                'word' => $word->word,
                'rank' => $word->rank,
                'meaning_hu' => $word->meaning_hu,
                'extra_meanings' => $word->extra_meanings,
                'synonyms' => $word->synonyms,
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
                'status' => $wordStatuses[$word->id] ?? null,
            ]);

        $markedPages = (clone $baseQuery)
            ->orderBy('rank')
            ->pluck('id')
            ->values()
            ->map(fn ($id, $index) => isset($wordStatuses[$id]) ? (int) ceil(($index + 1) / $perPage) : null)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $markedLetters = (clone $baseWithoutLetter)
            ->whereIn('id', array_keys($wordStatuses))
            ->selectRaw('UPPER(SUBSTR(word, 1, 1)) as letter')
            ->distinct()
            ->pluck('letter')
            ->all();

        $statusCounts = collect($wordStatuses)->countBy()->all();

        $folders = $user->folders()->withCount('words')->get()
            ->map(fn (Folder $folder) => [
                'id' => $folder->id,
                'name' => $folder->name,
                'words_count' => $folder->words_count,
            ]);

        $pageWordIds = collect($words->items())->pluck('id')->all();

        $wordFolderIds = \DB::table('folder_word')
            ->join('folders', 'folders.id', '=', 'folder_word.folder_id')
            ->where('folders.user_id', $user->id)
            ->whereIn('folder_word.word_id', $pageWordIds)
            ->get(['folder_word.word_id', 'folder_word.folder_id'])
            ->groupBy('word_id')
            ->map(fn ($rows) => $rows->pluck('folder_id')->all())
            ->all();

        $allCustomWords = $user->customWords()->get([
            'id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech',
            'example_en', 'example_hu', 'status', 'form_base', 'verb_past',
            'verb_past_participle', 'verb_present_participle', 'verb_third_person',
            'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative',
        ]);
        $customStatusCounts = $allCustomWords->countBy('status')->all();

        $customKnown = $customStatusCounts['known'] ?? 0;
        $customLearning = $customStatusCounts['learning'] ?? 0;
        $customSaved = $customStatusCounts['saved'] ?? 0;
        $customPronunciation = $customStatusCounts['pronunciation'] ?? 0;

        // Filter custom words to match current active filters so they appear inline
        $customWords = $allCustomWords->filter(function ($cw) use ($search, $letter, $statusFilter, $folderId, $level) {
            if ($folderId !== null) {
                return false; // custom words are not in folders
            }
            if ($level !== null) {
                return false; // custom words have no level
            }
            if ($search !== '' && ! str_contains(mb_strtolower($cw->word), $search)) {
                return false;
            }
            if ($letter !== '' && $letter !== 'ALL' && mb_strtoupper(mb_substr($cw->word, 0, 1)) !== $letter) {
                return false;
            }
            if ($statusFilter !== '' && $cw->status !== $statusFilter) {
                return false;
            }

            return true;
        })->values();

        return Inertia::render('words/index', [
            'words' => $words,
            'filters' => ['search' => $search, 'letter' => $letter, 'level' => $level, 'status' => $statusFilter, 'folder' => $folderId, 'per_page' => $perPage],
            'stats' => [
                'total' => Word::count() + $allCustomWords->count(),
                'known' => ($statusCounts['known'] ?? 0) + $customKnown,
                'learning' => ($statusCounts['learning'] ?? 0) + $customLearning,
                'saved' => ($statusCounts['saved'] ?? 0) + $customSaved,
                'pronunciation' => ($statusCounts['pronunciation'] ?? 0) + $customPronunciation,
            ],
            'customWords' => $customWords,
            'customStats' => [
                'total' => $allCustomWords->count(),
                'known' => $customKnown,
                'learning' => $customLearning,
                'saved' => $customSaved,
                'pronunciation' => $customPronunciation,
            ],
            'markedPages' => $markedPages,
            'markedLetters' => $markedLetters,
            'folders' => $folders,
            'wordFolderIds' => $wordFolderIds,
            'flashcardDecks' => $user->flashcardDecks()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $query = $request->string('q')->trim()->value();

        if (strlen($query) < 2) {
            return response()->json([]);
        }

        $words = Word::where('word', 'like', $query.'%')
            ->orWhere('word', 'like', '%'.$query.'%')
            ->orderByRaw('CASE WHEN word LIKE ? THEN 0 ELSE 1 END', [$query.'%'])
            ->orderBy('rank')
            ->limit(10)
            ->get(['id', 'word', 'meaning_hu'])
            ->map(fn ($w) => ['id' => $w->id, 'word' => $w->word, 'meaning_hu' => $w->meaning_hu, 'is_custom' => false]);

        $customWords = $request->user()
            ->customWords()
            ->where('word', 'like', '%'.$query.'%')
            ->orderByRaw('CASE WHEN word LIKE ? THEN 0 ELSE 1 END', [$query.'%'])
            ->limit(5)
            ->get(['id', 'word', 'meaning_hu'])
            ->map(fn ($w) => ['id' => $w->id, 'word' => $w->word, 'meaning_hu' => $w->meaning_hu, 'is_custom' => true]);

        return response()->json($customWords->concat($words)->values());
    }

    public function quiz(Request $request): Response
    {
        $status = $request->string('status')->trim()->lower()->value();
        $level = $request->integer('level') ?: null;
        $folderId = $request->integer('folder') ?: null;
        $user = $request->user();
        $freeQuizLimit = 10;
        $maxCount = $user->hasActiveAccess() ? 500 : $freeQuizLimit;
        $count = min(max((int) $request->input('count', 0), 0), $maxCount);

        // Parse comma-separated ids param for manual word selection
        $idsParam = $request->string('ids')->trim()->value();
        $selectedIds = $idsParam !== '' ? array_filter(array_map('trim', explode(',', $idsParam))) : [];
        if (! $user->hasActiveAccess() && count($selectedIds) > $freeQuizLimit) {
            $selectedIds = array_slice($selectedIds, 0, $freeQuizLimit);
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

        if (in_array($status, ['known', 'learning', 'saved', 'pronunciation'])) {
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

        if ($customWordQuery && in_array($status, ['known', 'learning', 'saved', 'pronunciation'])) {
            $customWordQuery->where('status', $status);
        } elseif ($customWordQuery && $status === 'marked') {
            // all custom words count as marked
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
                    ? Word::whereIn('id', $selectedRegularIds)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu', 'synonyms', 'rank'])
                    : collect();

                $customQuizWords = count($selectedCustomIds) > 0
                    ? UserCustomWord::where('user_id', $user->id)->whereIn('id', $selectedCustomIds)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'example_en', 'status'])
                    : collect();
            } else {
                // Proportionally split count between regular and custom words
                $customShare = $available > 0 ? (int) round($count * ($customAvailable / $available)) : 0;
                $regularShare = $count - $customShare;

                $quizWords = (clone $query)->inRandomOrder()->limit($regularShare)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu', 'synonyms', 'rank']);

                $customQuizWords = $customWordQuery
                    ? (clone $customWordQuery)->inRandomOrder()->limit($customShare)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'example_en', 'status'])
                    : collect();

                $decoyPool = Word::whereNotNull('meaning_hu')
                    ->whereNotIn('id', $quizWords->pluck('id'))
                    ->inRandomOrder()
                    ->limit($count * 4)
                    ->pluck('meaning_hu')
                    ->merge($customQuizWords->whereNotNull('meaning_hu')->pluck('meaning_hu'))
                    ->shuffle()
                    ->values()
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
            } // end else (random selection)
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
            ],
            'freeQuizLimit' => $user->hasActiveAccess() ? null : $freeQuizLimit,
        ]);
    }

    public function status(Request $request, Word $word): RedirectResponse|JsonResponse
    {
        $status = $request->validate(['status' => 'required|in:known,learning,saved,pronunciation'])['status'];

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        if (! $existing && $request->user()->isOnFreePlan()) {
            $savedCount = $request->user()->knownWords()->count();
            if ($savedCount >= 50) {
                if ($request->expectsJson()) {
                    return response()->json(['error' => 'limit_reached', 'upgrade_url' => route('pricing')], 403);
                }

                return back()->with('error', 'Elérted az ingyenes szómentési limitet (50 szó). Frissíts prémiumra a korlátlan hozzáféréshez.');
            }
        }

        if ($existing && $existing->pivot->status === $status) {
            $request->user()->knownWords()->detach($word->id);
        } else {
            $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => $status]]);
            if ($request->user()->updateStreak()) {
                session()->flash('streak_triggered', $request->user()->streak);
            }

            $newAchievements = app(AchievementService::class)->checkAndAward(
                $request->user(),
                ['streak', 'vocab', 'known']
            );
            if ($newAchievements) {
                session()->flash('achievements', $newAchievements);
            }
        }

        return back();
    }
}
