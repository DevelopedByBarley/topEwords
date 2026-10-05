<?php

namespace App\Services;

use Illuminate\Contracts\Database\Query\Builder;

class WordFormVariants
{
    /**
     * @return array<int, string>
     */
    public static function split(?string $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        return array_values(array_filter(
            array_map(trim(...), explode('/', $value)),
            fn (string $variant): bool => $variant !== '',
        ));
    }

    /**
     * @param  array<int, string|null>  $values
     * @return array<int, string>
     */
    public static function splitAll(array $values): array
    {
        $variants = [];

        foreach ($values as $value) {
            foreach (self::split($value) as $variant) {
                $variants[] = $variant;
            }
        }

        return array_values(array_unique($variants));
    }

    /**
     * @param  Builder|\Illuminate\Contracts\Database\Eloquent\Builder  $query
     */
    public static function orWhereFormMatches(object $query, string $column, string $lower): void
    {
        $like = addcslashes($lower, '%_\\');

        $query->orWhere(function ($q) use ($column, $lower, $like): void {
            $q->whereRaw("LOWER({$column}) = ?", [$lower])
                ->orWhereRaw("LOWER({$column}) LIKE ?", ["{$like}/%"])
                ->orWhereRaw("LOWER({$column}) LIKE ?", ["%/{$like}"])
                ->orWhereRaw("LOWER({$column}) LIKE ?", ["%/{$like}/%"]);
        });
    }
}
