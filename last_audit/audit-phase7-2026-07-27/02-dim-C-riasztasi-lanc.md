# Fázis 7 — Dimenzió C — Riasztási lánc végponttól végpontig

**Finder-dimenzió:** C — a riasztási lánc működése végponttól végpontig (MonitorFailedJobs, FailedJobsDetected, QueueBacklogDetected, ApplicationErrorDetected, AlertAdminOfLoggedError, AlertAdminOfQueueBacklog)

Leletek: 8

> A verifikátorok kifejezetten CÁFOLÁSRA voltak promptolva; bizonytalanság esetén a
> default `refuted=true`. HIGH/MEDIUM-ra 3 eltérő lencse, LOW-ra egykörös.

> ⚠️ **A C-dimenzió leletei VERIFIKÁLATLANOK.** A workflow-t usage-korlát miatt
> a C-verifikátorok indítása előtt leállítottuk. Az itt szereplő súlyosságok a
> **finder saját** minősítései (`*` jelöli), nem verifikált verdiktek. Egy
> folytatásnak ezeket adverzariálisan meg kell mérnie — a tapasztalat szerint a
> verifikáció jellemzően LEFELÉ mozgat (lásd a B/D dimenzió eredményeit).

---

## P7C-1 — A torlódás-riasztás elérhetetlen a valós job-forgalomnál: `--max=25`, miközben az app EGYETLEN queued jobot ismer — a 2026-07-22-i incidens állapota MÉRHETŐEN 0 riasztást ad

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:23` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | MEDIUM |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a queue worker leáll (Supervisor daemon meghal, vagy queue-név-drift), és 1–24 `GenerateBillingoInvoice` job beragad a `jobs` táblába. Mérés (helyes queue-névvel, `queue:monitor database:default --max=25`): 24 jobnál a QueueBusy esemény NEM lő ki, 25-nél lő ki (`size >= max`). Az app teljes kódbázisában PONTOSAN EGY dispatch-hívás van (`StripeWebhookController:93`), és nincs sem `onQueue`, sem más `ShouldQueue` job — a queue csak számla-jobot hordoz (+ ritkán a Cashier `ConfirmPayment`-jét). Egyetlen fizetős ár (1990 Ft/hó) mellett a 25 egyidejűleg várakozó számla-job nem realisztikus steady-state. Hatás: a worker leállása 24 kimaradt NAV-számláig NÉMA — a `failed_jobs` üres (a job nem bukott el, csak nem vette fel senki), ezért a `queue:alert-failed` sem szól. Újrajátszottam az incidens állapotát (1 job a `staging` queue-ban): `queue:monitor` kimenete `[database] default ... [0] OK`, `failed_jobs=0`, riasztás nulla, örökre.

### Bizonyíték

routes/console.php:23 — `Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])->everyTenMinutes();`

vendor MonitorCommand.php:104 — `'status' => $size >= $this->option('max') ? '...ALERT...' : '...OK...'` és dispatchEvents() csak nem-OK-ra lő.

MÉRT (tinker): `size=24` → nincs QueueBusy; `size=25` → `QueueBusy FIRED size=25`.

MÉRT dispatch-leltár: `grep -rn "dispatch(" app --include="*.php"` → 1 találat: `app/Http/Controllers/StripeWebhookController.php:93`. `grep -n implements app/Jobs/*.php app/Notifications/*.php` → csak `GenerateBillingoInvoice implements ShouldQueue`; a 3 Notification NEM ShouldQueue.

Incidens-újrajátszás (tinker): 1 job `queue='staging'` → `size(default)=0`, `size(staging)=1`, monitor `[0] OK`, `failed_jobs=0`.

Létező enyhítés: a `queue:alert-failed` 10 percenként fut, de csak a VÉGLEGESEN ELBUKOTT jobokra — a beragadt job soha nem kerül a `failed_jobs`-ba, tehát ez az út nem fedi a forgatókönyvet. A job idempotens és `queue:retry all`-lal pótolható, ha valaki észreveszi.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem HIGH: nem távolról kihasználható, és nincs adatvesztés — a jobok a `jobs` táblában megmaradnak, a `retry` után a számla kijön (a 2026-07-22-i incidensben pontosan ez történt). Kizárólag az ÉSZLELÉS késik, a NAV-kötelezettség pótolható.

**Miért nem alacsonyabb:** Nem LOW: van dokumentált, ténylegesen bekövetkezett precedens (2026-07-22, éles környezet, elmaradt első számla), és a mérés szerint a riasztási lánc mindkét ága (failed-job + torlódás) egyszerre néma ebben az állapotban. A `--max=25` küszöb nem a valós forgalomhoz van kalibrálva, hanem a Laravel default (1000) önkényes leosztása.

---

## P7C-2 — BILL-3 megerősítve és ÉLES: a `queue:monitor` fixen `:default` queue-t figyel, miközben a figyelt queue-név sehol nincs összekötve a jobok tényleges queue-nevével

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:23` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | MEDIUM |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a prod `.env`-be bekerül `DB_QUEUE=production` (vagy `staging`) — pontosan a 2026-07-22-i incidens config-driftje. Hatás: a `GenerateBillingoInvoice` a `production` nevű queue-ba kerül (`config/queue.php:42` → `env('DB_QUEUE','default')`), a scheduler viszont `database:default`-ot figyel (a `:default` STRING-literál a hívásban, nem a config). A monitor `[0] OK`-ot ír örökre, akármennyi job gyűlik. A `config('queue.default')` rész helyesen dinamikus — épp a queue-NÉV, ami az incidensben driftelt, a hardcode-olt. Mért: `config('queue.connections.database.queue')='default'` ma egyezik, tehát ma a lánc működik — a hiba csak a drift pillanatában aktiválódik, és akkor csendben.

### Bizonyíték

routes/console.php:23 — `config('queue.default').':default'` (a connection dinamikus, a queue-név literál).

config/queue.php:42 — `'queue' => env('DB_QUEUE', 'default')` — a jobok queue-neve env-ből jön.

MÉRT: `.env`/`.env.example` egyikében sincs `DB_QUEUE` sor → ma mindkettő `default`, ezért ma nincs drift. `grep -rn "onQueue|onConnection" app/` → 0 találat, tehát a job SOHA nem írja felül, mindig a config-értéket használja.

Szemantikai bizonyíték a mérésből: `size(default)=0` / `size(staging)=1` állapotban a monitor `[0] OK`.

Létező enyhítés: ma a két érték egyezik (mindkettő `default`), mert `DB_QUEUE` nincs beállítva. Nincs viszont sem boot-guard, sem őrszem-teszt a driftre — pedig ugyanez az osztály (`AppServiceProvider`) 5 másik config-driftre már fail-closed guardot ad.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem HIGH: latens hiba, aktiválásához ops-beavatkozás (`DB_QUEUE` beírása) kell, és ma nincs drift. A kár pótolható (`queue:retry`).

**Miért nem alacsonyabb:** Nem LOW: az előző kör (Fázis 2, 2026-07-26) is „a lánc EGYETLEN valóban néma útja"-ként rögzítette, a drift éles környezetben MÁR bekövetkezett egyszer, és a javítás triviális (`config('queue.connections.'.config('queue.default').'.queue')`). Önállóan újramértem: a verdikt áll, és P7C-1-gyel együtt kettős némaságot ad.

---

## P7C-3 — A globális burst-plafon szint-vak: 10 közönséges `error` kimerítése után a kör-fék `critical`-ja (200 előfizetés majdnem-lezárása) MÉRHETŐEN néma marad ~1 óráig

| | |
|---|---|
| **Fájl:sor** | `app/Listeners/AlertAdminOfLoggedError.php:65` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | MEDIUM |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: egy Stripe/Billingo incidens 10 különböző szövegű `error` bejegyzést szül (timeout URL-lel, QueryException SQL-értékkel — a dedup ezeket külön kulcson átengedi), ezzel a globális keret betelik. Ezt követően a napi `cashier:reconcile-subscriptions` kör-fékje `Log::critical`-t ír („MEGSZAKÍTVA: az aktív előfizetések túl nagy hányadát zárná le — kézi ellenőrzés szükséges", `ReconcileStripeSubscriptions:94`). Hatás: MÉRVE — a 11. bejegyzés a `critical`, a burst-számláló 11-re lép, riasztás NEM megy ki; a rendszer legsúlyosabb üzenete (rossz módú STRIPE_SECRET → majdnem az egész fizető állomány lezárása) csak a `laravel.log`-ba kerül. Az ablak fix 1 óra (mérve: az `increment` nem tolja a TTL-t), tehát a vakfolt legfeljebb ~60 perc, de épp abba az órába eshet, amikor a napi cron fut.

### Bizonyíték

AlertAdminOfLoggedError.php:33 — `ALERT_LEVELS = ['emergency','alert','critical','error']` — a 4 szint teljesen egyenrangú, se sorrend, se külön keret.

AlertAdminOfLoggedError.php:65 — `if ($this->globalBurstExhausted()) { return; }` — szint-független korai kilépés.

AlertAdminOfLoggedError.php:100-102 — `Cache::add($k,0,now()->addHour()); return Cache::increment($k) > 10;`

MÉRT (tinker, Notification::fake + `app()['env']='production'`): 10 egyedi `Log::error` → `burst=10`, `assertSentOnDemandTimes(ApplicationErrorDetected::class, 10)` ZÖLD. Utána `Log::critical(...)` → `burst=11`, a 11-es assert ELHASAL → „critical ELVESZETT (nema) - maradt 10".

MÉRT TTL-viselkedés: `expiration` 5 increment után bitre azonos → fix (nem csúszó) óra-ablak.

A `critical`-t termelő valós hívási helyek: ReconcileStripeSubscriptions.php:94 (kör-fék) és :197 (beragadt előfizetés lezárása).

Létező enyhítés: a fix óra-ablak ~60 percre korlátozza a vakfoltot. A parancs FAILURE-rel is kilép, így a scheduler `report()`-ol (ScheduleRunCommand.php:214-220) — de ez ÚJABB error-log ugyanabba a betelt keretbe. A `laravel.log` mindig megmarad. ErrorLogMonitoringTest:69-82 a plafont a védelmi oldaláról fedi, a szint-prioritást nem.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem HIGH: nincs adatvesztés — a kör-fék épp azt bizonyítja, hogy SEMMIT nem zárt le, és a `laravel.log` teljes nyomot tart. Nem távolról kihasználható: a betelt keretet nem lehet kívülről célzottan előállítani (10 különböző szövegű prod-error kell), és a támadónak semmi haszna belőle.

**Miért nem alacsonyabb:** Nem LOW: nem szélső hibamód, hanem a lánc tervezési hézaga — a keret betelése épp INCIDENS közben a legvalószínűbb, és pont akkor nyeli el a legsúlyosabb szintet. Konkrét, mért forgatókönyv van, valós `critical` hívási helyekkel. A javítás kicsi (a `critical`+ szinteknek külön keret vagy a plafon alóli kivétel).

---

## P7C-4 — `MAIL_MAILER=log` (a config- ÉS a .env.example-default) esetén a teljes riasztási lánc „sikeresen" fut, a vízjel elmozdul, és soha senki nem kap levelet

| | |
|---|---|
| **Fájl:sor** | `config/mail.php:17` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | MEDIUM |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a prod `.env`-ből kimarad vagy `log`-on marad a `MAIL_MAILER` (a `.env.example:59` konkrétan `MAIL_MAILER=log`-ot szállít, a `config/mail.php:17` fallbackja szintén `'log'`). Ez a Ploi → Environment felületen kézzel összeállított .env-nél reális: a memória szerint az e-mail-küldés élesítése külön lépés volt („needed config:cache after .env edit"). Hatás: MÉRVE — a `queue:alert-failed` exit kódja 0, a kimenete „Riasztás elküldve 1 új elbukott jobról (developedbybarley@gmail.com)", és a vízjel 0→1-re lép, tehát ugyanarról a bukásról SOHA többé nem szól. A levél a `laravel.log`-ba íródik. Ez az EGYETLEN néma út, ahol a lánc pozitív visszajelzést ad („elküldve") anélkül, hogy bármi kézbesülne — az összes többi hibamód (üres/hibás ADMIN_EMAIL, SMTP down) hangos vagy legalább nem lépteti a vízjelet. Ráadásul a `log`-mailer által írt bejegyzés `debug` szintű, tehát az `AlertAdminOfLoggedError` sem veszi észre (`ALERT_LEVELS` csak error+).

### Bizonyíték

config/mail.php:17 — `'default' => env('MAIL_MAILER', 'log')`.
.env.example:59 — `MAIL_MAILER=log`.
.env:50 (lokális) — `MAIL_MAILER=smtp` (ma jó).

MÉRT (tinker, `config(['mail.default'=>'log'])` + 1 beszúrt failed_job): `exit=0`, `out=Riasztás elküldve 1 új elbukott jobról (developedbybarley@gmail.com).`, `watermark before=NULL after=1`.

Kontraszt-mérések ugyanabban a körben:
- hibás formátumú ADMIN_EMAIL → `RfcComplianceException` FELSZÁLL, `watermark=NULL` (fail-loud).
- elérhetetlen SMTP → `TransportException` FELSZÁLL, `watermark=NULL` (fail-loud, 10 perc múlva újrapróbál).
vendor NotificationSender.php:160-175 — `sendToNotifiable` a csatorna-hibát `throw`-olja, tehát a felszállás garantált.

Boot-guard-leltár: AppServiceProvider 5 config-driftre fail-closed (APP_ENV, APP_DEBUG, webhook-secret, sk_test, ismeretlen env) — a mail-driverre és az ADMIN_EMAIL-re EGYIK SEM.

Létező enyhítés: a memória szerint az éles SMTP-küldés 2026-06-30-án smoke-tesztelt, tehát a prod .env ma vélhetően jó; a `laravel.log` tartalmazza a le nem küldött levelet.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem HIGH: nem támadható, és ma a prod-beli érték mérhetően jó (smoke-tesztelt SMTP). Aktiválásához ops-hiba (.env-drift vagy .env.example-ből másolás) kell, és a `laravel.log` végig nyomot hagy.

**Miért nem alacsonyabb:** Nem LOW: ez a lánc EGYEDÜLI hamis-pozitív visszajelzést adó ága — a „Riasztás elküldve" kiírás + a vízjel léptetése aktívan megtéveszti az operátort és VÉGLEGESEN eldobja a jelet (nem retry-olható, ellentétben az SMTP-hibával). A `.env.example` konkrétan a rossz értéket szállítja, és a projekt ugyanerre a hibaosztályra máshol 5 boot-guardot tart fenn — a hézag itt rendszerszinten inkonzisztens.

---

## P7C-5 — Mindkét listener a küldés ELŐTT állítja be az 1 órás throttle-kulcsot: egy átmeneti SMTP-hiba egy órára elnyomja a riasztást, pedig levél soha nem ment ki

| | |
|---|---|
| **Fájl:sor** | `app/Listeners/AlertAdminOfQueueBacklog.php:30` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | LOW |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a queue torlódik (>=25 job), a `queue:monitor` kilövi a QueueBusy-t, de az SMTP épp 30 másodpercre elérhetetlen (Rackhost-restart, DNS-hiccup). Hatás: MÉRVE — a `Cache::add(throttleKey, true, 1h)` MÁR beállt, majd a `notifyNow` `TransportException`-t dob, ami a listenerből (nincs try/catch) felszáll és megbuktatja a `queue:monitor` parancsot. A következő 5 ütemezett futás (10 percenként, egy teljes óra) a throttle-kulcs miatt csendben kilép — a torlódásról egy órán át egyetlen levél sem megy, holott soha nem is ment. Ugyanez a minta az `AlertAdminOfLoggedError`-ban is mérve (a dedup-kulcs sikertelen küldés után is áll), ott azonban SZÁNDÉKOS és dokumentált rekurzió-védelem, mert a küldés hibája maga is error-logot szülne.

### Bizonyíték

AlertAdminOfQueueBacklog.php:30-35 — `if (! Cache::add($throttleKey, true, now()->addHour())) { return; }` majd UTÁNA `notifyNow(...)`; a metódusban nincs try/catch.

MÉRT (tinker, elérhetetlen SMTP + `event(new QueueBusy('database','default',99))`): `FELSZALLT: Symfony\Component\Mailer\Exception\TransportException`, majd `throttle-kulcs beallt? true`.

MÉRT az error-listeneren is: sikertelen küldés után `cache()->get('error-monitoring:alerted:error:'.md5($msg))` === true.

Aszimmetria: AlertAdminOfLoggedError.php:41 `isProduction()`-guard + :77 `catch (Throwable)`; AlertAdminOfQueueBacklog-ban EGYIK SEM.

Létező enyhítés: az ablak legfeljebb 1 óra. A `queue:monitor` bukása a schedulerben `report()`-ot generál (ScheduleRunCommand.php:214-220) → prodban error-log → elvileg az error-ág veszi át, de ez ugyanarra a beteg SMTP-re támaszkodik. A `MonitorFailedJobs` ehhez képest HELYESEN a küldés UTÁN lépteti a vízjelet (:51) — a minta máshol jól van alkalmazva.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem MEDIUM: az SMTP-kiesés és a torlódás időbeli egybeesése kell hozzá (szűk ablak), a némaság legfeljebb 1 órás, és a torlódó jobok nem vesznek el. Ráadásul P7C-1 miatt a >=25-ös küszöb amúgy is ritkán teljesül, ami tovább szűkíti a bekövetkezést.

**Miért nem alacsonyabb:** Nem INFO: van konkrét, mért forgatókönyv (bemenet → felszálló kivétel + beállt kulcs → 5 elnyomott futás), nem puszta megfigyelés.

---

## P7C-6 — Szintaktikailag helyes, de rossz ADMIN_EMAIL (elgépelt cím) esetén a lánc végig „sikeres" — nincs bounce-figyelés és nincs önteszt

| | |
|---|---|
| **Fájl:sor** | `config/app.php:27` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | LOW |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a prod `.env`-ben `ADMIN_EMAIL=developedbybarly@gmail.com` (egy hiányzó betű). Hatás: az SMTP elfogadja a címet, a `notifyNow` nem dob, a `MonitorFailedJobs` exit 0-val lép ki és a vízjelet lépteti, a levél pedig egy nem létező postafiókba bounce-ol, amit senki nem figyel. A lánc minden szintje sikert jelez, és a jel VÉGLEGESEN elvesz (a vízjel már lépett, tehát nincs újrapróbálkozás). Ellentét: az érvénytelen FORMÁTUM hangosan bukik (mérve: `RfcComplianceException`), tehát a validáció csak a szintaxist fogja, a kézbesíthetőséget nem.

### Bizonyíték

config/app.php:27 — `'admin_email' => env('ADMIN_EMAIL')` — semmilyen validáció.
.env.example:78 — `ADMIN_EMAIL=` (üres).

MÉRT: `config(['app.admin_email'=>'nem-email-cim'])` → `THROWN Symfony\Component\Mime\Exception\RfcComplianceException`, `watermark=NULL` (fail-loud). Egy RFC-helyes, de nem létező cím ezt a kaput átlépi.

Üres ADMIN_EMAIL viselkedése (kód szerint, teszttel fedve): MonitorFailedJobs.php:40-44 → `self::FAILURE` + hangos `$this->error(...)`; AlertAdminOfQueueBacklog.php:23 és AlertAdminOfLoggedError.php:47 → csendes `return`. Tesztek: QueueMonitoringTest.php:72-83 és :108-115, ErrorLogMonitoringTest.php:104-112 — a csendes kimaradás SZÁNDÉKOS és rögzített.

Létező enyhítés: az üres érték legalább a `queue:alert-failed` ágon hangos (FAILURE + scheduler-report). A memória (`project_queue_monitoring`) nyitott ops-teendőként explicit listázza az „ADMIN_EMAIL a prod .env-ben" pontot.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem MEDIUM: tiszta ops-elgépelés egyetlen, egyszer beállított értékben, alacsony bekövetkezési valószínűséggel; a `laravel.log` nyomot tart, és az első valódi riasztás elmaradása utólag felderíthető.

**Miért nem alacsonyabb:** Nem INFO: konkrét bemenet → konkrét hatás (végleg eldobott jel + hamis siker-visszajelzés), és a vízjel léptetése miatt nem is retry-olható.

---

## P7C-7 — Nincs semmi, ami a HIÁNYZÓ `schedule:run` cront észlelné — a lánc 2 ága teljes egészében egy nem-monitorozott külső cronon áll (dead-man's-switch nincs)

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:22` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | LOW |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a Ploi scheduler cronja nincs telepítve, leáll, vagy egy szerver-újratelepítés után kimarad. Hatás: a `queue:alert-failed` és a `queue:monitor` egyszerűen nem fut. Mivel mindkettő CSAK akkor termel kimenetet, ha van baj, a hiányzó futás megkülönböztethetetlen a „minden rendben" állapottól — nincs heartbeat, nincs „utolsó futás" időbélyeg, nincs külső dead-man's-switch. Így a failed-job- és torlódás-riasztás egyszerre, tartósan és teljesen nyomtalanul elveszik; egyedül a napi `cashier:reconcile-subscriptions` kimaradása hagyna közvetett nyomot (beragadt előfizetések), az sem riasztásként.

### Bizonyíték

routes/console.php:22-47 — mind a 4 ütemezett feladat `Schedule::command(...)`, egyik sem használ `->onFailure()`, `->emailOutputOnFailure()`, `->pingOnSuccess()`/heartbeat-URL-t vagy `->sendOutputTo()`-t.

`php artisan schedule:list` (ellenőrizve): pontosan 4 feladat, a PLAN-ban megadottakkal egyezik.

A memória (`project_queue_monitoring`) nyitott ops-teendői: „uptime-check (külső: UptimeRobot vagy Ploi) ... a VPS-en kell: `schedule:run` cron (Ploi scheduler) + queue worker daemon".

Létező enyhítés: a `/up` health endpoint be van kötve (bootstrap/app.php:18), tehát egy külső uptime-monitor a webet figyeli — a schedulert azonban nem. Az ops-teendő nyilvántartott és go-live előtt szerepel a listán.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem MEDIUM: ez infra/ops-hézag, nem kód-defektus, és a projekt tudatosan, írásban nyitott ops-teendőként tartja nyilván. A Ploi scheduler egyszer beállítva stabil.

**Miért nem alacsonyabb:** Nem INFO: a hatás konkrét és a dimenzió magját érinti („mikor marad néma a riasztás?") — a teljes lánc egyetlen, nem verifikált külső feltételen áll, és a kimaradás definíció szerint észrevehetetlen.

---

## P7C-8 — A failed_jobs vízjel TRUNCATE-re (migrate:fresh / kézi tábla-ürítés) tartósan némává válik — DELETE-re viszont MÉRHETŐEN biztonságos

| | |
|---|---|
| **Fájl:sor** | `app/Console/Commands/MonitorFailedJobs.php:51` |
| **Súlyosság (finder, VERIFIKÁLATLAN)** | LOW |
| **Verifikációs verdikt** | ⚠️ nem futott le |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a vízjel pl. 40-en áll, majd valaki `TRUNCATE TABLE failed_jobs`-ot futtat (vagy `migrate:fresh`-t nem-prod környezetben). Mérve: a TRUNCATE az AUTO_INCREMENT-et 1-re állítja vissza, míg a DELETE (amit a `queue:flush` valójában végez) NEM. Hatás TRUNCATE után: az új bukások id-ja 1,2,3… < 40, a `where('id','>',40)` szűrő MINDIG üres → „Nincs új elbukott job", örökre, minden 10 percben. A kimaradt NAV-számlákról szóló riasztás tartósan néma. Prodban a `DB::prohibitDestructiveCommands(isProduction())` a `migrate:fresh`-t blokkolja, tehát csak kézi SQL-lel érhető el.

### Bizonyíték

MonitorFailedJobs.php:27-30 — `->where('id', '>', (int) Cache::get(self::LAST_ALERTED_ID_CACHE_KEY, 0))` — monoton növő id feltételezése.
MonitorFailedJobs.php:51 — `Cache::forever(...)`, TTL nélkül.

MÉRT (MariaDB 10.4.28, InnoDB, `failed_jobs`): 2 insert → `max id=2`; `DELETE` → `autoinc after DELETE=3`; insert → `id=3`; `TRUNCATE` → `autoinc after TRUNCATE=1`.

vendor bizonyíték, hogy a `queue:flush` NEM truncate-el: DatabaseUuidFailedJobProvider.php `flush()` → `$this->getTable()->when(...)->delete()`.

A komment (MonitorFailedJobs.php:19-22) csak a cache-ürítés irányát tárgyalja („inkább duplán, mint sehogy") — a fordított, néma irányt nem.

Létező enyhítés: a valós ops-műveletek jó irányba hibáznak — `queue:flush` = DELETE (autoinc marad), `optimize:clear` törli a teljes cache-t (vendor OptimizeClearCommand::getOptimizeClearTasks() tartalmazza a `cache:clear`-t) → vízjel 0 → újra-riaszt (fail-loud). Prodban `DB::prohibitDestructiveCommands(true)` (AppServiceProvider:145) blokkolja a `migrate:fresh`-t; a prod cache Redis, tehát a deploy nem is nyúl hozzá.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem MEDIUM: a kézi `TRUNCATE failed_jobs` prodban valószínűtlen, és a két realisztikus művelet (`queue:flush`, `optimize:clear`) mérhetően a biztonságos irányba hibázik. A PLAN által feltételezett `queue:flush`-vektor konkrétan MEGDŐLT.

**Miért nem alacsonyabb:** Nem INFO: van konkrét állapot → tartós, teljes némaság, és a hibamód irányfüggő (a kód csak az egyik irányt kezeli tudatosan). Egy `min(vízjel, max(id))`-jellegű vagy uuid/`failed_at`-alapú horgony triviálisan kizárná.

---

## Megdőlt PLAN-feltevések (ebben a dimenzióban)

- PLAN-feltevés MEGDŐLT — „mi van ha valaki queue:flush-ol és a tábla TRUNCATE-elődik (autoincrement resetel!)": a `queue:flush` NEM truncate-el. A vendor-kód `DatabaseUuidFailedJobProvider::flush()` egyszerű `->delete()`-et futtat, és MÉRTEM MariaDB 10.4.28 InnoDB-n, hogy DELETE után az AUTO_INCREMENT NEM áll vissza (2 sor → DELETE → autoinc marad 3 → a következő insert id=3). A feltevés kimondott vektora tehát nem áll fenn. A hibamód maga (magasabb vízjel = tartós némaság) valós, de csak kézi `TRUNCATE`/`migrate:fresh` útján érhető el, amit prodban a `DB::prohibitDestructiveCommands(true)` blokkol → ezért lett LOW (P7C-8), nem MEDIUM.

- PLAN-feltevés MEGDŐLT — „a file/database driver incrementje NEM atomi ugyanúgy, mint a redis": a Laravel DatabaseStore::incrementOrDecrement() `connection->transaction()` + `lockForUpdate()` párost használ (DatabaseStore.php:273-310), tehát sor-zárral atomi. Ráadásul a prod store Redis (natív INCR). Ez a feltételezett rés nem létezik; a burst-plafon nem szivárogtathat túl versenyhelyzetben.

- PLAN-feltevés MEGDŐLT — „A listener CSAK prodban él (app()->isProduction()). A VPS test-mode APP_ENV-je mi? Ha nem 'production', a teljes error-riasztás KI VAN kapcsolva": a „test mode" a Stripe/Billingo kulcsokra vonatkozik, NEM az APP_ENV-re. A rögzített prod .env `APP_ENV=production`, és ezt két boot-guard is kikényszeríti (`assertKnownEnvironment()` csak a 4 ismert értéket engedi; üres APP_ENV a config/app.php-ban 'production'-ra fail-safe-el). Az error-riasztás élesben AKTÍV.

- PLAN-feltevés MEGDŐLT — „Notification via mail → a Mailable queue-zható? … Van-e olyan út, ahol MÉGIS queue-ra kerül a riasztás?": nincs. Mindhárom Notification `MailMessage`-t ad vissza (nem Mailable-t) és egyik sem implementálja a ShouldQueue-t, így a MailChannel a szinkron `mailer->send()` ágra megy, a NotificationSender pedig csak ShouldQueue esetén queue-zna. A config/mail.php-ban nincs queue-beállítás. A „notifyNow" tervezési döntés hézagmentesen érvényesül.

- PLAN-feltevés MEGDŐLT (LEFELÉ) — „Cache::forever CSAK sikeres küldés után fut — ha a notifyNow dob, mi történik? (exception felszáll → a parancs elbukik → failed exit; jó vagy baj?)": egyértelműen JÓ, és mértem. A `TransportException` felszáll, a vízjel `NULL` marad, tehát a jel nem vész el — 10 perc múlva újrapróbálja. Emellett a scheduler `report()`-olja a bukást (ScheduleRunCommand.php:214-220), így nyom is keletkezik. Ez a MonitorFailedJobs-ban HELYES sorrend; a hibás sorrend (kulcs a küldés előtt) a két LISTENER-ben van, nem a parancsban — ezt a PLAN nem célozta, önálló leletként rögzítettem (P7C-5).

- PLAN-feltevés PONTOSÍTVA (a hangsúly rossz helyen volt) — „Mi történik a vízjellel optimize:clear / cache:clear / deploy után?": a vizsgált irány ártalmatlan. Az `optimize:clear` valóban tartalmazza a `cache:clear`-t (vendor OptimizeClearCommand::getOptimizeClearTasks()), de a vízjel 0-ra esése FAIL-LOUD (újra-riaszt a még bent lévő bukásokról), pontosan ahogy a kód kommentje szánta („inkább duplán, mint sehogy"). A Ploi deploy-script amúgy sem hív `cache:clear`-t (csak config/route/view:cache). A veszélyes irány a FORDÍTOTT (vízjel > max id), amit a PLAN csak a megdőlt queue:flush-vektoron keresett.

- PLAN-előzmény MEGERŐSÍTVE, DE AZ „EGYETLEN" JELZŐ MEGDŐLT — „BILL-3 = a lánc EGYETLEN néma útja (queue:monitor fix :default)". Önállóan újramértem: a BILL-3 áll (P7C-2), de MÉG HÁROM, egymástól független néma út van ugyanabban a láncban: (a) P7C-1 — a `--max=25` küszöb helyes queue-név MELLETT is némán hagy 24 beragadt jobot (mérve: 24 → nincs QueueBusy, 25 → van); (b) P7C-4 — `MAIL_MAILER=log` esetén a lánc HAMIS SIKERT jelez („Riasztás elküldve") és a vízjelet is lépteti, tehát véglegesen eldobja a jelet; (c) P7C-3 — a betelt burst-keret elnyeli a `critical` szintet. A P7C-4 ráadásul SÚLYOSABB néma út a BILL-3-nál, mert az egyetlen, amelyik pozitív visszajelzést ad kézbesítés nélkül és nem retry-olható.

- PLAN-feltevés MEGDŐLT — a 2026-07-22-i incidens narratívája („a riasztási lánc ~10 perc késéssel beindult") a MÉRÉS SZERINT NEM ÁLLHAT. Újrajátszottam az incidens állapotát (1 `GenerateBillingoInvoice` a `staging` queue-ban, `default` üres): a `queue:monitor database:default --max=25` kimenete `[database] default ... [0] OK`, a `failed_jobs` üres, riasztás nulla. Két független ok zárja ki a riasztást: a queue-név-drift (P7C-2) ÉS a 25-ös küszöb (P7C-1). Az incidenst tehát nem a riasztási lánc tárta fel — érdemes a memória-bejegyzést korrigálni, mert hamis biztonságérzetet ad a lánc lefedettségéről.

- PLAN-fókusz PONTOSÍTVA — „6. Mérd meg VÉGIG a legfontosabb ösvényt: elbukik egy GenerateBillingoInvoice job → melyik lépés tud némán elszakadni": az ELBUKOTT job útja kód-oldalon KETTŐSEN redundáns és tiszta (failed() → report() → error-log → AlertAdminOfLoggedError, PÁRHUZAMOSAN failed_jobs → queue:alert-failed max 10 perc). A tényleges néma zóna nem itt van, hanem a BERAGADT (soha fel nem vett) jobnál — az nem bukik el, nem kerül a failed_jobs-ba, és a torlódás-ág mind a P7C-1, mind a P7C-2 miatt hallgat. A lánc a hangos hibát jól kezeli, a csendes elakadást nem.

- MÓDSZERTANI MEGJEGYZÉS (nem PLAN-feltevés, de rögzítendő) — a kód-kommentek ebben a körben következetesen PONTOSAK voltak: a `notifyNow` indoklása, a dedup-kulcs küldés-előtti zárásának rekurzió-érve, a fix (nem csúszik) burst-ablak és a „inkább duplán, mint sehogy" vízjel-szándék mind méréssel igazolódott. A talált hézagok nem hamis kommentekből, hanem NEM DOKUMENTÁLT határesetekből jönnek (szint-prioritás, küszöb-kalibráció, mail-driver, TRUNCATE-irány).

## TISZTA (verifikálva)

- Cache::increment atomicitása a valós (database) store-on — TISZTA. A PLAN feltevése szerint a file/database driver incrementje „NEM atomi ugyanúgy, mint a redis". Megvizsgáltam a vendor-kódot: DatabaseStore::incrementOrDecrement() a teljes read-modify-write-ot `$this->connection->transaction()`-be zárja és `lockForUpdate()`-tel olvas (vendor/laravel/framework/src/Illuminate/Cache/DatabaseStore.php:273-310) — sor-szintű zárral atomi. A prod store amúgy is Redis (natívan atomi INCR). Mérve: 3 egymást követő increment 1,2,3-at ad. A burst-plafon nem szivárogtathat túl.

- Cache::increment fail-mód lejárt kulcson — TISZTA (fail-open, a helyes irányba). Mérve: hiányzó kulcson `Cache::increment()` `false`-t ad, és `false > 10` PHP-ben `false` → a listener NEM tekinti kimerültnek a keretet, tehát a riasztás átmegy. Az add→increment közti verseny legrosszabb esetben egy extra levelet ad, nem elnyomást.

- A globális burst óra-ablak nem csúszik — TISZTA. Mérve: az `expiration` oszlop 5 increment után bitre azonos marad, mert a DatabaseStore::increment csak a `value`-t UPDATE-eli. A `Cache::add` pedig nem nyúl létező kulcs TTL-jéhez (DatabaseStore.php:214-218: ha `get()` nem null, azonnal `false`). Így a vakfolt fix, legfeljebb ~60 perces — nem tud egy folyamatos hiba-áradattal a végtelenre nyúlni. A kód kommentje (:92-97) pontosan ezt állítja, és a mérés igazolta.

- Per-hiba dedup kulcs-granularitása — TISZTA. A kulcs `szint + md5(üzenet)` (AlertAdminOfLoggedError.php:87-90), tehát egy órán belül minden KÜLÖNBÖZŐ hiba külön riasztást kap, és ugyanaz a beragadt hiba legfeljebb óránként egyszer szól. Külön regresszió-teszt védi mindkét irányt (ErrorLogMonitoringTest.php:44-53 és :55-67 — utóbbi kommentje egy korábbi, közös kulcsú hibát dokumentál). A dedup a küldés ELŐTT zár, ami a rekurzió (levélküldési hiba → error-log → ugyanez a listener) ellen szándékos és szükséges védelem.

- notifyNow tényleg szinkron, nincs rejtett queue-ra kerülési út — TISZTA. A PLAN feltételezte, hogy a Mailable esetleg queue-zható. Ellenőrizve: mind a 3 Notification (`ApplicationErrorDetected`, `FailedJobsDetected`, `QueueBacklogDetected`) `extends Notification` és NEM implementálja a ShouldQueue-t (`grep -n implements app/Notifications/*.php` → 0 találat); `MailMessage`-t adnak vissza, nem Mailable-t, így a MailChannel::send a `$this->mailer->...->send()` szinkron ágra megy (MailChannel.php:66-70), nem a `Mailable::send()`-re. A `NotificationSender::send()` csak `$notification instanceof ShouldQueue` esetén queue-zna (NotificationSender.php:86-91). A config/mail.php-ban nincs queue-beállítás. A riasztás sosem kerül arra a queue-ra, amiről szól.

- A csatorna-hiba nem nyelődik el a MonitorFailedJobs-ban, és a vízjel NEM lép hibás küldésnél — TISZTA. vendor NotificationSender::sendToNotifiable() a Throwable-t `NotificationFailed` esemény után `throw`-olja (NotificationSender.php:160-175). Mérve elérhetetlen SMTP-vel: `TransportException` felszáll, a parancs bukik, és `watermark=NULL` maradt — tehát a bukás nem „fogyasztja el" a jelet, 10 perc múlva újrapróbálja. Ez a helyes, retry-barát sorrend (`Cache::forever` a küldés UTÁN, MonitorFailedJobs.php:51) — épp az ellentéte a P7C-5-ben leírt listener-mintának.

- A summarize() nem tud elhasalni hibás/üres payloadon — TISZTA. `json_decode($failure->payload, true)` null-ra fut hibás JSON-nál, de a `$payload['displayName'] ?? 'ismeretlen job'` null-safe (MonitorFailedJobs.php:67-71); a `str($failure->exception)->before("\n")->limit(200)` üres stringen is működik. Egy sérült failed_jobs sor tehát nem tudja megbuktatni a riasztást (ami az összes többi bukást is elnyomná).

- Az error-riasztás prod-guardja NEM kapcsolja ki élesben a láncot — TISZTA (PLAN-gyanú megdőlt). A PLAN felvetette, hogy a VPS „test mode" APP_ENV-je nem 'production', ami az egész error-riasztást kikapcsolná. Ellenőrizve a rögzített prod .env-ben: `APP_ENV=production` (a Stripe/Billingo van test módban, nem az app-környezet). Ezt két boot-guard is kikényszeríti: `assertKnownEnvironment()` csak a 4 ismert értéket engedi (AppServiceProvider:54-69), és üres/nem beállított APP_ENV a config/app.php-ban 'production'-ra fail-safe-el. Egy elgépelt `APP_ENV=prod` nem csendes downgrade, hanem hard boot-failure. Az `app()->isProduction()`-guard élesben aktív.

- Az event-listener regisztráció megvan, nem függ kézi bejegyzéstől — TISZTA. A PLAN-ban megadott `event:list` eredményt (MessageLogged → AlertAdminOfLoggedError@handle, QueueBusy → AlertAdminOfQueueBacklog@handle) kód-oldalon ellenőriztem: a bootstrap/app.php nem tartalmaz `withEvents`-et, a listenerek auto-discovery-vel (névkonvenció + típusolt `handle()`) találhatók meg. A deploy `route:cache`/`view:cache`-e nem érinti; az `event:cache` épp befagyasztja a felderített mappinget.

- A QueueBusy esemény kilövési pontja és a size() szemantikája — ELLENŐRIZVE, a kód helyesen olvassa. vendor MonitorCommand::parseQueues() a `size >= --max` feltételre állít ALERT-et, és dispatchEvents() csak a nem-OK sorokra lő QueueBusy-t (`>=`, nem `>`). A DatabaseQueue::size() a queue TELJES sorszámát adja (reserved+delayed+pending együtt, DatabaseQueue.php:84-89), tehát egy halott worker által lefoglalt (`reserved_at` beállított) jobok is beleszámítanak — a torlódás-észlelés szempontjából ez a helyes, konzervatív irány. A `config('queue.default')` prefix helyesen dinamikus (mérve: `database`); csak a queue-NÉV hardcode-olt (lásd P7C-2).

- A GenerateBillingoInvoice failed() → riasztás út kód-oldalon hiánytalan — TISZTA. A `failed()` `report($exception ?? new RuntimeException(...))`-t hív (GenerateBillingoInvoice.php:78-85), tehát a végleges bukás garantáltan error-szintű logot szül még akkor is, ha az eredeti exception null. A bootstrap/app.php `withExceptions()` üres, tehát a default handler fut → `Log::error` → MessageLogged → AlertAdminOfLoggedError. Ezzel PÁRHUZAMOSAN a sor bekerül a `failed_jobs`-ba → `queue:alert-failed` (max 10 perc). A ténylegesen ELBUKOTT job tehát KETTŐS, egymástól független riasztási utat kap; a P7C-1/P7C-2 némasága a BERAGADT (fel nem vett) jobra vonatkozik, ami nem bukik el.

- A scheduled command nem-nulla exit kódja nem tűnik el nyomtalanul — TISZTA. vendor ScheduleRunCommand.php:214-220: `if ($event->exitCode != 0 && ! $event->runInBackground) { throw ... }` majd `catch (Throwable $e) { dispatch(new ScheduledTaskFailed(...)); $this->handler->report($e); }`. Egyik ütemezett feladat sem használ `runInBackground()`-ot, tehát mind a `queue:alert-failed` FAILURE-je (üres ADMIN_EMAIL), mind a `cashier:reconcile-subscriptions` kör-fék-FAILURE-je error-logot generál → prodban riasztást kísérel meg. (A kör-fék esetében ez ugyanabba a betelt burst-keretbe futhat — lásd P7C-3.)

- A ReconcileStripeSubscriptions kör-fék (a lánc legsúlyosabb jelének forrása) logikailag helyes — TISZTA. Két fázisra bontva: a döntési fázis a close-ágon NEM ír DB-t, a lezárások csak a fék jóváhagyása után futnak (ReconcileStripeSubscriptions.php:58-114). A fék `killCount >= 5 && killCount/activeCount > 0.5`-nél SEMMIT nem zár le, `Log::critical`-t ír és FAILURE-rel kilép. A `resource_missing`-től eltérő Stripe-hibát nem nyeli el (:160-164). 4 dedikált REC-1 teszt fedi a fék mind a négy határesetét (ReconcileStripeSubscriptionsTest.php:191-243). A C dimenzió szempontjából a jel ELŐÁLLÍTÁSA rendben van — csak a TOVÁBBÍTÁSA tud elnyelődni (P7C-3).

- A riasztási lánc teszt-lefedettsége a némasági módokra — ÉRDEMBEN MEGVAN. tests/Feature/QueueMonitoringTest.php (8 teszt): új bukás riaszt, nincs bukás → nincs riasztás, dedup ugyanarra a bukásra, új bukás új riasztást ad, üres ADMIN_EMAIL → exit 1 + semmi nem megy, QueueBusy → riasztás, óránkénti fojtás, üres ADMIN_EMAIL → csendes kimaradás. tests/Feature/ErrorLogMonitoringTest.php (8 teszt): szintszűrő, prod-guard, per-hiba dedup, két különböző hiba külön riasztása, 30→10 burst-plafon. A most talált MEDIUM-ok mind olyan dimenziókban vannak, amiket a tesztek nem is céloznak (küszöb-kalibráció, queue-név-drift, szint-prioritás, mail-driver).
