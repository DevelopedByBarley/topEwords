# D5 — Queue/worker + failed_jobs + error-log riasztás éles-config + go-live checklist

**PLAN-pontok:** „Queue/worker + failed_jobs + error-log riasztás éles-config." és
„Go-live checklist véglegesítés (Stripe/Billingo éles kulcsok, DNS, HTTPS, CWS-feltöltés)."
*(A két pont egy dimenzióba vonva: ugyanaz a kód- és ops-felület fedi őket.)*

**Verdikt: 0 HIGH · 0 MEDIUM · 3 LOW · 2 INFO.**

A finder eredetileg **1 MEDIUM-ot** jelölt (D5-1); az adverzariális verifikáció **2/2 arányban
REFUTED**-ra hozta → **LOW**. Részletek: [`06-verifikacios-naplo.md`](06-verifikacios-naplo.md).

**A központi kérdésre adott válasz:** a 2026-07-22-i néma hiba osztálya **részben, nem
szerkezetileg** megelőzött. A *végleges-veszteség* detekciós útja queue-név-agnosztikus és
szilárd. A *korai figyelmeztetés* (torlódás) útja nem az — de a torlódás előállításához két
egymástól független hibás beállítás kell, nem egy.

---

## Leletek

### D5-1 · A `queue:monitor` a queue NEVÉT literálként kapja, míg a dispatch env-ből olvassa *(finder: MEDIUM → verifikáció: LOW)* · LOW

- **fájl:** [routes/console.php:23](../../routes/console.php#L23)
- **súlyosság:** LOW (leminősítve MEDIUM-ról, 2/2 REFUTED)
- **a mechanizmus (igazolt):**
  ```php
  Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])
  ```
  A *connection* dinamikusan feloldott; a *queue-név* a `default` string-literál. A dispatch-oldal
  ([config/queue.php:42](../../config/queue.php#L42)) `'queue' => env('DB_QUEUE', 'default')`.
  A `GenerateBillingoInvoice` nem deklarál `$queue`-t és nem hív `onQueue()`-t
  ([app/Jobs/GenerateBillingoInvoice.php:16-36](../../app/Jobs/GenerateBillingoInvoice.php#L16-L36)),
  tehát a connection konfigurált queue-ját örökli. A `DatabaseQueue::getQueue()` `?:` fallbackje
  csak *üres* argumentumra tüzel, tehát egy nem-üres literált nem ment meg.
- **miért NEM MEDIUM (a verifikáció döntő érve):**
  **A worker UGYANAZT a config-kulcsot olvassa, mint a dispatch.**
  `vendor/laravel/framework/src/Illuminate/Queue/Console/WorkCommand.php:355-360` — magam is
  visszaellenőriztem:
  ```php
  return $this->option('queue') ?: $this->laravel['config']->get(
      "queue.connections.{$connection}.queue", 'default'
  );
  ```
  `--queue` flag nélkül a `php artisan queue:work` ugyanarra a `queue.connections.database.queue`
  kulcsra oldódik fel, amit a dispatch használ. Mérve `DB_QUEUE=billing` mellett:
  ```
  worker figyel : billing
  dispatch megy : billing
  monitor arg   : database:default
  worker==dispatch : IGEN
  ```
  Tehát a `DB_QUEUE` beállítása a workert és a dispatchert **együtt** mozgatja: a jobok
  feldolgozódnak, **torlódás nem keletkezik**, és a `default`-ot figyelő monitor `[0] OK`-ja
  **helyes**, nem vak. A veszélyes világhoz egy **második, független** hibás beállítás kell:
  egy explicit `--queue=` override a Supervisor daemonon, ami nem egyezik a `DB_QUEUE`-val —
  ez viszont ops/deploy defekt, nem a `routes/console.php:23` kód-defektje.
- **triggerelhetőség:** a `DB_QUEUE` a repóban **sehol** nem szerepel a stock
  `config/queue.php` scaffold-sorokon és a korábbi audit-írásokon kívül: nincs `.env`-ben,
  nincs `.env.example`-ban, nincs deploy-doksiban, nincs CI/Ploi configban. A repóban **nincs
  `--queue=`** sehol. A `FIZETES_PRODUCTION_TEENDOK.md:44` épp a csupasz
  `php artisan queue:work`-öt írja elő, azaz a config-követő formát.
- **túlélő csatornák (a „nincs riasztás" állítás hamis):**
  - `queue:alert-failed` → [MonitorFailedJobs.php:27-30](../../app/Console/Commands/MonitorFailedJobs.php#L27-L30):
    a `failed_jobs`-ot **queue-szűrő nélkül** olvassa, és a valós queue-nevet ki is írja (72. sor).
  - `GenerateBillingoInvoice::failed()` → `report()` → `AlertAdminOfLoggedError` → szinkron admin e-mail.
  Csak a „worker meghalt, jobok gyűlnek" korai jelzés veszne el — és csak abban az állapotban,
  ami kézi, dokumentálatlan env-szerkesztést **plusz** egy egymástól függetlenül halott workert igényel.
- **verdikt:** **REFUTED mint MEDIUM → CONFIRMED mint LOW.** Az egysoros javítás
  (`config('queue.connections.'.config('queue.default').'.queue')`) továbbra is jogos keményítés.

### D5-2 · A monitoring-tesztek `'default'`-ot hardcode-olnak, így a D5-1-et nem tudnák észlelni · LOW

- **fájl:** [tests/Feature/QueueMonitoringTest.php:16,89,102,112](../../tests/Feature/QueueMonitoringTest.php#L16)
- **forgatókönyv:** Az `insertFailedJob()` `'queue' => 'default'`-ot ír, és minden `QueueBusy`
  eseményt `new QueueBusy('database', 'default', …)`-ként konstruál. Semmi nem állítja, hogy az
  ütemezett monitor-argumentum egyenlő a
  `config('queue.connections.'.config('queue.default').'.queue')`-val. Mind a 8 teszt zöld —
  és **teljes drift alatt is zöld maradna**. Állapot → hatás: a drift zölden szállítható ki.
- **verdikt:** CONFIRMED.

### D5-3 · Nincs dead-man's-switch; a scheduler halála észlelhetetlen · LOW

- **fájl:** [routes/console.php](../../routes/console.php) (a teljes fájl)
- **forgatókönyv:** Nincs `pingOnSuccess`/`thenPing`/`onFailure`/külső heartbeat sem a
  `routes/console.php`-ban, sem az `app/Console/`-ban. Mind a három riasztási csatorna
  (`queue:alert-failed`, `queue:monitor`, és a `failed()`-beli `report()`) azt igényli, hogy
  **valami a dobozon belül** fusson. Állapot → hatás: ha a cron meghal vagy a gép leáll, a worker
  is halott → a számlázási jobok feldolgozatlanul gyűlnek → **nulla riasztás, határozatlan ideig**.
  A `health: '/up'` ([bootstrap/app.php:18](../../bootstrap/app.php#L18)) létezik, de csak azt
  bizonyítja, hogy a web-réteg válaszol; a scheduler/worker életéről semmit nem mond, és a repóban
  semmi nem pollozza.
- **verdikt:** CONFIRMED. *(Ez ops-teendő, nem kód-lelet — egyezik a memóriában nyitva tartott
  „uptime/CPU-RAM-disk + VPS cron/worker" ops-tétellel.)*

---

## INFO

### D5-4 · A deploy-doksi elavult, a kiszállított kóddal ellentétest ír · INFO
[FIZETES_PRODUCTION_TEENDOK.md:38-44](../../FIZETES_PRODUCTION_TEENDOK.md#L38-L44) — a doksi még
jövőbeli munkaként kezeli az aszinkron számlázást, és „`dispatchSync()` visszaváltása
`dispatch()`-re" teendőt ír. A kód a
[StripeWebhookController.php:93](../../app/Http/Controllers/StripeWebhookController.php#L93)-nál
**már `dispatch()`-et használ**. Állapot → hatás: a checklistet követő operátor nem feltétlenül
ismeri fel, hogy egy tartós `queue:work` daemon immár **kötelező**, nem opcionális — élő
`dispatch()` mellett, worker nélkül minden számla némán a `jobs` táblában ül
(a `queue:alert-failed` csak a `failed_jobs`-ot nézi, tehát a feldolgozatlan ≠ elbukott, és
láthatatlan marad; csak a D5-1 torlódás-csatornája fogná meg).
**Ez a kör legkonkrétabb go-live teendője.**

### D5-5 · A riasztási lánc többi eleme rendben
- **`AlertAdminOfLoggedError` burst-plafon:** a 10/óra korlát a per-hiba dedup **után**
  ellenőrződik, és a `Cache::add(...,0,...)` + `Cache::increment()` miatt az óra első riasztása
  1-et olvas, jóval a limit alatt. A sorrend helyes: a throttle **nem tudja elnyelni** az első
  valódi riasztást. *(A PLAN/korábbi kör ezzel kapcsolatos gyanúja MEGDŐLT.)*
  Megjegyzendő viszont, hogy >10 különböző hibából álló burst esetén a 11. *eltérő* hiba
  csak logba kerül, és hogy mindkét listener `notifyNow()`-val (szinkron) küld, tehát egy
  eltört SMTP-transport egyszerre némítja az összes csatornát — a `.env.example:59`
  `MAIL_MAILER=log` defaultja prodra átvíve kockázatos.
- **`MonitorFailedJobs` queue-név-agnosztikus:** a `failed_jobs`-ot szűrő nélkül olvassa, tehát
  egy **véglegesen elbukott** számla-job a queue-névtől függetlenül riaszt, és a 72. sor a valós
  queue-nevet ki is írja az e-mailbe — ami egy D5-1 driftet utólag fel is színre hozna.
  Hiányzó `ADMIN_EMAIL` esetén `FAILURE`-t ad látható üzenettel (szemben az
  `AlertAdminOfQueueBacklog:23-25`-tel, ami némán tér vissza).
- **Retry/failure kezelés szilárd:** `$tries = 4`, `$backoff = [60, 300, 900]`; a `failed()`
  `report()`-ot hív, ami a `MessageLogged` → `AlertAdminOfLoggedError` láncon szinkron admin
  e-mailt küld (`php artisan event:list`-tel élőben igazolva, nem feltételezve). Az idempotenciát
  az `InvoiceGenerator` unique `stripe_invoice_id`-ja kényszeríti, tehát az újrapróbálkozás
  nem tud dupla számlát kiadni.

---

## PLAN-feltevések: ÁLL vs. MEGDŐLT

**MEGDŐLT:**
- **„A 2026-07-22-i incidens `queue:monitor` néma hiba volt."** Az incidens saját rekordja szerint
  a riasztási lánc **elindult** (~10 perc késéssel). Az akkori drift a worker/connection szinten
  volt, egy olyan queue-n, amit a monitor **figyelt**. A D5-1 egy *másik*, még be nem következett
  hibamód — nem az incidens gyökéroka.
- **„A végleges számla-veszteség némán a `failed_jobs`-ba kerülhet."** Két független,
  queue-név-agnosztikus csatorna fedi: a `failed_jobs` tábla-söprés és a
  `failed()` → `report()` → szinkron admin e-mail.
- **„A mail-storm throttle elnyelheti az első valódi riasztást."** Az `AlertAdminOfLoggedError`
  sorrendje ezt lehetetlenné teszi az óra első riasztására.

**ÁLL:**
- **„A queue-név-drift szerkezetileg lehetséges."** Mérve igazolt. Nincs boot-guard (a fájlban
  5 fail-closed guard van más config-driftekre, queue-ra egy sem), nincs teszt, nincs közös
  igazságforrás. *(De a hatás LOW — lásd D5-1.)*
- **„Nincs külső dead-man's-switch."** Igazoltan hiányzik (D5-3).
