<?php

namespace App\Services;

class WordStatusFormExpander
{
    /**
     * @var array<int, string>
     */
    public const FORM_COLUMNS = [
        'form_base', 'verb_past', 'verb_past_participle', 'verb_present_participle',
        'verb_third_person', 'noun_plural', 'adj_comparative', 'adj_superlative',
        'extra_forms',
    ];

    /**
     * @return array<int, string>
     */
    public function formsFor(object $row): array
    {
        $word = (string) $row->word;
        $forms = [];

        $columnValues = array_map(fn ($column) => $row->{$column} ?? null, self::FORM_COLUMNS);

        if (str_contains($word, ' ')) {
            $forms[] = mb_strtolower($word);

            foreach (WordFormVariants::splitAll($columnValues) as $variant) {
                if (str_contains($variant, ' ')) {
                    $forms[] = mb_strtolower(trim((string) preg_replace('/\s+/', ' ', $variant)));
                }
            }
        } else {
            foreach (WordFormVariants::splitAll([$word, ...$columnValues]) as $variant) {
                if (! str_contains($variant, ' ')) {
                    $forms[] = mb_strtolower($variant);
                }
            }
        }

        return array_values(array_unique($forms));
    }

    /**
     * @param  iterable<int, object>  $rows
     * @return array<string, string>
     */
    public function mapFrom(iterable $rows): array
    {
        $statuses = [];

        foreach ($rows as $row) {
            foreach ($this->formsFor($row) as $index => $form) {
                if ($index === 0) {
                    $statuses[$form] = $row->status;
                } else {
                    $statuses[$form] ??= $row->status;
                }
            }
        }

        return $statuses;
    }
}
