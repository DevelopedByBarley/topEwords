<?php

namespace App\Console\Commands;

use App\Models\AiWordCache;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

#[Signature('ai:cache:clear {--task= : Csak ehhez a feladathoz (lookup, flashcard, insight)} {--word= : Csak ehhez a szóhoz}')]
#[Description('AI szó-cache törlése: hibás válasz vagy prompt-/modellváltás után újragenerálódik.')]
class ClearAiCache extends Command
{
    public function handle(): int
    {
        $query = AiWordCache::query();

        if ($task = $this->option('task')) {
            $query->where('task', $task);
        }

        if ($word = $this->option('word')) {
            $query->where('word', Str::lower($word));
        }

        $deleted = $query->delete();

        $this->info("{$deleted} AI cache sor törölve. A következő lekérdezésnél újragenerálódnak.");

        return self::SUCCESS;
    }
}
