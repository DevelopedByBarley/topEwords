<?php

namespace App\Http\Controllers;

use App\Concerns\TogglesWordStatus;
use App\Models\Folder;
use App\Models\User;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class WordController extends Controller
{
    use TogglesWordStatus;

    private const ALLOWED_PER_PAGE = [20, 50, 100, 200, 300, 400, 500, 1000];

    private const DEFAULT_PER_PAGE = 50;

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

        /**
         * A user_word pivotot query builderrel érjük el Eloquent helyett: a teljes
         * jelölés-térkép betöltése (10k szónál 10k modell-példány) helyett minden
         * felhasználás célzott lekérdezés (aggregátum, subquery vagy oldalnyi sor).
         */
        $pivot = fn () => DB::table('user_word')->where('user_id', $user->id);

        $folderWordIds = $folderId !== null
            ? Folder::where('id', $folderId)->where('user_id', $user->id)
                ->first()
                ?->words()
                ->pluck('words.id')
                ->all() ?? []
            : null;

        // Base query without letter filter — used for markedLetters so all letter buttons can be annotated.
        // Substring-egyezés (mint a saját szavaknál és a keresőmező-végponton) — ugyanarra a beírásra
        // ugyanaz a találati logika mindkét listán. A collation case-insensitive, ezért nincs szükség
        // uppercase-normalizálásra (a $search már lowercase, sor 30).
        $baseWithoutLetter = Word::query()
            ->when($search !== '', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', ['%'.$this->likeEscape($search).'%', '\\']))
            ->when($level !== null, fn ($q) => $q->where('level', $level))
            ->when($statusFilter !== '', fn ($q) => $q->whereIn('id', $pivot()->where('status', $statusFilter)->select('word_id')))
            ->when($importanceFilter !== null, fn ($q) => $q->whereIn('id', $pivot()->where('importance', $importanceFilter)->select('word_id')))
            ->when($folderWordIds !== null, fn ($q) => $q->whereIn('id', $folderWordIds));

        // Full query including the active letter filter — used for pagination and word list
        $baseQuery = (clone $baseWithoutLetter)
            ->when($search === '' && $letter !== '' && $letter !== 'ALL', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', [$this->likeEscape($letter).'%', '\\']));

        /**
         * Az alábbi propok closure-ök: az Inertia csak akkor értékeli ki őket, ha a
         * (partial) válaszban tényleg szerepelnek — így pl. egy only:[words,stats]
         * reload nem tölti be a mappákat, saját szavakat és a flashcard-deckeket.
         * A megosztott köztes értékek kérésen belül memoizáltak.
         */
        $words = null;
        $getWords = function () use (&$words, $baseQuery, $perPage, $pivot) {
            if ($words !== null) {
                return $words;
            }

            $paginated = (clone $baseQuery)->orderBy('rank')->paginate($perPage)->withQueryString();

            $pageMarks = $pivot()
                ->whereIn('word_id', collect($paginated->items())->pluck('id'))
                ->get(['word_id', 'status', 'importance'])
                ->keyBy('word_id');

            return $words = $paginated->through(fn (Word $word) => [
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
                'status' => $pageMarks->get($word->id)?->status,
                'importance' => $pageMarks->get($word->id)?->importance,
            ]);
        };

        // A jelölt szó-id-k halmaza és a szűrt lista teljes sorrendje csak a
        // lapozó-annotációkhoz kell; jelölés híján az id-pluck is megspórolódik.
        $markedIdSet = null;
        $getMarkedIdSet = function () use (&$markedIdSet, $pivot) {
            return $markedIdSet ??= $pivot()->pluck('word_id')->flip();
        };

        $orderedIds = null;
        $getOrderedIds = function () use (&$orderedIds, $baseQuery) {
            return $orderedIds ??= (clone $baseQuery)->orderBy('rank')->pluck('id')->values();
        };

        return Inertia::render('words/index', [
            'words' => $getWords,
            'filters' => ['search' => $search, 'letter' => $letter, 'level' => $level, 'status' => $statusFilter, 'importance' => $importanceFilter, 'folder' => $folderId, 'per_page' => $perPage],
            'stats' => function () use ($pivot) {
                $statusCounts = $pivot()->selectRaw('status, COUNT(*) as cnt')->groupBy('status')->pluck('cnt', 'status');

                return [
                    'total' => Word::count(),
                    'known' => (int) ($statusCounts['known'] ?? 0),
                    'learning' => (int) ($statusCounts['learning'] ?? 0),
                    'saved' => (int) ($statusCounts['saved'] ?? 0),
                    'pronunciation' => (int) ($statusCounts['pronunciation'] ?? 0),
                    'practice' => (int) ($statusCounts['practice'] ?? 0),
                ];
            },
            'customWords' => fn () => $this->filteredCustomWords($user, $search, $letter, $statusFilter, $importanceFilter, $folderId),
            'customStats' => function () use ($user) {
                $counts = $user->customWords()->toBase()->reorder()->selectRaw('status, COUNT(*) as cnt')->groupBy('status')->pluck('cnt', 'status');

                return [
                    'total' => (int) $counts->sum(),
                    'known' => (int) ($counts['known'] ?? 0),
                    'learning' => (int) ($counts['learning'] ?? 0),
                    'saved' => (int) ($counts['saved'] ?? 0),
                    'pronunciation' => (int) ($counts['pronunciation'] ?? 0),
                    'practice' => (int) ($counts['practice'] ?? 0),
                ];
            },
            'markedPages' => function () use ($getMarkedIdSet, $getOrderedIds, $perPage) {
                $marked = $getMarkedIdSet();

                if ($marked->isEmpty()) {
                    return [];
                }

                return $getOrderedIds()
                    ->map(fn ($id, $index) => $marked->has($id) ? intdiv($index, $perPage) + 1 : null)
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();
            },
            'completedPages' => function () use ($getMarkedIdSet, $getOrderedIds, $perPage) {
                $marked = $getMarkedIdSet();

                if ($marked->isEmpty()) {
                    return [];
                }

                return $getOrderedIds()
                    ->chunk($perPage)
                    ->map(fn ($chunk, $index) => $chunk->every(fn ($id) => $marked->has($id)) ? $index + 1 : null)
                    ->filter()
                    ->values()
                    ->all();
            },
            'markedLetters' => fn () => (clone $baseWithoutLetter)
                ->whereIn('id', $pivot()->select('word_id'))
                ->selectRaw('UPPER(SUBSTR(word, 1, 1)) as letter')
                ->distinct()
                ->pluck('letter')
                ->all(),
            'folders' => fn () => $user->folders()->withCount('words')->get()
                ->map(fn (Folder $folder) => [
                    'id' => $folder->id,
                    'name' => $folder->name,
                    'words_count' => $folder->words_count,
                ]),
            'wordFolderIds' => fn () => DB::table('folder_word')
                ->join('folders', 'folders.id', '=', 'folder_word.folder_id')
                ->where('folders.user_id', $user->id)
                ->whereIn('folder_word.word_id', collect($getWords()->items())->pluck('id'))
                ->get(['folder_word.word_id', 'folder_word.folder_id'])
                ->groupBy('word_id')
                ->map(fn ($rows) => $rows->pluck('folder_id')->all())
                ->all(),
            'flashcardDecks' => fn () => $user->flashcardDecks()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * A szűrőknek megfelelő saját szavak a fő listába fésüléshez — a szűrés
     * SQL-ben fut, így nem töltjük be a teljes állományt minden kéréshez.
     * Mappa-szűrőnél üres, mert a saját szavak nem rendelhetők mappához.
     *
     * @return Collection<int, UserCustomWord>
     */
    private function filteredCustomWords(User $user, string $search, string $letter, string $statusFilter, ?int $importanceFilter, ?int $folderId): Collection
    {
        if ($folderId !== null) {
            return new Collection;
        }

        return $user->customWords()
            ->when($search !== '', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', ['%'.$this->likeEscape($search).'%', '\\']))
            ->when($letter !== '' && $letter !== 'ALL', fn ($q) => $q->whereRaw('word LIKE ? ESCAPE ?', [$this->likeEscape($letter).'%', '\\']))
            ->when($statusFilter !== '', fn ($q) => $q->where('status', $statusFilter))
            ->when($importanceFilter !== null, fn ($q) => $q->where('importance', $importanceFilter))
            ->get([
                'id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech',
                'example_en', 'example_hu', 'status', 'importance', 'form_base', 'verb_past',
                'verb_past_participle', 'verb_present_participle', 'verb_third_person',
                'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative',
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
        // Per-round quiz cap from the plan (null = unlimited on premium); 500 is
        // the technical ceiling since the word queries below fetch at most 500.
        $roundLimit = $user->planLimit('quiz_per_round');
        $maxCount = $roundLimit ?? 500;
        $count = min(max((int) $request->input('count', 0), 0), $maxCount);

        // Parse comma-separated ids param for manual word selection
        $idsParam = $request->string('ids')->trim()->value();
        $selectedIds = $idsParam !== '' ? array_filter(array_map('trim', explode(',', $idsParam))) : [];
        if ($roundLimit !== null && count($selectedIds) > $roundLimit) {
            $selectedIds = array_slice($selectedIds, 0, $roundLimit);
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

        // Üres státusz, vagy az aktív gomb újrakattintása → levétel.
        if ($status === null || ($existing && $existing->pivot->status === $status)) {
            $request->user()->knownWords()->detach($word->id);

            return $this->statusToggleResponse($request, null, $forms);
        }

        if ($limitResponse = $this->reserveExtensionStatusWrite($request)) {
            return $limitResponse;
        }

        // Refund a lefoglalt extension-keret, ha a pivot-írás elbukik, hogy a
        // slot ne ragadjon benn (M3) — ugyanaz a minta, mint az ExtensionControllerben.
        try {
            $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => $status]]);
        } catch (\Throwable $e) {
            $this->refundExtensionStatusWrite($request);

            throw $e;
        }

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

    public function importance(Request $request, Word $word): RedirectResponse|JsonResponse
    {
        $importance = $request->validate(['importance' => 'nullable|integer|min:1|max:5'])['importance'];

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        if ($existing) {
            $request->user()->knownWords()->updateExistingPivot($word->id, ['importance' => $importance]);

            return $this->importanceToggleResponse($request, $importance);
        }

        // Még nincs mentve a szó: importance levételekor nincs mit tenni (ne hozzunk létre üres pivotot).
        if ($importance === null) {
            return $this->importanceToggleResponse($request, null);
        }

        $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => 'known', 'importance' => $importance]]);

        return $this->importanceToggleResponse($request, $importance);
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
