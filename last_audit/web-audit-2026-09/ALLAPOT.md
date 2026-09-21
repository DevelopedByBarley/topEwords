# Audit-állapot — hol tartunk

> **Ez a fájl a folytatási pont.** Új beszélgetés indításakor elég ezt és a
> [PLAN.md](PLAN.md)-t beolvasni — minden benne van, ami a folytatáshoz kell.
>
> Utolsó frissítés: **2026-09-21** (2. menet lefutott) · Kód-állapot: `1ff0a19a` (main)

---

## 1. Miért fut ez az audit

A tulajdonos által megadott cél, szó szerinti súlypontokkal:

> „Ezért az emberek fizetni fognak, szóval nagyon fontos hogy az emberek adata, fizetése
> és a hozzávaló szolgáltatások hiba nélkül fussanak, ha mégis valami hiba előfordul
> azt könnyen megtaláljuk majd és ezáltal könnyedén is tudjuk kezelni.
>
> Fontos a kritikus szemmel való átnézés és az őszinte vélemény. Hogy mindenre kitérjünk
> és megfeleljünk a törvényeknek is. Számlázás stb. Ezeknek is tökéletesen kell működnie."

Ebből négy követelmény, amit az auditnak bizonyítania kell:

1. **A pénz nem vész el** — fizetés, előfizetés, számlázás hibátlanul.
2. **Az adat biztonságban van** — és jogilag is rendben kezeljük.
3. **A hiba észrevehető és kezelhető** — nem némán romlik el.
4. **Megfelelünk a törvénynek** — számlázás (NAV/áfa) és GDPR.

Módszertani elvárás: **kritikus szem, őszinte vélemény.** Nem termelünk látszat-leleteket,
de nem is szépítünk. A hiányzó dolog is lelet.

---

## 2. Állapot menetenként

| # | Menet | Állapot | Eredmény |
|---|-------|---------|----------|
| 1 | Terepfelmérés: tesztek, hibakövetés, a valóság | **LEFUTOTT** (2026-09-21) | 0 HIGH · 1 MEDIUM · 2 LOW · 3 nyitott |
| 2 | A pénz útja, végponttól végpontig | **LEFUTOTT** (2026-09-21) | 0 HIGH · 3 MEDIUM · 2 LOW · 1 nyitott |
| 3 | Felhasználói adat: védelem és jogi megfelelés | **LEFUTOTT** (2026-09-21) | 0 HIGH · 1 MEDIUM · 2 LOW · 2 nyitott |
| 4 | Üzemeltethetőség: észrevesszük-e, ha elromlik | **KÖVETKEZŐ** | — |
| 5 | AI-használat és -költség | tervezett | — |
| 6 | Biztonság a maradék felületen | tervezett | — |

A menetek részletes tartalma: [PLAN.md](PLAN.md).

Az 1. menet leletei a **9. pontban**, teendői a **10. pontban** (T-1…T-5).
A 2. menet leletei a **12. pontban**, teendői a **13. pontban** (T-6…T-10).
A 3. menet leletei a **14. pontban**, teendői a **15. pontban** (T-11…T-14).
A 4–6. menet még hátravan.

---

## 3. Környezet

| Tétel | Állapot |
|-------|---------|
| PHP (CLI) | **8.4.24** — a korábbi 8.2-es blokkoló megszűnt |
| Laravel | 13.16.1 |
| `php artisan` | fut |
| Webapp localhoston | fut |
| Teszt-suite lefuttatva | **igen** (2026-09-21). Menet közben: 956 zöld, 34 piros. A T-3/T-4 után: **959 zöld, 0 piros**, 1 skipped (+31 külön, a `kivezetett` csoportban) |
| Üzemmód | **go-live előtt**, fizető felhasználó még nincs, tünet nem volt (tulajdonosi válasz) |
| MySQL localhoston | a menet közben **nem futott** — a tesztek in-memory SQLite-on mennek, ez nem zavarta őket |

Következmény: **futtatni is tudunk, nem csak kódot olvasni.** Amit futtatással lehet
bizonyítani vagy cáfolni, azt futtatjuk.

---

## 4. Előzetes gyanúk (még NEM megerősített leletek)

Mindkettő grep-alapú hiány-észlelés a terv átdolgozása közben. A megerősítés vagy cáfolat
a hozzájuk rendelt menet dolga.

### Gy-1 · Nincs hibakövető telepítve — ~~várható súly: HIGH~~ → **CÁFOLVA az 1. menetben**
A `composer.json`-ban valóban nincs Sentry/Bugsnag/Flare (megerősítve). **De a cáfoló
feltétel teljesült:** az `ApplicationErrorDetected` + a log-csatornák együtt érdemi
lefedést adnak. Részletek: 9. pont, L1-1. A maradék hiányosság LOW súlyú, a 4. menet
tárgya. **Nem HIGH.**

### Gy-2 · Nincs fiók-törlés és adat-export — ~~várható súly: HIGH~~ → **CÁFOLVA a 3. menetben**
**A gyanú téves volt.** A fiók-törlés létezik (`ProfileController::destroy()`,
`DELETE /settings/profile`), jelszóval védett, 9 teszt fedi, és a törlés előtt lemondja az
összes élő Stripe-előfizetést. A kaszkád futtatással ellenőrizve: 14 `user_id`-s táblából
12 helyesen kaszkádol.
Az **adat-export** valóban nincs — de a privacy-oldal nem is ígér önkiszolgáló exportot,
hanem helyesen kapcsolattartási pontra irányít, amit a GDPR megenged. **Nem jogsértés**,
csak üzemeltetési kérdés (NY-6).
Ami a helyén maradt: egyetlen MEDIUM (L3-2, a `password_reset_tokens` nem takarítódik) és
két LOW. Részletek: 14. pont. **Nem HIGH.**

---

## 5. Amit tudunk a rendszerről (kiindulási térkép)

Ez nem lelet, hanem a felderítés során összeszedett tájékozódási pont.

**Fizetés és számlázás**
- `app/Services/Billingo/BillingoClient.php`, `InvoiceGenerator.php` (18 kB)
- `app/Jobs/GenerateBillingoInvoice.php` — a számlázás **aszinkron**, tehát némán tud bukni
- `app/Console/Commands/ReconcileStripeSubscriptions.php`
- `bootstrap/app.php`: a CSRF ki van kapcsolva a `stripe/*` útvonalakra (webhook — várható)

**Meglévő őrzők** (`routes/console.php`, mind ütemezve):
- `queue:alert-failed` — 10 percenként
- `queue:monitor` — 10 percenként, max 25
- `cashier:reconcile-subscriptions` — naponta
- `sanctum:prune-expired` — naponta
- ⚠️ Mind csak akkor fut, ha a szerveren megy a `schedule:run` cron **és** van hova
  e-mailt küldeni. **Ez nyitott kérdés.**

**Értesítések:** `ApplicationErrorDetected`, `FailedJobsDetected`, `QueueBacklogDetected`,
`ReportSubmitted`

**AI:** `AiUsageService`, `AiCacheService`, `AttachAiBudgetWarning` middleware (`ai.budget` alias)

---

## 6. Nyitott kérdések a tulajdonoshoz

- ~~Fut-e már éles rendszer fizető felhasználókkal?~~ **MEGVÁLASZOLVA (2026-09-21):**
  még nem, go-live előtt vagyunk. → Minden lelet „indulás előtt javítandó", egyik sem
  okoz most kárt.
- ~~Volt-e konkrét tünet?~~ **MEGVÁLASZOLVA (2026-09-21):** nem volt.
- **Fut-e a `schedule:run` cron az éles szerveren (Ploi)?** Kódból nem eldönthető, és
  lokálisan sem ellenőrizhető. **Nyitva marad** — lásd NY-1.
- **Megérkezik-e ténylegesen a riasztó e-mail a `developedbybarley@gmail.com`-ra?**
  A lánc kódja helyes és tesztelt, de éles SMTP-vel még nem lett kipróbálva. → NY-2.

---

## 7. A következő lépés

**4. menet indítása** friss beszélgetésben: *Üzemeltethetőség: észrevesszük-e, ha elromlik*
(tartalom: [PLAN.md](PLAN.md) → 4. menet).

Amit a 3. menet átad neki:
- **A naplózási adatvédelem szála részben le van zárva.** A 4. menet azt is vizsgálná,
  nem kerül-e PII a logba — a 3. menet ezt már végigszűrte, és **nem talált szivárgást**
  (az egyetlen szöveges log a Gemini *válaszának* részlete). A 4. menetnek tehát elég a
  másik irányra koncentrálnia: **elég részletes-e** a napló egy pénzügyi hiba
  rekonstruálásához, van-e korrelációs azonosító.
- **Az L3-3 (naplórotáció) és az NY-5 közvetlenül a 4. menet tárgya** — a megőrzési idő
  és a hibakereshetőség itt ugyanazon a beállításon múlik.
- **A T-11 (`auth:clear-resets`) a T-2-höz (cron) van kötve.** Egyre több teendő függ
  attól, hogy a `schedule:run` tényleg fut-e az éles szerveren: T-2, T-9, T-11.
  A 4. menetnek ezt **központi kérdésként** kell kezelnie, nem mellékszálként.

---

## 8. Munkamódszer (röviden — részletesen a PLAN.md végén)

- **Az audit dokumentál, nem javít.** Kivétel: ha valami élesben épp most okoz kárt,
  azt azonnal jelezzük.
- **Menetenként friss beszélgetés**, hogy legyen elég kontextus; a menet végén csak
  a leletlista marad itt.
- **Minden HIGH/MEDIUM-gyanút cáfolni kell próbálni**, mielőtt leletként rögzül.
- **A „nem tudom" megengedett** — nyitott kérdésként rögzítjük, nem tippelünk.

**Súlyosság:** HIGH = pénzt veszít / adatot szivárogtat / jogszabályt sért / némán hibázik
egy pénz-úton · MEDIUM = rontja a helyreállíthatóságot vagy felderíthetőséget ·
LOW = valós, de korlátozott · INFO = tisztázandó.

---

## 9. Az 1. menet leletei (2026-09-21)

**Verdikt: 0 HIGH · 1 MEDIUM · 2 LOW · 3 nyitott kérdés.**
A menet a vártnál lényegesen jobb képet talált. A legfontosabb: a `Gy-1` gyanú
(nincs hibakövetés = HIGH) **megdőlt**, és a pénz-utak tesztfedettsége nem hiányos,
hanem kifejezetten alapos.

### Bizonyítékok

**Teszt-suite** (`php artisan test --compact`, in-memory SQLite, 76,9 s):
`991 teszt — 956 zöld, 34 piros, 1 skipped, 3595 assertion`.

**A 34 piros teszt egyike sem jelez működési hibát.** Két csoportra bomlik, mindkettő
elavult teszt:

| Csoport | Db | Ok |
|---|---|---|
| `QuizTest`, `ClozeTest`, `IrregularVerbTest`, `StreakTest`, `PlanLimitTest` (2 eset) | 31 | `RouteNotFoundException` — a kvíz/cloze/rendhagyó igék **szándékosan kivezetve** indulásra (`routes/words.php:4-6`, kikommentezett `use`-ok). A tulajdonos megerősítette: „azok direkt nincsenek bekötve". |
| `Auth\AuthPagesTest` (3 eset) | 3 | A tesztek a `pages/auth/register.tsx`-ben keresnek szöveget, de a tartalom átkerült a `components/auth/register-fields.tsx`-be (a page 37 sorra fogyott). |

### L1-1 · A hibariasztó lánc működik — a `Gy-1` cáfolva · ~~HIGH~~ → **LOW**

**Amit találtam:** hibakövető csomag tényleg nincs, de van helyette egy átgondolt,
saját lánc, ami a cáfoló feltételt teljesíti:
- `app/Listeners/AlertAdminOfLoggedError.php` — `error` és súlyosabb szintű logról
  azonnal e-mailt küld. Futásidőben ellenőrizve: a `MessageLogged` eseményre **2
  listener** van bekötve (auto-discovery működik).
- Két rétegű fojtás: per-hiba atomi dedup (`Cache::add`, 1 óra) **és** globális
  burst-plafon (10/óra) — átgondolt válasz arra, hogy változó üzenetű hiba-áradat
  ne árassza el a postafiókot.
- Szinkron küldés (`notifyNow`), tehát beteg queue mellett is célba ér.
- A riasztó nem dobhat tovább és nem logolhat errort (végtelen ciklus elleni védelem).
- `ADMIN_EMAIL` **be van állítva** (`developedbybarley@gmail.com`), `MAIL_MAILER=smtp`
  (`smtp.rackhost.hu`).
- Mellette: `queue:alert-failed` (elbukott jobok), `queue:monitor` + QueueBusy listener
  (torlódás), `sanctum:prune-expired`, `cashier:reconcile-subscriptions`.
- **A lánc tesztelt:** `ErrorLogMonitoringTest` (8) + `QueueMonitoringTest` (8) =
  **16/16 zöld**, célzottan újrafuttatva. Fedik a dedupot, a burst-plafont, az
  `ADMIN_EMAIL` hiányát és a nem-prod esetet is.

**Ami LOW-ként megmarad (4. menet tárgya):** a levél csak azt mondja, „van baj" — a
részletekért a szerver logjába kell menni (`LOG_STACK=daily`, `LOG_DAILY_DAYS=365`).
Nincs kereshető felület, aggregáció, trend, korrelációs azonosító. Fizetős élesüzemben
ez kényelmetlen, de **nem az a helyzet, hogy „senki nem tud a hibáról"** — ezt
állította a `Gy-1`, és ez nem igaz.

### L1-2 · 34 elavult teszt zaja elfedi a valódi regressziót · **MEDIUM**

**Fájlok:** `tests/Feature/QuizTest.php`, `ClozeTest.php`, `IrregularVerbTest.php`,
`StreakTest.php`, `PlanLimitTest.php` (2 eset), `tests/Feature/Auth/AuthPagesTest.php`
(3 eset).

**Forgatókönyv:** a suite tartósan piros (34 bukás). Egy jövőbeli, **valódi**
regresszió — például egy elromlott Billingo-teszt — a 35. piros sor lenne a listában,
és a „úgyis piros" reflex elnyelné. A piros baseline azt a képességet rontja el,
hogy a teszt-suite riasztó eszköz legyen.

**Miért MEDIUM és nem HIGH:** most nem veszít pénzt és nem szivárogtat adatot. De
közvetlenül rontja a felderíthetőséget, ami a tulajdonos 3. követelménye
(„ha hiba van, könnyen megtaláljuk"), és go-live után kedvezőtlen körülmények közt
HIGH-á válik.

**Mi cáfolná:** ha van dokumentált megállapodás, hogy ezek a tesztek a funkciók
visszakapcsolásáig szándékosan pirosak maradnak, és a CI külön kezeli őket
(pl. `--exclude-group`). Ilyen jelölést nem találtam: a tesztek nincsenek
`->skip()`-elve, `todo`-zva vagy csoportba zárva — egyszerűen buknak.

### L1-3 · 3 teszt rossz fájlt ellenőriz — vakfolt a regisztráción · **LOW**

**Fájl:** `tests/Feature/Auth/AuthPagesTest.php:90, 96, 121`

**Forgatókönyv:** a három teszt fontos dolgokat őrizne — hogy a regisztráció kimondja,
hogy e-mail-megerősítés jön; hogy kifejezett pipával fogadtatja el a jogi
dokumentumokat (**GDPR/ÁSZF-beleegyezés**); és hogy a számlázási panel kinyílik
szerverhibára. Mindhárom a `pages/auth/register.tsx`-et olvassa, de a tartalom a
`components/auth/register-fields.tsx`-be került. **A tesztek most akkor is buknának,
ha a funkció rendben van — és akkor is, ha elromlana. Nem őriznek semmit.**

**Cáfolat-kísérlet (sikeres, ezért csak LOW):** ellenőriztem, hogy a funkció
megvan-e. Mind a négy keresett minta **pontosan megtalálható** a
`register-fields.tsx`-ben: `megerősítő e-mailt`, `id="terms"`, `name="terms"`,
`terms.url()`, `privacy.url()`, `field.startsWith('billing_')`,
`billingRequested || hasBillingError`. A jogi pipa szerveroldali kényszere külön,
**zöld** teszttel fedett („elfogadás nélkül nem jön létre fiók"). Tehát nincs valódi
működési hiba — csak a teszt mutat rossz helyre.

### Amit külön ki kell mondani: ami rendben van

A módszertan tiltja a látszat-leleteket, de az őszinte verdikt része a jó hír is:

- **A pénz-utak tesztfedettsége erős.** `BillingoInvoiceTest`: **37 teszt**, benne
  MNB-árfolyam devizás számlán, budapesti teljesítési nap (nem UTC), crash-utáni
  retry duplikáció-védelem, idempotencia, partner-újrahasználat, 404-es partner
  újralétrehozása, 0 összegű trial-számla kihagyása, PII a job-payloadból kihagyva,
  explicit connect/response timeout. `StripeWebhookIdempotencyTest`: 4.
  `StripeWebhookSecurityTest`: 9 (közte prod-ban tesztkulcs tiltása, CSRF-mentesség
  szándékossága). `ReconcileStripeSubscriptionsTest`: 9 (közte „kör-fék", ami
  tömeges téves lezárást akadályoz). `PlanLimitTest`: 25 (közte fail-closed
  viselkedés hiányzó számláló-sornál, zár-timeout barátságos kezelése).
  **Mind zöld.** Egyik pénz-út sem fedetlen — a PLAN.md által várt „fedetlen pénz-út
  mint lelet" **nem áll fenn**.
- **A funkció-kivezetés fegyelmezett.** Nemcsak a route-ok nincsenek bekötve
  (futásidőben ellenőrizve: `route:list`-ben nyoma sincs a kvíznek), hanem
  **őrszem-tesztek** vigyáznak arra, hogy a kivezetett funkciókat sehol ne
  hirdessük: `AchievementVisibilityTest`, `AuthPagesTest` („az auth-keret nem hirdet
  kivezetett funkciókat"), `PublicPagesTest` („az árazás nem hirdet…"),
  `HandbookContentTest`. A kontrollerek sehonnan nincsenek behúzva.
- **A riasztó-kód minősége jó.** Atomi cache-műveletek, a throttle a küldés *előtt*
  zár, szinkron kézbesítés, önrekurzió-védelem, magyarázó kommentek. Ez nem
  „odacsapott" megoldás.

### Nyitott kérdések (nem leletek)

- **NY-1 · Fut-e a `schedule:run` cron az éles szerveren (Ploi)?** Kódból nem
  eldönthető. Ha nem fut, **mind a négy őrző néma** — az elbukott Billingo-számláról
  sem jönne riasztás. A `routes/console.php` kommentje maga is figyelmeztet erre.
  Lokálisan a `schedule:list` sem futott le (MySQL nem élt), tehát ezt élesben kell
  ellenőrizni. → 4. menet / üzemeltetés.
- **NY-2 · Megérkezik-e ténylegesen a riasztó e-mail?** A lánc kódja helyes és
  tesztelt (16/16), de a tesztek `MAIL_MAILER=array`-jel futnak, és a listener
  `app()->isProduction()`-re szűr — **a valódi SMTP-úton még sosem ment végig
  riasztás**. Go-live előtt egy szándékos éles próbariasztás javasolt. → 4. menet.
- **NY-3 · A riasztás-fojtás a `CACHE_STORE=database`-re épül.** Minden throttle
  (`Cache::add`, `Cache::increment`) MySQL-táblát ír. Ha épp az adatbázis a hiba oka,
  a fojtás-logika maga is hibázhat — a `try/catch` ilyenkor **némán elnyeli a
  riasztást**. Ez nem bizonyított hiba, de vizsgálandó forgatókönyv. → 4. menet.

---

## 10. Teendők az 1. menetből

> Az audit dokumentál, nem javít — ez **teendőlista**, a végrehajtás külön döntés.
> A sorrend a go-live szempontjából súlyozott. Egyik sem okoz most kárt (nincs
> fizető felhasználó), de a T-1 és T-2 **go-live előtt elvégzendő**.

| # | Teendő | Miből jön | Súly | Mikor | Állapot |
|---|--------|-----------|------|-------|---------|
| T-1 | Éles próbariasztás végigvitele | NY-2 | go-live blokkoló | go-live előtt | nyitva |
| T-2 | A `schedule:run` cron ellenőrzése a szerveren | NY-1 | go-live blokkoló | go-live előtt | nyitva |
| T-3 | A 34 elavult teszt rendezése | L1-2 (MEDIUM) | fontos | go-live előtt javasolt | **KÉSZ** (2026-09-21) |
| T-4 | A 3 auth-teszt átirányítása a helyes fájlra | L1-3 (LOW) | kicsi | T-3 részeként | **KÉSZ** (2026-09-21) |
| T-5 | A riasztás-fojtás DB-függésének átgondolása | NY-3 | vizsgálandó | 4. menet | nyitva |

### T-1 · Éles próbariasztás végigvitele — **go-live blokkoló**

**Miért:** a riasztási lánc kódja helyes és 16/16 zöld teszttel fedett, de a tesztek
`MAIL_MAILER=array`-jel futnak, a listener pedig `app()->isProduction()`-re szűr.
**A valódi SMTP-úton még sosem ment végig riasztás.** Ha a rackhost SMTP elutasít,
a Gmail spambe rakja, vagy a `MAIL_FROM_ADDRESS` nincs hitelesítve — arról most
semmit nem tudunk, és pont akkor derülne ki, amikor az első elbukott Billingo-számláról
kellene szólnia.

**Mit kell tenni:** éles környezetben szándékosan kiváltani egy `error` szintű logot
(vagy egy szándékosan elbuktatott próbajobot), és megnézni, megérkezik-e a levél a
`developedbybarley@gmail.com`-ra — a spam mappát is beleértve.

**Mikor tekinthető késznek:** a levél igazoltan megérkezett a beérkező üzenetek közé.

### T-2 · A `schedule:run` cron ellenőrzése a szerveren — **go-live blokkoló**

**Miért:** mind a négy őrző (`queue:alert-failed`, `queue:monitor`,
`cashier:reconcile-subscriptions`, `sanctum:prune-expired`) **kizárólag** akkor fut,
ha a szerveren megy a `schedule:run` percenkénti cron. Ha nem megy, a rendszer
pontosan úgy viselkedik, mintha egyáltalán nem lenne felügyelet — csak közben azt
hisszük, hogy van. A `routes/console.php` kommentje maga is figyelmeztet erre
(„Futtatásához a szerveren mennie kell a schedule:run cronnak (Ploi)").

**Mit kell tenni:** a Ploi felületén ellenőrizni, hogy a `schedule:run` cron létezik
és aktív. Utána élesben `php artisan schedule:list`-tel visszanézni, hogy mind a négy
ütemezés szerepel-e és mikor futott utoljára.

**Mikor tekinthető késznek:** a cron igazoltan aktív, és van bizonyíték legalább egy
lefutott ütemezett feladatra.

### T-3 · A 34 elavult teszt rendezése — **L1-2 (MEDIUM)**

**Miért:** a tartósan piros suite elveszi a tesztek riasztó erejét. Egy jövőbeli valódi
regresszió a 35. piros sor lenne, és a „úgyis piros" reflex elnyelné.

**Három lehetséges út — a döntés a tiéd:**

1. **Csoportba zárás** (`->group('kivezetett')` + CI-ben `--exclude-group=kivezetett`).
   A tesztek megmaradnak arra az esetre, ha a kvíz visszakerül, de nem festik pirosra
   a suite-ot. **Ez a javaslatom**, mert a kivezetés szándékos és vélhetően ideiglenes.
2. **`->todo()` vagy `->skip('kivezetve indulásra')` jelölés.** Egyszerűbb, de a Pest
   skipped-ként számolja, és a szándék kevésbé látszik.
3. **Törlés.** Csak akkor, ha a kvíz/cloze/rendhagyó igék véglegesen kikerülnek.
   ⚠️ A projekt szabálya szerint **tesztet jóváhagyás nélkül nem törlünk**.

**Érintett fájlok:** `tests/Feature/QuizTest.php`, `ClozeTest.php`,
`IrregularVerbTest.php`, `StreakTest.php` (1 eset), `PlanLimitTest.php` (2 eset:
„quiz round size…", „cloze round size…").

**Mikor tekinthető késznek:** `php artisan test --compact` zölden zár, és a kivezetett
funkciók tesztjei szándékjelölten, visszakapcsolhatóan pihennek.

### T-4 · A 3 auth-teszt átirányítása a helyes fájlra — **L1-3 (LOW)**

**Miért:** a három teszt fontos dolgokat őrizne — e-mail-megerősítés kimondása,
**jogi dokumentumok kifejezett elfogadása (GDPR/ÁSZF)**, számlázási panel nyitása
szerverhibára. Mind a `pages/auth/register.tsx`-et olvassa, de a tartalom a
`components/auth/register-fields.tsx`-be került. **Jelenleg akkor is buknának, ha a
funkció rendben van, és akkor is, ha elromlana — tehát nem őriznek semmit.**

**Mit kell tenni:** a három tesztben az `authSource('pages/auth/register.tsx')` hívást
`authSource('components/auth/register-fields.tsx')`-re cserélni. A keresett minták
változatlanul érvényesek — ellenőriztem, mind a négy pontosan megvan az új helyen.

**Érintett sorok:** `tests/Feature/Auth/AuthPagesTest.php:90, 96, 121`.

**Megjegyzés:** a jogi pipa szerveroldali kényszerét külön, **zöld** teszt fedi
(„elfogadás nélkül nem jön létre fiók"), tehát a GDPR-oldali védelem most sincs
őrizetlenül — csak a kliensoldali megjelenítés.

**Mikor tekinthető késznek:** a három teszt zöld, és egy szándékos elrontással
(pl. az `id="terms"` ideiglenes átírásával) igazoltan pirosra vált.

### T-5 · A riasztás-fojtás DB-függésének átgondolása — **NY-3, 4. menet**

**Miért:** minden riasztás-throttle (`Cache::add`, `Cache::increment`) a
`CACHE_STORE=database` miatt MySQL-táblát ír. Ha épp az adatbázis a hiba oka, a
fojtás-logika maga is kivételt dobhat — és az `AlertAdminOfLoggedError` `try/catch`
blokkja ilyenkor **némán elnyeli a riasztást**. Vagyis a legsúlyosabb hibatípusnál
(DB-kiesés) hallgathat a riasztó.

**Ez nem bizonyított hiba**, csak forgatókönyv — a 4. menet feladata igazolni vagy
cáfolni, futtatással (pl. leállított MySQL mellett kiváltott error-log).

**Lehetséges irány, ha igazolódik:** a riasztás-throttle átvitele fájl- vagy
tömb-alapú store-ra, vagy a `catch` ágban egy DB-független végszükség-csatorna.

---

## 11. Elvégzett munka (2026-09-21) — T-3 és T-4

> Tulajdonosi döntés alapján („igen kérlek jelezzük hogy az átmenetileg van kizárva")
> a T-3 az **1. út** szerint készült el: csoportba zárás, a kivezetés **átmeneti**
> jellegének kifejezett jelölésével. Teszt nem lett törölve.

### Mit csináltunk

**Jelölés a `kivezetett` csoporttal.** Öt fájl, 31 teszt:

| Fájl | Hatókör | Jelölés |
|---|---|---|
| `tests/Feature/QuizTest.php` | teljes fájl | `pest()->group('kivezetett')` |
| `tests/Feature/ClozeTest.php` | teljes fájl | `pest()->group('kivezetett')` |
| `tests/Feature/IrregularVerbTest.php` | teljes fájl | `pest()->group('kivezetett')` |
| `tests/Feature/StreakTest.php` | **1 eset a 14-ből** | `->group('kivezetett')` az eseten |
| `tests/Feature/PlanLimitTest.php` | **2 eset a 25-ből** | `->group('kivezetett')` az eseteken |

A két vegyes fájlnál szándékosan **csak az érintett esetek** kaptak jelölést — a
streak- és csomaglimit-logika többi tesztje továbbra is fut, mert azok élő
funkciókat őriznek.

**Minden jelölés kimondja, hogy ÁTMENETI**, és megmondja a visszakapcsolás módját
(„a `group()` hívást kell törölni"), hogy a jövőbeli olvasó ne véglegesnek higgye.

**Kizárás az alapfutásból:** `phpunit.xml` → `<groups><exclude><group>kivezetett`.

**T-4 — a 3 auth-teszt átirányítása:** `tests/Feature/Auth/AuthPagesTest.php`,
három helyen `pages/auth/register.tsx` → `components/auth/register-fields.tsx`.

### Bizonyíték, hogy működik

| Ellenőrzés | Eredmény |
|---|---|
| Teljes suite (`php artisan test --compact`) | **959 zöld, 1 skipped, 0 piros** (3598 assertion, 71 s) |
| Korábbi állapot | 956 zöld, **34 piros**, 1 skipped |
| A kivezetett csoport külön (`pest --group=kivezetett`) | **31 teszt megvan**, route-hiányra bukik — ahogy kell |
| T-4 őrző-próba | `id="terms"` szándékos elrontása → a teszt **pirosra váltott**; a fájl visszaállítva |
| `vendor/bin/pint --dirty` | `{"result":"pass"}` |

A T-4 őrző-próbája azért fontos: enélkül csak annyit tudnánk, hogy a teszt zöld —
nem azt, hogy tényleg őriz valamit. A szándékos elrontás bizonyítja, hogy a
**GDPR/ÁSZF-pipa kliensoldali megjelenítése ismét valódi őrizet alatt van.**

### Amit ez nem old meg

A T-1 (éles próbariasztás) és a T-2 (`schedule:run` cron) **változatlanul nyitva** —
mindkettő a szerveren végezhető el, és mindkettő go-live blokkoló. A suite zöldre
állítása nem helyettesíti őket: attól, hogy a tesztek rendben vannak, még nem tudjuk,
hogy élesben megszólal-e a riasztó.

---

## 12. A 2. menet leletei (2026-09-21) — A pénz útja, végponttól végpontig

**Verdikt: 0 HIGH · 3 MEDIUM · 2 LOW · 1 nyitott kérdés.**

A menet a fizetési lánc egészét nézte (Stripe-webhook → előfizetés-állapot → Billingo/NAV
számla → csomag-limitek), nem csak a változott részét. Az 1. menet átadása helytálló volt:
**a fedettség nem hiányzik, és a meglévő tesztek a helyes dolgot állítják.** A leletek
ezért nem rossz kódról szólnak, hanem **három hiányzó dologról** — olyan hálórésekről,
amiket egyik meglévő mechanizmus sem fog be.

A menet vezérkérdése minden lépésnél az volt: *mi történik, ha ez elbukik, és honnan
tudnánk meg?* A válasz a pénz-út nagy részén jó. Egy helyen viszont: **sehonnan.**

### Bizonyítékok — mit futtattam

| Próba | Mit vizsgált | Eredmény |
|---|---|---|
| PROBE1 | Limit fölötti meglévő könyvek listázása + olvasása (Pro, 5 könyv, limit 3) | **átment** — mind az 5 látszik, az 5. olvasható |
| PROBE3 | Pro lejárta után (free, limit 1) a 3 meglévő könyv sorsa | **átment** — mind látszik és olvasható |
| PROBE-A | Ismeretlen customer sikeres terhelésénél a webhook-foglalás sorsa | foglalás bent marad (szándékos, nem lelet) |
| PROBE-B | Van-e `stripe_webhook_events` takarító parancs | **nincs** (a `model:prune` nem éri el, nem Eloquent-modell) |
| PROBE-C | Elveszett `invoice.payment_succeeded` észlelhetősége | **semmi nem jelzi** — egyetlen `reconcile` parancs van, az csak előfizetést néz |
| PROBE-E | Nem-HU ország (DE) a billing-űrlapon | **elutasítva** — az ország-kapu fog |
| Teljes suite | `php artisan test --compact` a menet végén | **959 zöld, 1 skipped, 0 piros** (3598 assertion) |

A próbafájlok eldobhatók voltak, a menet végén törölve — a munkafa változatlan.

### L2-1 · Az elveszett fizetési webhook = néma NAV-mulasztás, semmi nem pótolja · **MEDIUM**

**Fájlok:** `app/Http/Controllers/StripeWebhookController.php:85` (a számlázás egyetlen
belépési pontja), `app/Console/Commands/ReconcileStripeSubscriptions.php`,
`routes/console.php`.

**Amit találtam:** a NAV-számla kiállításának **egyetlen** kiváltója az
`invoice.payment_succeeded` webhook. Ezt grep-pel megerősítettem: a
`GenerateBillingoInvoice::dispatch` az egész kódbázisban **egy helyen** hívódik
(`StripeWebhookController.php:93`), és az `InvoiceGenerator::generateForStripeInvoice`
kizárólag ebből a jobból. Nincs pótló parancs, nincs admin-felületi kézi kiállítás.

**Az aszimmetria:** az előfizetés-oldalon a rendszer **pontosan erre a kockázatra**
épített hálót — a `cashier:reconcile-subscriptions` naponta a Stripe-ot tekinti
igazságforrásnak, és pótolja az elveszett `customer.subscription.deleted`-et. A
számla-oldalon **nincs ilyen háló.** A `routes/console.php` kommentje maga is kimondja
az elvet („a Stripe webhookok legalább-egyszer és sorrend nélkül érkeznek: egy végleg
elveszett … a helyi sort tartósan … hagyná") — de csak az előfizetésre alkalmazza.

**Forgatókönyv:** a Stripe a webhookot 3 napig próbálja kézbesíteni. Ha a végpont ezalatt
végig elérhetetlen (kiterjedt leállás, lejárt tanúsítvány, hibás deploy, Ploi-kiesés), a
Stripe **feladja**. A pénz beszedve, az előfizetés a következő napi reconcile-on
rendbe jön — **a NAV-számla viszont soha nem készül el, és erről egyetlen jelzés sem
születik.** Nincs `failed_job` (a job létre sem jött), nincs log-sor (a kezelő le sem
futott), nincs `billingo_invoices` sor. A hiány csak akkor derül ki, ha valaki kézzel
összeveti a Stripe-számlákat a Billingóval.

**Miért MEDIUM és nem HIGH:** nem *némán hibázik* egy pénz-úton a szó szoros értelmében —
a hiba nem a kódban van, a kód helyesen fut le, amikor meghívják. A HIGH-hoz az kellene,
hogy a rendszer rutinszerűen veszítsen számlát; itt egy **tartós kézbesítési kiesés**
kell hozzá, ami ritka. De ha bekövetkezik, a következmény **jogszabályi mulasztás**
(kiállítatlan NAV-számla beszedett pénzhez), és a felderíthetőség **nulla** — ez
pontosan a tulajdonos 3. és 4. követelménye ellen hat. Kedvezőtlen körülmények közt
(pl. több napos kiesés több fizetéssel) HIGH-á válik.

**Mi cáfolná:** ha a Stripe Dashboardon be van kapcsolva a webhook-kézbesítési riasztás
(a Stripe e-mailt küld, ha egy endpoint tartósan hibázik), **és** ez a riasztás olyan
címre megy, amit valaki néz. Ez kódból nem eldönthető → **NY-4**. Fontos: ez a
Stripe-riasztás a *kézbesítési hibát* jelezné, nem a hiányzó számlát — tehát részleges
cáfolat lenne, nem teljes.

### L2-2 · A tesztkészlet nem tiltja a kimenő HTTP-t — egy elfelejtett mock éles NAV-számlát állíthat ki · **MEDIUM**

**Fájlok:** `phpunit.xml` (a `<php>` blokk), `tests/Pest.php`, `tests/TestCase.php`.

**Amit találtam — futtatva, nem olvasva:** a menet közben írtam egy próbatesztet, ami
egy `invoice.payment_succeeded` webhookot postolt anélkül, hogy a `BillingoClient`-et
mockolta volna. A teszt **valódi HTTP-hívást indított a `https://api.billingo.hu/v3/partners`
felé, az éles `BILLINGO_API_KEY`-jel.** A hívás csak azért nem ment át, mert a lokális
XAMPP-nak nincs rendben a CA-tanúsítványa (`cURL error 60: SSL certificate … unable to
get local issuer certificate`).

**A konfiguráció megerősítve futtatással:** teszt-környezetben
`config('services.billingo.enabled') === true` és az `api_key` **ki van töltve** — a
`phpunit.xml` gondosan semlegesíti a DB-t (`sqlite/:memory:`), a cache-t (`array`), a
mailt (`array`), a queue-t (`sync`) és a broadcastot (`null`), de a **külső
HTTP-integrációkat nem**. A `.env` `BILLINGO_ENABLED=true` értéke átszivárog. Nincs
`.env.testing`. A `Http::preventStrayRequests()` az egész kódbázisban **sehol** nem
szerepel.

**Forgatókönyv:** a meglévő 37 Billingo-teszt mind fegyelmezetten mockolja a klienst,
ezért zöldek — de ez **fegyelem, nem védőháló**. Egy jövőbeli teszt (vagy egy meglévő
átírása), amely elfelejti a mockot, egy helyesen konfigurált CA-tárral rendelkező gépen
vagy CI-futtatóban **valódi partnert és valódi NAV-számlát hoz létre az éles
Billingo-fiókban** — amit utána kézzel kell sztornózni. A `sync` queue miatt ez
azonnal, ugyanabban a kérésben történik meg.

**Miért MEDIUM:** ma nem okoz kárt (a lokális SSL-hiba véletlenül megvédi, és a
meglévő tesztek mockolnak), de a védelem **véletlen, nem tervezett**. Egy CA-javítás
vagy egy CI-bevezetés egy csapásra élessé teszi a kockázatot, ráadásul csendben — a
teszt „zöld" lenne, közben a Billingóban keletkezne egy számla. Rontja a
helyreállíthatóságot (kézi sztornó) és a felderíthetőséget.

**Mi cáfolná:** ha van CI-konfiguráció, ami külön, hamis kulcsokkal futtatja a
teszteket. Kerestem: nincs `.github/workflows` vagy egyéb CI-definíció a repóban,
és nincs `.env.testing` sem.

### L2-3 · A `stripe_webhook_events` tábla korlátlanul nő, takarítás nélkül · **LOW**

**Fájlok:** `database/migrations/2026_07_17_183925_create_stripe_webhook_events_table.php`,
`app/Http/Controllers/StripeWebhookController.php:49`.

**Amit találtam:** minden feldolgozott Stripe-esemény egy sort hagy ebben a táblában,
és a sor **soha nem törlődik** (kivéve a kivétel-ág kompenzációját). A `routes/console.php`
ütemez `sanctum:prune-expired`-et és `queue:prune-*` parancsokat, de erre a táblára
semmit. Futtatással megerősítve (PROBE-B): a `model:prune` nem éri el, mert nincs hozzá
Eloquent-modell (nyers `DB::table`).

**Forgatókönyv:** egy aktív fiókon a Stripe sok eseményt küld (előfizetésenként havonta
több). Évek alatt ez százezres nagyságrendű sort jelent. Nem okoz hibát — az `event_id`
unique indexe miatt a keresés gyors marad —, de a DB-mentés hízik, és egy jövőbeli
takarításnál senki nem fogja tudni, meddig biztonságos visszamenni.

**Miért LOW:** valós, de korlátozott hatású. Nem veszít pénzt, nem szivárogtat adatot,
és a teljesítményromlás is lassú. **Megjegyzés a helyes megoldáshoz:** a takarítás
küszöbe nem lehet tetszőleges — a Stripe **30 napig** próbálkozhat egy esemény
újraküldésével, ezért a 30 napnál fiatalabb sorok törlése újranyitná a duplikált
feldolgozás lehetőségét. Biztonságos küszöb: 60–90 nap.

### L2-4 · A `terms_accepted_at` akkor is elmentődik, ha a fizetés elindítása utána elhasal · **LOW**

**Fájl:** `app/Http/Controllers/PricingController.php:103` (mentés) vs. `:167` (a
Checkout-session létrehozása és annak hibaága).

**Amit találtam:** a kontroller a `$request->validate(['accept_terms' => ['accepted']])`
után **azonnal** elmenti a `terms_accepted_at` időbélyeget, majd ezután hívja a
Stripe-ot. Ha a `checkout()` `ApiErrorException`-nel elhasal (elkapva, felhasználóbarát
hibaüzenettel), a hozzájárulás időbélyege **bent marad**, holott előfizetés nem jött létre.

**Forgatókönyv:** a felhasználó rákattint a fizetésre, a Stripe hibázik, ő feladja és
soha nem fizet elő. A fiókján mégis ott az „elfogadta a 14 napos elállási jogról szóló
lemondást" nyom, dátummal. Ha később vita lesz egy *másik* fizetésről, a nyom
félrevezető: azt sugallja, hogy a hozzájárulás ehhez a (meg nem történt) tranzakcióhoz
kötődött.

**Miért LOW és nem több:** a hozzájárulás **ténylegesen megtörtént** (a felhasználó
kipipálta és elküldte), tehát a nyom nem hamis — csak nem köthető tranzakcióhoz. A
tényleges fizetéskor az időbélyeg amúgy is felülíródik. Jogi kockázatot inkább a
*hiányzó* nyom jelentene, nem a többlet. **Mi cáfolná:** ha a nyom máshol
tranzakcióhoz kötve is rögzülne — ilyet nem találtam, egyetlen `terms_accepted_at`
oszlop van a `users` táblán.

### Amit külön ki kell mondani: ami rendben van

A módszertan tiltja a látszat-leleteket, és az őszinte verdikt része a jó hír is. Ez a
menet **több dolgot cáfolt, mint amennyit talált** — a PLAN.md által előre várt leletek
nagy része nem áll fenn:

- **A PLAN.md „áfa és fordított adózás" kérdése tárgytalan.** A számlázás
  `BillingValidationRules::$supportedBillingCountries = ['HU']` miatt **kizárólag magyar
  vevőre** megy, és ezt futtatással is megerősítettem (PROBE-E: a `DE` ország
  elutasításra kerül). Nincs EU-s fordított adózás, nincs OSS-küszöb, nincs
  áfa-kulcs-mátrix. Az egykulcsos `BILLINGO_VAT=AAM` konfiguráció ezzel **konzisztens**.
- **A `books: 7 → 3` szűkítés nem vesz el semmit a meglévő felhasználótól.** Ez volt az
  1. menet célzott kérdése, és futtatással zártam le (PROBE1, PROBE3): a limit kizárólag
  **feltöltéskor** kapuz (`bookLimitError`: `count() >= limit`), a listázás és az olvasás
  érintetlen. Egy Pro-ról Free-re eső felhasználó (limit 1) mind a 3 könyvét látja és
  olvassa. Ez a helyes viselkedés — fizetett tartalomtól nem esik el senki.
- **Az env-parsing csapdája nem áll fenn.** A `.env`-ben a `BILLINGO_BLOCK_ID=0` és a
  `BILLINGO_VAT=AAM` sorokban inline `#` komment van idézőjel nélkül. Futtatással
  ellenőriztem: a Laravel parsere helyesen vágja le — `vat` = `"AAM"`, `block_id` = `0`.
- **A webhook-idempotencia helyes és tesztelt.** A központi `event_id`-foglalás a
  Cashier-feldolgozás köré van téve, kivételkor kompenzál (törli a foglalást, hogy az
  újraküldés újrapróbálhasson). 4 teszt fedi, köztük épp ez a kompenzációs ág.
- **A sorrendtévesztés mindkét iránya kezelve.** A `handleCustomerSubscriptionUpdated`
  nem engedi feltámadni a helyben már `canceled` előfizetést (elavult `active`
  pillanatkép eldobva), a `reconcile` pedig a másik irányt fogja be (beragadt „ingyen
  prémium"). A `handleCustomerDeleted` külön megvédi az admin adta ajándék-hónapot attól,
  hogy a Cashier kinullázza.
- **A reconcile kör-féke (blast-radius guard) átgondolt.** Ha egy futás az aktív állomány
  több mint 50%-át zárná le (és legalább 5 sort), a parancs **semmit nem zár le**, hanem
  riaszt és `FAILURE`-rel kilép — mert a valószínűbb ok egy rossz módú `STRIPE_SECRET`,
  nem tömeges lemondás. 4 teszt fedi, a küszöb mindkét oldalát.
- **A számla-kiállítás crash-védelme kifejezetten erős.** A Billingo v3-nak nincs
  idempotency-key headere, és ezt a kód nem söpri a szőnyeg alá: az `issuing_started_at`
  jelző a `createDocument` **előtt** perzisztálódik, a retry pedig a Billingóban
  visszakeresi a már kiadott dokumentumot (a `comment` mezőbe írt `stripe_invoice_id`
  horgony alapján), mielőtt másodikat állítana ki. A maradék ablak elvi, és a kód
  kommentje ezt őszintén ki is mondja.
- **A checkout-kapuk sorrendje helyes és bőven tesztelt** (`PricingCheckoutGatekeeperTest`,
  29 teszt). A nem-fizetős ágak (lifetime, `plan_override`, grace period, `past_due`) a
  billing-kapu **elé** kerültek, hogy senki ne kérjen számlázási adatot olyantól, akitől
  nem is fog levonni. A `past_due` user új előfizetés helyett kártyafrissítésre megy.
- **A duplikált előfizetés takarítása user-szintű lock alatt fut**, és a „keeper"
  választása nem naiv: előbb egy **egészséges** (valid) előfizetést tart meg, és csak
  azon belül a legrégebbit — így nem mondja le az élő, fizető előfizetést egy
  `incomplete` sor kedvéért.
- **A pénz-ágak hangosak.** Ismeretlen customer pozitív terhelése, visszatérítés,
  duplikált előfizetés — mind `Log::critical`, kifejezetten azzal a szöveggel, hogy
  kézi NAV-sztornó/refund kell. A rendszer tudja, hol nem tud automatizálni, és ott
  kiabál ahelyett, hogy csendben rosszul csinálná.
- **A PII-higiénia a job-payloadban megoldott.** A `GenerateBillingoInvoice::onlyNeededFields()`
  a teljes Stripe-payloadból csak a ténylegesen olvasott mezőket tartja meg, hogy az
  ügyfél-PII ne szerializálódjon a `jobs`/`failed_jobs` táblába.

### Nyitott kérdés (nem lelet)

- **NY-4 · Be van-e kapcsolva a Stripe webhook-kézbesítési riasztása, és nézi-e valaki?**
  Az L2-1 részleges cáfolata ezen múlik. A Stripe Dashboard küld e-mailt, ha egy endpoint
  tartósan hibázik — ha ez be van kapcsolva és figyelt címre megy, akkor a *tartós
  kiesésről* legalább értesülünk (bár a hiányzó számláról továbbra sem). Kódból nem
  eldönthető, a Stripe Dashboardon ellenőrizendő. → a T-6 mérlegeléséhez tartozik.

---

## 13. Teendők a 2. menetből

> Az audit dokumentál, nem javít — ez **teendőlista**, a végrehajtás külön döntés.
> A sorrend súlyozott. Egyik sem okoz most kárt (nincs fizető felhasználó).

| # | Teendő | Miből jön | Súly | Mikor | Állapot |
|---|--------|-----------|------|-------|---------|
| T-6 | Számla-egyeztető: a Stripe kifizetett számláit vesse össze a `billingo_invoices`-szal | L2-1 (MEDIUM) | fontos | go-live előtt javasolt | nyitva |
| T-7 | `Http::preventStrayRequests()` a teszt-bootstrapba | L2-2 (MEDIUM) | fontos | go-live előtt javasolt | nyitva |
| T-8 | A Stripe webhook-riasztás ellenőrzése a Dashboardon | NY-4 | kicsi | go-live előtt | nyitva |
| T-9 | `stripe_webhook_events` takarítás (60–90 napos küszöbbel) | L2-3 (LOW) | kicsi | ráér | nyitva |
| T-10 | `terms_accepted_at` mentése csak sikeres checkout-indítás után | L2-4 (LOW) | kicsi | ráér | nyitva |

### T-6 · Számla-egyeztető parancs — a legfontosabb a menetből

**Miért:** ez zárja be az egyetlen olyan rést, ahol a rendszer **jogszabályi
kötelezettséget mulaszthat úgy, hogy senki nem tud róla**. A minta már megvan és bevált:
a `cashier:reconcile-subscriptions` pontosan ezt csinálja az előfizetésekkel, kör-fékkel
együtt. Ugyanaz az elv alkalmazandó a számlákra.

**Mit kell tenni:** egy ütemezett parancs (pl. `billingo:reconcile-invoices`), amely a
Stripe-tól lekéri az utolsó N nap kifizetett számláit, és minden olyanra, amihez nincs
`billingo_invoices` sor, **vagy** riaszt (biztonságos első lépés), **vagy** újra sorba
teszi a `GenerateBillingoInvoice` jobot (az `InvoiceGenerator` idempotenciája miatt ez
biztonságos — nem hoz létre második számlát).

**Javaslat a súlyozáshoz:** kezdésnek elég a **riasztó** változat. Az automatikus
újraszámlázás nagyobb hatalom, és a kör-fék logikáját is meg kellene hozzá ismételni.

**Mikor tekinthető késznek:** a parancs egy szándékosan kihagyott webhook után
(pl. a `billingo_invoices` sor kézi törlésével szimulálva) riaszt, és ezt teszt fedi.

### T-7 · `Http::preventStrayRequests()` a teszt-bootstrapba

**Miért:** ma csak egy lokális SSL-konfigurációs hiba akadályozza meg, hogy egy
mock nélküli teszt éles NAV-számlát állítson ki. Ez nem védelem, csak szerencse.

**Mit kell tenni:** a `tests/Pest.php`-ban (vagy a `TestCase::setUp()`-ban) globálisan
`Http::preventStrayRequests()`. Ettől minden nem-fake-elt kimenő HTTP-hívás **hangos
teszthibát** dob a csendes valódi hívás helyett. Kiegészítésként érdemes a `phpunit.xml`-be
`<env name="BILLINGO_ENABLED" value="false"/>` és egy hamis `BILLINGO_API_KEY` —
így két, egymástól független réteg véd.

⚠️ **Várható mellékhatás:** a bevezetés **felszínre hozhat** olyan meglévő teszteket,
amelyek eddig csendben hívtak ki. Ez nem a változtatás hibája, hanem épp a haszna —
de a T-7 nem feltétlenül egy soros munka, és a suite-ot utána végig kell futtatni.

**Mikor tekinthető késznek:** a teljes suite zöld, **és** egy szándékosan mock nélkül
hagyott próbateszt igazoltan `StrayRequestException`-nel bukik, nem éles hívást indít.

### T-8 · A Stripe webhook-riasztás ellenőrzése

**Miért:** az L2-1 kockázatát részben mérsékli, és ellenőrzése pár perc. Ha a Stripe
riaszt a tartós kézbesítési hibáról, a legrosszabb forgatókönyv (3 napos néma kiesés)
nem marad észrevétlen — bár a konkrét hiányzó számlát ez sem mondja meg.

**Mit kell tenni:** Stripe Dashboard → Developers → Webhooks → az endpoint riasztási
beállításai; ellenőrizni, hogy a hibaértesítés aktív, és figyelt címre megy.

**Mikor tekinthető késznek:** a beállítás igazoltan aktív, és a cím egyezik a figyelt
postafiókkal (`developedbybarley@gmail.com` vagy a Stripe-fiók e-mailje).

### T-9 · `stripe_webhook_events` takarítás

**Mit kell tenni:** ütemezett törlés a 60–90 napnál régebbi sorokra. **A küszöb nem
lehet kisebb 30 napnál** — a Stripe eddig próbálkozhat újraküldéssel, és a korábbi
törlés újranyitná a duplikált feldolgozás lehetőségét. Megoldható egy pici
Eloquent-modellel + `Prunable` trait-tel (így a meglévő `model:prune` ütemezésbe
illeszkedik), vagy egy dedikált parancssal.

**Mikor tekinthető késznek:** a takarítás fut, a küszöb ≥ 60 nap, és teszt fedi, hogy a
küszöb alatti sort **nem** törli.

### T-10 · `terms_accepted_at` mentése a sikeres checkout-indítás után

**Mit kell tenni:** a `PricingController::checkout()`-ban a `forceFill(['terms_accepted_at'])`
mentését a `$subscriptionBuilder->checkout()` **sikeres** visszatérése utánra mozgatni
(a swap-ágon hasonlóan). Így a nyom csak akkor keletkezik, ha a fizetés tényleg elindult.

**Mikor tekinthető késznek:** teszt igazolja, hogy Stripe-hiba esetén a
`terms_accepted_at` **nem** íródik be, sikeres checkout-indításnál viszont igen.

---

## 14. A 3. menet leletei (2026-09-21) — Felhasználói adat: védelem és jogi megfelelés

**Mérleg: 0 HIGH · 1 MEDIUM · 2 LOW · 2 nyitott kérdés**

A menet legfontosabb eredménye egy **cáfolat**: a `Gy-2` gyanú („nincs fiók-törlés és
adat-export") **nagyrészt téves volt**. A fiók-törlés létezik, jelszóval védett, és a
vártnál lényegesen gondosabban van megírva.

### Bizonyítékok — mit futtattam

Eldobható szonda-teszt (`AuditM3ProbeTest`, a menet végén **törölve**) három változatban,
amely valódi `DELETE /settings/profile` kérést futtatott, majd megszámolta, mi maradt a
DB-ben. Ez döntötte el a kaszkád-kérdést — nem a migrációk olvasása.

| Szonda | Amit mért | Eredmény |
|--------|-----------|----------|
| A | törlés előfizetés nélkül | `users` sor **eltűnt**; `sessions` és `password_reset_tokens` sor **maradt** |
| B | törlés árva (FK nélküli) `subscriptions` sorral | `users` sor **eltűnt**; `subscriptions` + `subscription_items` **maradt** |
| C | valódi login utáni session-sor | tesztkörnyezetben `array` session-driver → **nem döntött**, lásd lentebb |

Mind a 14 `user_id`-t tartalmazó tábla ellenőrizve: **12 helyesen kaszkádol**
(`user_word`, `folders`, `flashcard_decks`, `flashcard_folders`, `user_achievements`,
`user_books`, `youtube_transcripts`, `flashcard_settings`, `user_custom_words`,
`player_pairings`, `reports`), a `billingo_invoices` szándékosan `nullOnDelete`
(számviteli megőrzés — helyes), és csak a `subscriptions` marad FK nélkül.

Futtatva még: `php artisan test tests/Feature/Settings/` → **75 zöld**.

---

### Amit külön ki kell mondani: ami rendben van

Ez a menet több ponton **jobb állapotot talált a vártnál**. Ezt ugyanolyan súllyal
rögzítem, mint a leleteket.

**A `Gy-2` gyanú cáfolva — a fiók-törlés megvan és jól van megírva.**
`ProfileController::destroy()` ([app/Http/Controllers/Settings/ProfileController.php:51](../../app/Http/Controllers/Settings/ProfileController.php#L51)):
- jelszó-megerősítéshez kötött (`ProfileDeleteRequest`), `throttle:6,1,profile-delete`;
- **törlés előtt lemondja az összes még élő Stripe-előfizetést** — és szándékosan a
  `past_due`/`incomplete` állapotúakat is, amiket a `valid()` kihagyna. Ez pontosan az a
  hiba, amitől „lemondott, de még fizet" lesz; itt meg van előzve;
- ha a lemondás elbukik, a kivétel felszáll és a fiók **nem** törlődik — így nem keletkezik
  „élő előfizetés gazdátlan kártyán" állapot;
- eltakarítja a nem kaszkádoló Sanctum player-tokeneket;
- 9 teszt fedi, köztük a több élő előfizetés lemondása és a hibás jelszó elutasítása.

**Az adatkezelési tájékoztató és a kód egyezik.** A 705 soros
[privacy.tsx](../../resources/js/pages/legal/privacy.tsx) állításai közül a kódból
ellenőrizhetőket végignéztem, és **igaznak találtam**:
- *„Fiókazonosítót, e-mail-címet vagy más azonosító adatot az AI-szolgáltató felé nem
  küldünk"* — **igaz**. A `callGemini()` payloadja
  ([TextAnalysisController.php:2551](../../app/Http/Controllers/TextAnalysisController.php#L2551))
  kizárólag `contents` + `generationConfig`; a `$user` paraméter csak a helyi keret-
  könyveléshez kell, a kimenő kérésbe nem kerül bele.
- *„a kártyaadatokat közvetlenül a Stripe kezeli, azokat nem tároljuk"* — a kódban
  nincs kártyaadat-tárolás.
- *„nem tartalmaz hirdetési vagy nyomkövető technológiát"* — nincs analitika a kódban.
- *„A technikai naplóadatokat… legfeljebb 12 hónapig"* — a `.env` `LOG_DAILY_DAYS=365`
  ezt **pontosan** teljesíti (de lásd L3-3: ez a *lokális* .env).
- A GDPR-jogok szakasza helyesen **kapcsolattartási ponton keresztüli kérelemként**
  fogalmaz, nem ígér önkiszolgáló exportot. Az „adathordozhatóság" tehát **nincs
  megszegve** azzal, hogy nincs export-gomb — a jogszabály kézi teljesítést is megenged.
  **Ezért nincs HIGH lelet a menetben.**

**IDOR: nem találtam szivárgást.** Az Inertia-propok
([HandleInertiaRequests.php:43](../../app/Http/Middleware/HandleInertiaRequests.php#L43))
mindenhol `$request->user()`-ből építkeznek, `only([...])`-tal szűrve. A kontrollerekben
a nem user-scope-olt lekérdezéseket egyenként átnéztem: a `FlashcardCardController`
`move()` és `bulkMove()` `findOrFail($target_deck_id)` hívása **közvetlenül utána
`abort_unless($targetDeck->user_id === ...)`-t tesz** — nem IDOR. Az
`ExtensionController` `Word::find()`-ja a közös szótár-táblát olvassa, ami nem
felhasználói adat.

**Naplózási adatvédelem: nem szivárog PII a logba.** A `Log::` hívásokat végigszűrtem
prompt/e-mail/jelszó/token tartalomra: az egyetlen szöveg-tartalmú log a Gemini
*válaszának* 500 karakteres részlete
([TextAnalysisController.php:2658](../../app/Http/Controllers/TextAnalysisController.php#L2658))
— AI-kimenet, nem felhasználói személyes adat. A 4. menet naplózási szálának ez jó hír.

**A session-maradvány nem lelet — magától eltűnik.** A törlés után a `sessions` sor
valóban bennmarad (A szonda), és a `database` driver miatt IP-címet és user-agentet is
tartalmaz. **De:** a `config/session.php` `'lottery' => [2, 100]` beállítása miatt a
Laravel takarít, és a `DatabaseSessionHandler::gc()`
(`vendor/.../DatabaseSessionHandler.php:280`) **lejárat szerint** töröl
(`last_activity <= now - lifetime`), nem felhasználó szerint. A 120 perces
`SESSION_LIFETIME` letelte után a sor a következő söprésnél eltűnik, akkor is, ha a
felhasználó már nem létezik. **Öngyógyuló — nem rögzítem leletként.**

**Session- és token-kezelés rendben.** A player-tokenek explicit 90 napos lejáratot
kapnak ([PlayerPairingController.php:150](../../app/Http/Controllers/PlayerPairingController.php#L150)),
így a `sanctum:prune-expired` ténylegesen talál mit törölni (a `config/sanctum.php`
`'expiration' => null` önmagában félrevezető lenne). A `SecurityTest` 18 tesztje fedi a
token-visszavonást, a jelszóváltáskori token-rotációt és azt, hogy egy user nem vonhatja
vissza másik user eszközét.

---

### L3-1 · A `subscriptions` táblán nincs idegenkulcs — a törölt fiók előfizetés-sorai bennmaradnak · **LOW**

**Hol:** [database/migrations/2026_04_08_161316_create_subscriptions_table.php:16](../../database/migrations/2026_04_08_161316_create_subscriptions_table.php#L16)
(`$table->foreignId('user_id');` — `constrained()` **nélkül**), és ugyanígy a
`subscription_items.subscription_id`.

**Bizonyíték:** a B szonda — a fiók törlése után a `subscriptions` és `subscription_items`
sor **megmaradt** (`1` és `1`), miközben a `users` sor eltűnt.

**Forgatókönyv:** a felhasználó törli a fiókját → a Cashier-sorok árván a táblában
maradnak. Tartalmuk: `user_id` (már nem létező fiókra), Stripe-azonosítók, ár, státusz,
dátumok. **Közvetlen személyes adatot nem tartalmaznak** (nincs név, e-mail) — ezért nem
GDPR-lelet, hanem adat-higiéniai.

**Miért LOW és nem MEDIUM — a cáfolat, amit megpróbáltam:** először azt gyanítottam, hogy
a `cashier:reconcile-subscriptions` elbukik az árva sorokon (`$subscription->user` null).
**Ez nem igaz:** a `reconcile()`
([ReconcileStripeSubscriptions.php:152](../../app/Console/Commands/ReconcileStripeSubscriptions.php#L152))
kizárólag Stripe-azonosítókkal dolgozik, a `user` relációt nem érinti. Ráadásul a
`destroy()` a törlés előtt lemondja az élő előfizetéseket, így az árva sor státusza
normál úton már `canceled` — a `->active()` szűrő ki is hagyja. **Maradék kockázat:**
ha a jövőben bárki `Subscription`-ből indulva próbál a felhasználóhoz nyúlni, null-ra fut.

**Mi cáfolná teljesen:** ha a Cashier valahol maga takarítaná az árva sorokat. Nem teszi.

---

### L3-2 · Az elhagyott jelszó-visszaállítási kérések e-mail-címei örökre a DB-ben maradnak · **MEDIUM**

**Hol:** [routes/console.php](../../routes/console.php) — az `auth:clear-resets` parancs
**nincs ütemezve** (a fájlban `queue:alert-failed`, `queue:monitor`,
`sanctum:prune-expired` és `cashier:reconcile-subscriptions` szerepel, ez nem).

**Bizonyíték:** az A szonda után a `password_reset_tokens` sor megmaradt a törölt
felhasználó e-mail-címével. A Laravel `DatabaseTokenRepository`
(`vendor/.../DatabaseTokenRepository.php:57,151`) a sort **csak** két esetben törli:
sikeres jelszó-visszaállításkor, vagy ha ugyanarra az e-mailre **új** kérés érkezik. A
lejáratot (`config/auth.php`: `'expire' => 60` perc) kizárólag a `deleteExpired()`
érvényesíti takarításként — ezt pedig az `auth:clear-resets` hívja, ami nem fut.

**Forgatókönyv:** a felhasználó elfelejtett jelszót kér, de a levelet sosem nyitja meg
(vagy közben eszébe jut a jelszó) → a sor bennmarad. Ha később **törli a fiókját**, a
`password_reset_tokens` táblában **továbbra is ott az e-mail-címe**, mert a tábla
e-mail-alapú, nincs `user_id`-ja és FK-ja.

**Miért MEDIUM:** ez az egyetlen pont, ahol a menet tényleges **ellentmondást talált a
tájékoztató és a valóság között**. A privacy-oldal 3. pontja azt ígéri: *„Fiók törlése
esetén az összes személyes adat véglegesen és visszavonhatatlanul törlésre kerül a
rendszerből, a jogszabályi kötelezettségek alapján kötelezően megőrizendő adatok
kivételével."* Az e-mail-cím **személyes adat**, és a megőrzésének **nincs jogalapja** —
egy lejárt reset-token nem számviteli bizonylat. Nem szivárgás és nem okoz működési hibát,
de a törlési ígéret nem teljesül maradéktalanul. Ez az a fajta hiba, ami egy NAIH-
vizsgálaton kellemetlen, mert **írásban vállalt** dolgot szeg meg.

**Mi cáfolná:** ha a Laravel máshol takarítaná ezt a táblát (nem teszi — a `deleteExpired`
az egyetlen út), vagy ha a `destroy()` maga törölné a sort az e-mail alapján (nem teszi).

**Enyhítő körülmény:** a sor **lejárt** tokent tartalmaz, tehát biztonsági kockázatot nem
jelent (nem váltható be). Ezért nem HIGH.

---

### L3-3 · A `.env.example` nem rotáló naplót állít be — az örökölt éles konfig megszegheti a 12 hónapos ígéretet · **LOW**

**Hol:** [.env.example](../../.env.example) — `LOG_STACK=single`, és **nincs benne**
`LOG_DAILY_DAYS`. A fejlesztői `.env`-ben ezzel szemben `LOG_STACK=daily` és
`LOG_DAILY_DAYS=365` áll.

**Forgatókönyv:** ha az éles szerver `.env`-je a példafájlból származik, akkor a
`single` driver **egyetlen, soha nem rotált `laravel.log`-ot** ír. A privacy-oldal
viszont azt ígéri, hogy a technikai naplóadatokat (kifejezetten nevesítve: **IP-cím**,
hibanapló) *„legfeljebb 12 hónapig"* kezeljük. Egy soha nem rotált log ezt nem tudja
tartani — a megőrzési idő végtelen lesz, méghozzá pont arra az adatkörre, amit a
tájékoztató külön nevesít.

**Miért LOW és nem MEDIUM:** a lokális `.env` a **helyes** beállítást tartalmazza
(`daily` + 365 nap), tehát a projekt tudja a helyes értéket, és jó eséllyel az élesben is
az van. **Nem tudom eldönteni innen**, hogy az éles szerveren mi áll — ezért a lelet a
példafájlra szól, a tényleges éles állapot pedig nyitott kérdés (NY-5).

**Mi cáfolná:** ha az éles `.env`-ben `LOG_STACK=daily` és `LOG_DAILY_DAYS<=365` áll.
Egy parancs eldönti a szerveren: `php artisan config:show logging`.

---

### Nyitott kérdések (nem leletek)

**NY-5 · Mi az éles szerver naplórotációs beállítása?**
Kódból nem eldönthető (a `.env` nincs verziókezelve). Az L3-3 ezen áll vagy bukik.
Ellenőrzés a szerveren: `php artisan config:show logging`.

**NY-6 · Hogyan teljesül a gyakorlatban a hozzáférési és hordozhatósági kérelem?**
A tájékoztató helyesen kapcsolattartási pontra irányít, és ez jogilag elégséges — a GDPR
nem követel önkiszolgáló export-gombot. **De 30 nap a törvényi határidő**, és jelenleg
nincs olyan eszköz (parancs, admin-nézet), amivel egy kérelemre össze lehetne szedni egy
felhasználó adatait a 14 táblából. Egyetlen kérelem is órákat vihet el kézzel.
**Ez nem lelet — döntési kérdés:** vállalod a kézi összeszedést, vagy kérsz egy
`user:export {email}` parancsot. Fizető szolgáltatásnál az utóbbit javaslom, de indulás
előtt nem blokkoló.

---

## 15. Teendők a 3. menetből

### T-11 · `auth:clear-resets` ütemezése — **L3-2 (MEDIUM)**

**Miért:** ez az egyetlen pont, ahol a rendszer **írásban vállalt** törlési ígéretet szeg
meg. A javítás **egyetlen sor**, és a Laravel beépített parancsát használja.

**Mit kell tenni:** a [routes/console.php](../../routes/console.php)-ba, a többi ütemezés
mellé:

    Schedule::command('auth:clear-resets')->daily();

Érdemes a meglévő kommentezési stílust követve odaírni, hogy ez a **törlési ígéret
teljesítése**, ne csak tábla-higiénia — különben egy későbbi olvasó fölöslegesnek látja
és kiveszi.

**Mikor tekinthető késznek:** teszt igazolja, hogy a parancs ütemezve van (a meglévő
ütemezés-tesztek mintájára), és hogy egy lejárt `password_reset_tokens` sort a parancs
lefutása **törli**, egy frisset viszont **nem**.

**Megjegyzés:** ez a T-2-vel (fut-e a `schedule:run` cron) **együtt** ér valamit. Ha a
cron nem megy, ez a sor sem fut le. A kettőt egyszerre kell lezárni.

---

### T-12 · Az éles naplórotáció ellenőrzése és a `.env.example` javítása — **L3-3 (LOW)**

**Mit kell tenni:** (1) a szerveren `php artisan config:show logging` — ha nem `daily`
365 napos megőrzéssel, akkor az éles `.env` javítása; (2) a `.env.example`-ben
`LOG_STACK=daily` és `LOG_DAILY_DAYS=365`, hogy egy jövőbeli telepítés ne örökölje a
`single` beállítást.

**Mikor tekinthető késznek:** az éles konfig igazoltan rotál, és a példafájl a helyes
értéket adja tovább.

---

### T-13 · Idegenkulcs a `subscriptions` táblára — **L3-1 (LOW), opcionális**

**Mit kell tenni:** migráció, amely `subscriptions.user_id`-ra `cascadeOnDelete`
FK-t tesz (és `subscription_items.subscription_id`-ra szintén). **Előtte takarítani kell
a meglévő árva sorokat**, különben a FK létrehozása elbukik.

**Megfontolandó ellenérv — ezért „opcionális":** a `billingo_invoices` esetében a projekt
tudatosan a **megőrzés** mellett döntött (`nullOnDelete`), könyvelési okból. Az
előfizetés-előzmény hasonló megfontolás alá eshet: egy vitás Stripe-visszaterhelésnél
jól jöhet, hogy megvan a helyi nyom. **Döntsd el, melyiket akarod** — a jelenlegi
állapot (FK nélkül, véletlenül megmaradó sorok) viszont *egyik* szándékot sem fejezi ki,
csak a mulasztást. Ha a megőrzés a cél, akkor `nullOnDelete` a helyes forma, és ezt a
privacy-oldalon nem kell külön nevesíteni (nincs benne személyes adat).

**Mikor tekinthető késznek:** a séma a választott szándékot fejezi ki, és teszt fedi,
mi történik a sorral a fiók törlésekor.

---

### T-14 · Döntés a GDPR-kérelmek kiszolgálásáról — **NY-6, nem blokkoló**

**Mit kell tenni:** eldönteni, kell-e `user:export {email}` Artisan-parancs, ami JSON-ba
gyűjti egy felhasználó adatait a 14 táblából. Ha nem kell, akkor **írásban rögzíteni a
kézi folyamatot**, hogy a 30 napos határidő ne érjen készületlenül.

**Mikor tekinthető késznek:** vagy megvan a parancs teszttel, vagy le van írva a kézi
lépéssor.
