# D4 — Prod-kötelező env flag-ek és kikényszerítésük

**PLAN-pont:** „`APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `APP_ENV=production`, éles Stripe/Billingo kulcsok, `SANCTUM_TOKEN_PREFIX`, `ADMIN_EMAIL`."

**Verdikt: 0 HIGH · 0 MEDIUM · 4 LOW · 6 INFO.**

A finder eredetileg **1 MEDIUM-ot** jelölt (üres `ADMIN_EMAIL`); az adverzariális verifikáció
**2/2 arányban REFUTED**-ra hozta → **LOW**. Részletek: [`06-verifikacios-naplo.md`](06-verifikacios-naplo.md).

---

## Guard-ellenőrzés — mind a négy MEGVAN

[app/Providers/AppServiceProvider.php:30-39](../../app/Providers/AppServiceProvider.php#L30-L39) —
a `boot()` mind a négy guardot **feltétel nélkül** hívja. **Nincs `runningInConsole()` menekülőút
a fájlban** (grep az `app/`, `config/`, `bootstrap/` felett: 0 találat). Mivel az
`AppServiceProvider::boot()` a provider-boot ciklusban fut, a guardok azonosan tüzelnek HTTP-n,
`artisan`-on, `queue:work`-ön és `schedule:run`-on. **Ez a terv legerősebb része** — egy rossz
`APP_ENV` a queue workert is megöli, nem csak a webet.

| Guard | Sor | Fail-closed? |
|---|---|---|
| `assertKnownEnvironment` | 54 | **Igen.** Szigorú `in_array(..., true)` whitelist. Üres/hiányzó `APP_ENV` → `'production'` fallback (`config/app.php:40`) → keményítés BE, a guard átenged. Csak elgépelt, nem-üres érték dob. |
| `assertDebugDisabledInProduction` | 80 | **Igen.** A `config/app.php:53` `(bool) env('APP_DEBUG', false)`-t castol — a default false, a hiányzó érték biztonságos. |
| `assertStripeWebhookSecured` | 99 | **Igen.** Az `empty()` elkapja a `null`-t, `''`-t és `'0'`-t. Helyesen a `services.stripe.enabled`-re gate-elve, hogy egy Stripe-mentes deploy ne bricked-eljen. |
| `assertStripeSecretMatchesEnvironment` | 120 | **Részben** — lásd LOW-2. |

Tesztek (csak olvasás, futtatva): `EnvironmentBootGuard|SessionSecureCookie|SecurityHeaders`
→ **11 passed, 26 assertions**. Fájl nem módosult.

---

## Leletek

### D4-LOW-1 · Üres `ADMIN_EMAIL` → némán elmarad a riasztás *(finder: MEDIUM → verifikáció: LOW)* · LOW

- **fájl:** [.env.example:78](../../.env.example#L78) · [app/Listeners/AlertAdminOfLoggedError.php:45-49](../../app/Listeners/AlertAdminOfLoggedError.php#L45-L49) · [app/Listeners/AlertAdminOfQueueBacklog.php:21-24](../../app/Listeners/AlertAdminOfQueueBacklog.php#L21-L24)
- **súlyosság:** LOW (leminősítve MEDIUM-ról, 2/2 REFUTED)
- **forgatókönyv:** Egy csupasz `ADMIN_EMAIL=` sor Dotenv-en `""`-t ad, nem `null`-t. Mindkét
  listener `if (! $adminEmail) { return; }`-nel őriz — a `""` falsy, tehát korán visszatérnek.
- **miért NEM MEDIUM (a verifikáció döntő érvei):**
  1. **A bad state nincs jelen:** az éles `.env:67` `ADMIN_EMAIL=developedbybarley@gmail.com`.
  2. **Nincs adatvesztés:** a `Logger::writeLog` (vendor, 181-193. sor) **előbb ír Monologgal
     lemezre**, és csak **utána** dobja a `MessageLogged` eseményt — magam is visszaellenőriztem.
     A listener szigorúan a perzisztálás *után* fut, tehát a hiba már a `laravel.log`-ban van.
     A hiányzó `ADMIN_EMAIL` a **push-értesítést** degradálja, nem a **rögzítést**.
  3. **A `.env.example:76-77` nagybetűs figyelmeztetést tartalmaz** közvetlenül a kulcs felett
     („Élesben KÖTELEZŐEN kitöltendő"). A finder a 78. sort idézte, a fölötte lévő két sort
     kihagyva — ez az elhallgatás tette hihetővé a forgatókönyvet.
  4. **Duplikátum:** ugyanez a lelet **P7D-3 néven, LOW-ként** már szerepel a tegnapi körben
     (`audit-phase7-2026-07-27/00-OSSZESITO.md:46`).
  5. **Nincs támadó:** nincs támadó-vezérelt bemenet, nincs jogosultság-nyereség.
- **ami áll:** az `AppServiceProvider` négy env-kulcsra ad fail-closed guardot, `ADMIN_EMAIL`-re
  **nem** (`grep admin_email app/Providers/` → 0 találat). Ez valós minta-aszimmetria, és egy
  `assertAdminEmailConfigured()` go-live-kor olcsó keményítés volna.
- **verdikt:** **REFUTED mint MEDIUM → CONFIRMED mint LOW.**

### D4-LOW-2 · A Stripe-kulcs-guard egyirányú: nincs védelem a LIVE kulcs ellen lokálban/stagingen · LOW

- **fájl:** [app/Providers/AppServiceProvider.php:120-136](../../app/Providers/AppServiceProvider.php#L120-L136)
- **forgatókönyv:** A guard `! app()->isProduction()` esetén korán visszatér, tehát **csak** a
  teszt-kulcs-prodban esetet fogja. A fordított irány — `sk_live_` kulcs egy fejlesztő `.env`-jében
  vagy stagingen — ellenőrizetlenül átmegy. Konkrét út: egy fejlesztő átmásolja a produkciós
  `.env`-t egy billing-hiba debugolásához, majd `APP_ENV=local` mellett lefuttatja a tesztsuite-ot
  vagy a `cashier:reconcile-subscriptions`-t; ez utóbbi a
  [routes/console.php:47](../../routes/console.php#L47) szerint ütemezetten az **élő** előfizetéseket
  egyezteti, és lezárja azokat, amelyeket a Stripe halottnak jelent.
  Egy szimmetrikus `str_starts_with($secret, 'sk_live_') && ! isProduction()` ellenőrzés zárná.
  **Megjegyzés:** a PLAN ezt „élő kulcsok a produkcióban"-ként fogalmazza — a hiányzó fél a
  károsabb irány.
- **verdikt:** CONFIRMED.

### D4-LOW-3 · Nincs környezet-guard a Billingo API-kulcsra · LOW

- **fájl:** [config/services.php:86-101](../../config/services.php#L86-L101) · `AppServiceProvider` (hiányzik)
- **forgatókönyv:** A Stripe két boot-guardot kap, a Billingo nullát. A Billingo-kulcsok nem
  hordoznak `test_`/`live_` prefixet (a `BillingoClient` semmilyen kulcs-alak-vizsgálatot nem végez),
  tehát prefix-guard mechanikusan nem lehetséges. **De** arra sincs guard, hogy a
  `BILLINGO_ENABLED=true` nem-üres `BILLINGO_API_KEY`-t implikáljon — ez az
  `assertStripeWebhookSecured` párja volna. Konkrét út: `BILLINGO_ENABLED=true` üres/elavult
  kulccsal simán bootol; minden számlázási job elhasal az API-híváson és a `failed_jobs`-ba kerül.
  Ezt **elkapja** a `queue:alert-failed` — de csak ha a D4-LOW-1 nem áll fenn egyszerre.
  A memória szerint volt már valós incidens, ahol a Billingo teszt-profil némán nem egyezett a
  produkcióval; egy boot-idejű enabled-implies-key assert ezt deploykor fogta volna meg, nem az
  első fizetős számlánál.
- **verdikt:** CONFIRMED.

### D4-LOW-4 · A `SANCTUM_TOKEN_PREFIX` nincs beállítva az éles `.env`-ben · LOW

- **fájl:** [config/sanctum.php:68](../../config/sanctum.php#L68) · [.env.example:86](../../.env.example#L86)
- **forgatókönyv:** A `.env.example` helyesen `tpw_`-t ad, de a tényleges `.env`-ben **nincs**
  `SANCTUM_TOKEN_PREFIX` sor (magam is ellenőriztem: a grep csak az `ADMIN_EMAIL`-t találta).
  A default `''`, tehát a `PlayerPairingController.php:150`-nél kiadott tokenek **nem hordoznak
  felismerhető prefixet**. A hatás **kizárólag detekciós**, nem hozzáférés-vezérlési: a prefix
  nélküli token kriptográfiailag ugyanolyan erős, de a GitHub/GitLab secret-scanning nem tud rá
  mintát illeszteni, így egy véletlenül commitolt vagy logba/issue-ba beillesztett player-token
  nem vált ki automatikus visszavonási értesítést. A tokenek 90 napos élettartama tágítja az ablakot.
  **Deploy-drift lelet:** a `.env.example` helyes, a deployolt env nem követte, és **semmi nem
  kényszeríti ki** — a prefixre nincs boot-guard.
- **verdikt:** CONFIRMED.

---

## INFO

### D4-INFO-1 · A `session.secure` fail-safe helyes, és túléli a `config:cache`-t
[config/session.php:175](../../config/session.php#L175):
`env('SESSION_SECURE_COOKIE', env('APP_ENV') === 'production')` — produkcióban `true`-ra esik
anélkül, hogy a deployer bármit beállítana. A `config:cache` kérdésre: a kifejezés a *cache-építés
idején* értékelődik ki, és a kapott boolean sül bele a `bootstrap/cache/config.php`-ba, tehát
**nem** válik némán `false`-szá — feltéve, hogy a `config:cache` a produkciós `.env` jelenlétében fut,
ami a normál Ploi deploy-sorrend. Lokálisan jelenleg nincs config cache építve.
Lefedve: `SessionSecureCookieTest.php` (mindkét irány).

### D4-INFO-2 · A többi session-cookie attribútum rendben
`http_only` default `true` (188. sor), `partitioned` default `false` (218. sor — helyes, a
partitioned `SameSite=None`-t igényel), `domain` beállítatlan → host-only cookie, nincs
aldomain-szivárgás. A `serialization => 'json'` hardcode-olt, ami kizárja a PHP-gadget-chain
vektort. Az `encrypt => false` (50. sor) rendben a DB session-driver mellett — a session
*payload* szerver-oldalon él, a cookie csak a titkosított session-ID-t hordozza.

### D4-INFO-3 · A `config:cache` rossz env-vel nem tudja megvakítani a guardokat
A guardok `config()`-on keresztül olvasnak, nem `env()`-en, tehát pontosan a besütött értékeket
látják. Ha a `config:cache` `APP_ENV=production` + `APP_DEBUG=true`-val futna, a besütött
`app.debug=true` az, amit az `assertDebugDisabledInProduction` olvas → dob. A guardok
config-cache alatt **megbízhatóbbak**, nem kevésbé.

### D4-INFO-4 · `.env.example` hézagok
A kód által olvasott, de a `.env.example`-ból hiányzó kulcsok: `SANCTUM_STATEFUL_DOMAINS`,
`STRIPE_WEBHOOK_TOLERANCE`, `ONBOARDING_ENABLED`, `GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_FALLBACK`,
`GEMINI_BREAKER_THRESHOLD`, `GEMINI_BREAKER_COOLDOWN`, `GEMINI_REQUEST_DEADLINE`, `CASHIER_PATH`,
`QUEUE_FAILED_DRIVER`, `DB_QUEUE_CONNECTION`. Mindegyiknek van biztonságos in-code defaultja,
tehát egyik sem produkciós blokkoló. Kettő érdemel említést: a `SANCTUM_STATEFUL_DOMAINS`
(localhost-listára + `currentApplicationUrlWithPort()`-ra esik vissza — produkcióban helyes,
de átláthatatlan), és a `DB_QUEUE_CONNECTION`/`QUEUE_FAILED_DRIVER`, amelyek pont a D5-1-ben
tárgyalt queue-név-drift knobjai.

### D4-INFO-5 · Az `isProduction()`-höz kötött keményítés konzisztens
Minden megtalált fogyasztó: `SecurityHeaders.php:32` (HSTS + CSP), `AlertAdminOfLoggedError.php:41`,
`AppServiceProvider.php:146` (`prohibitDestructiveCommands`), `:149` (`Password::defaults` — min 12,
vegyes kis-nagybetű, szimbólum, `uncompromised`). Mind ugyanarra a szigorú ellenőrzésre gate-elve,
amelyet az `assertKnownEnvironment` véd.

### D4-INFO-6 · `isAdmin()` null-check vs. falsy-check aszimmetria
[app/Models/User.php:181-186](../../app/Models/User.php#L181-L186) — `$adminEmail !== null`-t
használ, míg a riasztási lánc `! $adminEmail`-t. `ADMIN_EMAIL=""` mellett a null-check átmegy,
így a kapu `$this->email === '' && $this->hasVerifiedEmail()`-re degradálódik.
**Nem kihasználható:** az `emailRules()` `required|string|email`-t követel, a users-migráció
oszlopa nem-nullable + unique, tehát **egyetlen user sem** tarthat `''`-t → 0 user válik adminná.
A `hasVerifiedEmail()` konjunkció harmadik kapuként amúgy is ott van. Csak a következetlenség
miatt jelölve.

---

## PLAN-feltevések: ÁLL vs. MEGDŐLT

**ÁLL:**
- `APP_DEBUG=false` — fail-closed kikényszerítve, biztonságos default, boot-guard, tesztelt.
- `APP_ENV=production` — whitelisttel kikényszerítve; üres érték *produkció felé* esik (biztonságos irány).
- `SESSION_SECURE_COOKIE=true` — config-szintű fail-safe; az env-változó produkcióban valóban opcionális.
- A guardok minden belépési úton futnak — igazolva, nincs `runningInConsole()` menekülőút.
- Élő Stripe-kulcs produkcióban — a titkos kulcsra kikényszerítve (a teszt-kulcs-prodban irányban).

**MEGDŐLT:**
- **„Az `ADMIN_EMAIL` ki van kényszerítve"** — semmi nem kényszeríti ki; nincs rá boot-guard (D4-LOW-1).
  *(De: az éles `.env`-ben ki van töltve, és a `.env.example` figyelmeztet.)*
- **„A `SANCTUM_TOKEN_PREFIX` be van állítva"** — a `.env.example`-ban dokumentált, a deployolt
  `.env`-ből hiányzik (D4-LOW-4).
- **Az „élő-kulcs kikényszerítés" kétirányú** — nem az; csak a teszt-kulcs-prodban irány őrzött (D4-LOW-2).
- **„Billingo élő-kulcs kikényszerítés létezik"** — semmilyen Billingo env-guard nincs, még az
  `enabled`-implies-`api_key` assert sem (D4-LOW-3).
- **Részben megdőlt** — az `assertKnownEnvironment` docblockjának `"production "` (whitespace-padded)
  forgatókönyve: a Dotenv trimmeli az idézőjel nélküli értékeket, tehát ez az állapot csak
  *idézőjelezett* `APP_ENV="production "`-nel vagy shell-exportált változóval érhető el.
  A guard így is elkapja; a docblock csak túlbecsüli, milyen könnyen áll elő az állapot.
