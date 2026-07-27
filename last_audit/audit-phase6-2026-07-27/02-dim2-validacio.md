# Fázis 6 / DIMENZIÓ 2 — Validáció-lefedettség minden mutáló route-on

**Dátum:** 2026-07-27
**Terjedelem:** POST/PUT/PATCH/DELETE végpontok, `php artisan route:list --except-vendor` friss adat alapján
**Módszer:** csak dokumentálás — kód nem módosult (se forrás, se teszt)

---

## 0. Alapszámok és a PLAN elavult adata

| Mérőszám | PLAN-ban | Mért (2026-07-27) |
|---|---|---|
| Összes route (except-vendor) | — | **123** |
| Mutáló route (POST/PUT/PATCH/DELETE) | 77 (előző audit) | **76** |
| FormRequest osztályok | **8** | **15** |

**JELZÉS a PLAN felé:** a „8 FormRequest" szám **elavult**. A tényleges állomány
`app/Http/Requests/` alatt 9 + `app/Http/Requests/Settings/` alatt 6 = **15**.

A mutáló route-szám 77 → 76 változása a kivezetett feature-ökből ered (kvíz/cloze/
rendhagyó igék route-jai kikommentelve a `routes/words.php`-ban).

### Kizárások (kivezetett feature-k — a körből kihagyva)

`QuizController`, `ClozeController`, `IrregularVerbController`, `WordController::quiz`,
`WordController::practice`, `TextAnalysisController::practiceCheck`, `ReviewController`.

A `words/sentence-check` (`TextAnalysisController@sentenceCheck`) **NEM** kizárás —
a szövegelemzőé, benne van a körben (lásd a táblázatban).

---

## 1. Végpontonkénti lefedettség-táblázat (mind a 76 mutáló route)

Jelmagyarázat a „Validáció" oszlophoz:
- **FR** = FormRequest
- **inline** = `$request->validate([...])` a metódusban
- **trait** = közös trait-helper (`TogglesWordStatus::validatedToggleStatus`)
- **body-mentes** = az akció nem olvas request-inputot (route-model-binding + tulajdon-ellenőrzés)

### 1.1 Admin (5)

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 1 | POST | `admin/access` | `AdminController@setAccess` | inline | `email` exists + `plan` **in:none,premium** ✅ |
| 2 | POST | `admin/free-month` | `AdminController@grantFreeMonth` | inline | `email` required+exists ✅ |
| 3 | POST | `admin/invites` | `AdminController@storeInvite` | inline | `max_uses` **min:1 max:10000** ✅, `expires_at` date+after:now ✅ |
| 4 | DELETE | `admin/invites/{invite}` | `AdminController@destroyInvite` | body-mentes | route-model-binding |
| 5 | PATCH | `admin/reports/{report}` | `AdminController@updateReportStatus` | inline | `Rule::in(Report::STATUSES)` ✅ |

Mind az 5 `can:admin` gate mögött (`routes/web.php:46`). Az enum-jellegű mezők
(`plan`, `status`) **mind** `in:`/`Rule::in` szabállyal védettek.

### 1.2 API / extension / player (12) — a legexponáltabb felület

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 6 | POST | `api/player/add-word` | `ExtensionController@addWord` | inline | 19 mező, **mind max:** + `status` in: + `importance` min/max ✅ |
| 7 | POST | `api/player/create-flashcard` | `ExtensionController@createFlashcard` | inline | `direction` Rule::in ✅, `color` regex ✅ |
| 8 | POST | `api/player/disconnect` | `PlayerPairingController@disconnect` | body-mentes | `currentAccessToken()->delete()` |
| 9 | POST | `api/player/pair` | `PlayerPairingController@store` | inline | `device_name` max:100 + `sanitizeDeviceName()` ✅ |
| 10 | POST | `api/player/pair/exchange` | `PlayerPairingController@exchange` | inline | `user_code` max:20, `poll_secret` max:128 ✅ |
| 11 | POST | `api/player/update-importance` | `ExtensionController@updateImportance` | inline | `importance` nullable int 1–5 ✅ |
| 12 | POST | `api/player/update-status` | `ExtensionController@updateStatus` | inline + trait | `id` int min:1, `is_custom` boolean, státusz trait-ből `in:` ✅ |
| 13 | POST | `extension/add-word` | `ExtensionController@addWord` | inline | = #6 (közös metódus) |
| 14 | POST | `extension/create-flashcard` | `ExtensionController@createFlashcard` | inline | = #7 |
| 15 | POST | `player/connect` | `PlayerPairingController@approve` | inline | `code` max:20 + `normalizeUserCode()` ✅ |

**Verdikt az exponált felületre: TISZTA.** Minden extension/player mutáló végpont
validál, minden string-mezőn van `max:`, minden enum-mezőn `in:`, és minden
tulajdon-ellenőrzés a *saját* reláción megy (`$request->user()->customWords()->find()`,
`$request->user()->flashcardDecks()->find()`) — nem `Model::find()` + utólagos
összehasonlítás. Throttle mindegyiken (`player-write`, `ext-write`, `player-pair` stb.).

### 1.3 Saját szavak (5)

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 16 | POST | `custom-words` | `UserCustomWordController@store` | **FR** `StoreUserCustomWordRequest` | user-scoped unique ✅ |
| 17 | PATCH | `custom-words/{customWord}` | `@update` | **FR** `UpdateUserCustomWordRequest` | Gate::authorize ✅ |
| 18 | DELETE | `custom-words/{customWord}` | `@destroy` | body-mentes | Gate::authorize ✅ |
| 19 | POST | `custom-words/{customWord}/importance` | `@importance` | inline | int 1–5 ✅ |
| 20 | POST | `custom-words/{customWord}/status` | `@status` | trait | `in:` 5 státusz ✅ |

### 1.4 Flashcard paklik / kártyák / mappák (26)

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 21 | POST | `flashcards` | `FlashcardDeckController@store` | **FR** `StoreFlashcardDeckRequest` | `folder_id` **user-scoped** exists ✅ |
| 22 | PATCH | `flashcards/{deck}` | `@update` | **FR** `UpdateFlashcardDeckRequest` | |
| 23 | DELETE | `flashcards/{deck}` | `@destroy` | body-mentes | abort_unless ✅ |
| 24 | PUT | `flashcards/{deck}/settings` | `@updateSettings` | **FR** `UpdateFlashcardDeckSettingsRequest` | 13 int mező **mind min+max** ✅ |
| 25 | DELETE | `flashcards/{deck}/settings` | `@destroySettings` | body-mentes | abort_unless ✅ |
| 26 | POST | `flashcards/folders` | `FlashcardFolderController@store` | inline | `name` max:50 ✅ |
| 27 | PATCH | `flashcards/folders/{flashcardFolder}` | `@update` | inline | `name` max:50 ✅ |
| 28 | DELETE | `flashcards/folders/{flashcardFolder}` | `@destroy` | body-mentes | Gate ✅ |
| 29 | PATCH | `flashcards/folders/{f}/decks/{d}` | `FlashcardFolderDeckController@update` | inline | `in_folder` required boolean ✅ |
| 30 | POST | `flashcards/{deck}/cards` | `FlashcardCardController@store` | **FR** `StoreFlashcardRequest` | |
| 31 | PATCH | `flashcards/{deck}/cards/{flashcard}` | `@update` | **FR** `UpdateFlashcardRequest` | |
| 32 | DELETE | `flashcards/{deck}/cards/{flashcard}` | `@destroy` | body-mentes | dupla abort_unless ✅ |
| 33 | POST | `.../cards/{flashcard}/duplicate` | `@duplicate` | body-mentes | keret-foglalás ✅ |
| 34 | POST | `.../cards/{flashcard}/move` | `@move` | inline | target_deck tulajdon ellenőrizve ✅ |
| 35 | POST | `.../cards/{flashcard}/reset` | `@resetProgress` | body-mentes | dupla abort_unless ✅ |
| 36 | POST | `.../cards/import` | `@importFromWord` | inline | `required_without` pár ✅ |
| 37 | POST | `.../cards/bulk-delete` | `@bulkDelete` | inline | **`ids` array korlát nélkül** → VAL-1 |
| 38 | POST | `.../cards/bulk-reset` | `@bulkReset` | inline | **`ids` array korlát nélkül** → VAL-1 |
| 39 | POST | `.../cards/bulk-move` | `@bulkMove` | inline | **`ids` array korlát nélkül** → VAL-1 |
| 40 | POST | `.../cards/bulk-reverse` | `@bulkReverse` | inline | **`ids` array korlát nélkül** → VAL-1 |
| 41 | POST | `.../cards/bulk-direction` | `@bulkDirection` | inline | **`ids` array korlát nélkül** → VAL-1; `direction` in: ✅ |
| 42 | POST | `flashcards/{deck}/csv-import` | `FlashcardCsvController@import` | inline | file mimes+max:2048, `direction` in: ✅ |
| 43 | POST | `flashcards/{deck}/calibrate` | `FlashcardCalibrationController@rate` | inline | `rating` between:1,4 ✅, 6 spread-mező min/max ✅ |
| 44 | POST | `flashcards/{deck}/calibrate/skip` | `@skip` | body-mentes | abort_unless ✅ |
| 45 | POST | `flashcards/{deck}/study` | `FlashcardStudyController@submit` | **FR** `SubmitFlashcardReviewRequest` | `rating` 1–4 ✅; exists unscoped → VAL-4 (INFO) |
| 46 | POST | `flashcards/{deck}/study/undo` | `@undo` | inline | deck-scoped újralekérdezés ✅ |

### 1.5 Szó-mappák és szavak (5)

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 47 | POST | `folders` | `FolderController@store` | inline | max:50 + user-scoped unique + 100-as plafon ✅ |
| 48 | PATCH | `folders/{folder}` | `@update` | inline | user-scoped unique ✅ |
| 49 | DELETE | `folders/{folder}` | `@destroy` | body-mentes | Gate ✅ |
| 50 | PATCH | `folders/{folder}/words/{word}` | `FolderWordController@update` | inline | `in_folder` required boolean ✅ |
| 51 | PATCH | `words/{word}` | `WordController@update` | inline | `can:admin` + minden mezőn max: ✅ |
| 52 | POST | `words/{word}/importance` | `@importance` | inline | int 1–5 ✅ |
| 53 | POST | `words/{word}/status` | `@status` | trait | `in:` ✅ |

### 1.6 Szövegelemző (7)

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 54 | POST | `text-analysis/analyze` | `@analyze` | inline | `text` **max:15000** ✅ + napi keret ✅ |
| 55 | POST | `text-analysis/books` | `@uploadBook` | inline | mimetypes+extensions+**max:30720** ✅ |
| 56 | DELETE | `text-analysis/books/{book}` | `@deleteBook` | body-mentes | abort_unless ✅ |
| 57 | POST | `text-analysis/fetch-source` | `@fetchSource` | inline | `url:http,https` max:2000 + SSRF-guard ✅ |
| 58 | POST | `text-analysis/youtube` | `@storeYoutube` | inline | `url:http,https` max:2000 ✅ |
| 59 | DELETE | `text-analysis/youtube/{transcript}` | `@deleteYoutube` | body-mentes | abort_unless ✅ |
| 60 | POST | `words/sentence-check` | `@sentenceCheck` | inline | `word` **regex + max:100**, `sentence` min:3 **max:500** ✅ |

A `sentenceCheck` a prompt-injekció szempontjából is szűk: a `word` mezőn
`regex:/^[\pL][\pL'\- ]*$/u` fut, a `sentence` 500 karakterre vágva.

### 1.7 Onboarding / bejelentés / előfizetés (8)

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 61 | POST | `onboarding` | `OnboardingController@complete` | inline | **array korlát nélkül + elemenkénti exists** → VAL-2 |
| 62 | POST | `pricing/checkout/{plan}` | `PricingController@checkout` | inline + abort | `$plan==='premium'` abort_unless ✅, `accept_terms` accepted ✅ |
| 63 | POST | `pricing/portal` | `@portal` | body-mentes | throttle:10,1 ✅ |
| 64 | POST | `report` | `ReportController@store` | **FR** `StoreReportRequest` | `category` Rule::in ✅, napi 20-as fék ✅ |
| 65 | POST | `stripe/webhook` | `StripeWebhookController@handleWebhook` | aláírás | Cashier signature-verifikáció ✅ |
| 66 | POST | `settings/subscription/cancel` | `SubscriptionController@cancel` | body-mentes | ✅ |
| 67 | POST | `settings/subscription/portal` | `@portal` | body-mentes | ✅ |
| 68 | POST | `settings/subscription/resume` | `@resume` | body-mentes | ✅ |

### 1.8 Settings (8) — entitlement-érintők, szigorúbb mérce

| # | Metódus | URI | Controller::method | Validáció | Megjegyzés |
|---|---|---|---|---|---|
| 69 | PUT | `settings/billing` | `BillingController@update` | **FR** `BillingUpdateRequest` | lásd lent |
| 70 | PUT | `settings/flashcards` | `FlashcardController@update` | **FR** `FlashcardSettingRequest` | 19 int mező **mind min+max** ✅ |
| 71 | PUT | `settings/password` | `SecurityController@update` | **FR** `PasswordUpdateRequest` | `current_password` + erősség ✅ |
| 72 | PATCH | `settings/profile` | `ProfileController@update` | **FR** `ProfileUpdateRequest` | e-mail-váltásnál **current_password kötelező** ✅ |
| 73 | DELETE | `settings/profile` | `@destroy` | **FR** `ProfileDeleteRequest` | jelszó-megerősítés ✅ |
| 74 | DELETE | `settings/security/player-devices` | `@revokeAllPlayerDevices` | body-mentes | csak `player`-ability tokenek ✅ |
| 75 | DELETE | `settings/security/player-devices/{tokenId}` | `@revokePlayerDevice` | body-mentes | `user()->tokens()->whereKey()` **user-scoped** ✅ |
| 76 | * | `settings` | `RedirectController` | n/a | Laravel belső redirect |

**A billing-lánc minőségi értékelése (`BillingValidationRules`):** ez a lánc a
mintaértékű a projektben. `billing_country` → `Rule::in(['HU'])` allowlist;
`billing_zip` → `regex:/^\d{4,10}$/`; `billing_tax_number` → `required_if:company`
**+ `prohibited_if:individual`** + magyar formátum-regex; `billing_type` →
`Rule::in(['individual','company'])`; a NAV-számlára kerülő szabad-szöveges mezőkön
(`name`/`city`/`address`) vezérlőkarakter-tiltó regex. **Nincs itt gyenge szabály.**

**A `revokePlayerDevice` külön kiemelendő:** a `{tokenId}` route-paraméter *nem*
`exists` szabállyal jön, hanem `$request->user()->tokens()->whereKey($tokenId)` —
azaz a tulajdon a lekérdezésbe van beépítve, plusz `isPlayerToken()` szűkítés
(szándékosan nem `->can('player')`, hogy egy `*`-token ne eshessen ide). Ez a
helyes minta; IDOR-mentes.

---

## 2. Összesített lefedettség

| Kategória | Darab |
|---|---|
| FormRequest-tel validál | 15 |
| Inline `$request->validate()` | 36 |
| Trait-helper (`validatedToggleStatus`) | 3 |
| Body-mentes erőforrás-akció | 21 |
| Aláírás-alapú (Stripe webhook) | 1 |
| **Validáció nélkül DB-be jutó request-input** | **0** |

### A grep-alapú ellenőrzés eredménye (feladat 2. pont)

Az `app/Http/Controllers/` alatt keresett nyers input-olvasók
(`$request->input(`, `->get(`, `->all()`, `->string(`, `->integer(`, `->boolean(`,
`->json(`) **mind** validált mezőt olvasnak vissza, vagy olvasási/szűrési útvonalon
vannak (nem mutáló). Kiemelendő két minta, amit külön ellenőriztem:

- `FlashcardStudyController:82-93` — `$request->integer('flashcard_id')` /
  `->string('direction')` / `->integer('rating')`: a metódus szignatúrája
  `SubmitFlashcardReviewRequest`, tehát a FormRequest **már lefutott** a törzs
  előtt. A nyers olvasás validált értéket ad vissza. **Nem hézag.**
- `WordController:30-37, 293-307` — `index`/`export` szűrő-paraméterek: ezek GET
  olvasási utak, nem mutálnak; a `per_page` `in_array(...ALLOWED_PER_PAGE)`
  allowlisttel, a `count` `min(max(...), $maxCount)` clamppel védett.
- `FlashcardCsvController:32` — `$request->input('direction')` **után** olvas, de a
  `validate()` a 27. sorban `in:front_to_back,back_to_front,both` szabállyal már
  lefutott rá. **Nem hézag.**

**`$request->all()` egyetlen mutáló kontrollerben sem fordul elő** — nincs
tömeges-hozzárendelési felület a validáció megkerülésével.

---

## 3. LELETEK

### VAL-1 — Korlátlan `ids` tömb az 5 bulk-műveleten: kvadratikus validátor-költség throttle nélkül

- **Fájl:sor:** `app/Http/Controllers/FlashcardCardController.php:205-208` (bulkDelete),
  `:219-222` (bulkReset), `:236-239` (bulkReverse), `:279-283` (bulkDirection),
  `:304-309` (bulkMove)
- **Súlyosság:** **MEDIUM**
- **Verifikációs verdikt:** **CONFIRMED** (mérve)

**Támadási forgatókönyv (bemenet/állapot → hatás):**

Bemenet: egy hitelesített, e-mail-verifikált felhasználó (bármelyik csomag, **Free is**)
saját paklijára POST-ol `application/json` törzzsel:

```
POST /flashcards/{sajat-deck}/cards/bulk-delete
Content-Type: application/json
{"ids": [1,2,3, ... 200000]}
```

A szabály `'ids' => ['required','array']` — **nincs `max:`**. Hatás:

1. A `ids.*` szabály kibontása a `ValidationRuleParser`-ben elemenként történik, és
   a költség **kvadratikus**. Mért görbe (ugyanezen a gépen, ugyanezzel a szabály-
   párral):

   | elemszám | idő |
   |---|---|
   | 1 000 | 0,018 s |
   | 4 000 | 0,162 s |
   | 8 000 | 0,555 s |
   | 16 000 | 2,359 s |
   | 32 000 | **8,045 s** |

   4× bemenet ≈ 10× idő — egyértelműen szuperlineáris.

2. 200 000 elemnél a folyamat **memóriát merít ki** a validátoron belül, még mielőtt
   bármilyen alkalmazás-logika elindulna:
   ```
   PHP Fatal error: Allowed memory size of 134217728 bytes exhausted
     in vendor/laravel/framework/src/Illuminate/Validation/ValidationRuleParser.php:227
   ```

3. A payload **olcsó**: 50 000 elem mindössze **0,28 MB** JSON. A `post_max_size`
   120 MB, tehát a méret nem fék.

4. **A `max_input_vars = 1000` NEM véd**, mert az kizárólag form-encoded törzsre
   vonatkozik. Mérve: JSON törzsből 50 000 elem **hiánytalanul beolvasódik**
   (`count($req->input('ids')) === 50000`), miközben `ini_get('max_input_vars') === 1000`.
   A frontend Inertia/JSON-t küld, tehát ez a valós út.

5. **Nincs throttle.** A `route:list` szerint az 5 bulk-route middleware-lánca:
   `web, Authenticate, EnsureEmailIsVerified, EnsureOnboardingComplete` — **nincs
   `ThrottleRequests`**. Így a kérés tetszőleges ütemben ismételhető.

6. A költség **a jogosultsági/keret-ellenőrzés ELŐTT** merül fel: a `validate()` a
   metódus elején fut, a `reserveFlashcardSlots()` keret-kapu csak utána. Vagyis a
   Free-csomag kártyakerete **nem korlátozza** ezt a terhelést.

**Hatás:** egyetlen Free fiók néhány párhuzamos, ~0,3 MB-os kéréssel PHP-worker(eke)t
tud másodpercekre lekötni, illetve fatal error-ral eldobatni — aszimmetrikus
erőforrás-fogyasztás (támadói költség ~0, szerverköltség másodpercek/worker).

**Indoklás a MEDIUM súlyra:** hitelesítés + e-mail-verifikáció szükséges (ez fogja
vissza HIGH-ról), és adat-integritás **nem** sérül — a `$deck->flashcards()->whereIn()`
scope miatt idegen kártya nem érinthető (lásd VAL-3). Viszont a vektor mérten
kihasználható, throttle-mentes, és a csomag-keretet megkerüli, ami LOW fölé emeli.

---

### VAL-2 — Onboarding: korlátlan tömb + elemenkénti `exists` = kérésenkénti N DB-lekérdezés, throttle nélkül

- **Fájl:sor:** `app/Http/Controllers/OnboardingController.php:51-56`
- **Súlyosság:** **MEDIUM**
- **Verifikációs verdikt:** **CONFIRMED** (mérve)

**Támadási forgatókönyv:**

```php
'known_word_ids'   => ['array'],            // nincs max:
'known_word_ids.*' => ['integer','exists:words,id'],
'shown_word_ids'   => ['array'],            // nincs max:
'shown_word_ids.*' => ['integer','exists:words,id'],
```

Bemenet: hitelesített, még nem onboardolt felhasználó POST-ol JSON törzzsel
50 000-50 000 elemet a két mezőbe.

Mérés: **300 elem → 300 külön DB-lekérdezés** (0,157 s). Az `exists` szabály
elemenként önálló `select exists(...)` lekérdezést futtat — nincs `whereIn`-be
összevonás. Tehát 50 000 elem ≈ **50 000 DB round-trip egyetlen HTTP-kérésre**,
ráadásul a VAL-1-ben mért kvadratikus parser-költség **tetejébe**.

Throttle: **nincs**. A `route:list` szerint `POST onboarding` lánca
`web, Authenticate, EnsureEmailIsVerified` — semmi rate limit.

Súlyosbító körülmény: a `complete()` az **egyetlen** út, ami az onboarding-kaput
kinyitja, és a validáció után a `$shownByLevel` ciklus szintjenként további
`Word::where('level',...)->count()` + `->take($markCount)->pluck('id')`
lekérdezéseket futtat, majd egy `upsert`-öt a `user_word` táblára — a
`$wordIdsToMark` mérete a szólista teljes méretéig nőhet.

**Hatás:** DB-connection-pool kimerítés / lassulás egyetlen hitelesített fiókból,
alacsony támadói költséggel. Adat-integritási hatás nincs: az `upsert` a saját
`user_id`-re megy, idegen sor nem érinthető.

**Indoklás:** ugyanaz a MEDIUM-logika, mint VAL-1-nél — auth mögött van, de mérten
kihasználható, throttle-mentes, és itt a DB is terhelődik, nem csak a PHP-worker.
Megjegyzés: a korábbi Fázis 5 audit már mért `exists` N+1-et (10k elem ≈ 2,6 s);
ez ugyanannak a mintának egy másik, **throttle nélküli** előfordulása.

---

### VAL-3 — A bulk-műveletek `ids`-eleme nem `exists`-elt, de a tulajdon **relációval** garantált (nem IDOR)

- **Fájl:sor:** `app/Http/Controllers/FlashcardCardController.php:210, 224, 241, 285, 314`
- **Súlyosság:** **INFO**
- **Verifikációs verdikt:** **REFUTED** (mint sebezhetőség)

A feladat külön kérte az `ids`-elemek tulajdon-ellenőrzésének vizsgálatát. Az
`ids.*` szabály valóban csak `['integer']` — **nincs** `exists`, és nincs
user-scope a validációban. Ez azonban **nem** IDOR, mert a végrehajtás minden
ágon a pakli-reláción keresztül szűkít:

```php
$deck->flashcards()->whereIn('id', $ids)->delete();      // bulkDelete:210
$ownedIds = $deck->flashcards()->whereIn('id', $ids)->pluck('id');  // bulkReset:224, bulkDirection:285, bulkMove:314
$cards = $deck->flashcards()->whereIn('id', $ids)->get(); // bulkReverse:241
```

Maga a `$deck` pedig a metódus első sorában `abort_unless($deck->user_id ===
$request->user()->id, 403)` ellenőrzésen esik át. Idegen kártya ID-ja tehát
egyszerűen **nem illeszkedik** — a `whereIn` üresen tér vissza.

A követő műveletek is a leszűrt `$ownedIds`-t használják (nem a nyers `$ids`-t),
beleértve a `FlashcardReview::whereIn('flashcard_id', $ownedIds)` törléseket —
ez helyes, mert a `FlashcardReview` közvetlen `whereIn` a nyers ID-kkal
IDOR lenne. **A kód itt szándékosan és helyesen jár el.**

`bulkMove` a cél-paklit is ellenőrzi: `FlashcardDeck::findOrFail()` +
`abort_unless($targetDeck->user_id === ...)` (`:311-312`). Ugyanez `move`-ban (`:149-150`).

Az egyetlen fennmaradó megjegyzés: a `bulkReverse` a `$cards->count()` alapján
foglal keretet (`reserveFlashcardSlots`), tehát a kártyakeret **nem** kerülhető meg
tömeges duplikálással. Ellenőrizve: `User::reserveFlashcardSlots` (`app/Models/User.php:313`)
zár alatt hívja a `canAddFlashcards($count)`-ot.

---

### VAL-4 — `exists:flashcards,id` user-scope nélkül a `SubmitFlashcardReviewRequest`-ben

- **Fájl:sor:** `app/Http/Requests/SubmitFlashcardReviewRequest.php:18`
- **Súlyosság:** **INFO**
- **Verifikációs verdikt:** **REFUTED** (mint IDOR)

A szabály `'flashcard_id' => ['required','integer','exists:flashcards,id']` — a
`exists` **nem** szűkít `user_id`-re, tehát a validáció önmagában átengedi egy
idegen felhasználó kártya-ID-ját. A kontroller azonban közvetlenül utána
újralekérdez deck-scope-pal:

```php
// FlashcardStudyController.php:82-84
$flashcard = Flashcard::where('id', $request->integer('flashcard_id'))
    ->where('deck_id', $deck->id)
    ->firstOrFail();
```

és a `$deck` már átment az `abort_unless($deck->user_id === $request->user()->id, 403)`
kapun (`:80`). Idegen ID tehát 404-et kap, nem szivárogtat.

**Maradék-információ:** a validációs hibaüzenet elvi különbséget tesz „nem létező
ID" (422 validation error) és „létező, de nem a tiéd" (404) között. Ez elméletileg
egy kártya **létezésére** vonatkozó bit — de a `flashcards.id` egy
auto-increment számláló, aminek a nagyságrendje amúgy sem titok, és a saját
kártyák ID-jaiból triviálisan becsülhető. Gyakorlati haszon nélkül → INFO.

Ugyanez a minta (unscoped `exists` + kontroller-oldali scope) áll fenn:
- `FlashcardCardController:69-70` — `word_id` / `custom_word_id`; a `custom_word_id`
  ágon a kontroller `->where('user_id', $request->user()->id)->firstOrFail()`-t
  futtat (`:74-76`) ✅
- `FlashcardCardController:145, 307` — `target_deck_id`; utána
  `abort_unless($targetDeck->user_id === ...)` ✅
- `StoreFlashcardRequest:19`, `ExtensionController:256` — `word_id` a **globális**
  `words` táblára mutat, ami minden felhasználónak közös, olvasható törzsadat →
  itt a user-scope értelmezhetetlen, nem hiányosság ✅
- `StoreReportRequest:26` — `word_id` szintén a közös `words` táblára ✅

Ellenpélda a helyes mintára: `StoreFlashcardDeckRequest:24` **user-scoped**
`Rule::exists('flashcard_folders','id')->where('user_id', $this->user()->id)` —
ez a projekt saját, működő mintája ilyen esetekre.

---

### VAL-5 — `AdminController@destroyInvite` és a body-mentes admin-akciók

- **Fájl:sor:** `app/Http/Controllers/AdminController.php:143-148`
- **Súlyosság:** **INFO**
- **Verifikációs verdikt:** **CONFIRMED** (mint szándékos, helyes tervezés)

A `destroyInvite(Invite $invite)` nem validál semmit — de nincs is mit: nem olvas
request-inputot, a cél route-model-bindinggel jön, és a route
`can:admin` gate mögött van (`routes/web.php:46`). Ez **helyes** body-mentes
erőforrás-akció, nem hézag. Ugyanez vonatkozik a többi 20 body-mentes végpontra
(lásd a 2. szakasz táblázatát).

Az admin mutáló végpontok validáció-minősége a mérce szerint **megfelel**:
`setAccess` a `plan` mezőt `in:none,premium`-mal zárja (nem fogad el tetszőleges
plan-stringet), `storeInvite` a `max_uses`-t `min:1|max:10000` közé szorítja
(nincs korlátlan felhasználású meghívó), `updateReportStatus` `Rule::in(Report::STATUSES)`-t
használ. **Nincs itt gyenge szabály.**

---

### VAL-6 — `TogglesWordStatus::validatedToggleStatus` request-mutáció validáció előtt

- **Fájl:sor:** `app/Concerns/TogglesWordStatus.php:19-28`
- **Súlyosság:** **INFO**
- **Verifikációs verdikt:** **CONFIRMED** (ártalmatlan)

A helper a validáció **előtt** átírja a request-et:

```php
if ($request->input('status') === '') {
    $request->merge(['status' => null]);
}
return $request->validate([
    'status' => ['nullable','string','in:'.implode(',', self::TOGGLE_STATUSES)],
])['status'] ?? null;
```

A `merge()` csak az üres stringet fordítja `null`-ra (a bővítmény ezt küldi
„státusz levétele" jelentéssel), és a `null` a `nullable` miatt érvényes. Minden
más érték változatlanul megy az `in:` allowlistre. Nincs olyan bemenet, ami a
merge-en keresztül megkerülné az allowlistet. Az `in:` az 5 elemű
`TOGGLE_STATUSES` konstansból épül, nem felhasználói adatból.

Megjegyzés a teljesség kedvéért: a `reserveExtensionStatusWrite()` az `Origin`
fejlécből dönt a kvóta-terhelésről (`isFromExtension`, `:67-74`). Az `Origin`
hamisítható curl-ból, de **fordított** irányban: elhagyásával a kvótát lehetne
kerülni, nem terhelni. Ezt a `throttle:60,1,word-writes` (`routes/words.php:24`)
fogja meg, és a kód-komment explicit hivatkozik erre a tervezési döntésre. Nem
validációs hézag → a DIM2 hatókörén kívül, csak jelzés.

---

## 4. Regresszió-vizsgálat az előző (2026-07-20) körhöz képest

Az előző audit VAL-1/VAL-2 leletei így szóltak: *„CONFIRMED tiszta — mind a 77
mutáló route validál."*

**A „mind validál" állítás ma is IGAZ** — 0 olyan végpontot találtam, ahol
request-input validáció nélkül jutna DB-be vagy üzleti logikába (lásd 2. szakasz).
Ebben a szűk értelemben **nincs regresszió**.

**Ugyanakkor az előző verdikt hatóköre szűk volt:** a validáció *meglétét* mérte,
a *minőségét* nem. Az idei kör 3. feladatpontja (validáció-minőség) explicit
kérésre nézte a hiányzó `max:`/`in:`/elem-szabályokat, és így jött elő a VAL-1 és
VAL-2 — **mindkettő már 2026-07-20-kor is fennállt** (a `git log` szerint a
`FlashcardCardController` bulk-metódusai és az `OnboardingController@complete`
azóta nem változtak érdemben). Tehát:

- **NEM új regresszió**, hanem az előző kör **hatóköri vakfoltja**.
- Az előző „tiszta" verdikt **nem érvénytelen**, csak **szűkebb**, mint ahogy a
  PLAN-ban rögzítve lett. Javaslom a PLAN-ban a VAL-1/VAL-2 verdiktjét
  „meglét: tiszta / minőség: nem vizsgált"-ra pontosítani.

A 77 → 76 route-változás kizárólag a kivezetett feature-ökből ered, nem
validáció-vesztésből.

---

## 5. Összegzés

| Súlyosság | Darab | Azonosítók |
|---|---|---|
| HIGH | 0 | — |
| **MEDIUM** | **2** | VAL-1, VAL-2 |
| LOW | 0 | — |
| INFO | 4 | VAL-3, VAL-4, VAL-5, VAL-6 |

**Fő megállapítások:**

1. **A lefedettség hiánytalan.** Mind a 76 mutáló route validál, vagy body-mentes
   erőforrás-akció. `$request->all()` egyetlen mutáló kontrollerben sincs.
2. **Az IDOR-felület tiszta.** Ahol az `exists` nem user-scoped (4 hely), ott a
   kontroller kivétel nélkül reláción keresztül szűkít. A bulk-műveletek
   `ids`-listája nem validált elemenként, de a `$deck->flashcards()->whereIn()`
   scope miatt ez nem kihasználható (VAL-3).
3. **A 2 MEDIUM közös gyökere ugyanaz:** korlátlan méretű tömb-bemenet olyan
   végponton, aminek **nincs throttle-ja**. Mindkettő erőforrás-kimerítés, nem
   adat-integritási hiba.
4. **A pénzügyi és entitlement-lánc mintaértékű** (`BillingValidationRules`:
   allowlist + regex + `prohibited_if`; admin: minden enum `in:`-zárt;
   `revokePlayerDevice`: tulajdon a lekérdezésbe építve).
5. **A PLAN „8 FormRequest" adata elavult** — a tényleges szám 15.

**Megjegyzés a hatókörről:** ez az audit kizárólag dokumentál. A VAL-1/VAL-2
kézenfekvő ellenszere (`'ids' => ['required','array','max:N']` + throttle,
illetve az `exists` `whereIn`-esítése) **szándékosan nincs implementálva** —
a javítás külön, explicit kérésre tartozik.
