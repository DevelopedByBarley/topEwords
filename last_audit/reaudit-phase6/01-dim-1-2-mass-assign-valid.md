# Fázis 6 — Dimenzió 1 (Mass-assignment) + Dimenzió 2 (Validáció-lefedettség)

> Független finder + adverzariális verifikáció. Csak dokumentálás.
> Séma: **fájl · sor · súlyosság · forgatókönyv · verifikációs verdikt.**

---

## Dimenzió 1 — Mass-assignment / `$fillable` / `$guarded` sweep (18 modell)

### Módszer
1. `grep '\$fillable|\$guarded'` → 5 modell klasszikus `protected $fillable`, a többi „üresnek" tűnt.
2. Kontroll-grep `#\[Fillable` → a maradék 13 az L13-stílusú **`#[Fillable([...])]` attribútumot** használja (nem hiányzik a védelem).
3. `grep 'unguard|shouldBeStrict|Model::'` a Provider/bootstrap alatt → **nincs globális `unguard()`**.
4. `grep '->(create|update|fill)\(\s*\$request->(all|input)\(\))'` → **0 találat** (nincs nyers `request->all()` mass-assign sink).
5. `user_id`-t tartalmazó fillable-ök create-helyeinek bejárása.

### Fillable-térkép (érzékeny mezők jelölve)

| Modell | Érzékeny mező a fillable-ban? | Verdikt |
|---|---|---|
| User | **NINCS** `is_admin`/`stripe_*`/`ai_*`/`lifetime_access`/`plan_override`/`trial_ends_at`/`invite_id`/`billingo_partner_id`/`terms_accepted_at` | tiszta |
| Flashcard | `is_imported` (nem érzékeny, de keret-releváns → MA-4) | LOW |
| Word | admin-only content-mezők | tiszta (admin-gate) |
| UserCustomWord | `user_id`,`status`,`importance` | tiszta (rel-scope + szűk update) |
| UserBook / YoutubeTranscript / UserAchievement / BillingoInvoice | `user_id` | tiszta (hardcoded `$user->id`) |
| FlashcardDeck/Folder/Setting/DeckSetting/Review/AiWordCache/Invite/IrregularVerb/PlayerPairing | – | tiszta |

---

### MA-1 — „13 modell védelem nélkül" — REFUTED
- **Fájl/sor:** `app/Models/*.php` (Flashcard, FlashcardDeck, Folder, Invite, IrregularVerb, PlayerPairing, User, UserCustomWord, Word, FlashcardDeckSetting, FlashcardReview, FlashcardSetting, FlashcardFolder).
- **Súlyosság:** INFO.
- **Forgatókönyv (feltételezett):** ha nincs `$fillable`/`$guarded`, a modell mass-assignálható lehet.
- **Verifikáció:** a 13 modell mind `#[Fillable([...])]` PHP-attribútumot használ (Laravel 13 stílus) — a `$fillable`-grep csak a régi property-formára illeszkedett. Nincs `unguard()`. **REFUTED** — a védelem megvan, csak más szintaxissal.

### MA-2 — `is_admin` mass-assign — REFUTED
- **Fájl/sor:** — (nincs ilyen oszlop).
- **Súlyosság:** INFO.
- **Forgatókönyv (feltételezett, a PLAN nevesíti):** `is_admin` átírása mass-assignmenttel.
- **Verifikáció:** a `users` táblában **nincs `is_admin` oszlop**; az admin-jogot `ADMIN_EMAIL`-alapú `Gate::define('admin', …)` adja. **REFUTED** — a vektor tárgytalan.

### MA-3 — entitlement/billing mezők a User fillable-ban — CONFIRMED tiszta
- **Fájl/sor:** `app/Models/User.php:30` (`#[Fillable([...])]`).
- **Súlyosság:** INFO.
- **Forgatókönyv:** `PATCH settings/profile` vagy más User-update payloadban `stripe_id`/`ai_credit_limit`/`lifetime_access`/`plan_override` átcsempészése → fizetős hozzáférés / consent-hamisítás.
- **Verifikáció:** a fillable pontosan `['name','email','password','streak','last_activity_date','quiz_completions','text_analyses','onboarding_completed_at','billing_*']`. Egyik entitlement/billing-vezérlő mező **sincs** benne. A ténylegesen ezeket állító helyek: `PricingController:101 forceFill(terms_accepted_at)`, `SecurityController:132 forceFill`, `CreateNewUser:85 forceFill(invite_id)`, `ResetUserPassword:25 forceFill`, `InvoiceGenerator:238 forceFill(billingo_partner_id)`, Cashier-belső — mind szerver-oldali, request-payloadtól független. **CONFIRMED tiszta.**

### MA-4 — `is_imported` a Flashcard fillable-ban — CONFIRMED (LOW, defense-in-depth)
- **Fájl/sor:** `app/Models/Flashcard.php:11` (`#[Fillable([... 'is_imported'])]`); create: `FlashcardCardController.php:51 $deck->flashcards()->create($request->validated())`.
- **Súlyosság:** LOW.
- **Forgatókönyv:** a user manuálisan létrehozott kártyához `is_imported:true`-t küld → a kalibrációs sorba tolná (vagy `false`-szal kihagyná) a kártyát a szándékolt SRS-folyamat helyett.
- **Verifikáció:** a `store` a `StoreFlashcardRequest`-en megy át, ami **nem** tartalmaz `is_imported` szabályt (`grep` megerősítve) → `$request->validated()` sosem adja vissza a kulcsot, tehát a create default értéket (`false`) használ. A vektor **jelenleg zárt**, DE csak a FormRequest-diszciplína zárja (a fillable engedné). Ha valaha egy jövőbeli create-hely `$request->all()`-t vagy tágabb inline-t használna, kinyílna. **CONFIRMED mint defense-in-depth-rés, nem mint aktív hiba.** (0 blast radius: az `is_imported` csak SRS-besorolást érint a saját kártyákon, nem kvótát/pénzt.)

---

## Dimenzió 2 — Validáció-lefedettség (77 mutáló route)

### Módszer
`route:list --except-vendor` → 77 POST/PUT/PATCH/DELETE saját route. Minden érintett controller-metódusra: FormRequest type-hint VAGY inline `$request->validate(` VAGY megosztott validált-helper VAGY body-mentes erőforrás-akció.

### Lefedettségi eredmény

| Validációs minta | Route-ok (példa) | Verdikt |
|---|---|---|
| **FormRequest** (14 db) | Flashcard store/update, FlashcardDeck store/update/settings, UserCustomWord store/update, FlashcardStudy submit, Settings (profile/password/billing/flashcards/2FA) | validál |
| **Inline `validate()`** | admin (setAccess/grantFreeMonth/storeInvite), Extension (addWord/createFlashcard/updateStatus/updateImportance), PlayerPairing (store/approve/exchange), Folder/FlashcardFolder store/update, FlashcardCard bulk-*, move, importFromWord, Calibration rate, CSV import, TextAnalysis (analyze/fetch-source/youtube/uploadBook/practiceCheck/sentenceCheck), Word update, Cloze — n.a., Quiz complete, Onboarding complete | validál |
| **Megosztott helper** `validatedToggleStatus()` (`app/Concerns/TogglesWordStatus.php`) | `Word@status`, `UserCustomWord@status` | validál |
| **Body-mentes erőforrás-akció** (ownership-check + path-modell, nincs request-body) | minden `destroy`, `resetProgress`, `duplicate`, calibration `skip`, deck `destroySettings`, player `disconnect`, `cloze/complete`, `subscription cancel/resume/portal` | n.a. (nincs mit validálni) |

### VAL-1 — „csak 8 FormRequest → hiányos validáció" — CONFIRMED tiszta
- **Fájl/sor:** teljes controller-réteg.
- **Súlyosság:** INFO.
- **Forgatókönyv (a PLAN feltevése):** a kevés FormRequest miatt vannak validálatlan mutáló végpontok, ahol tetszőleges/túlméretes bemenet átcsúszik.
- **Verifikáció:** ténylegesen **14** FormRequest van (nem 8), és minden fennmaradó mutáló route inline `validate()`-tel, megosztott helperrel dolgozik, **vagy nem fogyaszt request-body-t**. Kézzel bejárva a „nincs látható validate" gyanús metódusok (`Cloze@complete`, `Word/UserCustomWord@status`, `Calibration@skip`, `Flashcard@resetProgress/duplicate/destroy`, `PlayerPairing@disconnect`): mind body-mentes vagy helper-validált. **CONFIRMED tiszta.**

### VAL-2 — érzékeny-állapot végpontok validációja — CONFIRMED tiszta
- **Fájl/sor:** `AdminController.php:146,171`; `WordController.php:519`.
- **Súlyosság:** INFO.
- **Forgatókönyv:** admin/entitlement-mutáló végpont gyenge validációval.
- **Verifikáció:** `setAccess` → `plan` `in:none,premium` + `email` `exists:users,email`, és a `plan_override`-ot **direkt property-set**-tel írja (nem fillable). `grantFreeMonth` → `email` `exists`, `trial_ends_at` direkt set. `WordController@update` → `Gate::authorize('admin')` + per-mező `max:` szabályok. Mindhárom auth-gate mögött (Fázis 1 hatáskör). **CONFIRMED tiszta.**

---

## Dimenzió 1+2 összegzés
**0 HIGH · 0 MEDIUM · 1 LOW (MA-4) · 5 INFO.** A mass-assignment- és validáció-premissza megdőlt; a rendszer strukturálisan zárt, egyetlen defense-in-depth megjegyzéssel (`is_imported`).
