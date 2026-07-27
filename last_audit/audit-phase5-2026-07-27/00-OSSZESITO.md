# Fázis 5 audit — Gamification & Onboarding

> Készült: **2026-07-27** · a `last_audit/PLAN.md` **KIZÁRÓLAG Fázis 5** szakaszára.
> **Csak dokumentálás** — semmilyen kódot és tesztet nem módosítottam (audit-no-fixes szabály).
> **Mód:** multi-agent workflow — 2 párhuzamos, dimenziónkénti finder + **3 független,
> cáfolásra promptolt verifikátor** az egyetlen MEDIUM-gyanús leletre (eltérő lencsékkel),
> + saját, **élő adatbázison végzett mérésekkel** történő döntőbíráskodás.

## Vezetői összefoglaló

**0 HIGH · 0 MEDIUM · 7 LOW · 9 INFO · 0 go-live blokkoló.**

A fázis mindkét PLAN-pontja **lényegében tiszta**. A PLAN által feltételezett fő kockázat —
az achievement-dupla-kiadás konkurens kérésnél — **bizonyítottan meg van oldva**, két független
rétegben. Az egyetlen MEDIUM-gyanús lelet a 3-körös adverzariális verifikáció után **LOW-ra
redukálódott**, mert a súlyát hordozó premissza tényszerűen hamisnak bizonyult.

**A kör legfontosabb megállapítása:** a gamification-felület **entitlement-mentes**. Sem az
achievementek, sem a streak, sem a `user_word` „known" státusz nem nyit semmilyen jogosultságot,
kvótát, Pro-funkciót vagy pénzügyi előnyt. Ezt önállóan, grep-szinten is megerősítettem. Ezért
minden self-grant típusú lelet blast radiusa **bizonyítottan nulla** — a csaló kizárólag a saját
statisztikáját rontja el.

## Lelet-táblázat

| ID | Dim. | Súly | Kategória | Verdikt |
|---|---|---|---|---|
| ACH-1 | A | LOW | mass-assignment felület | PLAUSIBLE — ma nem kihasználható |
| ACH-2 | A | LOW | achievement-farm | CONFIRMED — hatás kozmetikai |
| ACH-3 | A | LOW | query-teher hot pathon | REFUTED mint N+1; kis maradék |
| ACH-4 | A | INFO | memo-scope | **REFUTED** |
| ACH-5 | A | INFO | streak-konkurencia + UTC tz | PLAUSIBLE, hatás ≤ +1/nap |
| ACH-6 | A | INFO | IDOR | **REFUTED — tiszta** |
| ACH-7 | A | INFO | kliens-oldali toast-hamisítás | CONFIRMED, nem perzisztál |
| ONB-1 | B | **LOW** | erőforrás-vektor | **PLAUSIBLE — MEDIUM→LOW, lásd napló** |
| ONB-2 | B | LOW | idempotencia-hiány | CONFIRMED — self-only adatvesztés |
| ONB-3 | B | LOW | kliens-vezérelt önbevallás | CONFIRMED — tervezett funkció |
| ONB-4 | B | LOW | hiányzó szerver-oldali shown-set | CONFIRMED — ONB-3 enablere |
| ONB-5 | B | LOW | tesztlefedettség | **REFUTED** (lock-out) |
| ONB-6 | B | INFO | middleware `?->` vendég-redirect | **REFUTED** |
| ONB-7 | B | INFO | gate-lefedettség / lock-out | **REFUTED** |
| ONB-8 | B | INFO | extension/player gate-megkerülés | CONFIRMED, ártalmatlan |
| ONB-9 | B | INFO | `ORDER BY RAND()` throttle-mentes GET-en | PLAUSIBLE |
| ONB-10 | B | INFO | tesztlefedettségi hézagok | CONFIRMED |

> **ACH-2 és ONB-3/ONB-4 ugyanaz a mechanizmus** két nézőpontból (a két finder külön találta meg):
> az onboarding arány-alapú tömeges known-jelölése. **Egy valós leletként számolandó.**

## A dimenziók a PLAN-ból

A Fázis 5 szakasz **2 felsorolás-pontból** áll, ezért a parancs szabálya szerint
(1-3 pont → külön-külön egy-egy finder) **2 finder-dimenzió** készült:

- **Dimenzió A — Gamification:** `AchievementService`, `UserAchievement`, dupla-kiadás, unique-constraint
- **Dimenzió B — Onboarding:** `OnboardingController`, `EnsureOnboardingComplete`, lépés-átugrás, lock-out

## Megdőlt PLAN-feltevések (11 db)

**Dimenzió A:**
1. **Dupla-kiadás konkurens kérésnél** → MEGDŐLT. `firstOrCreate` + a `createOrFirst`
   constraint-sértés-kezelése; sem duplikátum, sem 500-as DoS. A PLAN által hivatkozott
   „Q-L3 fix jelezte kockázat" ezen a felületen **lezárva**.
2. **Unique-constraint megléte** → MEGERŐSÍTVE, ráadásul **futó adatbázison** is
   (`SHOW INDEX FROM user_achievements` → `unique=YES`), nem csak a migrációban.
3. **`$memo` singleton-szivárgás** → MEGDŐLT. Nincs singleton-kötés (`grep app/Providers/`
   → 0 találat), és a memo-kulcsok user-scope-oltak.
4. **Counter lost update (`increment`+`refresh`)** → MEGDŐLT. Az `increment()` atomi SQL.
5. **`checkAndAwardQuiz()` / `quiz_*` achievementek** → **HOLT KÓD** (lásd kizárások).

**Dimenzió B:**
6. **Védett route onboarding nélkül / fordított lock-out** → MEGDŐLT **mindkét irányban**.
7. **A middleware `?->` operátora vendéget is redirectelne** → MEGDŐLT (mind a 4 helyen `auth` mögött).
8. **`onboarding_enabled=false` → lock-out** → MEGDŐLT (a `features`→`theme` úton befejezhető).
9. **Újra-POST → achievement újra kiadódik** → MEGDŐLT.
10. **Újra-POST → streak/statisztika torzítás** → MEGDŐLT (a streak csak `last_activity_date`-ből számol).
11. **A tömeges `known`-jelölés kvótát/Pro-t/pénzt ér** → MEGDŐLT (nulla entitlement-döntés függ tőle).

## Kihagyott (kivezetett) pontok

A Fázis 5 szakasz **közvetlenül nem hivatkozik** kivezetett feature-re, tehát pontot nem kellett
kihagyni. Egy **áthallás** viszont adódott, és leletként dokumentáltuk:

- **`checkAndAwardQuiz()` + `quiz_*` achievementek + `quiz_completions` counter = HOLT KÓD.**
  A `routes/words.php:47-51` quiz/cloze/irregular route-jai ki vannak kommentelve; a
  `php artisan route:list` egyetlen ilyet sem listáz. A metódus elérhetetlen.
  **Mellékhatás:** az `AchievementController:27` továbbra is kirakja a „Kvíz" csoportot az
  `/achievements` oldalra **4 örökre feloldhatatlan achievementtel** — UX-szemét, nem biztonsági
  lelet; a feature visszahozásakor magától rendeződik.

A `is_irregular`, az igealakok és a `words.sentence-check` a parancs előírása szerint **NEM**
kizárás — ezek élő funkciók, de a Fázis 5 hatókörén kívül esnek.

## Regresszió-vizsgálat — a 2026-07-20-i körhöz képest

A korábbi Fázis 5 riport (`last_audit/reaudit-phase5/`, a munkafában törölve, gitből
visszaolvasva) eredménye: **0 HIGH/MEDIUM, 5 LOW, 6 INFO**.

**Regressziót nem találtam.** Ami korábban tiszta volt, most is tiszta:

| Korábbi verdikt | Mostani állapot |
|---|---|
| ACH-3 (race) REFUTED | **Tartom** — most élő DB-n is igazolva (`SHOW INDEX`) |
| ACH-4 (IDOR) REFUTED | **Tartom** — mind a 7 élő hívóhely session-identitásra megy |
| ONB-4 (lockout) tiszta | **Tartom** — a gate-mentes route-lista változatlanul szándékos |
| ONB-5 (MW-helyesség) tiszta | **Tartom** |
| „nincs reward-wiring" | **Tartom** — újra-grepelve, ma is 0 entitlement-olvasó |

**Önálló ítélet — ahol továbbmentem a korábbi körnél.** A korábbi riport az ONB-2-t
„nem-idempotens, de ártalmatlan" címkével zárta. Ezt **részben megdöntöm lefelé pontosítva**:
a művelet valóban idempotens az achievementek felől, **de nem az a `user_word` státuszok felől** —
az újra-POST a user korábbi `learning`/`saved` státuszait `known`-ra írja vissza. Ez self-only
adatvesztés, tehát a LOW-súly nem változik, de a korábbi „a műveletek idempotensek" indoklás
pontatlan volt.

**Új, korábban nem dokumentált leletek** (nem regressziók — a korábbi kör egyszerűen nem nézte
ezeket a szögeket): ONB-1 (throttle + `max:` + `exists` N+1), ACH-5 (UTC streak-határ),
ONB-9 (`ORDER BY RAND()`), ONB-10/ACH tesztlefedettség.

## Az egyetlen érdemi súlyosság-vita: ONB-1

Finder-súly **MEDIUM** → 3 verifikátor (kihasználhatóság / blast radius / meglévő védelmek) →
szavazat **2 LOW vs 1 MEDIUM** → **végleges: LOW**.

A MEDIUM egyetlen indoklása az volt, hogy a `POST /onboarding` „az app egyetlen throttle-mentes
írás-végpontja". **Saját méréssel megdöntöttem:** a `routes/flashcards.php` 26 mutáló route-jából
**0** visel throttle-t, a `routes/words.php` 13-ból **1**; összesen ~50 throttle-mentes mutáló
route van. Az onboarding tehát a **többségi mintát** követi.

Ami viszont **kitartott** minden lencse alatt, és amit saját méréssel is megerősítettem:
az elemenkénti `exists:words,id` valóban **N+1-et termel és nem bail-el**
(mérve: 200 elem → **201 query**; 2000 elem → 524 ms → 10 000 elem ≈ **2,6 s DB-idő**).
Ez az **egyetlen wildcard `exists:` a kódbázisban**, ráadásul funkcionálisan **redundáns**
(a `:65` sor `whereIn`-nel amúgy is újra lekérdez).

Részletes szavazat-indoklás és mérési adatok: **`03-VERIFIKACIOS-NAPLO.md`**.

## Fájlok

- `01-dim-a-gamification.md` — ACH-1 … ACH-7
- `02-dim-b-onboarding.md` — ONB-1 … ONB-10
- `03-VERIFIKACIOS-NAPLO.md` — az ONB-1 súly-vita teljes útja

## Következő lépés

A PLAN szerint a Fázis 6 következne, **de az utasításod értelmében itt megállok és
jóváhagyásra várok.** Fázis 6-8-ra nem léptem. Fixet nem készítettem — arra külön,
explicit kérés kell.
