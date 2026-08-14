<?php

namespace App\Services;

use Illuminate\Support\Collection;

class WordPageMarkers
{
    private Collection $markedKeys;

    public function __construct(
        Collection $markedIds,
        private Collection $orderedIds,
        private int $perPage,
    ) {
        $this->markedKeys = $markedIds->flip();
    }

    public function markedPages(): array
    {
        if ($this->markedKeys->isEmpty()) {
            return [];
        }

        return $this->orderedIds
            ->map(fn (int $id, int $index): ?int => $this->markedKeys->has($id)
                ? intdiv($index, $this->perPage) + 1
                : null)
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    public function completedPages(): array
    {
        if ($this->markedKeys->isEmpty()) {
            return [];
        }

        return $this->orderedIds
            ->chunk($this->perPage)
            ->map(fn (Collection $chunk, int $index): ?int => $chunk->every(fn (int $id): bool => $this->markedKeys->has($id))
                ? $index + 1
                : null)
            ->filter()
            ->values()
            ->all();
    }
}
