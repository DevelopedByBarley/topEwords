<?php

namespace App\Console\Commands;

use App\Models\AiWordCache;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Str;

/**
 * Szűrő nélkül a teljes megosztott AI-cache-t törli, ami éles környezetben
 * azonnali Gemini-költséggel jár (minden szó újragenerálódik), ezért
 * megerősítést kér (P7-L3). Automatizált futtatáshoz `--force`.
 */
#[Signature('ai:cache:clear {--task= : Csak ehhez a feladathoz (lookup, flashcard, insight)} {--word= : Csak ehhez a szóhoz} {--force : Megerősítés nélkül fut éles környezetben is}')]
#[Description('AI szó-cache törlése: hibás válasz vagy prompt-/modellváltás után újragenerálódik.')]
class ClearAiCache extends Command
{
    use ConfirmableTrait;

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

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
