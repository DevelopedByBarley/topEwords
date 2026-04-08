<?php

namespace App\Http\Controllers;

use App\Models\UserCustomWord;
use App\Models\Word;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        // Try exact match first, then case-insensitive
        $match = Word::where('word', $word)
            ->orWhere('word', strtolower($word))
            ->orWhere('word', ucfirst(strtolower($word)))
            ->first(['id', 'word', 'meaning_hu', 'extra_meanings', 'part_of_speech', 'rank']);

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
                'part_of_speech' => $match->part_of_speech,
                'rank' => $match->rank,
                'status' => $status,
                'csrf' => csrf_token(),
                'has_active_access' => $hasActiveAccess,
            ]);
        }

        // Try custom words
        $custom = UserCustomWord::where('user_id', $request->user()->id)
            ->where('word', $word)
            ->orWhere(function ($q) use ($word, $request) {
                $q->where('user_id', $request->user()->id)
                    ->where('word', strtolower($word));
            })
            ->first(['id', 'word', 'meaning_hu', 'extra_meanings', 'part_of_speech', 'status']);

        if ($custom) {
            return response()->json([
                'found' => true,
                'id' => $custom->id,
                'is_custom' => true,
                'word' => $custom->word,
                'meaning_hu' => $custom->meaning_hu,
                'extra_meanings' => $custom->extra_meanings,
                'part_of_speech' => $custom->part_of_speech,
                'rank' => null,
                'status' => $custom->status,
                'csrf' => csrf_token(),
                'has_active_access' => $hasActiveAccess,
            ]);
        }

        return response()->json(['found' => false, 'word' => $word, 'csrf' => csrf_token(), 'has_active_access' => $hasActiveAccess]);
    }
}
