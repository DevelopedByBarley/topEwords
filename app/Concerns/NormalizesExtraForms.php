<?php

namespace App\Concerns;

use App\Services\WordFormVariants;
use App\Services\WordStatusFormExpander;

trait NormalizesExtraForms
{
    private const FORM_PATTERN = "/^[\pL][\pL'\- ]{0,99}$/u";

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
            $lower = mb_strtolower(trim((string) preg_replace('/\s+/', ' ', $variant)));

            if (preg_match(self::FORM_PATTERN, $lower) !== 1) {
                continue;
            }

            if (in_array($lower, $covered, true) || in_array($lower, $forms, true)) {
                continue;
            }

            $forms[] = $lower;
        }

        return $forms === [] ? null : implode('/', $forms);
    }
}
