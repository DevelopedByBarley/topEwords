<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('sessions:prune-orphaned')]
#[Description('Törli a már nem létező felhasználókhoz tartozó session-sorokat (IP-cím, böngésző-azonosító).')]
class PruneOrphanedSessions extends Command
{
    public function handle(): int
    {
        if (config('session.driver') !== 'database') {
            $this->info('A session nem database driveren fut — nincs mit takarítani.');

            return self::SUCCESS;
        }

        $deleted = DB::connection(config('session.connection'))
            ->table(config('session.table', 'sessions'))
            ->whereNotNull('user_id')
            ->whereNotExists(fn ($query) => $query->select(DB::raw(1))
                ->from('users')
                ->whereColumn('users.id', config('session.table', 'sessions').'.user_id'))
            ->delete();

        $this->info("{$deleted} árva session-sor törölve.");

        return self::SUCCESS;
    }
}
