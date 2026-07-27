# Dimenzió B — Onboarding flow state-manipuláció

> Fázis 5 / 2. PLAN-pont · 2026-07-27 · **csak dokumentálás, kód nem módosult**

## A PLAN-pont szó szerint

> **Onboarding flow** state-manipuláció (`OnboardingController`, `EnsureOnboardingComplete` middleware):
> átugorható-e a lépéssor, van-e olyan védett route ami onboarding nélkül elérhető / fordítva lock-out.

## Vizsgált felület

| Fájl | Szerep |
|---|---|
| `app/Http/Controllers/OnboardingController.php` (115 sor) | `show()` + `complete()` |
| `app/Http/Middleware/EnsureOnboardingComplete.php` (22 sor) | a gate |
| `routes/web.php:75-83`, `words.php:15`, `flashcards.php:13`, `text-analysis.php:7` | gate-elhelyezés |
| `routes/extension.php`, `routes/api.php` | gate-mentes JSON-kliensek |
| `resources/js/pages/onboarding/index.tsx` | a kliens-oldali payload-építés |
| `tests/Feature/OnboardingTest.php` | lefedettség |

**Mérleg: 0 HIGH · 0 MEDIUM · 4 LOW · 5 INFO.**

A PLAN **mindkét központi feltevése megdőlt**. Az egyetlen érdemi lelet nem a
szint-manipuláció, hanem a korlátlan tömb + korlátlan újra-POST erőforrás-vektora — és az is
LOW-ra redukálódott a 3-körös adverzariális verifikáció után (lásd `03-VERIFIKACIOS-NAPLO.md`).

**Léptékadat (élő DB-ből mérve):** a `words` tábla **pontosan 10 000 sor**
(szintenként 1000/1000/2000/1999/2006/1995). Ez a maximális `upsert`-sorszám.

---

## ONB-1 · `OnboardingController.php:51-56,64-101` + `routes/web.php:77` · **LOW** · erőforrás-vektor

> **Finder-súly: MEDIUM → végleges: LOW.** Teljes verifikációs út: `03-VERIFIKACIOS-NAPLO.md`.

**Forgatókönyv (bemenet → hatás):** a `POST /onboarding` **semmilyen `throttle`-t nem visel**
(teljes stack: `web` + `Authenticate` + `EnsureEmailIsVerified`), a validáció `['array']`-t
követel **`max:` nélkül**, elemenként `exists:words,id`-vel. Egy hitelesített, verifikált user
ciklusban küldi:

```
POST /onboarding
{"shown_word_ids":[1..10000], "known_word_ids":[1..10000]}
```

**Mért költség kérésenként (élő DB, saját mérés):**

| Rész | Mérés |
|---|---|
| `exists` validáció, 200 elem | 72,7 ms / **201 query** |
| `exists` validáció, 2000 elem | 524 ms → **10 000 elem ≈ 2,6 s** |
| `pluck` 2000 sor `rank` szerint | 61,9 ms (indexelt) |
| 10 000 soros upsert SQL mérete | ~0,8 MB (`max_allowed_packet` = 1,00 MB) |

A drágaság súlypontja tehát **nem az upsert, hanem az elemenkénti `exists` N+1**: a kérés
idejének túlnyomó része ott telik. Mérés igazolja, hogy a szabály nem batch-el és **nem is
bail-el** — érvénytelen ID-knál is lefut minden query, mielőtt 422-t adna, tehát a
validációs hiba nem védelem.

**A kliens sosem küld ilyet:** az `index.tsx:500-516` mindig a teljes, szintenkénti 20-as
`allShownIds` halmazt küldi. Ez kizárólag kézzel gyártott payload.

**Blast radius — plafonos, ez döntötte le a MEDIUM-ot:**
- Az upsert a `user_word` **elsődleges kulcsára** megy (`primary(['user_id','word_id'])`,
  `create_user_word_table.php:17`) → az ismétlés `UPDATE`, nem `INSERT`.
  **Max. 10 000 sor/user, örökre. Korlátlan ismétlés = nulla tárhely-növekedés.**
- Az írás kizárólag a támadó saját sorait érinti; a `words` olvasása read-only és indexelt
  (`SHOW INDEX`: `words_rank_index`, `words_level_index`).
- Van **olcsóbb vektor ugyanott**: a `GET /onboarding` szintén throttle-mentes, és 6×
  `ORDER BY RAND()`-ot futtat — nulla payloadért (lásd ONB-9).

**Verifikációs verdikt: PLAUSIBLE** (2 LOW vs 1 MEDIUM szavazat; a MEDIUM premisszája megdőlt).

**Miért nem MEDIUM:** a finder indoklása az volt, hogy ez „az app egyetlen throttle-mentes
írás-végpontja". **Ez tényszerűen hamis** — saját mérés forráskódból:
`routes/flashcards.php` 26 mutáló route-jából **0** visel throttle-t, `routes/words.php`
13-ból **1**. Összesen ~50 throttle-mentes mutáló route van; a throttle-t célzottan a drága
vagy érzékeny utak kapták (AI, extension-írás, checkout, letöltés, profil). Az onboarding
tehát **a többségi mintát követi**, nem kilóg belőle.

**Miért nem INFO:** a mechanizmus valós és mért — ~2,6 s DB-idő ~1 KB JSON-ért, korlátlanul
ismételhetően. Ez kedvezőtlen csereárfolyam.

**A lelet pontos magja:** ez az **egyetlen hely a kódbázisban, ahol wildcard `exists:` szerepel**
(N+1 ott, ahol egy `whereIn` elég lenne), ráadásul **funkcionálisan redundáns**: a `:65` sor
`Word::whereIn(...)`-nel amúgy is újra lekérdez, és a nem létező ID-k onnan kiesnek.
Kód-minőségi hiba mérhető teljesítmény-következménnyel, **nem biztonsági rés**.

*Javítás iránya (nem hajtottuk végre): `throttle` a route-ra, `max:` a két tömbre, és az
elemenkénti `exists` elhagyása vagy tömbösítése.*

---

## ONB-2 · `OnboardingController.php:49,104` · **LOW** · idempotencia-hiány

**Forgatókönyv:** a `complete()`-ben **nincs guard arra, hogy az onboarding már befejeződött**.
A route szándékosan a gate-en kívül van, tehát egy `onboarding_completed_at`-tal rendelkező user
is szabadon újra POST-olhat. Hatások:

1. **`onboarding_completed_at` felülírás** (`:104`) — ártalmatlan: a mező kizárólag a middleware
   null-vizsgálatához kell.
2. **Tömeges `known` újraírás** — az upsert a `['status','reviewed_at','updated_at']` oszlopokat
   frissíti, tehát a user korábban `learning`/`saved` státuszra állított szavai **visszaíródnak
   `known`-ra**, és a `reviewed_at` visszaáll. Valós, de **kizárólag saját adatvesztés**, és csak
   ha a user maga küldi újra a kérést — a UI-n ez nem elérhető út.
3. **Achievement újra-kiadás: NEM történik meg** (lásd a megdőlt PLAN-feltevéseket).

**Blast radius:** self-only, adatvesztés-jellegű, támadó számára értéktelen.
**Verifikációs verdikt: CONFIRMED** (a guard hiánya közvetlen kódtény).

---

## ONB-3 · `OnboardingController.php:64-88` · **LOW** · kliens-vezérelt szint-önbevallás

**Forgatókönyv (a PLAN által javasolt konkrét út):**
```
POST /onboarding {"shown_word_ids":[<1 db 6. szintű szó id>], "known_word_ids":[<ugyanaz>]}
```
`shownCount=1`, `knownCount=1` → `$ratio = 1.0` (`:71`) → `$totalInLevel = 1995` →
`$markCount = 1995` → a 6. szint **összes szava `known`-ra kerül**. Hat POST-tal (szintenként
egy szó) a teljes 10 000 szó `known`.

**Amit ez a usernek ténylegesen ér:**

| Lehetséges nyereség | Verdikt | Bizonyíték |
|---|---|---|
| Kvóta-megkerülés | **NEM** | a napi írás-keret csak extension-originre foglal; a webes szó-jelölés amúgy sem fogyaszt keretet → nincs megkerült korlát |
| Pro / fizetős funkció | **NEM** | a `user_word`-öt csak statisztika/megjelenítés olvassa (Dashboard, Word, Extension, Admin controller); nulla entitlement-döntés függ tőle |
| Pénz | **NEM** | nincs kapcsolat a Cashier/plan-logikával |
| Achievement | **IGEN, self-only** | `known_1000`, `vocab_1000`, mind a 6 `level_N_complete` feloldódik |
| Statisztika | **IGEN, self-only** | a dashboard 100%-os szintkészültséget mutat |

**Verifikációs verdikt: CONFIRMED mint viselkedés, de a súlyosság LOW.**
A „szint-önbevallás" **tervezett funkció**, nem hiba: az onboarding célja épp az, hogy a user
megmondja, mit tud. A UI ugyanezt engedi kattintással (`index.tsx:512-516`) — a payload-hamisítás
csak **gyorsabban** éri el ugyanazt, amit 20 kattintással legitimen is el lehet érni.
Ez „az önbevallás integritása" kategória, nem biztonsági határátlépés.

*(Ugyanez a mechanizmus az A dimenzióban ACH-2 néven, achievement-nézőpontból — **egy valós
leletként számolandó**.)*

---

## ONB-4 · `OnboardingController.php:65,81-84` · **LOW** · hiányzó szerver-oldali „mit mutattam" állapot

**Forgatókönyv:** a `shown_word_ids` elemeit a szerver **nem veti össze azzal, amit a `show()`
ténylegesen kiadott**. A `show()` szintenként 20 véletlen szót ad (`:32-37`), de semmit nem ír
sessionbe; a `complete()` a beküldött ID-kből **újra lekérdezi a szintet** (`:65`) és a beküldés
szerint csoportosít.

Ez ONB-3 **enablere** — emiatt lehet 1 elemű „szintet" fabrikálni 20 helyett. Külön leletként
azért szerepel, mert a javítás iránya eltérő (szerver-oldali shown-set tárolása vs. tömb-validálás).

**Blast radius:** azonos ONB-3-mal (self-only, gamifikációs).
**Verifikációs verdikt: CONFIRMED.**

---

## ONB-5 · `OnboardingController.php:19,42-46` + `config/app.php` · **LOW** · tesztlefedettségi hézag

`config('app.onboarding_enabled', true) !== false`; az `.env`-ben nincs `ONBOARDING_ENABLED`
kulcs → a default `true` érvényesül.

**Lock-out kizárva:** ha `false`, a `show()` üres `wordsByLevel`-t ad, de a kliens ekkor
`'features'` lépésre inicializál (`index.tsx:446-448`), és a `theme` lépés végén a `submit` gomb
elérhető marad → a user **be tudja fejezni** az onboardingot.

**Verifikációs verdikt: REFUTED** a lock-out állításra. A maradék LOW **tesztlefedettségi
hiányosság**: nincs teszt arra, hogy `onboarding_enabled=false` mellett a `complete()` végigmegy.
A config bekapcsolása esetén ez regressziós kockázat.

---

## ONB-6 · `EnsureOnboardingComplete.php:16` · **INFO** · a `?->` vendég-redirect → **REFUTED**

**A PLAN/gyanú:** `$request->user()?->onboarding_completed_at === null` — vendégnél
`null === null` → `true` → a vendéget is redirectelné.

**Nem érvényesül.** A middleware **mind a 4 használati helyén** kizárólag
`['auth', 'verified', EnsureOnboardingComplete::class]` sorrendben szerepel (`routes/web.php:80`,
`words.php:15`, `flashcards.php:13`, `text-analysis.php:7`) — teljes grep-lefedettséggel
ellenőrizve, **nincs `auth` nélküli előfordulás**. Vendég sosem éri el; az `Authenticate` már
`/login`-ra irányított.

**Maradék megjegyzés (nem lelet):** a védekezés a hívási sorrendtől függ, nem magától a
middleware-től. Ha valaki egy jövőbeli route-on `auth` nélkül alkalmazná, a vendég
`/onboarding`-ra kerülne, ami maga `auth` mögött van → `/login`. **Még akkor sem loop**, csak
felesleges ugrás. A `?->` tehát defenzív fail-safe.

---

## ONB-7 · `routes/web.php:75-83` + teljes route-fa · **INFO** · gate-lefedettség → **REFUTED**

**A gate mögött:** `dashboard`, `achievements.index`, teljes `words.*`/`custom-words.*`/`folders.*`,
teljes `flashcards.*`, teljes `text-analysis.*`.

**A gate-en KÍVÜL, szándékosan:**

| Route-kör | Értékelés |
|---|---|
| `onboarding` GET+POST | **Kötelező** — különben redirect-loop önmagára |
| `logout` (Fortify) | a user ki tud lépni → **nincs lock-out** |
| `email/verify*` | helyes sorrend: előbb verify, aztán onboarding |
| `pricing`, `checkout`, `portal` | **a user tud fizetni onboarding nélkül** — üzletileg kívánatos |
| teljes `settings/*` | fiókkezelés, lemondás, jelszóváltás elérhető → nincs lock-out |
| `report.*` | támogatási út nyitva |
| `downloads.*`, `player/connect` | enyhe inkonzisztencia, de kockázatmentes (semmilyen onboarding-függő állapotot nem olvasnak) |
| `admin/*` | `can:admin` mögött; adminnak nem kell onboarding |

**Nincs olyan érdemi (nem kivezetett) route, amely a fő flow része lenne és tévedésből maradt
volna ki a gate-ből.**

**Redirect-loop: nem lehetséges.** A gate egyetlen célpontja a `route('onboarding')`, ami maga
sosem viseli a gate-et. A `config/fortify.php` `'home' => '/words'` a regisztráció utáni célpont;
a `/words` a gate mögött van → friss user `/words` → gate → `/onboarding`. Ez a **kívánt**
viselkedés, egyszeri redirect.

---

## ONB-8 · `routes/extension.php`, `routes/api.php` · **INFO** · a JSON-kliensek megkerülik a gate-et — ártalmatlan

Sem az extension-, sem a player-route-ok **egyike sem** viseli az `EnsureOnboardingComplete`-et.
Egy user, aki regisztrál, verifikál, majd kizárólag a Chrome extensiont vagy a playert használja,
**soha nem megy át az onboardingon**.

**Kár: nincs.** Az `onboarding_completed_at`-ot semmilyen üzleti logika, entitlement, kvóta vagy
számítás nem olvassa — teljes grep: csak a middleware null-vizsgálata, a controller írása, a
`User` casts/fillable és a factory-state. Az extension-írások a saját, független napi keretüket
fogyasztják, ami nem függ az onboarding-állapottól.

**Szándékos és helyes:** a JSON-kliensek nem tudnának mit kezdeni egy HTML-redirecttel
(ugyanaz a megfontolás, amit a `routes/extension.php:20-23` komment a `verified` middleware
kapcsán explicit rögzít). **Ha a gate rájuk kerülne, az valódi funkcionális törés lenne.**

---

## ONB-9 · `OnboardingController.php:32-38` · **INFO** · `ORDER BY RAND()` throttle-mentes GET-en

A `show()` szintenként `inRandomOrder()->take(20)` + `count()` hívást futtat → 6 szint × 2 = **12
query, ebből 6 `ORDER BY RAND()`** egy 1000-2000 soros particíción (filesort).

A `GET /onboarding` **szintén throttle-mentes**. Relevanciája: ONB-1 mellett ez az **olcsóbb**
terhelési vektor ugyanazon a fiókon — a támadónak nulla payloadba kerül. A 10 000 soros tábla
kicsi, ezért INFO, nem LOW.

---

## ONB-10 · `tests/Feature/OnboardingTest.php` · **INFO** · tesztlefedettségi hézagok

A fájl **3 tesztet** tartalmaz, és ez az **egyetlen** onboardingot érintő teszt az egész `tests/`
fában.

**Lefedve:** `testEnabled` true/false renderelés; hogy a puszta GET nem állítja be az
`onboarding_completed_at`-ot; üres tömbökkel való befejezés + dashboard-redirect.

**NEM fedve:**
- **Az arány-alapú tömeges jelölés teljes üzleti logikája (`:64-101`)** — a controller
  legösszetettebb része **nulla lefedettséggel**. Egyetlen teszt sem küld nem-üres tömböt.
- A `EnsureOnboardingComplete` viselkedése (sem a redirect, sem az átengedés).
- Az `exists:words,id` elutasító ága.
- Újra-POST viselkedés (ONB-2) és `onboarding_enabled=false` melletti befejezhetőség (ONB-5).

**Miért INFO:** a tesztlefedettség hiánya nem támadási felület. Dokumentálva, mert ONB-1/ONB-2
javításakor ez lesz a legnagyobb regressziós kockázat.

---

## „PLAN-feltevés MEGDŐLT" tételek — Dimenzió B

1. **„Van-e védett route onboarding nélkül elérhető / fordítva lock-out"** → **MEGDŐLT, mindkét
   irányban.** Lock-out nincs (logout, verify, pricing/checkout, settings, report mind kívül,
   szándékosan); tévedésből kimaradt érdemi route sincs; redirect-loop nem lehetséges. *(ONB-7)*
2. **„A middleware `?->` operátora vendéget is redirectelne"** → **MEGDŐLT.** Mind a 4 helyen
   `auth` mögött fut. *(ONB-6)*
3. **„`onboarding_enabled=false` → lock-out"** → **MEGDŐLT.** A `features`→`theme` úton
   befejezhető. *(ONB-5)*
4. **„Újra-POST → achievement újra kiadódik"** → **MEGDŐLT.** `firstOrCreate` +
   `unique(user_id, achievement_key)` + `wasRecentlyCreated`. *(ONB-2)*
5. **„Újra-POST → `onboarding_completed_at` felülírás → streak/statisztika torzítás"** →
   **MEGDŐLT.** A streak kizárólag a `last_activity_date`-ből számol; az
   `onboarding_completed_at` semmilyen streak- vagy statisztika-számításban nem szerepel. *(ONB-2)*
6. **„A tömeges `known`-jelölés kvótát/Pro-t/pénzt ér"** → **MEGDŐLT.** A `user_word`-öt
   kizárólag statisztikai/megjelenítési kód olvassa; nulla entitlement-döntés függ tőle. *(ONB-3)*

**A PLAN-ból megerősítve maradt:** a `complete()` valóban teljesen kliens-vezérelt, és a
validációnak valóban nincs `max:` felső korlátja. De a valós gyenge pont nem a
szint-manipuláció (az tervezett önbevallás), hanem a **throttle-hiány + korlátlan tömbméret +
`exists` N+1** — amit a PLAN nem emelt ki, és ami a verifikáció után is csak LOW.
