<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Queue-felügyelet
|--------------------------------------------------------------------------
|
| A Billingo (NAV) számlázás aszinkron jobként fut, ezért a queue némán tud
| meghibásodni: az elbukott jobokról a queue:alert-failed küld e-mailt, a
| torlódásról (tipikusan leállt worker) a queue:monitor + a QueueBusy
| eseményre feliratkozott AlertAdminOfQueueBacklog listener riaszt.
| Futtatásához a szerveren mennie kell a schedule:run cronnak (Ploi).
*/
Schedule::command('queue:alert-failed')->everyTenMinutes();
Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])->everyTenMinutes();
