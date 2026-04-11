<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('words:fix-levels')]
#[Description('Set the correct level for all words based on their rank')]
class FixWordLevels extends Command
{
    public function handle(): void
    {
        $updated = DB::update('
            UPDATE words SET level =
                CASE
                    WHEN rank <= 1000 THEN 1
                    WHEN rank <= 2000 THEN 2
                    WHEN rank <= 4000 THEN 3
                    WHEN rank <= 6000 THEN 4
                    WHEN rank <= 8000 THEN 5
                    ELSE 6
                END
        ');

        $this->info("Updated {$updated} words.");
    }
}
