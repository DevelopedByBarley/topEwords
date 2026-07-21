# Fázis 5 — Dimenzió B: Onboarding flow state-manipuláció

> Független finder + adverzariális verifikáció. Csak dokumentálás.
> Scope: `OnboardingController`, `EnsureOnboardingComplete`, migráció, minden middleware-csoport.

---

### [ONB-1] A POST onboarding kliens-vezérelt tömeges known-szó self-grant + achievement-farm
- **Fájl:sor:** app/Http/Controllers/OnboardingController.php:49-102
- **Súlyosság:** LOW
- **Kategória:** self-grant
- **Forgatókönyv:** A `complete` a kliens `shown_word_ids`-jét és `known_word_ids`-jét fogadja el. Egy támadó közvetlenül POST-ol: `shown_word_ids = [minden szint minden ID-ja]`, `known_word_ids = ugyanaz`. A szerver szintenként `ratio = knownCount/shownCount = 1.0`-t számol, majd `markCount = round(1.0 * totalInLevel)` = a TELJES szint. Eredmény: egyetlen kéréssel ~9 994 szó `status='known'`-ra kerül a `user_word` táblában, és a :106 `checkAndAward(['vocab','known','level'])` azonnal kiosztja a `vocab_*`, `known_*`, `level_1..6_complete` badge-eket.
- **Blast radius:** Kizárólag self-directed és kozmetikai. Megerősítve: (a) NINCS leaderboard/ranglista/publikus profil; (b) az achievementek CSAK badge-ek (display-only, semmilyen entitlement/Pro-kapu/pénz nem függ tőlük); (c) a `known` státusz csak tartalom-kiválasztást (kvíz/gyakorló pool, érthetőség-%) befolyásol, NEM kvótát/limitet/fizetést. A user csak a saját tanulási statisztikáját rontja el.
- **Verifikációs verdikt:** CONFIRMED (mint mechanizmus), súlyosság LOW. Cáfoló-kör: (1) "Fel lehet-e valamit értékben szerezni?" — nem, az achievement vizuális. (2) "Van szerveroldali validáció a mennyiségre?" — a `known_word_ids.*` `exists:words,id`, a `markCount ≤ totalInLevel` matematikailag korlátos (nincs overflow/negatív), de MENNYISÉGI plafon nincs. (3) "Más user-t érint?" — nem, `$user->id`-re kötött upsert.

---

### [ONB-2] A POST onboarding nem idempotens — befejezett onboarding után újra beküldhető
- **Fájl:sor:** app/Http/Controllers/OnboardingController.php:49 + routes/web.php:65-68
- **Súlyosság:** LOW
- **Kategória:** idempotency
- **Forgatókönyv:** A `POST onboarding` route csak `['auth','verified']` alatt van — NINCS `EnsureOnboardingComplete` rajta (különben loop lenne), és a `complete` nem ellenőrzi, hogy `onboarding_completed_at` már be van-e állítva. Egy már befejezett user újra POST-olhat tetszőleges `shown/known` payloaddal → újra lefut a szó-markolás (upsert) és a `checkAndAward`.
- **Blast radius:** Gyakorlatilag nincs. A szó-markolás `upsert(..., ['user_id','word_id'], [...])` idempotens (ugyanazt a sort felülírja). Az achievement-kiosztás a `firstOrCreate` + unique-constraint miatt szintén idempotens (nem ad dupla badge-et). Az `onboarding_completed_at` újra `now()`-ra áll (ártalmatlan). A `show_tour` flash újra beáll (kozmetika).
- **Verifikációs verdikt:** REFUTED (mint kihasználható hiba). Cáfoló-kör: (1) dupla achievement/szó-grant? — nem, mindkét művelet idempotens. (2) 500/race dupla-POST-nál? — nem, a firstOrCreate a DB unique-constraintre támaszkodik. (3) Van értékes duplikálható jutalom? — nincs. Érdemes lenne egy korai `if ($user->onboarding_completed_at) return redirect()->route('dashboard')` a tisztaságért, de NEM biztonsági hiány.

---

### [ONB-3] Extension / player / AI (natív kliens) végpontok szándékosan NINCSENEK onboarding-gate mögött
- **Fájl:sor:** routes/extension.php, routes/api.php (api/player/*)
- **Súlyosság:** INFO
- **Kategória:** state-bypass (bypass-vizsgálat)
- **Forgatókönyv:** Az `extension/add-word`, `extension/create-flashcard`, és az `api/player/*` (add-word, create-flashcard, update-status, update-importance, gemini-lookup) tartalom-létrehozó, de NEM viseli az `EnsureOnboardingComplete`-et (extension = web+verified+throttle; player = api+sanctum+CheckAbilities:player). Egy onboarding NÉLKÜLI user az extension/player felől már szavakat vehet fel, mielőtt a webes onboardingot elvégezné.
- **Blast radius:** Nincs érdemi kár. Self-only műveletek (saját user_word/custom_word), verified-gated, throttle-olt. Az onboarding pusztán UX-lépés (szintfelmérő + túra), nem entitlement-kapu.
- **Verifikációs verdikt:** CONFIRMED mint tény, de szándékos és ártalmatlan. Cáfoló-kör: (1) érzékeny műveletet enged? — csak self-only szó/flashcard-írást, nincs privilégium-emelés. (2) miért nincs gate? — a natív kliensek JSON-hibát várnak, nem redirectet; egy onboarding-redirect eltörné őket (tudatos design). (3) kombinálható ONB-1-gyel? — nem, ugyanaz a self-only felület.

---

### [ONB-4] A billing / settings / logout elérhető befejezetlen onboardinggal — nincs fizetési csapda
- **Fájl:sor:** routes/settings.php, routes/web.php:35-38
- **Súlyosság:** INFO
- **Kategória:** lockout (fordított hozzáférhetőség-vizsgálat)
- **Forgatókönyv (pozitív ellenőrzés):** A `settings/*` (profil, billing, subscription, security, logout), a `pricing/checkout`, és a `player/connect` NINCS `EnsureOnboardingComplete` mögött — csak `['auth']` ill. `['auth','verified']` alatt. Egy befejezetlen onboardingú user IS tud fizetni, előfizetni, profilt szerkeszteni, kijelentkezni. Az onboarding maga (`GET onboarding`) NEM viseli a saját gate-jét → nincs végtelen redirect-loop.
- **Blast radius:** Nincs — ez a helyes viselkedés.
- **Verifikációs verdikt:** CONFIRMED tiszta. Cáfoló-kör: (1) redirect-loop? — nincs, az onboarding route-csoport gate-mentes. (2) fizetési csapda? — nincs, a settings/billing/pricing gate-mentes. (3) gate-elt route ami az onboardinghoz kellene de kizárja? — nincs.

---

### [ONB-5] `?->` null-safe middleware — auth nélküli kérésnél redirect, nem 500
- **Fájl:sor:** app/Http/Middleware/EnsureOnboardingComplete.php:16
- **Súlyosság:** INFO
- **Kategória:** correctness
- **Forgatókönyv:** A middleware `$request->user()?->onboarding_completed_at === null` — a null-safe operátor miatt ha nincs bejelentkezett user, a kifejezés `null === null` → true → onboarding-redirect. A gyakorlatban a `['auth','verified']` mindig előbb fut (sorrend: Authenticate → EnsureEmailIsVerified → EnsureOnboardingComplete), így a middleware sosem lát vendéget. Nincs null-deref, nincs 500.
- **Blast radius:** Nincs.
- **Verifikációs verdikt:** CONFIRMED tiszta. A middleware-sorrend helyes; a `?->` defenzív fail-safe.

---

## Összegzés (Dim B)

| ID | Súlyosság | Verdikt |
|---|---|---|
| ONB-1 tömeges known self-grant | LOW | CONFIRMED (mechanizmus valós, blast radius nulla) |
| ONB-2 nem-idempotens POST | LOW | REFUTED (műveletek idempotensek → nincs kár) |
| ONB-3 natív kliens gate-mentes | INFO | CONFIRMED (szándékos, ártalmatlan) |
| ONB-4 nincs fizetési csapda | INFO | CONFIRMED tiszta |
| ONB-5 null-safe MW | INFO | CONFIRMED tiszta |

**0 HIGH · 0 MEDIUM · 2 LOW · 3 INFO.** Az onboarding-felület tiszta: nincs privilégium-emelés, cross-user vagy pénzügyi vektor. Az egyetlen valós mechanizmus (ONB-1) self-directed és nulla blast radius-ú. A middleware-réteg korrekt (helyes sorrend, nincs loop, nincs fizetési csapda).
