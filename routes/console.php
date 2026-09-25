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
| eseményre feliratkozott AlertAdminOfQueueBacklog listener riaszt. A
| queue:monitor csak méretet mér, ezért egyetlen beragadt számla neki
| láthatatlan: a régóta esedékes jobokról a queue:alert-stale szól.
| Futtatásához a szerveren mennie kell a schedule:run cronnak (Ploi).
*/
Schedule::command('queue:alert-failed')->everyTenMinutes();
Schedule::command('queue:alert-stale')->everyTenMinutes();
Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])->everyTenMinutes();

/*
|--------------------------------------------------------------------------
| Sanctum token-takarítás
|--------------------------------------------------------------------------
|
| A desktop lejátszó (topwords Player) tokenjei 90 napos lejáratot kapnak
| (PlayerPairing::TOKEN_LIFETIME_DAYS);
| a lejárt token-sorokat naponta töröljük, hogy a tábla ne hízzon.
*/
Schedule::command('sanctum:prune-expired --hours=24')->daily();

/*
|--------------------------------------------------------------------------
| Árva session-sorok takarítása (GDPR)
|--------------------------------------------------------------------------
|
| A sessions tábla IP-címet és böngésző-azonosítót tárol, a user_id mögött
| nincs FK. A fióktörlés ezeket azonnal törli; ez a védőháló a más úton
| eltűnt felhasználók sorait takarítja (F3-L1).
*/
Schedule::command('sessions:prune-orphaned')->hourly();

/*
|--------------------------------------------------------------------------
| Előfizetés-egyeztetés a Stripe-pal
|--------------------------------------------------------------------------
|
| A Stripe webhookok legalább-egyszer és sorrend nélkül érkeznek: egy végleg
| elveszett customer.subscription.deleted a helyi előfizetést tartósan aktívan
| hagyná (beragadt „ingyen prémium"). A cashier:reconcile-subscriptions naponta
| a Stripe valós állapotához igazítja a helyileg aktív előfizetéseket, és
| lezárja a Stripe-nál már halottakat. Igényel élő Stripe API-kulcsot.
*/
Schedule::command('cashier:reconcile-subscriptions')->daily();
