# D2 — CORS (`config/cors.php`)

**PLAN-pont:** „mely origin-ek engedélyezettek az extension/player felé; nem `*`-e credentials mellett."

**Verdikt: 0 HIGH · 0 MEDIUM · 0 LOW · 3 INFO.**

**A PLAN-feltevés („CORS `*` credentials mellett") MEGDŐLT** — nem a korábbi verdikt átvételével,
hanem újra-levezetéssel, majd annak megtámadásával. A korábbi verdikt *helyes*, de az indoklása
hiányos volt: a valódi védelem architekturális, nem pusztán a `supports_credentials=false`.

---

## Mért effektív konfiguráció

`config/cors.php` **nem létezik** — megerősítve. Az effektív értékek a
`vendor/laravel/framework/config/cors.php`-ból jönnek:

| Kulcs | Érték | Sor |
|---|---|---|
| `paths` | `['api/*', 'sanctum/csrf-cookie']` | L18 |
| `allowed_origins` | `['*']` | L22 |
| `allowed_headers` | `['*']` | L26 |
| `supports_credentials` | `false` | L32 |

A `HandleCors` **regisztrálva van** — a globális stack 3. pozíciója
(`Foundation/Configuration/Middleware.php:458`). A `bootstrap/app.php` soha nem hívja rá a
`->withMiddleware(remove:)`-t. A futásidejű `config('cors')` dump pontosan a vendor-defaultot adja.

---

## Miért nem kihasználható a `*` — három független réteg

### 1. A credentials-header soha nem kerül kiadásra
4 origin (köztük `null`) × 3 útvonal × preflight próbán az `Access-Control-Allow-Credentials`
mind a **16 esetben `<ABSENT>`** volt, az `Access-Control-Allow-Origin` pedig mindig a literál
`*`, soha nem a támadó Originjének visszatükrözése. A böngésző `credentials: 'include'` esetén
eldobja a sütiket, ha az ACAC hiányzik, és ráadásul a literál `*`-ot is elutasítja credentialed módban.

### 2. A session-autentikált route-ok a `paths`-on KÍVÜL vannak — ez a teherhordó lelet
Az extension **nem** `api/*`-ot használ: a `routes/extension.php` a
[routes/web.php:90](../../routes/web.php#L90)-ből töltődik, tehát mind a 7 `extension/*` route a
`web` csoportban fut, cookie/session authhal. Path-matcheléssel a CORS `paths` mintái ellen:
az `extension/lookup`, `extension/badge`, `extension/add-word`, `extension/youtube-transcript`,
`player/connect`, `login`, `stripe/webhook` **egyike sem kap CORS headert**.
Élőben igazolva: `GET /extension/badge` `Origin: https://evil.example` fejléccel **nulla**
`Access-Control-*` headert ad. A cookie-authos felület tehát cross-origin egyáltalán nem olvasható.

### 3. A Sanctum nem tud session-fallbackre váltani `api/*`-on
Ez volt a legígéretesebb cáfolati út, mivel a [config/sanctum.php:40](../../config/sanctum.php#L40)
`'guard' => ['web']`-et állít, és a `Guard::__invoke` (vendor, 32-37. sor) a session-guardot a
Bearer-token **előtt** próbálja. Az `EnsureFrontendRequestsAreStateful` viszont **soha nincs
regisztrálva** — a nem-vendor fán a grep 0 találat, és a futásidejű `api` csoport csak
`[SubstituteBindings]`. `StartSession` és `EncryptCookies` nélkül (mindkettő futásidejűleg
igazoltan hiányzik) a `web` guardnak nincs elindított sessionje, amit olvashatna, így mindig
`null`-t ad, és az auth Bearer-onlyra esik vissza. A `stateful` domain-lista ezért **inert**.

**Nettó eredmény:** az `api/*` `*`-nyitott, **de Bearer-token-only**, és egy cross-origin oldal
nem tud tokenhez jutni — a token egyszer, a párosítási cserében kerül kiadásra
(`PlayerPairingController.php:150-158`), és a natív player kliensben tárolódik, nem böngészőben.

---

## Az állapotváltoztató GET-ekről

Az `api/player/gemini-lookup` és `api/player/gemini-flashcard` GET route-ok **valóban** mutálnak
állapotot: AI-kvótát égetnek (`TextAnalysisController.php:1378` `aiLimitGuard`). Cross-origin
ezek egyszerű kérések, preflight nélkül, és `ACAO: *` mellett a válasz-törzs **olvasható**.
Ez valós lelet **lenne**, ha cookie-authosak volnának. Nem azok: `auth:sanctum` + `abilities:player`,
session-fallback nélkül — a támadó oldalnak nincs módja autentikálni a kérést. Nem kihasználható.

---

## Leletek

### CORS-1 · Az `allowed_origins: ['*']` implicit framework-defaultból jön · INFO
- **fájl:** nincs `config/cors.php`; effektív: `vendor/laravel/framework/config/cors.php:22`
- **forgatókönyv:** Ma nincs támadási út (mindhárom fenti réteg tart). A kockázat a **jövőbeli
  drift**: egy `supports_credentials => true`-val publikált `cors.php`, vagy egy
  `->withMiddleware(statefulApi())` hozzáadása **külön-külön is** credentialed cross-origin
  olvasássá alakítaná. Konkrét út ma nincs → INFO.
- **verdikt:** REFUTED (mint kihasználható lelet).

### CORS-2 · Kvótát fogyasztó állapotváltozás GET mögött, `ACAO: *`-gal olvashatóan · INFO
- **fájl:** [routes/api.php:37-38](../../routes/api.php#L37-L38) (`TextAnalysisController.php:1378`)
- **forgatókönyv:** Bearer-token kell hozzá, amit a támadó oldal nem tud megszerezni →
  nem kihasználható. Csak azért jelölve, mert ez az egyetlen hely, ahol a `*` és egy
  állapotváltoztató egyszerű kérés találkozik — teljes egészében a 3. rétegen múlik.
- **verdikt:** REFUTED.

### CORS-3 · A `stateful` domain-lista halott konfiguráció · INFO
- **fájl:** [config/sanctum.php:21-26](../../config/sanctum.php#L21-L26)
- **forgatókönyv:** Be van állítva, de nincs hatása (`EnsureFrontendRequestsAreStateful`
  regisztrálatlan). Úgy olvasható, mintha a stateful cookie-auth aktív volna; egy karbantartó
  bekötheti abban a hitben, hogy már működik.
- **verdikt:** CONFIRMED (halott konfig), biztonsági hatás nulla.

**Manuális CORS-header sehol:** `grep -rn "Access-Control" app/ routes/ config/ public/ bootstrap/`
= 0 találat. A `HandleCors` az egyetlen forrás.

---

## Korrekció a jegyzőkönyvhöz

A korábbi audit indoklása („ártalmatlan, mert `supports_credentials=false`") *elégséges, de nem
a teljes kép*. Ha az `EnsureFrontendRequestsAreStateful` valaha bekerülne, a
`supports_credentials=false` önmagában **még mindig** blokkolná a credentialed olvasást — de a
robusztusabb védelem az, hogy az extension cookie-authos route-jai `extension/*` alatt, a CORS
`paths`-on teljesen kívül élnek. **Ezt a szétválasztást tudatosan meg kell őrizni:**
az extension route-ok `api/*` alá mozgatása a 2. réteget összeomlasztaná.
