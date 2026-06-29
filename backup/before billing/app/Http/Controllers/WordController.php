<?php

namespace App\Http\Controllers;

use App\Concerns\TogglesWordStatus;
use App\Models\Folder;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WordController extends Controller
{
    use TogglesWordStatus;

    private const ALLOWED_PER_PAGE = [20, 50, 100, 200, 300, 400, 500, 1000];

    private const DEFAULT_PER_PAGE = 50;

    private const FREE_SAVE_LIMIT = 50;

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->lower()->value();
        $letter = $request->string('letter')->trim()->upper()->value();
        $level = $request->integer('level') ?: null;
        $statusFilter = $request->string('status')->trim()->lower()->value();
        $importanceFilter = $request->integer('importance') ?: null;
        $folderId = $request->integer('folder') ?: null;
        $perPage = in_array((int) $request->input('per_page'), self::ALLOWED_PER_PAGE)
            ? (int) $request->input('per_page')
            : self::DEFAULT_PER_PAGE;

        $user = $request->user();

        $userWordPivot = $user->knownWords()->get(['words.id', 'user_word.status', 'user_word.importance']);
        $wordStatuses = $userWordPivot->pluck('pivot.status', 'id')->all();
        $wordImportances = $userWordPivot->pluck('pivot.importance', 'id')->all();

        $statusFilteredIds = $statusFilter !== ''
            ? array_keys(array_filter($wordStatuses, fn ($s) => $s === $statusFilter))
            : null;

        $importanceFilteredIds = $importanceFilter !== null
            ? array_keys(array_filter($wordImportances, fn ($i) => $i === $importanceFilter))
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
            ->when($search !== '', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', [$this->likeEscape(strtoupper($search)).'%', '\\']))
            ->when($level !== null, fn ($q) => $q->where('level', $level))
            ->when($statusFilteredIds !== null, fn ($q) => $q->whereIn('id', $statusFilteredIds))
            ->when($importanceFilteredIds !== null, fn ($q) => $q->whereIn('id', $importanceFilteredIds))
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
                'importance' => $wordImportances[$word->id] ?? null,
            ]);

        // A teljes szó-sorrendre csak akkor van szükség, ha van megjelölt szó —
        // jelölés híján minden oldal üres, így megspóroljuk az összes id leszedését.
        $markedPages = [];
        $completedPages = [];

        if ($wordStatuses !== []) {
            $orderedIds = (clone $baseQuery)->orderBy('rank')->pluck('id')->values();

            $markedPages = $orderedIds
                ->map(fn ($id, $index) => isset($wordStatuses[$id]) ? (int) ceil(($index + 1) / $perPage) : null)
                ->filter()
                ->unique()
                ->values()
                ->all();

            $completedPages = $orderedIds
                ->chunk($perPage)
                ->map(fn ($chunk, $index) => $chunk->every(fn ($id) => isset($wordStatuses[$id])) ? $index + 1 : null)
                ->filter()
                ->values()
                ->all();
        }

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
            'example_en', 'example_hu', 'status', 'importance', 'form_base', 'verb_past',
            'verb_past_participle', 'verb_present_participle', 'verb_third_person',
            'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative',
        ]);
        $customStatusCounts = $allCustomWords->countBy('status')->all();

        $customKnown = $customStatusCounts['known'] ?? 0;
        $customLearning = $customStatusCounts['learning'] ?? 0;
        $customSaved = $customStatusCounts['saved'] ?? 0;
        $customPronunciation = $customStatusCounts['pronunciation'] ?? 0;
        $customPractice = $customStatusCounts['practice'] ?? 0;

        // Filter custom words to match current active filters so they appear inline
        $customWords = $allCustomWords->filter(function ($cw) use ($search, $letter, $statusFilter, $importanceFilter, $folderId) {
            if ($folderId !== null) {
                return false;
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
            if ($importanceFilter !== null && $cw->importance !== $importanceFilter) {
                return false;
            }

            return true;
        })->values();

        return Inertia::render('words/index', [
            'words' => $words,
            'filters' => ['search' => $search, 'letter' => $letter, 'level' => $level, 'status' => $statusFilter, 'importance' => $importanceFilter, 'folder' => $folderId, 'per_page' => $perPage],
            'stats' => [
                'total' => Word::count(),
                'known' => $statusCounts['known'] ?? 0,
                'learning' => $statusCounts['learning'] ?? 0,
                'saved' => $statusCounts['saved'] ?? 0,
                'pronunciation' => $statusCounts['pronunciation'] ?? 0,
                'practice' => $statusCounts['practice'] ?? 0,
            ],
            'customWords' => $customWords,
            'customStats' => [
                'total' => $allCustomWords->count(),
                'known' => $customKnown,
                'learning' => $customLearning,
                'saved' => $customSaved,
                'pronunciation' => $customPronunciation,
                'practice' => $customPractice,
            ],
            'markedPages' => $markedPages,
            'completedPages' => $completedPages,
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

        $like = $this->likeEscape($query);

        $words = Word::whereRaw('word LIKE ? ESCAPE ?', [$like.'%', '\\'])
            ->orWhereRaw('word LIKE ? ESCAPE ?', ['%'.$like.'%', '\\'])
            ->orderByRaw('CASE WHEN word LIKE ? ESCAPE ? THEN 0 ELSE 1 END', [$like.'%', '\\'])
            ->orderBy('rank')
            ->limit(10)
            ->get(['id', 'word', 'meaning_hu'])
            ->map(fn ($w) => ['id' => $w->id, 'word' => $w->word, 'meaning_hu' => $w->meaning_hu, 'is_custom' => false]);

        $customWords = $request->user()
            ->customWords()
            ->whereRaw('word LIKE ? ESCAPE ?', ['%'.$like.'%', '\\'])
            ->orderByRaw('CASE WHEN word LIKE ? ESCAPE ? THEN 0 ELSE 1 END', [$like.'%', '\\'])
            ->limit(5)
            ->get(['id', 'word', 'meaning_hu'])
            ->map(fn ($w) => ['id' => $w->id, 'word' => $w->word, 'meaning_hu' => $w->meaning_hu, 'is_custom' => true]);

        return response()->json($customWords->concat($words)->values());
    }

    public function practice(Request $request): Response
    {
        abort_unless(Gate::check('admin'), 403);

        $user = $request->user();
        $preWords = array_slice((array) $request->input('words', []), 0, 10);

        $practiceWordIds = $user->knownWords()->wherePivot('status', 'practice')->pluck('words.id');
        $regularPracticeWords = Word::whereIn('id', $practiceWordIds)
            ->select('id', 'word', 'meaning_hu')
            ->orderBy('word')
            ->get()
            ->map(fn (Word $w) => ['id' => $w->id, 'word' => $w->word, 'meaning_hu' => $w->meaning_hu, 'is_custom' => false]);

        $customPracticeWords = UserCustomWord::where('user_id', $user->id)
            ->where('status', 'practice')
            ->select('id', 'word', 'meaning_hu')
            ->orderBy('word')
            ->get()
            ->map(fn (UserCustomWord $w) => ['id' => $w->id, 'word' => $w->word, 'meaning_hu' => $w->meaning_hu, 'is_custom' => true]);

        $practiceWords = $regularPracticeWords->concat($customPracticeWords)->sortBy('word')->values();

        return Inertia::render('words/practice', [
            'preWords' => array_values(array_filter(array_map('strval', $preWords))),
            'practiceWords' => $practiceWords,
        ]);
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
            'freeQuizLimit' => $user->hasActiveAccess() ? null : $freeQuizLimit,
        ]);
    }

    public function update(Request $request, Word $word): RedirectResponse
    {
        Gate::authorize('admin');

        $data = $request->validate([
            'word' => ['sometimes', 'string', 'max:100'],
            'meaning_hu' => ['nullable', 'string', 'max:255'],
            'extra_meanings' => ['nullable', 'string', 'max:500'],
            'synonyms' => ['nullable', 'string', 'max:255'],
            'part_of_speech' => ['nullable', 'string', 'max:20'],
            'example_en' => ['nullable', 'string', 'max:500'],
            'example_hu' => ['nullable', 'string', 'max:500'],
            'form_base' => ['nullable', 'string', 'max:100'],
            'verb_past' => ['nullable', 'string', 'max:100'],
            'verb_past_participle' => ['nullable', 'string', 'max:100'],
            'verb_present_participle' => ['nullable', 'string', 'max:100'],
            'verb_third_person' => ['nullable', 'string', 'max:100'],
            'is_irregular' => ['boolean'],
            'noun_plural' => ['nullable', 'string', 'max:100'],
            'adj_comparative' => ['nullable', 'string', 'max:100'],
            'adj_superlative' => ['nullable', 'string', 'max:100'],
        ]);

        $word->update($data);

        return back();
    }

    public function status(Request $request, Word $word): RedirectResponse|JsonResponse
    {
        $status = $this->validatedToggleStatus($request);
        $forms = $this->statusFormsFor($word);

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        // Az ingyenes mentési limit csak új státusz felvételekor érvényes, levételkor nem.
        if ($status !== null && ! $existing && $this->freeSaveLimitReached($request)) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'limit_reached', 'upgrade_url' => route('pricing')], 403);
            }

            return back()->with('error', 'Elérted az ingyenes szómentési limitet (50 szó). Frissíts prémiumra a korlátlan hozzáféréshez.');
        }

        // Üres státusz, vagy az aktív gomb újrakattintása → levétel.
        if ($status === null || ($existing && $existing->pivot->status === $status)) {
            $request->user()->knownWords()->detach($word->id);

            return $this->statusToggleResponse($request, null, $forms);
        }

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

        return $this->statusToggleResponse($request, $status, $forms);
    }

    public function importance(Request $request, Word $word): RedirectResponse
    {
        $importance = $request->validate(['importance' => 'nullable|integer|min:1|max:5'])['importance'];

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        if ($existing) {
            $request->user()->knownWords()->updateExistingPivot($word->id, ['importance' => $importance]);

            return back();
        }

        // Még nincs mentve a szó: importance levételekor nincs mit tenni (ne hozzunk létre üres pivotot).
        if ($importance === null) {
            return back();
        }

        // Fontosság beállítása új szót is ment ('known'), ezért ugyanaz az ingyenes limit vonatkozik rá, mint a státuszra.
        if ($this->freeSaveLimitReached($request)) {
            return back()->with('error', 'Elérted az ingyenes szómentési limitet (50 szó). Frissíts prémiumra a korlátlan hozzáféréshez.');
        }

        $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => 'known', 'importance' => $importance]]);

        return back();
    }

    /**
     * Az ingyenes csomag szómentési limitje (50 szó) elérve van-e — a státusz- és
     * a fontosság-felvétel is ugyanazt a pivotot hozza létre, ezért közös ellenőrzés.
     */
    private function freeSaveLimitReached(Request $request): bool
    {
        return $request->user()->isOnFreePlan()
            && $request->user()->knownWords()->count() >= self::FREE_SAVE_LIMIT;
    }

    /**
     * A felhasználói keresőszövegben lévő LIKE-joker karaktereket (`%`, `_`, `\`)
     * irodalmi karakterként kezeli, hogy ne torzítsák a találatokat. A visszaadott
     * mintát `ESCAPE '\'` záradékkal kell használni (MySQL és SQLite is támogatja).
     */
    private function likeEscape(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
