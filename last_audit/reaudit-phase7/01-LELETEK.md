# Fázis 7 — Részletes leletek (séma-kényszerített formátum)

Formátum minden leletnél: **fájl · sor · súlyosság · forgatókönyv · verifikációs verdikt**.
A HIGH/MEDIUM-gyanús leleteket több független, **cáfolásra promptolt** adverzariális verifikátor bontotta le;
a LOW-kat egykörös verifikáció zárta.

---

## REC-1 — ~~HIGH~~ → REFUTED / LEZÁRVA — reconcile fék nélküli tömeges lezárás

- **Fájl / sor:** `app/Console/Commands/ReconcileStripeSubscriptions.php:45-120` + `app/Providers/AppServiceProvider.php:120-136`
- **Súlyosság:** korábban megfontolandó HIGH (2026-07-19 audit) → **most REFUTED (lezárva)**
- **Forgatókönyv (a korábbi HIGH):** rossz módú/fiókú `STRIPE_SECRET` (pl. `sk_test_` prodban) esetén a Stripe
  MINDEN `asStripeSubscription()` retrieve-re `resource_missing`-et ad → a napi `cashier:reconcile-subscriptions`
  ezt „elveszett törlő webhook"-ként értelmezi és **az összes élő fizető előfizetést lezárja** egyetlen futással
  (öngyógyulás-képtelen: a következő futás már nem talál aktívat).
- **Adverzariális verifikáció (3 független cáfolási kísérlet):**
  1. *„A fék megkerülhető, ha az állomány pont a küszöb körül van?"* — A `tripsKillSwitch` (sor 126-133):
     `killCount ≥ 5` **ÉS** `killCount/activeCount > 0.5` → 100% resource_missing esetén (a kulcs-mismatch
     tünete) mindig `> 0.5`, tehát **tripel**: `Log::critical` + `$this->error` + `return FAILURE`, **0 lezárás**.
     Teszt bizonyítja: *„a kör-fék NEM zár le semmit, ha … az állomány többségét érintik"* (10/10 → closed=empty,
     FAILURE, aktív marad 10). ✗ Nem megkerülhető.
  2. *„A boot előtt lefut-e a reconcile, mielőtt a guard tripelne?"* — A boot-guard `AppServiceProvider::boot()`-ban
     fut (sor 120-136), ami **minden** artisan-parancs (így a `schedule:run` → reconcile) előtt lefut. `sk_test_`
     prefix + prod → `RuntimeException`, az app **el sem indul**. ✗ A reconcile el sem éri a Stripe-ot.
  3. *„A két fázis (döntés / végrehajtás) között írhat-e DB-t a close-ág?"* — A `reconcile()` a close-ágon
     **csak `CloseDecision`-t ad vissza, DB-t nem ír** (sor 152-189); a tényleges `markAsCanceled` a `handle()`
     kör-fék UTÁNI ciklusában fut (sor 107-114). Teszt: *„a Stripe-nál törölt … lezárás-döntést ad"* +
     `shouldNotReceive('markAsCanceled')`. ✗ Nincs fék előtti írás.
- **Verdikt:** **REFUTED.** Kettős, egymást fedő védelem (boot-guard + kör-fék), mindkettő tesztelt.
  A korábbi HIGH kockázata megszűnt. Marad két maradék-él LOW-ként (P7-L1, P7-L2).

---

## P7-L1 — LOW — `sk_live_` DE rossz-fiókú kulcs a boot-guardot kikerüli

- **Fájl / sor:** `app/Providers/AppServiceProvider.php:128` (guard) + `ReconcileStripeSubscriptions.php:160-168`
- **Súlyosság:** LOW
- **Forgatókönyv:** a boot-guard csak a `sk_test_` **prefixet** fogja. Ha valaki egy másik élő Stripe-fiók
  `sk_live_…` kulcsát állítja be (fiók-csere, migráció), a guard **nem tripel**, de a Stripe minden retrieve-re
  `resource_missing`-et adna (a subok a másik fiókban vannak) → 100% lezárás-jelölt.
- **Adverzariális verifikáció:** ez a maradék-vektor **nem** kerüli meg a kör-féket: 100% > 50% ÉS ≥ 5 →
  a kör-fék tripel, `FAILURE`, 0 lezárás, `Log::critical`. Tehát a lánc **fail-closed**, csak most a
  *második* védelmi rétegre (kör-fék) támaszkodik, nem a bootra. Kis állományon (< 5 aktív sor) a boot-guard
  hiánya + kör-fék-alsóküszöb együtt elvben 1-4 sort lezárhatna — de rossz-fiókú `sk_live_` mellett az egész
  fiók üres, ilyenkor `activeCount` a *helyi* aktív sorok száma, és a néhány helyi sor lezárása kézzel
  visszaállítható. **Blast-radius: maximum néhány sor, öngyógyítható kézi `resume`-mal.**
- **Verdikt:** LOW. Reális, de ritka ops-hiba; a kör-fék a tömeges esetet fedi, a maradék apró.
- **Lehetséges (nem kért) fix:** a boot-guard bővíthető egy „a reconcile első N retrieve-je mind
  resource_missing → állj le" próba-lekérdezéssel, VAGY a fiók-ID (`acct_…`) egyeztetésével. Nem szükséges launch-hoz.

---

## P7-L2 — LOW — kör-fék 5–50% sávja legitim incidensnél is lezárhat

- **Fájl / sor:** `app/Console/Commands/ReconcileStripeSubscriptions.php:37,43,126-133`
- **Súlyosság:** LOW
- **Forgatókönyv:** ha egy valós Stripe-incidens vagy adat-eltérés az aktív állomány **6–49%-ára** ad
  `resource_missing`-et / halott státuszt (nem 100%, tehát nem kulcs-mismatch), a kör-fék **nem tripel**
  (`≤ 50%`), és ezeket a sorokat **ténylegesen lezárja**. Ha ez téves (átmeneti Stripe-hiba, ami mégis
  `resource_missing`-nek látszott), az érintett userek jogosultsága elveszik, öngyógyulás nincs — kézi
  `resume`/újra-előfizetés kell.
- **Adverzariális verifikáció:** a `resource_missing` a Stripe-nál **végleges** jelentésű (a `rate_limit`/egyéb
  átmeneti hibát a `reconcile()` **tovább dobja**, nem zár le — ezt külön teszt fedi: *„a resource_missingtől
  eltérő Stripe-hibát nem nyeli el"*). Tehát 5–50% resource_missing csak akkor áll elő, ha tényleg ennyi sub
  végleg törölt a Stripe-nál — ami vagy valós (akkor helyes a lezárás), vagy egy nagyon szűk, nehezen
  előálló Stripe-adatinkonzisztencia. **Az esély alacsony, a hatás korlátozott és kézzel visszafordítható.**
- **Verdikt:** LOW. A küszöb (50% / min 5) tudatos kompromisszum a „legitim 1-2 lezárás átmenjen" és a
  „tömeges ops-hiba fogódjon meg" között. Elfogadható.

---

## P7-L3 — LOW — manuális destruktív parancsokon nincs prod-guard/megerősítés

- **Fájl / sor:** `FixWordLevels.php:14`, `ImportWords.php:17`, `ClearAiCache.php:15`, `EndTrialNow.php:14`
- **Súlyosság:** LOW
- **Forgatókönyv:** a 4 nem-ütemezett parancs egyike sem hív `isProduction()`-guardot,
  `$this->confirmToProceed()`-et vagy `--force`-ot:
  - `words:fix-levels` — raw `DB::update` a teljes `words` táblán (nem user-adat; a `DB::prohibitDestructiveCommands`
    **nem** fogja, mert az csak `db:wipe`/`migrate:fresh` típusú *artisan* parancsokra hat, nem raw UPDATE-re).
  - `words:import` — `Word::upsert` (idempotens, nem user-adat).
  - `ai:cache:clear` — `AiWordCache` törlés (megosztott cache, újragenerálódik; nem PII, nem user-adat).
  - `billing:end-trial {email}` — **valós Stripe-mutáció**: `updateStripeSubscription(['trial_end' => 'now'])`,
    ami prodban **azonnali valós terhelést + Billingo-számlát** indít. Egy elgépelt e-mail rossz usert terhelne.
- **Adverzariális verifikáció:** *„futtatható-e véletlenül tömeges mutáció ütemezőn át?"* — **Nem**: a
  `schedule:list` szerint egyik sincs ütemezve, csak kézi `php artisan …` hívásból futnak. A `words:*` és
  `ai:cache:clear` hatása nem PII és visszaállítható (re-import / re-generálás). Az `EndTrialNow` egyetlen
  user-t érint, és a `email`-argumentum kötelező (nincs „mindenki" mód). **Blast-radius: 1 user (end-trial),
  ill. nem-PII tábla (a többi).**
- **Verdikt:** LOW. Operátori parancsok; a valós kockázat az `EndTrialNow` elgépelt e-mailje (1 user téves
  terhelése), ami visszatéríthető. Nem tömeges, nem automatizált.
- **Lehetséges (nem kért) fix:** `EndTrialNow`-ra `$this->confirm("Valóban lejáratod … ({$user->email})?")`
  megerősítés prodban. Kényelmi, nem biztonsági szükséglet.

---

## P7-L4 — LOW — MonitorFailedJobs vízjel-vesztésekor újra-riaszt

- **Fájl / sor:** `app/Console/Commands/MonitorFailedJobs.php:23,28,51`
- **Súlyosság:** LOW
- **Forgatókönyv:** a „legutóbb lejelentett failed_jobs id" vízjelet a `Cache::forever` tartja. Ha a cache-t
  kiürítik (`php artisan optimize:clear`, cache-driver csere, Redis-flush), a vízjel 0-ra esik, és a
  `failed_jobs`-ban még bent lévő (nem retry-olt/flush-olt) bukásokról **újra megy egy riasztás**.
- **Adverzariális verifikáció:**
  1. *„Néma kimaradás lehet-e? (új bukás id < vízjel)"* — Nem: a `failed_jobs.id` `bigint unsigned autoincrement`
     (séma-ellenőrzött), és a `queue:flush`/`queue:retry`/`queue:forget` **DELETE**-tel dolgozik, nem TRUNCATE-tel
     (vendor-ellenőrzött: `DatabaseFailedJobProvider::flush/forget → ->delete()`), így az AUTO_INCREMENT nem áll
     vissza → a vízjel monoton, új bukás mindig magasabb id-t kap → **soha nem marad némán ki**. ✓
  2. *„A dupla riasztás elárasztja-e a postafiókot?"* — Nem: az újra-riasztás a bent maradt (nem feldolgozott)
     bukások **egyszeri** összefoglalója, nem burst; a kód kommentje ezt szándékként rögzíti („inkább duplán,
     mint sehogy"). ✓
- **Verdikt:** LOW / tudatosan vállalt. A downside (ritka dupla-riasztás cache-ürítéskor) elfogadható a
  „soha ne maradjon el egy kimaradt NAV-számla riasztása" garanciáért cserébe.

---

# INFO — nem hiba, kontextus / megerősítés

- **INFO-1** — A riasztási lánc **regisztrációja tényellenőrzött** (`php artisan event:list`):
  `MessageLogged → AlertAdminOfLoggedError@handle` és `QueueBusy → AlertAdminOfQueueBacklog@handle`
  az `app/Listeners` auto-discovery-jén keresztül (nincs kézi `Event::listen` az `AppServiceProvider`-ben,
  de a bekötés valós). A `FailedJobsDetected` közvetlen `notifyNow` a parancsból (nem listener). Nincs néma ág.

- **INFO-2** — Mindhárom notification **szándékosan NEM `ShouldQueue`** (`notifyNow` szinkron küldés): a queue
  bajáról szóló riasztás nem mehet a (potenciálisan halott) queue-n keresztül. Konzisztens mind a háromban.

- **INFO-3** — `AlertAdminOfLoggedError` **két rétegű throttle**: (1) per-hiba dedup (`Cache::add` szint+md5(üzenet)
  kulcson, atomi, a küldés ELŐTT zár), (2) globális óránkénti burst-plafon (10/óra) a kérésenként változó
  üzenetű hiba-áradatra (Stripe/Billingo timeout URL-lel). Mindkettő tesztelt (`ErrorLogMonitoringTest` 8 teszt),
  köztük a 30-hibás burst → pontosan 10 riasztás. Az `AlertAdminOfLoggedError.php` a diff-audit #2 (commit 439477a)
  óta tartalmazza a globális plafont — a korábbi mail-storm regresszió lezárva.

- **INFO-4** — A `try/catch(Throwable)` az `AlertAdminOfLoggedError::handle`-ben **némán nyel** (nem dob tovább,
  nem logol) — helyes: a levélküldés hibája nem törheti az eredeti kérést, és egy `Log::error` itt végtelen
  rekurzióba vinné a listenert. A per-hiba dedup a küldés ELŐTT zár, így a rekurzió-veszély kizárt.

- **INFO-5** — A scheduler a **`routes/console.php`**-ban él (`Schedule::command(...)`), nem a `bootstrap/app.php`
  `withSchedule`-jében; a `->withRouting(commands: …/console.php)` tölti be. 4 ütemezett feladat: `queue:alert-failed`
  (10p), `queue:monitor …:default --max=25` (10p), `sanctum:prune-expired --hours=24` (napi), `cashier:reconcile-subscriptions`
  (napi). A `queue:monitor` connection-paramétere betöltés-időben `config('queue.default').':default'` = `database:default`
  — helyesen feloldódik (a config már elérhető a route-betöltéskor).

- **INFO-6** — Az ütemezett feladatokon **nincs `withoutOverlapping()`/`onOneServer()`**. Egyetlen VPS-en (Ploi,
  1 `schedule:run` cron) ez gyakorlati problémát nem okoz; a `reconcile` `markAsCanceled` idempotens (ugyanoda
  állít), a `queue:alert-failed` vízjele monoton (P7-L4), a `queue:monitor` esemény-alapú throttle-t használ
  (`AlertAdminOfQueueBacklog` óránkénti `Cache::add`). Több-szerveres deploynál (nem a jelenlegi terv) érdemes
  lenne `onOneServer()` — de az ops-döntés, nem kód-hiba.
