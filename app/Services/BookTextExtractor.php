<?php

namespace App\Services;

class BookTextExtractor
{
    private const DROP_ELEMENT_PATTERN = '#<(head|script|style|figure|figcaption|nav|header|footer|aside|svg|math)(?=[\s/>])[^>]*>.*?</\1\s*>#si';

    private const VOID_ELEMENT_PATTERN = '#<(?:img|hr|input|source|col|link|meta)(?=[\s/>])[^>]*>#si';

    private const LINE_BREAK_PATTERN = '#<br(?=[\s/>])[^>]*>#i';

    private const BLOCK_END_PATTERN = '#</(?:p|div|li|h[1-6]|blockquote|section|article|tr|td|th|dd|dt|pre)\s*>#i';

    private const MAX_ENTITY_DECODE_ROUNDS = 3;

    private const MIN_LINE_LENGTH = 15;

    private const LEGAL_LINE_PATTERN = '/all rights reserved|\bisbn\b|cataloging-in-publication|printed in the united states|first edition|a tor book|work of fiction|library of congress/i';

    private const MAX_LEGAL_LINE_LENGTH = 200;

    /**
     * @var list<string>
     */
    private const GUTENBERG_START_MARKERS = [
        'START OF THE PROJECT GUTENBERG EBOOK',
        'START OF THIS PROJECT GUTENBERG EBOOK',
    ];

    /** @var list<string> */
    private const GUTENBERG_END_MARKERS = [
        'END OF THE PROJECT GUTENBERG EBOOK',
        'END OF THIS PROJECT GUTENBERG EBOOK',
    ];

    public function extract(string $html): string
    {
        $text = $this->toBlockAwareText($html);
        $text = $this->decodeEntities($text);
        $text = $this->trimGutenbergLicense($text);

        return $this->cleanLines($text);
    }

    private function toBlockAwareText(string $html): string
    {
        $html = preg_replace(self::DROP_ELEMENT_PATTERN, ' ', $html) ?? $html;
        $html = preg_replace(self::VOID_ELEMENT_PATTERN, ' ', $html) ?? $html;

        $html = preg_replace('/\s+/', ' ', $html) ?? $html;

        $html = preg_replace(self::LINE_BREAK_PATTERN, "\n", $html) ?? $html;
        $html = preg_replace(self::BLOCK_END_PATTERN, "\n", $html) ?? $html;

        return strip_tags($html);
    }

    private function decodeEntities(string $text): string
    {
        for ($round = 0; $round < self::MAX_ENTITY_DECODE_ROUNDS; $round++) {
            $decoded = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');

            if ($decoded === $text) {
                break;
            }

            $text = $decoded;
        }

        return $text;
    }

    private function trimGutenbergLicense(string $text): string
    {
        foreach (self::GUTENBERG_START_MARKERS as $marker) {
            $position = stripos($text, $marker);

            if ($position === false) {
                continue;
            }

            $lineEnd = strpos($text, "\n", $position);
            $text = $lineEnd === false ? '' : substr($text, $lineEnd + 1);
            break;
        }

        foreach (self::GUTENBERG_END_MARKERS as $marker) {
            $position = stripos($text, $marker);

            if ($position === false) {
                continue;
            }

            $lineStart = strrpos(substr($text, 0, $position), "\n");
            $text = $lineStart === false ? '' : substr($text, 0, $lineStart);
            break;
        }

        return $text;
    }

    private function cleanLines(string $text): string
    {
        $clean = [];

        foreach (explode("\n", $text) as $line) {
            $line = trim($line);

            if ($line === '') {
                continue;
            }

            if (preg_match('/^https?:\/\/\S+$/i', $line) || preg_match('/^www\.\S+$/i', $line)) {
                continue;
            }

            if (preg_match('/^\[.*\]$/', $line)) {
                continue;
            }

            if (mb_strlen($line) <= self::MAX_LEGAL_LINE_LENGTH && preg_match(self::LEGAL_LINE_PATTERN, $line)) {
                continue;
            }

            $letterCount = preg_match_all('/[a-zA-Z]/u', $line);
            $totalCount = mb_strlen($line);
            if ($totalCount > 0 && ($letterCount / $totalCount) < 0.5) {
                continue;
            }

            if (mb_strlen($line) < self::MIN_LINE_LENGTH
                && ! preg_match('/^["“”‘’«—]/u', $line)
                && ! preg_match('/[.!?]["”’»)\]]?$/u', $line)) {
                continue;
            }

            $clean[] = $line;
        }

        $result = implode("\n", $clean);

        $result = preg_replace('/(\s*\n\s*){3,}/', "\n\n", $result) ?? $result;
        $result = preg_replace('/[ \t]+/', ' ', $result) ?? $result;

        return trim($result);
    }
}
