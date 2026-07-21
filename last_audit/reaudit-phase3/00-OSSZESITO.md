# Független újra-audit — PLAN.md **Fázis 3** (AI-terhelés, cache-izoláció & költség)

> Készült: 2026-07-20 · multi-agent workflow (3 dimenzió-finder + adverzariális verifikáció + szintézis, 15 agent, opus-4-8)
> **Teljesen független** az előző auditoktól: a finderek KIZÁRÓLAG a friss kód-olvasásra és a PLAN.md Fázis 3 hatókörére támaszkodtak — korábbi riportot / memória-jegyzetet NEM olvastak.
> Séma-kényszerített leletformátum (fájl · sor · súlyosság · forgatókönyv · evidence · verifikációs verdikt).
> **Csak dokumentálás — kód NEM módosult (audit-no-fixes).**

## Hatókör (PLAN.md 67–71)

1. Rate-limit + kvóta minden AI-belépési ponton (web, extension, player) egységes-e (`AiUsageService`).
2. Circuit breaker + 429-mapping + cache-viselkedés kimaradás alatt (`AiCacheService`).
3. `AiWordCache` megosztott-cache izoláció — cross-user szivárgás / cache-poisoning / PII a cache-kulcsban.

## Verdikt

| | |
|---|---|
| **Go-live blokkoló** | **NINCS** |
| HIGH | **0** |
| MEDIUM | **0** |
| LOW | **4** (mind CONFIRMED) |
| INFO | 7 (mind CONFIRMED — helyesség-dokumentálás / cáfolt premissza) |
| REFUTED | **0** |
| Nyers lelet | 11 → 11 túlélő (0 elesett) |

A 3 dimenzió közül **kettő lényegében TISZTA** (kvóta-egységesség, AiWordCache-izoláció); a harmadik (circuit-breaker) **működik**, apró szemantikai lazaságokkal. Egyetlen valós korrektségi hiba a homográf/casing kulcs-ütközés (CACHE-1), de az is csak nyilvános szótári tartalmat érint, PII/pénz nélkül.

---

## LOW leletek (4)

### CB-1 — Circuit breaker állapota globálisan megosztott (LOW)
- **Fájl:** `app/Http/Controllers/TextAnalysisController.php:2236` (`gemini:breaker:open` / `gemini:breaker:failures` konstans kulcsok)
- **Forgatókönyv:** a breaker-állapot user-független, globális cache-kulcson él. Küszöb (alap 5 egymást követő teljes lánc-kudarc) elérésekor a cooldown (alap 120s) alatt MINDEN user AI-kérése azonnal 503-at kap upstream-hívás nélkül.
- **Adverzariális verdikt (CONFIRMED, LOW):** **NEM támadó-triggerelhető** — a számláló CSAK a Gemini-oldali átmeneti hibára (`sawTransientFailure`: kapcsolat / 429/5xx / deadline) nő; a végleges 4xx `break 2`-vel flag nélkül lép ki (2384-2386), a beküldött szó sanitizált, így Gemini-5xx nem provokálható. Egyetlen siker nullázza a számlálót. Kimaradás alatt a cache-elt szavak tovább kiszolgálódnak. Hatás: átmeneti availability-csökkenés valódi Gemini-incidens alatt, pénz/adat-hatás nincs. **Szándékos worker-pool kimerülés elleni védelem, nem sebezhetőség.**

### CB-3 — Nincs single-flight/lock a szó-cache köré → stampede (LOW)
- **Fájl:** `app/Services/AiCacheService.php:32` (`remember()` — DB-miss után azonnal `$generator()`, lock nélkül)
- **Forgatókönyv:** egy frissen felkapott (még nem cache-elt) szóra egyszerre sok user keres → mind cache-misst lát → párhuzamos Gemini-hívások, amíg az első `updateOrCreate` beír.
- **Adverzariális verdikt (CONFIRMED, LOW):** költsége (egyidejű distinct userek) × 1 hívás, **nem korlátlan**: (a) mindenki a SAJÁT havi keretéből fizet a `reserve()`-vel, (b) végpontonkénti throttle 30/perc/user (`ta-ai` / `player-ai` vödör), (c) egy user sorosan kér. `updateOrCreate` a unique `cache_key`-en nem korruptál. Megnövelt Gemini-terhelés egy trending szó első pillanataiban — self-cost, nem kvóta-megkerülés.

### CACHE-1 — Homográf/kis-nagybetű kulcs-ütközés (LOW) ⭐ egyetlen valós korrektségi hiba
- **Fájl:** `app/Http/Controllers/TextAnalysisController.php:1021` (geminiFlashcard) és `:1302` (wordInsight) vs `AiCacheService::key()` `:70`
- **Forgatókönyv:** `geminiFlashcard`/`wordInsight` a szót `->trim()->value()`-vel adja a Gemininek (**NEM kisbetűsít**), de a cache-kulcs MINDIG `Str::lower($word)`. Következmény: A user `March` (hónap) flashcardot kér → a hónap-tartalom `flashcard:march:en:v3` alá kerül → B user `march` (menetel) kérése cache-találatot ad, és a HÓNAP-tartalmat kapja (vagy fordítva). Valós case-distinct angol homográfok: `POLISH/polish`, `March/march`, `May/may`, `Turkey/turkey`. A `geminiWordLookup` (`:1381`) ezzel szemben `->lower()`-t is hív → immunis; **a három belépési pont NEM egységes a normalizálásban.**
- **Adverzariális verdikt (CONFIRMED, LOW):** rossz, de **nyilvános** (nem privát) szótári tartalom keresztül-kiszolgálása; nincs PII-szivárgás, nincs pénzügyi hatás, angol-only. Olcsó fix lenne (flashcard/insight bemenet kisbetűsítése a lookup-paritásra), de nem indulás-blokkoló.

### QUOTA-REFUND-DAILY-1 — `refundDailyAnalysis` nem-atomi read-then-decrement (LOW, self-only)
- **Fájl:** `app/Http/Controllers/TextAnalysisController.php:411` (`if (Cache::get($key,0) > 0) { Cache::decrement($key); }`)
- **Forgatókönyv:** két egyidejű, hibára futó napi-elemzés refundja ütközhet a `get` és `decrement` közt.
- **Adverzariális verdikt (CONFIRMED, LOW):** a **foglalás** oldala atomi (`Cache::add`+`Cache::increment`, fail-closed `$count===false` guarddal), tehát a keret-KÉNYSZERÍTÉS race-safe; a race iránya **self-only + fail-closed**: legfeljebb ALUL-refundol (a user egy jogos slotot nem kap vissza), SOHA nem ad extra ingyen elemzést. Ráadásul a napi elemzés helyi tokenizálás, nem Gemini-költségpont. Elhanyagolható.

---

## INFO leletek (7) — helyesség-dokumentálás / cáfolt premisszák

| ID | Állítás | Verdikt |
|---|---|---|
| **CACHE-ISO-1** | AiWordCache cross-user szivárgás premissza **CÁFOLVA** — kulcs user-független (`task:lower(word):en:vN`), tárolt válasz szó-determinisztikus, kontextusos lookup SZÁNDÉKOSAN nincs cache-elve (`context!=='' → $generator()` remember nélkül), csak `is_real_word===true` tárolódik | CONFIRMED |
| **QUOTA-UNIFORM-1** | Mind a 3 felület ugyanazon `TextAnalysisController` metóduson + `reserve()`/`settle()`/`refund()` kapun megy át; kvóta a Sanctum-token tulajdonosához könyvelődik; extension/player ÍRÁS külön `reserveExtensionWrite` kereten | CONFIRMED |
| **QUOTA-SETTLE-1** | Egy `reserve()` ↔ pontosan egy `settle()`/`refund()` invariáns; cache-hit early-return nem is reservel | CONFIRMED |
| **QUOTA-ALLOWS-CACHEHIT-1** | `aiLimitGuard` a cache-találatot is 429-cel utasíthatja el keret betelésekor — **szigorúbb a szükségesnél** (kis UX-veszteség), biztonsági/pénz-hatás nincs | CONFIRMED |
| **CB-2** | Valódi Gemini 429/5xx a breaker nyílása ELŐTT **502-ként** (nem 503) képződik le, `Retry-After` nélkül — szemantikai/UX; keret visszajár | CONFIRMED |
| **CB-4** | `database` cache-store: a breaker `increment()` `false`-t adhat épp lejárt/pruned sorra → breaker egy ciklust késve nyílik; öngyógyuló, mikroszekundumos ablak | CONFIRMED |
| **CB-5** | reserve/refund invariáns a callGemini MINDEN hiba-ágán ép — "a keret nem jár vissza minden hiba-ágon" premissza **CÁFOLVA** | CONFIRMED |

---

## Dimenziónkénti állapot

**1. Kvóta-egységesség — TISZTA.** Mind a 3 felület (web / extension / player) a megosztott `geminiWordLookup`/`geminiFlashcard` metóduson és ugyanazon a `reserve()`/`settle()`/`refund()` kapun megy át. A `reserve` atomikus feltételes UPDATE (`ai_credits_used <= limit-estimate → increment`), TOCTOU-mentes. A kvóta a token tulajdonosához könyvelődik. Egyetlen rés a napi (nem-Gemini) elemzés-refund nem-atomicitása (QUOTA-REFUND-DAILY-1), fail-closed + self-only.

**2. Circuit-breaker + 429/cache-outage — MŰKÖDIK, kisebb szemantikai lazaságokkal.** A breaker globális (CB-1) de NEM támadó-triggerelhető; kimaradás alatt a cache-elt szavak tovább kiszolgálódnak. INFO-finomságok: outage a nyílás előtt 502 (nem 503) + hiányzó `Retry-After` (CB-2), DB-cache increment-rés egy ciklust késleltethet (CB-4). A reserve↔settle/refund invariáns minden hiba-ágon ép (CB-5).

**3. AiWordCache-izoláció — TISZTA.** Nincs cross-user szivárgás: user-független kulcs, szó-determinisztikus válasz, a tanulói mondat-kontextus szándékosan nincs cache-elve, csak valódi szó tárolódik. Egyetlen korrektségi hiba a casing-inkonzisztencia (CACHE-1) — nyilvános szótári tartalmat érint, PII/pénz nélkül.

## Cáfolt premisszák (amit hibának lehetett volna gondolni, de a kód kizárja)
- "megosztott cache → cross-user szivárgás / PII-mérgezés" — **CÁFOLVA** (CACHE-ISO-1)
- "dupla-refund / keret-infláció → ingyen AI" — **CÁFOLVA** (QUOTA-SETTLE-1, CB-5)
- "valamelyik felület megkerüli a keretet" — **CÁFOLVA** (QUOTA-UNIFORM-1)

## Opcionális, olcsó korrektségi finomítások (NEM blokkoló, nem javítottam)
- **CACHE-1:** flashcard/insight bemenet kisbetűsítése a `geminiWordLookup` paritására → megszünteti a homográf-ütközést.
- **CB-2:** chain-failure ág `error_code` beállítása (`ai_unavailable` v. `ai_rate_limited`) → 503 + `Retry-After` propagálás 502 helyett.

---

## Módszertan
- 3 dimenzió-finder párhuzamosan (kvóta-egységesség / breaker+429+cache-outage / AiWordCache-izoláció), opus-4-8, high effort.
- Minden leletre adverzariális verifikáció, cáfolásra promptolva (a LOW-ra egykörös single-pass, a séma szerint HIGH/MEDIUM-ra 2-3 lencse járt volna — de egy sem érte el a HIGH/MEDIUM küszöböt, így egykörös verifikáció futott mindegyikre).
- Séma-kényszerített kimenet (StructuredOutput): minden lelet + verdikt validált JSON.
- Nyers workflow-kimenet: `scratchpad/tasks/wlpmdpq2n.output` · journal: `subagents/workflows/wf_0c4a567d-e31/journal.jsonl`

**Megjegyzés:** a séma HIGH/MEDIUM-ra 2-3 független cáfoló verifikátort írt elő; mivel a finderek egyetlen leletet sem soroltak HIGH/MEDIUM-ba (mind LOW/INFO), a verifikáció egykörös volt. Ha kívánod, a 4 LOW-ra (különösen CACHE-1 és CB-1) tudok 2-3 lencsés extra cáfoló kört is futtatni a megerősítésre.
