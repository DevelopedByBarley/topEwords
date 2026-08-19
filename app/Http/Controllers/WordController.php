<?php

namespace App\Http\Controllers;

use App\Concerns\TogglesWordStatus;
use App\Models\Folder;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use App\Services\WordIndexFilters;
use App\Services\WordPageMarkers;
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

    public function index(Request $request): Response
    {
        $filters = WordIndexFilters::fromRequest($request);
        $user = $request->user();
        $perPage = $filters->perPage();

        $words = null;
        $getWords = function () use (&$words, $filters, $perPage) {
            if ($words !== null) {
                return $words;
            }

            $paginated = $filters->baseQuery()->orderBy('rank')->paginate($perPage)->withQueryString();

            $pageMarks = $filters->pivot()
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
                'extra_forms' => $word->extra_forms,
                // Boolean, nem időbélyeg: a felületnek csak az kell, hogy az admin
                // alak-kitöltő megnézte-e már — így az UTC/lokál-idő kérdés fel sem jön.
                'forms_checked' => $word->forms_checked_at !== null,
                'example_en' => $word->example_en,
                'example_hu' => $word->example_hu,
                'status' => $pageMarks->get($word->id)?->status,
                'importance' => $pageMarks->get($word->id)?->importance,
            ]);
        };

        $markers = null;
        $getMarkers = function () use (&$markers, $filters, $perPage): WordPageMarkers {
            return $markers ??= new WordPageMarkers(
                $filters->markedIds(),
                $filters->orderedIds(),
                $perPage,
            );
        };

        return Inertia::render('words/index', [
            'words' => $getWords,
            'filters' => $filters->toArray(),
            'stats' => function () use ($filters) {
                $statusCounts = $filters->pivot()->selectRaw('status, COUNT(*) as cnt')->groupBy('status')->pluck('cnt', 'status');

                return [
                    'total' => Word::count(),
                    'known' => (int) ($statusCounts['known'] ?? 0),
                    'learning' => (int) ($statusCounts['learning'] ?? 0),
                    'saved' => (int) ($statusCounts['saved'] ?? 0),
                    'pronunciation' => (int) ($statusCounts['pronunciation'] ?? 0),
                    'practice' => (int) ($statusCounts['practice'] ?? 0),
                ];
            },
            'customWords' => fn () => $filters->customWords(),
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
            'markedPages' => fn () => $getMarkers()->markedPages(),
            'completedPages' => fn () => $getMarkers()->completedPages(),
            'markedLetters' => fn () => $filters->markedLetters(),
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
            'extra_forms' => ['nullable', 'string', 'max:255'],
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

        // Ez az ág ÚJ 'known' szót vesz fel, ezért ugyanúgy a napi extension-írás
        // keretbe számít, mint a status felvétele — különben a csillagozás keret
        // nélküli felvételi út lenne (EXT-M1). Meglévő jelölés módosítása (a fenti
        // ág) nem fogyaszt keretet. A player ikertestvére ugyanez: PL-M1,
        // ExtensionController::updateImportance.
        if ($limitResponse = $this->reserveExtensionStatusWrite($request)) {
            return $limitResponse;
        }

        try {
            $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => 'known', 'importance' => $importance]]);
        } catch (\Throwable $e) {
            $this->refundExtensionStatusWrite($request);

            throw $e;
        }

        return $this->importanceToggleResponse($request, $importance);
    }

    private function likeEscape(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
