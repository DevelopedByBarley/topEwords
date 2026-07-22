<?php

namespace App\Concerns;

use App\Services\WordFormVariants;
use App\Services\WordStatusFormExpander;

/**
 * Az extra_forms oszlop normalizálása mentés előtt.
 *
 * A mező a lemmatizáláskor eldobott, de a felhasználó által beírt eredeti
 * alakokat tárolja (pl. a "successful" lemmához a "successfully" határozószót),
 * '/'-szeparálva — azonos formátumban a többi alak-oszloppal. Mentés előtt
 * kisbetűsítjük, deduplikáljuk, és kihagyjuk azokat az alakokat, amelyeket a szó
 * (lemma) vagy egy másik alak-oszlop már lefed, hogy ne tároljunk redundanciát.
 *
 * A modellt használó osztály a bootoláskor hívja meg a saving eseményre kötést.
 */
trait NormalizesExtraForms
{
    protected static function bootNormalizesExtraForms(): void
    {
        static::saving(function ($model): void {
            if (! $model->isDirty('extra_forms')) {
                return;
            }

            $model->extra_forms = static::normalizeExtraForms($model);
        });
    }

    protected static function normalizeExtraForms(object $model): ?string
    {
        $raw = (string) ($model->extra_forms ?? '');

        if (trim($raw) === '') {
            return null;
        }

        // A szó (lemma) és minden MÁS alak-oszlop már lefedett alakjai — ezeket
        // nem duplikáljuk az extra_forms-ba.
        $covered = [mb_strtolower(trim((string) $model->word))];

        foreach (WordStatusFormExpander::FORM_COLUMNS as $column) {
            if ($column === 'extra_forms') {
                continue;
            }

            foreach (WordFormVariants::split($model->{$column} ?? null) as $variant) {
                $covered[] = mb_strtolower($variant);
            }
        }

        $forms = [];

        foreach (WordFormVariants::split($raw) as $variant) {
            $lower = mb_strtolower($variant);

            if ($lower === '' || in_array($lower, $covered, true) || in_array($lower, $forms, true)) {
                continue;
            }

            $forms[] = $lower;
        }

        return $forms === [] ? null : implode('/', $forms);
    }
}
