<?php

namespace App\Concerns;

use Illuminate\Support\Facades\Validator;

trait LimitsArraySize
{
    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, int>  $limits
     * @param  array<string, string>  $attributes
     */
    protected function ensureArraySizeWithinLimits(array $data, array $limits, array $attributes = []): void
    {
        $rules = collect($limits)
            ->map(fn (int $max) => ['sometimes', 'array', 'max:'.$max])
            ->all();

        Validator::make($data, $rules, [], $attributes)->validate();
    }
}
