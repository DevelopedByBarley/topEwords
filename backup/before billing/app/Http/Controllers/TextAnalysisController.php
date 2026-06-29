<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserBook;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Models\YoutubeTranscript;
use App\Services\AchievementService;
use App\Services\AiCacheService;
use App\Services\AiUsageService;
use App\Services\YouTubeCaptionService;
use GuzzleHttp\Psr7\UriResolver;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Smalot\PdfParser\Parser as PdfParser;

class TextAnalysisController extends Controller
{
    public function __construct(
        private YouTubeCaptionService $captions,
        private AiUsageService $aiUsage,
        private AiCacheService $aiCache,
    ) {}

    /**
     * Cache-elhető AI-feladatok aktuális prompt-verziója. A prompt érdemi
     * módosításakor növeld az értéket: a régi sorok új kulcsra váltanak, és az
     * `ai:cache:clear` paranccsal kipucolhatók. (A mondat-/gyakorlat-ellenőrzés
     * felhasználó-egyedi, ezért nincs itt és nem cache-elődik.)
     */
    private const AI_CACHE_VERSION = [
        'lookup' => 4,
        'flashcard' => 3,
        'insight' => 2,
    ];

    /**
     * Returns a 429 response when the user has exhausted their monthly AI
     * quota, or null when they may proceed. Admins (unlimited) never hit this.
     */
    private function aiLimitGuard(Request $request): ?JsonResponse
    {
        $user = $request->user();

        if ($user === null || $this->aiUsage->allows($user)) {
            return null;
        }

        return response()->json([
            'error' => 'ai_limit',
            'message' => 'Elérted a havi AI-felhasználási kereted. A keret a következő hónap elején újraindul.',
            ...$this->aiUsage->snapshot($user),
        ], 429);
    }

    public function show(): Response
    {
        return Inertia::render('text-analysis/index');
    }

    public function wordLookup(Request $request): JsonResponse
    {
        $raw = $request->string('word')->trim()->lower()->value();

        if (strlen($raw) < 1) {
            return response()->json(['type' => 'not_found']);
        }

        $user = $request->user();

        // Check user's custom words first. Exact match on the stored word always
        // counts (covers phrases like "cut through"); form-based (conjugation)
        // matching is restricted to single-word entries, so a phrase's single-word
        // base form ("cut") cannot hijack a plain word lookup.
        $customWord = $user->customWords()
            ->where(function ($q) use ($raw) {
                $q->whereRaw('LOWER(word) = ?', [$raw])
                    ->orWhere(function ($q2) use ($raw) {
                        $q2->where('word', 'not like', '% %')
                            ->where(function ($q3) use ($raw) {
                                $q3->whereRaw('LOWER(form_base) = ?', [$raw])
                                    ->orWhereRaw('LOWER(verb_past) = ?', [$raw])
                                    ->orWhereRaw('LOWER(verb_past_participle) = ?', [$raw])
                                    ->orWhereRaw('LOWER(verb_present_participle) = ?', [$raw])
                                    ->orWhereRaw('LOWER(verb_third_person) = ?', [$raw])
                                    ->orWhereRaw('LOWER(noun_plural) = ?', [$raw])
                                    ->orWhereRaw('LOWER(adj_comparative) = ?', [$raw])
                                    ->orWhereRaw('LOWER(adj_superlative) = ?', [$raw]);
                            });
                    });
            })
            ->first();
        if ($customWord) {
            return response()->json([
                'type' => 'custom',
                'id' => $customWord->id,
                'word' => $customWord->word,
                'meaning_hu' => $customWord->meaning_hu,
                'example_en' => $customWord->example_en,
                'part_of_speech' => $customWord->part_of_speech,
                'status' => $customWord->status,
            ]);
        }

        // Check main word list (all forms)
        $word = Word::where(function ($q) use ($raw) {
            $q->whereRaw('LOWER(word) = ?', [$raw])
                ->orWhereRaw('LOWER(form_base) = ?', [$raw])
                ->orWhereRaw('LOWER(verb_past) = ?', [$raw])
                ->orWhereRaw('LOWER(verb_past_participle) = ?', [$raw])
                ->orWhereRaw('LOWER(verb_present_participle) = ?', [$raw])
                ->orWhereRaw('LOWER(verb_third_person) = ?', [$raw])
                ->orWhereRaw('LOWER(noun_plural) = ?', [$raw])
                ->orWhereRaw('LOWER(adj_comparative) = ?', [$raw])
                ->orWhereRaw('LOWER(adj_superlative) = ?', [$raw]);
        })->first();

        if (! $word) {
            return response()->json(['type' => 'not_found', 'word' => $raw]);
        }

        $status = $user->knownWords()->wherePivot('word_id', $word->id)->first()?->pivot->status;

        return response()->json([
            'type' => 'word',
            'id' => $word->id,
            'word' => $word->word,
            'meaning_hu' => $word->meaning_hu,
            'example_en' => $word->example_en,
            'part_of_speech' => $word->part_of_speech,
            'rank' => $word->rank,
            'status' => $status,
        ]);
    }

    public function fetchSource(Request $request): JsonResponse
    {
        $url = $request->validate(['url' => 'required|url:http,https|max:2000'])['url'];

        $videoId = $this->captions->extractVideoId($url);

        try {
            if ($videoId === null) {
                $this->assertPublicHost($url);
            }

            $text = $videoId !== null
                ? $this->captions->segmentsToText($this->captions->fetchCaptions($videoId))
                : $this->fetchWebpageText($url);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable) {
            return response()->json(['error' => 'A forrás nem érhető el. Próbáld újra később.'], 422);
        }

        $text = mb_substr($text, 0, 15000);

        return response()->json(['text' => $text]);
    }

    /**
     * Resolve the URL's host and ensure it points to a public IP (SSRF guard).
     * Returns the validated IP so the caller can pin the connection to it
     * (defeats DNS rebinding). Throws if the host is missing, unresolvable,
     * or resolves to a private/reserved range.
     */
    private function assertPublicHost(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            throw new \RuntimeException('Érvénytelen URL.');
        }

        $ip = filter_var($host, FILTER_VALIDATE_IP) ? $host : gethostbyname($host);

        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            throw new \RuntimeException('Ez a cím nem érhető el.');
        }

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new \RuntimeException('Ez a cím nem érhető el.');
        }

        return $ip;
    }

    /**
     * SSRF-safe HTTP GET. Redirects are followed manually so every hop's host
     * is re-validated as public, and each request is pinned to the validated
     * IP (CURLOPT_RESOLVE) so a rebinding DNS answer cannot redirect the
     * connection to an internal address between the check and the connect.
     */
    private function safeFetch(string $url): \Illuminate\Http\Client\Response
    {
        $maxRedirects = 5;

        for ($hop = 0; $hop <= $maxRedirects; $hop++) {
            $ip = $this->assertPublicHost($url);
            $host = parse_url($url, PHP_URL_HOST);
            $scheme = parse_url($url, PHP_URL_SCHEME) ?: 'http';
            $port = parse_url($url, PHP_URL_PORT) ?: ($scheme === 'https' ? 443 : 80);

            $response = Http::timeout(15)
                ->withoutRedirecting()
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'])
                ->withOptions(['curl' => [CURLOPT_RESOLVE => ["{$host}:{$port}:{$ip}"]]])
                ->get($url);

            if (! $response->redirect()) {
                return $response;
            }

            $location = $response->header('Location');

            if ($location === '') {
                return $response;
            }

            // Resolve relative redirects against the current URL and require http(s).
            $next = (string) UriResolver::resolve(Utils::uriFor($url), Utils::uriFor($location));

            if (! in_array(parse_url($next, PHP_URL_SCHEME), ['http', 'https'], true)) {
                throw new \RuntimeException('Ez a cím nem érhető el.');
            }

            $url = $next;
        }

        throw new \RuntimeException('Túl sok átirányítás.');
    }

    public function analyze(Request $request): JsonResponse
    {
        $text = $request->validate(['text' => 'required|string|max:15000'])['text'];

        $user = $request->user();

        if ($user->isOnFreePlan()) {
            $cacheKey = "text_analysis_daily_{$user->id}_".today()->format('Y-m-d');
            $dailyCount = Cache::get($cacheKey, 0);

            if ($dailyCount >= 2) {
                return response()->json([
                    'error' => 'limit_reached',
                    'message' => 'Napi 2 szövegelemzést használhatsz ingyenesen. Frissíts prémiumra a korlátlan hozzáféréshez.',
                    'upgrade_url' => route('pricing'),
                ], 403);
            }

            Cache::put($cacheKey, $dailyCount + 1, now()->endOfDay());
        }

        $analysis = $this->buildAnalysis($text, $user);

        $newAchievements = app(AchievementService::class)
            ->checkAndAwardAnalysis($user, $analysis['comprehension']);

        return response()->json([...$analysis, 'achievements' => $newAchievements]);
    }

    /**
     * Egy szöveg szóelemzése: megértési %, token-státuszok és top ismeretlen szavak.
     *
     * @return array{comprehension: int, totalWords: int, uniqueWords: int, knownCount: int, learningCount: int, tokenStatuses: array<string, string|null>, topUnknown: array<int, array{word: string, frequency: int, rank: int, meaning_hu: string|null}>}
     */
    /**
     * A 9 szóalak-oszlopra futó whereIn-t kötegelve futtatja, hogy nagy szövegnél
     * (teljes könyv / videó) se lépje át a MySQL 65 535 placeholder-limitjét.
     *
     * @param  array<int, string>  $tokens
     * @param  callable(): \Illuminate\Database\Eloquent\Builder<*>  $queryFactory  friss query builder kötegenként
     * @param  array<int, string>  $select
     * @return Collection<int, Model>
     */
    private function matchByForms(array $tokens, callable $queryFactory, array $select): Collection
    {
        $forms = ['word', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative'];

        // 1500 token × 9 oszlop = 13 500 kötés / lekérdezés — bőven a limit alatt.
        $results = collect();
        foreach (array_chunk($tokens, 1500) as $chunk) {
            $results = $results->concat(
                $queryFactory()
                    ->where(function ($q) use ($chunk, $forms) {
                        foreach ($forms as $i => $col) {
                            $i === 0 ? $q->whereIn($col, $chunk) : $q->orWhereIn($col, $chunk);
                        }
                    })
                    ->get($select)
            );
        }

        return $results->unique('id')->values();
    }

    private function buildAnalysis(string $text, User $user): array
    {
        $tokens = $this->tokenize($text);

        if (empty($tokens)) {
            return [
                'comprehension' => 0,
                'totalWords' => 0,
                'uniqueWords' => 0,
                'knownCount' => 0,
                'learningCount' => 0,
                'tokenStatuses' => [],
                'phraseStatuses' => [],
                'topUnknown' => [],
            ];
        }

        $uniqueTokens = array_values(array_unique($tokens));
        $tokenFrequencies = array_count_values($tokens);

        $words = $this->matchByForms(
            $uniqueTokens,
            fn () => Word::query(),
            ['id', 'word', 'rank', 'meaning_hu', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative']
        );

        $userWordStatuses = $user->knownWords()
            ->whereIn('words.id', $words->pluck('id'))
            ->pluck('user_word.status', 'words.id')
            ->all();

        // Include user's custom words in the analysis (check all forms)
        $customWords = $this->matchByForms(
            $uniqueTokens,
            fn () => UserCustomWord::where('user_id', $user->id),
            ['id', 'word', 'status', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative']
        );

        // Build reverse map: lowercase form → Word model
        $formToWord = [];
        foreach ($words as $word) {
            $forms = array_filter([
                mb_strtolower($word->word),
                $word->form_base ? mb_strtolower($word->form_base) : null,
                $word->verb_past ? mb_strtolower($word->verb_past) : null,
                $word->verb_past_participle ? mb_strtolower($word->verb_past_participle) : null,
                $word->verb_present_participle ? mb_strtolower($word->verb_present_participle) : null,
                $word->verb_third_person ? mb_strtolower($word->verb_third_person) : null,
                $word->noun_plural ? mb_strtolower($word->noun_plural) : null,
                $word->adj_comparative ? mb_strtolower($word->adj_comparative) : null,
                $word->adj_superlative ? mb_strtolower($word->adj_superlative) : null,
            ]);

            foreach ($forms as $form) {
                if (! isset($formToWord[$form])) {
                    $formToWord[$form] = $word;
                }
            }
        }

        $tokenStatuses = [];
        $knownTokenCount = 0;
        $learningTokenCount = 0;
        $unknownInListWords = [];

        // Build reverse map: lowercase form → custom word (all forms take priority)
        $formToCustomWord = [];
        foreach ($customWords as $customWord) {
            // Multi-word custom phrases (e.g. "cut through") must not colour single
            // tokens. Their conjugation columns often hold the single-word base form
            // ("cut"), which would otherwise hijack the real word's status. A single
            // token can never represent a phrase, so phrases are skipped here.
            if (str_contains((string) $customWord->word, ' ')) {
                continue;
            }

            foreach (array_filter([
                mb_strtolower($customWord->word),
                $customWord->form_base ? mb_strtolower($customWord->form_base) : null,
                $customWord->verb_past ? mb_strtolower($customWord->verb_past) : null,
                $customWord->verb_past_participle ? mb_strtolower($customWord->verb_past_participle) : null,
                $customWord->verb_present_participle ? mb_strtolower($customWord->verb_present_participle) : null,
                $customWord->verb_third_person ? mb_strtolower($customWord->verb_third_person) : null,
                $customWord->noun_plural ? mb_strtolower($customWord->noun_plural) : null,
                $customWord->adj_comparative ? mb_strtolower($customWord->adj_comparative) : null,
                $customWord->adj_superlative ? mb_strtolower($customWord->adj_superlative) : null,
            ]) as $form) {
                $formToCustomWord[$form] ??= $customWord;
            }
        }

        foreach ($uniqueTokens as $token) {
            $frequency = $tokenFrequencies[$token] ?? 1;

            // Custom words take priority over the main word list
            if (isset($formToCustomWord[$token])) {
                $customWord = $formToCustomWord[$token];
                $tokenStatuses[$token] = $customWord->status;

                if ($customWord->status === 'known') {
                    $knownTokenCount += $frequency;
                } elseif ($customWord->status === 'learning') {
                    $learningTokenCount += $frequency;
                }
            } elseif (isset($formToWord[$token])) {
                $word = $formToWord[$token];
                $status = $userWordStatuses[$word->id] ?? null;

                $tokenStatuses[$token] = $status ?? 'in_list';

                if ($status === 'known') {
                    $knownTokenCount += $frequency;
                } elseif ($status === 'learning') {
                    $learningTokenCount += $frequency;
                } elseif ($status === null) {
                    if (! isset($unknownInListWords[$word->id])) {
                        $unknownInListWords[$word->id] = [
                            'word' => $word->word,
                            'frequency' => 0,
                            'rank' => $word->rank,
                            'meaning_hu' => $word->meaning_hu,
                        ];
                    }
                    $unknownInListWords[$word->id]['frequency'] += $frequency;
                }
            } else {
                $tokenStatuses[$token] = 'not_in_list';
            }
        }

        // Aposztrófos saját szavak (pl. "I'm", "can't", "we'll") párosítása a
        // megjelenítéshez: a tokenizáló az aposztrófos alakokat kibontja/levágja,
        // ezért a szövegben szereplő aposztrófos alakokat külön ráillesztjük a
        // saját szó státuszával — a frontend pontosan ezekre a kulcsokra keres.
        $normalizedText = mb_strtolower(str_replace(["\u{2018}", "\u{2019}", "\u{2032}"], "'", $text));

        if (preg_match_all("/\b[a-z]+(?:'[a-z]+)+\b/", $normalizedText, $apostropheMatches)) {
            $apostropheWords = array_flip($apostropheMatches[0]);

            $customApostrophe = $user->customWords()
                ->where(fn ($q) => $q->where('word', 'like', "%'%")
                    ->orWhere('word', 'like', "%\u{2019}%")
                    ->orWhere('word', 'like', "%\u{2018}%"))
                ->get(['word', 'status']);

            foreach ($customApostrophe as $customWord) {
                $key = mb_strtolower(str_replace(["\u{2018}", "\u{2019}", "\u{2032}"], "'", $customWord->word));

                if (isset($apostropheWords[$key])) {
                    $tokenStatuses[$key] = $customWord->status;
                }
            }
        }

        // Többszavas saját kifejezések (pl. "cut through", "take place") a
        // kifejezés-szintű kiemeléshez. Egyszavas token-illesztéssel ezek nem
        // ábrázolhatók, ezért normalizált kifejezés → státusz térképet adunk, és a
        // frontend mohó n-gram illesztéssel emeli ki őket a megjelenített szövegben.
        $phraseStatuses = [];
        $tokenSet = array_flip($uniqueTokens);

        $phraseCustomWords = UserCustomWord::where('user_id', $user->id)
            ->where('word', 'like', '% %')
            ->whereNotNull('status')
            ->where('status', '!=', '')
            ->get(['status', 'word', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person']);

        foreach ($phraseCustomWords as $phrase) {
            foreach (array_filter([
                $phrase->word,
                $phrase->verb_past,
                $phrase->verb_past_participle,
                $phrase->verb_present_participle,
                $phrase->verb_third_person,
            ]) as $form) {
                $normalized = mb_strtolower(trim((string) preg_replace('/\s+/', ' ',
                    str_replace(["\u{2018}", "\u{2019}", "\u{2032}"], "'", $form))));

                // Csak a többszavas alakok, és csak ha minden szavuk szerepel a szövegben.
                if (! str_contains($normalized, ' ')) {
                    continue;
                }

                $everyWordPresent = ! array_filter(explode(' ', $normalized), fn ($w) => ! isset($tokenSet[$w]));

                if ($everyWordPresent) {
                    $phraseStatuses[$normalized] ??= $phrase->status;
                }
            }
        }

        uasort(
            $unknownInListWords,
            fn ($a, $b) => $b['frequency'] !== $a['frequency']
                ? $b['frequency'] - $a['frequency']
                : $a['rank'] - $b['rank']
        );

        $totalTokenCount = count($tokens);
        $comprehension = $totalTokenCount > 0 ? (int) round(($knownTokenCount / $totalTokenCount) * 100) : 0;

        return [
            'comprehension' => $comprehension,
            'totalWords' => $totalTokenCount,
            'uniqueWords' => count($uniqueTokens),
            'knownCount' => $knownTokenCount,
            'learningCount' => $learningTokenCount,
            'tokenStatuses' => $tokenStatuses,
            'phraseStatuses' => $phraseStatuses,
            'topUnknown' => array_values(array_slice($unknownInListWords, 0, 20, true)),
        ];
    }

    private function fetchWebpageText(string $url): string
    {
        $response = $this->safeFetch($url);

        if (! $response->ok()) {
            throw new \RuntimeException('A weboldal nem érhető el (HTTP '.$response->status().').');
        }

        $html = $response->body();

        // Try to isolate the main article body first
        $html = $this->extractMainContent($html) ?? $html;

        // Strip elements that are never article content
        $html = preg_replace('/<(script|style|nav|header|footer|aside|noscript|button|form|input|select|textarea|dialog|menu|figure|figcaption)[^>]*>.*?<\/\1>/si', '', $html) ?? $html;

        // Strip remaining tags, decode entities
        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;

        // Remove short lines – these are almost always navigation labels, button text, etc.
        $lines = explode("\n", $text);
        $lines = array_filter($lines, fn ($line) => mb_strlen(trim($line)) > 35);
        $text = implode("\n", $lines);

        $text = preg_replace('/(\s*\n\s*){3,}/', "\n\n", $text) ?? $text;

        return trim($text);
    }

    private function extractMainContent(string $html): ?string
    {
        // Prefer <article>, then <main> — these reliably contain the editorial body
        foreach (['article', 'main'] as $tag) {
            if (preg_match('/<'.$tag.'\b[^>]*>(.*?)<\/'.$tag.'>/si', $html, $m)) {
                return $m[1];
            }
        }

        return null;
    }

    private const BOOK_STORAGE_LIMIT = 30 * 1024 * 1024;

    /** Max uncompressed bytes of a single EPUB zip entry (zip-bomb guard). */
    private const MAX_EPUB_ENTRY_BYTES = 5 * 1024 * 1024;

    /** Max total uncompressed bytes read from an EPUB before stopping (zip-bomb guard). */
    private const MAX_EPUB_TOTAL_BYTES = 40 * 1024 * 1024;

    private function bookLimitFor(User $user): int
    {
        return match (true) {
            $user->subscribed('premium') || $user->ai_access => 5,
            $user->subscribed('default') => 3,
            default => 1,
        };
    }

    public function listBooks(Request $request): JsonResponse
    {
        $user = $request->user();

        $books = UserBook::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'file_type', 'total_pages'])
            ->map(fn ($b) => [
                'id' => $b->id,
                'title' => $b->title,
                'file_type' => $b->file_type,
                'total_pages' => $b->total_pages,
            ]);

        return response()->json([
            'books' => $books,
            'bookLimit' => $this->bookLimitFor($user),
            'usedStorage' => UserBook::where('user_id', $user->id)->sum('text_size'),
            'storageLimit' => self::BOOK_STORAGE_LIMIT,
        ]);
    }

    /**
     * Csak valódi szóalak kerülhet az AI promptokba (prompt injection ellen):
     * betűk, aposztróf, kötőjel, szóköz, max 100 karakter.
     */
    private function sanitizeWordForPrompt(string $word): ?string
    {
        return preg_match("/^[\pL][\pL'\\- ]{0,99}$/u", $word) === 1 ? $word : null;
    }

    /**
     * A `geminiWordLookup` válasz-sémája (Gemini structured output). A modell
     * pontosan ezeket a mezőket adja vissza, ebben a sorrendben; a nem releváns
     * mezők üres stringek. A `part_of_speech` zárt listára kényszerített.
     *
     * @return array<string, mixed>
     */
    private function lookupSchema(): array
    {
        $string = ['type' => 'STRING'];

        return [
            'type' => 'OBJECT',
            'properties' => [
                'is_real_word' => ['type' => 'BOOLEAN'],
                'meaning_hu' => $string,
                'extra_meanings' => $string,
                'synonyms' => $string,
                'part_of_speech' => ['type' => 'STRING', 'enum' => ['verb', 'noun', 'adj', 'adv', 'prep', 'conj', 'det', 'pron', 'num', 'interj']],
                'example_en' => $string,
                'example_hu' => $string,
                'verb_past' => $string,
                'verb_past_participle' => $string,
                'verb_present_participle' => $string,
                'verb_third_person' => $string,
                'is_irregular' => ['type' => 'BOOLEAN'],
                'noun_plural' => $string,
                'adj_comparative' => $string,
                'adj_superlative' => $string,
                'context_explanation' => $string,
            ],
            'required' => ['is_real_word', 'meaning_hu', 'part_of_speech', 'example_en', 'example_hu'],
            'propertyOrdering' => ['is_real_word', 'meaning_hu', 'extra_meanings', 'synonyms', 'part_of_speech', 'example_en', 'example_hu', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'is_irregular', 'noun_plural', 'adj_comparative', 'adj_superlative', 'context_explanation'],
        ];
    }

    /**
     * A `geminiFlashcard` válasz-sémája. A nem létező szóalakok / hiányzó példák
     * `null` értékek (nullable mezők); a kötelező mezők mindig kitöltöttek.
     *
     * @return array<string, mixed>
     */
    private function flashcardSchema(): array
    {
        $stringArray = ['type' => 'ARRAY', 'items' => ['type' => 'STRING']];
        $nullableString = ['type' => 'STRING', 'nullable' => true];

        return [
            'type' => 'OBJECT',
            'properties' => [
                'is_real_word' => ['type' => 'BOOLEAN'],
                'cloze_sentences' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'sentence' => ['type' => 'STRING'],
                            'hints' => $stringArray,
                        ],
                        'required' => ['sentence', 'hints'],
                        'propertyOrdering' => ['sentence', 'hints'],
                    ],
                ],
                'answer_options' => $stringArray,
                'negative_meaning_hu' => $stringArray,
                'collocations' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'pattern' => ['type' => 'STRING'],
                            'meaning_hu' => ['type' => 'STRING'],
                            'example' => $nullableString,
                        ],
                        'required' => ['pattern', 'meaning_hu'],
                        'propertyOrdering' => ['pattern', 'meaning_hu', 'example'],
                    ],
                ],
                'word_forms' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'base' => ['type' => 'STRING'],
                        'adjective' => $nullableString,
                        'adverb' => $nullableString,
                        'noun' => $nullableString,
                        'verb' => $nullableString,
                    ],
                    'required' => ['base'],
                    'propertyOrdering' => ['base', 'adjective', 'adverb', 'noun', 'verb'],
                ],
                'common_pairs' => $stringArray,
                'synonyms' => $stringArray,
                'antonyms' => $stringArray,
            ],
            'required' => ['is_real_word', 'cloze_sentences', 'answer_options', 'word_forms'],
            'propertyOrdering' => ['is_real_word', 'cloze_sentences', 'answer_options', 'negative_meaning_hu', 'collocations', 'word_forms', 'common_pairs', 'synonyms', 'antonyms'],
        ];
    }

    /**
     * A `wordInsight` válasz-sémája: valós használati területek + regiszter + tipp.
     *
     * @return array<string, mixed>
     */
    private function insightSchema(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'areas' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'name_hu' => ['type' => 'STRING'],
                            'description_hu' => ['type' => 'STRING'],
                            'example_en' => ['type' => 'STRING'],
                            'example_hu' => ['type' => 'STRING'],
                        ],
                        'required' => ['name_hu', 'description_hu', 'example_en', 'example_hu'],
                        'propertyOrdering' => ['name_hu', 'description_hu', 'example_en', 'example_hu'],
                    ],
                ],
                'register_hu' => ['type' => 'STRING'],
                'tip_hu' => ['type' => 'STRING'],
            ],
            'required' => ['areas', 'register_hu', 'tip_hu'],
            'propertyOrdering' => ['areas', 'register_hu', 'tip_hu'],
        ];
    }

    /**
     * A `sentenceCheck` válasz-sémája: egy tanulói mondat szó- és nyelvtani
     * értékelése. A séma garantálja a JSON-alakot, így a csonka/markdownos
     * válaszból eredő 502-k megszűnnek.
     *
     * @return array<string, mixed>
     */
    private function sentenceCheckSchema(): array
    {
        $nullableString = ['type' => 'STRING', 'nullable' => true];

        return [
            'type' => 'OBJECT',
            'properties' => [
                'usage_ok' => ['type' => 'BOOLEAN'],
                'grammar_ok' => ['type' => 'BOOLEAN'],
                'feedback_hu' => ['type' => 'STRING'],
                'grammar_note_hu' => $nullableString,
                'corrected_sentence' => $nullableString,
                'example_sentence' => ['type' => 'STRING'],
            ],
            'required' => ['usage_ok', 'grammar_ok', 'feedback_hu', 'example_sentence'],
            'propertyOrdering' => ['usage_ok', 'grammar_ok', 'feedback_hu', 'grammar_note_hu', 'corrected_sentence', 'example_sentence'],
        ];
    }

    /**
     * A `practiceCheck` válasz-sémája: több célszó használatának értékelése egy
     * tanulói szövegben. A `grammar_issues` string-tömbként kényszerített, így a
     * modell nem adhat vissza objektumokat — megszűnik a kézi normalizálás igénye.
     *
     * @return array<string, mixed>
     */
    private function practiceCheckSchema(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'words' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'word' => ['type' => 'STRING'],
                            'used' => ['type' => 'BOOLEAN'],
                            'correct' => ['type' => 'BOOLEAN'],
                            'feedback_hu' => ['type' => 'STRING'],
                        ],
                        'required' => ['word', 'used', 'correct', 'feedback_hu'],
                        'propertyOrdering' => ['word', 'used', 'correct', 'feedback_hu'],
                    ],
                ],
                'grammar_issues' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
                'overall_hu' => ['type' => 'STRING'],
                'corrected_text' => ['type' => 'STRING', 'nullable' => true],
            ],
            'required' => ['words', 'grammar_issues', 'overall_hu'],
            'propertyOrdering' => ['words', 'grammar_issues', 'overall_hu', 'corrected_text'],
        ];
    }

    public function geminiFlashcard(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403);

        if ($limited = $this->aiLimitGuard($request)) {
            return $limited;
        }

        $word = $this->sanitizeWordForPrompt($request->string('word')->trim()->value());

        if ($word === null) {
            return response()->json(['error' => 'Érvénytelen szó.'], 422);
        }

        $apiKey = config('services.gemini.api_key');
        $prompt = <<<PROMPT
You are an English vocabulary flashcard generator for Hungarian learners. Generate rich flashcard content for the English word "{$word}".

Rules:
- is_real_word: true only if "{$word}" is a genuine, standard English word or fixed expression. Set false for gibberish, random letters, a clear misspelling, or a word from another language. Judge the word itself — rare, technical or proper-noun English words are still real (true). If false, you may leave the other fields empty.
- cloze_sentences: 4 sentences covering diverse registers (everyday, formal, academic/professional, written/literary), each showing the word in a clearly different context. Replace the word itself with _______ in each sentence.
- hints: each hint must reflect the meaning of the word specifically in THAT sentence's context, not just a generic synonym. For example, "bear" in "bear the cost" → hints: ["visel", "fizet"], not generic ["medve", "elvisel"].
- answer_options: exactly 3 core Hungarian translations, no more. Identify the word's PRIMARY grammatical role in everyday English (verb/noun/adj/etc.). List the 2-3 most frequent translations for THAT primary role first. If and only if the word has a single very well-known meaning in a DIFFERENT part of speech, add just ONE entry for it at the end. Hard rules: (a) maximum ONE entry per secondary part of speech — if "bátorság" is secondary, do NOT also add "kitartás"; (b) no near-duplicates — "tép" covers "kitép/letép/tépi le", pick only the bare, most natural form; (c) first item = most natural default translation. Example — "pluck" is primarily a VERB, so correct output is ["tép", "leszakít", "bátorság"], NOT ["bátorság", "kitartás", "penget"].
- negative_meaning_hu: 3 Hungarian antonym translations that are true semantic opposites in meaning, not just grammatical negations.
- collocations: 4-5 common phrases/patterns using the word, ordered by frequency of use in English (most common first). Use _______ in place of the word in the pattern; set example to null when there is no natural example. Only include collocations that genuinely exist and are widely used.
- common_pairs / synonyms: 3-4 entries each. antonyms: 3 entries.
- word_forms: base is the word itself; for adjective/adverb/noun/verb only include forms that actually exist as real, established English words (set null for non-existent or rarely used forms — do not invent forms).
PROMPT;

        // Csak valódi szóra adott választ cache-elünk: egy nem létező szóra
        // (gibberish, elgépelés) hallucinált flashcard nem mérgezheti meg a
        // mindenki által használt cache-t.
        $onlyRealWords = fn (array $data): bool => ($data['is_real_word'] ?? true) === true;

        [$primary, $fallback] = $this->modelsFor('flashcard');

        $result = $this->aiCache->remember(
            'flashcard',
            $word,
            self::AI_CACHE_VERSION['flashcard'],
            $primary,
            fn () => $this->callGemini($apiKey, $prompt, 1000, $primary, $fallback, temperature: 0.2, responseSchema: $this->flashcardSchema(), user: $request->user()),
            $onlyRealWords,
        );

        if (! $result['ok']) {
            return response()->json(['error' => $result['error']], 502);
        }

        $data = $result['data'];

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
        }

        // Nem valódi szó: nem generálunk kamu flashcardot, egyértelműen jelezzük.
        if (($data['is_real_word'] ?? true) === false) {
            return response()->json([
                'is_real_word' => false,
                'message' => 'Ez nem tűnik valódi angol szónak. Ellenőrizd a helyesírást.',
            ]);
        }

        $front = $this->buildFlashcardFront($data);
        $back = $this->buildFlashcardBack($data);

        return response()->json(['front' => $front, 'back' => $back]);
    }

    private function buildFlashcardFront(array $d): string
    {
        $html = '';

        foreach ($d['cloze_sentences'] ?? [] as $item) {
            $hints = implode(' / ', $item['hints'] ?? []);
            $html .= '<p>'.htmlspecialchars($item['sentence'] ?? '').' <em>('.htmlspecialchars($hints).')</em></p>';
        }

        if (! empty($d['answer_options'])) {
            $options = implode(' / ', array_map('htmlspecialchars', $d['answer_options']));
            $html .= '<p><span style="color: #22c55e">'.$options.'</span></p>';
        }

        if (! empty($d['negative_meaning_hu'])) {
            $neg = implode(' / ', array_map('htmlspecialchars', $d['negative_meaning_hu']));
            $html .= '<p><span style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 4px">Negative meaning (HU): '.$neg.'</span></p>';
        }

        if (! empty($d['collocations'])) {
            $html .= '<p>🔑 Tanulási megjegyzés</p>';
            foreach ($d['collocations'] as $col) {
                $pattern = htmlspecialchars($col['pattern'] ?? '');
                $meaning = htmlspecialchars($col['meaning_hu'] ?? '');
                $example = ! empty($col['example']) ? ' (pl. '.htmlspecialchars($col['example']).')' : '';
                $html .= '<p>👉 '.$pattern.' = '.$meaning.$example.'</p>';
            }
        }

        return $html;
    }

    private function buildFlashcardBack(array $d): string
    {
        $html = '';

        $forms = $d['word_forms'] ?? [];

        if (! empty($forms['base'])) {
            $html .= '<p><strong>'.htmlspecialchars($forms['base']).'</strong></p>';
        }
        foreach (['adjective' => 'adjective', 'adverb' => 'adverb', 'noun' => 'noun', 'verb' => 'verb'] as $key => $label) {
            if (! empty($forms[$key])) {
                $html .= '<p>'.$label.': <strong>'.htmlspecialchars($forms[$key]).'</strong></p>';
            }
        }

        if (! empty($d['common_pairs'])) {
            $pairs = implode(' / ', array_map('htmlspecialchars', $d['common_pairs']));
            $html .= '<p><span style="color: #3b82f6">common pair: '.$pairs.'</span></p>';
        }

        if (! empty($d['synonyms'])) {
            $syn = implode(' / ', array_map('htmlspecialchars', $d['synonyms']));
            $html .= '<p>similar: '.$syn.'</p>';
        }

        if (! empty($d['antonyms'])) {
            $ant = implode(' / ', array_map('htmlspecialchars', $d['antonyms']));
            $html .= '<p><span style="color: #ef4444">negative: '.$ant.'</span></p>';
        }

        return $html;
    }

    public function practiceCheck(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403);

        if ($limited = $this->aiLimitGuard($request)) {
            return $limited;
        }

        $validated = $request->validate([
            'words' => ['required', 'array', 'min:1', 'max:10'],
            'words.*.word' => ['required', 'string', 'max:100', "regex:/^[\pL][\pL'\\- ]*$/u"],
            'words.*.meaning_hu' => ['nullable', 'string', 'max:200'],
            'text' => ['required', 'string', 'min:5', 'max:3000'],
        ]);

        $text = trim($validated['text']);

        $wordList = collect($validated['words'])->map(function ($w) {
            // Idézőjelek és sortörések nélkül kerül a promptba (prompt injection ellen)
            $cleanMeaning = str_replace(["\n", "\r", '"'], [' ', ' ', "'"], $w['meaning_hu'] ?? '');
            $meaning = $cleanMeaning !== '' ? " (jelentése: \"{$cleanMeaning}\")" : '';

            return "- {$w['word']}{$meaning}";
        })->implode("\n");

        $prompt = <<<PROMPT
You are an English writing coach for Hungarian learners.

The learner is practicing these target words:
{$wordList}

The learner wrote this text:
"{$text}"

Carefully analyze the text and fill the response fields.
For EACH target word, add an entry to "words" with:
- word: the exact word from the list above
- used: did the learner use it (or a grammatical form of it)?
- correct: if used, was it correct? (right meaning, natural collocation, correct grammar for that word)
- feedback_hu: brief, specific, encouraging feedback in Hungarian.

Also fill:
- grammar_issues: each element is one grammar issue explained in Hungarian as a plain sentence (empty array if none).
- overall_hu: 1-2 sentences of overall encouraging feedback in Hungarian.
- corrected_text: a corrected version of the full text if there are errors, or null if the text is perfect.
PROMPT;

        $apiKey = config('services.gemini.api_key');
        [$primary, $fallback] = $this->modelsFor('practice');

        $response = $this->callGemini($apiKey, $prompt, 800, $primary, $fallback, temperature: 0.2, responseSchema: $this->practiceCheckSchema(), user: $request->user());

        if (! $response['ok']) {
            return response()->json(['error' => $response['error']], 502);
        }

        $data = $response['data'];

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
        }

        // A séma string-tömbként kényszeríti a grammar_issues-t; itt már csak az
        // üres elemeket szűrjük ki, hogy a frontend ne kapjon üres buborékot.
        $data['grammar_issues'] = array_values(array_filter(
            $data['grammar_issues'] ?? [],
            fn ($issue) => is_string($issue) && trim($issue) !== '',
        ));

        return response()->json($data);
    }

    public function sentenceCheck(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403);

        if ($limited = $this->aiLimitGuard($request)) {
            return $limited;
        }

        $validated = $request->validate([
            'word' => ['required', 'string', 'max:100', "regex:/^[\pL][\pL'\\- ]*$/u"],
            'meaning_hu' => ['nullable', 'string', 'max:200'],
            'sentence' => ['required', 'string', 'min:3', 'max:500'],
        ]);

        $word = trim($validated['word']);
        $meaning = trim($validated['meaning_hu'] ?? '');
        $sentence = trim($validated['sentence']);

        $meaningBlock = $meaning ? "\nThe word's primary Hungarian meaning is: \"{$meaning}\"." : '';

        $prompt = <<<PROMPT
You are an English language tutor for Hungarian learners. Evaluate whether the English word "{$word}" is used correctly in this sentence written by a learner:{$meaningBlock}

Learner's sentence: "{$sentence}"

Evaluate and fill the response fields:
- usage_ok: is "{$word}" used with the correct meaning and in a grammatically/collocationally appropriate way?
- grammar_ok: is the overall sentence grammatically correct (ignoring the word itself)?
- feedback_hu: 1-3 sentences in Hungarian explaining what is good or wrong about how the word is used. Be specific and encouraging.
- grammar_note_hu: 1-2 sentences in Hungarian about any grammar issues, or null if grammar is correct.
- corrected_sentence: a corrected version of the sentence if there are any errors, or null if the sentence is fully correct.
- example_sentence: one natural, simple example sentence using "{$word}" correctly (different from the learner's sentence).

Be encouraging and educational. If the sentence is correct, celebrate it.
PROMPT;

        $apiKey = config('services.gemini.api_key');
        [$primary, $fallback] = $this->modelsFor('sentence');

        $response = $this->callGemini($apiKey, $prompt, 400, $primary, $fallback, temperature: 0.2, responseSchema: $this->sentenceCheckSchema(), user: $request->user());

        if (! $response['ok']) {
            return response()->json(['error' => $response['error']], 502);
        }

        $data = $response['data'];

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
        }

        return response()->json([
            'usage_ok' => (bool) ($data['usage_ok'] ?? false),
            'grammar_ok' => (bool) ($data['grammar_ok'] ?? true),
            'feedback_hu' => $data['feedback_hu'] ?? '',
            'grammar_note_hu' => $data['grammar_note_hu'] ?? null,
            'corrected_sentence' => $data['corrected_sentence'] ?? null,
            'example_sentence' => $data['example_sentence'] ?? null,
        ]);
    }

    public function wordInsight(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403);

        if ($limited = $this->aiLimitGuard($request)) {
            return $limited;
        }

        $word = $this->sanitizeWordForPrompt($request->string('word')->trim()->value());

        if ($word === null) {
            return response()->json(['error' => 'Érvénytelen szó.'], 422);
        }

        $apiKey = config('services.gemini.api_key');

        $prompt = <<<PROMPT
You are an English vocabulary educator for Hungarian learners. For the English word "{$word}", explain where and how it is used in real life.

Rules:
- areas: 3 distinct real-life areas where this word is genuinely and commonly used. For each area set: name_hu = the area's name in Hungarian (e.g. Üzleti élet, Orvostudomány, Hétköznapi élet); description_hu = 1-2 concise sentences in Hungarian on why/how the word is used there; example_en = a natural example sentence in that context; example_hu = its Hungarian translation.
- register_hu: 1 sentence in Hungarian — is the word formal, informal, neutral, or context-dependent?
- tip_hu: 1 short learning tip in Hungarian (e.g. a common mistake, a memorable phrase, or a useful pattern).
- Example sentences must be natural and varied across registers/contexts.
PROMPT;

        [$primary, $fallback] = $this->modelsFor('insight');

        $result = $this->aiCache->remember(
            'insight',
            $word,
            self::AI_CACHE_VERSION['insight'],
            $primary,
            fn () => $this->callGemini($apiKey, $prompt, 600, $primary, $fallback, temperature: 0.2, responseSchema: $this->insightSchema(), user: $request->user()),
        );

        if (! $result['ok']) {
            return response()->json(['error' => $result['error']], 502);
        }

        $data = $result['data'];

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
        }

        return response()->json([
            'areas' => $data['areas'] ?? [],
            'register_hu' => $data['register_hu'] ?? '',
            'tip_hu' => $data['tip_hu'] ?? '',
        ]);
    }

    public function geminiListModels(): JsonResponse
    {
        // Dev tooling that proxies the raw upstream model list — admin-only.
        abort_unless(Gate::check('admin'), 403);
        $apiKey = config('services.gemini.api_key');
        $response = Http::withHeaders(['x-goog-api-key' => $apiKey])
            ->get('https://generativelanguage.googleapis.com/v1beta/models');

        return response()->json($response->json());
    }

    public function geminiWordLookup(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || request()->user()?->hasAiAccess(), 403);

        if ($limited = $this->aiLimitGuard($request)) {
            return $limited;
        }

        $word = $this->sanitizeWordForPrompt($request->string('word')->trim()->lower()->value());

        // A context szabad szöveg, ezért nem szűrhető betűkre, de a promptba kerül:
        // idézőjeleket aposztrófra cserélünk és kötegelt szóközzé normalizáljuk
        // (kitörés/utasítás-injektálás ellen), és 300 karakterre vágjuk (költség-korlát).
        $context = mb_substr(
            trim((string) preg_replace('/\s+/', ' ', str_replace('"', "'", $request->string('context')->value()))),
            0,
            300
        );

        if ($word === null) {
            return response()->json(['error' => 'Érvénytelen szó.'], 422);
        }

        $apiKey = config('services.gemini.api_key');

        $contextBlock = $context
            ? "\nThe word appears in this sentence: \"{$context}\"\nAlso add a field:\n- context_explanation: 1-2 sentences in Hungarian explaining what \"{$word}\" specifically means in that sentence and how it is used in that context."
            : "\n- context_explanation: empty string";

        $prompt = <<<PROMPT
You are a Hungarian-English dictionary assistant for the English word "{$word}". Fill the response fields, following these rules:
- is_real_word: true if "{$word}" is genuine English a learner might want to save — a standard word, a fixed expression, OR any natural, meaningful multi-word English phrase (even if it is not a dictionary idiom and even if a slightly different word order would be more common). Set false only for gibberish, random letters, a clear misspelling, or text that is not English. Judge the input itself — rare, technical or proper-noun English words are still real (true). If false, leave the other fields as empty strings.
- meaning_hu: concise primary Hungarian translation (for a phrase, a short natural Hungarian equivalent).
- extra_meanings: other Hungarian meanings, comma-separated, or empty string.
- synonyms: 2-4 English synonyms, comma-separated, or empty string.
- example_en / example_hu: one natural English example sentence and its Hungarian translation.
- part_of_speech: the word's primary, most common grammatical role.
- noun_plural: standard plural if the word is a noun that has one (e.g. "book" → "books", "peppermint" → "peppermints"); empty string only if the noun is truly uncountable.
{$contextBlock}

Constraints:
- Translate the Hungarian fields accurately and concisely.
- Form fields (verb_past, verb_past_participle, verb_present_participle, verb_third_person, noun_plural, adj_comparative, adj_superlative): fill EVERY field that is a genuine inflected form of "{$word}", even across different word classes. The part_of_speech stays the single primary role, but the form fields are NOT limited to that role. Example: the noun "interest" is also a verb, so fill noun_plural="interests" AND verb_past="interested", verb_past_participle="interested", verb_present_participle="interesting", verb_third_person="interests".
- Critical homograph rule: only include forms that are real inflections OF THIS SAME WORD and meaning. Never add a form that merely happens to be spelled like an inflection of a DIFFERENT, unrelated word. Example: for the flower "rose" leave verb_past empty, because "rose" as a past tense belongs to the unrelated verb "rise".
- Use an empty string for any field that does not apply, and never invent a word form that does not exist in standard English.
PROMPT;

        // 700 token-keret: a strukturált séma ~16 hosszú mezőneve maga is output-token,
        // a 400-as keret ezekkel együtt igeszavaknál (összes alak + két példamondat)
        // csonkolódhat → érvénytelen JSON → 502. A keret felső korlát, csak a ténylegesen
        // generált tokenért fizetünk, így a tágítás a normál válaszok költségét nem növeli.
        [$primary, $fallback] = $this->modelsFor('lookup');
        $generator = fn () => $this->callGemini($apiKey, $prompt, 700, $primary, $fallback, temperature: 0.2, responseSchema: $this->lookupSchema(), user: $request->user());

        // Csak valódi szót cache-elünk: egy nem létező szóra (gibberish, elgépelés)
        // adott hallucinált válasz nem mérgezheti meg a mindenki által használt cache-t.
        $onlyRealWords = fn (array $data): bool => ($data['is_real_word'] ?? true) === true;

        // A context-tal érkező kérés mondat-egyedi (context_explanation mező),
        // ezért nem cache-elhető; csak a context nélküli szótári lekérdezést tároljuk.
        $result = $context === ''
            ? $this->aiCache->remember('lookup', $word, self::AI_CACHE_VERSION['lookup'], $primary, $generator, $onlyRealWords)
            : $generator();

        if (! $result['ok']) {
            return response()->json(['error' => $result['error']], 502);
        }

        $data = $result['data'];

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
        }

        // Nem valódi szó: nem töltünk ki kamu szótári adatot, egyértelműen jelezzük.
        if (($data['is_real_word'] ?? true) === false) {
            return response()->json([
                'is_real_word' => false,
                'message' => 'Ez nem tűnik valódi angol szónak. Ellenőrizd a helyesírást.',
            ]);
        }

        return response()->json([
            'is_real_word' => true,
            'meaning_hu' => $data['meaning_hu'] ?? null,
            'extra_meanings' => $data['extra_meanings'] ?? null,
            'synonyms' => $data['synonyms'] ?? null,
            'part_of_speech' => $data['part_of_speech'] ?? null,
            'example_en' => $data['example_en'] ?? null,
            'example_hu' => $data['example_hu'] ?? null,
            'verb_past' => $data['verb_past'] ?? null,
            'verb_past_participle' => $data['verb_past_participle'] ?? null,
            'verb_present_participle' => $data['verb_present_participle'] ?? null,
            'verb_third_person' => $data['verb_third_person'] ?? null,
            'is_irregular' => $data['is_irregular'] ?? false,
            'noun_plural' => $data['noun_plural'] ?? null,
            'adj_comparative' => $data['adj_comparative'] ?? null,
            'adj_superlative' => $data['adj_superlative'] ?? null,
            'context_explanation' => $data['context_explanation'] ?? null,
        ]);
    }

    /** Hány elmentett YouTube-felirata lehet a felhasználónak (csomagtól függően). */
    private function youtubeLimitFor(User $user): int
    {
        return match (true) {
            $user->subscribed('premium') || $user->ai_access => 10,
            $user->subscribed('default') => 3,
            default => 1,
        };
    }

    /**
     * @return array{id: int, title: string, video_id: string, total_pages: int}
     */
    private function transcriptPayload(YoutubeTranscript $t): array
    {
        return [
            'id' => $t->id,
            'title' => $t->title,
            'video_id' => $t->video_id,
            'total_pages' => $t->total_pages,
        ];
    }

    public function listYoutube(Request $request): JsonResponse
    {
        $user = $request->user();

        $transcripts = YoutubeTranscript::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'video_id', 'total_pages'])
            ->map(fn (YoutubeTranscript $t) => $this->transcriptPayload($t));

        return response()->json([
            'transcripts' => $transcripts,
            'youtubeLimit' => $this->youtubeLimitFor($user),
        ]);
    }

    public function storeYoutube(Request $request): JsonResponse
    {
        $url = $request->validate(['url' => 'required|url:http,https|max:2000'])['url'];

        $videoId = $this->captions->extractVideoId($url);

        if ($videoId === null) {
            return response()->json(['error' => 'Érvénytelen YouTube link.'], 422);
        }

        $user = $request->user();
        $limit = $this->youtubeLimitFor($user);

        if (YoutubeTranscript::where('user_id', $user->id)->count() >= $limit) {
            return response()->json([
                'error' => "Elérted az elmentett YouTube-feliratok maximális számát ({$limit}). Törölj egyet, vagy válts magasabb csomagra.",
            ], 403);
        }

        try {
            $segments = $this->captions->fetchCaptions($videoId);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable) {
            return response()->json(['error' => 'A felirat nem érhető el. Próbáld újra később.'], 422);
        }

        if (empty($segments)) {
            return response()->json(['error' => 'Ehhez a videóhoz nem érhetők el angol feliratok.'], 422);
        }

        $title = $this->captions->fetchTitle($videoId) ?? 'YouTube videó';
        $json = json_encode(array_values($segments), JSON_UNESCAPED_UNICODE) ?: '[]';
        $totalPages = max(1, (int) ceil(count($segments) / YoutubeTranscript::SEGMENTS_PER_PAGE));

        $transcript = YoutubeTranscript::create([
            'user_id' => $user->id,
            'video_id' => $videoId,
            'title' => mb_substr($title, 0, 255),
            'compressed_segments' => gzencode($json, 6),
            'total_pages' => $totalPages,
            'text_size' => mb_strlen($json, '8bit'),
        ]);

        $pageData = $transcript->getPage(1);

        return response()->json([
            'transcript' => $this->transcriptPayload($transcript),
            'page' => 1,
            'text' => $pageData['text'],
            'segments' => $pageData['segments'],
        ]);
    }

    public function getYoutubePage(Request $request, YoutubeTranscript $transcript): JsonResponse
    {
        abort_unless($transcript->user_id === $request->user()->id, 403);

        $page = max(1, min((int) $request->query('page', 1), $transcript->total_pages));
        $data = $transcript->getPage($page);

        return response()->json([
            'page' => $page,
            'text' => $data['text'],
            'segments' => $data['segments'],
        ]);
    }

    /** A TELJES videó megértési statisztikája (az összes szegmens szövegén). */
    public function youtubeOverview(Request $request, YoutubeTranscript $transcript): JsonResponse
    {
        abort_unless($transcript->user_id === $request->user()->id, 403);

        $fullText = implode(' ', array_map(fn ($s) => $s['x'] ?? '', $transcript->segments()));
        $analysis = $this->buildAnalysis($fullText, $request->user());

        // A teljes felirat token-státusz térképe nem kell ide, csak az összesített számok.
        unset($analysis['tokenStatuses']);

        return response()->json($analysis);
    }

    public function deleteYoutube(Request $request, YoutubeTranscript $transcript): JsonResponse
    {
        abort_unless($transcript->user_id === $request->user()->id, 403);
        $transcript->delete();

        return response()->json(['ok' => true]);
    }

    public function uploadBook(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimetypes:application/pdf,application/epub+zip,application/zip|extensions:pdf,epub|max:30720',
        ]);

        $user = $request->user();
        $bookLimit = $this->bookLimitFor($user);
        $bookCount = UserBook::where('user_id', $user->id)->count();

        if ($bookCount >= $bookLimit) {
            return response()->json([
                'error' => "Elérted a könyvek maximális számát ({$bookLimit}). Töröld valamelyiket, vagy válts magasabb csomagra.",
            ], 403);
        }

        $usedStorage = UserBook::where('user_id', $user->id)->sum('text_size');
        if ($usedStorage >= self::BOOK_STORAGE_LIMIT) {
            return response()->json([
                'error' => 'Elérted a 30 MB-os tárhely limitet. Töröld valamelyik könyvet a feltöltéshez.',
            ], 403);
        }

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        $title = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        try {
            $text = match ($extension) {
                'pdf' => $this->extractPdfText($file->getRealPath()),
                'epub' => $this->extractEpubText($file->getRealPath()),
                default => throw new \RuntimeException('Nem támogatott formátum.'),
            };
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable) {
            return response()->json(['error' => 'A fájl nem dolgozható fel. Lehet, hogy sérült vagy titkosított.'], 422);
        }

        $text = preg_replace('/\s+/', ' ', trim($text)) ?? '';

        if (mb_strlen($text) < 100) {
            return response()->json(['error' => 'A fájlból nem sikerült szöveget kinyerni. Szkennelt PDF-eket nem tudunk feldolgozni.'], 422);
        }

        $totalPages = (int) ceil(mb_strlen($text) / UserBook::PAGE_SIZE);
        $compressed = gzencode($text, 6);

        $book = UserBook::create([
            'user_id' => $user->id,
            'title' => mb_substr($title, 0, 255),
            'file_type' => $extension,
            'compressed_text' => $compressed,
            'total_pages' => $totalPages,
            'text_size' => mb_strlen($text, '8bit'),
        ]);

        return response()->json([
            'book' => [
                'id' => $book->id,
                'title' => $book->title,
                'file_type' => $book->file_type,
                'total_pages' => $book->total_pages,
            ],
            'page' => 1,
            'text' => mb_substr($text, 0, UserBook::PAGE_SIZE),
        ]);
    }

    public function getBookPage(Request $request, UserBook $book): JsonResponse
    {
        abort_unless($book->user_id === $request->user()->id, 403);

        $page = max(1, min((int) $request->query('page', 1), $book->total_pages));

        return response()->json([
            'page' => $page,
            'text' => $book->getPage($page),
        ]);
    }

    /** A TELJES könyv megértési statisztikája (az összes oldal szövegén). */
    public function bookOverview(Request $request, UserBook $book): JsonResponse
    {
        abort_unless($book->user_id === $request->user()->id, 403);

        $fullText = gzdecode($book->compressed_text) ?: '';
        $analysis = $this->buildAnalysis($fullText, $request->user());

        unset($analysis['tokenStatuses']);

        return response()->json($analysis);
    }

    public function deleteBook(Request $request, UserBook $book): JsonResponse
    {
        abort_unless($book->user_id === $request->user()->id, 403);
        $book->delete();

        return response()->json(['ok' => true]);
    }

    private function extractPdfText(string $path): string
    {
        $parser = new PdfParser;
        $pdf = $parser->parseFile($path);
        $raw = $pdf->getText();

        return $this->cleanExtractedText($raw);
    }

    private function extractEpubText(string $path): string
    {
        $zip = new \ZipArchive;

        if ($zip->open($path) !== true) {
            throw new \RuntimeException('Az EPUB fájl nem olvasható.');
        }

        // Read spine order from OPF so chapters come in the right sequence
        $opfPath = $this->findEpubOpfPath($zip);
        $spineFiles = $opfPath ? $this->readEpubSpine($zip, $opfPath) : [];

        // Fall back to alphabetical listing if spine couldn't be parsed
        if (empty($spineFiles)) {
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if (preg_match('/\.(html|htm|xhtml)$/i', $name)) {
                    $spineFiles[] = $name;
                }
            }
            sort($spineFiles);
        }

        $parts = [];
        $totalBytes = 0;
        foreach ($spineFiles as $name) {
            $content = $this->safeReadZipEntry($zip, $name);
            if ($content === false) {
                continue;
            }

            // Stop once the cumulative uncompressed prose passes the cap, so a
            // zip with many large entries can't exhaust memory across iterations.
            $totalBytes += strlen($content);
            if ($totalBytes > self::MAX_EPUB_TOTAL_BYTES) {
                break;
            }

            $text = $this->htmlToCleanText($content);
            if (mb_strlen($text) > 60) {
                $parts[] = $text;
            }
        }

        $zip->close();

        return implode("\n\n", $parts);
    }

    /**
     * Convert an HTML/XHTML string to plain readable text,
     * removing images, links' hrefs, navigation, and other non-prose noise.
     */
    private function htmlToCleanText(string $html): string
    {
        // Drop elements that never contain readable prose
        $html = preg_replace(
            '/<(script|style|img|figure|figcaption|nav|header|footer|aside|svg|math)[^>]*>.*?<\/\1>/si',
            ' ',
            $html
        ) ?? $html;

        // Self-closing img / br / hr
        $html = preg_replace('/<(img|br|hr)[^>]*\/?>/si', ' ', $html) ?? $html;

        // Replace block-level tags with newlines so sentences don't run together
        $html = preg_replace('/<\/(p|div|li|h[1-6]|blockquote|tr|td|th)>/si', "\n", $html) ?? $html;

        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return $this->cleanExtractedText($text);
    }

    /**
     * Remove URLs, lines that are mostly non-letter characters,
     * and other common e-book garbage from extracted text.
     */
    private function cleanExtractedText(string $text): string
    {
        $lines = explode("\n", $text);
        $clean = [];

        foreach ($lines as $line) {
            $line = trim($line);

            if ($line === '') {
                continue;
            }

            // Drop lines that look like URLs or file paths
            if (preg_match('/^https?:\/\/\S+$/i', $line) || preg_match('/^www\.\S+$/i', $line)) {
                continue;
            }

            // Drop lines where less than 50 % of characters are letters
            // (catches: "* * *", "- - -", page numbers, ISBN lines, etc.)
            $letterCount = preg_match_all('/[a-zA-Z]/u', $line);
            $totalCount = mb_strlen($line);
            if ($totalCount > 0 && ($letterCount / $totalCount) < 0.5) {
                continue;
            }

            // Drop very short lines that are just one word (headers/captions/labels)
            // but keep short lines if they're part of dialogue (start with " or —)
            if (mb_strlen($line) < 15 && ! preg_match('/^["""—]/u', $line)) {
                continue;
            }

            $clean[] = $line;
        }

        $result = implode("\n", $clean);

        // Collapse runs of blank lines and excessive whitespace
        $result = preg_replace('/(\s*\n\s*){3,}/', "\n\n", $result) ?? $result;
        $result = preg_replace('/[ \t]+/', ' ', $result) ?? $result;

        return trim($result);
    }

    /**
     * Parse the OPF spine to get HTML files in reading order,
     * skipping navigation/TOC/cover items.
     *
     * @return string[]
     */
    private function readEpubSpine(\ZipArchive $zip, string $opfPath): array
    {
        $opfContent = $this->safeReadZipEntry($zip, $opfPath);
        if ($opfContent === false) {
            return [];
        }

        $opfDir = dirname($opfPath);
        if ($opfDir === '.') {
            $opfDir = '';
        }

        // Build id → [href, properties] map from manifest
        $manifest = [];
        preg_match_all('/<item\s([^>]+)>/si', $opfContent, $items, PREG_SET_ORDER);
        foreach ($items as $item) {
            $attrs = $item[1];
            preg_match('/\bid="([^"]+)"/i', $attrs, $idM);
            preg_match('/\bhref="([^"]+)"/i', $attrs, $hrefM);
            preg_match('/\bproperties="([^"]+)"/i', $attrs, $propM);
            preg_match('/\bmedia-type="([^"]+)"/i', $attrs, $typeM);

            if (! isset($idM[1], $hrefM[1])) {
                continue;
            }

            $manifest[$idM[1]] = [
                'href' => $hrefM[1],
                'properties' => $propM[1] ?? '',
                'media_type' => $typeM[1] ?? '',
            ];
        }

        // Collect IDs that are non-prose by nature (nav, cover)
        $skipIds = [];
        foreach ($manifest as $id => $meta) {
            $props = strtolower($meta['properties']);
            if (str_contains($props, 'nav') || str_contains($props, 'cover')) {
                $skipIds[$id] = true;
            }
        }

        // Also collect cover/toc hrefs from <guide> and <reference> elements
        $skipHrefs = [];
        preg_match_all('/<(?:guide\s*>.*?<\/guide|reference\s[^>]+>)/si', $opfContent, $guides);
        preg_match_all('/<reference\s[^>]*type="([^"]+)"[^>]*href="([^"]+)"/si', $opfContent, $refs2, PREG_SET_ORDER);
        foreach ($refs2 as $ref) {
            $type = strtolower($ref[1]);
            if (str_contains($type, 'toc') || str_contains($type, 'cover') || str_contains($type, 'title-page')) {
                $skipHrefs[strtok($ref[2], '#')] = true;
            }
        }

        // Read spine idrefs in order
        preg_match_all('/<itemref\s[^>]*idref="([^"]+)"/si', $opfContent, $refs, PREG_SET_ORDER);

        $files = [];
        foreach ($refs as $ref) {
            $id = $ref[1];

            if (isset($skipIds[$id])) {
                continue;
            }

            $meta = $manifest[$id] ?? null;
            if ($meta === null) {
                continue;
            }

            $href = rawurldecode(strtok($meta['href'], '#'));

            if (isset($skipHrefs[$href])) {
                continue;
            }

            $fullPath = $opfDir !== '' ? $opfDir.'/'.$href : $href;
            $fullPath = $this->normalizePath($fullPath);

            // The manifest media-type is authoritative; some EPUBs (e.g. Calibre
            // splits) name HTML documents without a .html/.xhtml extension.
            $isHtmlDoc = str_contains(strtolower($meta['media_type']), 'html')
                || preg_match('/\.(html|htm|xhtml)$/i', $fullPath);

            if (! $isHtmlDoc) {
                continue;
            }

            // Skip by filename patterns common for covers/TOC
            $basename = strtolower(basename($fullPath));
            if (preg_match('/^(cover|toc|contents|nav|navigation|title[\-_]?page)/i', $basename)) {
                continue;
            }

            // Content-based skip: read file and check if it's a TOC page
            $content = $this->safeReadZipEntry($zip, $fullPath);
            if ($content !== false && $this->looksLikeTocPage($content)) {
                continue;
            }

            $files[] = $fullPath;
        }

        return array_values(array_unique($files));
    }

    /**
     * Returns true if the HTML content looks like a table of contents
     * rather than readable prose (many links relative to text, or epub:type="toc").
     */
    private function looksLikeTocPage(string $html): bool
    {
        // EPUB3 nav document
        if (preg_match('/epub:type="[^"]*toc[^"]*"/i', $html) ||
            preg_match('/epub:type="[^"]*landmarks[^"]*"/i', $html)) {
            return true;
        }

        // Count <a> tags vs total text length — TOC pages are link-dense
        $linkCount = substr_count(strtolower($html), '<a ');
        $textLength = mb_strlen(strip_tags($html));
        if ($linkCount > 5 && $textLength > 0 && ($linkCount / ($textLength / 100)) > 1.5) {
            return true;
        }

        return false;
    }

    private function normalizePath(string $path): string
    {
        $parts = explode('/', $path);
        $stack = [];
        foreach ($parts as $part) {
            if ($part === '..') {
                array_pop($stack);
            } elseif ($part !== '' && $part !== '.') {
                $stack[] = $part;
            }
        }

        return implode('/', $stack);
    }

    /**
     * Read a zip entry only if its uncompressed size is within the per-entry cap.
     * Guards against zip bombs: ZipArchive::getFromName() decompresses the whole
     * entry into memory, so an unchecked read of a maliciously compressed entry
     * could exhaust memory. Returns false for missing or oversized entries.
     */
    private function safeReadZipEntry(\ZipArchive $zip, string $name): string|false
    {
        $stat = $zip->statName($name);

        if ($stat === false || ($stat['size'] ?? 0) > self::MAX_EPUB_ENTRY_BYTES) {
            return false;
        }

        return $zip->getFromName($name);
    }

    private function findEpubOpfPath(\ZipArchive $zip): ?string
    {
        $container = $this->safeReadZipEntry($zip, 'META-INF/container.xml');
        if ($container === false) {
            return null;
        }
        if (preg_match('/full-path="([^"]+\.opf)"/i', $container, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * Egy feladat .env-ből feloldott modellpárja: [primary, fallback]. A fallback
     * null, ha nincs beállítva (vagy megegyezik a primary-vel) — ilyenkor a
     * callGemini() nem eszkalál, csak a primary-t hívja.
     *
     * @return array{0: string, 1: ?string}
     */
    private function modelsFor(string $task): array
    {
        $config = config("services.gemini.models.{$task}", []);
        $primary = $config['primary'] ?? 'gemini-2.5-flash-lite';
        $fallback = $config['fallback'] ?? null;

        // A "none" sentinellel (.env-ben GEMINI_FALLBACK_*=none) kapcsolható ki az
        // eszkaláció; a primary-vel egyező fallbacknek sincs értelme.
        $hasFallback = $fallback && strtolower($fallback) !== 'none' && $fallback !== $primary;

        return [$primary, $hasFallback ? $fallback : null];
    }

    /**
     * Gemini árazás modellenként, USD / 1M token (input és output külön).
     * A költséget ebből számoljuk mikro-dollárban (lásd lentebb).
     *
     * @var array<string, array{in: float, out: float}>
     */
    private const GEMINI_PRICING = [
        'gemini-2.5-flash-lite' => ['in' => 0.10, 'out' => 0.40],
        'gemini-2.5-flash' => ['in' => 0.30, 'out' => 2.50],
        // Újabb generációk — ha a .env ezekre állít primary/fallback-et, a settle()
        // a valós árukon számoljon, ne essen vissza a lite becslésre.
        'gemini-3.1-flash-lite' => ['in' => 0.25, 'out' => 1.50],
        'gemini-3.5-flash' => ['in' => 1.50, 'out' => 9.00],
    ];

    /**
     * Próbálkozások száma modellenként a callGemini() lánc minden lépcsőjén.
     * Két modell (primary + fallback) esetén legfeljebb ennyi × 2 hívás — a
     * szinkron kérés gateway-timeoutját nem feszítheti túl.
     */
    private const GEMINI_ATTEMPTS_PER_MODEL = 2;

    /**
     * Call Gemini with retry logic and thinking disabled.
     *
     * @return array{ok: bool, data: mixed, error: string, cost_micros?: int, model?: string}
     */
    private function callGemini(string $apiKey, string $prompt, int $maxTokens, string $model = 'gemini-2.5-flash-lite', ?string $fallbackModel = null, float $temperature = 0.3, ?array $responseSchema = null, ?User $user = null): array
    {
        $generationConfig = [
            'temperature' => $temperature,
            'maxOutputTokens' => $maxTokens,
            'thinkingConfig' => ['thinkingBudget' => 0],
        ];

        // Strukturált kimenet: a séma garantálja a JSON-alakot a modell oldalán,
        // így nem törékeny szöveg-parsingra hagyatkozunk. A determinisztikus,
        // cache-elt szófeladatoknál ez kulcsfontosságú — egy hibás alakú válasz
        // különben mindenki számára bekerülne a gyorsítótárba.
        if ($responseSchema !== null) {
            $generationConfig['responseMimeType'] = 'application/json';
            $generationConfig['responseSchema'] = $responseSchema;
        }

        $payload = [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => $generationConfig,
        ];

        // A keretet a primary (általában olcsóbb) modell árán foglaljuk le; ha a
        // ritka eszkaláció drágább fallback-en köt ki, a settle() rátölti a
        // különbözetet. Pre-charge atomikusan, hogy párhuzamos hívások ne
        // csússzanak át mind egy elavult „kereten belül" ellenőrzésen (TOCTOU).
        $primaryRate = self::GEMINI_PRICING[$model] ?? self::GEMINI_PRICING['gemini-2.5-flash-lite'];
        $estimatedMicros = (int) round(((int) ceil(mb_strlen($prompt) / 4)) * $primaryRate['in'] + $maxTokens * $primaryRate['out']);

        if ($user !== null && ! $this->aiUsage->reserve($user, $estimatedMicros)) {
            return ['ok' => false, 'data' => null, 'error' => 'Elérted a havi AI-felhasználási kereted.', 'cost_micros' => 0];
        }

        // Modell-lánc: a primary-vel indulunk, és kapacitás-hibára (503/429/5xx,
        // hálózati hiba) átesünk a fallback-re. Egy konkrét modell túlterheltsége
        // (503) így nem fordul user-felé menő hibába, ha egy testvérmodell épp él.
        $models = array_values(array_unique(array_filter([$model, $fallbackModel])));
        $lastError = 'Ismeretlen hiba.';
        $bumpedForTruncation = false;

        foreach ($models as $currentModel) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$currentModel}:generateContent";
            $rate = self::GEMINI_PRICING[$currentModel] ?? self::GEMINI_PRICING['gemini-2.5-flash-lite'];

            for ($attempt = 1; $attempt <= self::GEMINI_ATTEMPTS_PER_MODEL; $attempt++) {
                try {
                    $response = Http::connectTimeout(10)
                        ->timeout(20)
                        ->withHeaders([
                            'Content-Type' => 'application/json',
                            'x-goog-api-key' => $apiKey,
                        ])
                        ->post($url, $payload);
                } catch (\Throwable $e) {
                    // Hálózati hiba (timeout, DNS, kapcsolat) — átmeneti, újrapróbáljuk;
                    // a próbák kifutása után a foreach a fallback modellre lép.
                    $lastError = 'Kapcsolódási hiba.';
                    Log::warning('Gemini connection error', [
                        'model' => $currentModel, 'attempt' => $attempt, 'message' => $e->getMessage(),
                    ]);
                    $this->backoff($attempt);

                    continue;
                }

                if (! $response->successful()) {
                    $status = $response->status();
                    $lastError = 'Gemini API hiba ('.$status.')';
                    Log::warning('Gemini API error', [
                        'model' => $currentModel, 'attempt' => $attempt, 'status' => $status,
                        'body' => mb_substr($response->body(), 0, 500),
                    ]);

                    // 4xx (a 429 kivételével) végleges kérés-hiba: sem újrapróba, sem
                    // fallback nem segít (rossz kérés), ezért az egész láncot elhagyjuk.
                    if ($status < 500 && $status !== 429) {
                        break 2;
                    }

                    // 429 (kvóta) / 5xx (túlterhelt modell): visszalépéssel újrapróbáljuk
                    // ezen a modellen, majd — ha elfogytak a próbák — a fallback jön.
                    $this->backoff($attempt, $response->header('Retry-After'));

                    continue;
                }

                $finishReason = $response->json('candidates.0.finishReason');
                $blockReason = $response->json('promptFeedback.blockReason');

                // Biztonsági/szabályzati blokk (prompt vagy válasz): sem az újrapróba,
                // sem a fallback nem segít (ugyanaz a prompt ugyanúgy blokkolódna),
                // ezért azonnal hibát adunk vissza és a keretet felszabadítjuk.
                if ($blockReason !== null
                    || in_array($finishReason, ['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT'], true)) {
                    Log::warning('Gemini blocked content', [
                        'model' => $currentModel, 'finishReason' => $finishReason, 'blockReason' => $blockReason,
                    ]);

                    if ($user !== null) {
                        $this->aiUsage->refund($user, $estimatedMicros);
                    }

                    return ['ok' => false, 'data' => null, 'error' => 'Az AI biztonsági okból nem tudott választ adni erre a kérésre.', 'cost_micros' => 0];
                }

                $parts = $response->json('candidates.0.content.parts') ?? [];
                $text = collect($parts)->firstWhere(fn ($p) => empty($p['thought']))['text']
                    ?? ($response->json('candidates.0.content.parts.0.text') ?? '');

                $text = preg_replace('/^```json\s*|\s*```$/s', '', trim($text));
                $data = json_decode($text, true);

                if ($data === null) {
                    $lastError = 'Érvénytelen AI válasz (nem JSON).';

                    // Csonkolás (MAX_TOKENS): a séma mezőnevei és a hosszú szóalakok
                    // elérték a kimeneti keretet, ezért tört a JSON. Egyszer megemeljük
                    // a keretet (a megemelt érték a fallback-re is átöröklődik) — a vak,
                    // azonos keretű ismétlés ugyanígy csonkolódna. A költséget a settle() rendezi.
                    if ($finishReason === 'MAX_TOKENS' && ! $bumpedForTruncation) {
                        $bumpedForTruncation = true;
                        $payload['generationConfig']['maxOutputTokens'] = (int) ceil($maxTokens * 1.5);
                        Log::warning('Gemini truncated, retrying with higher token budget', [
                            'model' => $currentModel, 'attempt' => $attempt,
                            'newMaxOutputTokens' => $payload['generationConfig']['maxOutputTokens'],
                        ]);
                    }

                    continue;
                }

                // Tényleges költség a Gemini válasz token-bontásából (input/output külön
                // árazva), mikro-dollárban (1e6 = $1). Hiányzó usageMetadata esetén durva
                // becslés a prompt + válasz hosszából (~4 karakter / token).
                $inputTokens = (int) ($response->json('usageMetadata.promptTokenCount')
                    ?? ceil(mb_strlen($prompt) / 4));
                $outputTokens = (int) ($response->json('usageMetadata.candidatesTokenCount')
                    ?? ceil(mb_strlen($text) / 4));

                $costMicros = (int) round($inputTokens * $rate['in'] + $outputTokens * $rate['out']);

                if ($user !== null) {
                    $this->aiUsage->settle($user, $estimatedMicros, $costMicros);
                }

                return ['ok' => true, 'data' => $data, 'error' => '', 'cost_micros' => $costMicros, 'model' => $currentModel];
            }
        }

        if ($user !== null) {
            $this->aiUsage->refund($user, $estimatedMicros);
        }

        return ['ok' => false, 'data' => null, 'error' => $lastError, 'cost_micros' => 0];
    }

    /**
     * Rövid, exponenciálisan növekvő várakozás újrapróbálás előtt. A felhasználó
     * szinkron kérésében fut, ezért szándékosan rövid (max ~2 mp), hogy a webszerver
     * gateway-timeoutját (502/504) ne lépje túl. Tesztek alatt nem alszik.
     * A Gemini 429-nél küldött Retry-After fejlécet tiszteletben tartja, de korlátozza.
     */
    private function backoff(int $attempt, ?string $retryAfter = null): void
    {
        if (app()->runningUnitTests()) {
            return;
        }

        $seconds = is_numeric($retryAfter)
            ? min((float) $retryAfter, 2.0)
            : min(0.4 * (2 ** ($attempt - 1)), 2.0);

        usleep((int) ($seconds * 1_000_000));
    }

    /** @return string[] */
    /**
     * Gyakori angol összevonások kibontása valódi szavakra (a szóelemzéshez).
     * Így az „I'm" nem két törött token lesz, hanem „am", az „I'd" → „would" stb.
     */
    private const CONTRACTIONS = [
        "i'm" => 'i am', "you're" => 'you are', "we're" => 'we are', "they're" => 'they are',
        "he's" => 'he is', "she's" => 'she is', "it's" => 'it is', "that's" => 'that is',
        "there's" => 'there is', "here's" => 'here is', "who's" => 'who is', "what's" => 'what is',
        "where's" => 'where is', "how's" => 'how is', "let's" => 'let us',
        "i've" => 'i have', "you've" => 'you have', "we've" => 'we have', "they've" => 'they have',
        "could've" => 'could have', "would've" => 'would have', "should've" => 'should have',
        "might've" => 'might have', "must've" => 'must have',
        "i'll" => 'i will', "you'll" => 'you will', "we'll" => 'we will', "they'll" => 'they will',
        "he'll" => 'he will', "she'll" => 'she will', "it'll" => 'it will', "that'll" => 'that will',
        "i'd" => 'i would', "you'd" => 'you would', "we'd" => 'we would', "they'd" => 'they would',
        "he'd" => 'he would', "she'd" => 'she would', "it'd" => 'it would',
        "don't" => 'do not', "doesn't" => 'does not', "didn't" => 'did not', "isn't" => 'is not',
        "aren't" => 'are not', "wasn't" => 'was not', "weren't" => 'were not', "haven't" => 'have not',
        "hasn't" => 'has not', "hadn't" => 'had not', "won't" => 'will not', "wouldn't" => 'would not',
        "can't" => 'can not', "couldn't" => 'could not', "shouldn't" => 'should not',
        "mustn't" => 'must not', "mightn't" => 'might not', "needn't" => 'need not',
        "shan't" => 'shall not', "ain't" => 'is not',
    ];

    /**
     * @return array<int, string>
     */
    private function tokenize(string $text): array
    {
        // Aposztrófok egységesítése, kisbetűsítés
        $cleaned = mb_strtolower(str_replace(["\u{2018}", "\u{2019}", "\u{2032}"], "'", $text));

        // Összevonások szóalakokra bontása; az ismeretlen aposztrófos szavaknál (pl. birtokos "dog's")
        // levágjuk az aposztróf utáni részt → "dog".
        $cleaned = preg_replace_callback(
            "/\b[a-z]+(?:'[a-z]+)+\b/",
            fn ($m) => self::CONTRACTIONS[$m[0]] ?? preg_replace("/'.*/", '', $m[0]),
            $cleaned
        ) ?? $cleaned;

        $cleaned = preg_replace('/[^a-z ]+/', ' ', $cleaned) ?? '';
        $words = preg_split('/\s+/', trim($cleaned)) ?: [];

        // 1 betűs szavak közül csak a két valódi angol szót tartjuk meg ("a", "i") — a többi zaj.
        return array_values(array_filter($words, fn ($w) => strlen($w) >= 2 || $w === 'a' || $w === 'i'));
    }
}
