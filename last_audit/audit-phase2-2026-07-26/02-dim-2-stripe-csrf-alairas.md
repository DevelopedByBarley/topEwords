# Dimenzió 2 — `stripe/*` CSRF-kizárás és aláírás-verifikáció

> PLAN.md Fázis 2, 2. pont: *„`stripe/*` CSRF-kizárás helyessége: aláírás-verifikáció az egyetlen védelem — megkerülhetetlen-e."*
> HEAD `527d205` · 2026-07-26 · CSAK DOKUMENTÁLÁS

## Felület-térkép (tényellenőrzött `php artisan route:list --path=stripe`)

A CSRF-kizárás deklarációja: `bootstrap/app.php:27` — `$middleware->validateCsrfTokens(except: ['stripe/*'])`. **Wildcard**, nem `stripe/webhook`-ra szűkítve.

| Route | Metódus | Middleware-lánc | Auth |
|---|---|---|---|
| `stripe/payment/{id}` (Cashier `PaymentController@show`) | **GET\|HEAD** | csak `VerifyRedirectUrl` — nincs `web`, nincs session, nincs auth | nincs |
| `stripe/webhook` (`StripeWebhookController@handleWebhook`) | POST | `web` + `Laravel\Cashier\…\VerifyWebhookSignature` | csak aláírás |

**Hol az aláírás-ellenőrzés:** NEM a route-definícióban, hanem a **kontroller-konstruktorban, feltételesen** — `vendor/laravel/cashier/src/Http/Controllers/WebhookController.php:28-31`:

```php
if (config('cashier.webhook.secret')) {
    $this->middleware(VerifyWebhookSignature::class);
}
```

→ **Üres secret = fail-OPEN** (nem dob, hanem kihagyja az ellenőrzést). A finder ezt tinkerrel **empirikusan mérte**: üres secret → middleware-szám **0**; beállított secret → 1.

**Aláírás-algoritmus** (`vendor/stripe/stripe-php/lib/WebhookSignature.php`): HMAC-SHA256 a `"{$timestamp}.{$payload}"` fölött, `Util::secureCompare` **konstans-idejű** összehasonlítás, majd tolerancia-ellenőrzés. Több `v1=` aláírást is tűr (kulcsrotáció); `t=` nem-numerikus értékre azonnali elutasítás.

**Resolved config:** `cashier.path=stripe`, `cashier.webhook.tolerance=300` (5 perc), `services.stripe.enabled=true`, webhook secret beállítva. `CASHIER_PATH` sem `.env`-ben, sem `.env.example`-ben nem felülírva.

**Boot-guard:** `app/Providers/AppServiceProvider.php:105-113` (`assertStripeWebhookSecured`) — `services.stripe.enabled` && üres `cashier.webhook.secret` → `RuntimeException`, nem bootol. A provider `bootstrap/providers.php:7`-ben feltétel nélkül regisztrált → **minden kérésen fut**, a route-dispatch előtt.

## Leletek

### SIG-1 — A `STRIPE_ENABLED=false` + üres secret állapotban a webhook-route ÉL, aláírás-ellenőrzés NÉLKÜL
- **fájl:sor**: `app/Providers/AppServiceProvider.php:107` (guard-feltétel) + `vendor/laravel/cashier/src/Http/Controllers/WebhookController.php:28` (feltételes middleware) + `vendor/laravel/cashier/src/CashierServiceProvider.php:103-112` (route feltétel nélkül regisztrálva)
- **súlyosság**: **LOW**
- **verifikációs verdikt**: **CONFIRMED** (LOW-ra egykörös verifikáció; a mechanizmus empirikusan mért)
- **támadási forgatókönyv (bemenet/config-állapot → hatás)**:
  1. `.env`-ben `STRIPE_ENABLED=false` és `STRIPE_WEBHOOK_SECRET=` üres — pontosan a `.env.example` szállított állapota (`:95-98`).
  2. A boot-guard `if (config('services.stripe.enabled') && empty(...))` **NEM lép be**, mert az első feltétel hamis → az app bootol.
  3. A Cashier route-regisztrációja `Cashier::$registersRoutes`-ra megy, **nem** `STRIPE_ENABLED`-re → a `POST stripe/webhook` **ÉL**.
  4. A kontroller-konstruktor üres secret miatt nem csatolja a `VerifyWebhookSignature`-t (mért: 0 middleware), a CSRF pedig ki van véve.
  5. Támadó teljesen hitelesítés nélkül POST-ol pl. egy `customer.subscription.created` payloadot.
  6. **Hatás-korlát (ez viszi LE a súlyt):** a `getUserByStripeId()` **létező `stripe_id`-t** igényel. `STRIPE_ENABLED=false` állapotban a checkout nem fut, `stripe_id`-vel rendelkező user gyakorlatilag nem keletkezik → **nincs kit felminősíteni**. A sérülékeny config egybeesik a „nincs mit ellopni" állapottal.
- **szavazatok indoklása / miért LOW**: két egymást erősítő korlát: **(A)** a sérülékeny ablak pontosan az a deploy, ahol nincs számlázás; számlázás bekapcsolásakor a guard kikényszeríti a secretet. **(B)** a mutáló kezelők ismeretlen customerre no-op 200-at adnak → per-áldozat `cus_…` titok kellene, amit az app nem publikál és nem enumerálható. A `StripeWebhookSecurityTest.php:35-39` **explicit rögzíti** ezt a viselkedést („boot succeeds when stripe is disabled without a webhook secret") → **tudatos döntés, nem véletlen**.
- **maradék kockázat**: ha valaki `STRIPE_ENABLED=false`-ra állít egy **már élt, `stripe_id`-kkal teli** adatbázist (pl. ideiglenes „fizetés kikapcsolása" incidens közben), a rés valóssá válik. Robusztusabb lenne a guardot a secret-hiány + route-létezés párosra kötni (vagy `Cashier::ignoreRoutes()` a Stripe kikapcsolásakor), így a védelem nem függne adat-eloszlási feltevéstől.

### SIG-2 — Replay a 300 s toleranciaablakon belül: az aláírás nem fogja, az event-id idempotencia fogja
- **fájl:sor**: `config/cashier.php:52` (`tolerance` = 300) + `app/Http/Controllers/StripeWebhookController.php:44-70`
- **súlyosság**: **INFO**
- **verifikációs verdikt**: **CONFIRMED**
- **forgatókönyv**: támadó elkap egy valódi, aláírt payloadot (TLS-terminálást látó proxy-log, Stripe CLI forward kimenete), és 300 s-en belül újra beküldi. Az aláírás **érvényes marad** (a HMAC a body+timestamp fölött van, **nonce nincs**), a tolerancia átengedi → **az aláírás-réteg maga NEM védi a replayt**. A `handleWebhook` override viszont `insertOrIgnore`-ol az `event_id` unique kulcsra → 0 érintett sor → érdemi munka nélkül 200. Konkrét mutáló hatás: **nincs**.
- **meglévő védelem**: az event-id idempotencia — és **elég**, mert a foglalás a feldolgozás ELŐTT történik, unique constraint-tel (nem read-then-write TOCTOU). A `StripeWebhookIdempotencyTest` első tesztje pontosan ezt a kettős POST-ot méri (`WebhookReceived` 1×). Egyetlen szűkítés: `id` nélküli payloadra nincs dedupe (`:45-47`), de aláírt Stripe-payload mindig hordoz `evt_…` id-t.

## Ami TISZTÁNAK bizonyult

**A PLAN fő kérdésére a válasz: az aláírás-verifikáció a jelenlegi éles configban NEM megkerülhető.**

1. **A CSRF-kizárás túl tág-e — NEM, a wildcard ma ártalmatlan, és a jövőbeli regresszió is fogott.**
   A `stripe/*` alatt a webhook az **egyetlen** mutáló route. A `stripe/payment/{id}` **GET-only**, `web` middleware nélkül fut (nincs session, nincs cookie-auth) és nem mutál — rá a CSRF-kizárásnak nincs hatása.
   **Őrszem-teszt kényszeríti ki** (`tests/Feature/StripeWebhookSecurityTest.php:72-88`, „SESS-L4"): összegyűjti a `stripe/` prefixű **mutáló** (POST/PUT/PATCH/DELETE) route-okat és `expect($mutating)->toBe(['stripe/webhook'])`. Ha bárki új mutáló `stripe/` route-ot vesz fel, a teszt elhasal. **Ez pontosan az a jövőbeli kockázat, amit a PLAN felvetett — programozottan fogva.** *(Auditori megjegyzés: ezt a tesztet saját szemmel visszaellenőriztem.)*

2. **Secret-hiány éles configban — fail-closed.** `STRIPE_ENABLED=true` + üres secret ⇒ az app **nem bootol**. Mivel a guard `boot()`-ban fut és a provider feltétel nélkül regisztrált, ezt `config:cache`/route-cache **nem kerüli meg** (a cache config-értékeket rögzít, nem provider-bootot). `bootstrap/cache/` üres → drift-elt cached config sem áll fenn.

3. **Rossz módú kulcs prodban — fail-closed.** `assertStripeSecretMatchesEnvironment` `sk_test_` prefixre nem bootol prodban (2 teszt).

4. **Aláírás-kriptográfia tiszta.** HMAC-SHA256, `secureCompare` konstans-idejű → **nincs timing-oracle**. Nem kapcsolható ki configgal úgy, hogy a route eközben `STRIPE_ENABLED=true` mellett éljen.

5. **A forgery blast-radius reális — ezért fontos, hogy a lánc tart.** Ha valaki érvényes aláírást tudna hamisítani, a Cashier- és app-kezelők a helyi `subscriptions` táblát mutálnák, és a `User::currentPlan()` (`app/Models/User.php:137`) ebből a **lokális** táblából olvassa a jogosultságot — **nincs Stripe-oldali újraellenőrzés**. Egy hamisított `customer.subscription.created` tehát **valódi ingyen prémiumot** adna. A hamisításhoz a `whsec_…` kell; a lánc ma ezt megvédi.

**Teszt-állapot:** `StripeWebhookSecurityTest` (9) + `StripeWebhookIdempotencyTest` (4) = **13 teszt zöld**.

## Összegzés

**0 HIGH · 0 MEDIUM · 1 LOW (SIG-1) · 1 INFO (SIG-2).**
A fail-closed garancia nem magára a secret-hiányra van kötve, hanem a `STRIPE_ENABLED` flagre — ma hatás nélkül, mert ebben az állapotban nincs `stripe_id`-vel rendelkező user.
