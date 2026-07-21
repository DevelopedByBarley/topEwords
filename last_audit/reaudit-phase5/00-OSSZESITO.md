# Független újra-audit — Fázis 5: Gamification & Onboarding

> Készült: 2026-07-20 · a `last_audit/PLAN.md` **CSAK Fázis 5** része.
> **Független** újra-audit: kizárólag a PLAN.md-t olvastam, a korábbi audit-riportokat (last_audit/fazis-5.md és a memória-tételek) **szándékosan figyelmen kívül hagytam**, hogy az eredmény összevethető legyen.
> **Csak dokumentálás** — semmilyen kódot, tesztet nem módosítottam (audit-no-fixes szabály).
> **Mód:** multi-agent workflow — 2 párhuzamos, dimenziónkénti finder (cáfolásra promptolt adverzariális verifikációval), + a fő-fájlok és a reward-wiring saját, független kézi ellenőrzése.

## Scope (PLAN.md Fázis 5)

1. **Gamification** — `AchievementService`, `UserAchievement`: dupla-kiadás konkurens kérésnél, unique-constraint megléte.
2. **Onboarding flow** — `OnboardingController`, `EnsureOnboardingComplete`: lépés-átugrás, state-manipuláció, védett route onboarding nélkül / fordított lock-out.

## Vizsgált élő kód-felület

| Fájl | Szerep |
|---|---|
| app/Services/AchievementService.php | achievement-logika (checkAndAward*, ACHIEVEMENTS, passes) |
| app/Models/UserAchievement.php | achievement-modell |
| app/Http/Controllers/AchievementController.php | achievements/index (read-only) |
| database/migrations/2026_04_07_184656_create_user_achievements_table.php | tábla + unique constraint |
| app/Http/Controllers/OnboardingController.php | onboarding show + complete |
| app/Http/Middleware/EnsureOnboardingComplete.php | onboarding-gate middleware |
| database/migrations/2026_04_09_115430_add_onboarding_completed_at_to_users_table.php | onboarding_completed_at oszlop |
| 10 checkAndAward* hívóhely | Word/UserCustomWord/Extension/Quiz/FlashcardDeck/FlashcardStudy/Cloze/TextAnalysis/Onboarding controllerek |

---

## Eredmény — összegzés

**0 HIGH · 0 MEDIUM · 5 LOW · 6 INFO · 0 go-live blokkoló.**

| ID | Dimenzió | Súlyosság | Kategória | Verdikt |
|---|---|---|---|---|
| ACH-1 | Gamification | LOW | self-grant | CONFIRMED — mechanizmus valós, blast radius nulla |
| ACH-2 | Gamification | LOW | self-grant | CONFIRMED — counter-replay farm, self-only kozmetika |
| ACH-3 | Gamification | INFO | race | **REFUTED** — unique constraint + firstOrCreate + nincs jutalom |
| ACH-4 | Gamification | INFO | idor | **REFUTED** — minden írás session-identitásra megy |
| ACH-5 | Gamification | LOW | self-grant | CONFIRMED — onboarding-eredetű badge, nulla blast radius |
| ACH-6 | Gamification | INFO | perf | increment+refresh apró pazarlás, nem hiba |
| ONB-1 | Onboarding | LOW | self-grant | CONFIRMED — kliens-vezérelt tömeges known-grant, nulla blast radius |
| ONB-2 | Onboarding | LOW | idempotency | **REFUTED (mint kihasználható hiba)** — belépés nem-idempotens, de a műveletek idempotensek |
| ONB-3 | Onboarding | INFO | state-bypass | CONFIRMED — natív kliens szándékosan gate-mentes, self-only, ártalmatlan |
| ONB-4 | Onboarding | INFO | lockout | CONFIRMED tiszta — nincs fizetési csapda / redirect-loop |
| ONB-5 | Onboarding | INFO | correctness | CONFIRMED tiszta — null-safe MW, helyes auth→verified→onboarding sorrend |

> Megjegyzés: az ACH-5 és az ONB-1 ugyanaz a self-grant mechanizmus két nézőpontból (a Dim A és Dim B finder külön találta meg) — az onboarding `complete()` tömeges known-jelölése + az abból fakadó vocab/known/level badge-ek. Egy valós leletként számolandó.

---

## A LOW-leletek közös tengelye: a blast radius bizonyítottan nulla

Mind az 5 LOW ugyanoda fut ki: **bizonyos badge-ek / known-státusz megszerezhetők valódi teljesítmény nélkül**, DE ennek nincs downstream értéke. Ezt a finderek állították, és **függetlenül, saját kézzel is megerősítettem**:

- **Achievement → 0 entitlement:** a `UserAchievement` / `achievement_key` sehol nem olvasódik gate / `can` / pro / limit / reward döntéshez — csak a `$fillable`-ben és a saját service/controllerben jelenik meg. Nincs reward-wiring.
- **`quiz_completions` / `text_analyses` counter → nem entitlement-forrás:** csak a `passes()` küszöbben és az incrementben szerepel. A napi elemzés-limit a **plan-alapú** `planLimit('text_analyses_per_day')`-ből jön, NEM a farm-olható counterből — a counter-farm semmilyen kvótát/limitet nem emel.
- **Nincs publikus leaderboard:** streak szerint csak az `AdminController` rendez (admin-only nézet), nincs publikus ranglista, amin egy self-grant másoknak láthatóvá válna.
- **A `known` státusz** csak tartalom-kiválasztást (kvíz/gyakorló pool, érthetőség-%) befolyásol — nem kvótát, nem Pro-kaput, nem pénzt.

Tehát egy self-grant kizárólag a **csaló saját statisztikáját** rontja el (self-directed, visszafordítható). Nincs cross-user, entitlement vagy pénzügyi hatás.

---

## A két legkockázatosabb dimenzió — háromszorosan zárt

- **Dupla-kiadás / konkurens race (ACH-3):** REFUTED. A `user_achievements` táblán élő `unique(user_id, achievement_key)` constraint (migráció :19), minden beszúrás `firstOrCreate` a `wasRecentlyCreated`-guarddal, és nincs jutalom az achievement mögött. Három egymástól független réteg zárja.
- **Cross-user / IDOR (ACH-4):** REFUTED. Nincs olyan végpont, ami user-ID-t fogadna achievement-írásra; mind a 10 `checkAndAward*` a hitelesített `$request->user()`-re megy, az `AchievementController@index` szintén csak sajátot olvas. Nincs tömeges/admin achievement-adó út.

---

## Onboarding-middleware réteg — korrekt

- **Nincs redirect-loop:** az `onboarding` route-csoport (web.php:65-68) a gate-en KÍVÜL van; a middleware `route('onboarding')`-ra irányít, ami mentes a gate-től.
- **Nincs fizetési csapda:** a `settings/*`, `pricing/checkout`, logout szándékosan gate-mentes → befejezetlen onboardingú user is tud fizetni, profilt szerkeszteni, kijelentkezni.
- **Helyes sorrend:** auth → verified → onboarding; a `?->` null-safe operátor defenzív fail-safe, vendéget a middleware sosem lát (auth előbb fut).
- **Nem-idempotens POST (ONB-2):** valós, de ártalmatlan — a szó-upsert és az achievement-firstOrCreate egyaránt idempotens. Kozmetikai tisztaság-javításnak érdemes lehet egy korai `if ($user->onboarding_completed_at) return redirect()->route('dashboard')` visszatérés, de NEM biztonsági hiány (no-fix scope).

---

## Egyezés a korábbi Fázis 5 audittal (utólagos megjegyzés)

A user kérésére az audit függetlenül, a korábbi riportok ismerete nélkül készült. Utólag megállapítható: az eredmény **konzisztens** — a fő self-grant leletet ez az audit is megtalálta és LOW-ra tette, a dupla-kiadás/IDOR gyanút itt is REFUTED. **Regressziót nem találtam.**

---

## Részletes leletek

A dimenziónkénti, séma-kényszerített (fájl:sor, súlyosság, kategória, forgatókönyv, blast radius, verifikációs verdikt) formátumú leletek:

- `01-dim-a-gamification.md` — ACH-1 … ACH-6
- `02-dim-b-onboarding.md` — ONB-1 … ONB-5

## Következő lépés

A PLAN.md szerint a Fázis 6 (input/output biztonság) következne, **de a felhasználói utasítás értelmében itt megállok és jóváhagyásra várok.** Fázis 6-8-ra nem léptem.
