<?php

namespace App\Services;

use Dom\Element;
use Dom\HTMLDocument;

class ArticleTextExtractor
{
    /**
     * @var list<string>
     */
    private const DROP_SELECTORS = [
        'script', 'style', 'noscript', 'template', 'svg', 'iframe', 'object', 'embed',
        'nav', 'header', 'footer', 'aside', 'form', 'button', 'select', 'textarea',
        '[role=navigation]', '[role=banner]', '[role=contentinfo]', '[role=complementary]',
        '[role=search]', '[aria-hidden=true]', '[hidden]',
    ];

    private const DROP_PATTERN = '/(^|[-_\s])(nav|navbar|menu|sidebar|footer|header|comments?|related|recommend|share|social|cookie|consent|gdpr|banner|promo|subscribe|newsletter|advert|ads?|sponsor|breadcrumb|pagination|tag-?list|author-?box|byline|toolbar|widget|popup|modal|overlay|skip)([-_\s]|$)/i';

    private const STRUCTURAL_TAGS = ['HTML', 'HEAD', 'BODY'];

    /**
     * @var list<string>
     */
    private const SCORE_ROOT_TAGS = ['HTML', 'HEAD'];

    private const BLOCK_SELECTOR = 'p, li, blockquote, h1, h2, h3, h4, h5, h6, dd, dt, pre, td, figcaption';

    private const SCORED_SELECTOR = 'p, li, blockquote, h1, h2, h3';

    private const MIN_BLOCK_LENGTH = 25;

    private const MAX_LINK_DENSITY = 0.5;

    private const MAX_OPENING_TAGS = 25000;

    private const MAX_ATTRIBUTE_LENGTH = 512;

    private const MAX_SCORE_DEPTH = 8;

    public function extract(string $html): string
    {
        if (preg_match_all('/<[a-zA-Z]/', $html) > self::MAX_OPENING_TAGS) {
            return $this->fallbackText($html);
        }

        $document = HTMLDocument::createFromString($html, LIBXML_NOERROR);

        if ($document->body === null) {
            return '';
        }

        $this->dropBoilerplate($document);

        $body = $document->body;

        if ($body === null) {
            return '';
        }

        return $this->toText($this->pickMainContent($document) ?? $body);
    }

    private function fallbackText(string $html): string
    {
        $html = preg_replace('#<(script|style|noscript|template)\b[^>]*>.*?</\1\s*>#si', ' ', $html) ?? $html;
        $html = preg_replace('#<br\s*/?>|</(p|div|li|h[1-6]|section|article|tr|blockquote|dd|dt|td)\s*>#i', "\n", $html) ?? $html;

        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $lines = array_filter(
            array_map(
                fn (string $line): string => $this->normalizeWhitespace($line),
                explode("\n", $text),
            ),
            fn (string $line): bool => $line !== '',
        );

        return implode("\n\n", $lines);
    }

    private function dropBoilerplate(HTMLDocument $document): void
    {
        foreach (self::DROP_SELECTORS as $selector) {
            foreach (iterator_to_array($document->querySelectorAll($selector)) as $node) {
                $node->parentNode?->removeChild($node);
            }
        }

        $bodyLength = mb_strlen($this->normalizeWhitespace($document->body?->textContent ?? ''));

        foreach (iterator_to_array($document->querySelectorAll('[class],[id]')) as $node) {
            if (! $node instanceof Element || ! $node->isConnected) {
                continue;
            }

            if (in_array($node->nodeName, self::STRUCTURAL_TAGS, true)) {
                continue;
            }

            if (! $this->looksLikeBoilerplate($node)) {
                continue;
            }

            if ($bodyLength > 0 && mb_strlen($this->normalizeWhitespace($node->textContent)) / $bodyLength > 0.5) {
                continue;
            }

            $node->parentNode?->removeChild($node);
        }
    }

    private function looksLikeBoilerplate(Element $node): bool
    {
        $haystack = mb_substr(
            $node->getAttribute('class').' '.$node->getAttribute('id'),
            0,
            self::MAX_ATTRIBUTE_LENGTH,
        );

        return preg_match(self::DROP_PATTERN, $haystack) === 1;
    }

    private function pickMainContent(HTMLDocument $document): ?Element
    {
        /** @var array<int, array{node: Element, score: float}> $scores */
        $scores = [];

        foreach ($document->querySelectorAll(self::SCORED_SELECTOR) as $block) {
            $text = $this->normalizeWhitespace($block->textContent);
            $length = mb_strlen($text);

            if ($length < self::MIN_BLOCK_LENGTH || $this->linkDensity($block) >= self::MAX_LINK_DENSITY) {
                continue;
            }

            $depth = 0;

            for ($node = $block->parentNode; $node instanceof Element && $depth < self::MAX_SCORE_DEPTH; $node = $node->parentNode) {
                if (in_array($node->nodeName, self::SCORE_ROOT_TAGS, true)) {
                    break;
                }

                $key = spl_object_id($node);
                $scores[$key] ??= ['node' => $node, 'score' => 0.0];

                $scores[$key]['score'] += $length / ($depth + 1);
                $depth++;
            }
        }

        $best = null;
        $bestScore = 0.0;

        foreach ($scores as $candidate) {
            if ($candidate['score'] <= $bestScore) {
                continue;
            }

            if ($this->linkDensity($candidate['node']) >= 0.35) {
                continue;
            }

            $best = $candidate['node'];
            $bestScore = $candidate['score'];
        }

        return $best;
    }

    private function linkDensity(Element $node): float
    {
        $total = mb_strlen($this->normalizeWhitespace($node->textContent));

        if ($total === 0) {
            return 1.0;
        }

        $linked = 0;

        foreach ($node->querySelectorAll('a') as $anchor) {
            $linked += mb_strlen($this->normalizeWhitespace($anchor->textContent));
        }

        return $linked / $total;
    }

    private function toText(Element $root): string
    {
        $paragraphs = [];

        foreach ($root->querySelectorAll(self::BLOCK_SELECTOR) as $node) {
            if ($node->querySelector(self::BLOCK_SELECTOR) !== null) {
                continue;
            }

            $text = $this->normalizeWhitespace($node->textContent);

            if ($text === '' || $this->linkDensity($node) >= self::MAX_LINK_DENSITY) {
                continue;
            }

            $paragraphs[] = $text;
        }

        if ($paragraphs === []) {
            return $this->normalizeWhitespace($root->textContent);
        }

        return implode("\n\n", $paragraphs);
    }

    private function normalizeWhitespace(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }
}
