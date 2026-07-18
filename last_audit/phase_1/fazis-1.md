# Fázis 1 — Auth, session, jogosultság (rendszerszintű audit)

> Dátum: 2026-07-17 · Terv: `last_audit/PLAN.md` Fázis 1 · **JAVÍTVA 2026-07-17** — lásd a „Javítások" szakaszt a dokumentum végén; egyedül az F1-L2 maradt nyitva (szándékos kliens-kompromisszum, nincs kód-fix javaslat).
> Módszer: multi-agent workflow — dimenziónkénti finderek + séma-kényszerített leletformátum + adverzariális (cáfolásra promptolt) verifikáció. **Minden agent Opuson futott.**

## Végeredmény — nincs launch-blokkoló

| Súlyosság | Darab | Megjegyzés |
|---|---|---|
| 🔴 HIGH | **0** | — |
| 🟠 MEDIUM | **0** | Mindkét MEDIUM-gyanús finder-lelet az adverzariális verifikáció után LOW-ra esett. |
| 🟡 LOW | **9** | Kizárólag hardening / mélységi-védelem hézag, közvetlen kár nélkül. |
| ⚪ Elvetve | **1** | `boost-browser-logs` — 3 verifikátor közül a lencse REFUTED/NONE-t adott. |

**A Fázis 1 lényegében tiszta.** Egyetlen kihasználható auth-megkerülést, jogosultság-emelést vagy cross-user hozzáférést sem találtunk. A teljes IDOR-sweep (mind a ~129 route bindingje, 3 entity-csoportban) **nulla IDOR-t** hozott: a rendszer konzisztensen policy-vel vagy `abort_unless($x->user_id === $request->user()->id, 403)` mintával scope-ol. A kézi (middleware-en kívüli) auth-felület, a Fortify auth-flow és a token-életciklus is védett.

## Módszertan

- **9 dimenzió-finder** (mindegyik Opus, high effort): middleware-láncok, kézi auth, Fortify-flow, session-hardening, token-életciklus, IDOR (3 entity-csoport), ReviewController.
- **Verifikáció:** minden HIGH/MEDIUM-gyanús leletre **3 független, cáfolásra promptolt** verifikátor, egyenként más lencsével (auth-logika / kihasználhatóság / máshol-védve). LOW-ra **1 verifikátor**. Alaphelyzet: REFUTED, csak end-to-end kód-igazolásra CONFIRMED.
- **Séma-kényszerített leletek:** fájl, sor, súlyosság, forgatókönyv, bizonyíték + verifikációs verdikt (verdict / confidence / korrigált súlyosság / cáfolási kísérlet / indoklás).
- Két finder (`token-lifecycle`, `review-controller`) a séma-retry plafonon elhasalt; **külön újrafuttatva** (token-lifecycle séma-kényszer nélkül, közvetlen Opus-agenttel), így mind a 9 dimenzió lefedve.

---

## Leletek (mind LOW — a súlyosság a verifikáció utáni konszenzus)

### 🟡 F1-L1 — `reset-password` bekülde nincs throttle alatt · *(finder: MEDIUM → verifikáció: LOW)*
**Fájl:** `app/Providers/FortifyServiceProvider.php:114` · **Dimenzió:** middleware-chains
A `configureRouteThrottling()` throttle-map csak a `register.store` és `password.email` (link-kérés) route-okra tesz limitet; a tényleges jelszó-átíró bekülde (`password.update`, POST `/reset-password`, `NewPasswordController@store`) `route:list -v` szerint CSAK `[web, RedirectIfAuthenticated]` — **nincs ThrottleRequests**, és nincs globális web-throttle sem. Ez az egyetlen jelszó-átíró auth-végpont brute-force réteg nélkül.
**Verifikáció (3 lencse): CONFIRMED/LOW · PARTIAL/LOW · PARTIAL/LOW.** A hiány ténybelileg cáfolhatatlan, de a súlyosság a MEDIUM-ról LOW-ra esik: a reset-token 64-hex / ~256-bit HMAC, bcrypt-tárolt, 60 perc lejárattal, teljes `Hash::check` egyezést követel orákulum nélkül → a token throttle nélkül is gyakorlatilag kitalálhatatlan; az email-bombing vektor a `password.email` (az VISZONT throttle alatt). Tiszta mélységi-védelem hézag.
**Javaslat (go-live, olcsó):** `$throttles`-be egy `'password.update' => 'throttle:password-request'` sor.

### 🟡 F1-L2 — Extension írás-végpontok megkerülik az email-verifikációt
**Fájl:** `routes/extension.php:19` · **Dimenzió:** middleware-chains
Az `extension/*` route-ok szándékosan csak `[web, throttle]` láncot kapnak (a kontroller kézzel auth-ol). `ExtensionController::addWord`/`createFlashcard` csak `$request->user()`-t és `canWriteFromExtension()`-t ellenőriz — **email-verifikációt nem**. A `canWriteFromExtension()` csak a napi írás-keretet nézi, `hasVerifiedEmail()`-t nem. Egy bejelentkezett, de nem-verifikált user (a Fortify login nem követeli meg a verifikációt) az extensionből szót/flashcardot hozhat létre, miközben a webes `verified` middleware ezt blokkolná.
**Verifikáció: CONFIRMED/LOW.** Nem cross-user, csak saját adat; a verifikáció-kényszer mindenütt máshol érvényes, ez egy szándékos kliens-kompromisszum aszimmetriája.

### 🟡 F1-L3 — `settings/billing` + `settings/profile` mutáló végpontok throttle nélkül
**Fájl:** `routes/settings.php:21` (billing PUT), `:14` (profile PATCH), `:18` (profile DELETE) · **Dimenzió:** middleware-chains
A settings GET nézetek `throttle:60,1,settings-view` alatt vannak, a password-update és subscription-manage is throttle-ozott, DE a PUT `settings/billing`, PATCH `settings/profile`, DELETE `settings/profile` **semmilyen throttle-t nem kap** (csak `[web, Authenticate]`). Egy megszerzett session-nel korlátlanul spammelhetők; a `profile.update` minden email-váltáskor verifikációs levelet küld → email-bombing.
**Verifikáció: CONFIRMED/LOW.** Az email-bombing lánc end-to-end igazolt (`ProfileController::update` `sendEmailVerificationNotification()` limit nélkül), de nem cross-user, a `profile.destroy` jelszót kér → LOW.

### 🟡 F1-L4 — Email-csere nem kér jelszó-újraerősítést
**Fájl:** `app/Http/Controllers/Settings/ProfileController.php:27` · **Dimenzió:** fortify-flow
A PATCH `settings/profile` jelszó-újraerősítés (`password.confirm`) nélkül cseréli a fiók email-címét. A `ProfileUpdateRequest` csak `name`+`email`-t validál, nincs `current_password`. Ez ellentmond a saját mintának: a jelszóváltás (`current_password`) és a fiók-törlés (`ProfileDeleteRequest` `password`) egyaránt jelszót követel — az email-csere kilóg ebből. Eltérített/nyitva hagyott munkamenettel (vagy azonos-eredetű XSS-PATCH-csel) a fiók-átvételi lánc első lépése lehet.
**Verifikáció: CONFIRMED/LOW.** Enyhítő: az új cím `email_verified_at=null`-lal indul és verifikációt kap, de maga a csere jelszó nélkül megtörténik. Defense-in-depth hézag.

### 🟡 F1-L5 — Player-eszköz token-visszavonás nem `password.confirm`-védett
**Fájl:** `app/Http/Controllers/Settings/SecurityController.php:83` · **Dimenzió:** fortify-flow
A `SecurityController::middleware()` a `password.confirm`-ot CSAK `only: ['edit']`-re teszi; a `revokePlayerDevice`/`revokeAllPlayerDevices` DELETE-ek (`settings/security/player-devices[/{tokenId}]`) kimaradnak — csak `[auth] + throttle:10,1`. Eltérített munkamenetből jelszó nélkül visszavonható a user összes player-eszköze (DoS a saját eszközök ellen).
**Verifikáció: CONFIRMED/LOW.** Hatás korlátozott (csak saját player-tokenek, nem más useré). Mechanikailag igazolt, de nem cross-user → LOW.

### 🟡 F1-L6 — `SESSION_SECURE_COOKIE` beállítatlan — süti Secure flag nélkül · *(finder: MEDIUM → verifikáció: LOW)*
**Fájl:** `config/session.php:172` · **Dimenzió:** session-hardening
`'secure' => env('SESSION_SECURE_COOKIE')` **default érték nélkül**, és sem a `.env`, sem a `.env.example` nem definiálja a változót; nincs `URL::forceScheme('https')` sem. Így az env `null` → a session-cookie prod HTTPS alatt is Secure attribútum nélkül mehet ki, ha a deployer elmulasztja beállítani → downgrade/sslstrip MITM-nél session-hijack.
**Verifikáció (3 lencse): PARTIAL/LOW · PARTIAL/LOW · PARTIAL/LOW.** A ténymag igaz (deploy-flag hiány), de a MEDIUM nem tartható: a `SecurityHeaders.php:32-36` prod HSTS (`includeSubDomains`+`preload`) lefedi a downgrade-vektort minden böngészőnél, amely már látta a politikát; a maradék kockázat a HSTS-cache előtti trust-on-first-use ablak. **Deploy-flagként dokumentálandó (lásd lent).**

### 🟡 F1-L7 — Jelszóváltás nem vonja vissza a player-tokeneket
**Fájl:** `app/Http/Controllers/Settings/SecurityController.php:126-134` · **Dimenzió:** token-lifecycle
A `SecurityController::update()` csak a `password`-öt és `remember_token`-t írja; nincs `tokens()->delete()`/player-token-revoke. A `player` Bearer-token a jelszóváltás után is érvényes marad (max 90 nap TTL-ig vagy kézi visszavonásig). A verifikátor kiegészítette: **a jelszó-reset útvonalra (`ResetUserPassword`) is igaz** — ez a „kompromittált fiók" forgatókönyv gyakoribb belépője.
**Verifikáció: CONFIRMED/LOW.** Standard/elvárt Sanctum-viselkedés (a token szándékosan túléli a session-t); kompenzálva: 90-napos TTL + működő „Minden eszköz leválasztása" UI + napi `sanctum:prune-expired` cron; a token `['player']`-re szűkített, nem teljes fiók-hozzáférés. **Ha egyszer fixelik: mindkét útvonalon** (`SecurityController::update` ÉS `ResetUserPassword`) purge-öljék a player-tokeneket.

### 🟡 F1-L8 — `review/complete`: nincs `ids` méret-plafon és nincs throttle
**Fájl:** `app/Http/Controllers/ReviewController.php:143` · **Dimenzió:** review-controller
A validáció csak `ids => required|array` + `ids.* => required|string`, **nincs `max:` méretkorlát és nincs `array_slice`** (szemben a testvér `ClozeController`-rel), és a route (`routes/words.php:47`) throttle nélküli, miközben a quiz/cloze/practice complete mind `throttle:30,1`. Korlátlan méretű `ids` tömb → egyetlen óriás `whereIn` UPDATE + korlátlan gyakoriságú ismétlés.
**Verifikáció: CONFIRMED/LOW.** A két UPDATE user-scope-olt (`where user_id = $user->id`), nincs cross-user hatás és nincs per-sor N+1; a kár a saját adatra + szerver-erőforrásra korlátozódik → LOW.

### 🟡 F1-L9 — `review` (index) GET nincs throttle-ozve
**Fájl:** `routes/words.php:46` · **Dimenzió:** review-controller
A `review` GET sincs rate-limitelve (a testvér cloze/quiz GET-ek `throttle:60,1,words-play`-t kapnak), és minden hívás státuszonként (`INTERVALS`=4) 2-2 lekérdezést futtat (`getDueIds`+`getDueCounts`) a `user_word`/`user_custom_words` táblákra.
**Verifikáció: CONFIRMED/LOW.** Minden lekérdezés user_id-scope-olt → csak enyhe, önmagára irányuló DB-terhelés, nincs adat-szivárgás/jogosultsági hatás.

---

## Elvetett lelet (adverzariális cáfolás sikeres)

### ⚪ `boost-browser-logs-debug-gated` — **REFUTED/NONE**
**Fájl:** `config/filesystems.php:36` (`serve=true`) + `BoostServiceProvider.php:195` · **Dimenzió:** middleware-chains
Felvetés: éles `APP_DEBUG=true` esetén aktiválódhat a `_boost/browser-logs` dev-végpont, és a `storage/{path}` GET+PUT route-ok élesben regisztrálódnak. **A verifikátor mindkét ágat érvénytelenítette:** a `laravel/boost` kizárólag `require-dev`-ben van (`--no-dev` deploynál fel sem települ), a `storage/{path}` route-ok pedig kötelező APP_KEY-alapú aláírás-ellenőrzés mögött vannak (`abort_unless` → aláírás nélkül 404). Nincs kihasználható sebezhetőség.

---

## Tiszta felületek (megvizsgálva, rendben)

- **manual-auth (0 lelet):** `ExtensionController` mind a 9 metódusa első sorban `if (! $request->user()) 401`; minden DB-lekérdezés user-scope-olt (`->customWords()`, `->knownWords()`, `->flashcardDecks()`, `DB::table('user_word')->where('user_id', ...)`); `createFlashcard` a saját paklik közül keres (idegen deckre 404). `PricingController@success` signed URL / `hasValidSignature`. `sitemap.xml` publikus, nem szivárog nem-publikus adat. Stripe-webhook: aláírás-verifikáció (CSRF alól szándékosan kivéve, csak `stripe/*`).
- **PlayerPairing device-flow (tiszta):** `user_code` 8 kar / 31-elemű ábécé, unique index; `poll_secret` 256-bit, csak SHA-256 hash tárolva; `LIFETIME_MINUTES=10` lejárat; egyszer-használatos atomikus claim (`whereKey(...)->delete() !== 1`, a vesztő 404); lejárt sorok takarítása.
- **token-lifecycle (a `sanctum.expiration=null` tisztázva):** a globális `null` (`config/sanctum.php:53`) ellenére az egyetlen `createToken`-hívás (`PlayerPairingController:150-154`) explicit `now()->addDays(90)` TTL-t ad át; a Sanctum guard (`Guard.php:128-129`) lejáratja a per-token `expires_at` alapján. A memóriában rögzített **„player-token 90 nap" kódban is így van** (`TOKEN_LIFETIME_DAYS=90`). Az extension nem tokent, hanem session-cookie-t használ. A visszavonás user-scope-olt (`$request->user()->tokens()->whereKey($tokenId)`) → nincs token-IDOR; `isPlayerToken()` az `abilities === ['player']`-re szűr.
- **IDOR-sweep — 0 IDOR mind a 3 entity-csoportban:**
  - *Words/Folders:* `FolderPolicy` + `Gate::authorize` minden metóduson; a globális `Word` nem user-tulajdonú (a folder_word pivot a saját mappára köt); `UserCustomWordPolicy` minden mutáló ponton.
  - *Flashcards (27 route, 7 kontroller):* minden `{deck}` első sora `abort_unless($deck->user_id === $request->user()->id, 403)`; a nested `{flashcard}` mindig `abort_unless($flashcard->deck_id === $deck->id, 403)`; csv-export/import és study/submit/undo deck-scope-olt.
  - *Books/YouTube/Invoice/Invite/player-devices:* `UserBook` és `YoutubeTranscript` `abort_unless(...user_id...)`; a `BillingoInvoice` letöltés (NAV-PII, a potenciálisan HIGH pont) `abort_unless($invoice->user_id === $request->user()->id, 404)` — szándékos 404, nem enumerálható; admin invite `can:admin` gate alatt.
- **ReviewController (tiszta a biztonsági magban):** `complete()` mindkét UPDATE-je user-scope-olt (`where('user_id', $user->id)->whereIn(...)`) → cross-user írás lehetetlen; `INTERVALS` szerver-oldali konstans (a kliens csak megjelenítésre kapja); nincs streak/pont-könyvelés a kontrollerben (a `reviewed_at=today` idempotens) → nincs race. Duplikált id-k ártalmatlanok (`whereIn` dedup + idempotens update).
- **Middleware-láncok (tiszta):** web-app domain route-ok helyesen `[web, Authenticate, EnsureEmailIsVerified, EnsureOnboardingComplete]`; admin `[auth, verified, can:admin]`; `words/{word}` PATCH admin-only; `EnsureOnboardingComplete` null-safe, nincs redirect-loop; Fortify brute-force felület (login 5/perc, register 10/perc IP, password.email 5/perc, two-factor-challenge) throttle alatt; `AuthenticateSession` a láncban.

---

## Deploy-checklist (Fázis 1-ből eredő, nem-kód teendők)

- [ ] **`SESSION_SECURE_COOKIE=true`** a prod `.env`-be (F1-L6) — és érdemes felvenni a `.env.example`-be is dokumentáló default-tal.
- [ ] Prod `APP_DEBUG=false` (a `boost` amúgy is `--no-dev`-vel kimarad, de kettős biztosíték).

## Opcionális, olcsó hardening-javaslatok (NEM launch-blokkoló, audit-no-fixes miatt nem alkalmazva)

- F1-L1: `'password.update' => 'throttle:password-request'` a `configureRouteThrottling()` map-be.
- F1-L3: throttle a `settings/billing` PUT + `settings/profile` PATCH/DELETE route-okra.
- F1-L4: `password.confirm` az email-cserére (a security-oldal mintája szerint).
- F1-L5: `password.confirm` a player-device-revoke DELETE-ekre.
- F1-L8: `ids` `max:` méret-plafon + `array_slice` + `throttle:30,1` a `review/complete`-re (a cloze/quiz mintájára).
- F1-L9: `throttle:60,1,words-play` a `review` GET-re.
- F1-L7: opcionális player-token purge jelszóváltáskor+reset-nél (mindkét útvonalon), vagy UI-figyelmeztetés.

---

## Javítások (2026-07-17, explicit user-kérésre — commitolatlan)

| Lelet | Fix | Hely |
|---|---|---|
| F1-L1 | `'password.update' => 'throttle:password-request'` a throttle-mapben (5/perc/IP, közös limiter a link-kéréssel) | `FortifyServiceProvider::configureRouteThrottling()` |
| F1-L3 | `throttle:6,1,profile-update` (PATCH profile), `throttle:6,1,profile-delete` (DELETE profile), `throttle:10,1,billing-update` (PUT billing) | `routes/settings.php` |
| F1-L4 | E-mail-cserénél kötelező `current_password` (a jelszóváltás/fióktörlés mintájára); a frontend csak tényleges e-mail-változásnál mutatja a jelszómezőt | `ProfileUpdateRequest` + `settings/profile.tsx` |
| F1-L5 | `password.confirm` a `revokePlayerDevice`/`revokeAllPlayerDevices`-re is (az `edit`-tel közös feltétellel, így a lap megnyitása már megerősít) | `SecurityController::middleware()` |
| F1-L6 | Fail-safe default: `env('SESSION_SECURE_COOKIE', env('APP_ENV') === 'production')` → élesben elfelejtett flag esetén is Secure; `.env.example`-ben dokumentálva | `config/session.php` + `.env.example` |
| F1-L7 | Új `User::revokePlayerTokens()` (csak `['player']`-ability tokenek); hívva jelszóváltáskor ÉS reset-nél; a `revokeAllPlayerDevices` is ezt használja | `User` + `SecurityController::update()` + `ResetUserPassword` |
| F1-L8 | `ids` plafon: `max:MAX_PER_SESSION(50)` + elemenként `string|max:32`; `throttle:30,1,words-review` a route-on | `ReviewController::complete()` + `routes/words.php` |
| F1-L9 | `throttle:60,1,words-play` a `review` GET-re (közös bucket a cloze/quiz GET-ekkel) | `routes/words.php` |
| F1-L2 | **NYITVA** — szándékos extension-aszimmetria (nem-verifikált user saját-adat írása); üzleti döntést igényel | — |

**Deploy-checklist frissítés:** a `SESSION_SECURE_COOKIE=true` prod-.env teendő az F1-L6 fail-safe defaulttal okafogyottá vált (explicit beállítás továbbra is felülírhatja); az `APP_DEBUG=false` teendő változatlan.

**Tesztek:** új `ReviewTest` (5) + `SessionSecureCookieTest` (2); bővítve: `AuthThrottleTest`, `PasswordResetTest`, `SecurityTest` (+3, a revoke-tesztek jelszó-megerősített sessionnel), `ProfileUpdateTest` (+4). **Teljes suite: 675 teszt zöld (2542 assertion).** Frontend `npm run build` zöld. `vendor/bin/pint --dirty` lefuttatva.

*A Fázis 2–8 a jóváhagyásra vár — nem indult el.*
