# Dim B — Circuit breaker + 429-mapping + cache-viselkedés kimaradás alatt

> PLAN Fázis 3, 69. sor: „Circuit breaker + 429-mapping + cache viselkedés kimaradás alatt (`AiCacheService`)."

## Dimenzió-verdikt

A lánc érdemi része TISZTA, és a legfontosabb kérdésekre negatív a válasz.

1. **Kvóta-elszámolás:** a `callGemini` pontosan EGY `reserve()`-t tesz (2298) és MINDEN kilépési ága
   pontosan egy `settle()`-lel vagy `refund()`-dal zárul — mind a hat ág végigkövetve (siker 2474,
   safety-blokk 2426 + return, végleges 4xx `break 2` → 2485, deadline `break 2` → 2485, próbák
   kifutása → 2485, nyitott breaker / reserve-bukás → return a foglalás ELŐTT). **Nincs elszivárgó keret
   és nincs dupla refund.**
2. **Támadó-triggerelhetőség:** a breaker CSAK a `$sawTransientFailure` (hálózati hiba / 429 / 5xx /
   deadline) hibájú teljes lánc-kudarcot számolja; a végleges 4xx a 2385-ös ágon `break 2`-vel kilép a
   flag beállítása NÉLKÜL, és a `sanitizeWordForPrompt` (811) betű-regexe eleve kizárja az unicode-szemetet
   és a prompt-injectiont. **Rossz bemenettel NEM lehet más userek AI-ját levágni** — a CB-1 „nem
   támadó-triggerelhető" verdikt a friss kódon MEGERŐSÍTVE.
3. **Cache kimaradás alatt:** a `remember()` a DB-cache-t olvassa ELŐBB (`AiCacheService:32`), így teljes
   Gemini-kiesésben a már cache-elt szavak zavartalanul kiszolgálódnak; **negatív cache NINCS** (minőség-kapu
   44-46 csak `ok:true` + tömb választ tárol; teszt rögzíti).
4. **Timeout:** explicit és teljes — connect 10s, próba 20s, teljes lánc-deadline 30s, a próba-timeout a
   hátralévő keretre vágva (2345) → **worker-lefogás kockázata zárt**.

A három 2026-07-20-i LOW közül **CB-1** és **CB-3** változatlanul fennáll; **CB-2** kettéválasztva és
részben lefelé súlyozva (a hiányzó `Retry-After` INFO, viszont ugyanaz az ág **CB-4** és **CB-5** néven
két új leletet adott). Az **AI-M1** MEDIUM flapping-minősítés **INFO-ra lefokozva**.

---

## CB-3 · LOW · CONFIRMED

**Nincs single-flight a cache-miss-nél: egy trending szóra N párhuzamos kérés = N Gemini-hívás (stampede)**

- **Fájl · sor:** `app/Services/AiCacheService.php:30-36` (a beírás: `:47`)
- **Súlyosság:** LOW (finder: LOW → verifikátor: LOW → végső: LOW)
- **Verifikációs verdikt:** CONFIRMED

### Támadási forgatókönyv (bemenet/állapot → hatás)

Egy felfutó angol szót (pl. „delulu") 100 user néz ki egyszerre, mielőtt bármelyik kérés befejeződött volna.
A `remember()` mindegyik kérésben lefut: a `firstWhere('cache_key','lookup:delulu:en:v4')` MINDEGYIKNÉL
üresen tér vissza (32), mert még senki nem írta be a sort → MINDEGYIK meghívja a `$generator()`-t (36)
→ **100 párhuzamos Gemini-hívás ugyanarra a promptra.**

Hatás háromszoros:
- **(a) Költség:** 100× 1 helyett; mindegyik user a saját havi keretéből fizet (~300-350 mikro a lookup-ágon
  — a finder 130-as száma alábecsül, tehát a hatás inkább nagyobb). A Free keret 4%-a egyetlen elszalasztott
  cache-találatért.
- **(b) Worker:** 100 egyidejűleg lefogott PHP-FPM worker akár 30 másodpercig (a deadline-ig), ami a NEM-AI
  oldalakat is megfojtja.
- **(c) Breaker:** a 100 egyidejű hívás a projekt-szintű Gemini 429-be futhat, ami MÁR beleszámít a breakerbe
  (`$sawTransientFailure`, 2391) → a stampede önmagában kinyithatja a breakert.

Az `updateOrCreate` (47) csak a unique-kulcs ütközést kezeli, a redundáns hívásokat nem előzi meg.
Mindhárom cache-elt feladat érintett: `flashcard` (1048), `insight` (1335), `lookup` (1436, csak
`$context === ''` esetén).

### Bizonyíték

`AiCacheService.php:30-36`:
```
$key = $this->key($task, $word, $promptVersion);
if ($cached = AiWordCache::firstWhere('cache_key', $key)) { return [...]; }
$result = $generator();
```
A miss (32) és a beírás (`47` `updateOrCreate`) között NINCS `Cache::lock`, DB-tranzakció vagy „in-flight"
jelölő. `grep -rn "stampede\|single-flight" app/` → **0 találat** (nincs elrejtett védelem máshol sem).

Kulcs determinisztikus és user-független: `AiCacheService.php:70`
`return $task.':'.Str::lower($word).':en:v'.$promptVersion;` → 100 user ugyanarra a szóra tényleg egyetlen
kulcson versenyez.

**Lock-precedens kontraszt:** a projekt máshol használ locket ugyanerre a mintára —
`TextAnalysisController.php:1597` `Cache::lock("plan-limit:youtube:{$user->id}", 15)->block(10, ...)`,
`:1714` a books-ágon, `User.php:321` / `:358` a flashcard/deck limitnél. (Megjegyzés: ezek mind **per-user**
zárak; egy cache-stampede zár **globális/per-cache-key** lenne, tehát analógia, nem szó szerinti átvétel.)

### Meglévő védelmek

- Végpont-throttle (`throttle:30,1,ta-ai`, `player-ai`, `ext-read` 120/min) korlátozza az EGY user kéréseit,
  de nem a userek közti egyidejűséget.
- Per-kérés deadline (`config/services.php:59` `request_deadline_seconds` = 30.0, betartatva 2319 + 2328-2341)
  plafonozza a worker-lefogás hosszát.
- Per-user havi keret (`AiUsageService::reserve`, atomi feltételes UPDATE 50-52) plafonozza az egy userre
  eső kárt; a többletköltség az okozójára terhelődik, nem közös forrásból megy.
- A `(c)` breaker-ág gyakorlatilag valószínűtlen: a `2477` `Cache::forget(GEMINI_BREAKER_FAILURES_CACHE_KEY)`
  bármely sikeres válaszra nullázza a számlálót, a küszöb pedig 5 EGYMÁST KÖVETŐ teljes lánc-kudarc.
- A stampede ablaka rövid (egy Gemini-hívás ~1-3s), így a mai user-számmal ritkán áll fenn.

### A szavazatok indoklása

**Verifikátor (nem cáfolt, LOW):** minden elem igazolva a kódban.
- *Nem MEDIUM*: nincs biztonsági határátlépés — nincs adatszivárgás, nincs jogosultság-emelés, nincs mások
  keretének terhelése; mindhárom hatás-ág korlátos (30s deadline, per-user keret, throttle). Ez
  rendelkezésre-állási/hatékonysági degradáció, nem kiesés — pontosan az a jelleg, amit a kód `2231-2233`
  sora a breakernél „lassulás, nem kiesés"-ként minősít.
- *Nem INFO*: van konkrét, végigvezethető bemenet→hatás út és mérhető káros hatás a userek keretére.

**Kontextuális megjegyzés (nem befolyásolja a súlyt, de rögzítendő):** a lelet nem új — a
`last_audit/PLAN.md:153` már nevesíti: „Szándékos »nincs értelmes fix« maradékok: … **AI-L2 cache-stampede**".
Ellentétben az `AiWordCache.php:11-22` (AI-L3 TTL) és `TextAnalysisController.php:2211-2235` (AI-M1 breaker)
tudatos vállalásaival, **ehhez a döntéshez az `AiCacheService.php`-ban NINCS kód-szintű indoklás** — a
`42-43` komment csak a unique-ütközésről beszél. Ez a dokumentációs hézag az egyetlen tényleges hiányosság:
a következő auditkör ezért fogja megint „új leletként" megtalálni.

---

## CB-4 · LOW · CONFIRMED

**A Gemini safety-blokk 502-t (upstream-hiba) ad 422 helyett, mert nem állít `error_code`-ot**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:2433` (mapping: `:81-89`)
- **Súlyosság:** LOW (finder: LOW → verifikátor: LOW → végső: LOW)
- **Verifikációs verdikt:** CONFIRMED

### Támadási forgatókönyv (bemenet/állapot → hatás)

Egy user olyan szót/mondatot küld a `sentence-check` vagy `lookup` végpontra, amit a Gemini safety-filtere
blokkol. Ez normál felhasználói bemenetből elérhető: a `sentenceCheck` `sentence` mezője
(`TextAnalysisController.php:1240-1243`) `'required','string','min:3','max:500'` — teljesen szabad szöveg,
tartalom-szűrés nélkül, és a `1252-1266`-os prompt szó szerint beinterpolálja
(`Learner's sentence: "{$sentence}"`). A `word` mező regexe `/^[\pL][\pL'\- ]*$/u` — bármilyen csak-betűs,
akár szexuális/erőszakos jelentésű valódi angol szót átenged.

A `2403-2406`-os ág elkapja (`blockReason` vagy `finishReason` ∈ {SAFETY, RECITATION, PROHIBITED_CONTENT})
és `ok:false`-t ad vissza **`error_code` KULCS NÉLKÜL** (2433). Az `aiFailureResponse` match-e (81) ezért
a `default` ágra esik → **HTTP 502 Bad Gateway**.

Következmény:
- **(a) Observability:** a monitorozás/uptime-figyelő 5xx-ként számolja a normális user-hibát → hamis
  kiesés-jelzés és zaj a hibaarány-metrikában. A helyes kód **422 Unprocessable Content** lenne, hiszen a
  szolgáltatás egészséges, csak a kérés nem feldolgozható.
- **(b)** Egy jövőbeli kliens-retry 5xx-re újrapróbálna, holott az ismétlés garantáltan ugyanígy blokkolódik
  — amit a `2400-2402`-es komment maga is kimond. *(A verifikátor ezt spekulatívnak minősítette és nem
  számította a súlyba.)*

**Blast radius nagyobb, mint a finder írja:** az `aiFailureResponse` 5 hívási helyen fut (1058, 1213, 1274,
1345, 1440), és a `routes/api.php:37-38` szerint a **Sanctum-os player-végpontok is ugyanezt a controllert
használják** → a téves 502 a web és a player felületen egyaránt jelentkezik.

### Bizonyíték

`TextAnalysisController.php:2433`:
```
return ['ok' => false, 'data' => null, 'error' => 'Az AI biztonsági okból nem tudott választ adni erre a kérésre.', 'cost_micros' => 0];
```
Nincs `error_code`. Párja `:81-89`:
```
match ($result['error_code'] ?? null) {
    'ai_limit' => …429, 'ai_unavailable' => …503,
    default => response()->json(['error' => $result['error']], 502)
}
```
`grep -rn "error_code" app/` az EGÉSZ `app/`-ban 5 találat: a 77-es és 2247-es PHPDoc, a 81-es match, és
csak KETTŐ tényleges beállítás (`2255` `'ai_unavailable'`, `2299` `'ai_limit'`) — a blokk-ág az EGYETLEN
nem-upstream kudarc, ami kimarad a leképezésből.

A cache-wrapper nem javítja meg: `AiCacheService.php:61` változtatás nélkül adja vissza a `$result`-ot;
a 44-es minőség-kapu miatt a blokkolt válasz NEM kerül cache-be (`GeminiResponseTest.php:245`
`expect(AiWordCache::count())->toBe(0)`) → az ismételt kérés mindig újra kimegy és mindig ugyanígy blokkolódik.

### Meglévő védelmek

- A hibaszöveg magyar, user-barát és nem szivárogtat semmit (se API-kulcsot, se promptot, se Gemini raw
  errort, se stack trace-t).
- A blokk NEM számít bele a breakerbe (nincs `$sawTransientFailure`).
- A kvóta HELYESEN rendeződik: `2421-2431` `settle()`-lel a tényleges input-tokent felszámolja (ez az
  AI-L1 fix), és ezt a `tests/Feature/AiUsageTest.php:212-246` teszt-hármas rögzíti → **a blokkolt kérések
  ismételgetésével a havi keret NEM kerülhető meg.**

### A szavazatok indoklása

**Verifikátor (nem cáfolt, LOW):**
- *Nem MEDIUM*: nincs átlépett biztonsági határ — se authz-kerülés, se adat-szivárgás, se kvóta-kerülés.
  A hatás tisztán observability/szemantika.
- *Nem INFO*: a bemenet→hatás út konkrét és végig kimutatható (szabad `sentence` mező → 2403 blokk-ág →
  2433 hiányzó kulcs → 88-as `default` → 502), és a hatás valós üzemeltetési zaj: hamis 5xx-kiesés-jelzés
  egy olyan kérésre, ami garantáltan sosem fog sikerülni.

**Fontos kiegészítés a javításhoz:** a jelenlegi 502-t **NÉGY meglévő teszt szögezi le** —
`GeminiResponseTest.php:241` és `:257`, `AiUsageTest.php:225` és `:243` mind `->assertStatus(502)`-t állít
a `blockReason`/SAFETY forgatókönyvre. Ez a LOW-t támasztja alá a MEDIUM helyett (nem véletlen elcsúszás,
hanem letesztelt, bejáratott viselkedés), ugyanakkor a javítás **nem egysoros**.

---

## CB-5 · INFO

**A safety-blokk ága `cost_micros => 0`-t jelent, miközben a `settle()` a valós költséget felterhelte**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:2421-2433`
- **Súlyosság:** INFO
- **Verifikációs verdikt:** n/a (INFO)

### Forgatókönyv

Blokkolt kérésnél a `2421-2431`-es blokk kiszámolja a valós költséget
(`blockedInputTokens × rate['in'] + blockedOutputTokens × rate['out']`) és `settle()`-lel rá is terheli a
user keretére — **ez helyes** (ez az AI-L1 fix). Ugyanaz a return azonban `cost_micros => 0`-t ad vissza
(2433) → a visszaadott tömb `cost_micros` mezője ellentmond a DB-be írt tényleges terhelésnek.

Ma ártalmatlan: egyetlen hívó sem olvassa a `cost_micros`-t hibaágon (mind az öt hívó — 1058, 1213, 1274,
1345, 1440 — közvetlenül `aiFailureResponse()`-ra ugrik, ami csak `error_code`-ot és `error`-t használ, a
keret-számokat pedig a friss `snapshot()`-ból veszi).

**Jövőbeli kockázat:** ha valaki költség-telemetriát vagy per-kérés naplózást épít a visszaadott
`cost_micros`-ra, a blokkolt kérések 0-val jelennének meg, és a Gemini-számla nem stimmelne a belső
könyveléssel — épp az a néma alul-könyvelés, amit az AI-L1 fix megszüntetni akart. Forgatókönyv nélküli
valós hatás nincs, ezért INFO.

### Bizonyíték

`TextAnalysisController.php:2421-2433` — `settle(...)` a valós költséggel, majd közvetlenül
`return [… 'cost_micros' => 0];`. Kontraszt a konzisztens sikeres ággal: `2471-2480`
`$costMicros = …; settle($user, $estimatedMicros, $costMicros); … return ['ok' => true, …, 'cost_micros' => $costMicros, …]`.

### Meglévő védelmek

A keret-számláló (`ai_credits_used`) MAGA helyes — a `settle()` a valós költséggel fut. Egyetlen hívó sem
olvassa a `cost_micros`-t hibaágon, ezért ma nincs megfigyelhető hatás.

---

## CB-2 · INFO *(korábban LOW — LEFOKOZVA)*

**A breaker 503-as válasza nem küld `Retry-After` fejlécet, holott a cooldown pontosan ismert**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:87`
- **Súlyosság:** INFO (2026-07-20: LOW → finder mai javaslata: INFO → végső: INFO)
- **Verifikációs verdikt:** PLAUSIBLE (a tény igaz, a hatás nem éri el a LOW-t)

### Forgatókönyv

Nyitott breaker alatt a kliens 503-at kap `Retry-After` nélkül, pedig a szerver pontosan tudja mennyit kell
várni (`breaker.cooldown_seconds`, alap 120). Egy jólnevelt kliens vagy egy jövőbeli auto-retry így nem
tudja mikor próbálkozzon újra, és vagy vakon poll-oz (a `throttle:30,1,ta-ai` keretét fogyasztva), vagy
feleslegesen sokat vár.

**Miért INFO és nem LOW (a 2026-07-20-i súly lefokozása):**
1. A frontendben **egyetlen olyan kód sincs**, ami `Retry-After`-t olvasna vagy 503-ra automatikusan
   újrapróbálna — a felhasználó a magyar hibaszöveget látja („Próbáld újra pár perc múlva."), ami a
   szükséges információt EMBERI olvasónak megadja.
2. A breaker célja a worker-védelem, és a 503 önmagában (HTTP-hívás és keret-terhelés nélkül,
   `GeminiOutageTest.php:56-64`) ezt teljes egészében ellátja.
3. Forgatókönyv nélküli, tisztán protokoll-higiéniai hiányosság.

Ugyanakkor a régi CB-2 **azonos ága** a CB-4-ben ÚJ, valós leletet ad (safety-blokk 502 vs 422) — a LOW
súly ott van a helyén.

### Bizonyíték

`TextAnalysisController.php:87` — `'ai_unavailable' => response()->json(['error' => $result['error']], 503),`
— nincs `->header('Retry-After', …)`. A cooldown elérhető lenne: `config/services.php:66`
`'cooldown_seconds' => (int) env('GEMINI_BREAKER_COOLDOWN', 120)`, és a `2522-2524`-es put pontosan ezzel a
TTL-lel írja a kulcsot.

### Meglévő védelmek

Magyar hibaszöveg emberi olvasónak; végpont-throttle (30/perc) plafonozza a vak poll-ozás kárát; nincs
olyan kliens-kód ami a fejlécet olvasná.

---

## CB-6 · INFO

**A breaker-számláló elveszíthet egy kudarcot, ha a 600s-os ablak épp az `add()` és az `increment()` közé jár le**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:2515-2518`
- **Súlyosság:** INFO
- **Verifikációs verdikt:** n/a (INFO)

### Forgatókönyv

A `recordGeminiChainFailure()` két lépésben dolgozik:
`Cache::add(KEY, 0, 600)` majd `(int) Cache::increment(KEY)`. A `DatabaseStore::incrementOrDecrement`
(`vendor/…/Cache/DatabaseStore.php:273-310`) `false`-t ad vissza, ha a kulcs nem létezik — és a `(int)`
cast ezt **0-ra** fordítja, amit a küszöb-összehasonlítás (2518) elnyel. Ez akkor fordulhat elő, ha az
`add()` nem szúrt be (mert a kulcs még létezett), de a sor lejárati ideje épp a két utasítás közti
mikroszekundumokban telt le → az `increment` a lejárt sort már nem találja.

**Következmény:** a breaker egy kudarccal később nyílik ki.

**Miért INFO:** az ablak 600 másodperc, a rés mikroszekundumos; tartós kiesésben (ahol a breakerre szükség
van) másodpercenként érkeznek új kudarcok, így a küszöb (5) elérése legfeljebb egy kérés-ciklussal késik —
a védelem nem sérül.

**Külön ellenőrizve:** a számláló MAGA atomikus — a `DatabaseStore` transaction + `lockForUpdate` mellett
növel (`DatabaseStore.php:275-279`), tehát párhuzamos kudarcok NEM veszítenek el számot. (Ez azért volt
fontos, mert `CACHE_STORE=database`.)

### Bizonyíték

`TextAnalysisController.php:2515-2518`:
```
Cache::add(self::GEMINI_BREAKER_FAILURES_CACHE_KEY, 0, self::GEMINI_BREAKER_WINDOW_SECONDS);
$failures = (int) Cache::increment(self::GEMINI_BREAKER_FAILURES_CACHE_KEY);
if ($failures < (int) config('services.gemini.breaker.failure_threshold', 5)) { return; }
```
Vendor-oldali `return false` a nem-létező kulcsra: `DatabaseStore.php:285-287`. Store: `.env:40`
`CACHE_STORE=database`.

### Meglévő védelmek

A 600s ablak háromszorosa a 120s cooldownnak, a rés mikroszekundumos. Tartós kiesésben a kudarcok sűrűn
érkeznek → egy elvesztett számot a következő kérés pótol. A számláló egyébként atomikus.

---

## CB-7 · INFO *(POZITÍV megállapítás)*

**Kimaradás alatt a cache-elt válaszok kiszolgálódnak, a breaker a cache-találatot nem blokkolja**

- **Fájl · sor:** `app/Services/AiCacheService.php:32-36`
- **Súlyosság:** INFO (nem lelet, hanem a dimenzió tisztaságát igazoló megállapítás)
- **Verifikációs verdikt:** n/a

### Megállapítás

A PLAN kifejezetten kérdezte: „szolgál-e ki a cache stale választ, ha a Gemini nem elérhető?" — a válasz
**IGEN, és ez a helyes viselkedés.** A `remember()` a DB-cache-t olvassa ELŐSZÖR (32), és cache-találatnál
a `$generator()` le sem fut, tehát a `callGemini` `2254`-es breaker-checkje sem.

**Következmény:** teljes Gemini-kiesésben (nyitott breaker) a már egyszer kikeresett szavak
lookup/flashcard/insight válasza változatlanul kiszolgálódik 200-nal, keret-terhelés nélkül, és csak az
ÚJ szavak kapnak 503-at. Éles kiesés alatt ez a funkcionalitás nagy részét életben tartja.

Ez **nem fordul negatív cache-be**: a minőség-kapu (44-46) csak `ok:true` + `is_array` választ tárol, így
se a tranziens hiba, se a nyitott breaker `ai_unavailable` válasza nem éghet be.

### Bizonyíték

`AiCacheService.php:32-36` — a breaker-check (`TextAnalysisController.php:2254`
`if (Cache::has(self::GEMINI_BREAKER_OPEN_CACHE_KEY))`) a generátoron BELÜL van → találatnál elérhetetlen.
Minőség-kapu: `AiCacheService.php:44`
`$wellFormed = ($result['ok'] ?? false) === true && is_array($result['data'] ?? null);`

Teszt-lefedettség: `tests/Feature/AiCacheTest.php` — „hibás Gemini-választ nem tárol a cache" (500 → 502,
`AiWordCache::count() === 0`) és „a fix előtt cache-elt insight-sor … továbbra is kiszolgálódik"
(`Http::assertNothingSent()` 500-as fake mellett).

---

## Melléklet — AI-M1 (breaker flapping) INFO-ra fokozva

A `2478`-as `Cache::forget(GEMINI_BREAKER_FAILURES_CACHE_KEY)` egyetlen sikerre nullázza a számlálót,
tehát 4-siker/4-kudarc arányú flappingnél a breaker (küszöb 5 egymást követő) nem nyílik ki. A viselkedés
valós, és a `GeminiOutageTest.php:67` („sikeres válasz nullázza a breaker kudarc-számlálóját", 4 kérés /
10 hívás) **SZÁNDÉKOSKÉNT rögzíti**.

Miért nem MEDIUM (a 2026-07-18/19-i súly lefokozása):
- **(a)** A kód `2211-2235`-ben dokumentáltan vállalt LOW-ként kezeli, indoklással és az elvetett
  alternatíva (csúszóablakos hibaarány-breaker) kockázat-elemzésével.
- **(b)** A maradvány-kockázat **lassulás, nem kiesés**, mert a per-kérés deadline garantálja, hogy worker
  SOSEM lóg 30s-nél tovább — vagyis épp a védett kockázat (worker-kimerülés) marad zárva.
- **(c)** A `Gemini full chain failure` error-log (2492) az `AlertAdminOfLoggedError`-on keresztül riasztja
  az admint.

Forgatókönyv nélküli súlyosbítás nincs → **INFO**.
