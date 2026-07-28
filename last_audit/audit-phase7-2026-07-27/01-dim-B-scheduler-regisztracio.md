# Fázis 7 — Dimenzió B — Scheduler-regisztráció és ütemezett futások

**Finder-dimenzió:** B — scheduler-regisztráció és az ütemezett feladatok üzemi biztonsága (routes/console.php, bootstrap/app.php withRouting(commands:), a 4 ütemezett feladat)

Leletek: 3

> A verifikátorok kifejezetten CÁFOLÁSRA voltak promptolva; bizonytalanság esetén a
> default `refuted=true`. HIGH/MEDIUM-ra 3 eltérő lencse, LOW-ra egykörös.

---

## P7B-1 — queue:monitor a `:default` queue-nevet HARDCODE-olja, miközben a job a DB_QUEUE env-változót követi — queue-név drift esetén a torlódás-figyelés vakon fut

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:23` |
| **Végső súlyosság** | **LOW** |
| **Verifikációs verdikt** | CONFIRMED — 0/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Ops beállítja élesben a `DB_QUEUE=billing`-et (vagy bármely nem-`default` értéket) a .env-ben. MÉRT tény: a `config('queue.connections.database.queue')` ekkor `billing` lesz (mértem: `DB_QUEUE=billing php artisan tinker` → `billing`), tehát a `GenerateBillingoInvoice::dispatch()` a `billing` queue-ra kerül, mert a job semmilyen explicit queue-t nem választ (mértem: `grep onQueue|public $queue` az egész app/-ban → NULLA találat, a Queueable a connection default queue-ját veszi). A `queue:monitor` argumentuma viszont `config('queue.default').':default'` → `database:default`, azaz a connection-nevet dinamikusan oldja fel, de a QUEUE-nevet fixen `default`-ra írja. A MonitorCommand::parseQueues az `explode(':', $queue, 2)`-vel ezt `connection=database, queue=default`-ra bontja, és `size('default')`-ot kérdez. Hatás: a `billing` queue-n 25 fölé torlódó jobokról a QueueBusy esemény SOSEM lő, az AlertAdminOfQueueBacklog nem riaszt → a NAV-számla-torlódás ezen a csatornán néma marad.

### Bizonyíték

routes/console.php:23 `Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])` — a connection dinamikus, a queue-név literál. config/queue.php:42 `'queue' => env('DB_QUEUE', 'default')` — a job-oldal env-vezérelt, tehát a két oldal FÜGGETLENÜL mozog. vendor MonitorCommand::parseQueues → `$this->manager->connection($connection)->size($queue)` — csak a megnevezett queue-t méri. app/Jobs/GenerateBillingoInvoice.php:16-18 — csak `implements ShouldQueue` + `use Queueable`, nincs `$queue` property és nincs `onQueue()`. MÉRT: `DB_QUEUE=billing` → config `billing`, monitor-arg `database:default` (bizonyított divergencia).

### Meglévő mitigációk

A `queue:alert-failed` queue-név-agnosztikus szkenje (MonitorFailedJobs.php:26-30, semmilyen queue-szűrő) a végleges bukást drift alatt is elkapja; a DB_QUEUE nincs se a .env-ben, se a .env.example-ban, tehát mindkét oldal ma a `default` literálra esik; a GenerateBillingoInvoice::failed() report()-ol, ami az AlertAdminOfLoggedError láncon szinkron admin-e-mailt indít.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Három egymást erősítő tény tartja LOW-on. (1) A drift NEM az alapállapot: a `DB_QUEUE` sem a .env-ben, sem a .env.example-ban NEM SZEREPEL (mértem: `grep QUEUE .env .env.example` → csak `QUEUE_CONNECTION=database`), tehát mindkét oldal a `default` literálra esik és EGYEZIK — a hiba csak egy aktív, kézi env-hozzáadással jön létre. (2) A második riasztási csatorna queue-név-AGNOSZTIKUS: a `queue:alert-failed` a teljes `failed_jobs` táblát szkenneli queue-szűrő NÉLKÜL, tehát a VÉGLEG elbukott számla-job queue-névtől függetlenül riaszt. (3) A memóriában rögzített 2026-07-22-i incidens a saját leírása szerint épp NEM maradt néma: „amíg a queue:monitor/AlertAdminOfQueueBacklog riasztási lánc be nem indult (~10 perc késéssel)" — vagyis az akkori drift a CONNECTION/worker--queue szintjén volt, a monitor pedig FIGYELTE azt a queue-t és riasztott. Ez nem adverzariális támadás, hanem ops-elgépelés szűk feltétellel és részleges dupla-fedezettel.

**Miért nem alacsonyabb:** Nem INFO, mert konkrét, végrehajtható forgatókönyv tartozik hozzá mért bizonyítékkal (DB_QUEUE=billing → bizonyított divergencia), és a hatás pénz-kritikus: a NAV-számla-torlódás detektálásának elvesztése. A `default` egyezés ma PUSZTA VÉLETLEN — két független forrás (egy env-default és egy kódliterál) esik ugyanarra az értékre, nem közös igazságforrásból származnak. Ez valós latens hibamód, nem csak megfigyelés.

### Verifikációs szavazatok

**1. szavazat — CONFIRMED** (`refuted=false`, javasolt: LOW)

Minden finder-premisszát ellenőriztem a valós kódban és a vendor-forrásban; egyik sem hamis.

MEGERŐSÍTVE:
1. routes/console.php:23 — `Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])`: a connection dinamikus, a queue-név LITERÁL. Szó szerint igazolva.
2. config/queue.php:42 — `'queue' => env('DB_QUEUE', 'default')`: a job-oldal env-vezérelt. A monitor-argumentumban NINCS semmilyen DB_QUEUE-hivatkozás, tehát a két oldal valóban függetlenül mozog.
3. GenerateBillingoInvoice.php:16-18 — csak `implements ShouldQueue` + `use Queueable`; nincs `$queue` property, nincs `onQueue()`. A `grep -rn "onQueue|public \$queue|\$this->queue"` az egész app/-ban NULLA találat. Egyben ez az EGYETLEN job az app/Jobs/-ban.
4. MonitorCommand::parseQueues — `array_pad(explode(':', $queue, 2), 2, null)` → connection=database, queue=default, majd `size($queue)`.

VENDOR-RÉSZLET, amit a finder NEM ellenőrzött, és ami ERŐSÍTI a leletet: `DatabaseQueue::getQueue($queue)` = `return $queue ?: $this->default;` (586-589). A `?:` fallback csak ÜRES argumentumnál lő. Mivel a parseQueues mindig a nem-üres `'default'` stringet adja át, a `size()` szó szerint `where('queue','default')`-ot szűr, és SOSEM esik vissza a connection konfigurált queue-jára. Tehát `DB_QUEUE=billing` alatt a monitor egy olyan queue-t számol, ahova senki nem ír → örökre 0 méret. A `dispatchEvents` a --max alattit skippeli → QueueBusy sosem lő → AlertAdminOfQueueBacklog sosem fut. A divergencia minden rétegben valós.

MITIGÁCIÓK, szintén megerősítve:
- MonitorFailedJobs.php:27-30 a failed_jobs-ot SEMMILYEN queue-szűrő nélkül szkenneli → a végleges bukást queue-névtől függetlenül elkapja. Sőt, soronként kiírja a `$failure->queue`-t (72. sor), így a driftelt név LÁTHATÓ lenne a riasztó e-mailben.
- Sem a .env, sem a .env.example nem tartalmaz DB_QUEUE-t (csak `QUEUE_CONNECTION=database`). Mindkét oldal ma a `default`-ra esik → a hiba LATENS, nem aktív.
- GenerateBillingoInvoice::failed() report()-ol, ami az AlertAdminOfLoggedError láncot hajtja.
- A tests/Feature/QueueMonitoringTest.php közvetlenül `event(new QueueBusy('database','default',...))`-ot lő, tehát a listenert teszteli, de a monitor queue-név-argumentumát SOHA — a suite nem fogná el a driftet.

SÚLYOSSÁG — LOW marad (a finder saját LOW-ja korrekt):
A trigger nem adverzariális: ops-akciót igényel (DB_QUEUE=billing felvétele), amit senki nem tett meg, amit a repóban semmilyen doksi/deploy-szkript nem javasol, és aminek egy egy-jobos alkalmazásban nincs motivációja. Nincs támadó által elérhető út. A blast radius is szűkebb, mint a "NAV-számla-torlódás néma marad": a torlódás-figyelés a KORAI jelzés csatornája, miközben a tényleges számla-vesztést észlelő két csatorna (queue:alert-failed és failed()→report()) queue-név-agnosztikus és a drift alatt is sértetlen. Egy driftelt deploy elveszti a "meghalt a worker, gyűlnek a jobok" előrejelzést, de NEM a "véglegesen elveszett egy számla" észlelést.

Nem demótolom INFO-ra, mert konkrét állapot→hatás forgatókönyv létezik és egyetlen plauzibilis konfig-sorral elérhető, a fix pedig egy-tokenes (`config('queue.connections.'.config('queue.default').'.queue')`) — a hygiene-érv valós, még ha a kockázat latens is.

REKORD-KORREKCIÓ: ez ugyanaz a defekt, amit a memória BILL-3-ként tart a Fázis 2 körből, ott "a lánc EGYETLEN néma útja"-ként leírva. Ez a jellemzés túl erős, és ez a kör megdönti: a bukás-észlelő utak queue-agnosztikusak, tehát a néma út CSAK a torlódás-jelzésre korlátozódik, nem a számla-vesztés észlelésére.

> **Talált mitigáció:** Nincs olyan mitigáció, ami a leletet megdöntené, de kettő érdemben szűkíti: (1) a `queue:alert-failed` (MonitorFailedJobs.php:27-30) queue-szűrő nélkül szkenneli a failed_jobs táblát, így a VÉGLEGES bukást drift alatt is elkapja, és a riasztó e-mailben soronként kiírja a valódi queue-nevet (72. sor) — tehát a számla-vesztés észlelése NEM néma, csak a korai torlódás-jelzés az; (2) a DB_QUEUE sem a .env-ben, sem a .env.example-ban nem szerepel, mindkét oldal ma a `default` literálra esik, tehát a defekt latens, nem aktív. Ezen felül a GenerateBillingoInvoice::failed() report()-ja az AlertAdminOfLoggedError láncon külön nyomot hagy.

---

## P7B-2 — Egyetlen ütemezett feladatnak sincs withoutOverlapping-je — a napi cashier:reconcile-subscriptions túlfutása párhuzamos Stripe-egyeztetést engedne

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:47` |
| **Végső súlyosság** | **INFO** (finder: LOW → **INFO**) |
| **Verifikációs verdikt** | REFUTED — 1/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Az állomány nő (pl. néhány ezer aktív előfizetés) vagy a Stripe API lassul/részlegesen kiesik. A reconcile SOROSAN, előfizetésenként EGY blokkoló HTTPS retrieve-et végez (`Subscription::query()->active()->cursor()->each()` → `asStripeSubscription()`), batchelés és cache nélkül. Ha egy futás túllépi a 24 órát, a másnapi cron elindítja a MÁSODIK példányt is, miközben az első még fut. Hatás: kétszeres Stripe API-terhelés (rate-limit kockázat), és a két futás egymástól függetlenül számolja a kör-fék hányadát — ha az első példány közben már lezárt sorokat, a második `active()` halmaza kisebb, ami a `killCount/activeCount` arányt eltolhatja, azaz a blast-radius-fék számítási alapja megbízhatatlanná válik.

### Bizonyíték

routes/console.php:22-47 — mind a 4 `Schedule::command(...)` CSUPASZ gyakoriság-hívással zárul (`->everyTenMinutes()` / `->daily()`); mértem: `grep -rn 'withoutOverlapping|runInBackground|onFailure|onSuccess|pingOnFailure|evenInMaintenanceMode' routes/ app/ bootstrap/ config/` → NULLA találat a scheduleren. ReconcileStripeSubscriptions.php:67 soros cursor + :155 `asStripeSubscription()` = 1 blokkoló Stripe-hívás/sub. A kör-fék bemenetei (:87 `$killCount`, :58 `$activeCount`) futásonként lokálisak, nincs cross-run lock.

### Meglévő mitigációk

A `markAsCanceled()` (vendor Subscription.php:1140) idempotens, fix értékeket ír; a kör-fék (MAX_KILL_RATIO 0.5 + MIN_KILL_COUNT_FOR_GUARD 5) a téves tömeges lezárást önmagában is fogja; az AppServiceProvider::assertStripeSecretMatchesEnvironment boot-guard megelőzi a leggyakoribb kiváltó okot (test-módú kulcs élesben).

### Súlyosság-indoklás

**Miért nem súlyosabb:** A művelet nagyrészt idempotens, ezért a párhuzamos futás kára korlátozott: a `markAsCanceled()` fix értékeket ír (`stripe_status=canceled`, `ends_at=now()`), így kétszeri lefutása nem hoz új kárt; a Stripe-olvasás pedig hatásmentes. A jelenlegi méret távol van a küszöbtől: MÉRTEM, 8 subscription összesen, ebből 1 aktív → a futás másodperces, a 24 órás túlfutás ma fizikailag elérhetetlen. Nincs adatvesztés, nincs távoli kihasználhatóság.

**Miért nem alacsonyabb:** Nem INFO, mert konkrét skálázási forgatókönyv és mért mechanizmus (soros, per-sub blokkoló hálózati hívás) áll mögötte, és a hatás nem csak teljesítmény: a kör-fék — a rendszer EGYETLEN védelme a tömeges téves lezárás ellen — számítási alapja sérül párhuzamos futásnál. A `withoutOverlapping()` egyetlen sor, tehát ez valós, kezelhető hygiene-hiányosság.

### Verifikációs szavazatok

**1. szavazat — REFUTED** (`refuted=true`, javasolt: INFO)

A finder MINDEN szerkezeti tényállítása IGAZ és reprodukáltam: (1) routes/console.php:22-47 mind a 4 Schedule::command csupasz gyakoriság-hívással zárul; (2) a `withoutOverlapping|runInBackground|onFailure|onSuccess|pingOnFailure|evenInMaintenanceMode` grep a routes/ app/ bootstrap/ config/ felett NULLA találat; (3) a :67 soros `active()->cursor()->each()`, a :155 `asStripeSubscription()` = 1 blokkoló Stripe HTTPS-hívás/sub, batchelés/cache nélkül; (4) a $killCount/$activeCount futás-lokális, nincs cross-run lock; (5) framework-szinten is igaz: az Event::run() (Event.php:135-152) csak a `shouldSkipDueToOverlapping()`-ot nézi, ami `$this->withoutOverlapping && ...` — a flag hamis, így a mutex sosem kerül szóba, nincs implicit átfedés-védelem.

A lelet mégis MEGDŐL, mert a forgatókönyvet két, a finder által nem vizsgált tény semmisíti meg.

(A) A FOREGROUND-végrehajtás önmagát cáfoló előfeltételt szab. Mivel runInBackground nincs beállítva, a scheduler blokkoló foreach-ben, szinkronosan futtatja a parancsokat. Ahhoz, hogy a másnapi cron egy MÁSODIK reconcile-t indítson az első mellé, a cron-indított `schedule:run` processznek 24 óra után is blokkolva kell lennie. Abban a világban az átfedő reconcile mellékes: ugyanaz a beragadt processz 24 órán át a queue:alert-failed és queue:monitor futását is megakadályozta, azaz a teljes queue-riasztási lánc (az első-számla incidens szerinti valódi biztonsági háló) halott. Az átfedés tehát ennek a kiesésnek a TÜNETE, nem független kockázat. Ráadásul a Ploi percenkénti schedule:run cronja mellett a 24 órán át blokkolt futás ~1440 felhalmozódott processzt jelent — hangosan látható ops-állapot, nem néma hiba.

(B) A futásidő-premissza nagyságrendekkel hamis. 24 óra soros futáshoz ~200-500 ms/retrieve normál Stripe-latenciával kb. 170 000-430 000 aktív előfizetés kell. A finder saját kiváltó feltétele („néhány ezer aktív előfizetés") percekben mérhető futást ad, nem napokban. Egyetlen fizetős árral, go-live előtt a tényleges és a szükséges állomány között 4-5 nagyságrend a szakadék.

(C) A két kár-állítás külön-külön is összeomlik. A „kétszeres Stripe-terhelés": egy olyan állományon, ami egyáltalán átfedést produkál, már egyetlen futás is a rate-limiten ülne — a második futás nem a kiváltó ok. A „kör-fék megbízhatatlan számítási alapja" pedig VISSZAFELÉ igaz: a fék akkor húz, ha killCount/activeCount > 0.5; ha az 1. futás már lezárt sorokat, a markAsCanceled() ends_at=now()-ot ír, így azok a sorok kiesnek a scopeActive()-ból, tehát a 2. futás a NEVEZŐBŐL és a SZÁMLÁLÓBÓL is egyszerre veszíti el őket. A hányad nem úgy tolódik el, hogy a guard kikapcsolna — a maradék halmazon inkább érzékenyebb lesz, és fail-safe viselkedik (semmit nem zár le, FAILURE). A finder nem azonosított olyan bemenetet, ami a nevezőt felfújja a számláló megtartása mellett — pedig épp az kellene a fék legyőzéséhez.

Ami a lelet alatt VALÓBAN helyes: hygiene-hézag. A withoutOverlapping() és a failure-hookok standard védekező praxis ütemezett feladatokon, és itt ingyen hozzáadhatók lennének. Ez igaz, de ezen a skálán forgatókönyv-mentes → INFO.

Jelzés a fázis-riportnak (NEM a vizsgált lelet): ugyanebben a fájlban a védhetőbb megfigyelés a finder állításának INVERZE — mivel mind a 4 feladat foreground-ban, egyetlen blokkoló ciklusban fut, egy lassú/beragadó feladat késlelteti az utána következő MINDEN feladatot ugyanabban a tickben, és a queue:alert-failed / queue:monitor épp a riasztási lánc. Ez a megosztott-sors megfigyelés érdemes rögzítésre, de nem ez a vizsgált lelet.

> **Talált mitigáció:** A négy ütemezett feladat FOREGROUND-ban fut (a `runInBackground` soha nincs beállítva — a grep 0 találata ezt is igazolja), így a CommandBuilder::buildCommand() a buildForegroundCommand() ágra megy (CommandBuilder.php:16-38), és a ScheduleRunCommand::handle() (:122) blokkoló `foreach`-ben, szinkronosan hívja `$event->run()`-t. Ezért a reconcile MÁSODIK példánya csak akkor indulhat el, ha a cron által indított `schedule:run` processz 24 óra után MÉG MINDIG blokkolva van — abban az állapotban ugyanaz a beragadt processz már 24 órán át a `queue:alert-failed` és `queue:monitor` futását is megakadályozta, vagyis az átfedés következmény, nem önálló kockázat, és a Ploi percenkénti cronja mellett ~1440 felhalmozódott processz formájában hangosan látható. Emellett a kör-fék káros hatása INVERTÁLT: a `markAsCanceled()` (vendor Subscription.php:1140-1146) `ends_at=now()`-ot ír, így a lezárt sorok kiesnek a `scopeActive()`-ból (Cashier Subscription.php:244-261) — a 2. futás a SZÁMLÁLÓBÓL és a NEVEZŐBŐL is egyszerre veszíti el őket, tehát a fék nem tompul, hanem fail-safe módon érzékenyebbé válik (semmit nem zár le, FAILURE-rel kilép).

---

## P7B-3 — Nincs schedule-heartbeat: ha a schedule:run cron maga leáll, a teljes monitoring-lánc némán megszűnik

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:22` |
| **Végső súlyosság** | **INFO** (finder: LOW → **INFO**) |
| **Verifikációs verdikt** | PLAUSIBLE — 1/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

A Ploi/VPS cron bejegyzés törlődik, a Supervisor/cron daemon leáll, vagy egy szerver-migráció után nem áll vissza a `* * * * * php artisan schedule:run`. Ekkor egyszerre esik ki MIND A NÉGY ütemezett feladat — köztük maga a két riasztó (`queue:alert-failed`, `queue:monitor`). Hatás: nincs semmilyen külső jel a kiesésről, mert a riasztás forrása ugyanaz a cron, amelyik meghalt (self-referential monitoring). A NAV-számla elbukhat, a queue torlódhat, a beragadt előfizetés hetekig „ingyen prémium" maradhat — mindez teljesen néma. A hibaészlelés ekkor emberi véletlenre vagy user-panaszra szorul.

### Bizonyíték

routes/console.php:20 komment maga rögzíti a függőséget: „Futtatásához a szerveren mennie kell a schedule:run cronnak (Ploi)" — de kódoldali visszajelzés nincs hozzá. Mértem: `grep -rn 'pingOnFailure|ping\(|thenPing|onSuccess|onFailure' routes/ app/ config/` → NULLA; `grep -n 'schedule|monitor|oh-dear|sentry' composer.json` → NULLA (nincs se spatie/laravel-schedule-monitor, se Sentry cron-monitor, se dead-man's-switch). A 4 riasztási út (FailedJobsDetected, QueueBacklogDetected, ApplicationErrorDetected, reconcile-FAILURE) MINDEGYIKE a scheduleren belülről indul.

### Meglévő mitigációk

A jobok perzisztensek a `jobs` táblában, a cron visszaállásakor feldolgozódnak (ezt a 2026-07-22-i incidens igazolta: a beragadt job azonnal lefutott); a /up health endpoint létezik (bootstrap/app.php:18), bár a schedulert nem fedi; a memória ops-nyitott pontként már nyilvántartja („nyitva csak ops: uptime + VPS cron/worker").

### Súlyosság-indoklás

**Miért nem súlyosabb:** Ez infrastruktúra-üzemeltetési hézag, nem kódhiba, és nem adverzariálisan kiváltható — külső támadó nem tudja a cront leállítani. A bekövetkezés valószínűsége alacsony és jellemzően egy tudatos ops-esemény (migráció, újratelepítés) kíséri, amikor a szolgáltatás állapotát amúgy is ellenőrzik. Nincs közvetlen adatvesztés: a jobok a `jobs` táblában MEGMARADNAK és a cron visszaállása után lefutnak. A kockázat késleltetett észlelés, nem véglegesen elveszett adat.

**Miért nem alacsonyabb:** Nem INFO, mert világos forgatókönyv → konkrét hatás (a teljes riasztási felület egyidejű, néma elvesztése), és architekturális gyökere van: a monitoring ugyanarra a futtatókörnyezetre támaszkodik, amit monitoroznia kellene. Egy külső dead-man's-switch (heartbeat-ping) pontosan ezt a vakfoltot zárná be.

### Verifikációs szavazatok

**1. szavazat — PLAUSIBLE** (`refuted=true`, javasolt: INFO)

Mechanical claims all verified true: routes/console.php:22 holds exactly 4 cron-dependent scheduled tasks; line 20 comment records the dependency; both finder greps reproduce with ZERO hits (no pingOnFailure/onFailure/thenPing in routes/ app/ config/; no schedule-monitor, Sentry cron-monitor, Oh Dear, or dead-man's-switch in composer.json); no cron/heartbeat config anywhere in repo; /up (bootstrap/app.php:18) is stock Laravel health and does not cover the scheduler.

REFUTED PREMISE — the chain is not wholly self-referential. Only 2 of 4 paths are scheduler-borne: FailedJobsDetected (queue:alert-failed) and QueueBacklogDetected (QueueBusy fired by queue:monitor) — both genuinely die with the cron. But ApplicationErrorDetected is cron-INDEPENDENT via MessageLogged in the worker process (see blocking_mitigation_found). And the reconcile-FAILURE path signals through that SAME cron-independent listener (Log::critical at ReconcileStripeSubscriptions.php:94 and :197) — the finder's own evidence contradicts its mechanism claim, though the outcome (no detection of stuck subscriptions) holds because the command itself is cron-launched.

Net residual risk is real but narrower than framed: cron death silences failed-job and backlog alerts and lets stuck "free premium" subscriptions accumulate, yet arbitrary application errors — including the invoice-failure path the scenario leads with — still alert.

Severity LOW -> INFO. No attacker, no input, no state transition. It is the absence of an external dead-man's-switch, which is inherently unfixable in-repo: no application code can detect its own non-execution: it requires an off-box observer. Already tracked as an open ops item in last_audit/PLAN.md:150 and in project memory. Per the stated method, a finding with no code-level scenario and no code-level fix is INFO.

Ops note (larger and more probable sibling risk): ADMIN_EMAIL is empty in .env.example:78 and every alert path fails closed and SILENT on a missing value (AlertAdminOfLoggedError:47-49, AlertAdminOfQueueBacklog:23-25; only MonitorFailedJobs:41 prints to stderr). An unset ADMIN_EMAIL on the VPS would mute the entire chain including the cron-independent leg — strictly worse than cron death, and belongs in the same ops verification step.

> **Talált mitigáció:** AlertAdminOfLoggedError (app/Listeners/AlertAdminOfLoggedError.php:35) is bound to MessageLogged, NOT to the scheduler. It fires in any PHP process — web requests and, decisively, the queue worker, which is a separate Supervisor daemon independent of the schedule:run cron. GenerateBillingoInvoice::failed() (app/Jobs/GenerateBillingoInvoice.php:82) calls report($exception) -> Log::error -> MessageLogged -> synchronous notifyNow (line 71-76, deliberately NOT queued). Therefore the finder's headline scenario ("a NAV-szamla elbukhat ... mindez teljesen nemа") is false: with the cron fully dead, a failed Billingo invoice job STILL emails the admin as long as the worker runs. This refutes the load-bearing premise that all four alert paths originate inside the scheduler.

---

## Megdőlt PLAN-feltevések (ebben a dimenzióban)

- MEGDŐLT — „van-e olyan deploy-állapot, amiben a scheduler NÉMÁN nem regisztrál" (route:cache / config:cache / commands: betöltés): NINCS. Empirikusan cache-eltem a configot és a route-okat, a schedule:list utána is a teljes 4 feladatot adta. A vendor-mechanizmus is igazolja: a withRouting(commands:) a ConsoleKernel::addCommandRoutePaths útján tölt (Kernel.php:521), ami architekturálisan független a webes route-cache-től (a RouteCacheCommand nem is ismer console-route-ot). A feltevés tárgya nem létezik.

- MEGDŐLT — a PLAN a sanctum:prune-expired --hours szemantikáját nyitott kérdésként kezeli („expires_at VAGY last_used_at?") és élő-token-törlést gyanít. A vendor-kód egyértelmű: a --hours az EXPIRES_AT-ra vonatkozik, a last_used_at NEM szerepel a parancsban egyáltalán. A 90 napos player-token jövőbeli expires_at-tel soha nem esik bele. A veszélyes created_at-alapú második ág `config('sanctum.expiration')`-höz kötött, ami MÉRTEN null → nem fut. Nincs olyan eset a jelenlegi konfiguráción, amikor élő tokent törölne.

- MEGDŐLT — „a reconcile FAILURE a lánc egyik lehetséges NÉMA útja": nem néma, hanem KÉTSZERESEN fedett. Egyrészt a kód maga Log::critical-t ír a FAILURE előtt (ReconcileStripeSubscriptions.php:94), másrészt a vendor ScheduleRunCommand a nem-nulla exit-kódot kivétellé alakítja és report()-olja (ScheduleRunCommand.php:214-219), ami default ERROR szinten logol (Handler::mapLogLevel). MINDKETTŐ az AlertAdminOfLoggedError ALERT_LEVELS-ébe esik → szinkron admin-e-mail. A feltételezett néma út valójában a legjobban fedett út.

- RÉSZBEN MEGDŐLT — a PLAN a 2026-07-22-i incidenst a queue:monitor néma kudarcának precedenseként hozza fel („az éles Billingo-számla NÉMÁN elmaradt"). Az incidens-memória saját szövege ezt cáfolja: a számla késett, de a riasztás MŰKÖDÖTT — „amíg a queue:monitor/AlertAdminOfQueueBacklog riasztási lánc be nem indult (~10 perc késéssel)". Az akkori drift a worker --queue / connection szintjén volt, a monitor pedig figyelte az érintett queue-t. A most azonosított queue-NÉV hardcode (P7B-1) egy MÁS, még nem bekövetkezett hibamód — valós, de nem az incidens root cause-a, és a `default`-egyezés miatt ma nem aktív.

- MEGDŐLT — az implicit feltevés, hogy a queue-név drift a NAV-számla-problémát TELJESEN elnémítaná. A queue:alert-failed queue-agnosztikus táblaszkennje (MonitorFailedJobs.php:26-30, semmilyen queue-szűrő) miatt a VÉGLEG elbukott számla-job drift alatt is riaszt, és a GenerateBillingoInvoice::failed() report()-ja is e-mailt indít. A drift csak a TORLÓDÁS-detektálást (beragadt, még nem bukott job) vakítja el — szűkebb blast radius, mint a PLAN feltételezi. Ez vitte a P7B-1-et MEDIUM helyett LOW-ra.

## TISZTA (verifikálva)

- Scheduler-regisztráció NEM üthető ki route:cache / config:cache által — TISZTA. Empirikusan teszteltem: `php artisan config:cache && php artisan route:cache` UTÁN a `schedule:list` továbbra is pontosan a 4 feladatot adja vissza, változatlanul. A mechanizmus a vendorban is igazolt: a `withRouting(commands:)` (ApplicationBuilder.php:179) a `withCommands([$commands])`-ra delegál, ami `addCommandRoutePaths()`-ba köt (Kernel.php:521-525: `foreach ($this->commandRoutePaths as $path) { if (file_exists($path)) require $path; }`) — ez a console-bootstrap külön útja, teljesen független a RouteCacheCommand webes route-cache-étől (mértem: a RouteCacheCommand-ban NINCS console/commands hivatkozás). Nincs tehát olyan deploy-állapot, amiben a cache-elés némán deregisztrálná az ütemezést. A cache-eket a mérés után visszaállítottam az eredeti (nem cache-elt) állapotra.

- sanctum:prune-expired --hours=24 NEM töröl élő player-tokent — TISZTA. A vendor-parancsot elolvastam (vendor/laravel/sanctum/.../PruneExpired.php): az ELSŐ ág `where('expires_at', '<', now()->subHours($hours))->delete()` — tehát a `--hours` az EXPIRES_AT-ra vonatkozik (NEM last_used_at-ra), és csak a MÁR LEJÁRT tokeneket törli, további 24 órás kegyelmi idővel. A 90 napos player-token (PlayerPairingController.php:150-154, `now()->addDays(PlayerPairing::TOKEN_LIFETIME_DAYS)`, TOKEN_LIFETIME_DAYS=90) `expires_at`-je a jövőben van, így az első ág soha nem érinti. A MÁSODIK ág lenne a veszélyes (`where('created_at', '<', now()->subMinutes($expiration + $hours*60))` — created_at alapján akár élő tokent is törölne), DE ez `if ($expiration = config('sanctum.expiration'))` mögött van, és MÉRTEM: `config('sanctum.expiration')` = NULL (config/sanctum.php:53, és nincs SANCTUM_EXPIRATION env sem a .env-ben, sem a .env.example-ban). Az ág nem fut. Latens megjegyzés (nem lelet): ha valaki KÉSŐBB beállítaná a SANCTUM_EXPIRATION-t, ez az ág aktiválódna és a 90 napos player-tokeneket created_at alapján vághatná — ma nem áll fenn.

- A reconcile FAILURE exit-kódja NEM néma — a riasztási lánc végig zárt, TISZTA. Végigmértem: (1) a kör-fék ágán a ReconcileStripeSubscriptions.php:94 `Log::critical(...)` fut MÉG a `return self::FAILURE` (:103) előtt; (2) a `critical` szint szerepel az AlertAdminOfLoggedError::ALERT_LEVELS-ben (:33), így a MessageLogged listener (event:list igazolta a regisztrációt) e-mailt küld `notifyNow`-val; (3) FÜGGETLEN második út: a nem-nulla exit-kódot a vendor ScheduleRunCommand.php:214-219 `throw new Exception("Scheduled command [...] failed with exit code [...]")` + `$this->handler->report($e)` kezeli, a `report()` pedig `mapLogLevel()` (Handler.php:1135-1139) szerint DEFAULT LogLevel::ERROR szinten logol — ami szintén ALERT_LEVELS-tag. Tehát a FAILURE két egymástól független úton is admin-e-mailt eredményez. Az ADMIN_EMAIL be van állítva (.env:67), így a `if (! $adminEmail) return;` guard nem nyeli el. A `$failed > 0` ág (:119) ugyanígy: a `report($e)` hívások (:83, :112) már önmagukban error-szintű logot adnak.

- A riasztási e-mailek nem a queue-n mennek — TISZTA, és ez a lánc kulcs-erőssége. Mind a három riasztó SZINKRON küld: MonitorFailedJobs.php:48 `->notifyNow(...)`, AlertAdminOfQueueBacklog.php:34-35 `->notifyNow(...)`, AlertAdminOfLoggedError.php:71-72 `->notifyNow(...)`. Ez pontosan a helyes döntés: ha a queue/worker a beteg, egy queue-ra tett riasztás sosem érne célba. Ellenőriztem, hogy a kód meg is felel a kommentnek — nem `notify()`.

- Az AlertAdminOfLoggedError kettős throttle-ja nem nyeli el a reconcile kritikus riasztását — TISZTA. A per-hiba dedup kulcsa a szint+üzenet md5-e (:87-90), a reconcile kör-fék üzenete FIX szöveg, tehát óránként legfeljebb egyszer megy — ami napi futásnál (0 0 * * *) nem jelent elnyelést. A globális burst-plafon (10/óra, :31) atomi `Cache::add`+`increment` párral működik (:100-102), a TTL nem csúszik; napi egy kritikus riasztás mellett a keret nem merül ki. A `Cache::increment` a `database` cache-store-on (CACHE_STORE=database, .env:40) atomi, tehát a throttle nem versenyzik el.

- Maintenance mode: az ütemezett feladatok maintenance alatt NEM futnak, és ez a helyes/szándékolt viselkedés — TISZTA. A vendor Event::isDue() (Event.php:287) `if (! $this->runsInMaintenanceMode() && $app->isDownForMaintenance()) return false;`, és mértem, hogy egyetlen feladat sem hív `evenInMaintenanceMode()`-ot → maintenance alatt mind a 4 kimarad. Nem lelet: a maintenance jellemzően rövid, tudatos deploy-ablak, ahol a jobok a `jobs` táblában megvárják a visszaállást, és a reconcile egy nap kihagyása a napi kadenciánál érdemi kárt nem okoz.

- A 4 destruktív manuális parancs (words:import, words:fix-levels, ai:cache:clear, billing:end-trial) tényleg NINCS ütemezve — TISZTA. A `schedule:list` pontosan 4 bejegyzést ad, és a routes/console.php-ban (teljes fájl, 48 sor) csak a queue:alert-failed, queue:monitor, sanctum:prune-expired és cashier:reconcile-subscriptions szerepel. Nincs rejtett `withSchedule()` sem: a bootstrap/app.php (39 sor, teljesen elolvasva) csak `withRouting`/`withMiddleware`/`withExceptions`-t hív, scheduler-closure nincs benne. Tömeges mutáció tehát nem indulhat automatikusan.

- A queue:alert-failed queue-név-független — TISZTA, és ez a P7B-1 legfontosabb kompenzáló kontrollja. A MonitorFailedJobs.php:26-30 a `failed_jobs` táblát CSAK `id > last_alerted_id` szerint szűri, queue- vagy connection-szűrő NÉLKÜL, és a queue-nevet csak a riport-összefoglalóba veszi be (:73 `'queue' => $failure->queue`). Bármely queue-ra dispatch-elt, VÉGLEG elbukott job riasztást ad — a queue-név drift ezt az utat nem vakítja el.
