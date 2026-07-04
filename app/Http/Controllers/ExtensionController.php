<?php

namespace App\Http\Controllers;

use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\WordFormVariants;
use App\Services\WordStatusFormExpander;
use App\Services\YouTubeCaptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ExtensionController extends Controller
{
    /**
     * Collapse any whitespace run to a single space and trim. Captions separate
     * phrase words with NBSP, newlines or double spaces, so the raw token sent on
     * click ("get\u{00A0}rid\u{00A0}of") must be normalised to match how phrases
     * are stored and how the highlight map keys them ("get rid of").
     */
    private function normalizePhraseWhitespace(string $word): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', str_replace("\u{00A0}", ' ', $word)));
    }

    public function lookup(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $hasActiveAccess = $request->user()->hasActiveAccess();

        $word = $this->normalizePhraseWhitespace($request->string('word')->value());

        if (empty($word)) {
            return response()->json(['found' => false, 'word' => $word]);
        }

        $lower = strtolower($word);

        $match = Word::where(function ($q) use ($lower) {
            $q->whereRaw('LOWER(word) = ?', [$lower]);

            foreach (WordStatusFormExpander::FORM_COLUMNS as $column) {
                WordFormVariants::orWhereFormMatches($q, $column, $lower);
            }
        })->first(['id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'rank', 'example_en', 'example_hu']);

        if ($match) {
            $pivot = $request->user()->knownWords()
                ->wherePivot('word_id', $match->id)
                ->first()
                ?->pivot;

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
                'status' => $pivot?->status,
                'importance' => $pivot?->importance,
                'csrf' => csrf_token(),
                'has_active_access' => $hasActiveAccess,
            ]);
        }

        // Try custom words. Exact word match always counts (covers phrases like
        // "cut through"); conjugation-form matching is limited to single-word
        // entries so a phrase's single-word base form cannot hijack a plain word.
        $custom = UserCustomWord::where('user_id', $request->user()->id)
            ->where(function ($q) use ($lower) {
                $q->whereRaw('LOWER(word) = ?', [$lower])
                    ->orWhere(function ($q2) use ($lower) {
                        $q2->where('word', 'not like', '% %')
                            ->where(function ($q3) use ($lower) {
                                foreach (WordStatusFormExpander::FORM_COLUMNS as $column) {
                                    WordFormVariants::orWhereFormMatches($q3, $column, $lower);
                                }
                            });
                    });
            })
            ->first(['id', 'word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'example_en', 'example_hu', 'status', 'importance']);

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
                'importance' => $custom->importance,
                'csrf' => csrf_token(),
                'has_active_access' => $hasActiveAccess,
            ]);
        }

        return response()->json(['found' => false, 'word' => $word, 'csrf' => csrf_token(), 'has_active_access' => $hasActiveAccess]);
    }

    public function addWord(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        // A bővítményből indított írások közös napi keretbe számítanak (a Free
        // kap napi keretet, a Pro korlátlan); az olvasás mindenkinek ingyenes.
        if (! $request->user()->canWriteFromExtension()) {
            return response()->json(['error' => 'plan'], 403);
        }

        $data = $request->validate([
            'word' => ['required', 'string', 'max:100'],
            'meaning_hu' => ['required', 'string', 'max:255'],
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
            'status' => ['nullable', 'in:known,learning,saved,pronunciation,practice'],
            'importance' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        // Kanonikus szóköz, hogy a feliratból kattintott (NBSP-s) változat is
        // egyezzen a tárolt kifejezéssel a lookupnál.
        $data['word'] = $this->normalizePhraseWhitespace($data['word']);

        // A felvitelkor választott státusz az alapértelmezés; ha nincs megadva,
        // marad a korábbi viselkedés (a szó „Tudom" státusszal kerül be).
        $data['status'] = $data['status'] ?? 'known';

        $exists = $request->user()->customWords()->where('word', $data['word'])->exists();
        if ($exists) {
            return response()->json(['error' => 'duplicate']);
        }

        // Atomi foglalás közvetlenül az insert előtt — a fenti canWriteFromExtension()
        // csak gyors előszűrés, párhuzamos kérések ellen ez a tényleges kapu (#R6).
        if (! $request->user()->reserveExtensionWrite()) {
            return response()->json(['error' => 'plan'], 403);
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

    /**
     * A felhasználó flashcard-paklijai a popup legördülőjéhez, plusz az AI-hozzáférés.
     */
    public function decks(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $decks = $request->user()->flashcardDecks()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn ($deck) => ['id' => $deck->id, 'name' => $deck->name]);

        return response()->json([
            'decks' => $decks,
            'has_ai_access' => $request->user()->hasAiAccess(),
            'csrf' => csrf_token(),
        ]);
    }

    /**
     * Flashcard létrehozása a popupból a választott pakliba. Ugyanazokat a mezőket
     * és validációt használja, mint a webes szerkesztő (StoreFlashcardRequest), így
     * a kártya azonos módon kerül az adatbázisba.
     */
    public function createFlashcard(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        // A bővítményből indított írások közös napi keretbe számítanak (Free napi
        // keret, Pro korlátlan).
        if (! $request->user()->canWriteFromExtension()) {
            return response()->json(['error' => 'plan'], 403);
        }

        $data = $request->validate([
            'deck_id' => ['required', 'integer'],
            'word_id' => ['nullable', 'integer', Rule::exists('words', 'id')],
            'front' => ['required', 'string', 'max:10000'],
            'back' => ['required', 'string', 'max:10000'],
            'direction' => ['required', Rule::in(['front_to_back', 'back_to_front', 'both'])],
            'front_notes' => ['nullable', 'string', 'max:5000'],
            'front_speak' => ['nullable', 'string', 'max:1000'],
            'back_notes' => ['nullable', 'string', 'max:5000'],
            'back_speak' => ['nullable', 'string', 'max:1000'],
            'color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        // A pakli csak a saját paklik közül kereshető — így a tulajdon garantált.
        $deck = $request->user()->flashcardDecks()->find($data['deck_id']);

        if (! $deck) {
            return response()->json(['error' => 'deck_not_found'], 404);
        }

        if (! $request->user()->canAddFlashcards()) {
            return response()->json(['error' => 'limit']);
        }

        // Atomi foglalás közvetlenül az insert előtt — a fenti canWriteFromExtension()
        // csak gyors előszűrés, párhuzamos kérések ellen ez a tényleges kapu (#R6).
        if (! $request->user()->reserveExtensionWrite()) {
            return response()->json(['error' => 'plan'], 403);
        }

        $flashcard = $deck->flashcards()->create([
            'word_id' => $data['word_id'] ?? null,
            'front' => $data['front'],
            'back' => $data['back'],
            'direction' => $data['direction'],
            'front_notes' => $data['front_notes'] ?? null,
            'front_speak' => $data['front_speak'] ?? null,
            'back_notes' => $data['back_notes'] ?? null,
            'back_speak' => $data['back_speak'] ?? null,
            'color' => $data['color'] ?? null,
        ]);

        return response()->json([
            'ok' => true,
            'id' => $flashcard->id,
            'deck' => $deck->name,
            'csrf' => csrf_token(),
        ]);
    }

    public function statuses(Request $request, WordStatusFormExpander $formExpander): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $userId = $request->user()->id;
        $formColumns = WordStatusFormExpander::FORM_COLUMNS;

        $markedWords = DB::table('user_word')
            ->join('words', 'words.id', '=', 'user_word.word_id')
            ->where('user_word.user_id', $userId)
            ->whereNotNull('user_word.status')
            ->where('user_word.status', '!=', '')
            ->get(['user_word.status', 'words.word', ...array_map(fn ($column) => "words.{$column}", $formColumns)]);

        $customWords = UserCustomWord::where('user_id', $userId)
            ->whereNotNull('status')
            ->where('status', '!=', '')
            ->get(['status', 'word', ...$formColumns]);

        // Map every marked word AND all of its inflected forms to the same status,
        // so captions/pages match conjugations like "changed" → "change" or "has" → "have".
        return response()->json([
            'statuses' => $formExpander->mapFrom($markedWords->concat($customWords)),
        ]);
    }

    /**
     * Timestamped caption segments for the in-page YouTube transcript sidebar.
     */
    public function youtubeTranscript(Request $request, YouTubeCaptionService $captions): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $videoId = $request->string('v')->trim()->value();

        if (! preg_match('/^[a-zA-Z0-9_-]{11}$/', $videoId)) {
            return response()->json(['error' => 'invalid_video_id'], 422);
        }

        // Videónkénti cache-ből jön (userek közt megosztva), így ugyanaz a videó
        // naponta legfeljebb egyszer scrape-eli a YouTube-ot (#M7).
        try {
            $transcript = $captions->fetchTranscript($videoId);
        } catch (\Throwable) {
            return response()->json(['error' => 'no_captions'], 422);
        }

        return response()->json([
            'title' => $transcript['title'] ?? 'YouTube',
            'segments' => $transcript['segments'],
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
            return response()->json(['error' => 'unauthenticated'], 401);
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
                foreach (WordStatusFormExpander::FORM_COLUMNS as $column) {
                    WordFormVariants::orWhereFormMatches($query, $column, $lower);
                }
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
                $q2->where('word', 'LIKE', $like.'%');

                foreach (WordStatusFormExpander::FORM_COLUMNS as $column) {
                    WordFormVariants::orWhereFormMatches($q2, $column, $lower);
                }
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
            'has_ai_access' => $request->user()->hasAiAccess(),
            'is_admin' => Gate::check('admin'),
            'csrf' => csrf_token(),
        ]);
    }
}
