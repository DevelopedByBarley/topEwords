# Fázis 1 — Auth / Session / Jogosultság: FÜGGETLEN ÚJRA-AUDIT ÖSSZESÍTŐ

Dátum: 2026-07-25
Hatókör: PLAN.md Fázis 1 (hitelesítés, munkamenet-kezelés, jogosultság, token-életciklus, IDOR)
Státusz: **CSAK DOKUMENTÁLVA — kódmódosítás nem történt**

---

## 1. Vezetői összefoglaló

| Súlyosság | Darab | Azonosítók |
|---|---|---|
| **HIGH** | **1** | C-1 / MB-1 (ugyanaz a lelet, két dimenzióból) |
| MEDIUM | 0 | — |
| LOW | 10 | MW-1, MW-2, MW-3, MB-2, MB-3, MB-4, C-2, C-4, C-5, D-1/TOK-1, D-2, D-3, D-4 |
| INFO | 5 | MB-5, MB-6, D-5, D-6, + tényellenőrzések |
| Megcáfolva | 2 | C-3, TOK-2 |

**Go-live blokkoló: 1 db (C-1).** Nem az egész indulást blokkolja, de az egyetlen olyan lelet, ahol egy szándékosan telepített biztonsági kontroll (a `RequirePassword` jelszó-megerősítési kapu) triviálisan és **némán** megkerülhető.

A kép egyébként erős. Az IDOR-felület **teljesen tiszta** (0 lelet 51 paraméteres route-on, minden tulajdon-ellenőrzés explicit és a kontrollerben látható). A session-kezelés (fixation, logout, AuthenticateSession-lefedettség) hibátlan. A token-életciklus szigorú: egyetlen kiadási pont, szűkített ability, per-token 90 napos lejárat, négy visszavonási útvonal. A middleware-lánc-higiénia jó: nincs auth nélküli mutáló vagy érzékeny-adat-olvasó route.

Az egyetlen HIGH: a `POST /user/confirm-password` (Fortify) **semmilyen rate limitet nem kapott**, miközben teljes bcrypt-jelszóellenőrzést futtat és bináris igen/nem választ ad. Egy eltérített munkamenet birtokosa ezzel korlátlanul és nyomtalanul találgathatja a jelszót — a sikeres találat után pedig nyílik a 2FA-letiltás, a recovery-kódok kiolvasása és (a `current_password` ismeretében) a végleges jelszócsere, azaz a jogos tulajdonos tartós kizárása. A javítás **egysoros**: `'password.confirm.store' => 'throttle:password-request'` hozzáadása az `app/Providers/FortifyServiceProvider.php:118` `$throttles` térképéhez.

Öt PLAN.md-feltevés megdőlt (részletek a 4. szakaszban): a `sanctum.expiration=null` nem ütközik a 90 nappal, az extension-tokennek nincs is tokenje, a `REGISTRATION_ENABLED=false` szerveroldalon is zár, a `ReviewController` **nem létezik**, és a policy-hiány nem authorizáció-hiány.

---

## 2. Módszertan

**Ez FÜGGETLEN újra-audit volt.** A megállapítások kizárólag a jelenlegi kódbázisból származnak; korábbi audit-riportokat sem bizonyítékként, sem kiindulásként nem használtunk fel. Bizonyítékként csak közvetlenül olvasott forráskód és read-only futásidejű parancsok (`php artisan route:list --json`, `config:show`, `event:list`) számítottak.

**Felállás:**

1. **6 párhuzamos finder**, dimenziónként:
   - **A-middleware** — mind a 166 regisztrált route middleware-lánca, 8 saját route-fájl, `bootstrap/app.php`, kézi auth-ot végző kontrollerek.
   - **B-manual-auth** — kontroller-oldali aláírás-ellenőrzés, publikus/closure route-ok, Stripe-webhook lánc, minden `Gate::check`/`abort_unless`/`! $request->user()` őr.
   - **C-fortify** — FortifyServiceProvider, `config/fortify.php`, `config/auth.php`, vendor Fortify route-ok és kontrollerek, egyedi actionök, futásidejű `gatherMiddleware()` dump minden auth-route-ra.
   - **D-session** — `config/session.php` teljes, boot-guardok, Fortify login/logout pipeline vendor-szinten, jelszó-/e-mail-/törlés-utak, `.env.example`.
   - **E-tokens** — Sanctum-konfig, token-kiadás/-visszavonás, párosító device-flow, kliensoldali tárolás (Electron `safeStorage`, extension `chrome.storage`).
   - **F-idor** — mind az 51 paraméteres route + minden body/query ID-t fogadó végpont, minden `exists:` szabály, globális scope-ok, statikus lekérdezés-söprés.

2. **3 adverzariális verifikátor** minden HIGH/MEDIUM jelöltre (LOW-ra 1), egymástól függetlenül. A verifikátor feladata a **cáfolás** volt: minden lehetséges védelmi réteg (globális/route middleware, FormRequest, policy, model-scope, DB-constraint, vendor-belső limiter, custom callback, response-binding, event-listener, infra) szisztematikus végigjárása, és a lelet elvetése/leminősítése, ha bármelyik fog.

3. **Döntőbíró** vitás esetekre. Egy leletnél (C-1) volt megosztott szavazat (2 CONFIRMED HIGH + 1 DOWNGRADE MEDIUM), ott döntőbíró zárta le a kérdést.

**Minősítési szabályok:** minden lelethez kötelező volt pontos fájl:sor és konkrét, végrehajtható támadási forgatókönyv. Forgatókönyv nélküli megfigyelés nem lehetett lelet. A frontend soha nem számított védelemnek.

---

## 3. Leletek súlyosság szerint

### 🔴 HIGH — C-1 / MB-1: `POST /user/confirm-password` throttle nélkül = korlátlan, néma jelszó-orákulum

**Fájl:** `app/Providers/FortifyServiceProvider.php:118` (a `$throttles` térkép), a route pedig `vendor/laravel/fortify/routes/routes.php:124`
**Verdikt:** 5 verifikátor-szavazat összesen (2 dimenzióból): **4 CONFIRMED HIGH, 1 DOWNGRADE MEDIUM, 1 DOWNGRADE LOW** → döntőbíró: **CONFIRMED HIGH**

**Forgatókönyv.**
A támadó megszerez egy érvényes, bejelentkezett `laravel_session` cookie-t (ellopott/kölcsönadott gép, cookie-lopó malware, nem lezárt böngésző megosztott gépen). A jelszót **nem** ismeri, ezért a `RequirePassword`-del védett érzékeny műveletek zárva vannak előtte.

1. `GET /user/confirm-password` → kiolvassa a CSRF-tokent.
2. Ciklusban, párhuzamosan: `POST /user/confirm-password` `{"password":"<tipp>"}`.
   Middleware-lánc (`route:list --json`-nal tényellenőrizve): `['web', 'Illuminate\Auth\Middleware\Authenticate:web']` — **nulla ThrottleRequests**.
   Végrehajtás: `ConfirmablePasswordController::store` → `Actions/ConfirmPassword::__invoke` → `SessionGuard::validate()` → `hasValidCredentials()` → teljes bcrypt(12) összevetés.
3. Bináris orákulum: rossz jelszó → 422 / `withErrors`; jó jelszó → 201/302 + `auth.password_confirmed_at` a sessionben. Visszaolvasható `GET /user/confirmed-password-status` → `{"confirmed":true}`.
4. Találat után **3 órás ablak** (`config/auth.php:115`, `password_timeout=10800`) nyílik minden `RequirePassword`-védett route-ra: `DELETE /user/two-factor-authentication` (2FA teljes kikapcsolása), `GET /user/two-factor-recovery-codes` (8 recovery-kód nyílt kiolvasása), `GET /user/two-factor-secret-key`, `DELETE /settings/security/player-devices`, `POST /settings/subscription/cancel`.
5. **Végleges átvétel:** a `PUT /settings/password` (`user-password.update`) **nincs** `RequirePassword` mögött, egyetlen védelme a `current_password` szabály — ami ugyanazt a `Hasher::check`-et futtatja. A most már ismert jelszóval egyetlen kéréssel átírható → `SecurityController.php:132-137` forceFill + `remember_token` rotálás + `revokePlayerTokens()` → a jogos tulajdonos kizárva.

**Miért nem fogja meg semmi (mind a 8 jelölt réteg ellenőrizve):**

| Réteg | Eredmény |
|---|---|
| `app/Providers/FortifyServiceProvider.php:118-122` | a `$throttles` térkép csak `register.store`, `password.email`, `password.update` — `password.confirm.store` **hiányzik** |
| `bootstrap/app.php:20-36` | nincs `throttleApi()`/`throttleWithRedis()`, a `web` csoportban nincs ThrottleRequests |
| `config/fortify.php:117-120` | a `limiters` CSAK `login` + `two-factor` |
| `routes/web.php` | throttle csak 4 nem kapcsolódó route-on |
| `app/Http/Middleware/` | mind a 4 middleware nem rate-limiter |
| `AuthenticateSession` | csak jelszóhash-**változásra** léptet ki, kísérletet nem számol |
| `RequirePassword` | csak a session-flaget olvassa, nem számlál |
| Auth-event-listener | **nincs** (`app/Listeners/` csak a 2 riasztó; `event:list` = 0 auth-event listener) → a támadás **nyomtalan** |

Egyetlen részleges fék: `SessionGuard` Timebox (200 ms) + `BCRYPT_ROUNDS=12` ≈ 200-400 ms/kísérlet. Ez sebesség-csillapítás, **nem kísérlet-korlát**: nincs számláló, nincs zárolás, és a `database` session-driver nem szerializál, tehát ugyanazzal a cookie-val tetszőleges párhuzamos kapcsolat nyitható — lineárisan skálázódik.

**A DOWNGRADE-érvek és miért nem álltak meg.**
Két verifikátor leminősítést javasolt: (a) „előfeltétel egy már eltérített session, tehát feltételes"; (b) „a `Password::defaults()` prodban `min(12)+uncompromised()`, ezért a jelszó nem törhető".

A döntőbíró mindkettőt elvetette:
- (a) A `RequirePassword` egy **szándékosan telepített kontroll, amely pontosan a session-kompromittálás utáni fenyegetési modellt hivatott védeni**. Mindössze 13 route áll mögötte, és pont ezek a fiók-szuverenitás kontrolljai. Egy kontroll, amit némán meg lehet kerülni, valódi kontroll-hiba. Ráadásul a kimenet nem a session meghosszabbítása, hanem a **nyílt jelszó megszerzése** — ami session-független, eszközfüggetlen, tartós, és credential stuffinghoz is használható idegen rendszereken.
- (b) A jelszó-politika valós enyhítés az **új** jelszavakra, de nem érinti a policy szigorítása előtt regisztrált legacy jelszavakat (nincs policy-alapú rehash), és nem védelmi *kontroll*, hanem statisztikai valószínűség-csökkentés. A hiányzó fék attól még hiányzik.

**Javasolt teendő (P0, egysoros):**
```php
// app/Providers/FortifyServiceProvider.php:118
$throttles = [
    'register.store'         => 'throttle:register',
    'password.email'         => 'throttle:password-request',
    'password.update'        => 'throttle:password-request',
    'password.confirm.store' => 'throttle:password-request',   // ÚJ
];
```
Kiegészítésként érdemes: (1) egy `Illuminate\Auth\Events\Failed` + `Lockout` listener a riasztási láncba (lásd C-5), (2) a 2FA-mutáló route-ok throttle-ozása (lásd MW-3).

---

### 🟡 MEDIUM

**Nincs MEDIUM lelet.** Két jelölt indult MEDIUM-ként (MW-1 és C-2), mindkettő a verifikáció során rendeződött:
- **MW-1** ugyanaz a rés, mint C-1 — a súlyosabb minősítés (HIGH) alá konszolidálva.
- **C-2** (login-limiter IP-rotálással nullázható) 2 CONFIRMED MEDIUM + 1 DOWNGRADE LOW szavazatot kapott; a döntő érv a leminősítés mellett az volt, hogy a `Password::defaults()` prodban `uncompromised()`-et (HIBP) kényszerít, ami pont a spray-hez használható jelszólistákat zárja ki — a támadás így nem konvertálódik gyakorlati kompromittálássá. **Végleges: LOW.**

---

### 🟢 LOW (10 lelet)

| ID | Cím | Fájl:sor | Verdikt | Lényeg / teendő |
|---|---|---|---|---|
| **C-2** | Login-limiter kulcsa `email\|ip` → IP-rotálással nullázható; a Fortify `EnsureLoginIsNotThrottled` ki van szűrve a pipeline-ból | `app/Providers/FortifyServiceProvider.php:99` | 2 CONF MED, 1 DOWN LOW | Nincs IP-független, fiókra vetített kísérlet-plafon. A kiszűrt vendor-réteg **redundáns** lenne (ugyanaz az `email\|ip` kulcs). Enyhítés: prod `Password::defaults()` `uncompromised()`. Teendő: opcionálisan egy második, csak e-mail-kulcsú limiter (pl. 30/óra/fiók). |
| **C-4** | `forgot-password` megkülönbözteti a létező és nem létező e-mailt (user-enumeráció) | `app/Providers/FortifyServiceProvider.php:107` | 1 CONF LOW | `wantsJson()` esetén 422 vs 302 — gépileg olvasható orákulum. 5/perc/IP fékkel, IP-rotálással skálázható. Teendő: egységes „ha létezik, elküldtük" válasz (`FailedPasswordResetLinkRequestResponse` felülírása). |
| **C-5** | Nincs egyetlen auth-esemény-listener sem → sikertelen belépések, 2FA-hibák, jelszó-megerősítések nyomtalanok | `app/Providers/FortifyServiceProvider.php:34` | 1 CONF LOW | `php artisan event:list` futásidejűleg igazolta: 0 db `Illuminate\Auth\Events\*` (a `Registered` kivételével) és 0 db `Laravel\Fortify\Events\*` listener. Közvetlenül felerősíti a C-1 hatását. Teendő: `Failed`/`Lockout`/`TwoFactorAuthenticationFailed`/`TwoFactorAuthenticationDisabled` listener a meglévő riasztási láncba. |
| **MW-2** | Az 5 extension-olvasó route auth-ja kézi kontroller-ellenőrzés, nem middleware | `routes/extension.php:11` | 1 CONF LOW | **Ma nincs rés** — mind a 6 metódusban megvan a guard. Regressziós csapda: egy új, guard nélkül felvett végpont némán nyílna. Megjegyzés: a `badge` 401 helyett `{'count':0}`-t ad, tehát a csoport nem egységes sablon. |
| **MW-3** | 2FA-mutáló Fortify-route-ok throttle nélkül | `config/fortify.php:153` (a lelet eredetileg `routes/web.php:42`-re hivatkozott — **téves hely**, korrigálva) | 1 CONF LOW | `RequirePassword` mögött vannak, saját fiókra hatnak, olcsó műveletek. TOTP-orákulum-eszkaláció **megbukott**: a titkot a `/user/two-factor-secret-key` ugyanazon middleware mögött nyíltan kiadja. |
| **MB-2** | `GET /stripe/payment/{id}` (Cashier) auth és tulajdon-ellenőrzés nélkül, idegen nevet+e-mailt renderel | `vendor/laravel/cashier/routes/web.php:5` | — | A `pi_` ID ~143 bit, nem kitalálható. Az app **soha nem irányít ide** (`PricingController:115-118` a `/pricing`-re redirectel), tehát holt vendor-felület. Teendő (opcionális): `Cashier::ignoreRoutes()`. |
| **MB-3** | `aiLimitGuard` vendégre fail-open (`null` = „mehet") | `app/Http/Controllers/TextAnalysisController.php:60` | — | Ma kettős védelem előtte (route auth + metódus-szintű `abort_unless`). Jövőbeli regressziós csapda. Teendő: `$user === null` → explicit 401. |
| **MB-4** | Meghívókód entrópiája ~41 bit, torzított eloszlás (`Str::upper` egy base62 stringen) | `app/Http/Controllers/AdminController.php:130` | — | `throttle:register` 10/perc/IP mellett gyakorlatilag nem brute-force-olható; `REGISTRATION_INVITE_ONLY` alapból `false`. Teendő: `Str::upper(Str::random())` helyett explicit 32-elemű ábécé. |
| **D-1 / TOK-1** | E-mail-váltás nem von vissza sem sessiont, sem player-tokent (a jelszóváltás igen) | `app/Http/Controllers/Settings/ProfileController.php:39` | **3 DOWNGRADE MEDIUM→LOW** | Aszimmetria: a `revokePlayerTokens()` 4 helyen hívódik, az e-mail-váltási út kimarad. Az `email_verified_at=null` zárja az **író** végpontokat, de az olvasók és a **két gemini AI-végpont a `verified` csoporton kívül van** → 90 napig olvasás + kvóta-égetés (plafon: `config/plans.php` Pro `$0.5/hó`). A leminősítés oka: a támadó már birtokolja a jelszót (`current_password` kötelező), tehát nincs új képesség; a rogue eszköz a Security oldalon **névvel és `last_used_at`-tal látszik** és egy kattintással visszavonható; minden reális helyreállítás (jelszóváltás/-reset) öli a tokent. Teendő (olcsó, ajánlott): `revokePlayerTokens()` hozzáadása az e-mail-váltási ághoz. |
| **D-2** | `SESSION_SAME_SITE` és `SESSION_HTTP_ONLY` hiányzik a `.env.example`-ból | `.env.example:43` | 1 CONF LOW | Kódbeli defaultok helyesek (`lax`, `true`). A projekt saját mintájához képest következetlen: a `SESSION_SECURE_COOKIE`-nak van fail-safe logikája + komment + 2 őrszem-teszt. Kockázat: valaki `SESSION_SAME_SITE=none`-t ír be az extension `credentials:'include'` debugolásakor — prodban a `secure=true` kényszer miatt ez **csendben degradálna**. Teendő: kommentelt sorok a `.env.example`-be. |
| **D-3** | Nincs „kijelentkezés minden eszközről" funkció | `app/Http/Controllers/Settings/SecurityController.php:43` | 1 CONF LOW | A `sessions` tábla megvan, tisztán hiányzó UI/route (repó-szintű grep: 0 találat `logoutOtherDevices`-re). Van kerülőút (jelszócsere → `AuthenticateSession` kilépteti a többit), de az kényszerű jelszócsere. A player-eszközökre **van** egyenértékű funkció — a hiány csak a websessionökre szűkül. |
| **D-4** | `SESSION_ENCRYPT=false` `database` driver mellett | `config/session.php:50` | 1 CONF LOW | DB-olvasás esetén a payload olvasható (`_token`, user-ID, `password_hash_web` HMAC). Session-átvétel **nem lehetséges** (a cookie APP_KEY-jel titkosított). Escalációs kísérlet megbukott: mind a 14 app-szintű session-írás gamifikációs adat, nincs PII/token. A `serialization=json` kizárja a gadget-chain RCE-t. Ingyenes egysoros keményítés. |

---

### ℹ️ INFO (5)

| ID | Megállapítás |
|---|---|
| **MB-5** | A `pricing.success` aláírás nincs user-hez kötve (25 órás, felhasználó-független signed URL). Nincs kár: a kontroller a saját sessionből dolgozik (`$request->user()?->activeSubscription()`), nincs adatszivárgás és nincs állapotváltozás — az előfizetést kizárólag a webhook hozza létre. |
| **MB-6** | Stripe-webhook: az aláírás valóban az egyetlen védelem, de **boot-guarddal fail-closed kikényszerítve**. `AppServiceProvider::assertStripeWebhookSecured()` RuntimeException-nel megakadályozza az indulást, ha a `cashier.webhook.secret` üres lenne (ami a Cashier-ben csendben kikapcsolná az aláírás-ellenőrzést). + event-id idempotencia. |
| **D-5** | `SESSION_DOMAIN=null` — a Laravel Env-parser valódi `null`-lá alakítja, a cookie **host-only**. Ez a helyes beállítás. Megfigyelés: semmi nem védi a `.topwords.eu`-ra állítás esetét (nincs boot-guard rá). Ma nincs kitettség. Figyelmeztetés: a HSTS `includeSubDomains` és a CSP **nem** ad cookie-scope védelmet, erre később ne hivatkozzon senki. |
| **D-6** | **Pozitív tényellenőrzés:** session-fixation, logout és `AuthenticateSession`-lefedettség mind TISZTA. Az `AuthenticateSession` a **globális `web` stackre** van appendelve (`bootstrap/app.php:30`), nem route-csoportra — gépi route-szűréssel igazolva, hogy egyetlen session-alapú route sem marad ki (a 12 kivétel mind `/api/player/*`, stateless Bearer, ott fogalmilag nem értelmezett). Mindhárom session-lezáró pont regenerál (jelszavas login, 2FA-ág, regisztráció); a logout invalidál + CSRF-tokent regenerál. |
| **F-idor** | **IDOR = 0.** 51 paraméteres route + minden body/query ID-t fogadó végpont bejárva: 0 HIGH, 0 MEDIUM, 0 LOW. |

---

## 4. A PLAN.md Fázis 1 feltevéseinek tényellenőrzése

### 4.1 `sanctum.expiration = null` vs. „player-token 90 nap" — **A FELTEVÉS MEGDŐLT, nincs ütközés**

**Tény:** `config/sanctum.php:53` valóban `'expiration' => null`. De ez a Sanctum szemantikájában **nem** azt jelenti, hogy „a token sosem jár le", hanem hogy **nincs globális, minden tokenre kényszerített lejárat**. Maga a config-komment mondja ki: *„This will override any values set in the token's expires_at attribute."*

A `createToken()` harmadik paramétere **per-token** `expires_at`-ot állít, és a guard (`vendor/laravel/sanctum/src/Guard.php:129`) az `expires_at`-ot **mindig** ellenőrzi. A kódbázis **egyetlen** token-kiadó hívási pontja — `app/Http/Controllers/PlayerPairingController.php:150-154` — explicit `now()->addDays(PlayerPairing::TOKEN_LIFETIME_DAYS)` = **+90 nap** lejáratot ad, `['player']` ability-vel.

Vagyis a `null` itt nemcsak hogy nem hiba, hanem **szükséges**: ha valaki pl. 60 percre állítaná, az **felülírná** a per-token 90 napot, és minden player óránként kiesne. Takarítás: `routes/console.php:34` napi `sanctum:prune-expired --hours=24`.

### 4.2 Extension-token életciklus — **TÁRGYTALAN, az extensionnek nincs tokenje**

`chrome-extension/background.js:11` `credentials: 'include'`-dal, **session-cookie-val** hívja a `routes/extension.php` web-csoportos végpontjait. A `manifest.json` permissions listája `["activeTab","contextMenus","storage"]`, a `chrome.storage.local` használat pedig kizárólag státusz-cache és feliratkapcsoló. **Token sehol nincs.** A „extension-token életciklus" kérdéskör így nem értelmezhető.

### 4.3 `REGISTRATION_ENABLED=false` — **TÉNYLEG ZÁR, szerveroldalon is**

`config/fortify.php:150`:
```php
env('REGISTRATION_ENABLED', true) ? Features::registration() : null,
```
Ez a `Features` tömbből veszi ki a registration feature-t, ami azt jelenti, hogy a Fortify a `/register` route-okat **be sem regisztrálja** — nem csak a UI tűnik el (`canRegister=false`). A jelenlegi állapot (`REGISTRATION_ENABLED=true`) mellett `route:list`-tel igazolva: `GET register` + `POST register.store` létezik, utóbbi `ThrottleRequests:register`-rel. `false` esetén egyik sem regisztrálódik → 404, nem 403. **Fail-closed, a feltevés helyes.**

Ez a tény cáfolta a C-3 leletet is (lásd 5. szakasz).

### 4.4 `ReviewController` (`review` + `POST review/complete`) — **NEM LÉTEZIK**

Konkrétan ellenőrizve:
- `ls app/Http/Controllers/ | grep -i review` → **0 találat**
- `grep -rn "ReviewController" app/ routes/ resources/js/` → **0 találat**
- `grep -n "review" routes/*.php` → **0 találat**

A napi ismétlő (review) funkció **teljesen kivezetve** a kódbázisból. A `user_word.reviewed_at` oszlop és a `FlashcardReview` model/tábla más funkciókhoz (flashcard SRS) tartozik, azok élnek és auditálva lettek (F-idor: tiszta). A PLAN.md ezen tétele **tárgytalan**.

### 4.5 Policy-lefedettség: csak 3 policy van — **NEM authorizáció-hiány**

`app/Policies/` tartalma pontosan 3 fájl: `FlashcardFolderPolicy`, `FolderPolicy`, `UserCustomWordPolicy`.

A PLAN.md feltevése („policy-hiány = auth-hiány") **megdőlt**. A többi 8 entity konzisztensen két mintát követ, mindkettő explicit és a kontrollerben látható:

**(a) Reláció-alapú lekérdezés** — az idegen ID fogalmilag el sem érhető:
`$request->user()->flashcardDecks()->find()`, `$user->customWords()`, `$deck->flashcards()->whereIn('id', $ids)`, `$request->user()->tokens()->whereKey()`, `UserBook::where('user_id', $user->id)`.

**(b) Route-model-binding UTÁN azonnali tulajdon-őr:**
`abort_unless($x->user_id === $request->user()->id, 403)` — 40+ hívóhelyen, mind a helyes irányban.

**Entitásonként (mind TISZTA):** FlashcardDeck, Flashcard (kettős őr: deck-tulajdon + kártya-deck kötés, mind a 12 metódus), Flashcard tömeges műveletek (a `whereIn` mindig a `$deck->flashcards()` relációra fut → idegen ID némán kiesik), `target_deck_id` (az `exists:` UTÁN explicit `findOrFail` + tulajdon-őr), FlashcardReview/SRS, FlashcardCalibration, FlashcardCsv, FlashcardFolder↔Deck kötés (**kétoldali** ellenőrzés), Folder, UserCustomWord, UserBook, YoutubeTranscript (a cache-kulcs is user-szuffixes), BillingoInvoice (szándékosan 404, nem 403 → ID-enumerációval sem derül ki idegen számla létezése), Sanctum player-token, PlayerPairing, Word/UserWord pivot (a `PATCH words/{word}` **kettős** őrrel: `can:admin` middleware + `Gate::authorize('admin')`), Quiz/Cloze `ids[]`, Achievement, Invite, Report, TextAnalysis, Extension+Player API.

**Az `exists:` szabályok célzott átvizsgálása** (mind a 7 találat): egyik sem elégtelen szűrő. Vagy már a szabályban user-szűrt (`Rule::exists('flashcard_folders','id')->where('user_id', $this->user()->id)`), vagy a kontroller újraszűri, vagy a **globális** `words` táblára mutat (ahol nincs tulajdonos).

**Globális scope-ok:** `grep addGlobalScope|ScopedBy|booted|resolveRouteBinding|getRouteKeyName` az `app/Models/` és `app/Providers/` alatt → **egyetlen** találat (`Word.php:15`, egy `saving` hook a level-számításhoz). A védelem **sehol nem támaszkodik rejtett globális scope-ra**.

### 4.6 `storage/{path}` (formálisan Fázis 4b) — megjegyzés a middleware-bejárásból

A `route:list --json` teljes szűrésekor **nem jelent meg `storage/{path}` route**. Ok: `config/filesystems.php:36-39` explicit `'serve' => false` a `local` diszken, kommenttel: *„the app never serves files off this private disk (no disk('local')/temporaryUrl usage)"*. A privát diszk tehát **nem publikálódik HTTP-n**. Ez konzisztens a Fázis 4b hatókörével, ott érdemes lezárni.

---

## 5. Megcáfolt leletek

Ugyanolyan értékes információ, mint a megerősítettek — ezeket megvizsgáltuk és **nem** sebezhetőségek.

### 5.1 Formálisan elvetett leletek

| ID | Állítás | Miért NEM sebezhetőség |
|---|---|---|
| **C-3** | `REGISTRATION_ENABLED` env-defaultja fail-open (`true`), és a config-cache befagyaszthatja a kikapcsolt állapotot | `.env:90` `REGISTRATION_ENABLED=true` — a regisztráció **szándékosan** engedélyezve. A default **megegyezik** a ténylegesen beállított értékkel, a kulcs elvesztése **nulla** állapotváltozást okoz. Másodlagos réteg: `CreateNewUser.php:56` `lockForUpdate()` + `Invite::isUsable()` tranzakción belüli újraellenőrzés. |
| **TOK-2** | A 90 napos player-token lejáratára nincs megújítás, nincs figyelmeztetés → néma kiesés | Nincs mit blokkolni, **nincs támadás**. A lejáratot `Guard.php:129` kényszeríti ki. A phishing-re épülő maradék-érvet lezárja: `PlayerPairingController.php:72-75` (paraméter- és előkitöltés-mentes connect oldal, **kézi kódbegépelés**, a kód nincs az URL-ben → nincs egykattintásos jóváhagyás) + `routes/api.php:23` (`auth:sanctum` + `abilities:player`). **A 90 napos korlát maga a védelem**, nem hiányosság. Legfeljebb UX-tétel (lejárat előtti értesítés). |

### 5.2 Adverzariálisan lebontott gyanúk (nem lettek leletek)

| Gyanú | Miért bukott meg |
|---|---|
| **Sanctum TransientToken-bypass** | Nincs `statefulApi()` a `bootstrap/app.php`-ban → az `api` csoport **nem indít sessiont**, tiszta token-auth, cookie-fallback nélkül. |
| **Extension guest-írás** | A `verified` middleware **fail-closed** `$request->user()` nélkül: `EnsureEmailIsVerified:33-37` a `! $request->user()` ágon rövidre zár és 403-at ad, a kontroller kódjától függetlenül. |
| **`_boost/browser-logs` MW nélküli POST** | `require-dev` csomag + `local`/`debug`-only boot-guard. |
| **`stripe/*` CSRF-wildcard** | Csak 2 route-ra illeszkedik, mindkettő aláírás-ellenőrzött (a GET `payment/{id}` állapotot nem módosít). |
| **Limit-race / dupla-kiadás a párosításban** | A beváltás **atomikus DELETE-tel claimelt** (`PlayerPairingController:146`) → egyszer használatos, race-mentes. |
| **`revokePlayerTokens()` túl tág** | Helyesen `abilities === ['player']` **egyenlőséget** néz, nem `can('player')`-t (utóbbi egy `*`-tokenre is igaz volna). |
| **TOTP-orákulum a `confirmed-two-factor-authentication`-ön** | A titkot a `/user/two-factor-secret-key` **ugyanazon middleware mögött nyíltan kiadja** → olvasható titok brute-force-olása nulla nyereség. + a Google2FA cache-eli a felhasznált kódokat (replay-védelem). |
| **`EnsureLoginIsNotThrottled` kiszűrve = elveszett védelem** | A vendor-réteg **ugyanazt** az `email\|ip` kulcsot használná ugyanazzal az 5/perc limittel → bekapcsolva sem adna semmit IP-rotáció ellen. **Redundancia, nem elveszett védelem.** |
| **`SESSION_DOMAIN` aldomain-szivárgás** | `config:show session.domain` futásidőben `null` → host-only cookie. Repó-szintű grep: semmi nem állítja át. |
| **Session-fixation** | Mind a 3 session-lezáró pont regenerál; a pipeline nincs felülírva (`Fortify::authenticateThrough` és `fortify.pipelines.login` = nem létezik). |

---

## 6. Lefedettség-táblázat

| Dimenzió | Fő bejárt felület | Terjedelem | Eredmény |
|---|---|---|---|
| **A — middleware** | Mind a 166 regisztrált route lánca (`route:list --json`), 8 saját route-fájl (web, api, extension, settings, words, flashcards, text-analysis, report) teljes, `bootstrap/app.php`, `EnsureOnboardingComplete`, `SecurityHeaders`, `FortifyServiceProvider`, `AppServiceProvider`, `ExtensionController` mind a 9 publikus metódusa, `PlayerPairingController` teljes, `DownloadController`, Settings-kontrollerek, `TextAnalysisController` 5 AI-kapuja, `User` model auth-metódusai, 4 config, 6 vendor-fájl | 100% | 1 HIGH (konszolidálva), 2 LOW; 4 gyanú adverzariálisan lebontva |
| **B — kézi auth** | Kontroller-oldali aláírás-ellenőrzés, minden publikus/closure route, Stripe-webhook lánc (CSRF-kivétel + `VerifyWebhookSignature` + boot-guard), teljes `app/` kézi auth-felület (`Gate::check`/`authorize`, `abort_unless`, `! $request->user()`), minden token-alapú publikus belépési pont (player-párosítás, meghívókód, e-mail-verifikáció, jelszó-reset) | 100% | 1 HIGH, 3 LOW, 2 INFO |
| **C — Fortify** | `FortifyServiceProvider` teljes, `config/fortify.php`, `config/auth.php`, `config/registration.php`, vendor Fortify route-ok + 9 kontroller + 6 action + `LoginRateLimiter` + `TwoFactorAuthenticatable`, egyedi actionök, `routes/settings.php` + 5 FormRequest, futásidejű `gatherMiddleware()` dump **minden** auth-route-ra, 4 meglévő teszt | 100% | 1 HIGH, 2 LOW (C-2 leminősítve), 1 elvetve |
| **D — session** | `config/session.php` teljes (236 sor), `bootstrap/app.php`, `AppServiceProvider` mind az 5 boot-guardja, Fortify login/logout pipeline vendor-szinten, `SecurityController`/`ProfileController` teljes, `ResetUserPassword`, `RegisterResponse`, `AuthenticateSession` vendor teljes, `.env.example` teljes, `SessionSecureCookieTest`, extension cookie/CSRF-út | 100% | 0 HIGH; D-1 MEDIUM→**LOW** (3/3 downgrade), 3 LOW, 2 INFO |
| **E — tokenek** | `config/sanctum.php`, token-kiadás/-visszavonás minden hívóhelye, `PlayerPairing` model + device-flow teljes, `User::revokePlayerTokens`, `routes/api.php` + `routes/extension.php`, 2 migráció, `CheckAbilities` vendor, `routes/console.php` prune, extension manifest+background+3 content script, Electron `auth-store.js`/`topwords-api.js`/`main.js`, 4 teszt | 100% | 0 HIGH/MEDIUM, 1 LOW (= D-1), 1 elvetve |
| **F — IDOR** | Mind az 51 paraméteres route + **minden** body/query ID-t fogadó végpont (`bulk*`, `ids[]`, `target_deck_id`, `flashcard_id`, `folder`, `custom_word_id`, `word_id`); 22 entity-csoport soronként; mind a 7 `exists:` szabály; globális scope-söprés; statikus lekérdezés-söprés (12 találat) | 100% | **0 HIGH, 0 MEDIUM, 0 LOW — TISZTA** |

**Nem bejárt / más fázishoz tartozó:** SSRF (F4a), publikus fájl-felület és `storage/{path}` (F4b — megjegyzés a 4.6-ban), AI-terhelés/cache (F3), pénz/előfizetés (F2), gamifikáció (F5), input/output-szanitizáció (F6), console/scheduler (F7), infra/headers/CORS (F8).

---

## 7. Zárás

**CSAK DOKUMENTÁLVA, kódmódosítás nem történt.**

Egyetlen fájl jött létre: ez a riport (`last_audit/reaudit-phase1/00-OSSZESITO.md`). Alkalmazás-kód, konfiguráció, teszt és `.claude` beállítás **nem** módosult.

**Prioritási sorrend a fejlesztőnek:**

1. **P0 — C-1**: `'password.confirm.store' => 'throttle:password-request'` a `FortifyServiceProvider.php:118`-ban. Egysoros, nulla regressziós kockázat, tesztelhető.
2. **P1 — C-5**: `Failed` + `Lockout` auth-esemény-listener a meglévő riasztási láncba (a C-1 és C-2 detektálhatóságáért).
3. **P2 — D-1**: `revokePlayerTokens()` az e-mail-váltási ágra (`ProfileController::update`), a `SecurityController::update` mintájára.
4. **P3 — olcsó keményítések**: C-4 (egységes forgot-password válasz), D-2 (`.env.example` kommentek), D-4 (`SESSION_ENCRYPT=true`), MB-3 (`aiLimitGuard` explicit 401), MW-3 (2FA-route throttle).
5. **Opcionális / megfontolandó**: C-2 (fiók-kulcsú második limiter), D-3 („kijelentkezés minden eszközről"), MB-2 (`Cashier::ignoreRoutes()`), MB-4 (meghívókód ábécé).

**A Fázis 2-8 jóváhagyásra vár.**
