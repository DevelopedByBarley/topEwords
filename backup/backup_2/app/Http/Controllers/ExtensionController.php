<?php

namespace App\Http\Controllers;

use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class ExtensionController extends Controller
{
    public function lookup(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated']);
        }

        $hasActiveAccess = $request->user()->hasActiveAccess();

        $word = $request->string('word')->trim()->value();

        if (empty($word)) {
            return response()->json(['found' => false, 'word' => $word]);
        }

        $lower = strtolower($word);

        $match = Word::where(function ($q) use ($lower) {
            $q->whereRaw('LOWER(word) = ?', [$lower])
                ->orWhereRaw('LOWER(form_base) = ?', [$lower])
                ->orWhereRaw('LOWER(verb_past) = ?', [$lower])
                ->orWhereRaw('LOWER(verb_past_participle) = ?', [$lower])
                ->orWhereRaw('LOWER(verb_present_participle) = ?', [$lower])
                ->orWhereRaw('LOWER(verb_third_person) = ?', [$lower])
                ->orWhereRaw('LOWER(noun_plural) = ?', [$lower])
                ->orWhereRaw('LOWER(adj_comparative) = ?', [$lower])
                ->orWhereRaw('LOWER(adj_superlative) = ?', [$lower]);
        })->first(['id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'rank', 'example_en', 'example_hu']);

        if ($match) {
            $status = $request->user()->knownWords()
                ->wherePivot('word_id', $match->id)
                ->first()
                ?->pivot->status;

            return response()->json([
                'found' => true,
                'id' => $match->id,
                'is_custom' => false,
                'word' => $match->word,
                'meaning_hu' => $match->meaning_hu,
                'extra_meanings' => $match->extra_meanings,
                'synonyms' => $match->synonyms,
                'part_of_speech' => $match->part_of_speech,
                'rank' => $match->rank,
                'example_en' => $match->example_en,
                'example_hu' => $match->example_hu,
                'status' => $status,
                'csrf' => csrf_token(),
                'has_active_access' => $hasActiveAccess,
            ]);
        }

        // Try custom words (all forms)
        $custom = UserCustomWord::where('user_id', $request->user()->id)
            ->where(function ($q) use ($lower) {
                $q->whereRaw('LOWER(word) = ?', [$lower])
                    ->orWhereRaw('LOWER(form_base) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_past) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_past_participle) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_present_participle) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_third_person) = ?', [$lower])
                    ->orWhereRaw('LOWER(noun_plural) = ?', [$lower])
                    ->orWhereRaw('LOWER(adj_comparative) = ?', [$lower])
                    ->orWhereRaw('LOWER(adj_superlative) = ?', [$lower]);
            })
            ->first(['id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'example_en', 'example_hu', 'status']);

        if ($custom) {
            return response()->json([
                'found' => true,
                'id' => $custom->id,
                'is_custom' => true,
                'word' => $custom->word,
                'meaning_hu' => $custom->meaning_hu,
                'extra_meanings' => $custom->extra_meanings,
                'synonyms' => $custom->synonyms,
                'part_of_speech' => $custom->part_of_speech,
                'rank' => null,
                'example_en' => $custom->example_en,
                'example_hu' => $custom->example_hu,
                'status' => $custom->status,
                'csrf' => csrf_token(),
                'has_active_access' => $hasActiveAccess,
            ]);
        }

        return response()->json(['found' => false, 'word' => $word, 'csrf' => csrf_token(), 'has_active_access' => $hasActiveAccess]);
    }

    public function addWord(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated']);
        }

        $data = $request->validate([
            'word' => ['required', 'string', 'max:100'],
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

        if ($request->user()->isOnFreePlan() && $request->user()->customWords()->count() >= 10) {
            return response()->json(['error' => 'limit']);
        }

        $exists = $request->user()->customWords()->where('word', $data['word'])->exists();
        if ($exists) {
            return response()->json(['error' => 'duplicate']);
        }

        $custom = $request->user()->customWords()->create($data);

        return response()->json([
            'ok' => true,
            'id' => $custom->id,
            'word' => $custom->word,
            'meaning_hu' => $custom->meaning_hu,
            'csrf' => csrf_token(),
        ]);
    }

    public function statuses(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated']);
        }

        $userId = $request->user()->id;

        $wordStatuses = DB::table('user_word')
            ->join('words', 'words.id', '=', 'user_word.word_id')
            ->where('user_word.user_id', $userId)
            ->whereNotNull('user_word.status')
            ->where('user_word.status', '!=', '')
            ->pluck('user_word.status', 'words.word');

        $customStatuses = UserCustomWord::where('user_id', $userId)
            ->whereNotNull('status')
            ->where('status', '!=', '')
            ->pluck('status', 'word');

        return response()->json([
            'statuses' => $wordStatuses->merge($customStatuses),
        ]);
    }

    public function badge(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['count' => 0]);
        }

        $count = DB::table('user_word')
            ->where('user_id', $request->user()->id)
            ->where('status', 'learning')
            ->count();

        $customCount = UserCustomWord::where('user_id', $request->user()->id)
            ->where('status', 'learning')
            ->count();

        return response()->json(['count' => $count + $customCount]);
    }

    public function search(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated']);
        }

        $q = $request->string('q')->trim()->value();

        if (strlen($q) < 1) {
            return response()->json(['results' => [], 'csrf' => csrf_token()]);
        }

        $hasActiveAccess = $request->user()->hasActiveAccess();
        $userId = $request->user()->id;

        $lower = strtolower($q);
        $like = addcslashes($q, '%_\\');

        $words = Word::where('word', 'LIKE', $like.'%')
            ->orWhere(function ($query) use ($lower) {
                $query->whereRaw('LOWER(form_base) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_past) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_past_participle) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_present_participle) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_third_person) = ?', [$lower])
                    ->orWhereRaw('LOWER(noun_plural) = ?', [$lower])
                    ->orWhereRaw('LOWER(adj_comparative) = ?', [$lower])
                    ->orWhereRaw('LOWER(adj_superlative) = ?', [$lower]);
            })
            ->orderBy('rank')
            ->limit(10)
            ->get(['id', 'word', 'meaning_hu', 'extra_meanings', 'part_of_speech', 'rank']);

        $wordIds = $words->pluck('id');

        $statuses = DB::table('user_word')
            ->where('user_id', $userId)
            ->whereIn('word_id', $wordIds)
            ->pluck('status', 'word_id');

        $results = $words->map(fn ($w) => [
            'id' => $w->id,
            'is_custom' => false,
            'word' => $w->word,
            'meaning_hu' => $w->meaning_hu,
            'extra_meanings' => $w->extra_meanings,
            'part_of_speech' => $w->part_of_speech,
            'rank' => $w->rank,
            'status' => $statuses->get($w->id),
        ]);

        $customs = UserCustomWord::where('user_id', $userId)
            ->where(function ($q2) use ($like, $lower) {
                $q2->where('word', 'LIKE', $like.'%')
                    ->orWhereRaw('LOWER(form_base) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_past) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_past_participle) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_present_participle) = ?', [$lower])
                    ->orWhereRaw('LOWER(verb_third_person) = ?', [$lower])
                    ->orWhereRaw('LOWER(noun_plural) = ?', [$lower])
                    ->orWhereRaw('LOWER(adj_comparative) = ?', [$lower])
                    ->orWhereRaw('LOWER(adj_superlative) = ?', [$lower]);
            })
            ->limit(5)
            ->get(['id', 'word', 'meaning_hu', 'extra_meanings', 'part_of_speech', 'status']);

        $customResults = $customs->map(fn ($c) => [
            'id' => $c->id,
            'is_custom' => true,
            'word' => $c->word,
            'meaning_hu' => $c->meaning_hu,
            'extra_meanings' => $c->extra_meanings,
            'part_of_speech' => $c->part_of_speech,
            'rank' => null,
            'status' => $c->status,
        ]);

        return response()->json([
            'results' => $results->concat($customResults)->values(),
            'has_active_access' => $hasActiveAccess,
            'is_admin' => Gate::check('admin'),
            'csrf' => csrf_token(),
        ]);
    }
}
