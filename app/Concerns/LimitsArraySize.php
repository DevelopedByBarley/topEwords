<?php

namespace App\Concerns;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

trait LimitsArraySize
{
    /**
     * Rejects oversized arrays BEFORE the main validation runs.
     *
     * Laravel expands every `foo.*` rule per element when the validator is
     * built, at a cost that grows quadratically with the element count, so a
     * `max:` rule in the same rule list only fires after that work is done
     * (a 50 000-element body kept a worker busy for minutes: F9D-L1, F6-L2).
     * This check has no wildcard, so it stays linear.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, int>  $limits  field => maximum element count
     * @param  array<string, string>  $attributes
     *
     * @throws ValidationException
     */
    protected function ensureArraySizeWithinLimits(array $data, array $limits, array $attributes = []): void
    {
        $rules = collect($limits)
            ->map(fn (int $max) => ['sometimes', 'array', 'max:'.$max])
            ->all();

        Validator::make($data, $rules, [], $attributes)->validate();
    }
}
