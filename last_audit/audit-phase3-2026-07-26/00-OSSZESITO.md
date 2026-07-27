# Fázis 3 audit — AI-terhelés, cache-izoláció & költség

> **Dátum:** 2026-07-26
> **Terv:** `last_audit/PLAN.md` → „Fázis 3 — AI-terhelés, cache-izoláció & költség" (67-71. sor)
> **Módszer:** 3 párhuzamos, egymástól független finder-ügynök (dimenziónként 1) + adverzariális
> verifikátor-kör minden LOW/MEDIUM/HIGH leletre, majd szerkesztői szintézis.
> **Mód:** CSAK OLVASÁS / DOKUMENTÁLÁS — egyetlen alkalmazás-fájl sem módosult.

## Mit auditáltunk

A PLAN Fázis 3 három pontja, dimenziókra osztva:

| Dim | Terület | Kulcs-felület |
|-----|---------|---------------|
| **A** | Rate-limit + kvóta egységessége minden AI-belépési ponton (web, extension, player) | `AiUsageService`, `routes/{text-analysis,api,extension}.php`, `TextAnalysisController::callGemini` |
| **B** | Circuit breaker + 429-mapping + cache-viselkedés kimaradás alatt | `TextAnalysisController::callGemini` / `aiFailureResponse` / `recordGeminiChainFailure`, `config/services.php` gemini-blokk |
| **C** | `AiWordCache` megosztott-cache izoláció & poisoning | `AiCacheService`, `AiWordCache`, cache-kulcs-képzés, prompt-tartalom, XSS-lánc a DOM-ig |

Vizsgált AI-belépési pontok (friss `route:list` alapján): 5 webes Gemini-route (`ta-ai` vödör),
`POST words/sentence-check`, 2 player-route (`player-ai`, Sanctum), az extension teljes route-készlete,
plusz az admin-only `gemini-models`.

## Lelet-darabszám súlyosság szerint

| Súlyosság | Darab | Azonosítók |
|-----------|-------|------------|
| **HIGH** | **0** | — |
| **MEDIUM** | **0** | — |
| **LOW** | **4** | QUOTA-1, QUOTA-2, CB-3, CB-4 |
| **INFO** | **9** | QUOTA-3, QUOTA-4, QUOTA-5, QUOTA-6, CB-2, CB-5, CB-6, CB-7, CACHE-3, CACHE-4, CACHE-5, CACHE-6, CACHE-7, CACHE-1, CACHE-2 → **lásd megjegyzés** |
| **REFUTED / megdőlt feltevés** | **9** | lásd „Megdőlt PLAN-feltevések" |

> **Megjegyzés az INFO-sorra:** a verifikációs kör két finder-LOW-t (CACHE-1, CACHE-2) INFO-ra
> fokozott le, és egy finder-INFO-t (CB-2) is INFO-n hagyott a korábbi kör LOW-jával szemben.
> Az INFO-lista így pontosan: QUOTA-3, QUOTA-4, QUOTA-5, QUOTA-6, CB-2, CB-5, CB-6, CB-7,
> CACHE-1, CACHE-2, CACHE-3, CACHE-4, CACHE-5, CACHE-6, CACHE-7 — **15 INFO**.
> (Ebből 3 kifejezetten POZITÍV megállapítás: CB-7, CACHE-6, CACHE-7.)

**Végleges összesítés: 0 HIGH · 0 MEDIUM · 4 LOW · 15 INFO.**

## Go-live blokkoló

**NINCS.** Egyetlen HIGH vagy MEDIUM lelet sem született, és a négy LOW közül egyik sem
sért biztonsági határt (nincs cross-tenant hatás, nincs kvóta-megkerülés, nincs adatszivárgás,
nincs stored XSS). A pénzügyi kényszerítés magja (`reserve()/settle()/refund()`) TOCTOU-mentes
és minden AI-úton kötelező.

## Dimenziónkénti verdikt

**A — kvóta-egységesség: TISZTA maggal, két hézaggal a peremen.**
Mind az 5 Gemini-hívó kód-út (`geminiWordLookup`, `geminiFlashcard`, `wordInsight`, `sentenceCheck`,
`practiceCheck`) egyetlen privát `callGemini()`-n megy át, mindegyik átadja a `user: $request->user()`-t,
a foglalás egyetlen atomikus feltételes UPDATE (`AiUsageService.php:50-52`), és a lánc pontosan egy
`settle()`-lel vagy `refund()`-dal zárul. Kvóta nélkül futó AI-hívás nincs (az egyetlen kivétel az
admin-only, token-költség nélküli `geminiListModels`). A peremen két hézag maradt: a player AI-route-jai
az egyetlen `verified` nélküli AI-belépési pontok (QUOTA-1), és nincs semmilyen globális (nem per-user)
költség-plafon vagy összesített költés-riasztás (QUOTA-2).

**B — circuit breaker + 429-mapping: TISZTA, a fő kérdésekre negatív a válasz.**
A kvóta-elszámolás mind a hat kilépési ágon konzisztens (nincs elszivárgó keret, nincs dupla refund).
A breaker **nem támadó-triggerelhető**: a végleges 4xx a `$sawTransientFailure` flag beállítása NÉLKÜL
lép ki, a `sanitizeWordForPrompt` regex pedig eleve kizárja az unicode-szemetet és a prompt-injectiont.
Timeout-védelem háromrétegű és explicit (connect 10s / próba 20s / lánc-deadline 30s, a próba-timeout
a hátralévő keretre vágva) → worker-lefogás zárt. Kimaradás alatt a cache-elt szavak zavartalanul
kiszolgálódnak, negatív cache nincs. Nyitva: stampede (CB-3) és a safety-blokk téves 502-je (CB-4).

**C — cache-izoláció & poisoning: TISZTA.**
PII-szivárgás nincs: a három cache-elt prompt kizárólag a `$word`-öt tartalmazza; a kontextusos lookup
szándékosan cache-mentes, a `sentenceCheck` (a user által ÍRT mondat) egyáltalán nem megy a cache-en át.
A kulcs (`task:lower(word):en:vN`) felhasználó-független és injektív (a `:` tiltott a szó-regexben →
task-ok közti ütközés kizárt). A hallucináció-poisoning kaput a `required` sémamezővé tett `is_real_word`
+ `$onlyRealWords` closure zárja mind a három ágon. Az XSS-lánc három egymástól független ponton
megszakad (szerver `htmlspecialchars` → Tiptap séma-normalizálás → render-idei `sanitizeHtml` allowlist).
Maradvány: kulcs-fragmentálódás whitespace/unicode-alakokra, méret-plafon hiánya, halott `language` kolumna
— mind INFO.

## Megdőlt PLAN-feltevések

**PLAN-feltevés MEGDŐLT (1) — „az `ExtensionController`-nek van saját AI-hívó kód-útja, amit külön kell auditálni."**
Az `ExtensionController` **egyáltalán nem hív Gemini-t** (grep `generateContent|callGemini|Http::` → 0 találat
ebben a fájlban, és `aiCache|remember|gemini` → 0 találat). A bővítmény AI-funkciói a
`chrome-extension/background.js:445-459`-ből a WEBES `text-analysis/gemini-*` route-okra mennek
session-cookie-val. Következmény: a bővítmény AI-ja automatikusan örökli a web teljes gate-jét
(auth + verified + onboarding + `aiLimitGuard` + `reserve`) — a paritás szorosabb a szándékoltnál,
viszont a throttle-vödör is közös (QUOTA-4). A vizsgálandó AI-írási felület tehát **három
controller-metódusra** szűkül, nem három kliensre.

**PLAN-feltevés MEGDŐLT (2) — „Sanctum-token esetén kérdés, hogy a költség a token tulajdonosának vagy senkinek könyvelődik."**
Nincs rés. `auth:sanctum` mellett a `$request->user()` a token birtokosa (`config/sanctum.php` guard `web`),
a `callGemini(..., user: $request->user())` ugyanezt kapja → a `reserve/settle` a TOKEN TULAJDONOSÁNAK
`ai_credits_used` oszlopát mozgatja. A `$user === null` ág (ami kvóta nélkül futna, `callGemini:2298`)
a player-route-okon elérhetetlen, mert az `auth:sanctum` előbb 401-et ad.

**PLAN-feltevés MEGDŐLT (3) — „van-e olyan AI-végpont amit Free user is elér, és ez szándékos-e?"**
IGEN, MINDET eléri, és ez expliciten szándékos: `User::hasAiAccess(): bool { return true; }`
(`app/Models/User.php:168-171`) a hozzá írt indoklással („AI minden csomagon elérhető — a Free is kap
kóstolót. A valódi korlát a havi költségkeret."). A differenciálás kizárólag a `config/plans.php`
`ai_budget_micros` mezőn történik (free 8000 / premium 500000 mikro-dollár). Egyetlen AI-végponton
sincs `subscribed`/`hasActiveAccess()` gate — helyesen, mert ez az üzleti döntés.

**PLAN-feltevés MEGDŐLT (4) — „a breaker globális cache-kulcson él, ezért egy rosszindulatú user szándékosan rossz bemenetekkel felhúzhatja a hibaszámlálót és levághatja MÁS userek AI-ját (cross-user DoS)."**
Kettős védelem zárja. (a) `sanitizeWordForPrompt` (`TextAnalysisController.php:811`)
`^[\pL][\pL'\- ]{0,99}$` → az unicode-szemét és a prompt-injection 422-t kap **HTTP-hívás nélkül**,
a breakerhez sem ér el. (b) Még 400-as Gemini-válasznál is a 2385-ös ág `break 2`-vel lép ki a
`$sawTransientFailure` flag beállítása NÉLKÜL, és a `recordGeminiChainFailure()` csak
`if ($sawTransientFailure)` mellett fut (2499). **Végleges 4xx SOSEM növeli a breaker-számlálót.**

**PLAN-feltevés MEGDŐLT (5) — „kimaradás alatt lehet olyan hibaág, ahol a reserve megtörtént de a refund kimarad (elszivárgó keret), vagy dupla refund történik (ingyen AI)."**
Mindkét irányban megdőlt. Mind a hat kilépési ág végigkövetve: siker → `settle` (2474) + return;
safety-blokk → `settle` (2426) + return; végleges 4xx → `break 2` → `refund` (2485); deadline →
`break 2` (2340) → refund; próbák kifutása → refund; nyitott breaker (2254) / reserve-bukás (2298) →
return a foglalás előtt. Az „egy reserve ↔ egy zárás" invariáns sértetlen.

**PLAN-feltevés MEGDŐLT (6) — „kimaradás alatt a cache negatív cache-be fordulhat, tranziens hiba beéghet."**
Az `AiCacheService::remember()` minőség-kapuja (44-46) csak `ok:true` + `is_array($result['data'])`
esetén tárol → tranziens hiba és a nyitott breaker `ai_unavailable` válasza SOHA nem kerül a cache-be.
Két meglévő teszt rögzíti szándékosként (`AiCacheTest.php`).

**PLAN-feltevés MEGDŐLT (7) — „ha nincs explicit `Http::timeout`, egy lassú Gemini lefoghatja a PHP-workereket."**
Háromrétegű, explicit védelem: `GEMINI_CONNECT_TIMEOUT_SECONDS = 10.0`, `GEMINI_HTTP_TIMEOUT_SECONDS = 20.0`
minden próbán (2351-2352), efölött a teljes láncra `request_deadline_seconds` (alap 30.0), és a
próba-timeout a hátralévő keretre vágva (`min(HTTP_TIMEOUT, $remaining)`, 2345). Az admin
`geminiListModels` is timeout-olt (1366-1367).

**PLAN-feltevés MEGDŐLT (8) — „poisonolt cache-bejegyzés HTML-t tartalmazhat és `dangerouslySetInnerHTML`-lel renderelődhet → stored XSS MINDEN useren (HIGH)."**
A lánc három független ponton szakad meg (részletek: CACHE-7). A teljes `resources/js` alatt mindössze
3 `dangerouslySetInnerHTML` van, egyik sem kap nyers AI-tartalmat. A `wordInsight` nem is HTML-ként,
hanem React-escape-elt JSX-szövegként renderel.

**PLAN-feltevés MEGDŐLT (9) — „egy user szándékosan hamis/káros tartalmat írhat a megosztott cache-be prompt-injekcióval."**
Nagyrészt megdőlt (CACHE-4). A jelölés-alapú payload be sem jut: a `.`, `<`, `>`, `:` és minden írásjel
elhasal a szó-regexen (PHP-vel mérve: `"cat. IGNORE ALL"` PASS=0, `"cat<script>"` PASS=0,
`"lookup:dog:en:v4"` PASS=0). A tisztán betűkből álló utasítás-szerű bemenet átmegy a regexen, de nem
tud tárolódni: a zárt `responseSchema` + `required is_real_word` + `$onlyRealWords` closure hármas kapuja
blokkolja.

## Regressziók a 2026-07-20-i körhöz képest

**Regresszió: NINCS.** A négy, a mai kódot érintő releváns commitot (`dd3694f`, `3983752`, `fbf4405`,
`b1afc47`) átolvastuk: **egyik sem nyúlt a kvóta-lánchoz** (`forms`-mező bővítés, `verified`-middleware,
cache-kulcs kisbetűsítés, `FORM_COLUMNS`-refaktor). A 2026-07-20-i „reserve/settle/refund egy kapun"
verdiktet a friss kód alapján önállóan megerősítjük.

### Korábbi verdiktek megdöntése

| Lelet | Korábbi verdikt | Mai verdikt | Irány |
|-------|-----------------|-------------|-------|
| **AI-M1** (breaker flapping: egy siker `Cache::forget`-tel nullázza a számlálót) | **MEDIUM** (2026-07-18/19) | **INFO** | ↓ LEFOKOZVA |
| **CACHE-1** (cache-kulcs normalizálás) | **LOW, NYITOTT** (2026-07-20: prompt-szó ≠ kulcs-szó → tartalom-keveredés) | **JAVÍTVA** mind a 3 ágon; a maradvány (whitespace/unicode fragmentálódás) **INFO** | ↓ + részben LEZÁRVA |
| **CB-2** (nincs `Retry-After` a 503-on) | **LOW** (2026-07-20) | **INFO** | ↓ LEFOKOZVA |
| **CB-1** (breaker globális kulcson) | LOW, „nem támadó-triggerelhető" | **MEGERŐSÍTVE** a friss kódon | = |
| **CB-3** (stampede / nincs single-flight) | LOW, szándékosan nyitva (AI-L2) | **LOW, változatlanul fennáll** | = |
| **AI-M2** (wordInsight cache-guard) | JAVÍTVA (95d6754) | **fix INTAKT**, két teszt őrzi | = |

**Új leletek, amiket a korábbi körök nem találtak meg:**
- **QUOTA-1** (LOW) — a player AI-route-jai az egyetlen `verified` nélküli AI-belépési pontok.
  A 2026-07-20-i verdikt nem fedte le a `verified`-paritást.
- **QUOTA-2** (LOW) — nincs globális költség-plafon és nincs összesített AI-költés-riasztás.
- **CB-4** (LOW) — a Gemini safety-blokk 502-t ad 422 helyett (a régi CB-2 ágának valós tartalma).
- **CB-5** (INFO) — a safety-blokk ága `cost_micros => 0`-t jelent, miközben a `settle()` a valós
  költséget felterhelte.
- **CB-6** (INFO) — a breaker-számláló elveszíthet egy kudarcot az `add()`/`increment()` közti
  mikroszekundumos ablakban.
- **QUOTA-5** (INFO) — drága modell-konfignál a becslés-alapú `reserve()` tartósan kizárhatja a Free-t
  (fail-closed csapda egy `.env`-váltásra).

## Kihagyott (kivezetett) pontok

A PLAN Fázis 3 három pontja (68-71. sor) **kvíz-, cloze-, rendhagyó-ige- és szabad-írás-mentes** —
egyetlen olyan felületre sem hivatkozik, ami a 2026-07-26-i feature-szűkítéssel kivezetésre került.
Emiatt a Fázis 3 audit-köréből **semmit nem kellett kihagyni**, a lefedettség hiánytalan.

Egy pontosítás: a `WordController::practice` / `TextAnalysisController::practiceCheck`
(szabad írás) a kivezetettek közé tartozik, viszont a `practiceCheck` a `callGemini()` **egyik hívója**,
ezért a kvóta-lánc invariáns-ellenőrzésénél (Dim A és B) mint kód-út meg van említve — leletet
azonban NEM jelentünk róla, és a végpont route-ja ki van kommentelve. Az `is_irregular` mező,
az igealakok és a `words.sentence-check` végpont (a szövegelemzőé, ÉLŐ) normál auditkörben van.

## Rangsorolt teendő-lista (javítás NEM történt)

| # | Lelet | Súly | Teendő |
|---|-------|------|--------|
| 1 | **QUOTA-1** | LOW | A `verified`-paritás helyreállítása: vagy a `revokePlayerTokens()` hívása a `ProfileController::update()` e-mail-váltás ágában (ez illeszkedne a mintához — minden más érzékeny ponton már meg van hívva), vagy a `routes/api.php:36-39` AI-csoport bevonása a 45. sor `verified` csoportjába. |
| 2 | **QUOTA-2** | LOW | Ops-teendő: összesített `SUM(ai_credits_used)` napi/havi riasztás (scheduled command + `ADMIN_EMAIL`), és/vagy globális havi költés-plafon config. Emellett a `config/registration.php:8` default `false` → érdemes `true`-ra állítani, hogy a kód-default is fail-closed legyen. |
| 3 | **CB-4** | LOW | A safety-blokk ága kapjon `error_code`-ot (pl. `ai_blocked` → 422). ⚠️ A javítás NEM egysoros: **4 meglévő teszt** rögzíti a jelenlegi 502-t (`GeminiResponseTest.php:241`, `:257`, `AiUsageTest.php:225`, `:243`) — ezeket együtt kell átírni. |
| 4 | **CB-3** | LOW | Single-flight a cache-miss-nél: `Cache::lock("ai-cache:{$key}")->block(...)` az `AiCacheService::remember()`-ben. Ha az AI-L2 „szándékosan nyitva" döntés fennmarad, **legalább kód-szintű indoklást** érdemes írni az `AiCacheService`-be — jelenleg nincs, ezért minden auditkör újra megtalálja új leletként. |
| 5 | **CB-5** | INFO | A safety-blokk `cost_micros`-a a valós, felterhelt költséget adja vissza (ma 0-t jelent) — mielőtt bárki költség-telemetriát épít erre a mezőre. |
| 6 | **QUOTA-5** | INFO | Deploy-checklistbe: modell-váltás előtt ellenőrizni, hogy az `$estimate` a Free `ai_budget_micros` alatt van-e; vagy a `reserve()` adjon külön jelzést, ha az estimate maga > limit (a mai hibaüzenet félrevezető lenne). |
| 7 | **CACHE-1/CACHE-2/CACHE-3** | INFO | Kis hardening-ek, ha jut rá idő: NFKC-normalizálás + szóköz-összevonás a `key()`-ben; méret-plafon a tárolt `response`-ra; a halott `language` kolumna kiírása vagy törlése (nyelv bevezetése előtt kötelező, mert akkor a hardcode-olt `:en:` valódi tartalom-keveredéssé válna). |
| 8 | **QUOTA-4/CB-2/CB-6** | INFO | Kozmetika: külön `ext-ai` throttle-vödör a bővítménynek; `Retry-After` fejléc a breaker 503-ára; `Cache::increment` `false`-ának explicit kezelése. |

## Fájlok

- `01-dim-a-kvota.md` — Dim A leletei (QUOTA-1 … QUOTA-6)
- `02-dim-b-circuit-breaker.md` — Dim B leletei (CB-2 … CB-7)
- `03-dim-c-cache-izolacio.md` — Dim C leletei (CACHE-1 … CACHE-7)
- `04-VERIFIKACIOS-NAPLO.md` — a súlyosság-viták teljes útja
