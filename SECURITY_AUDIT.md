# Biztonsági audit — találatok és teendők

Lépésenkénti (egységenkénti) biztonsági átvizsgálás. Minden találatot adverzálisan ellenőriztünk,
mielőtt ide került. A súlyok a jelenlegi környezetet veszik alapul (`APP_ENV=local`,
`REGISTRATION_ENABLED=true`, `INVITE_ONLY=false`, nyílt regisztráció).

**Állapot:**
- [x] Auth & regisztráció
- [x] Extension API + AI
- [x] Billing / Stripe
- [x] Jogosultság & entitások (IDOR) — tiszta, nincs találat
- [x] Data exposure / frontend (XSS, shared props)

Jelmagyarázat: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low · ⚪ Info

## Javasolt javítási sorrend

1. **#A1** — email-verifikáció (`MustVerifyEmail` vagy a `verified` levétele) — gyors, egyértelmű.
2. **#E1** — SSRF redirect/DNS-rebind javítás (`fetchWebpageText`) — a legmagasabb valós kockázat.
3. **#B1** — webhook-secret boot-idői assert (most védve, de néma fail-open).
4. **#A2** — invite-beváltás atomivá tétele — **a paywall élesítése ELŐTT kötelező.**
5. **#E2** — AI-budget atomi foglalás.
6. **#A4 / #D1** — `#[Fillable]` szűkítés + `User` szerializáció whitelist (összevonható, egy modell).
7. **#A5** — rate limit a register / forgot-password route-okra.
8. **#A3** — trial-abuse (üzleti döntés).
9. **#E3, #E4, #A6** — kisebb hardening / takarítás.
10. **Prod-konfig** — `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true` (#D2 + alább).

---

## Auth & regisztráció

- [x] **🟠 #A1 — Email-verifikáció no-op — KÉSZ (2026-06-19)**
  Megoldás: a feature levétele (nem `MustVerifyEmail` bevezetése), hogy ne legyen hamis
  biztonságérzet és senki ne akadjon ki. Elvégzett változtatások:
  - `config/fortify.php` — `Features::emailVerification()` törölve
  - `verified` middleware levéve 6 helyről: `routes/web.php` (onboarding + dashboard/achievements),
    `flashcards.php`, `words.php`, `text-analysis.php`, `settings.php`
  - `FortifyServiceProvider` — halott `verifyEmailView` regisztráció törölve
  - Az `EmailVerificationTest` / `VerificationNotificationTest` automatikusan skip-el
    (`skipUnlessFortifyFeature`); teszt-suite zöld. Pint zöld.
  - Frontend-takarítás (a Wayfinder már nem generálja a `@/routes/verification`-t, ami build-hibát
    okozott): törölve a halott `verify-email.tsx`, a `profile.tsx` verifikációs blokkja, és a
    ProfileController `mustVerifyEmail`/`status` propátadása. `npm run build` zöld.

- [x] **🟡 #A2 — Invite-beváltás nem atomi (TOCTOU) — KÉSZ (2026-06-19)**
  `app/Actions/Fortify/CreateNewUser.php`
  A beváltás `DB::transaction`-be került, az invite sort `lockForUpdate()` zárolja, és a
  használhatóság **a zár alatt újra** ellenőrződik (a validációs closure csak UX-előellenőrzés).
  Nem-használható kódra `ValidationException` (`invite` kulcs) — a user a megszokott hibát látja,
  user nem jön létre, a tranzakció visszagörget. Új teszt: egyszeri kód kétszer nem váltható be
  (`uses` 1 marad). Suite zöld (186 passed).

- [x] **🟡 #A3 — Ismételhető trial-abuse — KÉSZ (2026-06-19, üzleti döntés)**
  `app/Actions/Fortify/CreateNewUser.php`, `config/registration.php`, `app/Http/Controllers/PricingController.php`
  Üzleti döntés: **a regisztráció nem ad trialt** — minden új fiók a `free` csomagon indul. A
  CreateNewUser már nem állít `trial_ends_at`-ot. Próbaidő csak **előfizetéskor** indul (Stripe
  trial, `subscription_trial_days`, alapból 30 nap) a `PricingController::checkout`-ban
  (`->trialDays(...)`), ahol a kártyát elkérik. Tesztelőknek az admin felület ad csomagot
  (`plan_override`). Így nincs mit visszaélni: ingyen trial nem létezik.
  *⚠ Manuálisan ellenőrizendő Stripe teszt-kártyával: checkout → trialing állapot → a trial alatt
  a fizetett csomag jár, a hónap végén jön az első terhelés.*

- [x] **🟢 #A4 — Túl bő `#[Fillable]` a User-en — KÉSZ (2026-06-19)**
  `app/Models/User.php`, `app/Actions/Fortify/CreateNewUser.php`
  A `lifetime_access`, `ai_access`, `trial_ends_at`, `invite_id` kikerült a `#[Fillable]`-ből
  (a `plan_override`/`stripe_*`/`ai_credit*` eleve nem volt benne). A `CreateNewUser` mostantól
  `forceFill`-lel állítja a `trial_ends_at`/`invite_id`-t. Az `AdminController` direkt property-vel
  ír (nem érintett), a factory megkerüli a fillable-t (tesztek nem érintettek). Új teszt: a 6
  jogosultsági mező nem mass-assignelhető. Suite zöld (189 passed).

- [x] **🟢 #A5 — Nincs rate limit a regisztráción és a jelszó-reset kérésen — KÉSZ (2026-06-19)**
  `app/Providers/FortifyServiceProvider.php`
  Két IP-alapú limiter (`register` 10/min, `password-request` 5/min), és egy `booted()` hook
  rárakja a `throttle:` middleware-t a Fortify `register.store` / `password.email` route-okra
  (a Fortify ezekre alapból nem tesz limitert; csak login/two-factor/passkey-re van config-kapocs).
  2 új teszt (a route-ok hordozzák a limitert; a forgot-password 6. kérése 429). Suite zöld
  (191 passed).

- [x] **⚪ #A6 — `/dev-login` backdoor — KÉSZ (2026-06-19)**
  `routes/web.php`
  A `/dev-login` route és a fölöslegessé vált `User`/`Auth` importok törölve.

**Cáfolt (nem teendő):** gyenge jelszó-policy (prodban `min(12)`+uncompromised), jelszó-reset
folyamat, account enumeration, 2FA-konfig, session-config, admin gate — mind rendben.

---

## Extension API + AI

- [x] **🟠 #E1 — SSRF a webpage-fetch-ben — KÉSZ (2026-06-19)**
  `app/Http/Controllers/TextAnalysisController.php`
  Új `safeFetch()` helper: a redirecteket kézzel követjük (max 5), és **minden hopon** újra
  `assertPublicHost()`; a kapcsolatot a feloldott IP-re pinneljük (`CURLOPT_RESOLVE`), így a
  DNS-rebinding (TOCTOU) nem tud belső címre fordítani. A redirect-célnál http(s) séma kötelező.
  Az `assertPublicHost()` mostantól visszaadja a validált IP-t, és a feloldhatatlan hostot is
  elutasítja (eddig átment). 3 új teszt (privát IP / belső redirect / publikus oldal); suite zöld
  (182 passed). Pint zöld.
  *Megj.: a 15 000 karakteres `mb_substr` cap továbbra is megvan a `fetchSource`-ban.*

- [x] **🟡 #E2 — AI-budget nem atomi — KÉSZ (2026-06-19)**
  `app/Services/AiUsageService.php`, `app/Http/Controllers/TextAnalysisController.php`
  Foglalás→rendezés minta a `callGemini()` közös fojtópontban: a hívás ELŐTT atomi, feltételes
  `increment` foglalja le a becsült költséget (`reserve()`, `where ai_credits_used < limit` →
  konkurens kérések nem láthatnak elavult „van keret” állapotot, TOCTOU lezárva). Siker után
  `settle()` a valós költségre rendez, hiba esetén `refund()` visszaadja a foglalást (nincs
  szivárgás). A régi `record()` és a 4 híváshelyi hívás megszűnt; az `allows()` pre-check megmaradt
  gyors 429-hez. Admin (korlátlan) érintetlen. 2 új teszt (refund hibánál; a meglévő pontos
  költség-tesztek továbbra is zöldek). Suite zöld (187 passed).

- [x] **🟢 #E3 — `geminiListModels` nyers upstream válasz — KÉSZ (2026-06-19)**
  `app/Http/Controllers/TextAnalysisController.php`
  A guard `Gate::check('admin') || hasAiAccess()` → **admin-only** (`abort_unless(Gate::check('admin'), 403)`).
  A valódi AI-feature végpontok (`geminiWordLookup` stb.) érintetlenek.

- [x] **⚪ #E4 — Extension auth-hibák HTTP 200-zal — KÉSZ (2026-06-19)**
  `app/Http/Controllers/ExtensionController.php`
  A 4 `unauthenticated` válasz mostantól `401` (lookup/addWord/statuses/search); a `badge`
  szándékosan marad 200 `count:0` (a kiegészítő badge-logikája olvassa). Teszt frissítve
  (`assertUnauthorized`).

**Cáfolt (nem teendő):** prompt injection (sanitizeWordForPrompt regex+cap), YouTube-SSRF
(szigorú 11-karakteres video-ID), extension `auth` middleware hiánya (kézi user-check + session
cookie), CORS (nincs wildcard+credentials), extension-kód titkok (csak APP_URL + relayelt CSRF),
EPUB/PDF zip-traversal (`normalizePath`), AI flashcard HTML XSS (`htmlspecialchars`).

---

## Jogosultság & entitások (IDOR)

**Nincs megerősített IDOR / jogosultsági hiba.** A jogosultsági fegyelem konzisztens, minden
CRUD-igére ellenőrizve:
- Folders / FolderWord / CustomWords → `Gate::authorize` policy vagy `$user->...()` scope
- Flashcard Decks → minden metódus `abort_unless($deck->user_id === user->id)`
- Flashcard Cards → dupla check (`deck->user_id` + `flashcard->deck_id`); `move`/`bulkMove` a cél
  decket is újraellenőrzi; bulk-op `$deck->flashcards()->whereIn('id',$ids)` scope
- Calibration / Study / CSV → deck-scope; CSV-export formula-injection védelemmel
- Flashcard Folders / FolderDeck → policy + `abort_unless`
- Quiz / Cloze / Review / IrregularVerb → olvasás vagy `where('user_id', ...)` self-scope
- Admin → mind a 4 action `can:admin` csoportban, szigorú email-egyezés gate

**Cáfolt:** `Flashcard.deck_id` mass-assignment (request-whitelist nem tartalmazza), unscoped
route-model binding (kontrollerek kompenzálnak), bulk endpoint arbitrary id (no-op).

---

## Data exposure / frontend

- [x] **🟠 #D1 — Túl bő `User` szerializáció a shared propban — KÉSZ (2026-06-19)**
  `app/Http/Middleware/HandleInertiaRequests.php`
  A `'user' => $request->user()` helyett explicit whitelist:
  `->only(['id','name','email','email_verified_at'])`. A frontend csak ezeket olvassa
  (`name`/`email`/`email_verified_at`), a plan-állapotot a `subscription` blokk adja, a
  `trial_ends_at`-ot a Pricing/Subscription kontroller külön. Így `stripe_id`, `pm_*`,
  `plan_override`, `ai_credit*` stb. már nem megy ki egyetlen oldalra sem. Új teszt: a shared
  `auth.user` prop nem tartalmazza a billing/entitlement mezőket. Suite zöld (189 passed).

- [x] **🟡 #D2 — `APP_DEBUG=true` (prod-konfig) — KÉSZ (prodban rendezve, 2026-06-19)**
  Prodban `APP_DEBUG=false` beállítva (a felhasználó megerősítette). Lokálban marad `true`
  (dev-kényelem). Custom Inertia error oldal opcionális, nem készült.

**Cáfolt (nem teendő):** rich-text editor `dangerouslySetInnerHTML` (csak self-XSS — nincs megosztott
deck / admin-render), 2FA QR SVG (szerver-generált), admin PII (`can:admin` mögött, nincs
stripe_id/pm_last_four), kliens-bundle titkok (nincs `VITE_` kulcs), `public/` (tiszta, nincs
directory listing / titok-fájl).

---

## Billing / Stripe

- [x] **🟠 #B1 — Webhook aláírás-ellenőrzés „fail-open” — KÉSZ (2026-06-19)**
  `app/Providers/AppServiceProvider.php`
  Új `assertStripeWebhookSecured()` a `boot()`-ban: ha `services.stripe.enabled` igaz, de a
  `cashier.webhook.secret` üres, az alkalmazás `RuntimeException`-nel megtagadja a bootot (fail-loud)
  — így a `stripe/*` (CSRF-exempt) végpont sosem fut aláírás-ellenőrzés nélkül. 3 teszt
  (enabled+no-secret dob / enabled+secret ok / disabled+no-secret ok). Suite zöld (185 passed).
  *Megj.: a hatás megegyezik a Cashier feltételes `VerifyWebhookSignature` middleware-ével — most
  csak nem maradhat csendben kikapcsolva.*

**Cáfolt (nem teendő):**
- Kliens-vezérelt ár/plan → ingyen upgrade: `checkout` szerveroldali allowlist
  (`in_array($plan, ['basic','premium'])`), a price ID configból; ár sosem a requestből.
- IDOR a checkout/portal `stripe_id`-n: minden a `$request->user()` saját Billable-jén, nincs
  user-megadott customer/subscription azonosító, `auth` mögött.
- Entitlement-bypass elavult előfizetéssel: `activeSubscription()` csak `valid()` esetén ad vissza;
  canceled/past_due nem ad hozzáférést; `currentPlan()` `free`-re esik.
- Webhook idempotencia/replay: a handlerek `updateOrCreate`/`firstOrNew` `stripe_id` kulccsal
  (idempotens); egyik sem ír `lifetime_access`/`ai_access`/`plan_override`-t (azok admin-only).
- `pricing/success`: `signed` middleware mögött, és csak visszaigazol (nem ad jogosultságot) —
  helyes minta.
- Stripe secret a kliensen: nincs; csak boolean/dátum propok mennek ki.

*Megj.: a túl bő `#[Fillable]` (lásd #A4) itt is felmerült mint defense-in-depth szag, de
exploit-út jelenleg nincs.*

---

## Általános környezeti megjegyzés
`APP_DEBUG=true` lokálban rendben, de **prodban kapcsoljuk ki** (stack-trace disclosure a hibautakon).
`SESSION_SECURE_COOKIE` legyen `true` prodban.
