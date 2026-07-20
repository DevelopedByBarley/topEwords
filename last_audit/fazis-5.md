# Fázis 5 — Gamification & onboarding — audit

> Készült: 2026-07-19 · a go-live előtti utolsó, teljes lefedettségű audit gamification- és onboarding-köre.
> Fókusz: pont-/achievement-kiadás integritása és versenyhelyzetei (`AchievementService`, `UserAchievement`), valamint az onboarding-flow állapot-manipulációja (`OnboardingController`, `EnsureOnboardingComplete`) — átugorható lépéssor, lock-out, self-grant.
> Módszer: **multi-agent workflow** — 2 dimenzió-finder párhuzamosan (cáfolásra promptolva), majd minden HIGH/MEDIUM-gyanús leletre **3 független, cáfolásra promptolt adverzariális verifikátor** külön nézőpontból (reprodukció / korrektség-kontrollfolyam / súlyosság-blast-radius), LOW/INFO-ra egykörös. Séma-kényszerített leletformátum (fájl, sor, súlyosság, forgatókönyv, kód-bizonyíték, verifikációs verdikt). **Csak dokumentálás — kód nem módosult (audit-no-fixes).**
> Futás: 8 agent (2 finder + 6 verifikátor), 0 hiba. A DB (10 000 szó, 6 szint) live lekérdezéssel ellenőrizve.

## Lefedett dimenziók (2)

1. **achievements-race** — `AchievementService` (checkAndAward / checkAndAwardQuiz / checkAndAwardAnalysis / passes / isLevelComplete / `$memo`), `UserAchievement`, `AchievementController`, mind a 9 kiadási hívóhely (Cloze/Extension/FlashcardDeck/FlashcardStudy/Onboarding/Quiz/TextAnalysis/UserCustomWord/Word), unique-constraint, dupla-kiadás konkurrenciában, számláló-infláció, IDOR, memo-izoláció, threshold-korrektség.
2. **onboarding-flow** — `OnboardingController` (show + complete), `EnsureOnboardingComplete` middleware, route-regisztráció + guard-lefedettség, `user_word` upsert, self-grant, re-run/idempotencia, lock-out/redirect-loop, array-cap/DoS.

---

## Összegzés

| Súlyosság | Db | Valós (CONFIRMED/PARTIAL) leletek |
|---|---|---|
| **HIGH** | **0** | — |
| **MEDIUM** | **0** | — |
| **LOW** | **5** | ONB-1 · ACH-1 · ONB-2 · ONB-3 · ACH-2 |
| **INFO / CLEAN** | **6** | ACH-4 (memo) · ACH-5 (IDOR) · ACH-6 (threshold) · ACH-7 (index-authz) · ONB-6 (lock-out) · injection |
| **REFUTED / DOWNGRADE** | **2** | dupla-kiadás (unique+firstOrCreate cáfolta) · ACH-1/ONB-1 HIGH-címke (impact-verifikátorok LOW-ra húzták) |

**Go-live blokkoló: NINCS. Nulla HIGH, nulla MEDIUM.**

A finderek két leletet HIGH-nak jelöltek (ACH-1 quiz proof-of-work, ONB-1 vokabulár-self-grant); **mindkét HIGH megdőlt a verifikációban.** A mechanizmus mindkét esetben CONFIRMED (a hiba valós), de a súlyosságot a blast-radius-verifikátorok LOW-ra húzták: a hamisított állapot **kizárólag self-facing** — a kód-tények szerint semmilyen trust-boundaryt nem lép át (nincs leaderboard, nincs entitlement/pénz/kvóta a known-számon vagy achievementen, nincs cross-user olvasás).

### A három legfontosabb megállapítás

1. **A dupla-kiadás (a PLAN.md fő gamification-gyanúja) megdőlt.** A `user_achievements` táblán van `unique(user_id, achievement_key)` (migráció), és a Laravel 13 `firstOrCreate`→`createOrFirst` **race-safe**: a `UniqueConstraintViolationException`-t elkapja és újra-SELECT-el, a vesztes versenyző `wasRecentlyCreated = false`-t kap → nincs duplikált sor, nincs dupla pont, a `$newlyUnlocked` sem kap dupla tételt. A `QuizTest.php:151-162` teszt is rögzíti a dedup-ot.

2. **A gamification integritás-hiányossága valós, de csak self-only:** sem a quiz-completion (ACH-1), sem az onboarding-vokabulár (ONB-1) végpont nem verifikál szerver-oldali „proof-of-work"-öt. Mindkettő durva állapotot ír (`quiz_completions` / `quiz_perfect` badge, ill. ~10 000 szó `status='known'`), de mindkettő a hívó **saját** fiókjának kozmetikáját/haladási számait rontja. A `known` állapotot ráadásul a normál szólista-toggle-lel amúgy is el lehet érni — az ONB-1 lényegében „hazudás a saját önértékelésnek".

3. **A memoizáció, IDOR, threshold-logika, index-authz és az onboarding-gate routing mind tiszta.** Az `AchievementService` nincs singletonként bindolva (per-request friss példány), a memo user-id-kulcsos; minden kiadás `$request->user()`-en dolgozik; az `isLevelComplete` üres-tábla-guardja helyes; a gate GET+POST onboarding kimarad a middleware alól (nincs redirect-loop, a védett route-ok mind auth+verified+gate).

---

## Összegző tábla (CONFIRMED / PARTIAL leletek)

| id | súlyosság | cím | fájl:sor | verdikt (szavazat) |
|---|---|---|---|---|
| ONB-1 | **LOW** | Onboarding self-grant: 1 POST ~10 000 szót `known`-ra állít + minden vocab/known/level achievementet felold | [OnboardingController.php:64](../app/Http/Controllers/OnboardingController.php#L64) | CONFIRMED (mechanizmus 3/3; súly: 1 MED + 2 LOW → LOW) |
| ACH-1 | **LOW** | `words/quiz/complete`: nulla proof-of-work; `quiz_perfect` teljesen kliens-állított | [QuizController.php:19](../app/Http/Controllers/QuizController.php#L19) | CONFIRMED (mechanizmus 3/3; súly: impact-verifikátorok LOW/INFO) |
| ONB-2 | **LOW** | Nincs `max:` array-sapka és nincs throttle az `onboarding.complete`-en | [OnboardingController.php:51](../app/Http/Controllers/OnboardingController.php#L51) | PARTIAL (`max_input_vars=1000` cáfolja az 50k-vektort) |
| ONB-3 | **LOW** | `complete()` befejezett usernél is újra-futtatható (nincs „csak-amíg-incomplete" guard) | [OnboardingController.php:104](../app/Http/Controllers/OnboardingController.php#L104) | CONFIRMED (de ONB-1 amplifikátora, nem önálló) |
| ACH-2 | **LOW** | `text_analyses` + `analysis_comprehension_90` bemenet-választással gyorsítható | [TextAnalysisController.php:336](../app/Http/Controllers/TextAnalysisController.php#L336) | PARTIAL (server-computed + napi 2/50 sapka + egyszeri badge) |

### INFO / CLEAN kategóriák (rögzítés teljesség kedvéért)

| id | kategória | eredmény | fájl:sor |
|---|---|---|---|
| ACH-3 | firstOrCreate race | Nincs dupla-kiadás; csak elméleti 500 a `?? throw $e` ágon (replica-visibility edge, single-DB-n nem éri el) | `vendor/.../Builder.php:733` |
| ACH-4 | memo-izoláció | **CLEAN** — service nincs singleton (grep: csak `BillingoClient`+`RegisterResponseContract` az); memo user-id-kulcsos | [AchievementService.php:173](../app/Services/AchievementService.php#L173) |
| ACH-5 | IDOR / kié a számla | **CLEAN** — minden kiadás `$request->user()`; nincs request-supplied áldozat-id | [AchievementService.php:77](../app/Services/AchievementService.php#L77) |
| ACH-6 | threshold-korrektség | **CLEAN** — `isLevelComplete` üres-tábla-guard (total===0 → false); `>=` helyes; `quiz_perfect`/`comp_90` passes()=false | [AchievementService.php:239](../app/Services/AchievementService.php#L239) |
| ACH-7 | index-authz | **CLEAN** — csak a saját `achievements()`; nincs cross-user unlock-idő szivárgás | [AchievementController.php:16](../app/Http/Controllers/AchievementController.php#L16) |
| ONB-6 | lock-out / routing | **CLEAN** — GET+POST onboarding kimarad a gate alól (nincs loop); védett route-ok mind auth+verified+gate | [web.php:65](../routes/web.php#L65) |
| — | SQL-injection / enumeráció | **CLEAN** — `exists:words,id` + bound `whereIn`, integer-validált id-k | [OnboardingController.php:65](../app/Http/Controllers/OnboardingController.php#L65) |

---

## Leletenkénti részletezés

### ONB-1 — LOW — Onboarding vokabulár-self-grant (~10 000 szó egy POST-tal)
**Fájl:** [OnboardingController.php:64-106](../app/Http/Controllers/OnboardingController.php#L64) · **Verdikt:** CONFIRMED (mechanizmus), súly **LOW** (1× MEDIUM-exploit + 2× LOW/INTENDED-UX szavazat)

**Forgatókönyv:** A kliens teljesen kontrollálja mindkét tömböt; a validáció csak `integer` + `exists:words,id` (`:51-56`). Preparált POST: `shown_word_ids=[A]` (A egy 1. szintű szó), `known_word_ids=[A]`. Ekkor a szintre `shownCount=1`, `knownCount=1`, `ratio=1.0` (`:71`), `markCount=round(1.0 * totalInLevel)` = a **teljes szint** (`:77-78`), és a top-`markCount` szó `rank` szerint `status='known'`-ra kerül upsertelve (`:81-101`). Szintenként egy-egy id-t betéve (6 id `shown`-ban és `known`-ban is) **egyetlen ~2 KB POST mind a 9 999 szót `known`-ra állítja** (a DB live lekérdezés szerint 1000+1000+2000+1999+2006+1995 = 9 999, ranks 1–9995). Ezután a `checkAndAward($user, ['vocab','known','level'])` (`:106`) feloldja az összes `vocab_*`, `known_*` és mind a 6 `level_N_complete` achievementet.

**Kód-bizonyíték:**
- `:71` `$ratio = $shownCount > 0 ? $knownCount / $shownCount : 0;` — nincs sapka.
- `:77-78` `$totalInLevel = Word::where('level', $level)->count(); $markCount = (int) round($ratio * $totalInLevel);` — nincs clamp/min/max.
- `:81-101` top-`markCount` `rank` szerint → `upsert($rows, ['user_id','word_id'], ['status','reviewed_at','updated_at'])`, `status='known'`.
- `AchievementService.php:181-185` `totalKnownWords` és `:239-255` `isLevelComplete` pontosan a `user_word` `status='known'` sorokat számolja → a friss upsert azonnal kielégíti `known_1000`-et és mind a 6 szintet.
- **A `show()` nem perzisztálja a mintát:** `:31-39` `inRandomOrder()->take(20)`, de az id-k sehová nem íródnak (nincs session/cache/DB/signed token). A `complete()` a `shownIds`-t magából a request-ből olvassa (`:65`), így a szerver definíció szerint nem tudja verifikálni a mintát.

**Miért csak LOW (a HIGH-címke megdőlt):**
- **Az „exploit" POST byte-azonos a normál UI által küldöttel** (`resources/js/pages/onboarding/index.tsx:441-442` `router.visit(..., method:'post')` ugyanezt a `{known_word_ids, shown_word_ids}`-t küldi). Az önértékelés-alapú vokabulár-jelölés **szándékos UX**.
- **A `known` állapot reverzibilis** (normál szólista-toggle, `TogglesWordStatus`), nem zár ki semmiből, a flashcard-study deck-alapú (nem törik el), tehát funkcionálisan sem okoz kárt.
- **Blast-radius self-only:** minden `status='known'` olvasó self-scoped (DashboardController own stats, WordController own per-level count, AchievementService own badges, TextAnalysisController own comprehension render). Az AI-kvóta **plan-alapú** (`planLimit('text_analyses_per_day')`), NEM known-alapú → a felfújás nulla extra kvótát/pénzt ad. Nincs user-facing leaderboard, nincs `can()`/plan-gate `level_*_complete`/`known_1000`-en.
- A kódbázis saját rubrikája (Fázis 4: HIGH = cross-user / RCE / adat-hozzáférés / pénz; 0 HIGH kiadva) szerint a self-only integritás-hiba LOW.

**Egyetlen cross-scope mellékhatás (residual):** az admin `mostActive` ranking (`AdminController.php:39` `withCount('knownWords')`) és a `known` aggregát (`:95`) torzul — belső metrika-kozmetika, nem adat-hozzáférés. **Latens kockázat:** ha valaha lesz publikus leaderboard, „words known"-ra kötött fizetős tier, vagy exportált credential, a tartós felfújt állapot azonnal valós integritás/entitlement-vektorrá válik. Ajánlott (nem blokkoló) hardening: a `show()` mintáját szerver-oldalon perzisztálni és a `complete()`-ben validálni, ill. a `markCount`-ot a tényleges mintára korlátozni.

---

### ACH-1 — LOW — `words/quiz/complete`: nulla proof-of-work, kliens-állított `quiz_perfect`
**Fájl:** [QuizController.php:11-23](../app/Http/Controllers/QuizController.php#L11) · **Verdikt:** CONFIRMED (mechanizmus 3/3), súly **LOW** (2 verifikátor LOW/INFO, 1 feltételes-HIGH ami maga is impact-híján LOW-ra jön ki)

**Forgatókönyv:** A `POST words/quiz/complete` egyetlen bemenete a `perfect` boolean (`:13` `$request->validate(['perfect' => ['boolean']])`). Nincs szerver-oldali kvíz-állapot (nincs Quiz-tábla/modell/migráció, nincs pending-attempt/nonce/signed token — grep tiszta; a `WordController::quiz` GET tisztán read, a helyes választ a böngészőnek küldi, a pontszám sosem jut a szerverre). A `checkAndAwardQuiz` (`AchievementService.php:194`) minden POST-nál feltétel nélkül `increment('quiz_completions')`-t hív, majd `refresh()` után (`:195`) ellenőrzi a `quiz_first/10/50` küszöböket. A `quiz_perfect` a `passes()`-ben `false` (`:148`), és **kizárólag a kliens `$perfect` flagből** kerül kiadásra (`:199-208`). Egy szkriptelt `{"perfect": true}` POST-hurok ~2 mp alatt feloldja mind a 4 quiz-badge-et és tetszőlegesen felfújja a számlálót. Egyetlen fék: `throttle:30,1,words-quiz` (`routes/words.php:41`).

**Kód-bizonyíték:** `QuizController.php:13,19`; `AchievementService.php:194-195,148,199-208`; `routes/words.php:41`. A `firstOrCreate` (`:200`) idempotens (nincs dupla sor), de nem akadályozza a farmot nulla valós kvízből.

**Miért csak LOW (a HIGH-címke megdőlt):** a `quiz_completions` **összes** olvasója self-scoped (grep az app/ + resources/js/ felett): csak a `passes()` küszöbök (`:145-147`) és a `Fillable`-lista (`User.php:30`). Nem gate-el feature-t, kvótát, billinget, AI-kreditet; nincs leaderboard, nincs cross-user achievement-nézet (`AchievementController` csak `$request->user()->achievements()`, az `achievements` Inertia-prop session-flash — `HandleInertiaRequests.php:70`). Az admin-nézet nem olvassa. A kliens-pontozású SPA-kvíznél a proof-of-work szerver-oldali kikényszerítése feature-újratervezés (per-kérdés submit persisted attempt ellen), nem puszta security-fix. **Latens:** ha valaha lesz leaderboard/reward/„verified learner", ez azonnal MEDIUM+ fraud-vektor, változtatás nélkül.

---

### ONB-2 — LOW — Nincs array-méret-sapka és nincs throttle az `onboarding.complete`-en
**Fájl:** [OnboardingController.php:51-56](../app/Http/Controllers/OnboardingController.php#L51) · **Verdikt:** PARTIAL

**Forgatókönyv:** Egyik tömbön sincs `max:` szabály, és az onboarding a **kizárólagos** mutáló POST-csoport throttle nélkül (`web.php:65-68`; minden más write-route — words/extension/settings/api — kap explicit throttle-t). Emiatt egy hitelesített user friction nélkül hammerelheti. Külön részlet: az `exists:words,id` `.*` szabály **elemenként külön** `SELECT ... WHERE id=? LIMIT 1`-et futtat (nem batchelt `whereIn`), tehát N pont-lekérdezés.

**Miért PARTIAL/LOW (az 50k-vektor cáfolva):** a `public/.user.ini` `post_max_size=35M`, de **nincs `max_input_vars`** → a PHP default **1000** érvényes, ami form-encoded (Inertia `router.visit` post) bodyt csendben ~1000 változóra vág, mielőtt a Laravel látná. A downstream munka korpusz-sapkás (`Word::whereIn`, groupBy/filter, per-level `take($markCount)`, `upsert` `->unique()` + composite PK ~10k soron). ~1000 elemnél ~2000 indexelt PK point-query — nehézkés, de nem katasztrofális, session-auth mögött. **Residual:** raw JSON body (`Content-Type: application/json`) esetén a `max_input_vars` NEM érvényes → a nagy-tömb vektor visszaáll; a hiányzó throttle + per-elem N-query mellett fenntartott DB/CPU-terhelés. A `max:` + `throttle` a `:65-66`-ra mindkettőt zárná. Bounded, hitelesített, nincs adat-integritás-hatás → LOW.

---

### ONB-3 — LOW — `complete()` befejezett usernél is újra-futtatható
**Fájl:** [OnboardingController.php:49-114](../app/Http/Controllers/OnboardingController.php#L49) · **Verdikt:** CONFIRMED (tényként), LOW (önállóan)

**Forgatókönyv:** A `complete()` sehol nem ellenőrzi az `onboarding_completed_at`-ot; feltétel nélkül upsertel (`:101`), felülírja a timestampet (`:104`), újra-futtatja a `checkAndAward`-ot (`:106`). Az onboarding POST csak `['auth','verified']` mögött van (`web.php:65-66`), **NEM** az `EnsureOnboardingComplete` alatt (helyesen — az csak az incomplete usert tereli be, `:16` `=== null`), így egy befejezett user is eléri.

**Miért LOW / nem önálló:** a re-run idempotens — az achievementek `firstOrCreate` + unique-constraint miatt nem duplikálódnak, az upsert ugyanazokat a sorokat írja, csak a timestamp mozdul (kozmetika). Az egyetlen valódi hatás, hogy **az ONB-1 self-grant tartósan (onboarding után is) elérhető marad** → inkább az ONB-1 reachability-feltétele, mint különálló lelet. Egy `onboarding_completed_at !== null` korai-return guard (`:50`) egyszerre zárná ezt és az ONB-1 folyamatos elérhetőségét.

---

### ACH-2 — LOW — `text_analyses` + `analysis_comprehension_90` bemenet-választással gyorsítható
**Fájl:** [TextAnalysisController.php:336](../app/Http/Controllers/TextAnalysisController.php#L336) · **Verdikt:** PARTIAL (a MEDIUM-gyanú alá húzva)

**Forgatókönyv:** A `checkAndAwardAnalysis` (`AchievementService.php:220-223`) feltétel nélkül `increment('text_analyses')`-t hív, és a `comprehension >= 90` ágon (`:225-234`, `passes()`=false-t megkerülve, `quiz_perfect`-tel strukturálisan azonos) kiadja az `analysis_comprehension_90`-et. Már `known`-ra jelölt szavakból álló triviális szöveggel a comprehension 100% lesz.

**Miért LOW (a MEDIUM-gyanú alatt):** **döntő aszimmetria a quizhez képest** — a comprehension NEM kliens-állított, hanem szerver-számolt: `TextAnalysisController.php:651` `(int) round(($knownTokenCount / $totalTokenCount) * 100)`, ahol `knownTokenCount` csak a DB szerint `status='known'` tokeneket összegzi (`:545-546,556-557`). Kliens nem tud 90%-ot állítani, csak már-ismert szavakból álló szöveget adni — ami legitim. Napi **hard sapka**: `text_analyses_per_day` = 2 (free) / 50 (premium) (`config/plans.php:27,38`), atomi `Cache::increment`, fail-closed; a refund csak kivételkor (`:403-414`), sikeres triviális elemzés fogyaszt kvótát. Mindhárom érintett achievement egyszeri (`firstOrCreate`) → a „farm" értelmetlen. **Kereszthivatkozás ONB-1-gyel:** mivel a comprehension a `status='known'` arányból számol, az ONB-1-gyel felfújt known-állapot közvetve megemeli a comprehension%-ot is — de ez ugyanaz a self-only gyökér.

---

## Kereszthivatkozások és megjegyzések

- **ONB-1 ⇄ ONB-3 ⇄ ACH-2 közös gyökér:** mindhárom a szerver-oldali „proof-of-work" hiányából ered. Egyetlen döntés (a `show()` mintájának perzisztálása + `complete()` validáció + `markCount`-clamp + `onboarding_completed_at` guard) egyszerre zárja az ONB-1 self-grantot, az ONB-3 reachability-t és az ACH-2 közvetett comprehension-emelést.
- **ACH-1 és a Q-L3 memória-jegyzet:** a korábban „dupla-kiadás konkurrenciában" néven rögzített kockázat (`Q-L3`) a verifikációban **megdőlt** (unique + race-safe `firstOrCreate`). A valós, cáfolatlan gamification-rés a proof-of-work hiánya (ACH-1), nem a race.
- **A Fázis 4 mintája megismétlődött:** a finderek által HIGH-nak jelölt leletek a blast-radius-vizsgálatban LOW-ra estek; a kódbázis továbbra sem tartalmaz cross-user / adat-hozzáférési / pénz-hatású gamification- vagy onboarding-defektust.
- **Backup-másolatok:** a `backup/before-jobs/` és `backup/before billing/` alatt azonos fájlpéldányok vannak; ezek nincsenek route-olva, a leletek csak a live kódra vonatkoznak.

## Javasolt sorrend (ha lesz javítási kör)

1. **ONB-1 + ONB-3 együtt** (LOW) — egy `onboarding_completed_at !== null` korai-return guard a `complete()`-ben + a `markCount` clamp a ténylegesen mutatott/kipipált mintára (opcionálisan a `show()` mintájának session/signed-token perzisztálása). Ez zárja a tartós self-grantot és az admin-metrika torzulását is; a leginkább „valódi" a leletek közül, mert tartós DB-állapotot ír.
2. **ONB-2** (LOW) — `max:` array-sapka (pl. `max:200`) + `throttle` az `onboarding.complete`-re; egyben zárja a JSON-body-bypass residualt.
3. **ACH-1** (LOW) — csak akkor sürgős, ha az achievement/`quiz_completions` valaha trust-bearing lesz (leaderboard/reward). Addig a proof-of-work kikényszerítése feature-döntés.
4. **ACH-2** (LOW) — konzisztencia; a server-computed comprehension miatt legkevésbé sürgős.

---

## Fázis 5 lezárva

| Terv-pont (PLAN.md) | Eredmény |
|---|---|
| Achievement/pont-kiadás race-ei (dupla-kiadás, unique-constraint) | ✅ **A fő gyanú (dupla-kiadás) megdőlt** — unique + race-safe `firstOrCreate` (ACH-3/ACH-4/ACH-5/ACH-6 CLEAN) |
| Számláló-infláció / free-increment (Q-L3) | ✅ Auditálva — **1 LOW** (ACH-1 quiz proof-of-work, self-only); ACH-2 LOW (server-computed, capped) |
| Onboarding state-manipuláció (átugorható lépéssor) | ✅ Auditálva — **1 LOW** (ONB-1 self-grant, self-only, reverzibilis, INTENDED-UX-közeli) |
| Onboarding lock-out / védett route onboarding nélkül | ✅ **Tiszta** (ONB-6) — nincs redirect-loop, GET+POST onboarding gate-mentes, védett route-ok mind gate mögött |
| Re-run / idempotencia + DoS | ✅ Auditálva — ONB-3 (re-run, LOW) + ONB-2 (array-cap/throttle, LOW, `max_input_vars` tompítja) |

**Fázis 6–8 nem indult** — jóváhagyásra vár.
