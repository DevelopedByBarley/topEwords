# Fázis 7 — Verifikációs napló (mit néztem és hogyan)

> A finderek dimenziónként futottak; a HIGH/MEDIUM-gyanús leletekre 2-3 független, cáfolásra promptolt
> adverzariális verifikátort futtattam, LOW-ra egykörös verifikációt. Minden állítás mögött konkrét
> parancs-/fájl-bizonyíték áll.

## Auditált felület (teljes)

| Parancs | Fájl | Ütemezett? | Destruktív? |
|---|---|---|---|
| `ai:cache:clear` | ClearAiCache.php | nem | igen (megosztott cache, regenerálódik) |
| `billing:end-trial` | EndTrialNow.php | nem | igen (valós Stripe-terhelés, 1 user) |
| `words:fix-levels` | FixWordLevels.php | nem | igen (raw UPDATE, nem user-adat) |
| `words:import` | ImportWords.php | nem | mérsékelt (idempotens upsert) |
| `queue:alert-failed` | MonitorFailedJobs.php | **10 perc** | nem (csak olvas + riaszt) |
| `cashier:reconcile-subscriptions` | ReconcileStripeSubscriptions.php | **napi** | **igen (élő subokat zár)** |

Riasztási lánc: `FailedJobsDetected`, `QueueBacklogDetected`, `ApplicationErrorDetected` (notifications) +
`AlertAdminOfLoggedError`, `AlertAdminOfQueueBacklog` (listeners).

## Finder-dimenziók és eredményük

### D1 — Destruktivitás & prod-guard
- Grep: `isProduction|confirmToProceed|--force|production|environment(` mind a 4 manuális parancson → **0 találat**
  (nincs guard). → P7-L3 (LOW), mert egyik sincs ütemezve és a hatás korlátozott/visszafordítható.
- `DB::prohibitDestructiveCommands(app()->isProduction())` az `AppServiceProvider:145`-ben aktív, DE ez csak a
  `db:wipe`/`migrate:fresh` típusú *artisan* parancsokat blokkolja, a `FixWordLevels` raw `DB::update`-jét **nem** —
  ellenőrizve, nem téveszthető össze védelemnek. (Nem hiba: a `words` tábla nem user-adat.)

### D2 — Reconcile döntési logika & kör-fék (a korábbi HIGH itt volt)
- Kettős védelem verifikálva:
  - Boot-guard (`AppServiceProvider:120-136`): prod + `sk_test_` → `RuntimeException`, app nem indul.
  - Kör-fék (`ReconcileStripeSubscriptions:93-104,126-133`): `killCount ≥ 5 && killCount/active > 0.5` → FAILURE, 0 lezárás.
- Két-fázisú logika: döntés (nincs DB-írás a close-ágon) → kör-fék → végrehajtás. Ellenőrizve a kódban (sor 67-119).
- `resource_missing` → `CloseDecision`, minden egyéb Stripe-hiba (pl. `rate_limit`) → **tovább dob** (nem zár le).
- 3 adverzariális cáfolási kísérlet mind megbukott a lezáráson (lásd 01-LELETEK REC-1). → REFUTED.
- Maradék-élek: P7-L1 (`sk_live_` rossz fiók, boot-guard prefix-only), P7-L2 (5–50% sáv). Mindkettő LOW.

### D3 — MonitorFailedJobs vízjel-integritás
- Séma: `failed_jobs.id` = `bigint(20) unsigned autoincrement` (`php artisan db:table failed_jobs`).
- Vendor: `queue:flush`/`queue:retry`/`queue:forget` mind **DELETE** (nem TRUNCATE) →
  `DatabaseFailedJobProvider::flush()/forget()` `->delete()`. AUTO_INCREMENT nem resetel → vízjel monoton.
- Következtetés: **nincs néma kimaradás**; a cache-ürítéskori dupla-riasztás tudatosan vállalt. → P7-L4 (LOW).

### D4 — Riasztási lánc bekötése & viselkedése
- `php artisan event:list` → mindkét listener regisztrált (auto-discovery). Nincs néma/lecsatolt ág.
- `php artisan schedule:list` → 4 ütemezett feladat, a küldő `queue:alert-failed` és `queue:monitor` bent.
- Notification-ek: mind `notifyNow` (nem ShouldQueue) — helyes a queue-baj riasztásnál. → INFO-2.
- `AlertAdminOfLoggedError` két-rétegű throttle (dedup + globális burst-plafon), a rekurzió-veszély kizárva
  (dedup a küldés előtt zár + némán nyelő catch). → INFO-3, INFO-4.

### D5 — Scheduler-regisztráció & konkurencia
- Scheduler a `routes/console.php`-ban, `withRouting(commands:)`-en át betöltve — nem `withSchedule`. → INFO-5.
- Nincs `withoutOverlapping()/onOneServer()`, de egy-VPS-en nem okoz kárt (idempotens close, monoton vízjel,
  esemény-throttle). → INFO-6.
- `queue:monitor` betöltés-idejű `config('queue.default')` = `database` → `database:default` param helyes.

## Parancs-bizonyítékok (kulcs futtatások)

```
$ php artisan schedule:list
  */10 * * * *  php artisan queue:alert-failed
  */10 * * * *  php artisan queue:monitor 'database:default' --max=25
  0    0 * * *  php artisan sanctum:prune-expired --hours=24
  0    0 * * *  php artisan cashier:reconcile-subscriptions

$ php artisan event:list | grep -A1 'MessageLogged\|QueueBusy'
  Illuminate\Log\Events\MessageLogged → App\Listeners\AlertAdminOfLoggedError@handle
  Illuminate\Queue\Events\QueueBusy   → App\Listeners\AlertAdminOfQueueBacklog@handle

$ php artisan db:table failed_jobs | grep id
  id bigint, autoincrement … bigint(20) unsigned
```

## Tesztek (baseline + megerősítés)

```
$ php -d memory_limit=512M artisan test --compact \
    tests/Feature/AiCacheTest.php tests/Feature/EndTrialNowTest.php \
    tests/Feature/ErrorLogMonitoringTest.php tests/Feature/GeminiOutageTest.php \
    tests/Feature/QueueMonitoringTest.php tests/Feature/ReconcileStripeSubscriptionsTest.php \
    tests/Feature/BillingoInvoiceTest.php
  Tests: 83 passed (228 assertions)
```

Lefedettségi rés (nem hiba, megfigyelés): a `words:import` és `words:fix-levels` parancsoknak **nincs**
dedikált tesztjük. Mivel nem ütemezettek és nem user-adaton dolgoznak (idempotens upsert / raw level-UPDATE
a szótár-táblán), ez alacsony kockázatú — de a teszt-hiány ténykérdésként rögzítve.

## Módszertani megjegyzés

- **Függetlenség:** kizárólag a `PLAN.md` Fázis 7 hatóköréből dolgoztam; az előző audit-riportokat
  (`last_audit/reaudit-phase1..6`, korábbi `todo/*`) **nem olvastam**. A REC-1 azonosítót azért ismerem, mert a
  kód **kommentjei** hivatkoznak rá (`REC-1 defense-in-depth`), nem külső riportból — a lezárást a kódból és
  a tesztekből verifikáltam újra, nem korábbi állításra támaszkodva.
- **Kód nem módosult** (audit-no-fixes). A working tree csak a `.claude/settings.json`-t és az új
  `last_audit/reaudit-phase7/` riportot tartalmazza.
```
