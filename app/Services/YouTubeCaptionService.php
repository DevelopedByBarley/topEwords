<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class YouTubeCaptionService
{
    /** Sikeres átirat ennyi ideig él a videónkénti cache-ben. */
    private const CACHE_TTL_HOURS = 24;

    /**
     * Egy feliratfájlból legfeljebb ennyi byte-ot olvasunk be (CAP-2). A cél-URL
     * a YouTube saját válaszából jön (a user csak a 11 karakteres videó-ID-t
     * választja), ezért ez nem támadó-vezérelt vektor, hanem védelmi mélység:
     * a partner hibás/óriási válasza se tölthesse memóriába a workert.
     * 8 MB felirat több tíz órányi beszédnek felel meg — valós videó nem éri el.
     */
    private const MAX_CAPTION_BYTES = 8 * 1024 * 1024;

    /** „Nincs felirat" eredmény rövid negatív cache-e, hogy az ismételt próbálkozás se scrape-eljen. */
    private const MISS_CACHE_TTL_MINUTES = 15;

    /**
     * A caption-letöltés közben már lekért watch-oldalból kinyert cím, hogy a
     * fetchTranscript ne töltse le még egyszer ugyanazt az oldalt a címért.
     */
    private ?string $watchPageTitle = null;

    /**
     * Volt-e a jelenlegi fetchCaptions-futásban átmeneti (nem OK válasz vagy
     * megszakadt kapcsolat) hiba. Ha igen, az üres eredmény lehet, hogy csak a
     * YouTube átmeneti akadása miatt üres — ilyenkor nem negatív-cache-elünk (C2).
     */
    private bool $sawTransientError = false;

    /**
     * Extract the 11-character video id from any common YouTube URL form.
     */
    public function extractVideoId(string $url): ?string
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

    /**
     * Videónként cache-elt átirat (cím + szegmensek), userek közt megosztva —
     * ugyanahhoz a videóhoz naponta legfeljebb egyszer scrape-elünk. A definitív
     * „nincs felirat" eredmény rövid negatív cache-t kap; az átmeneti hálózati
     * hibát (ConnectionException stb.) nem cache-eljük, az újrapróbálható.
     *
     * @return array{title: ?string, segments: array<int, array{t: int, x: string}>}
     *
     * @throws \RuntimeException when no usable English captions are available
     */
    public function fetchTranscript(string $videoId): array
    {
        $cacheKey = "youtube:transcript:{$videoId}";

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        if (Cache::has("youtube:transcript-miss:{$videoId}")) {
            throw new \RuntimeException('Ehhez a videóhoz nem érhetők el angol feliratok, vagy a felirat nem feldolgozható.');
        }

        $this->watchPageTitle = null;

        try {
            $segments = $this->fetchCaptions($videoId);
        } catch (TransientCaptionException $e) {
            // Átmeneti YouTube-akadás: nem tudjuk, van-e felirat, ezért NEM
            // cache-elünk negatívan — a következő próbálkozás újra scrape-elhet (C2).
            throw $e;
        } catch (\RuntimeException $e) {
            Cache::put("youtube:transcript-miss:{$videoId}", true, now()->addMinutes(self::MISS_CACHE_TTL_MINUTES));

            throw $e;
        }

        $transcript = [
            'title' => $this->watchPageTitle ?? $this->fetchTitle($videoId),
            'segments' => $segments,
        ];

        Cache::put($cacheKey, $transcript, now()->addHours(self::CACHE_TTL_HOURS));

        return $transcript;
    }

    /**
     * Timestamped caption segments for a video, trying several strategies.
     *
     * @return array<int, array{t: int, x: string}>
     *
     * @throws \RuntimeException when no usable English captions are available
     */
    public function fetchCaptions(string $videoId): array
    {
        $this->sawTransientError = false;

        // Strategy 1: InnerTube API with multiple clients
        $segments = $this->fetchViaInnertube($videoId);
        if (! empty($segments)) {
            return $segments;
        }

        // Strategy 2: YouTube timedtext API
        $segments = $this->fetchViaTimedtextApi($videoId);
        if (! empty($segments)) {
            return $segments;
        }

        // Strategy 3: Scrape the watch page for a signed caption URL
        $segments = $this->fetchViaPageScraping($videoId);
        if (! empty($segments)) {
            return $segments;
        }

        // Ha valamelyik stratégia átmeneti hibába futott (nem OK válasz vagy
        // megszakadt kapcsolat), az üres eredmény lehet, hogy csak emiatt üres —
        // ezt újrapróbálhatóként jelezzük, hogy ne kerüljön negatív cache-be (C2).
        if ($this->sawTransientError) {
            throw new TransientCaptionException('A YouTube átmenetileg nem elérhető. Próbáld újra később.');
        }

        throw new \RuntimeException('Ehhez a videóhoz nem érhetők el angol feliratok, vagy a felirat nem feldolgozható.');
    }

    /**
     * Best-effort video title; null when the watch page is unavailable.
     */
    public function fetchTitle(string $videoId): ?string
    {
        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language' => 'en-US,en;q=0.9',
                ])
                ->get('https://www.youtube.com/watch?v='.$videoId);

            if (! $response->ok()) {
                return null;
            }

            return $this->parseWatchPageTitle($response->body());
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Video title from a watch page's HTML; null when it cannot be found.
     */
    private function parseWatchPageTitle(string $html): ?string
    {
        if (preg_match('/<meta\s+name="title"\s+content="([^"]+)"/', $html, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }

        if (preg_match('/<title>(.*?)<\/title>/s', $html, $m)) {
            $title = html_entity_decode(trim($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');

            return trim(preg_replace('/\s*-\s*YouTube\s*$/', '', $title) ?? $title);
        }

        return null;
    }

    /**
     * Flatten caption segments into plain text (for word analysis).
     *
     * @param  array<int, array{t: int, x: string}>  $segments
     */
    public function segmentsToText(array $segments): string
    {
        return implode(' ', array_map(fn ($s) => $s['x'], $segments));
    }

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function fetchViaInnertube(string $videoId): array
    {
        $androidUa = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';

        try {
            // Must extract the API key from the watch page — hardcoded keys return UNPLAYABLE
            $pageResponse = Http::timeout(20)
                ->withHeaders(['User-Agent' => $androidUa, 'Accept-Language' => 'en-US,en;q=0.9'])
                ->get('https://www.youtube.com/watch?v='.$videoId);

            if (! $pageResponse->ok()) {
                $this->sawTransientError = true;

                return [];
            }

            $this->watchPageTitle ??= $this->parseWatchPageTitle($pageResponse->body());

            if (! preg_match('/"INNERTUBE_API_KEY"\s*:\s*"([a-zA-Z0-9_-]+)"/', $pageResponse->body(), $keyMatch)) {
                return [];
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
                $this->sawTransientError = true;

                return [];
            }

            $tracks = $playerResponse->json('captions.playerCaptionsTracklistRenderer.captionTracks') ?? [];

            if (empty($tracks)) {
                return [];
            }

            $track = collect($tracks)->first(fn ($t) => str_starts_with($t['languageCode'] ?? '', 'en'))
                ?? $tracks[0];

            $captionUrl = $track['baseUrl'] ?? null;

            if (! $captionUrl) {
                return [];
            }

            // Try XML (default, no fmt) first — ANDROID returns timedtext XML with <p> tags
            foreach ([$captionUrl, $captionUrl.'&fmt=json3'] as $url) {
                $captionResponse = $this->fetchCaptionBody($url);

                if (! $captionResponse->ok() || mb_strlen($captionResponse->body()) < 20) {
                    if (! $captionResponse->ok()) {
                        $this->sawTransientError = true;
                    }

                    continue;
                }

                $segments = $this->parseCaptionBody($captionResponse->body());
                if (! empty($segments)) {
                    return $segments;
                }
            }
        } catch (ConnectionException) {
            $this->sawTransientError = true;
        }

        return [];
    }

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function fetchViaTimedtextApi(string $videoId): array
    {
        $base = 'https://www.youtube.com/api/timedtext?v='.urlencode($videoId).'&lang=en';

        foreach (['&fmt=json3', '&fmt=vtt', ''] as $fmtParam) {
            try {
                $response = Http::timeout(10)
                    ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'])
                    ->get($base.$fmtParam);
            } catch (ConnectionException) {
                $this->sawTransientError = true;

                continue;
            }

            if (! $response->ok() || mb_strlen($response->body()) < 20) {
                if (! $response->ok()) {
                    $this->sawTransientError = true;
                }

                continue;
            }

            $segments = $this->parseCaptionBody($response->body());
            if (! empty($segments)) {
                return $segments;
            }
        }

        return [];
    }

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function fetchViaPageScraping(string $videoId): array
    {
        try {
            $pageResponse = Http::timeout(20)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept-Language' => 'en-US,en;q=0.9',
                ])
                ->get('https://www.youtube.com/watch?v='.$videoId);

            if (! $pageResponse->ok()) {
                $this->sawTransientError = true;

                return [];
            }

            $this->watchPageTitle ??= $this->parseWatchPageTitle($pageResponse->body());

            $captionUrl = $this->extractCaptionUrl($pageResponse->body());
            if ($captionUrl === null) {
                return [];
            }

            $json3Url = preg_replace('/([?&])fmt=[^&]*/', '$1fmt=json3', $captionUrl);
            if (! str_contains($json3Url ?? '', 'fmt=')) {
                $json3Url = $captionUrl.(str_contains($captionUrl, '?') ? '&' : '?').'fmt=json3';
            }

            foreach ([$json3Url, $captionUrl] as $url) {
                $response = $this->fetchCaptionBody($url);
                if (! $response->ok() || mb_strlen($response->body()) < 20) {
                    if (! $response->ok()) {
                        $this->sawTransientError = true;
                    }

                    continue;
                }

                $segments = $this->parseCaptionBody($response->body());
                if (! empty($segments)) {
                    return $segments;
                }
            }
        } catch (ConnectionException) {
            $this->sawTransientError = true;
        }

        return [];
    }

    /**
     * Feliratfájl letöltése MAX_CAPTION_BYTES sapkával (CAP-2).
     *
     * A sapkát a curl progress-callback érvényesíti, vagyis MENET KÖZBEN szakítja
     * meg a letöltést — a `Http::get()` utáni méret-ellenőrzés már későn jönne,
     * a teljes válasz addigra memóriában lenne (ugyanez a minta, mint a
     * TextAnalysisController::safeFetch sizeGuardja).
     *
     * A megszakítást a curl ConnectionException-ként dobja; a hívók már ma is
     * kezelik (a külső try/catch `sawTransientError`-t állít), ezért a túl nagy
     * felirat ugyanúgy „nincs használható felirat" ágra fut, mint bármely más
     * letöltési hiba — nem szivárog ki kezeletlen 500-asként.
     *
     * @throws \RuntimeException ha a letöltött törzs átlépi a MAX_CAPTION_BYTES-t
     */
    private function fetchCaptionBody(string $url): Response
    {
        $sizeGuard = function ($handle, int $downloadTotal, int $downloaded): int {
            return ($downloadTotal > self::MAX_CAPTION_BYTES || $downloaded > self::MAX_CAPTION_BYTES) ? 1 : 0;
        };

        $response = Http::timeout(15)
            ->withOptions(['curl' => [
                CURLOPT_NOPROGRESS => false,
                CURLOPT_PROGRESSFUNCTION => $sizeGuard,
            ]])
            ->get($url);

        // Védőháló a curl-szintű sapka mellé (ugyanaz a minta, mint a
        // TextAnalysisController::fetchWebpageText-ben): a progress-callback csak
        // valódi kapcsolaton fut, fake-elt HTTP kliens alatt nem — enélkül a sapka
        // se tesztelhető, se érvényes nem lenne minden úton.
        if (strlen($response->body()) > self::MAX_CAPTION_BYTES) {
            throw new \RuntimeException('A felirat túl nagy a feldolgozáshoz.');
        }

        return $response;
    }

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function parseCaptionBody(string $body): array
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

        return [];
    }

    /**
     * Caption timestamp (HH:MM:SS.mmm or MM:SS.mmm) → whole seconds.
     */
    private function captionTimestampToSeconds(string $ts): int
    {
        if (preg_match('/(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,]\d+)?/', $ts, $m)) {
            return ((int) ($m[1] ?: 0)) * 3600 + ((int) $m[2]) * 60 + (int) $m[3];
        }

        return 0;
    }

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function parseVttCaptions(string $body): array
    {
        $lines = preg_split('/\r?\n/', $body) ?: [];
        $segments = [];
        $prev = '';
        $pastHeader = false;
        $curStart = 0;
        $curTexts = [];

        $flush = function () use (&$segments, &$curTexts, &$prev, &$curStart): void {
            if (empty($curTexts)) {
                return;
            }

            $text = trim(preg_replace('/\s+/', ' ', implode(' ', $curTexts)) ?? '');
            $curTexts = [];

            if ($text === '' || $text === $prev) {
                return;
            }

            $segments[] = ['t' => $curStart, 'x' => $text];
            $prev = $text;
        };

        foreach ($lines as $line) {
            $line = trim($line);

            // The VTT header ends at the first blank line
            if (! $pastHeader) {
                if ($line === '') {
                    $pastHeader = true;
                }

                continue;
            }

            // A timestamp line starts a new cue
            if (str_contains($line, '-->')) {
                $flush();
                $curStart = $this->captionTimestampToSeconds(explode('-->', $line)[0]);

                continue;
            }

            // Blank line ends the current cue; cue IDs (digits only) are skipped
            if ($line === '') {
                $flush();

                continue;
            }

            if (preg_match('/^\d+$/', $line)) {
                continue;
            }

            // Strip inline timing tags (<00:00:00.000>, <c>, <c.color_white>, etc.)
            $text = preg_replace('/<[^>]+>/', '', $line) ?? $line;
            $text = html_entity_decode(trim($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $text = preg_replace('/\[[^\]]*\]/', '', $text) ?? $text;
            $text = trim(preg_replace('/\s+/', ' ', $text) ?? $text);

            if ($text !== '') {
                $curTexts[] = $text;
            }
        }

        $flush();

        return $segments;
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

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function parseJson3Captions(mixed $data): array
    {
        if (! is_array($data) || empty($data['events'])) {
            return [];
        }

        $segments = [];
        $prev = '';
        foreach ($data['events'] as $event) {
            if (! isset($event['segs'])) {
                continue;
            }
            $text = implode('', array_column($event['segs'], 'utf8'));
            // Remove sound annotations like [Music], [Applause], [Laughter], etc.
            $text = preg_replace('/\[[^\]]*\]/', '', $text) ?? $text;
            $text = trim(preg_replace('/\s+/', ' ', trim($text)) ?? '');
            if ($text === '' || $text === $prev) {
                continue;
            }
            $segments[] = ['t' => (int) round(((int) ($event['tStartMs'] ?? 0)) / 1000), 'x' => $text];
            $prev = $text;
        }

        return $segments;
    }

    /**
     * @return array<int, array{t: int, x: string}>
     */
    private function parseXmlCaptions(string $body): array
    {
        // YouTube returns either <text start="12.3"> (older) or <p t="12300"> (ANDROID InnerTube) tags
        if (! preg_match_all('/<(?:text|p)([^>]*)>(.*?)<\/(?:text|p)>/s', $body, $matches, PREG_SET_ORDER)) {
            return [];
        }

        $segments = [];
        $prev = '';
        foreach ($matches as $m) {
            $text = trim(html_entity_decode(strip_tags($m[2]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $text = trim(preg_replace('/\[[^\]]*\]/', '', $text) ?? $text);
            $text = trim(preg_replace('/\s+/', ' ', $text) ?? $text);

            if ($text === '' || $text === $prev) {
                continue;
            }

            $start = 0;
            if (preg_match('/\bstart="([\d.]+)"/', $m[1], $sm)) {
                $start = (int) round((float) $sm[1]);
            } elseif (preg_match('/\bt="(\d+)"/', $m[1], $tm)) {
                $start = (int) round(((int) $tm[1]) / 1000);
            }

            $segments[] = ['t' => $start, 'x' => $text];
            $prev = $text;
        }

        return $segments;
    }
}
