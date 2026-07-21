# Fázis 5 — Dimenzió A: Gamification & achievement-kiadás

> Független finder + adverzariális verifikáció. Csak dokumentálás.
> Scope: `AchievementService`, `UserAchievement`, `AchievementController`, migráció, 10 hívóhely.

---

### [ACH-1] `quiz_perfect` achievement teljesen kliens-vezérelt `perfect` flagből
- **Fájl:sor:** app/Http/Controllers/QuizController.php:13,19 → app/Services/AchievementService.php:199-208
- **Súlyosság:** LOW
- **Kategória:** self-grant
- **Forgatókönyv:** A `POST /words/quiz/complete` a `perfect` mezőt `$request->boolean('perfect')`-ként veszi (validáció: csak `boolean`). A szerver semmilyen kiszolgálóoldali bizonyítékot nem tart a kvíz-válaszokról — a `complete` endpoint nem kap válasz-payloadot, csak a `perfect` bitet. Egy user `curl`-lel `{"perfect":true}`-t POST-olva megszerzi a `⭐ Tökéletes kvíz` badge-et anélkül, hogy egyetlen kérdést is jól válaszolt volna.
- **Blast radius:** Tisztán kozmetikai, self-only. A badge nem old fel entitlementet, nincs leaderboard/XP/kredit/pénz/kvóta. Az egész `app/` + `resources/js`: 0 reward-wiring.
- **Verifikációs verdikt:** CONFIRMED (self-grant technikailag működik), súlyosság LOW. Cáfoló-kör: (1) blast radius = self-only kozmetika → nem MEDIUM; (2) auth+verified+onboarding+throttle mögött van; (3) a badge egy valódi tökéletes kvízzel amúgy is triviálisan megszerezhető. A `analysis_comprehension_90` NEM ilyen: az érthetőséget a szerver számolja (knownTokenCount/totalTokenCount), nem kliens-input.

---

### [ACH-2] Számláló-alapú achievementek endpoint-replay-jel farmolhatók (`quiz_*`)
- **Fájl:sor:** app/Services/AchievementService.php:194,220 (increment); passes() `quiz_completions`/`text_analyses` ágak (145-153)
- **Súlyosság:** LOW
- **Kategória:** self-grant / threshold-manipuláció
- **Forgatókönyv:** `checkAndAwardQuiz` minden híváskor `increment('quiz_completions')`-t futtat, függetlenül attól, hogy valódi kvíz zajlott-e. A `complete` endpoint puszta replay-jelése feltornászza a `quiz_completions`-t → `quiz_first/10/50` megszerezhető valódi kvízkitöltés nélkül. A `text_analyses`-re elvileg áll, DE ott az `analyze` valódi AI-elemzést és napi kvóta-fogyasztást igényel — nem "ingyenes" replay.
- **Blast radius:** Kozmetikai, self-only. A `quiz_completions` oszlop máshol nem entitlementez (saját kézzel megerősítve: csak passes()+increment olvassa).
- **Verifikációs verdikt:** CONFIRMED, LOW. Cáfoló-kör: a threshold-achievementek megbízhatóbb forrásai (`vocab_*`, `known_*`, `level_*`, `custom_*`) valódi DB-count-ból számolnak (totalMarkedWords, isLevelComplete, customWords()->count()), nem manipulálható counterből. Csak a `quiz_*`/`analysis_*` counter-alapú, és self-only kozmetika.

---

### [ACH-3] Dupla-kiadás / konkurens race — VÉDETT
- **Fájl:sor:** app/Services/AchievementService.php:95-102,200-207,226-233; migráció :19
- **Súlyosság:** INFO (nincs seb)
- **Kategória:** race
- **Forgatókönyv (cáfolt):** Két párhuzamos POST ugyanarra a küszöbre elméletileg kétszer szúrhatna be. A valóságban minden beszúrás `UserAchievement::firstOrCreate(['user_id','achievement_key'], ...)`, és a `(user_id, achievement_key)` **unique constraint** megvan (migráció :19; élő DB-index néven is megerősítve). Konkurens duplikátumnál a második INSERT ütközik, de a firstOrCreate visszaolvassa a meglévőt → `wasRecentlyCreated` csak egy ágon true → a `$newlyUnlocked` sem duplikálódik.
- **Blast radius:** Nincs.
- **Verifikációs verdikt:** REFUTED. A tábla-szintű unique + firstOrCreate + a jutalom teljes hiánya háromszorosan zárja.

---

### [ACH-4] Cross-user / IDOR — VÉDETT
- **Fájl:sor:** app/Http/Controllers/AchievementController.php:14-18; minden hívóhely `$request->user()`-t ad át
- **Súlyosság:** INFO (nincs seb)
- **Kategória:** idor
- **Forgatókönyv (cáfolt):** Nincs olyan végpont, ami user-ID-t fogadna achievement-írásra. Mind a 10 `checkAndAward*` a hitelesített `$request->user()`-re megy. Az `AchievementController@index` szintén csak `$request->user()->achievements()`-et olvassa. Nincs tömeges/admin achievement-adó út.
- **Blast radius:** Nincs.
- **Verifikációs verdikt:** REFUTED. A user mindig a session-identitásból jön, nincs támadó-vezérelt user-referencia.

---

### [ACH-5] `onboarding.complete` self-grant (vocab/known/level badge-ek)
- **Fájl:sor:** app/Http/Controllers/OnboardingController.php:80-106
- **Súlyosság:** LOW
- **Kategória:** self-grant / correctness
- **Forgatókönyv:** Az onboarding során a user megadott szintje alapján a rendszer akár több ezer szót `known`-ra jelöl (`user_word` upsert), majd `checkAndAward(['vocab','known','level'])`-t futtat. A legmagasabb szintet választva egyszerre kaphatja a `vocab_*`, `known_*` és `level_*_complete` badge-eket, valós tanulás nélkül — a jelölés önbevallásból fakad. (Ez ugyanaz a mechanizmus, mint az ONB-1; egy leletként számolandó.)
- **Blast radius:** Kozmetikai, self-only. A tömeges `known`-jelölés a saját statisztikát torzítja, badge-t old fel, de semmilyen külső értéket nem.
- **Verifikációs verdikt:** CONFIRMED, LOW. Cáfoló-kör: (1) az onboarding-szint önbevallás by-design; (2) user-enként egyszer fut (`onboarding_completed_at` guard); (3) a badge-eknek nincs downstream értéke.

---

### [ACH-6] `checkAndAwardQuiz`/`Analysis` increment + refresh — kettős lekérdezés
- **Fájl:sor:** app/Services/AchievementService.php:194-195,220-221
- **Súlyosság:** INFO
- **Kategória:** correctness / performance
- **Forgatókönyv:** `$user->increment(...)` majd `$user->refresh()` — az increment már frissíti az adott oszlopot, a `refresh()` egy plusz teljes-sor SELECT. A count-query-k `$memo`-val request-scope memoizáltak (nem N+1). Nem hiba, csak enyhén pazarló.
- **Blast radius:** Elhanyagolható.
- **Verifikációs verdikt:** INFO — nincs korrektségi hiba. A `$memo` kulcs `user->id`-vel prefixált, más userre nem szivárog.

---

## Összegzés (Dim A)

| ID | Súlyosság | Verdikt |
|---|---|---|
| ACH-1 quiz_perfect kliens-flag | LOW | CONFIRMED |
| ACH-2 counter-replay farm | LOW | CONFIRMED |
| ACH-3 dupla-kiadás / race | INFO | REFUTED |
| ACH-4 cross-user / IDOR | INFO | REFUTED |
| ACH-5 onboarding self-grant | LOW | CONFIRMED |
| ACH-6 increment+refresh | INFO | INFO |

**0 HIGH · 0 MEDIUM · 3 LOW · 3 INFO.** A gamification-felület tiszta: a dupla-kiadás és IDOR — a két legkockázatosabb vektor — háromszorosan zárt. A LOW-k mind self-only kozmetikára futnak ki (0 reward-wiring az egész kódbázisban).
