<?php

namespace App\Console\Commands;

use App\Models\Word;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('words:import')]
#[Description('Import the top 10,000 most common English words')]
class ImportWords extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
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
            $data = array_map(fn (string $word, int $i) => [
                'word' => $word,
                'rank' => $offset + $i + 1,
                'created_at' => now(),
                'updated_at' => now(),
            ], $chunk, array_keys($chunk));

            Word::upsert($data, ['word'], ['rank', 'updated_at']);
            $chunkIndex++;
        });

        $this->newLine();
        $this->info('Done! '.Word::count().' words in database.');

        return self::SUCCESS;
    }
}
