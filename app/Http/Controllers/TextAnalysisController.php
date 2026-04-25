<?php

namespace App\Http\Controllers;

use App\Models\UserBook;
use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;
use Smalot\PdfParser\Parser as PdfParser;

class TextAnalysisController extends Controller
{
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

        // Check user's custom words first (all forms)
        $customWord = $user->customWords()
            ->where(function ($q) use ($raw) {
                $q->whereRaw('LOWER(word) = ?', [$raw])
                    ->orWhereRaw('LOWER(form_base) = ?', [$raw])
                    ->orWhereRaw('LOWER(verb_past) = ?', [$raw])
                    ->orWhereRaw('LOWER(verb_past_participle) = ?', [$raw])
                    ->orWhereRaw('LOWER(verb_present_participle) = ?', [$raw])
                    ->orWhereRaw('LOWER(verb_third_person) = ?', [$raw])
                    ->orWhereRaw('LOWER(noun_plural) = ?', [$raw])
                    ->orWhereRaw('LOWER(adj_comparative) = ?', [$raw])
                    ->orWhereRaw('LOWER(adj_superlative) = ?', [$raw]);
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
        $url = $request->validate(['url' => 'required|url|max:2000'])['url'];

        $videoId = $this->extractYouTubeId($url);

        try {
            $text = $videoId !== null
                ? $this->fetchYouTubeCaptions($videoId)
                : $this->fetchWebpageText($url);
        } catch (\Throwable $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        $text = mb_substr($text, 0, 15000);

        return response()->json(['text' => $text]);
    }

    public function analyze(Request $request): JsonResponse
    {
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

        $text = $request->validate(['text' => 'required|string|max:15000'])['text'];

        $tokens = $this->tokenize($text);

        if (empty($tokens)) {
            return response()->json([
                'comprehension' => 0,
                'totalWords' => 0,
                'uniqueWords' => 0,
                'knownCount' => 0,
                'learningCount' => 0,
                'tokenStatuses' => [],
                'topUnknown' => [],
            ]);
        }

        $uniqueTokens = array_values(array_unique($tokens));
        $tokenFrequencies = array_count_values($tokens);

        $words = Word::query()
            ->where(function ($q) use ($uniqueTokens) {
                $q->whereIn('word', $uniqueTokens)
                    ->orWhereIn('form_base', $uniqueTokens)
                    ->orWhereIn('verb_past', $uniqueTokens)
                    ->orWhereIn('verb_past_participle', $uniqueTokens)
                    ->orWhereIn('verb_present_participle', $uniqueTokens)
                    ->orWhereIn('verb_third_person', $uniqueTokens)
                    ->orWhereIn('noun_plural', $uniqueTokens)
                    ->orWhereIn('adj_comparative', $uniqueTokens)
                    ->orWhereIn('adj_superlative', $uniqueTokens);
            })
            ->get(['id', 'word', 'rank', 'meaning_hu', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative']);

        $user = $request->user();
        $userWordStatuses = $user->knownWords()
            ->whereIn('words.id', $words->pluck('id'))
            ->pluck('user_word.status', 'words.id')
            ->all();

        // Include user's custom words in the analysis (check all forms)
        $customWords = UserCustomWord::where('user_id', $user->id)
            ->where(function ($q) use ($uniqueTokens) {
                $q->whereIn('word', $uniqueTokens)
                    ->orWhereIn('form_base', $uniqueTokens)
                    ->orWhereIn('verb_past', $uniqueTokens)
                    ->orWhereIn('verb_past_participle', $uniqueTokens)
                    ->orWhereIn('verb_present_participle', $uniqueTokens)
                    ->orWhereIn('verb_third_person', $uniqueTokens)
                    ->orWhereIn('noun_plural', $uniqueTokens)
                    ->orWhereIn('adj_comparative', $uniqueTokens)
                    ->orWhereIn('adj_superlative', $uniqueTokens);
            })
            ->get(['id', 'word', 'status', 'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle', 'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative']);

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

        uasort(
            $unknownInListWords,
            fn ($a, $b) => $b['frequency'] !== $a['frequency']
                ? $b['frequency'] - $a['frequency']
                : $a['rank'] - $b['rank']
        );

        $totalTokenCount = count($tokens);
        $comprehension = $totalTokenCount > 0 ? round(($knownTokenCount / $totalTokenCount) * 100) : 0;

        $newAchievements = app(AchievementService::class)->checkAndAwardAnalysis($request->user(), $comprehension);

        return response()->json([
            'comprehension' => $comprehension,
            'totalWords' => $totalTokenCount,
            'uniqueWords' => count($uniqueTokens),
            'knownCount' => $knownTokenCount,
            'learningCount' => $learningTokenCount,
            'tokenStatuses' => $tokenStatuses,
            'topUnknown' => array_values(array_slice($unknownInListWords, 0, 20, true)),
            'achievements' => $newAchievements,
        ]);
    }

    private function extractYouTubeId(string $url): ?string
    {
        $patterns = [
            '/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/',
            '/youtu\.be\/([a-zA-Z0-9_-]{11})/',
            '/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/',
            '/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $url, $m)) {
                return $m[1];
            }
        }

        return null;
    }

    private function fetchYouTubeCaptions(string $videoId): string
    {
        // Strategy 1: InnerTube API with multiple clients
        $text = $this->fetchViaInnertube($videoId);
        if ($text !== '') {
            return $text;
        }

        // Strategy 3: YouTube timedtext API
        $text = $this->fetchViaTimedtextApi($videoId);
        if ($text !== '') {
            return $text;
        }

        // Strategy 4: Scrape the watch page for a signed caption URL
        $text = $this->fetchViaPageScraping($videoId);
        if ($text !== '') {
            return $text;
        }

        throw new \RuntimeException('Ehhez a videóhoz nem érhetők el angol feliratok, vagy a felirat nem feldolgozható.');
    }

    private function fetchViaInnertube(string $videoId): string
    {
        $androidUa = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';

        // Must extract the API key from the watch page — hardcoded keys return UNPLAYABLE
        $pageResponse = Http::timeout(20)
            ->withHeaders(['User-Agent' => $androidUa, 'Accept-Language' => 'en-US,en;q=0.9'])
            ->get('https://www.youtube.com/watch?v='.$videoId);

        if (! $pageResponse->ok()) {
            return '';
        }

        if (! preg_match('/"INNERTUBE_API_KEY"\s*:\s*"([a-zA-Z0-9_-]+)"/', $pageResponse->body(), $keyMatch)) {
            return '';
        }

        $apiKey = $keyMatch[1];

        $playerResponse = Http::timeout(15)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'Accept-Language' => 'en-US',
                'User-Agent' => $androidUa,
            ])
            ->post('https://www.youtube.com/youtubei/v1/player?key='.$apiKey, [
                'context' => ['client' => ['clientName' => 'ANDROID', 'clientVersion' => '20.10.38']],
                'videoId' => $videoId,
            ]);

        if (! $playerResponse->ok()) {
            return '';
        }

        $tracks = $playerResponse->json('captions.playerCaptionsTracklistRenderer.captionTracks') ?? [];

        if (empty($tracks)) {
            return '';
        }

        $track = collect($tracks)->first(fn ($t) => str_starts_with($t['languageCode'] ?? '', 'en'))
            ?? $tracks[0];

        $captionUrl = $track['baseUrl'] ?? null;

        if (! $captionUrl) {
            return '';
        }

        // Try XML (default, no fmt) first — ANDROID returns timedtext XML with <p> tags
        foreach ([$captionUrl, $captionUrl.'&fmt=json3'] as $url) {
            $captionResponse = Http::timeout(15)->get($url);

            if (! $captionResponse->ok() || mb_strlen($captionResponse->body()) < 20) {
                continue;
            }

            $text = $this->parseCaptionBody($captionResponse->body());
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function fetchViaTimedtextApi(string $videoId): string
    {
        $base = 'https://www.youtube.com/api/timedtext?v='.urlencode($videoId).'&lang=en';

        foreach (['&fmt=json3', '&fmt=vtt', ''] as $fmtParam) {
            $response = Http::timeout(10)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'])
                ->get($base.$fmtParam);

            if (! $response->ok() || mb_strlen($response->body()) < 20) {
                continue;
            }

            $text = $this->parseCaptionBody($response->body());
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function fetchViaPageScraping(string $videoId): string
    {
        $pageResponse = Http::timeout(20)
            ->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept-Language' => 'en-US,en;q=0.9',
            ])
            ->get('https://www.youtube.com/watch?v='.$videoId);

        if (! $pageResponse->ok()) {
            return '';
        }

        $captionUrl = $this->extractCaptionUrl($pageResponse->body());
        if ($captionUrl === null) {
            return '';
        }

        $json3Url = preg_replace('/([?&])fmt=[^&]*/', '$1fmt=json3', $captionUrl);
        if (! str_contains($json3Url ?? '', 'fmt=')) {
            $json3Url = $captionUrl.(str_contains($captionUrl, '?') ? '&' : '?').'fmt=json3';
        }

        foreach ([$json3Url, $captionUrl] as $url) {
            $response = Http::timeout(15)->get($url);
            if (! $response->ok() || mb_strlen($response->body()) < 20) {
                continue;
            }

            $text = $this->parseCaptionBody($response->body());
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function parseCaptionBody(string $body): string
    {
        $trimmed = ltrim($body);

        if (str_starts_with($trimmed, '{')) {
            $decoded = json_decode($body, true);
            if (is_array($decoded)) {
                return $this->parseJson3Captions($decoded);
            }
        }

        if (str_starts_with($trimmed, 'WEBVTT')) {
            return $this->parseVttCaptions($body);
        }

        if (str_starts_with($trimmed, '<') || str_contains($trimmed, '<?xml')) {
            return $this->parseXmlCaptions($body);
        }

        return '';
    }

    private function parseVttCaptions(string $body): string
    {
        $lines = preg_split('/\r?\n/', $body) ?: [];
        $texts = [];
        $prev = '';
        $pastHeader = false;

        foreach ($lines as $line) {
            $line = trim($line);

            // The VTT header ends at the first blank line
            if (! $pastHeader) {
                if ($line === '') {
                    $pastHeader = true;
                }

                continue;
            }

            // Skip blank lines, cue IDs (digits only), and timestamp lines
            if ($line === '' || preg_match('/^\d+$/', $line) || str_contains($line, '-->')) {
                continue;
            }

            // Strip inline timing tags (<00:00:00.000>, <c>, <c.color_white>, etc.)
            $text = preg_replace('/<[^>]+>/', '', $line) ?? $line;
            $text = html_entity_decode(trim($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $text = preg_replace('/\[[^\]]*\]/', '', $text) ?? $text;
            $text = trim(preg_replace('/\s+/', ' ', $text) ?? $text);

            if ($text === '' || $text === $prev) {
                continue;
            }

            $texts[] = $text;
            $prev = $text;
        }

        return implode(' ', $texts);
    }

    private function extractCaptionUrl(string $html): ?string
    {
        $key = '"captionTracks":';
        $start = strpos($html, $key);

        if ($start === false) {
            return null;
        }

        // Walk through the JSON array character-by-character to find its true end
        $depth = 0;
        $inString = false;
        $escape = false;
        $jsonStart = $start + strlen($key);
        $jsonEnd = null;

        for ($i = $jsonStart; $i < min($jsonStart + 100000, strlen($html)); $i++) {
            $c = $html[$i];

            if ($escape) {
                $escape = false;

                continue;
            }

            if ($c === '\\' && $inString) {
                $escape = true;

                continue;
            }

            if ($c === '"') {
                $inString = ! $inString;

                continue;
            }

            if ($inString) {
                continue;
            }

            if ($c === '[') {
                $depth++;
            } elseif ($c === ']') {
                $depth--;
                if ($depth === 0) {
                    $jsonEnd = $i;
                    break;
                }
            }
        }

        if ($jsonEnd === null) {
            return null;
        }

        $tracks = json_decode(substr($html, $jsonStart, $jsonEnd - $jsonStart + 1), true);

        if (empty($tracks)) {
            return null;
        }

        $track = collect($tracks)->first(fn ($t) => str_starts_with($t['languageCode'] ?? '', 'en'))
            ?? $tracks[0];

        return $track['baseUrl'] ?? null;
    }

    private function parseJson3Captions(mixed $data): string
    {
        if (! is_array($data) || empty($data['events'])) {
            return '';
        }

        $lines = [];
        foreach ($data['events'] as $event) {
            if (! isset($event['segs'])) {
                continue;
            }
            $text = implode('', array_column($event['segs'], 'utf8'));
            // Remove sound annotations like [Music], [Applause], [Laughter], etc.
            $text = preg_replace('/\[[^\]]*\]/', '', $text) ?? $text;
            $text = preg_replace('/\s+/', ' ', trim($text)) ?? '';
            if ($text !== '') {
                $lines[] = $text;
            }
        }

        return implode(' ', $lines);
    }

    private function parseXmlCaptions(string $body): string
    {
        // YouTube returns either <text> (older) or <p> (ANDROID InnerTube) tags
        if (! preg_match_all('/<(?:text|p)[^>]*>(.*?)<\/(?:text|p)>/s', $body, $matches)) {
            return '';
        }

        $lines = array_map(function ($line) {
            $line = trim(html_entity_decode(strip_tags($line), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            return trim(preg_replace('/\[[^\]]*\]/', '', $line) ?? $line);
        }, $matches[1]);

        return implode(' ', array_filter($lines, fn ($l) => $l !== ''));
    }

    private function fetchWebpageText(string $url): string
    {
        $response = Http::timeout(15)
            ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'])
            ->get($url);

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

    public function listBooks(Request $request): JsonResponse
    {
        $user = $request->user();

        $books = $user
            ->hasMany(UserBook::class, 'user_id')
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'file_type', 'total_pages', 'created_at'])
            ->map(fn ($b) => [
                'id' => $b->id,
                'title' => $b->title,
                'file_type' => $b->file_type,
                'total_pages' => $b->total_pages,
            ]);

        $bookLimit = match (true) {
            $user->subscribed('premium') || $user->ai_access => 5,
            $user->subscribed('default') => 3,
            default => 1,
        };

        $usedStorage = UserBook::where('user_id', $user->id)->sum('text_size');

        return response()->json([
            'books' => $books,
            'bookLimit' => $bookLimit,
            'usedStorage' => $usedStorage,
            'storageLimit' => 30 * 1024 * 1024,
        ]);
    }

    public function geminiFlashcard(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || request()->user()?->hasAiAccess(), 403);

        $word = $request->string('word')->trim()->value();

        if (strlen($word) < 1) {
            return response()->json(['error' => 'Hiányzó szó.'], 422);
        }

        $apiKey = env('GEMINI_API_KEY') ?: config('services.gemini.api_key');
        $prompt = <<<PROMPT
You are an English vocabulary flashcard generator for Hungarian learners. Generate rich flashcard content for the English word "{$word}".

Return ONLY valid JSON with this exact structure:
{
  "cloze_sentences": [
    {"sentence": "sentence with _______ replacing the word", "hints": ["hungarian_meaning_in_this_context_1", "hungarian_meaning_in_this_context_2"]}
  ],
  "answer_options": ["most common hungarian translation", "second most common", "third", "fourth", "fifth"],
  "negative_meaning_hu": ["opposite in hungarian 1", "opposite in hungarian 2", "opposite in hungarian 3"],
  "collocations": [
    {"pattern": "phrase with _______ replacing the word", "meaning_hu": "hungarian meaning", "example": "example with _______ or null"}
  ],
  "word_forms": {"base": "the word itself", "adjective": "adj form or null", "adverb": "adverb form or null", "noun": "noun form or null", "verb": "verb form or null"},
  "common_pairs": ["common collocation 1", "common collocation 2", "common collocation 3", "common collocation 4"],
  "synonyms": ["english synonym 1", "english synonym 2", "english synonym 3", "english synonym 4"],
  "antonyms": ["english antonym 1", "english antonym 2", "english antonym 3"]
}

Rules:
- Generate 4 cloze sentences covering diverse registers: everyday, formal, academic/professional, and written/literary. Each sentence should show the word in a clearly different context.
- hints: each hint must reflect the meaning of the word specifically in THAT sentence's context, not just a generic synonym. For example, "bear" in "bear the cost" → hints: ["visel", "fizet"], not generic ["medve", "elvisel"].
- answer_options: 4-6 Hungarian translations/synonyms, STRICTLY ORDERED from most frequently used in everyday Hungarian to least common. The first item must be the single most natural Hungarian equivalent a native speaker would use by default.
- negative_meaning_hu: 3 Hungarian antonym translations that are true semantic opposites in meaning, not just grammatical negations.
- collocations: 4-5 common phrases/patterns using the word, ordered by frequency of use in English (most common first). Only include collocations that genuinely exist and are widely used.
- word_forms: only include forms that actually exist as real, established English words (set null for non-existent or rarely used forms — do not invent forms).
- Respond ONLY with valid JSON, no markdown.
PROMPT;

        try {
            $response = Http::timeout(20)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={$apiKey}", [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 800],
                ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Kapcsolódási hiba: '.$e->getMessage()], 502);
        }

        if (! $response->successful()) {
            return response()->json(['error' => 'Gemini API hiba ('.$response->status().')'], 502);
        }

        $text = $response->json('candidates.0.content.parts.0.text') ?? '';
        $text = preg_replace('/^```json\s*|\s*```$/s', '', trim($text));
        $data = json_decode($text, true);

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
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
        abort_unless(Gate::check('admin'), 403);

        $validated = $request->validate([
            'words' => ['required', 'array', 'min:1', 'max:10'],
            'words.*.word' => ['required', 'string', 'max:100'],
            'words.*.meaning_hu' => ['nullable', 'string', 'max:200'],
            'text' => ['required', 'string', 'min:5', 'max:3000'],
        ]);

        $text = trim($validated['text']);

        $wordList = collect($validated['words'])->map(function ($w) {
            $meaning = ! empty($w['meaning_hu']) ? " (jelentése: \"{$w['meaning_hu']}\")" : '';

            return "- {$w['word']}{$meaning}";
        })->implode("\n");

        $prompt = <<<PROMPT
You are an English writing coach for Hungarian learners.

The learner is practicing these target words:
{$wordList}

The learner wrote this text:
"{$text}"

Carefully analyze the text. For EACH target word:
1. Did the learner use it (or a grammatical form of it)?
2. If used: was it correct? (right meaning, natural collocation, correct grammar for that word)
3. Give brief, specific, encouraging feedback in Hungarian.

Also provide:
- grammar_issues: array of plain strings, each string is one grammar issue explained in Hungarian (empty array if none). Each element MUST be a plain string, NOT an object.
- overall_hu: 1-2 sentences of overall encouraging feedback in Hungarian
- corrected_text: a corrected version of the full text if there are errors, or null if the text is perfect

Return ONLY valid JSON:
{
  "words": [
    {
      "word": "exactWordFromList",
      "used": true,
      "correct": true,
      "feedback_hu": "Hungarian feedback"
    }
  ],
  "grammar_issues": ["First grammar issue explained in Hungarian", "Second issue"],
  "overall_hu": "Overall comment in Hungarian",
  "corrected_text": null
}

Respond ONLY with valid JSON, no markdown.
PROMPT;

        $apiKey = env('GEMINI_API_KEY') ?: config('services.gemini.api_key');

        try {
            $response = Http::timeout(20)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={$apiKey}", [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 800],
                ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Kapcsolódási hiba: '.$e->getMessage()], 502);
        }

        if (! $response->successful()) {
            return response()->json(['error' => 'Gemini API hiba ('.$response->status().')'], 502);
        }

        $raw = $response->json('candidates.0.content.parts.0.text') ?? '';
        $raw = preg_replace('/^```json\s*|\s*```$/s', '', trim($raw));
        $data = json_decode($raw, true);

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz.'], 502);
        }

        return response()->json($data);
    }

    public function sentenceCheck(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403);

        $validated = $request->validate([
            'word' => ['required', 'string', 'max:100'],
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

Evaluate on two dimensions:
1. **usage_ok**: Is "{$word}" used with the correct meaning and in a grammatically/collocationally appropriate way?
2. **grammar_ok**: Is the overall sentence grammatically correct (ignoring the word itself)?

Return ONLY valid JSON with this exact structure:
{{
  "usage_ok": true or false,
  "grammar_ok": true or false,
  "feedback_hu": "1-3 sentences in Hungarian: explain what is good or wrong about how the word is used. Be specific and encouraging.",
  "grammar_note_hu": "1-2 sentences in Hungarian about any grammar issues, or null if grammar is correct",
  "corrected_sentence": "A corrected version of the sentence if there are any errors, or null if the sentence is fully correct",
  "example_sentence": "One natural, simple example sentence using '{$word}' correctly (different from the learner's sentence)"
}}

Be encouraging and educational. If the sentence is correct, celebrate it. Respond ONLY with valid JSON, no markdown.
PROMPT;

        $apiKey = env('GEMINI_API_KEY') ?: config('services.gemini.api_key');

        try {
            $response = Http::timeout(15)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={$apiKey}", [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 400],
                ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Kapcsolódási hiba: '.$e->getMessage()], 502);
        }

        if (! $response->successful()) {
            return response()->json(['error' => 'Gemini API hiba ('.$response->status().')'], 502);
        }

        $text = $response->json('candidates.0.content.parts.0.text') ?? '';
        $text = preg_replace('/^```json\s*|\s*```$/s', '', trim($text));
        $data = json_decode($text, true);

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
        abort_unless(Gate::check('admin'), 403);

        $word = $request->string('word')->trim()->value();

        if (strlen($word) < 1) {
            return response()->json(['error' => 'Hiányzó szó.'], 422);
        }

        $apiKey = env('GEMINI_API_KEY') ?: config('services.gemini.api_key');

        $prompt = <<<PROMPT
You are an English vocabulary educator for Hungarian learners. For the English word "{$word}", explain where and how it is used in real life.

Return ONLY valid JSON with this exact structure:
{
  "areas": [
    {
      "name_hu": "Terület neve magyarul (pl. Üzleti élet, Orvostudomány, Hétköznapi élet)",
      "description_hu": "1-2 sentences in Hungarian: why/how the word is used in this area",
      "example_en": "A natural example sentence in this context",
      "example_hu": "Hungarian translation of the example"
    }
  ],
  "register_hu": "1 sentence in Hungarian: is the word formal, informal, neutral, or context-dependent?",
  "tip_hu": "1 short learning tip in Hungarian: e.g. a common mistake, a memorable phrase, or a useful pattern"
}

Rules:
- Include 3 distinct real-life areas where this word is genuinely and commonly used.
- Keep descriptions concise — 1-2 sentences max per area.
- Example sentences must be natural, varied across registers/contexts.
- Respond ONLY with valid JSON, no markdown.
PROMPT;

        try {
            $response = Http::timeout(20)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={$apiKey}", [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 600],
                ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Kapcsolódási hiba: '.$e->getMessage()], 502);
        }

        if (! $response->successful()) {
            return response()->json(['error' => 'Gemini API hiba ('.$response->status().')'], 502);
        }

        $text = $response->json('candidates.0.content.parts.0.text') ?? '';
        $text = preg_replace('/^```json\s*|\s*```$/s', '', trim($text));
        $data = json_decode($text, true);

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
        abort_unless(Gate::check('admin') || request()->user()?->hasAiAccess(), 403);
        $apiKey = env('GEMINI_API_KEY') ?: config('services.gemini.api_key');
        $response = Http::get("https://generativelanguage.googleapis.com/v1beta/models?key={$apiKey}");

        return response()->json($response->json());
    }

    public function geminiWordLookup(Request $request): JsonResponse
    {
        abort_unless(Gate::check('admin') || request()->user()?->hasAiAccess(), 403);

        $word = $request->string('word')->trim()->lower()->value();
        $context = $request->string('context')->trim()->value();

        if (strlen($word) < 1) {
            return response()->json(['error' => 'Hiányzó szó.'], 422);
        }

        $apiKey = env('GEMINI_API_KEY') ?: config('services.gemini.api_key');

        $contextBlock = $context
            ? "\nThe word appears in this sentence: \"{$context}\"\nAlso add a field:\n- context_explanation: 1-2 sentences in Hungarian explaining what \"{$word}\" specifically means in that sentence and how it is used in that context."
            : "\n- context_explanation: empty string";

        $prompt = <<<PROMPT
You are a Hungarian-English dictionary assistant. For the English word "{$word}", return a JSON object with EXACTLY these fields:
- meaning_hu: concise primary Hungarian translation (1-5 words)
- extra_meanings: other Hungarian meanings comma-separated, or empty string
- synonyms: English synonyms comma-separated (2-4 words), or empty string
- part_of_speech: MUST be one of exactly: verb, noun, adj, adv, prep, conj, det, pron, num, interj
- example_en: one natural example sentence in English
- example_hu: Hungarian translation of that example sentence
- verb_past: past tense if verb, else empty string
- verb_past_participle: past participle if verb, else empty string
- verb_present_participle: present participle (-ing) if verb, else empty string
- verb_third_person: third person singular if verb, else empty string
- is_irregular: true if irregular verb, else false
- noun_plural: plural form if noun, else empty string
- adj_comparative: comparative if adjective, else empty string
- adj_superlative: superlative if adjective, else empty string
{$contextBlock}

Respond ONLY with valid JSON, no markdown, no explanation.
PROMPT;

        try {
            $response = Http::timeout(15)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key={$apiKey}", [
                    'contents' => [['parts' => [['text' => $prompt]]]],
                    'generationConfig' => ['temperature' => 0.2, 'maxOutputTokens' => 400],
                ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Kapcsolódási hiba a Gemini API-hoz: '.$e->getMessage()], 502);
        }

        if (! $response->successful()) {
            return response()->json(['error' => 'Gemini API hiba ('.$response->status().'): '.$response->body()], 502);
        }

        $text = $response->json('candidates.0.content.parts.0.text') ?? '';
        $text = preg_replace('/^```json\s*|\s*```$/s', '', trim($text));

        $data = json_decode($text, true);

        if (! is_array($data)) {
            return response()->json(['error' => 'Érvénytelen válasz: '.$text], 502);
        }

        return response()->json([
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

    public function uploadBook(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimetypes:application/pdf,application/epub+zip,application/zip|extensions:pdf,epub|max:102400',
        ]);

        $user = $request->user();
        $bookLimit = match (true) {
            $user->subscribed('premium') || $user->ai_access => 5,
            $user->subscribed('default') => 3,
            default => 1,
        };

        $storageLimit = 30 * 1024 * 1024; // 30 MB in bytes

        $bookCount = UserBook::where('user_id', $user->id)->count();
        if ($bookCount >= $bookLimit) {
            return response()->json([
                'error' => "Elérted a könyvek maximális számát ({$bookLimit}). Töröld valamelyiket, vagy válts magasabb csomagra.",
            ], 403);
        }

        $usedStorage = UserBook::where('user_id', $user->id)->sum('text_size');
        if ($usedStorage >= $storageLimit) {
            return response()->json([
                'error' => 'Elérted a 30 MB-os tárhely limitet. Töröld valamelyik könyvet a feltöltéshez.',
            ], 403);
        }

        $file = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension());
        $title = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        $text = match ($extension) {
            'pdf' => $this->extractPdfText($file->getRealPath()),
            'epub' => $this->extractEpubText($file->getRealPath()),
            default => throw new \RuntimeException('Nem támogatott formátum.'),
        };

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
        foreach ($spineFiles as $name) {
            $content = $zip->getFromName($name);
            if ($content === false) {
                continue;
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
        $opfContent = $zip->getFromName($opfPath);
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

            $href = strtok($meta['href'], '#');

            if (isset($skipHrefs[$href])) {
                continue;
            }

            $fullPath = $opfDir !== '' ? $opfDir.'/'.$href : $href;
            $fullPath = $this->normalizePath($fullPath);

            if (! preg_match('/\.(html|htm|xhtml)$/i', $fullPath)) {
                continue;
            }

            // Skip by filename patterns common for covers/TOC
            $basename = strtolower(basename($fullPath));
            if (preg_match('/^(cover|toc|contents|nav|navigation|title[\-_]?page)/i', $basename)) {
                continue;
            }

            // Content-based skip: read file and check if it's a TOC page
            $content = $zip->getFromName($fullPath);
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

    private function findEpubOpfPath(\ZipArchive $zip): ?string
    {
        $container = $zip->getFromName('META-INF/container.xml');
        if ($container === false) {
            return null;
        }
        if (preg_match('/full-path="([^"]+\.opf)"/i', $container, $m)) {
            return $m[1];
        }

        return null;
    }

    /** @return string[] */
    private function tokenize(string $text): array
    {
        $cleaned = str_replace(['\u{2018}', '\u{2019}', '\u{2032}', "'"], ' ', $text);
        $cleaned = preg_replace('/[^a-zA-Z ]+/', ' ', $cleaned) ?? '';
        $words = preg_split('/\s+/', mb_strtolower(trim($cleaned))) ?: [];

        return array_values(array_filter($words, fn ($w) => strlen($w) >= 2));
    }
}
