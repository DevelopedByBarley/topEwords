<?php

namespace App\Services;

use App\Models\AiWordCache;
use Illuminate\Support\Str;

class AiCacheService
{
    /**
     * @param  callable(): array{ok: bool, data: mixed, error: string, model?: string}  $generator
     * @param  (callable(array<string, mixed>): bool)|null  $isCacheable
     * @return array{ok: bool, data: mixed, error: string, model?: string}
     */
    public function remember(string $task, string $word, int $promptVersion, string $model, callable $generator, ?callable $isCacheable = null): array
    {
        $key = $this->key($task, $word, $promptVersion);

        if ($cached = AiWordCache::firstWhere('cache_key', $key)) {
            return ['ok' => true, 'data' => $cached->response, 'error' => ''];
        }

        $result = $generator();

        $wellFormed = ($result['ok'] ?? false) === true && is_array($result['data'] ?? null);

        if ($wellFormed && ($isCacheable === null || $isCacheable($result['data']))) {
            AiWordCache::updateOrCreate(
                ['cache_key' => $key],
                [
                    'task' => $task,
                    'word' => Str::lower($word),
                    'prompt_version' => $promptVersion,
                    'model' => $result['model'] ?? $model,
                    'response' => $result['data'],
                ],
            );
        }

        return $result;
    }

    private function key(string $task, string $word, int $promptVersion): string
    {
        return $task.':'.Str::lower($word).':en:v'.$promptVersion;
    }
}
