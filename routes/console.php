<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('queue:alert-failed')->everyTenMinutes();
Schedule::command('queue:alert-stale')->everyTenMinutes();
Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])->everyTenMinutes();

Schedule::command('sanctum:prune-expired --hours=24')->daily();

Schedule::command('sessions:prune-orphaned')->hourly();

Schedule::command('cashier:reconcile-subscriptions')->daily();
