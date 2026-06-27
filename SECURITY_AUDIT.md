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

- [x] **🟡 #D3 — Hiányzó HTTP security response headerök — KÉSZ (2026-06-20)**
  `app/Http/Middleware/SecurityHeaders.php` (új, aktív), `bootstrap/app.php`
  Eddig az élő app **egyetlen** hardening-fejlécet sem küldött (a `backup/`-ban lévő `SecurityHeaders`
  nem volt regisztrálva). Új middleware a `web` csoport végén:
  - **Mindig:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`, `X-Permitted-Cross-Domain-Policies: none`,
    `Permissions-Policy` (camera/mic/geo/payment/usb/cohort tiltva).
  - **Csak prod** (`app()->isProduction()`): `Strict-Transport-Security` (1 év + preload) és egy
    `Content-Security-Policy`. A CSP a navigációs/framing-vektorokat zárja le
    (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`); az
    inline `script`/`style` engedett (a root blade dark-mode inline scriptje + Tailwind inline stílus),
    a font CDN (`fonts.bunny.net`) allowlistelve. Prod-only, mert a Vite dev-szerver (HMR ws + inline
    refresh) különben törne. 3 új teszt (baseline fejlécek; CSP/HSTS nincs dev-ben; CSP/HSTS van
    prodban). Suite zöld (205 passed).
  *⚠ Élesítés után érdemes a böngésző-konzolban ellenőrizni, hogy a CSP nem blokkol semmit
  (`npm run build` utáni statikus asseteknél). Ha később Stripe.js Elements / beágyazott iframe kerül
  be, a `frame-src`/`script-src` bővítendő.*

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

- [x] **🟡 #B2 — Párhuzamos checkout → dupla előfizetés / dupla számlázás — KÉSZ (2026-06-27)**
  `app/Http/Controllers/StripeWebhookController.php`
  A `checkout` a meglévő előfizetést a session **létrehozásakor** ellenőrzi (`activeSubscription()`),
  de a helyi előfizetés csak a `customer.subscription.created` webhookkor jön létre. Két fülön
  befejezett Checkout → két párhuzamos Stripe-előfizetés, a trial végén mindkettő számláz.
  Megoldás: a webhook-kezelő override-olja `handleCustomerSubscriptionCreated`-et, és bármely
  duplikátum aktív előfizetést azonnal lemond (`cancelNow`), a legrégebbit megtartva — ebben az
  appban usernként mindig pontosan 1 aktív előfizetés van (a csomagváltás helyben swap-el). A
  takarítás `try/catch`-ben fut, hogy soha ne buktassa a webhookot. A duplikátum-kiválasztó logika
  (`duplicateSubscriptionsFor`) önállóan tesztelt (3 teszt); a `cancelNow` Stripe-hívása csak
  integrációban fut.

- [x] **🟡 #B3 — Fölösleges fizetős előfizetés admin-adta / lifetime hozzáférésnél — KÉSZ (2026-06-27)**
  `app/Http/Controllers/PricingController.php`
  A `checkout` csak `activeSubscription()`-t (Stripe) nézett, `hasActiveAccess()`-t nem. Egy
  `plan_override` vagy `lifetime_access` usernek nincs Stripe-előfizetése, így a swap-ág nem fogta
  meg → fölösleges fizetős előfizetést indíthatott azért, amit ingyen kap. Új szerveroldali kapu:
  ha nincs Stripe-előfizetés **de** `hasActiveAccess()`, visszairányít a pricingre. 1 teszt.

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
- `swap()` lemondott (grace period) előfizetésnél: a Cashier `getSwapOptions` `cancel_at_period_end
  => false`-t küld és a trial-t megőrzi (`trial_end`), így a csomagváltás helyesen újraindítja az
  előfizetést — nincs local↔Stripe desync (ellenőrizve a vendor kódban).

*Megj.: a túl bő `#[Fillable]` (lásd #A4) itt is felmerült mint defense-in-depth szag, de
exploit-út jelenleg nincs.*

---

## Fájl-upload (EPUB/PDF könyv-feltöltés) — KÉSZ (2026-06-20)

`app/Http/Controllers/TextAnalysisController.php` (`uploadBook`, `extractEpubText`, `readEpubSpine`,
`findEpubOpfPath`). A feltöltés `auth`+onboarding mögött, throttle 10/min; minden book-endpoint
IDOR-védett (`abort_unless($book->user_id === user->id)`).

**Megerősítve BIZTONSÁGOS:**
- **XXE — nincs.** Az EPUB OPF/XHTML **regex + `strip_tags`**-gel parse-olódik, semmilyen XML-motor
  (DOMDocument/SimpleXML/`loadXML`) nem érinti az untrusted tartalmat; a PDF a smalot/pdfparser
  (nem XML). Nincs external-entity feloldás.
- **Zip-traversal — védett** (`normalizePath` kihajítja a `..` szegmenseket).

- [x] **🟠 #F1 — Zip-bomb / dekompressziós DoS az EPUB-olvasásban — KÉSZ (2026-06-20)**
  `ZipArchive::getFromName()` méret-ellenőrzés nélkül tömörített ki bejegyzéseket memóriába → egy
  rosszindulatúan tömörített EPUB (akár 100 MB-os feltöltésből) GB-okra bomolhatott, OOM-ot okozva.
  Bárki regisztrálttal elérhető volt (free terv = 1 könyv). Javítás: új `safeReadZipEntry()` —
  `statName()`-mel ellenőrzi a kicsomagolt méretet, és csak a per-bejegyzés cap (`MAX_EPUB_ENTRY_BYTES`
  = 5 MB) alatt olvas; minden olvasási hely (container.xml, OPF, spine, TOC-check) ezen megy át. A
  spine-ciklus emellett a kumulált méretet is figyeli (`MAX_EPUB_TOTAL_BYTES` = 40 MB). 2 új teszt
  (valid EPUB kinyeri a szöveget; >5 MB-os bejegyzés kihagyva → 422). Suite zöld (210 passed).

- [x] **🟡 #F2 — Túl magas feltöltési limit — KÉSZ (2026-06-20)**
  A `max:102400` (100 MB) inkonzisztens volt a 30 MB-os tárhely-limittel, és felerősítette az EPUB
  zip-bomb + a smalot/pdfparser memória-DoS kockázatát (egy nagy/komplex PDF parse-olása OOM-ot
  okozhat, amit a try/catch nem fog el). Csökkentve `max:30720` (30 MB) — egy könyvhöz bőven elég,
  és a tárhely-limithez illeszkedik.

---

## Flashcard CSV-import — KÉSZ (2026-06-20)

`app/Http/Controllers/FlashcardCsvController.php`. Az import-út átvizsgálva — **lényegében
biztonságos**: IDOR (`abort_unless($deck->user_id === user->id, 403)`), fájlméret-DoS bekorlátozva
(`max:2048` KB + `MAX_IMPORT_ROWS=5000`), stored XSS kizárva (`textToHtml` → `htmlspecialchars(ENT_QUOTES)`,
plusz a render `sanitizeHtml`-en megy át, #X1), mass assignment biztonságos (`insert()` szerver-fix
kulcsokkal), modern `fgetcsv(escape='')`. Formula-injection az exportnál már védve (#audit IDOR).

- [x] **🟢 #C1 — CSV-import nem korlátozta a mezőhosszt — KÉSZ (2026-06-20)**
  A web-szerkesztő és az extension `max:10000`-et kényszerít a `front`/`back`-re, a CSV-import viszont
  nem → egy >64 KB-os cella a `text` oszlopnál (strict módban) insert-hibát dobhatott, és inkonzisztens
  volt. Új `MAX_FIELD_LENGTH=10000` konstans; a túl hosszú mezőt tartalmazó sor a meglévő „kihagyva"
  szemantikával átugorva. 3 új teszt (valid import; túl hosszú sor kihagyva; idegen deck → 403).
  Suite zöld (208 passed).

---

## Függőségek (dependency audit)

- [x] **🔴/🟠 #DEP1 — Sérülékeny Composer-függőségek — KÉSZ (2026-06-20)**
  `composer.lock` (forrás: `composer audit`)
  Kiindulás: **19 advisory / 10 csomag**. A lényegesek: `laravel/framework` (High — CRLF a default
  `email` validációs szabályban + signed-URL path confusion), `symfony/mime` (High — email/SMTP
  CRLF), `guzzlehttp/guzzle` + `guzzlehttp/psr7` (CRLF + HTTPS→cleartext proxy downgrade),
  `symfony/http-foundation` (SSRF-bypass — **minket nem érint**, mert a `safeFetch`/`assertPublicHost`
  natív `filter_var(FILTER_FLAG_NO_PRIV_RANGE|NO_RES_RANGE)`-et használ, nem Symfony `IpUtils`-t),
  `symfony/routing`, `http-kernel`, `mailer`, `yaml`, `polyfill-intl-idn`.
  Javítás: patch-szintű frissítés a meglévő constraint-eken belül —
  `composer update laravel/framework guzzlehttp/guzzle guzzlehttp/psr7 -W` (Laravel v13.2.0→v13.16.1,
  guzzle 7.10→7.12.1, a Symfony-komponensek vele), majd `composer update symfony/yaml` (v8.0.6→javított).
  Eredmény: **`composer audit` → No security vulnerability advisories found.** Teljes suite zöld
  (205 passed). *Megj.: az npm oldalon maradt 8 sérülékenység (vite/concurrently/postcss) mind
  **dev-dependency**, prodba nem kerül — alacsony prioritás, `npm audit fix` opcionálisan.*
  *⚠ A `composer.lock` változott → deploykor `composer install --no-dev` a szerveren.*

---

## Általános környezeti megjegyzés
`APP_DEBUG=true` lokálban rendben, de **prodban kapcsoljuk ki** (stack-trace disclosure a hibautakon).
`SESSION_SECURE_COOKIE` legyen `true` prodban.

---

## Extension újra-audit — flashcard/AI-kártya, kifejezés-kiemelés, státusz/fontosság (2026-06-19)

Az extension új funkcióinak átvizsgálása: státusz/fontosság a popupból, kifejezés-kiemelés
(YouTube/Netflix/oldal), flashcard-készítés a popupból (kézi + AI), és az érintett backend.
5 területet auditáltunk (kliens XSS/DOM, `ExtensionController`, AI/SSRF/költség, manifest/CSP/cookie,
státusz/fontosság IDOR). **Nincs Critical/High.**

- [x] **🟡 #X2 — AI-flashcard előnézet nyers `innerHTML`-lel renderelt backend-HTML-t — KÉSZ (2026-06-19)**
  `chrome-extension/content.js`. Ma is biztonságos volt (a `buildFlashcardFront/Back` minden
  modell-mezőt `htmlspecialchars`-el, a bemeneti szó `^[\pL][\pL'\- ]{0,99}$`-re szűrt), de
  törékeny minta. Javítás: új `sanitizeAiHtml()` (veszélyes elemek + `on*` kezelők + `javascript:`/
  `data:` URL-ek eltávolítása) + `replaceChildren(...)` a nyers `innerHTML` helyett.

- [x] **🟢 #X3 — `esc()` nem escape-elte az idézőjeleket — KÉSZ (2026-06-19)**
  `chrome-extension/content.js`. Latens attribútum-kontextus footgun (nem volt kihasználható).
  Az `esc()` mostantól `"`→`&quot;` és `'`→`&#39;`-t is escape-el; a felirat-renderelő (`ytWordsToHtml`)
  az ad-hoc `replace(/"/)` helyett az egységes `esc()`-t használja az attribútumhoz.

- [x] **🟢 #X4 — `background.js` `onMessage` nem ellenőrizte a feladót — KÉSZ (2026-06-19)**
  Hozzáadva `if (sender.id !== chrome.runtime.id) return;` (defense-in-depth). Web-origin amúgy
  sem éri el (nincs `externally_connectable`).

- [x] **🟡 #X1 — Flashcard `front`/`back` nyers HTML-renderelése — KÉSZ (2026-06-20)**
  `POST /extension/create-flashcard` (és a webes szerkesztő) szabad stringként ment `front`/`back`-et,
  amit a fő app a `RichTextContent` (`resources/js/components/ui/rich-text-editor.tsx`)
  `dangerouslySetInnerHTML`-jén át renderelt — egy extensionből beküldött `<img src=x onerror=…>`
  tárolt (jelenleg self-)XSS. **Nincs deck-megosztás/publikus pakli**, így ma csak a tulajdonost
  érintette, de lezártuk. Javítás: új `resources/js/lib/sanitize-html.ts` (allowlist tag/attr,
  `on*` kezelők + `javascript:`/`data:` URL-ek eltávolítása, SSR-biztos regex-fallbackkel), és a
  `RichTextContent` mostantól ezen át renderel. Mivel ez az **egyetlen** HTML-sink a flashcardokhoz
  (study, calibrate, preview mind `RichTextContent`-et használ; a `card-row` `plainText()`-et),
  egy helyen minden render-út lefedve. A TipTap szerkesztő betöltéskor a saját sémájába parse-ol
  (szerkesztési út is biztonságos). `npm run build` zöld.

- [x] **🟡 #W1 — Ingyenes szómentési limit (50) megkerülhető a fontosság-végponttal — KÉSZ (2026-06-27)**
  `app/Http/Controllers/WordController.php` (`importance`)
  A `status()` 50-szavas free-limitet kényszerít új pivot felvételekor, de az `importance()` ezt
  kihagyta: új szóra `syncWithoutDetaching([... 'status' => 'known'])`-kal pivotot hozott létre limit-
  ellenőrzés nélkül → a felhasználó a fontosság-csillagokkal (a részletező modal minden szóra mutatja)
  korlátlanul menthetett. Javítás: közös `freeSaveLimitReached()` helper (status + importance), és az
  `importance()` üres értéknél nem hoz létre üres pivotot. 4 új teszt (WordTest). Suite zöld (40 filter).
  Üzleti-logikai limit-bypass (mint #X5), nem klasszikus IDOR/jogosultsági hiba.

- [ ] **🟢 #X5 — Ingyenes flashcard-limit csak paklinként (20/pakli)**
  `User::canAddFlashcardsTo()` paklinként számol → sok pakli létrehozásával megkerülhető.
  Üzleti-logikai, nem biztonsági. Teendő (opcionális): globális cap és/vagy pakliszám-limit free terven.

- [ ] **🟢 #X6 — Írás-throttle közös vödör (20/perc)**
  `add-word` + `create-flashcard` egy `ext-write` vödröt oszt; fizető usernél a darabszám korlátlan
  → saját adatra szóló tömeges beszúrás. CSRF-védett, self-scoped → alacsony.

- **⚪ #X7 (by-design)** — A YouTube felirat-`baseUrl` nem fut át az `assertPublicHost`-on, de azt
  maga a YouTube adja vissza (nem user-vezérelt). Opcionális keményítés.

**Megerősítve BIZTONSÁGOS:** SSRF (`fetchSource`: privát/reserved IP-tiltás + `CURLOPT_RESOLVE`
DNS-rebind védelem + hopponként újra-ellenőrzött manuális redirect); AI havi keret atomikusan
kikényszerített (`reserve()` feltételes `increment`, nincs TOCTOU); AI-végpontok `hasAiAccess()`/admin
mögött; minden extension-végpont auth-ellenőrzött; IDOR mindenhol védett (`createFlashcard` saját
relációból kéri a decket → idegen id 404; `UserCustomWordPolicy::update` tulajdon-ellenőrzés;
Word-pivot per-user; `FlashcardCardController` minden metódusa `abort_unless` deck+kártya tulajdonra);
mass assignment explicit whitelisttel; SQL paraméterkötött; CSRF csak `stripe/*` kivétellel (extension
POST-ok védettek); nincs permisszív CORS a web-route-okon (`config/cors.php` nincs → default csak
`api/*`); cookie `http_only` + `same_site=lax`; manifest MV3 minimális jogosultságokkal
(`activeTab, contextMenus, storage`), host scope csak `topwords.eu`, nincs CSP-felülírás /
`web_accessible_resources` / `externally_connectable`, nincs hardcode-olt titok.
