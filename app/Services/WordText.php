<?php

namespace App\Services;

class WordText
{
    /**
     * @var array<int, string>
     */
    private const TYPOGRAPHIC_APOSTROPHES = ["\u{2018}", "\u{2019}", "\u{2032}"];

    public static function normalizeApostrophes(string $word): string
    {
        return str_replace(self::TYPOGRAPHIC_APOSTROPHES, "'", $word);
    }

    /**
     * @return array<int, string>
     */
    public static function apostropheVariants(string $word): array
    {
        $normalized = self::normalizeApostrophes($word);
        $variants = [$normalized];

        foreach (self::TYPOGRAPHIC_APOSTROPHES as $apostrophe) {
            $variants[] = str_replace("'", $apostrophe, $normalized);
        }

        return array_values(array_unique($variants));
    }
}
