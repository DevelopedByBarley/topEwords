<?php

namespace App\Console\Commands;

use App\Models\Word;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;

/**
 * A parancs a `words` tábla rank/level oszlopait tömegesen felülírja egy külső
 * listából, ezért éles környezetben megerősítést kér (P7-L3). Automatizált
 * futtatáshoz `--force`.
 */
#[Signature('words:import {--force : Megerősítés nélkül fut éles környezetben is}')]
#[Description('Import the top 10,000 most common English words')]
class ImportWords extends Command
{
    use ConfirmableTrait;

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        $url = 'https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-no-swears.txt';

        $this->info('Downloading word list...');

        $content = @file_get_contents($url);

        if ($content === false) {
            $this->error('Failed to download word list. Check your internet connection.');

            return self::FAILURE;
        }

        $words = array_values(array_filter(array_map('trim', explode("\n", $content))));

        $this->info('Importing '.count($words).' words...');

        $chunks = array_chunk($words, 500);
        $chunkIndex = 0;

        $this->withProgressBar($chunks, function (array $chunk) use (&$chunkIndex) {
            $offset = $chunkIndex * 500;
            $data = array_map(function (string $word, int $i) use ($offset) {
                $rank = $offset + $i + 1;

                return [
                    'word' => $word,
                    'rank' => $rank,
                    'level' => Word::levelForRank($rank),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }, $chunk, array_keys($chunk));

            Word::upsert($data, ['word'], ['rank', 'level', 'updated_at']);
            $chunkIndex++;
        });

        $this->newLine();
        $this->info('Done! '.Word::count().' words in database.');

        return self::SUCCESS;
    }
}
