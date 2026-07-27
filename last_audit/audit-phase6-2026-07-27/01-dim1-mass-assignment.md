# Fázis 6 / Dimenzió 1 — Mass-assignment / `$fillable` / `$guarded` sweep

**Dátum:** 2026-07-27
**Hatókör:** mind a 19 Eloquent modell az `app/Models/` alatt + minden `create()` / `fill()` / `update()` / `updateOrCreate()` / `firstOrCreate()` / `insert()` hívási hely az `app/` alatt.
**Módszer:** CSAK dokumentálás — kód nem módosult (se forrás, se teszt).
**Kizárt (kivezetett feature-k):** `QuizController`, `ClozeController`, `IrregularVerbController`, `WordController::quiz`, `WordController::practice`, `TextAnalysisController::practiceCheck`, `ReviewController`.

---

## 0. Vezetői összefoglaló

**0 HIGH, 0 MEDIUM, 2 LOW, 7 INFO.**

A mass-assignment felület a projektben **strukturálisan zárt**. A döntő megállapítás: az `app/` alatt **egyetlen `$request->all()` átadás sincs** create-be vagy fill-be — az egyetlen találat a `Flashcard` modell doc-blokkjában szereplő *magyarázó szöveg*. Minden user-facing írás vagy explicit `validated()`-en, vagy kézzel összeállított attribútum-tömbön megy át, és minden tulajdonlás-mezőt (`user_id`, `deck_id`) **reláció** vagy hardcode-olt `$user->id` kényszerít ki, nem a payload.

A három ellenőrzésre kijelölt korábbi (2026-07-20) megállapítás mindegyike **HELYTÁLLÓ** (részletek a 4. szakaszban).

---

## 1. Lelet-táblázat

| ID | Fájl:sor | Súly | Rövid leírás | Verdikt |
|---|---|---|---|---|
| MA6-1 | `app/Models/PlayerPairing.php:14` | LOW | `poll_secret_hash` fillable egy nem-hitelesített végpont által használt modellen | CONFIRMED (strukturális, nem kihasználható) |
| MA6-2 | `app/Models/Report.php:11`, `app/Models/FlashcardDeck.php:12`, `app/Models/FlashcardSetting.php:11`, `UserCustomWord.php:10`, `BillingoInvoice.php:15`, `UserAchievement.php:12`, `UserBook.php:12`, `YoutubeTranscript.php:13` | LOW | `user_id` 8 modell fillable-jában, miközben minden hívási hely relációból/hardcode-ból tölti | CONFIRMED (redundáns felület, jelenleg 0 kihasználható út) |
| MA6-I1 | `app/Models/User.php:30` | INFO | User fillable entitlement-mentes — MA-3 továbbra is igaz | REFUTED (nincs lelet) |
| MA6-I2 | `users` tábla (38 oszlop) | INFO | `is_admin` oszlop nem létezik — MA-2 továbbra is igaz | REFUTED (nincs lelet) |
| MA6-I3 | `app/Models/Flashcard.php:20` | INFO | `is_imported` nincs a fillable-ban — MA-4 fix ÉL, regresszió nincs | REFUTED (nincs lelet) |
| MA6-I4 | `app/Http/Controllers/WordController.php:539-544` | INFO | Globális `words` tábla írása admin-gated; `rank` nincs a szabályhalmazban | REFUTED (nincs lelet) |
| MA6-I5 | `app/Models/User.php:179-186` | INFO | Admin-jogosultság e-mail-alapú, az `email` pedig fillable — de nem eszkalációs út | REFUTED (nincs lelet) |
| MA6-I6 | `app/Models/IrregularVerb.php` | INFO | Kivezetett feature; egyetlen író a seeder `upsert()` | Kívül esik |
| MA6-I7 | mind a 19 modell | INFO | Nincs olyan modell, amelynek se attribútuma, se `$fillable`/`$guarded`-je ne lenne | REFUTED (nincs lelet) |

**HIGH/MEDIUM-gyanús lelet: NINCS.**

---

## 2. A 19 modell fillable-felülete

Laravel 13 `#[Fillable([...])]` PHP-attribútum (`Illuminate\Database\Eloquent\Attributes\Fillable`) vs. klasszikus `protected $fillable`:

| # | Modell | Felület típusa | Tulajdonlás-mező a fillable-ban | Érzékeny mező a fillable-ban |
|---|---|---|---|---|
| 1 | `AiWordCache` | `$fillable` | — | — |
| 2 | `BillingoInvoice` | `$fillable` | `user_id` | — |
| 3 | `Flashcard` | attribútum | `deck_id`, `word_id` | — (`is_imported` KIZÁRVA) |
| 4 | `FlashcardDeck` | attribútum | `user_id` | — |
| 5 | `FlashcardDeckSetting` | attribútum | `flashcard_deck_id` | — |
| 6 | `FlashcardFolder` | attribútum | — (csak `name`) | — |
| 7 | `FlashcardReview` | attribútum | `flashcard_id` | — |
| 8 | `FlashcardSetting` | attribútum | `user_id` | — |
| 9 | `Folder` | attribútum | — (csak `name`) | — |
| 10 | `Invite` | attribútum | — | — (`uses` KIZÁRVA) |
| 11 | `IrregularVerb` | attribútum | — | — (kivezetett) |
| 12 | `PlayerPairing` | attribútum | — (`user_id` KIZÁRVA) | `poll_secret_hash` (→ MA6-1); `approved_at` KIZÁRVA |
| 13 | `Report` | attribútum | `user_id`, `word_id` | — (`status` KIZÁRVA) |
| 14 | `User` | attribútum + `#[Hidden]` | — | — (lásd MA6-I1) |
| 15 | `UserAchievement` | `$fillable` | `user_id` | — |
| 16 | `UserBook` | `$fillable` | `user_id` | — |
| 17 | `UserCustomWord` | attribútum | `user_id` | — |
| 18 | `Word` | attribútum | — | globális szótári mezők (lásd MA6-I4) |
| 19 | `YoutubeTranscript` | `$fillable` | `user_id` | — |

**MA6-I7 / 1. feladatpont válasza:** nincs olyan modell, amelynek se attribútuma, se `$fillable`/`$guarded`-je ne lenne. Mind a 19 explicit felülettel rendelkezik, tehát a „default-guarded → `create()` dob" hibaosztály nem áll fenn.

Külön kiemelendő, hogy több modell **szándékosan és helyesen** hagy ki mezőket a fillable-ból:
- `Flashcard.is_imported` (rendszer-vezérelt SRS-besorolás),
- `Invite.uses` (számláló, csak `increment()`),
- `PlayerPairing.user_id` + `approved_at` (csak hitelesített `forceFill`),
- `Report.status` (csak admin),
- `User` minden entitlement-mezője.

---

## 3. Részletes leletek

### MA6-1 — `poll_secret_hash` fillable egy vendég-végpont modelljén

- **Fájl:sor:** `app/Models/PlayerPairing.php:14`
- **Súlyosság:** LOW
- **Verdikt:** CONFIRMED (strukturális gyengeség), a kihasználhatóság REFUTED

**Állapot.** A `#[Fillable(['user_code', 'poll_secret_hash', 'device_name', 'expires_at'])]` egy olyan modellen ül, amelynek `store()` végpontja **hitelesítés nélkül** hívható (`PlayerPairingController::store`, csak IP-throttle). A `poll_secret_hash` az eszköz-párosítás bizalmi horgonya: aki ismeri a nyers titkot, az a `redeem` végponton player-tokenre válthatja.

**Támadási forgatókönyv (megkísérelt).** A támadó `POST /player/pair` hívásba beteszi a `poll_secret_hash` mezőt egy általa választott értékkel (pl. `hash('sha256', 'aaa')`), hogy előre ismert titkú párosítást hozzon létre, majd rábírja az áldozatot a `user_code` jóváhagyására, és a saját titkával váltja be a tokent.

**Miért nem áll fenn (verifikáció).** A `PlayerPairingController.php:49-54` **nem** ad át request-inputot a `create()`-nek. A payload kézzel épül:

```php
$pollSecret = bin2hex(random_bytes(32));

PlayerPairing::create([
    'user_code' => $userCode,                              // szerver-generált
    'poll_secret_hash' => hash('sha256', $pollSecret),     // szerver-generált
    'device_name' => $this->sanitizeDeviceName($data['device_name']),
    'expires_at' => now()->addMinutes(PlayerPairing::LIFETIME_MINUTES),
]);
```

A `$request->validate()` mindössze a `device_name`-et engedi be. A `user_id` és `approved_at` helyesen KIVAN véve a fillable-ból, és csak a hitelesített `approve()` `forceFill`-je írja (`PlayerPairingController.php:103`). Ráadásul a `player_pairings.poll_secret_hash` **unique index** alatt van, tehát még egy hipotetikus injekció is ütközne egy már használt hash-sel.

**Miért marad LOW és nem INFO.** A `poll_secret_hash` a rendszer egyetlen olyan fillable mezője, amely közvetlenül egy hitelesítési titok származéka, és a védelmet jelenleg *kizárólag* a hívási hely fegyelme adja (hogy nem ad át request-inputot). Ez pontosan az a minta, amit a `Flashcard.is_imported`-nál (MA-4) a projekt maga is elutasított és strukturálisan zárt le. Egy jövőbeli refaktor, amely a `store()`-t `$request->validated()`-re állítja át, néma titok-injekciót nyitna. **Blast radius jelenleg: nulla.**

---

### MA6-2 — `user_id` nyolc modell fillable-jában, kihasználható út nélkül

- **Fájl:sor:** `Report.php:11`, `FlashcardDeck.php:12`, `FlashcardSetting.php:11`, `UserCustomWord.php:10`, `BillingoInvoice.php:15`, `UserAchievement.php:12`, `UserBook.php:12`, `YoutubeTranscript.php:13`
- **Súlyosság:** LOW
- **Verdikt:** CONFIRMED (redundáns felület), a kihasználhatóság minden hívási helyen REFUTED

**Ez a feladat 3. pontja — a kritikus rész.** Minden `user_id`-t (és `deck_id`/`word_id`-t) tartalmazó fillable minden hívási helyét végigkövettem. Az eredmény hívási helyenként:

| Modell | Hívási hely | Payload forrása | Verdikt |
|---|---|---|---|
| `Report` | `ReportController.php:24` | `$request->user()->reports()->create($request->validated())` | **TISZTA** |
| `FlashcardDeck` | `FlashcardDeckController.php:81` | `$request->user()->flashcardDecks()->create(...)` | **TISZTA** |
| `FlashcardSetting` | `Settings/FlashcardController.php:46` | `$request->user()->flashcardSettings()->updateOrCreate(...)` | **TISZTA** |
| `FlashcardSetting` | `FlashcardCalibrationController.php:38,101` | `firstOrCreate(['user_id' => $request->user()->id])` | **TISZTA** |
| `UserCustomWord` | `UserCustomWordController.php:36` | `$request->user()->customWords()->create($request->validated())` | **TISZTA** |
| `UserCustomWord` | `ExtensionController.php:195` | `$request->user()->customWords()->create($data)` | **TISZTA** |
| `BillingoInvoice` | `Services/Billingo/InvoiceGenerator.php:75` | `firstOrCreate([...], ['user_id' => $user->id])` — webhook-eredetű `$user` | **TISZTA** |
| `UserAchievement` | `Services/AchievementService.php:95,200,226` | `firstOrCreate(['user_id' => $user->id, ...])` | **TISZTA** |
| `UserBook` | `TextAnalysisController.php:1719` | `UserBook::create(['user_id' => $user->id, ...])` | **TISZTA** |
| `YoutubeTranscript` | `TextAnalysisController.php:1602` | `YoutubeTranscript::create(['user_id' => $user->id, ...])` | **TISZTA** |

**A `Report` eset részletesen** (a feladat kiemelte). A `Report` fillable tartalmazza a `user_id`-t ÉS a `word_id`-t, és a create `$request->validated()`-et kap — ez papíron a klasszikus mass-assignment minta. A kihasználás mégis lehetetlen két, egymástól független okból:

1. A `StoreReportRequest::rules()` (`app/Http/Requests/StoreReportRequest.php:18-30`) **csak** `category`, `description`, `word_id` kulcsot definiál. A `validated()` definíció szerint csak a szabályokkal fedett kulcsokat adja vissza, tehát a beküldött `user_id` már a `validated()`-ből kiesik.
2. Még ha bent is lenne, a `$request->user()->reports()->create(...)` **reláció-alapú** create: a `HasMany` a saját foreign key-ét (`user_id`) a payload UTÁN, felülíróan állítja be a szülő kulcsára. A reláció mindig nyer a payloaddal szemben.

A `word_id` beküldhető, de `Rule::exists('words', 'id')` alatt áll, és a `words` egy **globális, csak-olvasható szótár** — egy tetszőleges `word_id` bejelölése a saját reportodon nem ad hozzáférést semmihez.

**A `Flashcard.deck_id` / `word_id` eset.** A `Flashcard` fillable-ban benne van a `deck_id` — ez a legérzékenyebb tulajdonlás-mező a modellek között, mert a pakli tulajdonjoga rajta keresztül dől el. Az összes 8 írási hely:

| Hely | Minta | Tulajdon-ellenőrzés |
|---|---|---|
| `FlashcardCardController.php:51` (`store`) | `$deck->flashcards()->create($request->validated())` | `abort_unless($deck->user_id === $request->user()->id, 403)` a 46. sorban; a `StoreFlashcardRequest` nem engedi a `deck_id`-t |
| `FlashcardCardController.php:99` (`importFromWord`) | `$deck->flashcards()->create($attributes)` | `abort_unless(...)` a 65. sorban; `$attributes` kézzel épül |
| `FlashcardCardController.php:119` (`update`) | `$flashcard->update($request->validated())` | dupla `abort_unless` (deck + card); az `UpdateFlashcardRequest` nem engedi a `deck_id`-t |
| `FlashcardCardController.php:152` (`move`) | `$flashcard->update(['deck_id' => ...])` | `$targetDeck` külön `findOrFail` + `abort_unless($targetDeck->user_id === ...)` a 150. sorban |
| `FlashcardCardController.php:168` (`duplicate`) | `$deck->flashcards()->create([...])` | `abort_unless(...)`; kézzel másolt attribútumok |
| `FlashcardCardController.php:247` | `$deck->flashcards()->insert(...)` | query-builder insert, mass-assignt megkerüli |
| `FlashcardCsvController.php:95` | `$deck->flashcards()->insert($chunk)` | query-builder insert; `deck_id` hardcode-olva a 76. sorban |
| `ExtensionController.php:288` | `$deck->flashcards()->create([...])` | `$deck = $request->user()->flashcardDecks()->find($data['deck_id'])` — a keresés a saját paklikra szűkítve fut (271. sor) |

A `move` metódus a legérdekesebb, mert ez az egyetlen hely, ahol a `deck_id` **user-inputból** származik — és pontosan ott van a célpakli explicit tulajdon-ellenőrzése. **TISZTA.**

**Miért LOW és nem INFO.** Nyolc modell fillable-je tartalmaz olyan mezőt, amelyet egyetlen hívási hely sem tölt payloadból, mert mindegyik relációt vagy hardcode-ot használ. A mező tehát tisztán redundáns támadási felület: nem véd senkit, de bármikor aktiválható egy jövőbeli, `validated()`-alapú create-tel, ahol a FormRequest véletlenül felveszi a `user_id`-t. A projekt máshol (`Flashcard.is_imported`, `PlayerPairing.user_id`, `Report.status`, `Invite.uses`) már a szigorúbb, strukturális kizárást választotta — ez a nyolc modell ettől következetlenül tér el. **Blast radius jelenleg: nulla.**

---

### MA6-I1 — User fillable entitlement-mentes (MA-3 újraellenőrzés)

- **Fájl:sor:** `app/Models/User.php:30-31`
- **Súlyosság:** INFO
- **Verdikt:** a korábbi MA-3 megállapítás **HELYTÁLLÓ**

A `users` tábla ténylegesen létező 38 oszlopát a `php artisan db:table users` ellenőrizte. A fillable:

```
name, email, password, streak, last_activity_date, quiz_completions, text_analyses,
onboarding_completed_at, billing_name, billing_tax_number, billing_country, billing_zip,
billing_city, billing_address, billing_phone, billing_company_registration_number, billing_type
```

**Nincs benne** egyetlen entitlement- vagy állapot-mező sem, holott mind létezik oszlopként: `lifetime_access`, `plan_override`, `trial_ends_at`, `stripe_id`, `pm_type`, `pm_last_four`, `ai_access`, `ai_credits_used`, `ai_credits_reset_at`, `ai_credit_limit`, `invite_id`, `terms_accepted_at`, `email_verified_at`, `billingo_partner_id`, `two_factor_*`, `remember_token`.

A `#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]` a szerializációs oldalt is lezárja.

**A `fill()` hívási helyek ellenőrzése.** Két `User::fill()` van az `app/` alatt, mindkettő `validated()`-del:
- `Settings/ProfileController.php:31` — a `ProfileUpdateRequest` a `ProfileValidationRules::profileRules()`-t használja, ami **kizárólag** `name` + `email` szabályt ad (+ feltételes `current_password`). Entitlement-mező be sem kerülhet a `validated()`-be.
- `Settings/BillingController.php:37` — a `BillingUpdateRequest` a `BillingValidationRules::billingRules()`-t használja, ami kizárólag a 9 `billing_*` mezőt fedi.

**Minden entitlement-írás direkt property-assignment**, sosem mass-assignment:
- `AdminController.php:162` — `$user->plan_override = ...` (route: `can:admin`)
- `AdminController.php:188` — `$user->trial_ends_at = ...` (route: `can:admin`)
- `PricingController.php:101` — `$user->forceFill(['terms_accepted_at' => now()])`
- `Actions/Fortify/CreateNewUser.php:87` — `$user->forceFill(['invite_id' => $invite->id])`
- `Services/Billingo/InvoiceGenerator.php:238` — `$user->forceFill(['billingo_partner_id' => ...])`
- `Actions/Fortify/ResetUserPassword.php:25`, `Settings/SecurityController.php:132` — `forceFill`
- `StripeWebhookController.php:182` — célzott query-builder `update()`

A regisztrációs `User::create()` (`CreateNewUser.php:79`) is kézzel épített tömböt kap (`name`, `email`, `password` + szűrt `billing_*`), nem az `$input` spread-jét.

---

### MA6-I2 — `is_admin` oszlop nem létezik (MA-2 újraellenőrzés)

- **Súlyosság:** INFO
- **Verdikt:** a korábbi MA-2 megállapítás **HELYTÁLLÓ**

A `users` tábla 38 oszlopa között **nincs** `is_admin` vagy bármilyen szerep-oszlop. Az admin-jogosultság futásidőben, konfigurációból dől el:

```php
// app/Models/User.php:179-186
public function isAdmin(): bool
{
    $adminEmail = config('app.admin_email');   // ADMIN_EMAIL env

    return $adminEmail !== null
        && $this->email === $adminEmail
        && $this->hasVerifiedEmail();
}
```

A `Gate::define('admin', ...)` (`AppServiceProvider.php:38`) erre épül. **Mass-assignmenttel admin-jogot szerezni fogalmilag lehetetlen: nincs mit felülírni.**

---

### MA6-I3 — `is_imported` a fillable-on kívül (MA-4 fix verifikáció)

- **Fájl:sor:** `app/Models/Flashcard.php:20`
- **Súlyosság:** INFO
- **Verdikt:** a `e339069` fix **ÉL, regresszió nincs**

A `#[Fillable([...])]` 10 mezőt sorol fel (`deck_id`, `word_id`, `front`, `front_notes`, `front_speak`, `back`, `back_notes`, `back_speak`, `direction`, `color`) — az `is_imported` **nincs** köztük, és a modell fölött részletes doc-block magyarázza, miért.

**Regresszió-keresés.** Az `is_imported` összes előfordulását átnéztem az `app/` alatt. Minden író hely megkerüli a mass-assignmentet:

| Hely | Írás módja | Rendben? |
|---|---|---|
| `FlashcardCalibrationController.php:122` | `$card->is_imported = false; $card->save();` | igen — explicit property-set, kommentben MA-4-re hivatkozva |
| `FlashcardCalibrationController.php:166` | `$card->is_imported = false; $card->save();` | igen — ugyanaz |
| `FlashcardCalibrationController.php:180` | query-builder `->update(['is_imported' => false])` | igen — a query builder nem megy át a fillable-on |
| `FlashcardCsvController.php:80` | `$rows[]` tömb → `$deck->flashcards()->insert($chunk)` | igen — query-builder insert |
| `FlashcardCardController.php:259` | `insert()` payload | igen — query-builder insert |

**Egyetlen olyan hely sincs, ahol az `is_imported` `create()`/`update()` payloadba kerülne**, és a `StoreFlashcardRequest` / `UpdateFlashcardRequest` sem definiál rá szabályt, tehát a `validated()` sem hozhatja be. A `resetProgress` (`FlashcardCardController.php:126-134`) tudatosan **nem** nyúl hozzá — ez az `#F1` döntés, kommentben rögzítve.

**Az MA-4 fix által megcélzott kockázat így ténylegesen strukturálisan zárt, nem FormRequest-fegyelemre bízott.**

---

### MA6-I4 — A globális `words` tábla írási felülete (5. feladatpont)

- **Fájl:sor:** `app/Http/Controllers/WordController.php:519-545`
- **Súlyosság:** INFO
- **Verdikt:** nincs user-facing út a globális szótári sor átírására

**Kérdés:** ki írhat a `words` táblába, és van-e olyan user-facing út, ahol egy globális szótári `Word` sor átírható?

A `Word` fillable 18 mezőt tartalmaz, köztük az ÉLŐ (nem kivezetett) `is_irregular` és `verb_*` funkció-mezőket. Végigkövettem az összes `Word::` hivatkozást az `app/`, `routes/` és `database/` alatt. **Pontosan két írási út létezik:**

**1. `WordController::update` — admin-gated.**

```php
// routes/words.php:19
Route::patch('words/{word}', [WordController::class, 'update'])
    ->name('words.update')->middleware('can:admin');

// WordController.php:519-521
public function update(Request $request, Word $word): RedirectResponse
{
    Gate::authorize('admin');   // ← második, védelemben-mélységű kapu
```

Kettős védelem: route-middleware **és** kontroller-szintű `Gate::authorize`. A `can:admin` gate az `isAdmin()`-ra megy, ami `ADMIN_EMAIL` + `hasVerifiedEmail()` — nincs DB-oszlop, amit mass-assignmenttel meg lehetne szerezni (lásd MA6-I2).

Külön megjegyzés: a `$request->validate()` szabályhalmaza a fillable 18 mezőjéből csak 16-ot enged — a **`rank` és az `extra_forms` szándékosan hiányzik**. A `rank` különösen fontos: a `Word::booted()` `saving` hookja abból származtatja a `level`-t (`WordController.php` szótár-szintű besorolás), így egy `rank`-átírás az egész szint-alapú tanulási sorrendet eltolná. Még adminként sem írható a webes űrlapról.

**2. `ImportWords` console command** (`app/Console/Commands/ImportWords.php:64`) — `Word::upsert(...)`, CLI-only, HTTP-ből elérhetetlen.

**Nincs harmadik út.** Az összes többi `Word::` hivatkozás olvasás (`find`, `where`, `count`, `selectRaw`, `whereIn`). Ezt külön ellenőriztem a felhasználó-közeli felületeken:

- `WordController::status` / `ExtensionController::updateStatus` (:375) / `updateImportance` (:441) — ezek **nem a `words` sort írják**, hanem a `user_word` **pivot** táblát (`knownWords()->syncWithoutDetaching(...)`, `updateExistingPivot(...)`, `detach(...)`). A pivot per-user, tehát a státusz/fontosság saját adat, nem globális.
- `TextAnalysisController.php:137`, `ExtensionController.php:62,580`, `OnboardingController`, `DashboardController`, `FlashcardCardController.php:84`, `WordFormMapService.php:84` — mind csak olvasás.
- `AiWordCache` (`AiCacheService.php:47`) — külön tábla, a `words` sort nem érinti.

**A felhasználó saját szókincs-adatait a `UserCustomWord` modell hordozza** (`user_id` fillable-lel, de reláció-alapú create-tel — lásd MA6-2), amely a `words` táblától teljesen elkülönül. A `StoreUserCustomWordRequest::notInMainWordList()` ráadásul aktívan **megakadályozza**, hogy egy custom szó ütközzön a fő szólista bármely ragozott alakjával — vagyis az architektúra a két névteret szándékosan diszjunkt tartja.

---

### MA6-I5 — Admin-jogosultság e-mail-alapú, az `email` fillable

- **Fájl:sor:** `app/Models/User.php:179-186` + `:30`
- **Súlyosság:** INFO
- **Verdikt:** nem eszkalációs út

**Megkísérelt forgatókönyv.** Mivel az `isAdmin()` az `email` mezőre épül, az pedig fillable ÉS a `ProfileController::update`-en át felhasználó által állítható, elvileg egy támadó átírhatná a saját e-mailjét az `ADMIN_EMAIL` értékére.

**Miért nem áll fenn — négy egymástól független akadály:**

1. **Unique index.** A `users_email_unique` (a `db:table users` outputban megerősítve) megakadályozza, hogy egy második sor felvegye ugyanazt az e-mailt. Az `ADMIN_EMAIL` egy valós, regisztrált fiók e-mailje, tehát a cím már foglalt. A `ProfileUpdateRequest` `Rule::unique(User::class)->ignore($userId)`-ja ugyanezt validációs szinten is kiszűri.
2. **`hasVerifiedEmail()` követelmény.** Az `isAdmin()` harmadik feltétele a megerősített e-mail.
3. **E-mail-váltás nullázza a verifikációt.** `ProfileController.php:33-37`: `if ($emailChanged) { $user->email_verified_at = null; }` — vagyis egy sikeres e-mail-csere UTÁN a fiók definíció szerint nem verifikált, tehát nem admin.
4. **Jelszó-kötés.** `ProfileUpdateRequest::rules()`: e-mail-változtatásnál `current_password` kötelező.

Az `email_verified_at` egyébként **nincs** a fillable-ban, tehát mass-assignmenttel sem állítható vissza.

---

### MA6-I6 — `IrregularVerb`: kivezetett, kívül esik

- **Fájl:** `app/Models/IrregularVerb.php`
- **Súlyosság:** INFO

A modell `#[Fillable(['infinitive', 'past_simple', 'past_participle', 'meaning_hu', 'example_en', 'notes'])]` attribútummal rendelkezik. Az utasítás szerint megvizsgáltam, ír-e bele élő út:

- `routes/words.php:5` és `:51` — az import és a route **ki van kommentelve**, tehát a modell HTTP-felületről elérhetetlen.
- `IrregularVerbController.php` létezik, de route nélkül halott kód.
- Az egyetlen író: `database/seeders/IrregularVerbSeeder.php:160` — `IrregularVerb::upsert(...)`, CLI-only.

**Nincs élő út, amely beleírna. Kivezetett, kívül esik a hatókörön.**

(Megjegyzés: az `is_irregular` és a `verb_*` mezők a `Word` és `UserCustomWord` modelleken ÉLŐ funkciók, azokat az MA6-I4 fedi — ezek nem keverendők a kivezetett `IrregularVerb` modellel.)

---

## 4. A korábbi (2026-07-20) megállapítások verdiktje

| Korábbi lelet | 2026-07-27-i verdikt | Indoklás |
|---|---|---|
| **MA-2** — „`is_admin` oszlop nem is létezik; admin = `ADMIN_EMAIL` gate" | **HELYTÁLLÓ** | A `db:table users` 38 oszlopa között nincs szerep-oszlop; `isAdmin()` config + verifikált e-mail alapú (MA6-I2). Kiegészítés: az e-mail-alapú gate önmagában sem eszkalálható, lásd MA6-I5. |
| **MA-3** — „User fillable tiszta az entitlement-mezőktől" | **HELYTÁLLÓ** | A 17 fillable mező egyike sem entitlement/állapot; mindkét `fill()` hívási hely szűk `validated()`-et kap; minden entitlement-írás direkt property-set vagy `forceFill` admin-gate mögött (MA6-I1). |
| **MA-4** — „`is_imported` kikerült a Flashcard fillable-ból (`e339069`)" | **HELYTÁLLÓ, regresszió nincs** | A fillable 10 mezője nem tartalmazza; mind az 5 író hely explicit property-set vagy query-builder `insert`; a FormRequest-ek sem definiálnak rá szabályt (MA6-I3). |

---

## 5. A 4. feladatpont külön válasza: `unguard` / `forceFill` / `$request->all()`

**`Model::unguard()` / `Model::reguard()` / `$guarded = []`:** **nincs** az `app/`, `routes/`, `database/` alatt. (Az `AppServiceProvider`-ben `Model::unguard()` sem szerepel.)

**`$request->all()` / `request()->all()` átadás create-be vagy fill-be:** **nincs**. Az `app/` alatti egyetlen szöveges találat a `Flashcard.php:18` doc-blokkjában szereplő *magyarázat*, nem kód. `$request->except()` és `$request->only()` szintén nem fordul elő.

**`forceFill()` — 6 hívási hely, mind indokolt és nem-user-payload:**

| Hely | Mit ír | Payload | Verdikt |
|---|---|---|---|
| `PricingController.php:101` | `terms_accepted_at` | `now()` | tiszta |
| `Actions/Fortify/CreateNewUser.php:87` | `invite_id` | `$invite->id` (lockolt sorból) | tiszta |
| `PlayerPairingController.php:103` | `user_id`, `approved_at` | `$request->user()->id`, `now()` | tiszta — hitelesített, CSRF-védett web POST |
| `Settings/SecurityController.php:132` | (jelszó/2FA állapot) | szerver-oldali | tiszta |
| `Actions/Fortify/ResetUserPassword.php:25` | jelszó | validált, hashelt | tiszta |
| `Services/Billingo/InvoiceGenerator.php:238` | `billingo_partner_id` | Billingo API-válasz | tiszta |

Egyik sem kap felhasználói tömböt — mindegyik kézzel épített, 1-2 kulcsos literál. A `forceFill` itt **helyesen** használt eszköz: pontosan azért, mert a célmezők szándékosan nincsenek a fillable-ban.

---

## 6. Összegzés és javaslat

A dimenzió **nem tartalmaz HIGH vagy MEDIUM leletet**, és nem tartalmaz olyan leletet sem, amelyhez konkrét kihasználási utat lehetne leírni. A két LOW mindegyike **strukturális következetlenség, nulla jelenlegi blast radiusszal**: a védelmet a hívási helyek fegyelme adja, nem a modell felülete.

Ha a projekt a `Flashcard.is_imported`-nál választott (MA-4) szigorúbb, strukturális vonalat konzisztensen akarja vinni, a két LOW ugyanazzal a mozdulattal zárható:

- **MA6-1:** `poll_secret_hash` kivétele a `PlayerPairing` fillable-jából (a `store()` amúgy is szerver-generált értéket ír — property-set vagy `forceFill` elég).
- **MA6-2:** `user_id` kivétele arról a 8 modellről, ahol minden hívási hely relációt vagy hardcode-ot használ. Figyelmeztetés: a `firstOrCreate(['user_id' => ...])`-t használó helyeken (`AchievementService`, `InvoiceGenerator`, `FlashcardCalibrationController`) a `user_id` a **keresési** tömbben van, amit a `firstOrCreate` a create-nél is felhasznál — ott a kivétel eltörné a létrehozást, tehát ez a fix nem mechanikus, hanem hívási helyenként átgondolást igényel.

**Ezek tisztán megelőző jellegű, védelemben-mélységű változtatások — nem javítanak fennálló sebezhetőséget, és a memória-szabály értelmében fix csak explicit kérésre készül.**
