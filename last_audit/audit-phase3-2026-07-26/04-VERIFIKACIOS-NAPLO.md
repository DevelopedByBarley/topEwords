# Verifikációs napló — Fázis 3 (2026-07-26)

Csak azok a leletek szerepelnek itt, ahol a súlyosság útközben VÁLTOZOTT, vagy ahol egy korábbi
auditkör verdiktjét megdöntöttük. A változatlan súlyú leletek (QUOTA-1, QUOTA-2, CB-3, CB-4 → mind
finder-LOW = végső LOW) indoklása a dimenzió-fájlokban van.

Megjegyzés a lefolyásról: **HIGH/MEDIUM lelet nem született**, ezért többségi (3-lencsés) szavazásra
nem került sor. Minden LOW egykörös adverzariális verifikációt kapott; az alábbi négy esetben a
verifikátor vagy a finder önmaga súlyt módosított.

---

## 1. CACHE-1 — finder LOW → **INFO** (lefokozva)

**Lelet:** a cache-kulcs nem normalizál whitespace-re és unicode-alakra → kulcs-fragmentálódás.

**Finder súlyozása (LOW), indoklása:** „egy user a 30/perc `ta-ai` vödörből ~43 200 sort/nap tud
létrehozni, HA a Gemini `is_real_word=true`-t ad rájuk (homoglif/fullwidth alakoknál ez reálisan
előfordulhat)". Ezt tekintette a LOW-t megalapozó hatásnak, elismerve, hogy cross-user szivárgás nincs.

**Verifikátor verdiktje: nem cáfolt, de INFO.** Szó szerinti indoklás-részletek:

> „A leletben leírt MECHANIZMUS IGAZ és reprodukálható, de a HATÁS-becslés nagyságrendekkel túlzó,
> ezért a LOW nem indokolt."

> „A »30/perc vödörből ~43 200 sor/nap« állítás FIGYELMEN KÍVÜL HAGYJA a havi AI-költségkeretet, ami a
> tényleges szűk keresztmetszet. […] A `:2296` becslővel és a `:2181-2182` áraival egy hívás foglalása
> ~380 micros (lookup, flash-lite, 700 token), illetve ~2 800 micros (flashcard, flash, 1 000 token).
> Ez Free-n kb. 21 lookup VAGY 3 flashcard HAVONTA; Pro-n ~1 316 / ~179. Tehát egy Free user nem hoz
> létre 43 200 sort naponta — egy HÓNAP alatt sem tud pár tucatnál többet, és a rate-limit vödör soha
> nem lesz a tényleges plafon."

> „A költség-oldal is zárt: az elszalasztott cache-találat pazarlása a TÁMADÓ SAJÁT előre fizetett
> keretéből megy, nem közös forrásból."

> „Miért INFO és nem LOW: a LOW-hoz valamilyen valós, ha kicsi is, biztonsági következmény kellene. Itt
> az egyetlen hatás egy csekély hatékonyság-veszteség, amit az okozójára terhelünk […]. A »43 200 sor/nap«
> szám — az egyetlen elem, ami LOW-nak láttatta — kb. három nagyságrenddel téves. Nem refuted, mert a
> mechanizmus leírása pontos."

**Szerkesztői döntés: INFO.** A verifikátor a finder egyetlen LOW-alapját számszerűen megdöntötte, a
tényállításokat viszont megerősítette. A megmaradó hatás (csekély, saját keretre terhelt
hatékonyság-veszteség) nem éri el a LOW-t. Ez összhangban van a szabállyal: a mechanizmus-leírás igaz,
tehát nem REFUTED, de forgatókönyv-szintű biztonsági hatás nélkül INFO.

---

## 2. CACHE-2 — finder LOW → **INFO** (lefokozva)

**Lelet:** nincs alkalmazás-oldali méret-plafon a megosztott cache-be tárolt AI-válaszra.

**Finder súlyozása (LOW), indoklása:** a `response` JSON kolumna méret-ellenőrzés nélkül íródik, a tábla
TTL/prune nélküli, és „a hízás felső korlátját nem a kód, hanem a Gemini-számla adja"; a bizonyíték a
MySQL JSON ~4 GB-os felső korlátjára hivatkozott mint „nem érdemi fék". A finder maga elismerte:
„Nincs konkrét user-kiváltott disk-DoS forgatókönyv a keret miatt, ezért LOW."

**Verifikátor verdiktje: nem cáfolt, de INFO.** Két premisszát döntött meg:

> „Mindhárom cache-író hívás KEMÉNYEN sémára kötött. […] A Gemini structured output fix kulcskészletre
> és fix arity-jű objektumokra kényszeríti a választ, a `maxOutputTokens` pedig 600/700/1000 (emelés után
> max 1500). Vagyis a sorméretnek VAN kód-szintű felső korlátja, kb. 4-6 KB — egy token-keret is
> méret-plafon, csak nem `strlen`-ként a beírásnál, hanem az upstream kérésben. A bizonyítékban szereplő
> »MySQL JSON = ~4 GB, nem érdemi fék« érv ezért félrevezető: több megabájtos sort itt semmi nem tud
> előállítani."

> „A kulcstér korlátos, és a CACHE-1-multiplikátor MÁR JAVÍTVA van. […] A hivatkozott CACHE-1
> fragmentálódás a `->lower()`-rel (`:1020` és `:1303`, a kommentek explicit CACHE-1-et említenek) le van
> zárva, így aktív hízás-multiplikátorként nem citálható."

> „Maga a lelet is elismeri, hogy nincs konkrét user-kiváltott disk-DoS forgatókönyv. A »forgatókönyv
> nélküli lelet nem lelet« szabály szerint ez INFO. A maradvány-kockázat […] nem új mechanizmus, hanem a
> már tudatosan vállalt AI-L3 sorszám-kockázat bájt/sor dimenziója."

**Szerkesztői döntés: INFO.** A finder saját szövegében is szerepelt a forgatókönyv-hiány elismerése —
a saját-munka-ellenőrzési szabály („ha egy lelet forgatókönyve nem konkrét bemenet→hatás út, fokozd
INFO-ra") itt közvetlenül alkalmazandó.

---

## 3. CB-2 — 2026-07-20-i **LOW** → mai **INFO** (korábbi verdikt lefokozása)

**Lelet:** a breaker 503-as válasza nem küld `Retry-After` fejlécet.

**Korábbi kör (2026-07-20) verdiktje:** LOW.

**Mai finder indoklása a lefokozásra:**

> „(a) végigellenőriztem, a frontendben egyetlen olyan kód sincs, ami `Retry-After`-t olvasna vagy 503-ra
> automatikusan újrapróbálna — a felhasználó a magyar hibaszöveget látja (»Próbáld újra pár perc múlva«),
> ami a szükséges információt EMBERI olvasónak megadja; (b) a breaker célja a worker-védelem, és a 503
> önmagában (HTTP-hívás és keret-terhelés nélkül, `GeminiOutageTest.php:56-64`) ezt teljes egészében
> ellátja; (c) forgatókönyv nélküli, tisztán protokoll-higiéniai hiányosság."

**A finder emellett KETTÉVÁLASZTOTTA a régi CB-2-t:** ugyanaz a hibaág (`aiFailureResponse` mapping)
két ÚJ leletet adott, amelyek a régi CB-2-ben nem voltak nevesítve:
- **CB-4 (LOW)** — a safety-blokk 502-t ad 422 helyett, mert nem állít `error_code`-ot.
- **CB-5 (INFO)** — ugyanaz az ág `cost_micros => 0`-t jelent, miközben a `settle()` a valós költséget
  felterhelte.

**Szerkesztői döntés: CB-2 → INFO, és a LOW súly áthelyezve CB-4-re.** A régi CB-2 LOW-ja tehát nem
„eltűnt", hanem a pontosabb kód-olvasás a valós hordozójára (CB-4) került át. A `Retry-After` hiánya
önmagában — olvasó kliens nélkül — nem forgatókönyv.

---

## 4. AI-M1 (breaker flapping) — korábbi **MEDIUM** → mai **INFO** (korábbi verdikt lefokozása)

**Lelet:** a `2478`-as `Cache::forget(GEMINI_BREAKER_FAILURES_CACHE_KEY)` egyetlen sikerre nullázza a
kudarc-számlálót, ezért 4-siker/4-kudarc arányú flappingnél a breaker (küszöb 5 egymást követő) nem
nyílik ki.

**Korábbi kör (2026-07-18/19) verdiktje:** MEDIUM.

**Mai finder indoklása a lefokozásra:**

> „A viselkedés valós […] — ezt a `GeminiOutageTest.php:67` (»sikeres válasz nullázza a breaker
> kudarc-számlálóját«, 4 kérés / 10 hívás) SZÁNDÉKOSKÉNT rögzíti. De nem MEDIUM: (a) a kód 2211-2235-ben
> dokumentáltan vállalt LOW-ként kezeli, indoklással és az elvetett alternatíva (csúszóablakos
> hibaarány-breaker) kockázat-elemzésével; (b) a maradvány-kockázat lassulás, nem kiesés, mert a
> per-kérés deadline garantálja hogy worker SOSEM lóg 30s-nél tovább — vagyis épp a védett kockázat
> (worker-kimerülés) marad zárva; (c) a `Gemini full chain failure` error-log (2492) az
> `AlertAdminOfLoggedError`-on keresztül riasztja az admint. Forgatókönyv nélküli súlyosbítás nincs,
> ezért INFO."

**Szerkesztői döntés: INFO.** A (b) érv a döntő: a MEDIUM eredeti indoklása a worker-kimerülés
kockázatára épült, de a 30 másodperces per-kérés lánc-deadline (`config/services.php:59`, betartatva
`2319` + `2328-2341`, a próba-timeout `min(HTTP_TIMEOUT, $remaining)`-re vágva `2345`-ben) ezt a
kockázatot a breakertől függetlenül lezárja. A flapping tehát lassulást hoz, nem kiesést; és a
viselkedés kód-szintű indoklással + teszttel dokumentáltan vállalt.

---

## 5. Nem-vitatott, de rögzítendő verdikt-megerősítések

Ezek nem súlyosság-viták, de a korábbi körök állításait a mai kör önállóan újra-ellenőrizte:

| Korábbi verdikt | Mai ellenőrzés | Eredmény |
|---|---|---|
| **CB-1** — a breaker globális cache-kulcson él, de „nem támadó-triggerelhető" (2026-07-20, LOW) | A `sanitizeWordForPrompt` regex (811) + a `2385`-ös `break 2` flag nélküli kilépés + a `recordGeminiChainFailure()` `if ($sawTransientFailure)` feltétele (2499) végigolvasva | **MEGERŐSÍTVE** — végleges 4xx SOSEM növeli a számlálót |
| **CB-3** — stampede, „szándékosan nyitva" (AI-L2, `PLAN.md:153`) | `grep -rn "stampede\|single-flight" app/` → 0; a `remember()` 30-47. sora között nincs lock | **VÁLTOZATLANUL FENNÁLL** (LOW). Hiányosság: az `AiCacheService`-ben — az AI-L3-mal és AI-M1-gyel ellentétben — NINCS kód-szintű indoklás a vállalt döntésről |
| **AI-M2** — `wordInsight` cache-guard, javítva `95d6754`-ben | `$onlyRealWords` a helyén (1331) + átadva a `remember()`-nek (1341); a fix óta 3 érintő commit (`752e44c`, `1e81725`, `fbf4405`) egyike sem távolította el; 2 teszt őrzi | **FIX INTAKT** |
| **CACHE-1 fix** — 2026-07-20: „a flashcard/insight nem kisbetűsíti a promptba küldött szót" | `1020`, `1303`, `1382` mind `->trim()->lower()`; vendor-szintű paritás igazolva (`Stringable::lower()` → `Str::lower()` → `mb_strtolower`); 2 őrszem-teszt (`AiCacheTest.php:218`, `:241`) | **JAVÍTVA, MIND A 3 ÁGON** |
| **„reserve/settle/refund egy kapun, atomikus"** (2026-07-20) | Mind az 5 hívó út `user`-t ad át; `reserve` = 1 atomikus feltételes UPDATE (`AiUsageService.php:50-52`); 6 kilépési ág mindegyike pontosan 1 `settle`/`refund`; a 4 friss commit egyike sem nyúlt a lánchoz | **MEGERŐSÍTVE, regresszió nincs** |
