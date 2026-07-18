# Fázis 3 — AI-terhelés, cache-izoláció & költség — audit

> Készült: 2026-07-18 · a go-live előtti utolsó, teljes lefedettségű audit AI-terhelési és költség-kockázati köre.
> Fókusz: valós, kihasználható vagy valós költség-/helyességi kockázat az AI-hívási láncban (Google Gemini a `TextAnalysisController::callGemini()`-n keresztül).
> Módszer: **multi-agent workflow** — dimenziónkénti finderek, majd minden HIGH/MEDIUM-gyanús leletre **2–3 független, cáfolásra promptolt adverzariális verifikátor** (korrektség / kihasználhatóság / reprodukció nézőpont), LOW-ra egykörös. Séma-kényszerített leletformátum (fájl, sor, súlyosság, forgatókönyv, verifikációs verdikt). **Csak dokumentálás — kód nem módosult.**

## Lefedett dimenziók (3)

1. **quota-ratelimit** — kvóta- és rate-limit-egységesség minden AI-belépési ponton (web + extension + player), a teljes `reserve()` / `settle()` / `refund()` lánc.
2. **breaker-degradation** — circuit-breaker helyesség (küszöb/cooldown), degradált/kiesett Gemini alatti UX + refund, 429-mapping, cache mint védőháló, napi számláló fail-open/closed.
3. **cache-isolation** — megosztott `ai_word_cache` izoláció, cache-poisoning, kulcs-normalizálás, PII-szivárgás, tábla-növekedés.

---

## Összegzés

| Súlyosság | Db | Valós (CONFIRMED/PARTIAL) leletek |
|---|---|---|
| **HIGH** | **0** | — |
| **MEDIUM** | **2** | AI-M1 (breaker, flapping) · AI-M2 (cache, `wordInsight` guard-hiány) |
| **LOW** | **3** | AI-L3 (cache-takarítás) · AI-L1 (quota, blokk-refund) · AI-L2 (quota, több-próbás settle) |
| **INFO** | **4** | AI-I4 (breaker, tartós 4xx) · AI-I1 (quota, player verified) · AI-I2 (breaker, fallback settle) · AI-I3 (breaker, `wordInsight` = AI-M2 gyökér) |

**Go-live blokkoló: NINCS. Nulla HIGH.**

A két MEDIUM valós, de mindkettő **bounded és nem közvetlenül támadó-kihasználható**:
- **AI-M1 (breaker):** külső Gemini-incidens + terhelés együttállásánál degradáció (worker-hold a deadline-ig), amit a cache, a per-kérés deadline és a throttle mérsékel. Reziliencia-javítás, nem indulás-blokkoló.
- **AI-M2 (cache):** valós cache-mérgezés/paritás-hiba a `wordInsight`-nál, de a per-user havi kvóta korlátozza a nem-admin flooding-ot, a korlátlan út admin-only (megbízható). Egyszerű, jól körülhatárolt javítás (valódiszó-kapu + teszt).

---

## Összegző tábla (CONFIRMED / PARTIAL leletek)

| id | súlyosság | cím | fájl:sor | verdikt (szavazat) |
|---|---|---|---|---|
| AI-M1 | **MEDIUM** | Circuit breaker nem nyílik flapping (részleges) kiesésnél; siker nullázza a számlálót | [TextAnalysisController.php:2361](../app/Http/Controllers/TextAnalysisController.php#L2361) | PARTIAL (1 CONFIRMED / 2 PARTIAL) |
| AI-M2 | **MEDIUM** | `wordInsight` megosztott cache-nek nincs valódiszó-kapuja → cache-mérgezés | [TextAnalysisController.php:1290](../app/Http/Controllers/TextAnalysisController.php#L1290) | CONFIRMED (2 CONFIRMED / 1 PARTIAL) |
| AI-L3 | **LOW** | `ai_word_cache` táblának nincs automatikus takarítása / TTL-je | [routes/console.php:22](../routes/console.php#L22) | PARTIAL (3 PARTIAL → LOW) |
| AI-L1 | **LOW** | Biztonsági blokk (SAFETY/RECITATION) teljes keretet refundál, pedig a Gemini költött | [TextAnalysisController.php:2313](../app/Http/Controllers/TextAnalysisController.php#L2313) | CONFIRMED (1/1) |
| AI-L2 | **LOW** | Több-próbás lánc: csak az utolsó sikeres hívás settle-elődik, a köztes díjköteles próbák ingyenesek | [TextAnalysisController.php:2354](../app/Http/Controllers/TextAnalysisController.php#L2354) | CONFIRMED (1/1) |
| AI-I4 | **INFO** | Tartós végleges 4xx (kulcs-hiba) sosem nyitja a breakert → folyamatos 502 | [TextAnalysisController.php:2284](../app/Http/Controllers/TextAnalysisController.php#L2284) | PARTIAL (→ INFO) |
| AI-I1 | **INFO** | Player AI-végpontok a `verified` MW-n kívül — de a keret-kényszerítés egységes (nem költség-rés) | [routes/api.php:36](../routes/api.php#L36) | CONFIRMED (INFO) |
| AI-I2 | **INFO** | Fallback-eszkaláció `settle()`-je egyszeri, korlátos túllépéssel átlépheti a havi keretet | [TextAnalysisController.php:2195](../app/Http/Controllers/TextAnalysisController.php#L2195) | CONFIRMED (INFO) |
| AI-I3 | **INFO** | `wordInsight` cache-guard hiánya (higiénia; azonos gyökér mint AI-M2) | [TextAnalysisController.php:1290](../app/Http/Controllers/TextAnalysisController.php#L1290) | CONFIRMED (INFO) |

> Két dimenzió-finder egymástól függetlenül azonosította ugyanazt a `wordInsight` cache-guard-hiányt (cache-dimenzió: **AI-M2**, MEDIUM; breaker-dimenzió: **AI-I3**, INFO). Ugyanaz a kód-gyökér ([TextAnalysisController.php:1290](../app/Http/Controllers/TextAnalysisController.php#L1290)); egyetlen javítás egyszerre zárja mindkettőt.

---

## Leletenkénti részletezés (CONFIRMED / PARTIAL)

### AI-M1 — MEDIUM — A circuit breaker nem nyílik ki részleges (flapping) Gemini-kiesés alatt
**Fájl:** [TextAnalysisController.php:2361](../app/Http/Controllers/TextAnalysisController.php#L2361) · **Verdikt:** PARTIAL (1 CONFIRMED / 2 PARTIAL)

**Forgatókönyv:** Gemini részlegesen esik ki (a kérések ~40–70%-a 503/timeout, a többi sikeres — tipikus Google-incidens). A breaker kudarc-számlálója **nyers, egymást követő count**, amit **bármely** sikeres válasz teljesen nulláz (`Cache::forget`). Így flapping alatt az 5-ös küszöb sosem gyűlik fel, a breaker zárva marad, és minden kudarcos kérés végigfut a teljes láncon (2 modell × 2 próba, a per-kérés deadline-ig), fejenként lefogva egy PHP-FPM workert. Pont az a worker-kimerülési kockázat, ami ellen a breakert tervezték — teljes (100%) kiesésnél helyesen nyílik, részlegesnél nem.

**Kód-bizonyíték:**
- `2361`: sikeres válaszban `Cache::forget(self::GEMINI_BREAKER_FAILURES_CACHE_KEY);` — teljes forget, nem dekrementálás.
- `2382–2384`: `if ($sawTransientFailure) { $this->recordGeminiChainFailure(); }` — csak teljes lánc-kudarcnál növel.
- `2396–2401`: nyers `Cache::increment`, küszöb 5 (`config/services.php`); a 600 s ablak csak elévülés, nem csúszó-arány.
- Szándékos, tesztben rögzített viselkedés: `tests/Feature/GeminiOutageTest.php:67–96` („sikeres válasz nullázza a breaker kudarc-számlálóját") épp a flapping-mintát futtatja és `Http::assertSentCount(10)`-et vár — vagyis a breaker NEM nyílik ki.

**Verifikátorok:** 1 CONFIRMED + 2 PARTIAL. A mechanizmus mindhárom szerint igaz és tesztben rögzített. A súlyosságot a jelenlévő backstopok mérséklik: per-kérés deadline (~30 s hard-cap), per-próba HTTP-timeout a hátralévő deadline-re vágva, route-szintű throttle-vödrök, és — döntő — az `AiCacheService` user-független szó-cache-e, ami a lookup/flashcard/insight kérések nagy részét kiesés alatt is cache-ből szolgálja ki (nulla upstream-hívás). Két verifikátor LOW-ra húzná (nem támadó-kihasználható, külső incidens váltja ki, csak szűk közepes-kudarc-sávban áll fenn); egy MEDIUM-on tartja (nagy párhuzamosságnál valós worker-hold, defense-in-depth rés). **Végleges: MEDIUM (alsó él), PARTIAL.**

**Ajánlás:** arány-alapú küszöb (N kudarc M kérésből csúszóablakban), vagy a siker-reset legyen dekrementálás a teljes forget helyett. Minimum: dokumentáld tudatos döntésként, és ellenőrizd, hogy részleges kiesésnél terhelés alatt a deadline + throttle nem meríti-e a worker-poolt.

---

### AI-M2 — MEDIUM — A `wordInsight` megosztott cache-nek nincs valódiszó-kapuja
**Fájl:** [TextAnalysisController.php:1290](../app/Http/Controllers/TextAnalysisController.php#L1290) · **Verdikt:** CONFIRMED (2 CONFIRMED / 1 PARTIAL)

**Forgatókönyv:** A `geminiFlashcard` (`1017`) és a `geminiWordLookup` (`1390`) `$onlyRealWords` guardot ad a `remember()`-nek, így nem létező/hallucinált szóra adott választ NEM cache-el. A `wordInsight` (`1290–1296`) viszont guard NÉLKÜL hív `remember()`-t, és az `insightSchema()` egyáltalán nem tartalmaz `is_real_word` mezőt (a guard elvileg sem adható meg). Következmény: bármely bemenet, ami átmegy a `sanitizeWordForPrompt`-on (akár tetszőleges 1–100 karakteres kitalált „szó"), jól formált Gemini insight-választ kap (a séma miatt mindig well-formed), és az `updateOrCreate` VÉGLEGESEN eltárolja az `insight:<lower(word)>:en:v2` kulcson. Ez a sor ezután minden felhasználónak kiszolgálódik (`firstWhere cache_key`), keret-terhelés nélkül → cache-mérgezés (rossz/kitalált szóra beragadt insight) + tábla-elárasztás.

**Kód-bizonyíték:**
- `1290–1296`: `remember('insight', $word, ..., fn () => $this->callGemini(...))` — a 6. (`$isCacheable`) paraméter hiányzik.
- `1385` / `1013`: kontraszt — lookup/flashcard `$onlyRealWords = fn (array $data): bool => ($data['is_real_word'] ?? true) === true`.
- `insightSchema()`: csak `areas`/`register_hu`/`tip_hu`, NINCS `is_real_word`.
- `AiCacheService.php:46`: `if ($wellFormed && ($isCacheable === null || $isCacheable(...)))` — insightnál `$isCacheable === null`, csak a well-formed kapu véd, ami sémavezérelt válasznál gibberish szóra is teljesül.
- Teszt-hézag: `AiCacheTest` a lookup és flashcard gibberish→`count()===0` esetét fedi, insightra NINCS negatív teszt.

**Verifikátorok:** 2 CONFIRMED + 1 PARTIAL. Minden kód-tény igazolt. A PARTIAL-szavazó a kihasználhatóságot enyhébbnek látja (LOW): a per-user havi kvóta (Free ≈ maroknyi insight/hó) korlátozza a flooding-ot; a korlátlan út (`aiMonthlyLimit() === null`) CSAK adminra igaz (ADMIN_EMAIL-hez kötött, megbízható fiók); a cross-user „rossz insight kiszolgálva" kár exact-string egyezést igényel egy kitalált tokenre. A két CONFIRMED-szavazó MEDIUM-on tartja: valós korrektség/integritás-defektus és paritás-hiány a testvér-végpontokkal, a megosztott user-független cache mérgezhető és a cache-hit keret-mentesen szolgál ki. **Végleges: MEDIUM (alsó sáv).**

**Ajánlás:** (a) vedd fel az `is_real_word` BOOLEAN mezőt az `insightSchema`-ba és a promptba (mint lookup/flashcardnál), majd add át ugyanazt az `$onlyRealWords` guardot; VAGY (b) csak ismert valódi szóra (létező `Word`/lookup-cache találat) engedj insight-cache-elést. Egészítsd ki az `AiCacheTest`-et egy insight-gibberish teszttel (`AiWordCache::count() === 0`).

---

### AI-L3 — LOW — Az `ai_word_cache` táblának nincs automatikus takarítása vagy TTL-je
**Fájl:** [routes/console.php:22](../routes/console.php#L22) · **Verdikt:** PARTIAL (3 PARTIAL → LOW)

**Forgatókönyv:** Az `ai_word_cache` sorai véglegesek: a `remember()` `updateOrCreate`-tel ír, soha nem törli őket, a modell nem használ `Prunable` trait-et / TTL-t, és a `routes/console.php` ütemezője SEHOL nem futtatja az `ai:cache:clear`-t (kizárólag kézi). Így minden új cache-elhető szó + minden `prompt_version`-bump utáni régi, immár elérhetetlen verziós sor (kulcs-eltérés miatt sosem szolgálódik ki, de bent marad) örökké a táblában marad. Nincs riasztás vagy felső korlát a méretre.

**Kód-bizonyíték:**
- `routes/console.php`: ütemezett parancsok `queue:alert-failed`, `queue:monitor`, `sanctum:prune-expired`, `cashier:reconcile-subscriptions` — `ai:cache:clear` és `model:prune` NINCS közöttük.
- `ClearAiCache.php`: kizárólag kézi (`handle()` → `query->delete()`), semmi nem hívja a schedule-ben.
- `AiWordCache.php`: nincs `use Prunable` / `prunable()` / TTL.
- A `2026_06_24_143554` migráció kommentje maga is kézi `ai:cache:clear`-re hivatkozik a prompt_version-bump-orphanök takarítására.

**Verifikátorok:** 3 PARTIAL, egyöntetűen LOW-ra húzva. A strukturális MAG-állítás (nincs auto-prune / TTL / riasztás) mindhárom szerint igaz. A MEDIUM viszont túlbecsült: (1) a növekedés természetesen korlátos — lookup/flashcard `is_real_word === true` gate-tel cache-el, gibberish nem kerül be, a domináns halmaz a véges valós angol szókincs; (2) minden cache-írás egy sikeres, `reserve()`-en átment Gemini-hívást igényel → a per-user havi kvóta érdemi írási plafon, nincs anonim/ingyenes feltöltési út; (3) a `cache_key` UNIQUE btree egyenlőség-keresés O(log n), milliós sornál is gyors. A valós maradék: a bumpolt elavult verziós sorok holt súlyként bent maradnak, és nincs sor-szám monitorozás — lassú, nem kihasználható ops/higiéniai hézag. **Végleges: LOW.**

**Ajánlás:** (a) tedd `Prunable`-lé az `AiWordCache`-t konzervatív retention-nel (pl. `updated_at < now-180 nap`) és ütemezd a `model:prune`-t naponta; VAGY (b) ütemezz célzott `ai:cache:clear`-t az elavult `prompt_version` sorokra. Minimum: sor-szám monitorozás/riasztás go-live előtt.

---

### AI-L1 — LOW — Biztonsági blokk (SAFETY/RECITATION) teljes keretet refundál, pedig a Gemini költött
**Fájl:** [TextAnalysisController.php:2313](../app/Http/Controllers/TextAnalysisController.php#L2313) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** Nem-admin felhasználó olyan `context`/`sentence` szabad szöveget küld a `gemini-lookup` (context-ág) vagy `sentence-check` végpontra, ami megbízhatóan SAFETY/RECITATION blokkot vált ki. A Gemini a promptot FELDOLGOZZA (input-tokenek → valós, számlázott költség a Google felé), majd blokkolt választ ad. A `callGemini` a blokk-ágban a TELJES becslést refundálja (`2313`), így az `ai_credits_used` a hívás előtti szintre áll vissza. Ismételve (a percenkénti throttle-plafonig, 30/perc/user) korlátlanul, a havi keret elfogyasztása NÉLKÜL vált ki valós Gemini-input-költséget. Ez eltér a valódi átmeneti hibától (500/timeout), ahol a Gemini semmit nem számláz — ott a refund helyes.

**Kód-bizonyíték:** `2302–2317`: `promptFeedback.blockReason !== null` VAGY `finishReason ∈ {SAFETY, RECITATION, PROHIBITED_CONTENT}` → feltétel nélküli teljes `refund($user, $estimatedMicros)`, majd `cost_micros => 0`.

**Verifikátor:** CONFIRMED (a besorolásban közepes bizonyosság). A refund-aszimmetria valós. LOW marad, mert: (1) nem MINDEN blokk számláz input-tokent — a `promptFeedback.blockReason` (input-szűrő) ágnál a Google gyakran nem, csak a RECITATION/candidate-suppress ág garantáltan díjköteles; (2) a per-hívás költség tört-cent nagyságrendű; (3) templated promptban megbízhatóan blokkot (főleg RECITATION-t) kiváltani nehéz. A throttle a burst-rátát korlátozza, de a havi keretet sosem meríti — hosszú távon nincs per-user költség-plafon e vektorból.

**Ajánlás:** a blokk-ág ne a teljes becslést refundálja, hanem a valós input-költséget `settle`-elje (`usageMetadata.promptTokenCount`, vagy `ceil(mb_strlen($prompt)/4) * rate['in']`), és csak a maradék output-becslést refundálja.

---

### AI-L2 — LOW — Több-próbás lánc: csak az utolsó sikeres hívás settle-elődik
**Fájl:** [TextAnalysisController.php:2354](../app/Http/Controllers/TextAnalysisController.php#L2354) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** A `callGemini` MAX_TOKENS-csonkolás esetén egyszeri kerettágítást (`maxTokens * 1.5`) végez ugyanazon a modellen. A csonkolt (első) hívás a Gemininél TELJES output-tokenkeretet termelt (pl. lookup ~700 token) → valós, számlázott költség. A `settle()` viszont KIZÁRÓLAG a végső sikeres próba `costMicros`-át számolja el — a köztes csonkolt próba költsége eldobódik. Támadó megbízhatóan csonkoló bemenetet választhat (pl. sok ragozott alakú ige a lookupban), így az első teljes output-generálás rendszeresen a platform terhére esik.

**Kód-bizonyíték:**
- `2326–2344`: a MAX_TOKENS-csonkolási ág a `$data === null` ágban fut (bump + `continue`), SOHA nem éri el a `2354–2357` sorokat, ahol a `$costMicros` kiszámítódik és a `settle()` meghívódik.
- `settle()` (`AiUsageService.php:66–73`): kizárólag az adott (végső) iteráció `usageMetadata`-jából számolt költséget rendezi; nincs hívás-szintű költség-akkumulátor.

**Verifikátor:** CONFIRMED (magas bizonyosság). A MAX_TOKENS-scope pontos. Két finomítás a LOW-hoz: (1) a „fallback utáni siker" állítás gyengébb — a fallback-esetben a primary jellemzően 503/hálózati hibával bukik, ami NEM termel output-tokent, így ott nincs alul-terhelés; a valós leak a MAX_TOKENS-ágra korlátozódik. (2) A `$bumpedForTruncation` flag miatt hívásonként max EGY csonkolt próba eshet ki (~egy teljes output-budget, ~700 token), nem korlátlan. Belső havi kvóta-könyvelést érint (mikro-dollár), nem közvetlen pénztárcát.

**Ajánlás:** hívás-szintű költség-akkumulátor a `callGemini`-ben: minden ténylegesen díjköteles próba (sikeres VAGY output-tokent termelő csonkolt, a `usageMetadata` alapján) költségét add hozzá, és a végén az összesített valós költséget `settle`-eld. A tisztán hibázó (network/500) próbák továbbra is 0-val terheljenek.

---

## INFO (megfigyelés — nem teendő, vagy tudatos tervezési döntés)

### AI-I4 — INFO — Tartós végleges 4xx (kulcs-hiba) sosem nyitja a breakert
**Fájl:** [TextAnalysisController.php:2284](../app/Http/Controllers/TextAnalysisController.php#L2284) · **Verdikt:** PARTIAL (→ INFO)

Éles kulcs lejár/rossz, vagy a Gemini tartósan 4xx-et ad (nem 429). A kérés a `$status < 500 && $status !== 429` ágon `break 2`-t csinál (`2285`) anélkül, hogy `$sawTransientFailure`-t igazra állítaná → `recordGeminiChainFailure` NEM fut → breaker SOSEM nyílik. Minden felhasználói AI-kérés folyamatos 502-t kap (a tisztább „AI ideiglenesen nem elérhető" 503 helyett). Worker-kimerülés itt NINCS (a 400/403 gyorsan visszatér). A súlyosságot vivő „admin email-áradat" állítás **CÁFOLT** (lásd lentebb). **Végleges: INFO** — enyhe UX/observability árnyalat és tudatos tervezési döntés (végleges 4xx kérés-specifikus, szándékosan nem számít a breakerbe). Opcionálisan tartós 401/403 esetén dedikált „kulcs-hiba" jelzés → a user 503-at kapjon 502 helyett.

### AI-I1 — INFO — Player AI-végpontok a `verified` MW-n kívül (nem költség-rés)
**Fájl:** [routes/api.php:36](../routes/api.php#L36) · **Verdikt:** CONFIRMED (INFO)

A `player/gemini-lookup` és `player/gemini-flashcard` (`api.php:36–39`) a `verified` middleware-blokk (`45–60`) FÖLÖTT vannak, így az egyetlen kapu a controller `admin || hasAiAccess()` gate-je, és `hasAiAccess()` mindig `true`. Elvben egy nem-megerősített e-mailű fiók player-tokenje is elérheti az AI-t. A gyakorlatban a player-token kiadása webes `auth+verified` jóváhagyáshoz kötött, és — költség szempontból döntő — MINDEN player-AI hívás ugyanazon a `callGemini → reserve()` atomi kereten megy át, mint a webes hívások (közös user-row). NINCS ingyen-költés vagy keret-megkerülés. **Policy/hozzáférés-elvi megfigyelés, nem kvóta/költség-bypass.** Ha a `verified`-elvet ki akarjátok terjeszteni a player-AI-ra (összhangban a player írás-végpontokkal), a két route áthelyezhető a `verified`-csoportba — policy-döntés.

### AI-I2 — INFO — Fallback-eszkaláció settle()-je egyszeri, korlátos túllépéssel átlépheti a havi keretet
**Fájl:** [TextAnalysisController.php:2195](../app/Http/Controllers/TextAnalysisController.php#L2195) · **Verdikt:** CONFIRMED (INFO)

A lookup/insight/sentence/practice feladatoknál a primary az olcsó `gemini-2.5-flash-lite`, a fallback a drágább `gemini-2.5-flash`. A `reserve()` a PRIMARY rátáján foglal. Ha a keret határán a foglalás átmegy, majd kapacitás-hiba miatt a drágább fallback-re esik, a `settle()` a különbözetet UTÓLAG rátölti (`adjust` increment), ami `ai_credits_used`-t a limit FÖLÉ viheti. A következő kérés akkor helyesen elutasít. **Tudatos tradeoff, amit a `reserve()` és a `callGemini()` kommentje explicit rögzít.** A túllépés egyszeri és korlátos (egy hívás fallback-különbözete), az enforcement ép marad. Nem szivárgás. Szigorúbb plafonhoz a lánc legdrágább modelljének rátáján lehetne foglalni (konzervatív becslés).

### AI-I3 — INFO — `wordInsight` cache-guard hiánya (higiénia)
**Fájl:** [TextAnalysisController.php:1290](../app/Http/Controllers/TextAnalysisController.php#L1290) · **Verdikt:** CONFIRMED (INFO)

Ugyanaz a kód-gyökér, mint az **AI-M2** lelet — a breaker-dimenzió-finder mellékesen INFO-ként érintette (cache-minőségi kérdés, nem biztonsági/PII: az insight-prompt nem tartalmaz user-kontextust, a válasz szó-determinisztikus). Az érdemi besorolás és a részletes bizonyíték az AI-M2 szakaszban (MEDIUM). Egyetlen javítás mindkettőt zárja.

---

## Megvizsgált és elvetett (REFUTED / cáfolt állítás-részek)

A verifikáció egyetlen leletet sem cáfolt teljes egészében, de **egy súlyosságot vivő részállítást elvetett:**

- **AI-I4 „admin email-áradat":** Az az állítás, hogy tartós 4xx-nél a `Log::error('Gemini full chain failure')` kérésenként admin-riasztást küld, **HAMIS**. Az `AlertAdminOfLoggedError.php:45` órás atomi throttle-t alkalmaz (`Cache::add($this->throttleKey($event), true, now()->addHour())`, `md5(message)` kulcs a fix üzenetre) → óránként max egy email. A javasolt log-throttle már létezik. Ezért az eredetileg MEDIUM/LOW-gyanús AI-I4 **INFO-ra minősült**; a maradék UX-árnyalat tudatos tervezési döntés.

---

## Lefedettségi jegyzet (dimenziónként — mi bizonyult tisztának)

**quota-ratelimit (tiszta pontok):**
- EGYSÉGES kvóta-kapu: mind az 5 valós `callGemini`-hívó (`geminiFlashcard` 1022, `practiceCheck` 1179, `sentenceCheck` 1240, `wordInsight` 1295, `geminiWordLookup` 1381) átadja a `user`-t → mind az atomi `reserve()`-en megy át. NINCS `user: null` hívó, ami ingyen költene. Az `ExtensionController` SEHOL nem hív Gemini-t/AiCache-t/AiUsage-t (grep: 0 találat); az addWord/createFlashcard tartalom-kvótát használ, nem AI-keretet.
- ALUL-BECSLÉS nem lehetséges: az output-oldali `$maxTokens` végpontonként szerver-oldali konstans (700/1000/600/400/800), nem user-vezérelt; a user-input (context ≤300, sentence ≤500, word ≤100 kar.) csak NÖVELI a becslést, a `settle()` lefelé korrigál — cost-safe.
- `allows() ↔ reserve()` rés nincs: minden Gemini-hívás az atomi `reserve()`-en megy át; a reserve bukása `ai_limit`→429 Gemini-hívás nélkül. A keret-határi TOCTOU lezárva (`AiUsageTest`).
- THROTTLE-izoláció: hitelesített kéréseknél user-azonosító szerint kulcsol (nem IP) → egy IP nem meríti más userek keretét. NINCS throttle nélküli AI-végpont.
- `refund()` a valódi átmeneti hibáknál (network/500/timeout) helyes; nem tud a keret alá csúszni (UNSIGNED-clamp).

**breaker-degradation (tiszta pontok):**
- Breaker-küszöb/cooldown: csak átmeneti hibák nyitják; végleges 4xx (429 kivételével) nem számít a breakerbe.
- Nyitott breaker alatt a rövidzár a `reserve()` ELŐTT fut → nincs mit refundálni; a user tiszta 503-at kap (nem fehér képernyő/500/végtelen várakozás).
- 429-mapping helyes: Google-kvóta → 502, saját kvóta → 429; a kettő nem keveredik.
- Cache mint védőháló: cache-találatnál a `callGemini` le sem fut (nulla Gemini-hívás kiesés alatt). A breaker cache-kulcsok (`gemini:breaker:*`) nem ütköznek az `ai:cache:clear`-rel (az csak az `ai_word_cache` táblát üríti) vagy a plan-limit lockokkal. Nincs `Cache::flush`.
- Napi számláló: `reserveDailyAnalysis` `Cache::add`+`increment` atomikus; `$count === false` → FAIL-CLOSED (dokumentált). Minden `callGemini` kilépési út vagy `settle`-t vagy `refund`-ot hív → nincs kvóta-szivárgás.

**cache-isolation (tiszta pontok):**
- Kulcs user-független (`task:lower(word):en:vN`), a cache-elt response nem tartalmaz user-adatot (flashcard/insight prompt csak a `$word`-öt interpolálja; a lookup context-ág és a sentence/practice user-szöveggel helyesen NEM cache-el) → **nincs PII-átszivárgás**.
- Kulcs-normalizálás: a `sanitizeWordForPrompt` regex tiltja az újsort/tabot/dupla idézőjelet/számot/vezető nem-betűt → nincs klasszikus prompt-injekció vagy task-injection (a `task` kódból jön).
- Nincs kulcs-csonkolásból eredő ütközés (`cache_key` VARCHAR(255)-be bőven belefér), nincs egy-soros JSON-méret-robbanás (LONGTEXT + `maxOutputTokens` + `responseSchema`).
- Well-formed kapu: csak `ok === true && is_array(data)` esetén tárol.
- Elavult prompt-verzió: a kulcs tartalmazza a verziót → régi verziójú válasz sosem szolgálódik ki helytelenül.
- Nincs kihasználható mass-assignment (`updateOrCreate` explicit tömbbel).
- **Ismerten nyitva hagyott (nem új lelet):** concurrent stampede — két párhuzamos kérés ugyanarra az új szóra dupla Gemini-hívást tehet, mielőtt `updateOrCreate` deduplikál. A projekt-memória (AI load-readiness L2) tudatosan nyitva hagyta; a `reserve` maga TOCTOU-biztos, csak a generálás nincs deduplikálva.

---

## Ajánlott sorrend go-live előtt

1. **AI-M2** (cache) valódiszó-kapu + teszt — kis, zárt javítás; egyszerre zárja AI-I3-at is.
2. **AI-M1** (breaker) legalább tudatos-döntés-dokumentálás, opcionálisan arány-alapú küszöb vagy dekrementáló siker-reset.
3. **AI-L3** (cache-takarítás) sor-szám monitorozás/riasztás vagy `Prunable`.
4. **AI-L1 / AI-L2** (quota) költség-aszimmetriák dokumentálása vagy settle-alapú korrekció, ha a mikro-dolláros pontosság fontos.

*(Audit-no-fixes: e riport csak dokumentál. A fentiek közül semmit nem javítottam — a javítás külön, kifejezett kérésre történik.)*
