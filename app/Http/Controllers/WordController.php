<?php

namespace App\Http\Controllers;

use App\Models\Word;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WordController extends Controller
{
    private const PER_PAGE = 100;

    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->lower()->value();
        $letter = $request->string('letter')->trim()->upper()->value();
        $difficulty = $request->string('difficulty')->trim()->lower()->value();
        $statusFilter = $request->string('status')->trim()->lower()->value();

        $wordStatuses = $request->user()
            ->knownWords()
            ->pluck('user_word.status', 'words.id')
            ->all();

        $statusFilteredIds = $statusFilter !== ''
            ? array_keys(array_filter($wordStatuses, fn ($s) => $s === $statusFilter))
            : null;

        // Base query without letter filter — used for markedLetters so all letter buttons can be annotated
        $baseWithoutLetter = Word::query()
            ->when($search !== '', fn ($q) => $q->where('word', 'like', strtoupper($search).'%'))
            ->when($difficulty === 'beginner', fn ($q) => $q->whereBetween('rank', [1, 2000]))
            ->when($difficulty === 'intermediate', fn ($q) => $q->whereBetween('rank', [2001, 6000]))
            ->when($difficulty === 'advanced', fn ($q) => $q->whereBetween('rank', [6001, 10000]))
            ->when($statusFilteredIds !== null, fn ($q) => $q->whereIn('id', $statusFilteredIds));

        // Full query including the active letter filter — used for pagination and word list
        $baseQuery = (clone $baseWithoutLetter)
            ->when($search === '' && $letter !== '' && $letter !== 'ALL', fn ($q) => $q->where('word', 'like', $letter.'%'));

        $words = (clone $baseQuery)
            ->orderBy('rank')
            ->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Word $word) => [
                'id' => $word->id,
                'word' => $word->word,
                'rank' => $word->rank,
                'meaning' => $word->meaning,
                'status' => $wordStatuses[$word->id] ?? null,
            ]);

        $markedPages = (clone $baseQuery)
            ->orderBy('rank')
            ->pluck('id')
            ->values()
            ->map(fn ($id, $index) => isset($wordStatuses[$id]) ? (int) ceil(($index + 1) / self::PER_PAGE) : null)
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

        return Inertia::render('words/index', [
            'words' => $words,
            'filters' => ['search' => $search, 'letter' => $letter, 'difficulty' => $difficulty, 'status' => $statusFilter],
            'stats' => [
                'total' => Word::count(),
                'known' => $statusCounts['known'] ?? 0,
                'learning' => $statusCounts['learning'] ?? 0,
                'saved' => $statusCounts['saved'] ?? 0,
                'pronunciation' => $statusCounts['pronunciation'] ?? 0,
            ],
            'markedPages' => $markedPages,
            'markedLetters' => $markedLetters,
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
