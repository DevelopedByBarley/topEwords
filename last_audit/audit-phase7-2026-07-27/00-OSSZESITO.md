# Fázis 7 audit — Console commands & scheduled (2026-07-27) — **LEZÁRVA**

**Tárgy:** `last_audit/PLAN.md` Fázis 7 (109-112. sor) — `EndTrialNow`, `FixWordLevels`,
`ImportWords`, `ClearAiCache`, `MonitorFailedJobs`: destruktivitás, guardok,
scheduler-regisztráció, riasztási lánc.
**HEAD:** `6852fe6` (tiszta working tree) · **Módszer:** multi-agent workflow,
dimenzió-finderek + adverzariális verifikáció (HIGH/MEDIUM-ra 3 eltérő lencse, LOW-ra
egykörös), `default refuted=true` bizonytalanság esetén.
**CSAK DOKUMENTÁLÁS — kód nem módosult** (audit-no-fixes).

> **A kör két menetben készült.** Az első menet (2026-07-27) usage-korlát miatt megállt az
> A-dimenzió és a C-verifikáció előtt; a második menet (2026-07-28) ezt pótolta. A korábbi
> riport `MEDIUM*` (verifikálatlan) jelölései **mind feloldva** — lásd
> „Súlyosság-változások a verifikáció után". A vizsgált felület a két menet között
> **változatlan**: `git log fbf4405..6852fe6 -- app/Console/ routes/console.php app/Listeners/
> app/Notifications/ app/Providers/AppServiceProvider.php` → **üres**.

## Verdikt

**0 HIGH · 0 MEDIUM · 12 LOW · 11 INFO.** Go-live blokkoló: **0**.
A kör tesztjei **127 passed / 389 assertion, nulla regresszió**.

**A verifikáció egyetlen MEDIUM-ot sem hagyott állva:** a 7 MEDIUM-gyanús leletre leadott
**31 adverzariális szavazatból 27 refuted**. Mind a 4 legsúlyosabbnak hitt C-lelet
LOW-ra vagy INFO-ra esett, és mindhárom A-dimenziós MEDIUM is megdőlt.

| id | súly | verdikt | cím | fájl:sor |
|---|---|---|---|---|
| P7C-2 | LOW | 2/3 refuted | `queue:monitor` fixen `:default` queue-t figyel (BILL-3) | [routes/console.php:23](../../routes/console.php#L23) |
| P7C-3 | LOW | 2/3 refuted | A burst-plafon szint-vak: 10 `error` után a `critical` ~1 órára néma | [AlertAdminOfLoggedError.php:65](../../app/Listeners/AlertAdminOfLoggedError.php#L65) |
| P7C-1 | INFO | 3/3 refuted | `--max=25` küszöb kalibrálatlan | [routes/console.php:23](../../routes/console.php#L23) |
| P7C-4 | INFO | 3/3 refuted | `MAIL_MAILER=log` → hamis siker + vízjel lép | [config/mail.php:17](../../config/mail.php#L17) |
| P7C-5 | INFO | refuted | Mindkét listener a küldés ELŐTT zárja a throttle-t | [AlertAdminOfQueueBacklog.php:30](../../app/Listeners/AlertAdminOfQueueBacklog.php#L30) |
| P7C-6 | INFO | refuted | Rossz (de RFC-helyes) `ADMIN_EMAIL` → hamis siker | [config/app.php:27](../../config/app.php#L27) |
| P7C-7 | INFO | refuted | Nincs dead-man's-switch a `schedule:run`-ra (≈P7D-5) | [routes/console.php:22](../../routes/console.php#L22) |
| P7C-8 | INFO | CONFIRMED (INFO) | A vízjel TRUNCATE-re tartósan némává válik | [MonitorFailedJobs.php:51](../../app/Console/Commands/MonitorFailedJobs.php#L51) |
| A-1 | LOW | 6/6 refuted | `ClearAiCache`: falsy `--task`/`--word` → teljes wipe | [ClearAiCache.php:31](../../app/Console/Commands/ClearAiCache.php#L31) |
| A-2 | LOW | 2/3 refuted | A wipe költsége a **userek** AI-keretére terhelődik | [AiCacheService.php:32](../../app/Services/AiCacheService.php#L32) |
| A-3 | LOW | 3/3 refuted | `cache:clear` és `queue:flush` prodban fék nélkül fut | [AppServiceProvider.php:145](../../app/Providers/AppServiceProvider.php#L145) |
| A-4 | LOW | 6/6 refuted | `ImportWords` mutábilis `master` branchből számol rankot | [ImportWords.php:64](../../app/Console/Commands/ImportWords.php#L64) |
| A-5 | LOW | — | Confirm-guard csak `APP_ENV==='production'` alatt aktív | [ClearAiCache.php:25](../../app/Console/Commands/ClearAiCache.php#L25) |
| A-6 | INFO | — | `db:seed` prodban ismert-jelszavú fiókot hozhat létre (nem admin) | [DatabaseSeeder.php:18](../../database/seeders/DatabaseSeeder.php#L18) |
| A-8 | INFO | — | `EndTrialNow` ma halott kód, a kockázat feltételes | [EndTrialNow.php:53](../../app/Console/Commands/EndTrialNow.php#L53) |
| A-9 | INFO | — | `ai_word_cache`-nek nincs TTL-je; a wipe mérete előre ismeretlen | [AiWordCache.php:11](../../app/Models/AiWordCache.php#L11) |
| P7D-2 | LOW | CONFIRMED | TEST-1: az `active()` scope kizárja a past_due-t | [ReconcileStripeSubscriptions.php:174](../../app/Console/Commands/ReconcileStripeSubscriptions.php#L174) |
| P7D-3 | LOW | CONFIRMED | ALERT-1: üres `ADMIN_EMAIL` → mind a 3 út elhal | [config/app.php:27](../../config/app.php#L27) |
| P7D-5 | LOW | CONFIRMED | SCHED-1: nincs heartbeat a `schedule:run`-ra | [routes/console.php:22](../../routes/console.php#L22) |
| P7D-7 | LOW | CONFIRMED | `ImportWords` + `FixWordLevels` teljesen teszteletlen | [FixWordLevels.php:26](../../app/Console/Commands/FixWordLevels.php#L26) |
| P7B-1 | LOW | CONFIRMED | `queue:monitor` queue-név hardcode (P7C-2 szűkebb keretben) | [routes/console.php:23](../../routes/console.php#L23) |
| P7D-1 | INFO | 2/3 refuted | REC-1 kör-fék inert 5 alatti állományon (finder: MEDIUM) | [ReconcileStripeSubscriptions.php:128](../../app/Console/Commands/ReconcileStripeSubscriptions.php#L128) |
| P7B-2 / A-7 | INFO | REFUTED | Nincs `withoutOverlapping` (finder: LOW) | [routes/console.php:47](../../routes/console.php#L47) |
| P7B-3 | INFO | REFUTED | Nincs schedule-heartbeat (finder: LOW) | [routes/console.php:22](../../routes/console.php#L22) |
| P7D-4 | INFO | CONFIRMED | SCHED-3: `stripe_webhook_events` prune nélkül nő | [StripeWebhookController.php:49](../../app/Http/Controllers/StripeWebhookController.php#L49) |
| A-10 | INFO | — | `ReconcileStripeSubscriptions` — legnagyobb üzleti felület, kettős védelemmel | [ReconcileStripeSubscriptions.php:37](../../app/Console/Commands/ReconcileStripeSubscriptions.php#L37) |
| P7D-6 | INFO | — | P7-L4: vízjel-vesztés → újra-riaszt (fail-safe irány) | [MonitorFailedJobs.php:21](../../app/Console/Commands/MonitorFailedJobs.php#L21) |
| P7D-8 | INFO | — | P7-L2: a fék >50%-os sávja legitim lemondásnál is tripel | [ReconcileStripeSubscriptions.php:37](../../app/Console/Commands/ReconcileStripeSubscriptions.php#L37) |

Részletek: [04-dim-A-manualis-parancsok.md](04-dim-A-manualis-parancsok.md).

## Súlyosság-változások a verifikáció után

Minden esetben megnevezve, **melyik premissza omlott össze**.

**P7C-4: MEDIUM → INFO (3/3 refuted).** A kiváltó feltétel **nem áll fenn**. A lelet az
egész láncot a `MAIL_MAILER=log`-ra alapozta, `config/mail.php:17` fallbackje és a
`.env.example:59` alapján — de a **futásidejű** érték mérve `mail.default = smtp`
(`.env:50 MAIL_MAILER=smtp`, `MAIL_HOST=smtp.rackhost.hu`). Az `.env.example` nem a
telepített konfiguráció. Másodszor: a „jel véglegesen elvész" is hamis — a
`GenerateBillingoInvoice::failed()` `report()`-tal ERROR-szinten naplóz, ami külön úton
riaszt, és nincs `queue:prune-failed` ütemezve, tehát a `failed_jobs` sorok megmaradnak.
*Ez volt a korábbi riport szerint a legsúlyosabb lelet — és a leggyengébb lábakon állt.*

**P7C-1: MEDIUM → INFO (3/3 refuted).** A „25 egyidejű job soha nem áll elő → halott kód"
premissza hamis: a riasztás célpontja a **leállt worker**, ahol a queue monoton nő, tehát a
25-ös küszöböt **átlépi**. Ráadásul a 2026-07-22-i incidenst nem is ez az út detektálja,
hanem a `queue:alert-failed`.

**P7C-2: MEDIUM → LOW (2/3 refuted).** A mechanizmus igaz (a queue-NÉV string-literál), de
a „**véglegesen** elvakul" abszolútum hamis: a `queue:monitor` `everyTenMinutes()`
**állapotmentesen** ismétlődik, a konfig javítása után a következő körben már helyesen mér.
Emellett a `queue:alert-failed` queue-név szűrő **nélkül** szkenneli a `failed_jobs`-ot,
tehát drift alatt is riaszt. Egyezik a B-dimenzió CONFIRMED LOW verdiktjével (P7B-1).

**P7C-3: MEDIUM → LOW (2/3 refuted).** A szint-vakság igaz, de a „a `critical` jel
véglegesen elveszik" hamis: az app mindhárom `Log::error` hívása **fix szövegű**
(`TextAnalysisController.php:2492`, `:2527`, `InvoiceGenerator.php:116`), a dedup-kulcs a
szövegre épül — 10 *egyedi* error összegyűjtése nem életszerű. A reconcile kör-fék pedig
**napi** ütemezett parancsból jön, nem burst-ben.

**A-1, A-3, A-4: MEDIUM → LOW.** Lásd az A-dimenzió fájlt; röviden: A-1 nem néma (kiírja a
sorszámot) és a cache read-through; A-3 blast-radiusa kisebb (a `failed_jobs` nem az
egyetlen nyom, a `cache:clear` nem léptet ki); A-4 trigger-premisszája méréssel hamis (az
upstream fájl **7 éve változatlan**).

**A verifikáció iránya konzisztens:** 27/31 refuted. A finderek rendszeresen **abszolút
állításokra** („véglegesen", „soha többé", „egyetlen") építették a súlyt, és a mérés ezeket
sorra megdöntötte.

## Megdőlt PLAN-feltevések (22)

**A guardokról / scheduler-ről:**
1. **„A ConfirmableTrait-fix megkerülhető nem-interaktív cron/CI alatt"** → az **ELLENKEZŐJE**
   igaz. Vendor-lánc: `ConfiguresPrompts.php:32` → `Prompt.php:111-115`, a trait
   `default: false`-t ad → nem-TTY alatt **FAILURE, nulla mutáció**. **Fail-closed**;
   egyetlen megkerülés az explicit `--force`.
2. „Van-e deploy-állapot, amiben a scheduler némán nem regisztrál" → **NINCS.** `config:cache`/
   `route:cache` után is mind a 4 feladat megvan.
3. „A `sanctum:prune-expired --hours` élő tokent törölhet" → a `--hours` az **`expires_at`-ra**
   vonatkozik; a 90 napos player-token soha nem esik bele.
4. „A reconcile FAILURE a lánc egyik néma útja" → **kétszeresen fedett** (`Log::critical` +
   a vendor `ScheduleRunCommand:214-219` kivétellé alakítja a nem-nulla exitet).
5. **„A `DB::prohibitDestructiveCommands` lefedi a destruktív kört"** → **NEM.** A facade
   pontosan **5** parancsot kapcsol be, miközben a Laravel **7 továbbiba** beépítette a
   `Prohibitable` traitet hívó nélkül. Mérve: `cache:clear` és `queue:flush` prodban
   **fék nélkül** végrehajtódott. → A-3.
6. **„A `Prohibitable` trait jelenléte = a parancs védett"** → a trait csak egy kikapcsolt
   kapcsolót olvas (`$prohibitedFromRunning = false` default). Nulla védelem hívó nélkül.
7. **„A PLAN 5 parancsa a teljes saját console-felület"** → a repo **6**-ot tartalmaz; a
   kimaradó `cashier:reconcile-subscriptions` egyben a **legnagyobb üzleti blast radiusú**
   (fizető user hozzáférés-megvonása) és az egyetlen ütemezett saját mutáló parancs.
   A PLAN vakfoltja a legnagyobb hatású elem volt — bár mérten védett.
8. **„A `FixWordLevels` raw-SQL küszöbei driftelnek a `Word::levelForRank()`-hoz képest"** →
   **NINCS drift** egyetlen sávon sem; mind a 4 fogyasztó ugyanazt a 6 sávot kódolja.
   A hibás szintet kapó szavak száma **nulla**.
9. **„Az elgépelt `--task` a kockázatos eset"** → **fordítva**: az elgépelt érték 0 sort
   érint (paraméterezett egyenlőség), a destruktív eset az **üres** érték.
10. **„A cache-wipe a RENDSZER Gemini-költségét okozza"** (ezt a parancs saját
    doc-commentje állítja) → a költség a **user** havi keretére terhelődik; az admin, aki
    indítja, korlátlan kerettel épp nem érzékeli.

**A riasztási láncról:**
11. „A file/database driver `increment`-je nem atomi" → `transaction()` + `lockForUpdate()`
    → **sor-zárral atomi**; prodban amúgy Redis.
12. **„A VPS test-mode APP_ENV-je nem production"** → a „test mode" a **Stripe/Billingo
    kulcsokra** vonatkozik, nem az `APP_ENV`-re. A prod `.env`: `APP_ENV=production`.
13. „A Mailable queue-zható → mégis queue-ra kerülhet a riasztás" → nincs ilyen út.
14. **„`queue:flush` TRUNCATE-el, az autoincrement resetel"** → `->delete()`-et futtat;
    mérve MariaDB 10.4.28 InnoDB-n az AUTO_INCREMENT **nem** áll vissza.
15. **„BILL-3 = a lánc EGYETLEN néma útja"** → az „egyetlen" megdőlt, **de** a feltételezett
    három társ-út is megdőlt: P7C-4 kiváltó feltétele nem áll fenn (`mail.default=smtp`),
    P7C-1 és P7C-3 pedig LOW/INFO-ra esett. **A lánc lefedettsége jobb, mint amit bármelyik
    menet feltételezett.**
16. **„A riasztási lánc teljesen self-referential (minden út a scheduleren belülről indul)"**
    → **mérten hamis**: az `ApplicationErrorDetected` a `MessageLogged`-en ül, ami a
    **queue worker processzben** is tüzel (külön Supervisor daemon).
17. „Az `ADMIN_EMAIL` elgépelése esetén a lánc MINDEN szintje sikert jelez" → hamis:
    ugyanaz a config-érték hajtja a `User::isAdmin()`-t, így egy elgépelt cím **egyetlen
    fiókkal sem egyezik**, ami önálló, észlelhető tünetet ad.
18. **„HTTP-ból indítható Artisan-parancs lehet a rendszerben"** → **nincs, és soha nem is
    volt**: `git log --all -S "Artisan::call" -- app/ routes/` → **0 commit**.

**A korábbi F7 körök leleteiről:**
19. „TEST-2: a reconcile `handle()` teszteletlen" → **elavult**: négy handle()-szintű teszt.
20. „A boot-guardok teszteletlenek" → **négy őrszem-tesztjük van**, csak a
    `StripeWebhookSecurityTest.php`-ban. A korábbi kört a **fájlnév-alapú keresés** vezette félre.
21. **„P7-L3 (nincs prod-guard a 4 manuális parancson)"** → **LEZÁRHATÓ**: a fix commitolva
    és érdemben véd. A maradék hézag a **teszt** hiánya (P7D-7).
22. „Az ops-elgépelés a fő REC-1 kockázat" → a domináns tényező az **állomány-méret**;
    az elgépelést az `assertKnownEnvironment` **fail-closed** boot-guard elkapja.

**Módszertani megjegyzés:** a kód-kommentek ebben a körben **következetesen pontosak**
voltak — egyetlen kivétellel: a `ClearAiCache` doc-commentje a wipe költségét
rendszer-költségként keretezi, holott az a user keretére megy (A-2). A talált hézagok
nem hamis kommentekből, hanem **nem dokumentált határesetekből** jönnek.

## ⚠️ Memória-korrekció — visszavonva

A részleges riport 10. pontja azt állította, hogy *„a 2026-07-22-i incidensnél a riasztási
lánc ~10 perc késéssel beindult"* mérésileg nem állhat, és **a memória-bejegyzés
korrekcióra szorul**. Ez a következtetés a **verifikálatlan C-dimenzióból** jött, és a
verifikáció után **nem tartható**:

- A P7C-1 verifikáció mérten megállapította, hogy **a `QueueBusy` riasztás élesben már
  tüzelt**, és hogy az incidenst nem a `queue:monitor`, hanem a **`queue:alert-failed`**
  útja detektálja — a finder rossz úton kereste a jelet.
- A P7C-4 (amire a „a lánc néma" narratíva nagyrészt épült) kiváltó feltétele
  (`MAIL_MAILER=log`) a valóságban **nem áll fenn**.

**A `project_first_invoice_missing_incident_2026-07-22` memória-bejegyzés tehát
VÁLTOZATLANUL ÉRVÉNYES; a korrekciós javaslatot visszavonjuk.**

## Korábbi verdiktek megdöntése

**P7D-1 — a kör legnagyobb súlyosság-vitája (finder MEDIUM → végső INFO, 2/3 refuted).**
A D-finder szerint a 2026-07-21-i „REC-1 kettős védelem, LEZÁRVA" verdikt hamis, mert (a) a
VPS `APP_ENV` nem production, és (b) az 1 aktív előfizetés a `MIN_KILL_COUNT_FOR_GUARD=5`
alatt van → „a védelem nulla rétegű". **Megdöntve, négy független alapon:**

1. **Rossz `.env`-et olvasott.** A hivatkozott `APP_ENV=local` a **lokális XAMPP dev-példány**
   fájlja. Ráadásul **az idézett konfiguráció production módban nem is bootolna**
   (`assertDebugDisabledInProduction` + `assertStripeSecretMatchesEnvironment`).
   **A lelet bizonyítéka önmagát semmisíti meg.**
2. **A mérés rossz adatbázison készült** (`users=2`, `active=1` — fejlesztői fixture).
3. **A causal chain törött:** csak az `InvalidRequestException` + `resource_missing` pár
   fordul `CloseDecision`-ra; egy visszavont kulcs `AuthenticationException`-t ad →
   **nulla lezárás**.
4. **A „3. réteg is kiesik" coupling hamis** — a megmaradó ág definíció szerint
   `APP_ENV=production`, ahol a `Log::critical` szinkron admin-e-mailt szül.

**Ami megmarad** (korábban rögzített LOW): a `MIN_KILL_COUNT_FOR_GUARD=5` alatti inertség és
a **prefix-only** kulcs-ellenőrzés (P7-L1). **Nyitva, de nem MEDIUM.**

**P7B-2 (LOW → INFO):** a `withoutOverlapping` hiánya önmagát cáfoló előfeltételt szab —
`runInBackground` nélkül a scheduler **blokkoló foreach**-ben futtat, így a 2. reconcile
csak akkor indulhatna, ha a `schedule:run` 24 óra után is blokkol; abban a világban a lánc
már halott. 24 órás soros futáshoz ~170 000–430 000 aktív előfizetés kellene.

**P7B-3 (LOW → INFO):** lásd a 16. megdőlt feltevést — a `MessageLogged` a worker
processzben is tüzel.

## Regressziók

**Nulla kód-regresszió.** A Fázis-7 felület a két menet között **byte-azonos**
(`git log fbf4405..6852fe6` az érintett fákon → üres). A kör tesztjei zöldek
(**127 passed / 389 assertion**).

**Változatlanul nyitott korábbi leletek** (megerősítve, nem regresszió): SCHED-3, ALERT-1,
P7-L1, P7-L2, P7-L4, TEST-1.

**Új, korábban nem rögzített összefüggés:** a riasztási lánc **harmadik** rétege is
`APP_ENV`-hez kötött (`AlertAdminOfLoggedError.php:41`). Nem-production `APP_ENV` egyszerre
némítja a REC-1 boot-guardot ÉS a `Log::critical`-ból származó e-mailt — a két hézag
**korrelált, nem független**. Prodban ez nem áll fenn (P7D-1), és az `assertKnownEnvironment`
fail-closed guard miatt nem is állhat elő elgépelésből.

## Dimenzió-csoportosítás

A PLAN Fázis 7 szakasza **3 mondat-pontból** áll: destruktivitás+guardok /
scheduler-regisztráció / riasztási lánc. Ezt **4 dimenzióra** bontottuk: a 3 PLAN-pont +
egy negyedik (D) a korábbi F7 körök (2026-07-19, 2026-07-21) leleteinek önálló
újra-ellenőrzésére, mert a command explicit regresszió-fókuszt ír elő.

**Kihagyott (kivezetett) PLAN-pont: nincs.** A Fázis 7 szakasz egyetlen kivezetett
feature-re sem hivatkozik (kvíz, cloze, rendhagyó igék, szabad írás, `ReviewController`).
A PLAN 5 parancsot sorol, a repo 6-ot tartalmaz — a 6. a `ReconcileStripeSubscriptions`,
amit ütemezett és destruktív jellege miatt bevettünk a körbe.

## TISZTA (verifikálva)

- **HTTP-ból indítható Artisan-parancs: NINCS** — és történetileg sem volt (0 commit).
  Shell-kiszökés (`exec`/`system`/`eval`) szintén 0 találat.
- **Scheduler-regisztráció ép, nulla drift** — `config:cache`/`route:cache` után is a 4 feladat.
- **A riasztás sosem megy a queue-n** — mind a 3 út `notifyNow`, egyik Notification sem
  `ShouldQueue`. A lánc kulcs-erőssége.
- **A vízjel-sorrend helyes** — `Cache::forever` a küldés UTÁN; hibás küldésnél nem lép.
- **ALERT-2 nem defekt, hanem rekurzió-védelem** — a dedup-kulcs szándékosan a küldés előtt zár
  (a P7C-5 verifikáció ezt megerősítette: a küldés hibája errort logolna, ami új eseményt szülne).
- **ALERT-4 fail-open a helyes irányba** — hiányzó kulcson `false > 10` = `false`.
- **A burst óra-ablak nem csúszik** — az `expiration` 5 increment után bitre azonos.
- **A boot-guardok console-futtatásnál is lefutnak, a `handle()` ELŐTT dobnak** (mérve).
  `assertKnownEnvironment` **fail-closed**: elgépelt `APP_ENV` megállítja a bootot.
- **`model:prune` / Prunable: nulla kitettség** — nincs prunable modell, nincs ütemezve.
- **`FixWordLevels` idempotens és adat-vesztés-mentes**; a küszöbei **nem driftelnek**.
- **`ImportWords` nem SSRF-felület** (hardkódolt URL), és 404/hibaoldalra **fail-closed**
  (élő méréssel: `file_get_contents` → `false`, guard FAILURE-rel kilép).
- **Az `upsert` nem töröl és nem ír felül user- vagy AI-generált tartalmat** — az
  update-oszlop-lista taxatív (`rank`, `level`, `updated_at`).
- **`EndTrialNow` rossz-user-találat KIZÁRVA** — `unique()` e-mail + exact egyenlőség,
  négy egymásra épülő guard.
- **`ClearAiCache` injekció-immunis** — 6 hosztil értékre mérve mindig paraméterezett.
- **A `summarize()` nem hasal el hibás/üres payloadon** — null-safe végig.
- **A `GenerateBillingoInvoice::failed()` → riasztás út hiánytalan** — `report()` → error-log
  → `AlertAdminOfLoggedError`, PÁRHUZAMOSAN `failed_jobs` → `queue:alert-failed`.
- **A reconcile két-fázisú felépítése helyesen izolálja a destruktív írást**, kettős
  védelemmel (boot-guard + 50%-os kör-fék).
- **Event auto-discovery ép** — mindkét listener regisztrált és végpontról-végpontra tesztelt.

## Fázis 7 — lezárva

A PLAN Fázis 7 mindhárom pontja lefedve, mind a 4 dimenzió findere és verifikációja lefutott.
**Nincs go-live blokkoló.** A maradék 12 LOW üzemeltetési/megfigyelhetőségi jellegű; a
legérdemibb kettő:

- **A-3** — a `cache:clear` / `queue:flush` prodban fék nélkül fut. Ha a védelmet valóban
  „destruktív parancsok tiltásának" szánjuk, a facade 5-ös listája bővítendő
  (`ClearCommand::prohibit()`, `FlushFailedCommand::prohibit()`).
- **P7D-7** — a `words:import` és `words:fix-levels` **teljesen teszteletlen**, miközben a
  legnagyobb sor-számú mutációt végzik.

*(Javítás nem történt — a kör hatóköre kizárólag dokumentáció.)*
