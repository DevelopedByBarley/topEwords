# Dimenzió 3 — Free↔Pro átmenetek a limitkapuknál (TOCTOU/race)

> PLAN.md Fázis 2, 3. pont: *„Free↔Pro átmenetek minden limitkapunál (napi írás, flashcard-slot, AI-keret) — TOCTOU/race."*
> HEAD `527d205` · 2026-07-26 · CSAK DOKUMENTÁLÁS

## Limitkapuk tény-térképe

| Kapu (config kulcs) | Hol ellenőrződik | Atomikus? | Lock/számláló kulcs |
|---|---|---|---|
| `flashcards` (50/∞) | `User::reserveFlashcardSlots` `app/Models/User.php:313-331`; hívók `FlashcardCardController:50,98,167,246`, `FlashcardCsvController:92`, `ExtensionController:287` | **IGEN** — a `canAddFlashcards()` DB-count **és** az `$insert()` egyaránt a `block()` closure-jén BELÜL (`:322-329`) | `plan-limit:flashcards:{user_id}` — **per-user** ✅ |
| `decks` (5/∞) | `User::reserveFlashcardDeckSlot` `:352-366`; hívó `FlashcardDeckController:80` | **IGEN** — check+create a closure-ön belül (`:359-364`) | `plan-limit:decks:{user_id}` — **per-user** ✅ |
| `extension_writes_per_day` (20/∞) | `User::reserveExtensionWrite` `:398-422`; 8 hívóhely | **IGEN** — `Cache::add`+`Cache::increment` (nem check-then-act), **fail-closed** `$count === false`-ra (`:415`) | `extension_writes_daily_{id}_{Y-m-d}` — **per-user+nap** ✅ |
| `text_analyses_per_day` (2/50) | `TextAnalysisController::reserveDailyAnalysis` `:363-397` | **IGEN** — `add`+`increment`, fail-closed (`:382`) | `text_analysis_daily_{id}_{Y-m-d}` — **per-user+nap** ✅ |
| `books` (1/7) | `bookLimitError` `:764-781`, előszűrés `:1681` + **újra a lockon belül** `:1714-1715` | **IGEN** | `plan-limit:books:{user_id}` — **per-user** ✅ |
| `youtube_transcripts` (3/40) | `youtubeLimitError` `:1500-1509`, előszűrés `:1554` + **újra a lockon belül** `:1597-1598` | **IGEN** | `plan-limit:youtube:{user_id}` — **per-user** ✅ |
| `ai_budget_micros` (8000/500000) | `AiUsageService::reserve` `:36-61`, egyetlen hívóhely `TextAnalysisController:2298` | **IGEN** — egyetlen feltételes `UPDATE`: `where('ai_credits_used','<=',limit-estimate)->increment(...)` (`:50-52`) | nincs lock: **atomikus conditional UPDATE** (erősebb) ✅ |

Lock-szemantika **soronként** ellenőrizve: mindhárom `Cache::lock(...)->block(10)` esetben a limit-lekérdezés a closure-ön **BELÜL** van — nincs olyan minta, ahol a count kívül készülne. `CACHE_STORE=database` → a lock valódi, folyamatok közti DB-lock. `LockTimeoutException` minden webes hívóhelyen barátságos hibává fordul; az extension-úton a napi keret refundja után továbbdob (`ExtensionController:300-304`).

## Leletek

### LIM-1 — A Pro alatt felhalmozott, Free-limit fölötti állomány downgrade után korlátlanul használható
- **fájl:sor**: `app/Http/Controllers/FlashcardStudyController.php:23`; `FlashcardDeckController.php:25-29`; `FlashcardCsvController.php:128-130`; `TextAnalysisController.php:787-789,1528-1530`
- **súlyosság**: **LOW** (termék-viselkedés, nem exploit)
- **verifikációs verdikt**: **CONFIRMED** (LOW-ra egykörös; a mechanizmust saját ellenőrzéssel is visszamértem)
- **forgatókönyv (bemenet/időzítés → hatás)**:
  1. User előfizet Pro-ra (1990 Ft, 1 hónap).
  2. Feltölt ~10 000 flashcardot (CSV-import), 30 paklit, 7 könyvet, 40 YouTube-feliratot — Pro-n mind `null`/magas limit.
  3. Lemondja az előfizetést → Free-re esik.
  4. **Minden felvitt tartalom megmarad és teljes körűen olvasható/tanulható/exportálható**: a study-út csak `abort_unless($deck->user_id === …, 403)`-ot ellenőriz (`FlashcardStudyController:23`), a lista `get()`-tel mindent visszaad `take()` nélkül, a CSV-export a teljes paklit adja.
  5. → Nettó nyereség: **egyszeri 1990 Ft-ért örökös, ~200× Free-limit fölötti kártyaállomány** + 7 könyv + 40 felirat. A napi tanulási plafon (`max_reviews_per_day = 200`, `FlashcardSrsService:28`) **nem csomag-alapú**, tehát a Free user napi 200 review-t hajt a 10 000-es állományon.
- **szavazatok indoklása / miért LOW**:
  - A count-alapú kapuk `count() >= limit`, a kártya/pakli-kapuk `current + adding <= limit` szemantikát használnak (`User.php:288-292`) → **fail-closed a limit fölött is**: az over-limit Free user **be van fagyasztva**, nem tud újat felvinni, amíg nem töröl. *(Saját ellenőrzés: `isWithinPlanLimit` `:288-292` visszaellenőrizve.)* Ez megakadályozza a **további** felhalmozást.
  - Iparági standard „soft downgrade" termék-döntés — a törlés adatvesztés lenne, ami nagyobb üzleti/jogi kockázat.
  - A nyereség **self-only**, nincs cross-user hatás.
  - Pénzhatás korlátozott: a tárolt tartalom **nem generál ismétlődő szolgáltatói költséget** (olvasáskor nincs AI-hívás; a book/youtube overview a `reserveDailyAnalysis` napi keretén megy át, ami downgrade után már a Free 2/nap). A marginális költség puszta DB-tárhely.
- **⚠️ REGRESSZIÓ-JELZÉS**: a korábbi (2026-07-20) Fázis 2 újra-audit ezt a dimenziót **„teljesen tiszta (0 lelet)"**-ként zárta. Ez a lelet **nem regresszió a kódban** (a viselkedés vélhetően korábban is így volt), hanem a korábbi audit **lefedettségi hézaga**: az akkori kör a *write-oldali* TOCTOU-t vizsgálta, a *downgrade utáni read/retention* oldalt nem. Explicit korábbi-verdikt-megdöntés.

### LIM-2 — A napi/havi számlálók nem nullázódnak plan-váltáskor: keret-aszimmetria mindkét irányban
- **fájl:sor**: `app/Models/User.php:398-422,442-445`; `TextAnalysisController.php:352-354,363-397`; `AiUsageService.php:137-155`
- **súlyosság**: **LOW**
- **verifikációs verdikt**: **CONFIRMED**
- **forgatókönyv (A) — napi keretek, Free→Pro→Free ugyanazon a napon**:
  1. Free user elhasználja a napi 20 extension-írást és a napi 2 szövegelemzést.
  2. Előfizet Pro-ra → a `reserveExtensionWrite()` a `$limit === null` ágon (`:402`) **azonnal, számlálás nélkül** átengedi.
  3. Lemondás ugyanaznap → Free-re esik, a napi extension-számláló **továbbra is 20-on áll** (a Pro alatti írások nem növelték) → a Free keret marad kimerülve = **a user vesztesége**.
  4. **Fordítva viszont**: aki Free-n 0-t használt, Pro-n korlátlanul ír, majd downgrade-el, aznap **kap egy teljes friss Free 20-as keretet** → nettó nyereség: **napi max +20 extension-írás**.
- **forgatókönyv (B) — AI-keret hónap-határon**: az `ai_credits_used` csomag-független oszlop, a limit csomag-függő (`aiMonthlyLimit()` `:194-201`). Free (8000) → Pro (500 000): a `used` marad, azonnal ~492 000 használható (helyes, fizetett érte). Pro → Free `used=400 000` mellett: `reserve()` feltétele (`:51`) hamis → Free-n a hónap végéig **nulla AI** = ismét a user hátránya. Hónap-határon a `resetIfDue` (`:139`) nulláz → **nincs dupla keret**.
- **szavazatok indoklása / miért LOW**: a napi cache-kulcs `today()`-t használ, az `app.timezone` **fixen `UTC`** (`config/app.php:79`, nincs `.env` override) → a nap-határ **szerveroldali, NEM kliens-manipulálható** (nincs `X-Timezone`-jellegű bemenet a kulcsban); a hónap-határ ugyanígy szerveroldali. Az (A)-irányú +20 nyereség **pénzhatása nulla** (DB-insert, nincs szolgáltatói költség), és a kihasználásához valós Stripe-előfizetést kell venni-lemondani (1990 Ft) napi 20 írásért → **negatív ROI a támadónak**.

### RACE-1 — `refundExtensionWrite` / `refundDailyAnalysis` nem-atomikus check-then-decrement
- **fájl:sor**: `app/Models/User.php:429-440` (`:437` `if (Cache::get($key,0) > 0) { Cache::decrement($key); }`); azonos minta `TextAnalysisController.php:403-414`
- **súlyosság**: **LOW**
- **verifikációs verdikt**: **CONFIRMED**
- **forgatókönyv**:
  1. A refund `Cache::get` → `Cache::decrement` két külön művelet, közte ablak.
  2. Két párhuzamos, **még keretben lévő, de inserten bukó** kérés (pl. két egyidejű duplikátum-`addWord` → `UniqueConstraintViolationException`, `ExtensionController:196-197`) mindketten `1`-nél nagyobb értéket látnak és mindketten dekrementálnak.
  3. → A számláló alulszámol (elvben negatívba is csúszhat, a database store aláírt integert tárol) → **néhány extra napi írás-slot (±1-2)**.
- **szavazatok indoklása / miért LOW**: a `> 0` guard drasztikusan szűkíti az ablakot; a database store `decrement`-je maga atomikus SQL `UPDATE`, csak a **guard** nem atomikus vele. A **fő** kapu (`reserveExtensionWrite`) ezzel szemben helyesen atomikus (increment, majd a visszaadott értéken feltétel-ellenőrzés, `:409-419`) → a számláló **felfelé sosem téveszt**. A refund-út csak elrontott hibaágakon fut, azaz a támadónak DB-hibát/unique-ütközést kell **párhuzamosan** provokálnia. Nyereség self-only, **pénzhatás nulla**. A javítás (lock) a happy-path refundot lassítaná — költség/haszon alapján nem javasolt.

### INFO-1 — Trial: nem újra-igényelhető, és jelenleg kikapcsolt → **PLAN-feltevés MEGDŐLT**
- **fájl:sor**: `config/registration.php:16` (`subscription_trial_days` = **0**); `User::isEligibleForSubscriptionTrial()` `:238-241`; `PricingController.php:142`; `EndTrialNow.php:11,28-45`
- **súlyosság**: **INFO** (nincs lelet)
- A trial-ciklizálás **lezárt**: az `isEligibleForSubscriptionTrial()` a `subscriptions()->exists()`-re épül, és a Cashier a lemondott előfizetés sorát **megtartja** → lemondás+újra-előfizetés **nem** ad újabb próbaidőt. Emellett a config **0 nap**, tehát trial ma nem is indul. Az `EndTrialNow` **console-only** (nincs HTTP-felület), aktív előfizetést és `confirmToProceed`-et követel (`:45`), és a trialt csak **lejáratja** → támadói szempontból értéktelen. Az admin-adta ajándék-trial maradéka checkoutkor átvitelre kerül (`PricingController:150-152`) — admin-vezérelt út, nem self-grant.

## Ami TISZTÁNAK bizonyult

1. **TOCTOU minden kapunál — TISZTA.** Nincs egyetlen lock nélküli check-then-act minta sem. A lockos kapuknál a limit-lekérdezés **bizonyítottan a closure-ön belül**; a számláló-alapú kapuknál nincs is check-then-act (atomikus `add`+`increment`); az AI-keretnél egyetlen feltételes `UPDATE`. A `book`/`youtube` úton a drága művelet (felirat-letöltés, gzencode) **szándékosan a lock előtt** fut, a lock alatt csak re-check + insert — helyes lock-higiénia.
2. **A lock-kulcs helyessége — TISZTA.** Mind a 6 plan-limit lock/számláló kulcsa **per-user**. Nincs globális vagy per-erőforrás kulcs a limitkapuknál (az egyetlen per-erőforrás lock a `billingo:issue:{stripeInvoiceId}`, ami nem limitkapu) → két párhuzamos kérés ugyanattól a usertől **garantáltan ütközik**.
3. **AI-keret dupla-refund — CÁFOLVA.** A `callGemini` (`:2298-2503`) mind a négy kilépési ágán pontosan **egyszer** zárul (settle VAGY refund), `return` után nincs továbbfutás. Nem terhelt kredit nem refundolható: a `refund()` az `adjust()`-on át **nullára clamp-ol** atomikus `CASE WHEN`-nel (`:100-105`) → unsigned-underflow és negatív számláló kizárva (2 dedikált teszt). A blokkolt (SAFETY) válasz nem teljes refundot kap, hanem tényleges token-költséget (korábbi AI-L1 lezárva).
4. **`resetIfDue` mentése — TISZTA (korábbi bug lezárva).** Célzott `User::whereKey()->update()` (`AiUsageService:148-151`), nem `forceFill()->save()` → oda nem tartozó dirty mezők nem íródnak vissza; dedikált teszt védi.
5. **A limit MINDEN belépési ponton ott van — TISZTA.** A webes szó-felviteli route (`UserCustomWordController::store:31`) is a közös extension-keretbe számol, ha extension-originből jön → az `/extension/add-word` **nem kerülhető meg** a webes route-ra váltással. A player (Bearer-token) route-ok ugyanazokat a controller-metódusokat használják (`routes/api.php:50-59`), tehát ugyanazon a `reserveExtensionWrite`-on mennek át; a player AI-út ugyanazt a `callGemini`→`reserve()`-t. Az `updateImportance` új-szó ága is foglal (`:452`).
6. **Cache-hit AI-hívás nem foglal keretet — SZÁNDÉKOS, nulla pénzhatás.** Találatnál a generátor le sem fut (`AiCacheService:32-34`) → nincs `reserve()`, de nincs Gemini-hívás sem → nulla szolgáltatói költség. A kulcs user-független (`:70`), a keret célja a költség-korlátozás.
7. **Számláló-plafon `false`-ra fail-closed.** Mind a `reserveExtensionWrite` (`:415`), mind a `reserveDailyAnalysis` (`:382`) explicit `$count === false` ágat kezel (database store éjféli prune-ablak), 2 dedikált teszttel — enélkül az írás számlálatlanul átmenne.

## Összegzés

**0 HIGH · 0 MEDIUM · 3 LOW (LIM-1, LIM-2, RACE-1) · 1 INFO.**
Egyik LOW-nak sincs pénzhatása vagy cross-user hatása — mindhárom **self-only**.
**PLAN-feltevés MEGDŐLT kétszer:** (a) *„trial újra-igényelhető"* — a trial ki van kapcsolva (0 nap), és a `subscriptions()->exists()` zárja a ciklizálást; (b) *„dupla keret szerezhető plan-váltással"* — a számláló-megosztottság a **user hátrányára** működik mindkét fő irányban; az egyetlen nyereség-irány (Pro→Free ugyanaznap, +20 extension-írás) 1990 Ft-os belépővel negatív ROI.
