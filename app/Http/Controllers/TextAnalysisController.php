<?php

namespace App\Http\Controllers;

use App\Models\UserCustomWord;
use App\Models\Word;
use App\Services\AchievementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;

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

        // Check user's custom words first
        $customWord = $user->customWords()->whereRaw('LOWER(word) = ?', [$raw])->first();
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

        // Include user's custom words in the analysis
        $customWords = UserCustomWord::where('user_id', $user->id)
            ->whereIn('word', $uniqueTokens)
            ->get(['id', 'word', 'status']);

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

        $customWordMap = $customWords->keyBy(fn ($w) => mb_strtolower($w->word));

        foreach ($uniqueTokens as $token) {
            $frequency = $tokenFrequencies[$token] ?? 1;

            // Custom words take priority over the main word list
            if (isset($customWordMap[$token])) {
                $customWord = $customWordMap[$token];
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
        $ytDlp = $this->findYtDlp();

        if ($ytDlp === null) {
            throw new \RuntimeException('A yt-dlp eszköz nem található a szerveren.');
        }

        $outTemplate = sys_get_temp_dir().'/ytcap_'.$videoId;
        $url = 'https://www.youtube.com/watch?v='.$videoId;

        $cmd = sprintf(
            '%s --js-runtimes node --remote-components ejs:github --write-auto-subs --no-write-subs --skip-download --sub-langs en --sub-format json3 -o %s %s 2>&1',
            escapeshellarg($ytDlp),
            escapeshellarg($outTemplate),
            escapeshellarg($url)
        );

        exec($cmd, $output, $exitCode);

        // yt-dlp writes e.g. /tmp/ytcap_{id}.en.json3
        $files = glob($outTemplate.'*.json3');
        $captionFile = $files[0] ?? null;

        if ($captionFile === null || ! file_exists($captionFile)) {
            $outputStr = implode("\n", $output);

            if (str_contains($outputStr, 'not available') || str_contains($outputStr, 'unavailable')) {
                throw new \RuntimeException('A videó nem érhető el a szerver régiójából.');
            }

            if (str_contains($outputStr, 'no subtitles') || str_contains($outputStr, 'No subtitles')) {
                throw new \RuntimeException('Ehhez a videóhoz nem érhetők el angol feliratok.');
            }

            throw new \RuntimeException('A felirat letöltése sikertelen.');
        }

        try {
            $data = json_decode(file_get_contents($captionFile), true);
            $text = $this->parseJson3Captions($data ?? []);
        } finally {
            @unlink($captionFile);
        }

        if ($text === '') {
            throw new \RuntimeException('A felirat üres.');
        }

        return $text;
    }

    private function findYtDlp(): ?string
    {
        foreach (['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp'] as $path) {
            if (file_exists($path) && is_executable($path)) {
                return $path;
            }
        }

        exec('which yt-dlp 2>/dev/null', $out);

        return $out[0] ?? null;
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
        // Regex-based extraction avoids simplexml failing on malformed XML or HTML entities
        if (! preg_match_all('/<text[^>]*>(.*?)<\/text>/s', $body, $matches)) {
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

    /** @return string[] */
    private function tokenize(string $text): array
    {
        $cleaned = str_replace(['\u{2018}', '\u{2019}', '\u{2032}', "'"], ' ', $text);
        $cleaned = preg_replace('/[^a-zA-Z ]+/', ' ', $cleaned) ?? '';
        $words = preg_split('/\s+/', mb_strtolower(trim($cleaned))) ?: [];

        return array_values(array_filter($words, fn ($w) => strlen($w) >= 2));
    }
}
