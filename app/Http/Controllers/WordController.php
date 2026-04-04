<?php

namespace App\Http\Controllers;

use App\Models\Folder;
use App\Models\Word;
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
        $difficulty = $request->string('difficulty')->trim()->lower()->value();
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
            ->when($difficulty === 'beginner', fn ($q) => $q->whereBetween('rank', [1, 2000]))
            ->when($difficulty === 'intermediate', fn ($q) => $q->whereBetween('rank', [2001, 6000]))
            ->when($difficulty === 'advanced', fn ($q) => $q->whereBetween('rank', [6001, 10000]))
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

        return Inertia::render('words/index', [
            'words' => $words,
            'filters' => ['search' => $search, 'letter' => $letter, 'difficulty' => $difficulty, 'status' => $statusFilter, 'folder' => $folderId, 'per_page' => $perPage],
            'stats' => [
                'total' => Word::count(),
                'known' => $statusCounts['known'] ?? 0,
                'learning' => $statusCounts['learning'] ?? 0,
                'saved' => $statusCounts['saved'] ?? 0,
                'pronunciation' => $statusCounts['pronunciation'] ?? 0,
            ],
            'markedPages' => $markedPages,
            'markedLetters' => $markedLetters,
            'folders' => $folders,
            'wordFolderIds' => $wordFolderIds,
        ]);
    }

    public function quiz(Request $request): Response
    {
        $status = $request->string('status')->trim()->lower()->value();
        $difficulty = $request->string('difficulty')->trim()->lower()->value();
        $folderId = $request->integer('folder') ?: null;
        $count = min(max((int) $request->input('count', 0), 0), 500);

        $user = $request->user();

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

        if ($difficulty === 'beginner') {
            $query->whereBetween('rank', [1, 2000]);
        } elseif ($difficulty === 'intermediate') {
            $query->whereBetween('rank', [2001, 6000]);
        } elseif ($difficulty === 'advanced') {
            $query->whereBetween('rank', [6001, 10000]);
        }

        if ($folderWordIds !== null) {
            $query->whereIn('id', $folderWordIds);
        }

        $available = $query->count();

        $words = [];

        if ($count > 0 && $available > 0) {
            $quizWords = (clone $query)->inRandomOrder()->limit($count)->get(['id', 'word', 'meaning_hu', 'part_of_speech', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'example_en', 'example_hu', 'synonyms', 'rank']);

            $decoyPool = Word::whereNotNull('meaning_hu')
                ->whereNotIn('id', $quizWords->pluck('id'))
                ->inRandomOrder()
                ->limit($count * 4)
                ->pluck('meaning_hu')
                ->shuffle()
                ->values()
                ->all();

            $words = $quizWords->map(function (Word $word, int $i) use ($decoyPool, $wordStatuses) {
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
                    'options' => $options,
                ];
            })->all();
        }

        return Inertia::render('words/quiz', [
            'words' => $words,
            'available' => $available,
            'folders' => $folders,
            'filters' => [
                'status' => $status,
                'difficulty' => $difficulty,
                'folder' => $folderId,
                'count' => $count,
            ],
        ]);
    }

    public function status(Request $request, Word $word): RedirectResponse
    {
        $status = $request->validate(['status' => 'required|in:known,learning,saved,pronunciation'])['status'];

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        if ($existing && $existing->pivot->status === $status) {
            $request->user()->knownWords()->detach($word->id);
        } else {
            $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => $status]]);
            if ($request->user()->updateStreak()) {
                session()->flash('streak_triggered', $request->user()->streak);
            }
        }

        return back();
    }
}
