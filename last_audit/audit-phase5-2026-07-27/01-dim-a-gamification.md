# Dimenzió A — Gamification (achievement- és pont-kiadás)

> Fázis 5 / 1. PLAN-pont · 2026-07-27 · **csak dokumentálás, kód nem módosult**

## A PLAN-pont szó szerint

> **Achievement/pont-kiadás race-ei** (`AchievementService`, `UserAchievement` — a Q-L3 fix jelzi a kockázatot):
> dupla-kiadás konkurens kérésnél, unique-constraint megléte.

## Vizsgált felület

| Fájl | Szerep |
|---|---|
| `app/Services/AchievementService.php` (264 sor) | achievement-definíciók, `checkAndAward*`, `passes()`, memo |
| `app/Models/UserAchievement.php` | modell |
| `app/Models/User.php:30,76-78,447-492` | fillable, reláció, `updateStreak()`, `currentStreak()` |
| `app/Http/Controllers/AchievementController.php` | read-only megjelenítés |
| `database/migrations/2026_04_07_184656_create_user_achievements_table.php` | tábla + unique constraint |
| 7 élő hívóhely | Word, UserCustomWord, Extension, FlashcardDeck, FlashcardStudy, TextAnalysis, Onboarding |

**Mérleg: 0 HIGH · 0 MEDIUM · 3 LOW · 4 INFO.**

---

## A központi PLAN-feltevés: dupla-kiadás konkurens kérésnél → **MEGDŐLT**

`AchievementService.php:95-102` a `firstOrCreate` + `wasRecentlyCreated` mintát használja.
A védelem **két, egymástól független rétegű**, és mindkettőt élő adatbázison ellenőriztem:

1. **DB-réteg — élő sémán igazolva.** `SHOW INDEX FROM user_achievements`:
   ```
   user_achievements_user_id_achievement_key_unique (user_id)        unique=YES
   user_achievements_user_id_achievement_key_unique (achievement_key) unique=YES
   ```
   A constraint tehát nem csak a migrációban szerepel, hanem **ténylegesen él a futó adatbázisban**.
   Egyetlen migráció érinti a táblát, későbbi nem dobja el.

2. **Framework-réteg.** A `firstOrCreate` → `createOrFirst`
   (`Illuminate/Database/Eloquent/Builder.php:728-735`) elkapja a `UniqueConstraintViolationException`-t,
   és `useWritePdo()`-val visszaolvassa a meglévő sort. A vesztes szál így **sem 500-at nem dob**
   (nincs exception-alapú DoS), **sem duplán nem jelent** (`wasRecentlyCreated === false`).

Tranzakció-szennyezési aggály sincs: egyik élő hívóhely sem futtat `DB::transaction`-t a
`checkAndAward` körül, így a `withSavepointIfNeeded` ág nem is aktiválódik.

**Következtetés: egy achievement = egy DB-sor = egy toast. A PLAN „dupla-kiadás" feltevése megdőlt,
az unique-constraint megléte megerősítve.**

---

## A blast radius: bizonyítottan nulla — ez súlyoz minden lenti leletet

Az achievementek és a streak **semmilyen jogosultságot nem nyitnak**. Ezt önállóan is ellenőriztem:

```
grep -rn "achievement_key|achievements()|UserAchievement" app/ --include=*.php
  → app/Models/User.php:76-78 (a reláció definíciója)
  → a service + a saját controller
```

Egyetlen gate, policy, `can`, plan-limit vagy ár sem olvassa. A `streak` az
`app/Policies/`, `app/Providers/`, `config/` fákban **nulla találat** — csak a
`HandleInertiaRequests:66` flash-megosztásban és az admin-nézet rendezésében szerepel.

Ezért **még egy teljes self-grant is kizárólag kozmetikai**: egy ikon a saját `/achievements`
oldalon. Nincs kvóta, nincs Pro-kapu, nincs pénz, nincs publikus ranglista. Súly-inflációt
ezen a dimenzión ezért nem végzek.

---

## Leletek

### ACH-1 · `app/Models/User.php:30` + `447-461` · **LOW** · mass-assignment felület

**Forgatókönyv:** a `streak`, `last_activity_date`, `quiz_completions`, `text_analyses` oszlopok
szerepelnek a `#[Fillable]` attribútumban. Ha egy jövőbeli endpoint `$user->update($request->all())`-t
hívna, vagy egy bővülő `validated()` tömb kerülne vissza a User-be, a kliens `streak: 999`-cel
azonnal megkapná a `streak_100` achievementet.

**Miért nem kihasználható MA — minden User-írási út ellenőrizve:**

| Útvonal | Védelem |
|---|---|
| `ProfileController.php:31` `fill($request->validated())` | a `ProfileUpdateRequest` a `profileRules()`-t használja, ami **kizárólag** `name` + `email` kulcsot ad vissza (`app/Concerns/ProfileValidationRules.php:17-21`) — a `validated()` kiszűri a `streak`-et |
| `BillingController.php:37` `fill($data)` | csak billing-mezők |
| `OnboardingController.php:104` | literál tömb: `['onboarding_completed_at' => now()]` |
| entitlement-oszlopok (`lifetime_access`, `plan_override`) | tudatosan `forceFill`, ahogy a `User.php:26-29` kommentje dokumentálja |

**Verifikációs verdikt: PLAUSIBLE** (ma nincs bemenet→hatás út; tisztán regressziós kockázat).
**Blast radius: nulla** — a streak semmilyen jogosultságot nem nyit.
**Indoklás LOW-ra, nem MEDIUM-ra:** forgatókönyv nélküli lelet nem lelet; itt a forgatókönyv
egy *jövőbeli* kódváltozást feltételez. Megjegyzendő, hogy a `StreakTest.php:35` maga is
`update(['streak' => 3])`-mal él — a teszt-kényelem tartja bent ezeket a mezőket.

### ACH-2 · `routes/web.php:76-77` + `OnboardingController.php:49-113` · **LOW** · achievement-farm

**Forgatókönyv (konkrét bemenet → hatás):** a `POST /onboarding` route csak `auth` + `verified`
mögött áll, és **nincs guard a már befejezett onboardingra**. Egy végzett user újra POST-ol:

```
shown_word_ids = [<20 db 1-es szintű szó id>]
known_word_ids = <ugyanaz a 20>
```

→ `$ratio = 1.0` (`:71`) → `$markCount = totalInLevel` → a teljes 1-es szint `known`-ra kerül
(`:101` upsert) → `level_1_complete`, `known_1000`, `vocab_1000` azonnal feloldva, valós tanulás nélkül.

**Verifikációs verdikt: CONFIRMED** mint mechanizmus — **de a hatás kozmetikai.**
**Blast radius:** self-only. A támadó a saját szótár-állapotát és saját achievementjeit rontja el.
Nincs cross-user hatás, nincs jogosultság-nyerés, nincs AI-hívás → nincs költség.

**Indoklás LOW-ra:** lényegében „a játékos becsapja saját magát" — az onboarding célja épp az
önbevallás. Ugyanez a mechanizmus a B dimenzióban ONB-3/ONB-4 néven, más nézőpontból is szerepel;
**egy valós leletként számolandó.**

### ACH-3 · `AchievementService.php:173-263` · **LOW** · query-teher hot pathon

**Forgatókönyv:** a `POST /words/{word}/status` (throttle 60/perc) minden hívásnál
`checkAndAward(['streak','vocab','known'])`-ot futtat. Query-számlálás:

| Rész | Query |
|---|---|
| `:79` `achievements()->pluck()` | 1 |
| `streak_*` (5 db) | 0 (oszlop-olvasás) |
| `vocab_*` (5 db) | 2 — a `$memo["marked.{id}"]` (`:177`) miatt csak az elsőnél |
| `known_*` (5 db) | 2 — `$memo["known.{id}"]` (`:183`) |

Összesen **~5 query/kérés**. A memoizálás helyesen véd a 15×-ös felfújódástól.

**Verifikációs verdikt: REFUTED mint N+1.** Nincs N+1.
**Maradék, valós de kicsi teher:** a `totalMarkedWords`/`totalKnownWords` `count()`-jai a user
partícióján szkennelnek; 1000+ szavas usernél 60 kérés/perc mellett érzékelhető, de nem DoS-vektor.
Az `isLevelComplete` (`:241-254`) csak az onboarding útján fut.

### ACH-4 · `AchievementService.php:173` · **INFO** · memo-scope → **PLAN-feltevés MEGDŐLT**

A memo-szivárgás gyanúját a PLAN külön kérte. **Nem áll fenn, dupla okból:**

1. A service **sehol nincs singletonként regisztrálva** — önállóan ellenőriztem:
   `grep -rn "AchievementService" app/Providers/ bootstrap/` → **nulla találat**.
   Az `app(AchievementService::class)` minden hívásnál friss példányt ad, üres `$memo`-val.
2. A memo-kulcsok **user-scope-oltak** (`"marked.{$user->id}"`), tehát még egy jövőbeli
   singleton-regisztráció vagy Octane-kontextus esetén **sem szivárogna user-ok között**.

Az egyetlen hely, ahol egy példány két hívást szolgál ki, a `TextAnalysisController.php:334-338`.
**Ez ártalmatlan:** az analysis-ág a `$user->text_analyses` oszlopot olvassa (`:151`), a streak-ág a
`$user->streak`-et (`:113`) — egyik sem memoizált, és a `marked`/`known`/`level` kulcsokhoz egyik
csoport sem nyúl. Elavult memo-találat nem lehetséges.

### ACH-5 · `app/Models/User.php:447-461` · **INFO** · streak-konkurencia + UTC időzóna

**Konkurencia:** az `updateStreak()` nem tranzakcionális read-modify-write. Elvi race: két
párhuzamos kérés átmegy a `:452` `isToday()` szűrőn, és mindkettő `streak + 1`-et ír.
**A hatás azonban akkor is legfeljebb +1**, mert mindkét szál *ugyanarra az értékre* ír —
utolsó író nyer, nem összeadódik. Naponta egyszer, kozmetikai mezőn → INFO.

**Counter-integritás — PLAN-feltevés MEGDŐLT:** a `checkAndAwardAnalysis:220`
`$user->increment('text_analyses')` az Eloquent `incrementOrDecrement`-en keresztül **atomi SQL
`col = col + 1`-et** ad ki → nincs lost update. Kliens-vezérelt farm sincs: az `analyze` végpontot
a `reserveDailyAnalysis` atomi `Cache::increment` napi kerete fogja, fail-closed viselkedéssel.

**Időzóna — élő méréssel igazolva:**
```
app tz: UTC
Carbon::today(): 2026-07-27 00:00:00
Budapest now:    2026-07-27 12:24:05   (UTC 10:24)
```
A `config/app.php` `'timezone' => 'UTC'`, az `.env`-ben nincs felülírás. A `Carbon::today()` és az
`isYesterday()` UTC-ben számol, miközben a felhasználók magyar idő szerint (UTC+1/+2) élnek.
**Következmény:** a „nap" 01:00/02:00 helyi időkor vált, tehát egy éjfél és 01:00/02:00 közötti
tanulás még az *előző* naphoz számít — a user aznap már nem tud streaket növelni.

Ez **UX-pontatlanság, nem biztonsági rés**, és konzisztens: a `currentStreak()` (`:483-491`)
ugyanabban az időzónában olvas. Manipulálhatóság nulla — a kliens nem küld időzónát.

### ACH-6 · teljes lánc · **INFO** · IDOR → **TISZTA**

Minden achievement-írás a hitelesített `$request->user()`-ből veszi a user_id-t; **nincs
kliens-vezérelt `user_id` paraméter sehol a láncban**. Az olvasás (`AchievementController:16`)
a `$user->achievements()` reláción keresztül scope-olt. A hordozó controllerek is ellenőrzik a
tulajdonost: `FlashcardStudyController:80` `abort_unless(...403)`,
`UserCustomWordController:66` `Gate::authorize('update', ...)`,
`ExtensionController:430` `$request->user()->customWords()->find(...)`.
**Cross-user írási vagy olvasási út nincs.**

### ACH-7 · `resources/js/components/achievement-toast.tsx` · **INFO** · kliens-oldali hamisítás

A toast a szerver flash-ből (`HandleInertiaRequests:70`) és egy `achievements-unlocked`
CustomEvent-ből táplálkozik. Egy támadó a saját böngészőjében hamis toastot villanthat —
**kizárólag saját megjelenítés, nincs perzisztálás**. XSS-vektor sincs: a tartalom a szerver
`ACHIEVEMENTS` konstansából jön, nem user-inputból (+ React auto-escape).

---

## „PLAN-feltevés MEGDŐLT" tételek — Dimenzió A

1. **Dupla-kiadás konkurens kérésnél** → MEGDŐLT. `firstOrCreate` + élő unique constraint;
   a `createOrFirst` elkapja a constraint-sértést. Sem duplikátum, sem 500-as DoS.
   A PLAN által hivatkozott „Q-L3 fix jelezte kockázat" ezen a felületen **lezárva**.
2. **Unique-constraint megléte** → MEGERŐSÍTVE, ráadásul **futó adatbázison** is (`SHOW INDEX`).
3. **`$memo` singleton-szivárgás** → MEGDŐLT. Nincs singleton-kötés, és a kulcsok user-scope-oltak.
4. **Counter lost update (`increment` + `refresh`)** → MEGDŐLT. Az `increment()` atomi SQL.
5. **`checkAndAwardQuiz()` / `quiz_*` achievementek** → **HOLT KÓD** (INFO). A `routes/words.php:47-51`
   quiz/cloze/irregular route-jai kikommentelve; a `php artisan route:list` egyet sem listáz.
   A `checkAndAwardQuiz()` (`:192-211`) és a `quiz_completions` counter **elérhetetlen**.
   Mellékhatás: az `AchievementController:27` továbbra is kirakja a „Kvíz" csoportot 4 örökre
   feloldhatatlan achievementtel az `/achievements` oldalra — **UX-szemét, nem biztonsági lelet**;
   a feature visszahozásakor magától rendeződik.

## Megjegyzés tesztlefedettségről (nem lelet)

**Nincs egyetlen dedikált achievement-teszt sem** a `tests/` fában (a `StreakTest.php` a streaket
rendesen fedi). A race-biztonság ma framework-garancián és DB-constrainten nyugszik, **nem
őrszem-teszten**. Ez a jelenlegi állapotban nem kockázat — de ha valaki a `firstOrCreate`-et
`create()`-re cserélné, semmilyen teszt nem fogná meg.
