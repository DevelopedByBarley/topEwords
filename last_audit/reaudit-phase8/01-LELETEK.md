# Fázis 8 — Séma-kényszerített leletlista + adverzariális verifikáció

Séma: **{ ID · fájl:sor · súlyosság · forgatókönyv · verifikációs verdikt }**
Minden HIGH/MEDIUM-gyanús leletre 2–3 független, *cáfolásra promptolt* verifikátor-kör.

---

## HDR-API-1 — `api/*` JSON-válaszok nem kapják a SecurityHeaders middleware-t

- **Fájl/sor:** `bootstrap/app.php:29-35` (a `SecurityHeaders` csak a `$middleware->web(append:...)` stackben van)
- **Súlyosság:** LOW → INFO (defense-in-depth)
- **Forgatókönyv (gyanú):** Az `api/player/*` route-ok nem kapnak `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`, sem CSP-t. Egy támadó MIME-sniffeléssel vagy iframe-beágyazással kihasználhatná.
- **Verifikáció:**
  - **Kör 1 (MIME-sniff / clickjacking):** Az `api/*` végpontok tisztán `application/json`-t adnak
    (`ExtensionController`/`PlayerPairingController` — 53 `->json()` hívás, 0 HTML-render). A böngésző a
    JSON-t nem futtatja script-ként (beépített CORB/ORB blokkol), iframe-be ágyazva nem renderel aktív
    tartalmat. → clickjacking/sniff vektor **CÁFOLVA**.
  - **Kör 2 (authentikált api-válasz cross-origin kiolvasása):** A player-api Bearer-token-alapú; a token
    nem cookie, a böngésző nem küldi automatikusan img/script/iframe-betöltéskor → támadó-oldali JS nem tud
    authentikált api-választ előidézni. → **CÁFOLVA**.
  - **Kör 3 (a HTML `player/connect` oldal kimarad-e a hardeningből?):** NEM — a `player/connect` GET+POST a
    **`web`** csoportban van (`web`, `Authenticate`, `EnsureEmailIsVerified`), így megkapja a `SecurityHeaders`-t.
    A `SecurityHeadersTest` (`route('home')`) zölden bizonyítja, hogy a web-append-stack minden HTML-oldalra fut.
    → **CÁFOLVA** (nincs védtelen HTML-felület).
- **Verdikt:** **NEM sebezhető.** Opcionális hardening: a `nosniff`+`Referrer-Policy` kiterjeszthető az api-ra
  (olcsó defense-in-depth), de valós vektor nincs. INFO-szint.

---

## CORS-1 — `allowed_origins = ['*']` az `api/*` és `sanctum/csrf-cookie` útvonalakon

- **Fájl/sor:** framework-default (nincs `config/cors.php` override) — `paths=['api/*','sanctum/csrf-cookie']`,
  `allowed_origins=['*']`, `supports_credentials=false`
- **Súlyosság:** LOW → INFO
- **Forgatókönyv (gyanú):** A wildcard bármely origin-nak engedi az api hívását; egy támadó weboldal
  kiolvashatná az áldozat authentikált válaszait vagy ellophatná a session/CSRF-cookie-t.
- **Verifikáció (3 cáfoló kör):**
  - **Kör 1 (session-cookie lopás):** `supports_credentials=false` → a böngésző `Access-Control-Allow-Origin: *`
    mellett MEGTAGADJA a `credentials:'include'` kéréseket. A session-cookie sosem megy cross-site JS-ből. → **CÁFOLVA**.
  - **Kör 2 (Bearer-token-válasz kiolvasása):** A cross-origin api-olvasáshoz a támadónak MÁR birtokolnia kellene
    az áldozat Bearer-tokenjét, ami az Electron-player `auth-store`-jában van, nem böngésző-elérhető. Token nélkül
    a válasz 401. → jogosultság-emelés **CÁFOLVA**.
  - **Kör 3 (`sanctum/csrf-cookie` token-szivárgás):** `supports_credentials=false` miatt a böngésző nem olvassa
    ki a cookie-t cross-origin; az app a web-oldalon session-alapú CSRF-token (Inertia), nem a Sanctum-SPA-cookie
    flow. → **CÁFOLVA**.
- **Verdikt:** **NEM sebezhető.** A `wildcard + supports_credentials=false` a bevett, biztonságos token-API CORS-minta.
  Szigorítás (explicit extension/player origin-lista) kozmetikai, nincs vektor. INFO-szint.

---

## DEPLOY-1 — `public/.DS_Store` a munkakönyvtárban (belső fájlnév-nyom)

- **Fájl/sor:** `public/.DS_Store` (6148 B, macOS-artefakt)
- **Súlyosság:** LOW (ops/deploy, nem kód)
- **Forgatókönyv (gyanú):** `GET /.DS_Store` kiszolgálhatná a fájlt; a `.htaccess` `-Indexes` a listázást tiltja,
  de dotfile-blokk nincs → belső fájlnevek szivároghatnak.
- **Verifikáció (egykörös — LOW):**
  - A `.DS_Store` **gitignore-olt** (`.gitignore:13`) és **NEM git-tracked** (`git ls-files` = nincs). A
    `.github/workflows/` csak lint+test, deploy-workflow nincs → a deploy git-alapú (Ploi pull). Git-deployon a
    fájl SOHA nem kerül a szerverre. Csak nyers rsync-teljes-másolás esetén jutna ki. → prod-expozíció **CÁFOLVA**
    a valószínű (git) deploy-úton.
- **Verdikt:** **NEM sebezhető git-deployon.** Marad LOW ops-checklist-tétel (rsync-deploynál `--exclude=.DS_Store`).
  A PLAN 117. sora már rögzíti. `.env*` szintén gitignore-olt → kulcs-szivárgás git-en át kizárva.

---

## CSP-1 — `script-src 'self' 'unsafe-inline'` gyengíti a CSP XSS-rétegét

- **Fájl/sor:** `app/Http/Middleware/SecurityHeaders.php:56`
- **Súlyosság:** INFO (dokumentált kompromisszum)
- **Forgatókönyv (gyanú):** `unsafe-inline` engedi az inline `<script>`-et → egy stored/reflected XSS inline-scriptet
  futtathatna, a CSP nem védene.
- **Verifikáció (egykörös):**
  - A CSP XSS-védelme csak kihasználható HTML-injection sink mellett számítana. Két `dangerouslySetInnerHTML` van:
    (1) `rich-text-editor.tsx:320` → `sanitizeHtml()`-szűrt; (2) `two-factor-setup-modal.tsx:81` → `qrCodeSvg`, a
    Fortify **szerver-generált** 2FA-QR SVG-je (nem user-adat). → nincs untrusted sink.
  - Az `unsafe-inline`-tól függetlenül ható valódi CSP-nyereség itt a navigációs/framing-lock:
    `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'` — ezek clickjacking és
    base-tag/form-action-hijack ellen védenek, `unsafe-inline` ide-oldás nélkül. → **CÁFOLVA**, hogy a
    `unsafe-inline` valós XSS-vektort engedne.
- **Verdikt:** **NEM sebezhető.** Dokumentált, szükségszerű kompromisszum (root-template inline dark-mode + Tailwind).
  Nonce-alapú CSP későbbi keményítés lehet, de nincs jelenlegi vektor. INFO-szint.

---

## ENV-INFO-1 — helyi `.env`: `APP_ENV=local`, `APP_DEBUG=true`

- **Fájl/sor:** `.env` (helyi)
- **Súlyosság:** INFO
- **Forgatókönyv:** Ha ez prodra kerülne, minden 500 stack-trace-t szivárogtatna.
- **Verifikáció:** `AppServiceProvider::assertDebugDisabledInProduction()` (`:80-89`) prodban HARD boot-failure-t
  dob, ha `APP_DEBUG=true`. `assertKnownEnvironment()` (`:54-69`) a typo-környezeteket (`prod`/`live`/`"production "`)
  is elutasítja. Teszt: `EnvironmentBootGuardTest` (6 db, zöld). → helyi állapot helyes, prod fail-closed.
- **Verdikt:** helyes dev-config; a hardening kikényszerítve.

---

## SANCTUM-INFO-1 — `sanctum.expiration = null` (globális örök-token)

- **Fájl/sor:** `config/sanctum.php:53`
- **Súlyosság:** INFO
- **Forgatókönyv (PLAN-gyanú):** a null → a player/extension token sosem jár le, ütközik a "90 nap"-pal.
- **Verifikáció:** `PlayerPairingController:150-153` a `createToken(name, abilities, now()->addDays(90))` harmadik
  argumentumán **per-token `expires_at`-et** ad; a Sanctum a per-token lejáratot a globális null felett érvényesíti.
  `PlayerPairing::TOKEN_LIFETIME_DAYS = 90` + napi `sanctum:prune-expired --hours=24`. → a feltételezett ütközés
  **MEGDŐL**; a 90-nap kódszinten kikényszerítve.
- **Verdikt:** nincs ütközés; a globális null a stateful-SPA-hoz default, a token-lejárat per-token megoldott.

---

## Nem-lelet megerősítések (finder-tiszta)

- **SecurityHeaders teljesség:** XFO=DENY, nosniff, Referrer-Policy=strict-origin-when-cross-origin,
  X-Permitted-Cross-Domain-Policies=none, Permissions-Policy (camera/mic/geo/payment/usb/interest-cohort tiltva),
  prod: HSTS (max-age 1év, includeSubDomains, preload) + CSP. **Teljes.**
- **public/index.php** az egyetlen PHP a public/-ban; `oc.php` nincs. `.user.ini` (upload-cap) + `.htaccess`
  (`-Indexes`, front-controller) rendben.
- **`sw.js`** self-destruct tombstone (cache-törlés + unregister) — nincs bejelentkezett-oldal cache-maradvány.
- **Queue éles-config:** `QUEUE_CONNECTION=database`, failed=`database-uuids`; `queue:alert-failed` +
  `queue:monitor(--max=25)` 10 percenként ütemezve (`routes/console.php:22-23`) → némán meghibásodó Billingo-job
  riasztva. (A custom `MonitorFailedJobs` a Fázis 7 hatóköre, nem ütemezett itt — konzisztens.)
- **`session.secure` env-derivált:** `env('SESSION_SECURE_COOKIE', env('APP_ENV')==='production')` → prodban
  auto-true; `SessionSecureCookieTest` fedi. `http_only=true`, `same_site=lax`.
