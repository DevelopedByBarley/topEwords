<?php

namespace App\Http\Controllers;

use App\Models\Word;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WordController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->trim()->lower()->value();
        $letter = $request->string('letter')->trim()->upper()->value();

        $knownWordIds = $request->user()
            ->knownWords()
            ->pluck('word_id')
            ->flip()
            ->all();

        $words = Word::query()
            ->when($search !== '', fn ($q) => $q->where('word', 'like', $search.'%'))
            ->when($search === '' && $letter !== '' && $letter !== 'ALL', fn ($q) => $q->where('word', 'like', strtolower($letter).'%'))
            ->orderBy('rank')
            ->paginate(100)
            ->withQueryString()
            ->through(fn (Word $word) => [
                'id' => $word->id,
                'word' => $word->word,
                'rank' => $word->rank,
                'is_known' => isset($knownWordIds[$word->id]),
            ]);

        return Inertia::render('words/index', [
            'words' => $words,
            'filters' => ['search' => $search, 'letter' => $letter],
            'stats' => [
                'total' => Word::count(),
                'known' => count($knownWordIds),
            ],
        ]);
    }

    public function toggle(Request $request, Word $word): RedirectResponse
    {
        $request->user()->knownWords()->toggle($word->id);

        return back();
    }
}
