<?php

namespace App\Services;

use App\Models\Word;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class WordFormMapService
{
    private const TTL_SECONDS = 86400;

    private const CACHE_KEY = 'word_form_map';

    private const LOCK_KEY = 'word_form_map:rebuild';

    private const LOCK_SECONDS = 60;

    private const LOCK_WAIT_SECONDS = 10;

    /**
     * @var array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}|null
     */
    private ?array $memo = null;

    /**
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}
     */
    public function map(): array
    {
        return $this->memo ??= $this->loadOrRebuild();
    }

    /**
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}
     */
    private function loadOrRebuild(): array
    {
        $fingerprint = $this->fingerprint();

        if (($cached = $this->cachedMap($fingerprint)) !== null) {
            return $cached;
        }

        try {
            return Cache::lock(self::LOCK_KEY, self::LOCK_SECONDS)->block(
                self::LOCK_WAIT_SECONDS,
                function () use ($fingerprint): array {
                    if (($cached = $this->cachedMap($fingerprint)) !== null) {
                        return $cached;
                    }

                    $map = $this->build();

                    Cache::put(self::CACHE_KEY, ['fingerprint' => $fingerprint, 'map' => $map], self::TTL_SECONDS);

                    return $map;
                },
            );
        } catch (LockTimeoutException) {
            return $this->build();
        }
    }

    /**
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}|null
     */
    private function cachedMap(string $fingerprint): ?array
    {
        $cached = Cache::get(self::CACHE_KEY);

        if (! is_array($cached) || ($cached['fingerprint'] ?? null) !== $fingerprint || ! is_array($cached['map'] ?? null)) {
            return null;
        }

        return $cached['map'];
    }

    private function fingerprint(): string
    {
        $state = DB::table('words')
            ->selectRaw('COUNT(*) AS total, COALESCE(MAX(id), 0) AS max_id, COALESCE(MAX(updated_at), 0) AS last_change')
            ->first();

        return "{$state->total}:{$state->max_id}:{$state->last_change}";
    }

    /**
     * @return array{forms: array<string, int>, words: array<int, array{word: string, rank: int|null, meaning_hu: string|null}>}
     */
    private function build(): array
    {
        $forms = [];
        $words = [];

        Word::query()
            ->select(['id', 'word', 'rank', 'meaning_hu', ...WordStatusFormExpander::FORM_COLUMNS])
            ->orderBy('id')
            ->chunkById(2000, function ($chunk) use (&$forms, &$words): void {
                foreach ($chunk as $word) {
                    $words[$word->id] = [
                        'word' => $word->word,
                        'rank' => $word->rank,
                        'meaning_hu' => $word->meaning_hu,
                    ];

                    $columnValues = array_map(
                        fn (string $column) => $word->{$column},
                        WordStatusFormExpander::FORM_COLUMNS,
                    );

                    foreach (
                        WordFormVariants::splitAll([$word->word, ...$columnValues]) as $form
                    ) {
                        $forms[mb_strtolower($form)] ??= $word->id;
                    }
                }
            });

        return ['forms' => $forms, 'words' => $words];
    }
}
