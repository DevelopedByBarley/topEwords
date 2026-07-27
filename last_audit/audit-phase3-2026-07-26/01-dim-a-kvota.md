# Dim A — Rate-limit + kvóta egységessége minden AI-belépési ponton

> PLAN Fázis 3, 68. sor: „Rate-limit + kvóta minden AI-belépési ponton (web, extension, player)
> egységes-e (`AiUsageService`)."

## Dimenzió-verdikt

**A kvóta-lánc magja TISZTA és önállóan is megerősíthető.** Mind az 5 Gemini-hívó kód-út
(`geminiWordLookup`, `geminiFlashcard`, `wordInsight`, `sentenceCheck`, `practiceCheck` — `callGemini`
hívások az 1053/1210/1271/1340/1427 sorokon) EGYETLEN privát `callGemini()`-n megy át, mindegyik átadja
a `user: $request->user()`-t, a foglalás egyetlen atomikus feltételes UPDATE
(`where('ai_credits_used','<=',$limit-$estimate)->increment(...)`, `AiUsageService.php:50-52`) → TOCTOU-mentes,
és a lánc pontosan egy `settle()`-lel (2426, 2474) vagy `refund()`-dal (2485) zárul. A biztonsági blokk-ág
is `settle`-el, nem teljes refunddal — a korábbi AI-L1 kerülő tényleg le van zárva.

**Kvóta nélkül futó AI-hívás nincs**, egyetlen kivétellel: a `geminiListModels` (admin-only, token-költség
nélküli modell-lista, QUOTA-6) — és a cache-találat, ami definíció szerint nulla költség.

**Regresszió nincs.** A `dd3694f` / `3983752` / `fbf4405` / `b1afc47` commitok egyike sem nyúlt a
kvóta-lánchoz.

Nyitott: (a) a player AI-route-jai `verified` nélkül (QUOTA-1); (b) nincs globális költség-plafon és
összesített riasztás (QUOTA-2); (c) a `context`-es lookup szándékosan cache-mentes, tehát a leggyorsabb
pénz-égető út (QUOTA-3).

---

## QUOTA-1 · LOW · CONFIRMED

**A player AI-végpontjai az egyetlen `verified` nélküli AI-belépési pontok — e-mail-váltás után megerősítetlen fiók is hívhat AI-t**

- **Fájl · sor:** `routes/api.php:36-39`
- **Súlyosság:** LOW (finder: LOW → verifikátor: LOW → végső: LOW)
- **Verifikációs verdikt:** CONFIRMED

### Támadási forgatókönyv (bemenet/állapot → hatás)

1. A user (verified) párosítja a lejátszót → `player` ability-s Sanctum-tokent kap, érvényes 90 napig
   (`PlayerPairing.php:25` `TOKEN_LIFETIME_DAYS = 90`, felhasználva `PlayerPairingController.php:150-154`).
2. Beállítások → Profil → e-mail-cím módosítása. A `Settings/ProfileController.php:33-39` `email_verified_at`-ot
   `null`-ra állítja, majd `save()` — **`revokePlayerTokens()` hívás NINCS**.
3. Ettől a ponttól kezdve ugyanazzal a fiókkal:
   - `GET /text-analysis/gemini-lookup` (web/extension) → **403** (`EnsureEmailIsVerified`)
   - `POST /api/player/add-word` → **403** (`verified` csoport)
   - `GET /api/player/gemini-lookup` és `/api/player/gemini-flashcard` → **200**, a Gemini-hívás lefut,
     és a megerősítetlen fiók keretéből fogyaszt.

**Hatás:** az AI-gate paritása megbomlik a három felület között; egy megerősítetlen (potenciálisan idegen
e-mailre átírt) fiók pénzbe kerülő upstream-hívást indíthat. Blast radius: a **saját** havi keret
(Free 8000, Pro 500000 mikro-dollár).

### Bizonyíték

`routes/api.php:36-39` — a `throttle:30,1,player-ai` csoport a 23. sor
`['auth:sanctum','abilities:player']`-ján BELÜL, de a 45. sor `Route::middleware('verified')` csoportján
KÍVÜL van. A `verified` csoport csak a 49-59. sorokat fogja (`update-status`, `update-importance`,
`add-word`, `create-flashcard`).

`php artisan route:list -v` megerősítés:
- `api/player/gemini-lookup` → api → `Authenticate:sanctum` → `CheckAbilities:player` →
  `ThrottleRequests:30,1,player-ai` — **nincs `EnsureEmailIsVerified`**
- `text-analysis/gemini-lookup` → web → `Authenticate` → `EnsureEmailIsVerified` →
  `EnsureOnboardingComplete` → `ThrottleRequests:30,1,ta-ai`

A route-fájl kommentje (32-35. sor) elárulja a szándékot: „A hozzáférést és a havi AI-keretet a controller
kapuzza" — csak épp a controller nem ellenőriz `verified`-et:
- `TextAnalysisController.php:1376` / `:1010` — `abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403)`
- `app/Models/User.php:168-171` — `hasAiAccess()` **feltétel nélkül `return true;`** → ez a kapu semmit nem szűr
- `TextAnalysisController.php:56-69` `aiLimitGuard()` — kizárólag `aiUsage->allows($user)` havi keretet vizsgál,
  e-mail-státuszt nem

### Meglévő védelmek

- A per-user havi AI-keret (`AiUsageService::reserve`) ép marad → nem korlátlan költés, csak a saját keret.
- A `player` ability-szűkítés áll; az írás-végpontok (`add-word`, `create-flashcard`) továbbra is 403-at adnak.
- A párosítás JÓVÁHAGYÁSA `['auth','verified']` mögött van (`routes/web.php:60-63`), tehát megerősítetlen
  fiók KEZDETBEN nem tud tokent szerezni — a rés csak utólagos e-mail-váltással nyílik.
- `throttle:30,1,player-ai`.

### A szavazatok indoklása

**Verifikátor (nem cáfolt, LOW):** a lelet minden ténybeli állítása igaz. A LOW mellett szóló érvek:
- *Nem INFO*, mert van konkrét, végrehajtható bemenet→hatás út és valós biztonsági kontroll-megkerülés
  (a `verified` kapu megkerülése egy fizetős upstream erőforráson).
- *Nem MEDIUM*, mert (a) hitelesítést igényel, nincs cross-tenant/IDOR-hatás — a fogyasztás a SAJÁT
  keretből megy; (b) a jogosultság-eszkalációs mellékút zárva: `User::isAdmin()` (`User.php:179-186`)
  explicit `hasVerifiedEmail()`-t követel, tehát e-mail-átírással admin-keret (`null` = korlátlan)
  NEM szerezhető; (c) tartalom nem jön létre; (d) throttle van.

**Kontraszt-bizonyíték, hogy ez kilóg a sorból:** a `revokePlayerTokens()` MINDEN más érzékeny ponton meg
van hívva — `SecurityController.php:105` és `:137`, `Actions/Fortify/ResetUserPassword.php:31`, sőt
ugyanennek a fájlnak a `destroy()`-ában is (`ProfileController.php:73`). Csak az e-mail-váltás útjából
maradt ki.

---

## QUOTA-2 · LOW · CONFIRMED

**Nincs globális (nem per-user) AI-költség-plafon és nincs összesített költés-riasztás**

- **Fájl · sor:** `app/Services/AiUsageService.php:36` (a teljes szolgáltatás per-user)
- **Súlyosság:** LOW (finder: LOW → verifikátor: LOW → végső: LOW)
- **Verifikációs verdikt:** CONFIRMED

### Támadási forgatókönyv (bemenet/állapot → hatás)

A teljes költség-kényszerítés per-user: a `reserve()` kizárólag a hívó user `ai_credits_used` oszlopát
nézi a saját `aiMonthlyLimit()`-jéhez. Nincs sem összesített (`SUM(ai_credits_used)`) plafon, sem napi/havi
aggregált riasztás.

**Sybil-ág:** a `config/registration.php:8` kód-default `(bool) env('REGISTRATION_INVITE_ONLY', false)` —
tehát **megengedő**. Ha az `.env`-ből kimarad a beállítás, egy támadó N megerősített e-mail-címmel N Free
fiókot regisztrál, mindegyikkel elhasználja a 8000 mikro-dolláros kóstolót → a Google-számla lineárisan
nő, és a rendszerben SEMMI nem jelzi.

**Organikus ág (ez a tartósabb kockázat):** még legitim növekedésnél sem áll meg semmi egy előre beállított
összköltésnél. 10 000 Free fiók = 80 USD/hó, 10 000 Pro = 5000 USD/hó — plafon és riasztás nélkül,
észrevétlenül.

### Bizonyíték

- `app/Services/AiUsageService.php:50-52` —
  `User::whereKey($user->getKey())->where('ai_credits_used','<=',$user->aiMonthlyLimit()-$estimate)->increment('ai_credits_used',$estimate)`
  — a `whereKey()` egyetlen sorra szűkít. Ugyanez per-user az `allows()` (:16-23), `settle()` (:66-73),
  `refund()` (:78-85), `snapshot()` (:117-132). A teljes 164 soros fájlban **nincs egyetlen aggregált
  (SUM) lekérdezés sem**.
- A küszöb `User::aiMonthlyLimit()` (`app/Models/User.php:194-201`):
  `ai_credit_limit ?? planLimit('ai_budget_micros')` — mindkettő per-fiók.
- `config/plans.php:31` (Free `ai_budget_micros => 8000`) és `:42` (Pro `500000`) — csak per-csomag.
- `config/services.php:38-77` `gemini` blokk: csak `request_deadline_seconds` (:59) és
  `breaker.failure_threshold`/`cooldown_seconds` (:66-68) — **költség-plafon nincs**.
- `grep -rniE "global_|ceiling|total_budget|monthly_cap|sum\(.*ai_credits"` az `app/` + `config/` fölött:
  egyetlen releváns találat sem (csak `AlertAdminOfLoggedError.php:29-31` GLOBAL_BURST, ami az error-mail-fék).
- `grep -rn "ai_credits_used" app/ resources/js` az `AiUsageService`-en kívül: **0 találat** — sem
  admin-felület, sem notification, sem parancs nem olvassa aggregáltan.
- `app/Console/Commands/` tartalma: `ClearAiCache`, `EndTrialNow`, `FixWordLevels`, `ImportWords`,
  `MonitorFailedJobs`, `ReconcileStripeSubscriptions` — AI-költség-monitor nincs. A `routes/console.php`
  mind a 4 scheduled jobja irreleváns.

### Meglévő védelmek

- Jelenleg `.env`-ben `REGISTRATION_INVITE_ONLY=true` (a config default viszont `false`!).
- Regisztrációhoz e-mail-megerősítés kell (`Features::emailVerification()`, `config/fortify.php:151`),
  és az összes webes AI-route `verified` mögött van (`routes/text-analysis.php:7`).
- Regisztráció IP-fékezett: `FortifyServiceProvider.php:106` + `:119`
  (`Limit::perMinute(10)->by($request->ip())`).
- Az `AiWordCache` a determinisztikus szó-feladatokat userek közt megosztva szolgálja ki → az N. fiók
  ugyanarra a szóra 0 upstream-költséget okoz (`AiCacheService.php:29-34`). Ez a Sybil-amplifikációt
  jelentősen csökkenti.
- `throttle:30,1` per-user vödrök; a Gemini oldalán a Google saját projekt-kvótája végső plafonként áll.

### A szavazatok indoklása

**Verifikátor (nem cáfolt, LOW):**
- *Nem MEDIUM*, mert a Sybil-ág mérsékelt: N fiókhoz N megerősített postafiók kell, a támadó
  egységköltsége elhanyagolható (0,008 USD/fiók → 1000 fiók = 8 USD), és a globális cache elnyeli a
  „sok fiók ugyanazokat a gyakori szavakat kéri" mintát.
- *Nem INFO*, mert az organikus növekedési ág valós: a `reserve()` architektúrájából következően nincs
  vészfék és nincs riasztás, ami időben szólna. Ez bemenet→hatás úttal leírható üzemeltetési/költségvédelmi
  hézag.

**Pontosítás a finder forgatókönyvéhez:** a „élesítés után `false`-ra állítják" fordulat pontatlan —
a kód-default MÁR megengedő, nem kell semmit átállítani. Ez a forgatókönyvet **erősíti**, nem gyengíti.

---

## QUOTA-3 · INFO

**A `context` paraméterrel érkező lookup szándékosan cache-mentes — a legdrágább, felhasználó által vezérelhető AI-út**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:1433-1437`
- **Súlyosság:** INFO (finder: INFO → végső: INFO)
- **Verifikációs verdikt:** n/a (INFO, nem került adverzariális körbe)

### Forgatókönyv

`GET /text-analysis/gemini-lookup?word=X&context=Y` — a `$context !== ''` ág miatt MINDIG friss
Gemini-hívást indít (a `context_explanation` mondat-egyedi, ezért nem cache-elhető). Egy kliens tehát
bármely szóra kikerülheti az `AiWordCache` védőhálót azzal, hogy tetszőleges (akár egyetlen karakteres)
contextet küld: `?word=dog&context=a` → cache-miss garantált.

**Hatás:** a felhasználó a teljes havi keretét (Pro: 500 000 mikro ≈ 1250 hívás) csupa upstream
Gemini-hívássá tudja konvertálni, cache-találat nélkül; a lejátszóból és a bővítményből is. Ez METERED
(a `reserve/settle` mindegyikre lefut), tehát a költség-plafon ép — de az upstream RPM-et csak a 30/perc
throttle fékezi, és a globális plafon hiánya (QUOTA-2) mellett ez a leggyorsabb pénz-égető út.

**Miért INFO:** nem lelet, hanem tudatos funkcionális kompromisszum dokumentálása; a kódban levő
indoklás korrekt.

### Bizonyíték

`TextAnalysisController.php:1433-1437`:
```
// A context-tal érkező kérés mondat-egyedi (context_explanation mező),
// ezért nem cache-elhető; csak a context nélküli szótári lekérdezést tároljuk.
$result = $context === '' ? $this->aiCache->remember('lookup', $word, ...) : $generator();
```
A `context` validáció csak normalizál és 300 karakterre vág (1387-1391), tartalmi minimumot nem ír elő.

### Meglévő védelmek

`reserve()/settle()` minden ilyen hívásra lefut → havi keret felső korlátként ép. `throttle:30,1,ta-ai` /
`player-ai`. A context 300 karakterre vágva → input-token-oldali költség korlátos. A circuit breaker
upstream-kiesésnél levág.

---

## QUOTA-4 · INFO

**A bővítmény AI-hívásai a webes `ta-ai` vödörből fogyasztanak — nincs saját `ext-ai` prefix (aszimmetria a playerrel)**

- **Fájl · sor:** `chrome-extension/background.js:445-459`
- **Súlyosság:** INFO
- **Verifikációs verdikt:** n/a (INFO)

### Forgatókönyv

A bővítmény nem saját `extension/gemini-*` végpontot hív, hanem session-cookie-val a webes
`text-analysis/gemini-flashcard` és `gemini-lookup` route-okat. Mivel a Laravel throttle bejelentkezett
usernél a user-ID-vel kulcsol (`ThrottleRequests::resolveRequestSignature`), a bővítmény és a nyitott
webes fül UGYANEGY `ta-ai:{userId}` vödörből eszik (30/perc együtt). A lejátszó ezzel szemben tudatosan
külön `player-ai` prefixet kapott (`routes/api.php:32-36` kommentje: „hogy a két kliens ne merítse egymás
keretét").

**Hatás:** ha a felhasználó a bővítménnyel intenzíven kattint szavakra, a webes szövegelemzőben ugyanabban
a percben 429-et kaphat — és fordítva. UX-degradáció, **nem** biztonsági rés (a szűkebb, tehát biztonságosabb
irányba téved), és a per-user keret miatt költség-oldalon semmi következménye. Az architekturális szándék
(a player külön vödre) itt következetlenül van végigvive.

### Bizonyíték

`chrome-extension/background.js:445-459` — `GEMINI_FLASHCARD` / `GEMINI_LOOKUP` üzenetek
`fetchJson(`${APP_URL}/text-analysis/gemini-*`)`; a `fetchJson` (background.js:9-18) `credentials: 'include'`-dal
küld. `routes/text-analysis.php:18-19` — mindkettő `throttle:30,1,ta-ai`. A `routes/extension.php`-ban
NINCS gemini-route és nincs `ext-ai` prefix.

### Meglévő védelmek

Az `AiUsageService` kvóta-kapu felületfüggetlen (mindkettő ugyanazon a `callGemini`-n és `reserve()`-n
megy át) → a költség-kényszerítés paritása ÉP; csak a rate-limit vödör-felosztás aszimmetrikus. A megosztott
vödör a szigorúbb irány.

---

## QUOTA-5 · INFO

**A `reserve()` becslés-alapú feltétele drága modell-konfig mellett tartósan kizárhatja a Free-t (fail-closed elakadás)**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:2295-2300` + `AiUsageService.php:50-52`
- **Súlyosság:** INFO
- **Verifikációs verdikt:** n/a (INFO)

### Forgatókönyv

A foglalás feltétele `ai_credits_used <= aiMonthlyLimit() - $estimate`. Ha az `$estimate` maga nagyobb a
teljes havi keretnél, a feltétel egy UNSIGNED oszlopon SOHA nem teljesül → az adott feladat a felhasználó
számára tartósan, teljesen elérhetetlen (nem „keret betelt", hanem „soha nem is indulhat").

Konkrét, kód által támogatott konfiguráció: `GEMINI_MODEL_FLASHCARD=gemini-3.5-flash` (a `GEMINI_PRICING`-ben
expliciten szerepel: in 1.50 / out 9.00 mikro/token). Flashcard `maxTokens=1000`, prompt ~4000 karakter
≈ 1000 input token → estimate = 1000×1.5 + 1000×9.0 = **10 500 mikro > Free `ai_budget_micros` = 8000**
→ `where('ai_credits_used','<=',-2500)` soha nem talál sort → MINDEN Free user MINDEN flashcard-kérése
429-cel hasal el („Elérted a havi AI-felhasználási kereted"), **nulla felhasznált kerettel is**.

**Miért INFO:** a jelenlegi alapkonfig (flashcard primary = `gemini-2.5-flash`, estimate ≈ 2800 mikro)
mellett ez NEM áll fenn — nincs mai bemenet→hatás út, csak egy `.env`-váltásra váró csapda félrevezető
hibaüzenettel.

### Bizonyíték

`TextAnalysisController.php:2295-2300`:
```
$primaryRate = self::GEMINI_PRICING[$model] ?? ...;
$estimatedMicros = (int) round(((int) ceil(mb_strlen($prompt)/4)) * $primaryRate['in'] + $maxTokens * $primaryRate['out']);
if ($user !== null && ! $this->aiUsage->reserve($user, $estimatedMicros)) { return [... 'error_code' => 'ai_limit' ...]; }
```
`GEMINI_PRICING` (2180-2187) tartalmazza a `'gemini-3.5-flash' => ['in'=>1.50,'out'=>9.00]` sort.
`config/plans.php` free `ai_budget_micros = 8000`. `config/services.php:71` — flashcard primary jelenleg
`gemini-2.5-flash` (in 0.30 / out 2.50).

### Meglévő védelmek

A viselkedés **fail-CLOSED** (elutasít, nem költ) — biztonsági szempontból a helyes irány. A jelenlegi
default modell-konfiggal minden feladat estimate-je a Free keret alatt van (lookup ≈ 340, insight ≈ 300,
sentence ≈ 175, flashcard ≈ 2800 mikro). Cache-találatnál a `reserve()` meg sem hívódik, tehát a Free user
ilyen konfig mellett is kiszolgálódna a cache-elt szavakra.

---

## QUOTA-6 · INFO

**`geminiListModels` az egyetlen kvóta-kapun kívüli upstream Gemini-hívás (admin-only, token-költség nélküli)**

- **Fájl · sor:** `app/Http/Controllers/TextAnalysisController.php:1361-1372`
- **Súlyosság:** INFO
- **Verifikációs verdikt:** n/a (INFO)

### Forgatókönyv

A `GET /text-analysis/gemini-models` közvetlen
`Http::get('https://generativelanguage.googleapis.com/v1beta/models')` hívást tesz, nem a `callGemini()`-n
keresztül → nincs sem `reserve()`, sem `settle()`, sem `aiLimitGuard()`. Ez a kvóta-lánc egyetlen
kimaradása.

**Kihasználhatóság: nulla.** `abort_unless(Gate::check('admin'), 403)` az első sor; a route emellett
`auth`+`verified`+`throttle:30,1,ta-ai` mögött van, és a `models.list` NEM `generateContent`, tehát
token-költséget nem generál (csak a projekt API-kvótájának RPM-jét fogyasztja).

Teljesség kedvéért dokumentálva: a „minden AI-belépési pont a kvóta-kapun megy át" állítás pontosan itt,
és csak itt nem igaz.

### Bizonyíték

`TextAnalysisController.php:1361-1372` — nincs `$this->aiUsage->` hívás és nincs `$this->aiLimitGuard($request)`;
a hívás timeout-olt (1366-1367).

### Meglévő védelmek

admin-only Gate, `auth`+`verified`, `throttle:30,1,ta-ai`, és a `models.list` nem token-alapú árazású
végpont.
