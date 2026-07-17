<?php

namespace App\Http\Controllers;

use App\Concerns\TogglesWordStatus;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use App\Services\WordFormVariants;
use App\Services\WordStatusFormExpander;
use App\Services\YouTubeCaptionService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ExtensionController extends Controller
{
    use TogglesWordStatus;

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

    /**
     * CSRF-token a válaszban a session-alapú kliensnek (Chrome extension).
     * A desktop lejátszó Bearer-tokennel, session nélkül hívja ugyanezeket a
     * végpontokat — ott nincs (és nem is kell) CSRF, a csrf_token() pedig
     * session híján kivételt dobna.
     */
    private function csrfTokenIfSession(Request $request): ?string
    {
        return $request->hasSession() ? csrf_token() : null;
    }

    public function lookup(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $hasActiveAccess = $request->user()->hasActiveAccess();
        $canWrite = $request->user()->canWriteFromExtension();

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
                'csrf' => $this->csrfTokenIfSession($request),
                'has_active_access' => $hasActiveAccess,
                'can_write' => $canWrite,
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
                'csrf' => $this->csrfTokenIfSession($request),
                'has_active_access' => $hasActiveAccess,
                'can_write' => $canWrite,
            ]);
        }

        return response()->json(['found' => false, 'word' => $word, 'csrf' => $this->csrfTokenIfSession($request), 'has_active_access' => $hasActiveAccess, 'can_write' => $canWrite]);
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

        // A fenti $exists előszűrés és az insert között két párhuzamos, azonos szóra
        // futó kérés is átjuthat; a (user_id, word) unique index elkapja a másodikat.
        // Ilyenkor ne 500-azzunk, és adjuk vissza a lefoglalt keretet — duplikátumot
        // jelzünk, épp úgy, mint az előszűrésnél (#L1).
        try {
            $custom = $request->user()->customWords()->create($data);
        } catch (UniqueConstraintViolationException) {
            $request->user()->refundExtensionWrite();

            return response()->json(['error' => 'duplicate']);
        }

        return response()->json([
            'ok' => true,
            'id' => $custom->id,
            'word' => $custom->word,
            'meaning_hu' => $custom->meaning_hu,
            'csrf' => $this->csrfTokenIfSession($request),
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
            'csrf' => $this->csrfTokenIfSession($request),
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

        // Atomi napi-keret foglalás közvetlenül az insert előtt — a fenti
        // canWriteFromExtension() csak gyors előszűrés, párhuzamos kérések ellen ez
        // a tényleges kapu (#R6).
        if (! $request->user()->reserveExtensionWrite()) {
            return response()->json(['error' => 'plan'], 403);
        }

        // A kártyakeret-kaput és az insertet egy user-szintű zár alá vonjuk, hogy
        // párhuzamos kérések ne csússzanak át ugyanazon az elavult kártyaszámon (#R1).
        // Ha bármelyik ág elbukik, a fent lefoglalt napi keretet visszaadjuk (#R2).
        $flashcard = null;

        try {
            $reserved = $request->user()->reserveFlashcardSlots(1, function () use ($deck, $data, &$flashcard) {
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
            });
        } catch (\Throwable $e) {
            $request->user()->refundExtensionWrite();

            throw $e;
        }

        if (! $reserved) {
            $request->user()->refundExtensionWrite();

            return response()->json(['error' => 'limit'], 403);
        }

        return response()->json([
            'ok' => true,
            'id' => $flashcard->id,
            'deck' => $deck->name,
            'csrf' => $this->csrfTokenIfSession($request),
        ]);
    }

    /**
     * Szó-státusz állítása a token-alapú kliensből (desktop lejátszó). A webes
     * WordController/UserCustomWordController toggle-szemantikáját követi:
     * null vagy az aktív státusz újraküldése = levétel. A státusz-FELVÉTEL a
     * közös napi extension-írás keretbe számít (a levétel nem, hogy a betelt
     * keret ne akadályozza a visszavonást) — ugyanaz az üzleti szabály, mint a
     * bővítmény-origines webes írásoknál.
     */
    public function updateStatus(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $data = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
            'is_custom' => ['required', 'boolean'],
        ]);

        $status = $this->validatedToggleStatus($request);

        if ($data['is_custom']) {
            // Csak a saját szavai közt keresünk — a tulajdon így garantált.
            $customWord = $request->user()->customWords()->find($data['id']);

            if (! $customWord) {
                return response()->json(['error' => 'not_found'], 404);
            }

            if ($status === null || $customWord->status === $status) {
                $customWord->update(['status' => null]);

                return response()->json(['ok' => true, 'status' => null, 'forms' => $this->statusFormsFor($customWord)]);
            }

            if (! $request->user()->reserveExtensionWrite()) {
                return response()->json(['error' => 'plan'], 403);
            }

            // Ha az update elbukik, a fent lefoglalt napi keretet visszaadjuk,
            // hogy egy DB-hiba miatt ne vesszen el egy slot (az addWord/
            // createFlashcard-dal azonos refund-szemantika, S1).
            try {
                $customWord->update(['status' => $status]);
            } catch (\Throwable $e) {
                $request->user()->refundExtensionWrite();

                throw $e;
            }

            $this->recordStatusActivity($request);

            return response()->json(['ok' => true, 'status' => $status, 'forms' => $this->statusFormsFor($customWord)]);
        }

        $word = Word::find($data['id']);

        if (! $word) {
            return response()->json(['error' => 'not_found'], 404);
        }

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        if ($status === null || ($existing && $existing->pivot->status === $status)) {
            $request->user()->knownWords()->detach($word->id);

            return response()->json(['ok' => true, 'status' => null, 'forms' => $this->statusFormsFor($word)]);
        }

        if (! $request->user()->reserveExtensionWrite()) {
            return response()->json(['error' => 'plan'], 403);
        }

        // Refund a lefoglalt keret, ha a pivot-írás elbukik (S1).
        try {
            $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => $status]]);
        } catch (\Throwable $e) {
            $request->user()->refundExtensionWrite();

            throw $e;
        }

        $this->recordStatusActivity($request);

        return response()->json(['ok' => true, 'status' => $status, 'forms' => $this->statusFormsFor($word)]);
    }

    /**
     * Szó-fontosság állítása a token-alapú kliensből. A webes megfelelővel
     * azonos szabályok (1–5 vagy null; pivot nélküli szónál a beállítás
     * 'known' státusszal veszi fel a szót, a levétel nem csinál semmit).
     * Meglévő jelölés módosítása nem számít az írás-keretbe, de az ÚJ szó
     * felvétele igen — különben a csillagozás keret nélküli felvételi út
     * lenne a státusz-állítás mellett (PL-M1).
     */
    public function updateImportance(Request $request): JsonResponse
    {
        if (! $request->user()) {
            return response()->json(['error' => 'unauthenticated'], 401);
        }

        $data = $request->validate([
            'id' => ['required', 'integer', 'min:1'],
            'is_custom' => ['required', 'boolean'],
            'importance' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $importance = $data['importance'] ?? null;

        if ($data['is_custom']) {
            $customWord = $request->user()->customWords()->find($data['id']);

            if (! $customWord) {
                return response()->json(['error' => 'not_found'], 404);
            }

            $customWord->update(['importance' => $importance]);

            return response()->json(['ok' => true, 'importance' => $importance]);
        }

        $word = Word::find($data['id']);

        if (! $word) {
            return response()->json(['error' => 'not_found'], 404);
        }

        $existing = $request->user()->knownWords()->wherePivot('word_id', $word->id)->first();

        if ($existing) {
            $request->user()->knownWords()->updateExistingPivot($word->id, ['importance' => $importance]);
        } elseif ($importance !== null) {
            if (! $request->user()->reserveExtensionWrite()) {
                return response()->json(['error' => 'plan'], 403);
            }

            // Refund a lefoglalt keret, ha a pivot-írás elbukik (S1).
            try {
                $request->user()->knownWords()->syncWithoutDetaching([$word->id => ['status' => 'known', 'importance' => $importance]]);
            } catch (\Throwable $e) {
                $request->user()->refundExtensionWrite();

                throw $e;
            }

            // Ez az ág ténylegesen új 'known' szót vesz fel — tartalmilag azonos az
            // updateStatus felvételével, ezért ugyanúgy könyveli a streaket/achievementet
            // (PL-L6). A fenti $existing-ág csak meglévő jelölést módosít, ott nincs új
            // aktivitás, ezért oda nem való könyvelés.
            $this->recordStatusActivity($request);
        }

        return response()->json(['ok' => true, 'importance' => $importance]);
    }

    /**
     * Státusz-felvétel utáni streak- és achievement-könyvelés. A webes
     * megfelelők session-flash-sel jeleznek a UI-nak; a token-alapú kliensnek
     * nincs session-je, ezért itt csak az adat-oldali hatások futnak le.
     */
    private function recordStatusActivity(Request $request): void
    {
        $request->user()->updateStreak();

        app(AchievementService::class)->checkAndAward($request->user(), ['streak', 'vocab', 'known', 'custom']);
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
            return response()->json(['results' => [], 'csrf' => $this->csrfTokenIfSession($request)]);
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
            'can_write' => $request->user()->canWriteFromExtension(),
            'has_ai_access' => $request->user()->hasAiAccess(),
            'is_admin' => Gate::check('admin'),
            'csrf' => $this->csrfTokenIfSession($request),
        ]);
    }
}
