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

- [ ] **🟠 #A1 — Email-verifikáció no-op**
  `app/Models/User.php:5,22`, `config/fortify.php:152`, `routes/web.php:53,58`
  A `verified` middleware sok route-on ott van, de a `User` nem implementálja a
  `MustVerifyEmail`-t (az import ki van kommentezve), így minden user verifikálatlanul átmegy.
  A profil UI sem kér verifikációt (`mustVerifyEmail` mindig false).
  **Javítás:** vagy `class User ... implements MustVerifyEmail`, vagy vegyük le a `verified`
  middleware-t és a `Features::emailVerification()`-t (hogy ne legyen hamis biztonságérzet).
  *Megj.: a `verified` itt a user saját onboarding/dashboard oldalát kapuzza, nem kereszt-felhasználós
  erőforrást — a tényleges kockázat: verifikálatlan emaillel be lehet jutni. Súly vitatható (Low–High).*

- [ ] **🟡 #A2 — Invite-beváltás nem atomi (TOCTOU)**
  `app/Actions/Fortify/CreateNewUser.php:30-56`, `app/Models/Invite.php:23-30`
  Az `isUsable()` ellenőrzés és az `increment('uses')` külön, lock nélküli lépések.
  Konkurens regisztrációval túlléphető a `max_uses`. Most lappangó (`INVITE_ONLY=false`),
  de a tervezett paywallnál High lesz.
  **Javítás:** `DB::transaction` + `lockForUpdate`, vagy atomi feltételes update
  (`where('uses','<','max_uses')->increment('uses')`), és 0 érintett sor = „elfogyott”.

- [ ] **🟡 #A3 — Ismételhető trial-abuse**
  `app/Actions/Fortify/CreateNewUser.php:46-53`, `config/registration.php:14`
  Minden regisztráció kap 5 nap `basic`-et dedup/eszközkötés nélkül → végtelen friss fiókkal
  örök ingyen basic. (`lowercase_usernames` csak kisbetűsít, a `+` aliasokat nem szűri.)
  **Javítás:** üzleti döntés kérdése — trial invite-only mögé / fizetési mód kérése /
  trial-jogosultság követése normalizált email/identitás alapján.

- [ ] **🟢 #A4 — Túl bő `#[Fillable]` a User-en (lappangó mass-assignment)**
  `app/Models/User.php:20`
  A fillable tartalmazza: `lifetime_access`, `ai_access`, `trial_ends_at`, `invite_id`.
  Most NEM kihasználható (regisztráció és profil-update is whitelistet/`validated()`-et használ),
  de egy jövőbeli `update($request->all())` privilégium-emelés lenne.
  **Javítás:** vegyük ki a jogosultsági mezőket a `#[Fillable]`-ből, és állítsuk őket
  explicit `forceFill`-lel a szerveroldali action-ökben.

- [ ] **🟢 #A5 — Nincs rate limit a regisztráción és a jelszó-reset kérésen**
  `app/Providers/FortifyServiceProvider.php:82-93`
  Csak `login` (5/min) és `two-factor` van throttle-özve; a `register` és `forgot-password`
  nincs. Tömeges fiókgyártás / email-bombing. (A reset-broker 60s-os throttle részben véd.)
  **Javítás:** `throttle:` middleware a registration és forgot-password route-okra.

- [ ] **⚪ #A6 — `/dev-login` backdoor**
  `routes/web.php:72-78`
  Hitelesítés nélkül belép `User::first()`-ként; `app()->environment('local')` védi, prodban
  nem regisztrálódik. Törlendő (ahogy a komment is jelzi). Ha marad: `APP_DEBUG` + titkos token,
  és `redirect()->to()` same-host ellenőrzéssel.

**Cáfolt (nem teendő):** gyenge jelszó-policy (prodban `min(12)`+uncompromised), jelszó-reset
folyamat, account enumeration, 2FA-konfig, session-config, admin gate — mind rendben.

---

## Extension API + AI

- [ ] **🟠 #E1 — SSRF a webpage-fetch-ben (redirect + DNS-rebinding bypass)**
  `app/Http/Controllers/TextAnalysisController.php:122-164,396-400`
  Az `assertPublicHost()` csak a kezdő hostot ellenőrzi, de a `Http::get()` követi a redirecteket.
  `evil.com` → `169.254.169.254`/`127.0.0.1` átirányítással belső/metadata oldalak olvashatók
  (body 15 000 karakterig visszajön). DNS-rebinding (TOCTOU) is nyitva. Auth+throttle védi,
  de bármely free-user eléri (`fetchSource`-on nincs plan-check).
  **Javítás:** tiltsuk a redirect-követést (`allow_redirects=false`) és utasítsuk el a 3xx-et,
  vagy hopponként újra-`assertPublicHost`; a feloldott IP-t rögzítsük/validáljuk connect-időben
  (DNS-rebind ellen); response-size cap.

- [ ] **🟡 #E2 — AI-budget nem atomi (konkurens túlköltés)**
  `app/Services/AiUsageService.php:13-36`, `TextAnalysisController.php:35-48` és a `record()` hívások
  Az `allows()` olvas, a Gemini-hívás *után* jön a `record()` increment — lock/foglalás nélkül.
  Konkurens kérések mind átmennek → túlköltés a havi kereten felül. (Csak AI-jogosult user a saját
  keretét; nem anonim cost-abuse.)
  **Javítás:** foglalás a hívás ELŐTT (atomi increment, utána korrekció), vagy `Cache::lock()` /
  `DB::transaction` + `lockForUpdate` a check-increment köré; szigorúbb per-perc throttle.

- [ ] **🟢 #E3 — `geminiListModels` nyers upstream válasz**
  `app/Http/Controllers/TextAnalysisController.php:826-834`
  A teljes Google-választ (és hibatestet) nyersen visszaadja minden AI-jogosultnak. Nem
  kulcs-szivárgás (a kulcs header). Dev-tooling jellegű.
  **Javítás:** admin-only (dobjuk a `hasAiAccess`-t) vagy törlés; ha marad, mező-whitelist.

- [ ] **⚪ #E4 — Extension auth-hibák HTTP 200-zal**
  `ExtensionController.php:18,107,152,245`
  Az `unauthenticated` válaszok 200-at adnak 401 helyett (a `youtubeTranscript` helyesen 401/403).
  Konzisztencia, nem sebezhetőség.
  **Javítás:** `, 401` a JSON válaszokhoz.

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

- [ ] **🟠 #D1 — Túl bő `User` szerializáció a shared propban**
  `app/Http/Middleware/HandleInertiaRequests.php:44`, `app/Models/User.php:21`
  A `'user' => $request->user()` minden oldalra kiküldi a teljes modellt; a `#[Hidden]` csak
  jelszó/2FA/remember_token-t rejt. Kimegy: `stripe_id`, `pm_type`, `pm_last_four`,
  `plan_override`, `ai_credit_limit`, `ai_credits_used`, `lifetime_access`, `invite_id`.
  *Saját adat (nem kereszt-felhasználós), ezért az adverzális kör Low-ra húzta — súly vitatható.*
  **Javítás:** vagy bővítsük a `#[Hidden]`-t a fenti oszlopokkal, vagy (jobb) explicit whitelist
  (`only(['id','name','email','onboarding_completed_at', ...])`). A plan-állapotot a frontend a
  `subscription` tömbből úgyis megkapja, a nyers oszlopok nem kellenek kliensoldalon.

- [ ] **🟡 #D2 — `APP_DEBUG=true` + nincs custom error oldal**
  `.env`
  Lokálban rendben, de prodba kerülve stack-trace/env/PII szivárgás (Ignition). Semmi nem
  kényszeríti ki a `false`-t. (Lásd lent az általános megjegyzést.)
  **Javítás:** prod `.env`-ben `APP_DEBUG=false`, `APP_ENV=production`; opcionálisan custom
  Inertia error oldal 4xx/5xx-re.

**Cáfolt (nem teendő):** rich-text editor `dangerouslySetInnerHTML` (csak self-XSS — nincs megosztott
deck / admin-render), 2FA QR SVG (szerver-generált), admin PII (`can:admin` mögött, nincs
stripe_id/pm_last_four), kliens-bundle titkok (nincs `VITE_` kulcs), `public/` (tiszta, nincs
directory listing / titok-fájl).

---

## Billing / Stripe

- [ ] **🟠 #B1 — Webhook aláírás-ellenőrzés „fail-open” hiányzó secret esetén**
  `vendor/laravel/cashier/.../WebhookController.php:27-32`, `bootstrap/app.php:22`
  A `stripe/*` CSRF alól ki van véve, így az aláírás-ellenőrzés az EGYETLEN védelem. A Cashier
  viszont csak akkor csatolja a `VerifyWebhookSignature` middleware-t, ha
  `config('cashier.webhook.secret')` nem üres. **Jelenleg védve** (a `STRIPE_WEBHOOK_SECRET` be van
  állítva, 70 karakter), de ha valaha üres/kimarad (rossz deploy, config-cache, új env), a végpont
  csendben elfogad hamisított, aláíratlan webhookokat → kamu `subscription.created/updated`
  eseménnyel ingyen prémium adható bárkinek (a `subscriptionPlan()` a `stripe_price`-ból dönt).
  **Javítás:** boot-időben dobjon hibát, ha `STRIPE_ENABLED=true` de a webhook-secret üres; vagy
  override-oljuk a controller konstruktort, hogy hiányzó secretnél hard-fail legyen (ne skip).

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
