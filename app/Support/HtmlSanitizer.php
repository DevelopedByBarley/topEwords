<?php

namespace App\Support;

use Dom\Element;
use Dom\HTMLDocument;

class HtmlSanitizer
{
    /** @var list<string> */
    public const ALLOWED_TAGS = [
        'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'del', 'ins', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'code', 'pre', 'a', 'mark', 'sub', 'sup', 'small', 'hr',
        'table', 'thead', 'tbody', 'tr', 'td', 'th',
    ];

    /**
     * @var list<string>
     */
    public const DROP_TAGS = [
        'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form',
        'link', 'meta', 'base', 'noscript', 'template',
    ];

    /** @var list<string> */
    public const ALLOWED_ATTRS = [
        'class', 'style', 'href', 'target', 'rel', 'colspan', 'rowspan',
    ];

    private const SAFE_URL = '/^(https?:|mailto:|tel:|#|\/)/i';

    private const UNSAFE_STYLE = '/expression\s*\(|javascript:|url\s*\(/i';

    public static function isSupported(): bool
    {
        return class_exists(HTMLDocument::class);
    }

    public static function clean(?string $html): ?string
    {
        if ($html === null || ! str_contains($html, '<') || ! self::isSupported()) {
            return $html;
        }

        $body = self::parse($html);
        $normalized = $body->innerHTML;

        self::sanitizeTree($body);
        $sanitized = $body->innerHTML;

        return $sanitized === $normalized ? $html : $sanitized;
    }

    private static function parse(string $html): Element
    {
        $document = HTMLDocument::createFromString('<!DOCTYPE html><html><body></body></html>', LIBXML_NOERROR);
        $document->body->innerHTML = $html;

        return $document->body;
    }

    private static function sanitizeTree(Element $root): void
    {
        foreach (iterator_to_array($root->querySelectorAll('*')) as $element) {
            $tag = strtolower($element->localName);

            if (in_array($tag, self::DROP_TAGS, true)) {
                $element->remove();

                continue;
            }

            if (! in_array($tag, self::ALLOWED_TAGS, true)) {
                $element->replaceWith(...iterator_to_array($element->childNodes));

                continue;
            }

            self::sanitizeAttributes($element, $tag);
        }
    }

    private static function sanitizeAttributes(Element $element, string $tag): void
    {
        foreach (iterator_to_array($element->attributes) as $attribute) {
            $name = strtolower($attribute->name);
            $value = trim($attribute->value);

            $isUnsafe = str_starts_with($name, 'on')
                || ! in_array($name, self::ALLOWED_ATTRS, true)
                || ($name === 'href' && ! preg_match(self::SAFE_URL, $value))
                || ($name === 'style' && preg_match(self::UNSAFE_STYLE, $value));

            if ($isUnsafe) {
                $element->removeAttribute($attribute->name);
            }
        }

        if ($tag === 'a' && $element->getAttribute('href')) {
            $element->setAttribute('rel', 'noopener noreferrer nofollow');
            $element->setAttribute('target', '_blank');
        }
    }
}
