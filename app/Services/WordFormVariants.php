<?php

namespace App\Services;

use Illuminate\Contracts\Database\Query\Builder;

/**
 * A '/'-szeparált alternatív szóalakok közös kezelése.
 *
 * Egyes szavaknak több elfogadott alakja van ugyanarra a ragozásra (pl. a "get"
 * past participle-je "got/gotten", a "be" múlt ideje "was/were"). Ezek egyetlen
 * oszlopban, '/'-szeparálva tárolódnak; az első változat az elsődleges (a
 * megjelenítés ezt mutatja). Minden szóalak-egyeztetőnek változatonként kell
 * illesztenie, különben a "gotten" keresés nem találná meg a "got/gotten" sort.
 */
class WordFormVariants
{
    /**
     * Egy tárolt szóalak-mező '/'-szeparált változatai, trimmelve, üresek nélkül.
     *
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
     * Több mező összes változata egyetlen lapos, deduplikált listában.
     *
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
     * OR-feltétel a lekérdezéshez: a (kisbetűs) keresett alak egyezik-e az oszlop
     * teljes értékével VAGY annak bármely '/'-szeparált változatával. LOWER+LIKE
     * alapú, MySQL-en és SQLite-on egyaránt működik; a LIKE-metakarakterek
     * escape-elve. Az oszlopnév csak kódból jövő konstans lehet, user-input soha.
     *
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
