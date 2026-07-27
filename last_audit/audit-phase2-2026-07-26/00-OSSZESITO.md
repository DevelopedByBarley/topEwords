# Fázis 2 (Pénz & előfizetés end-to-end) — Audit — Összesítő

> Készült: **2026-07-26** · HEAD `527d205` (main) · working tree: csak `.claude/settings.json`, `app-sidebar.tsx`, `routes/words.php` módosítva (nem ez az audit).
> **Módszer:** multi-agent workflow — 4 dimenziónkénti finder párhuzamosan + 4 adverzariális verifikátor (2 HIGH/MEDIUM-gyanús leletre, eltérő lencsékkel) + koordinátori tény-visszaellenőrzés.
> A finderek **CSAK a PLAN.md Fázis 2 szövegét** kapták; a korábbi `last_audit/` verdikteket nem olvasták → független ítélet.
> **CSAK DOKUMENTÁLÁS** (audit-no-fixes) — **egyetlen kódfájl és tesztfájl sem módosult.**

## Eredmény: 0 HIGH · 0 MEDIUM · 9 LOW · 7 INFO

**Go-live blokkoló: NINCS.**

| ID | Dimenzió | Végső súly | Verifikációs út | Fájl:sor | Állítás |
|---|---|---|---|---|---|
| WH-2 | 1. Webhook | **LOW** | CONFIRMED (1 kör) | `StripeWebhookController.php:49-71` | A foglalás-marker nincs a kezelővel közös tranzakcióban: **nem-kivételes** crash (timeout/OOM/SIGKILL) után a marker beragad, és a Stripe-újraküldést az idempotencia „már feldolgozva"-ként nyeli el → az esemény véglegesen elveszik. |
| SIG-1 | 2. CSRF/aláírás | **LOW** | CONFIRMED (1 kör, empirikusan mért) | `AppServiceProvider.php:107` | A boot-guard a `STRIPE_ENABLED`-hez van kötve, nem a secret-hiányhoz: `STRIPE_ENABLED=false` + üres secret mellett a webhook-route **él és aláírás-ellenőrzés nélkül fogad**. |
| LIM-1 | 3. Limit-race | **LOW** | CONFIRMED (1 kör) | `FlashcardStudyController.php:23` | A Pro alatt felhalmozott, Free-limit fölötti állomány (kártyák/paklik/könyvek/feliratok) downgrade után **korlátlanul olvasható/tanulható/exportálható** — a limit csak write-oldali. |
| LIM-2 | 3. Limit-race | **LOW** | CONFIRMED (1 kör) | `User.php:398-422` | A napi/havi számlálók nem nullázódnak plan-váltáskor → keret-aszimmetria; az egyetlen nyereség-irány (Pro→Free ugyanaznap) **+20 extension-írás**. |
| RACE-1 | 3. Limit-race | **LOW** | CONFIRMED (1 kör) | `User.php:429-440` | `refundExtensionWrite`/`refundDailyAnalysis` nem-atomikus check-then-decrement → párhuzamos hibaágon a számláló alulszámol (±1-2 extra slot). |
| BILL-1 | 4. Billingo/NAV | **LOW** | **MEDIUM → LOW** (2 verifikátor) | `InvoiceGenerator.php:259-270` | A `0362351` két új Billingo-payload-mezője (`phone`, `registration_number`) **teszteletlen**; egy 422 a NAV-számlát is elbuktatná (BILL-4 miatt). `test-coverage`. |
| BILL-2 | 4. Billingo/NAV | **LOW** | CONFIRMED (1 kör, mért) | `BillingValidationRules.php:54` | A `billing_phone` regex **számjegy nélküli szemetet** is elfogad (`"(((((("`, `"------"`, 6 szóköz), ami a NAV-partneradatba kerül. |
| BILL-3 | 4. Billingo/NAV | **LOW** | CONFIRMED (1 kör) | `routes/console.php:23` | A `queue:monitor` fixen a `:default` queue-t figyeli → queue-név-drift esetén a **NÉMA** elmaradt NAV-számla nem riaszt. **A lánc egyetlen valóban néma útja** (élő incidens-előzmény). |
| BILL-5 | 4. Billingo/NAV | **LOW** | CONFIRMED (1 kör, mért) | `BillingValidationRules.php:48,62` | Adószám/cégjegyzékszám csak **formátumra**, nem érvényességre ellenőrzött (nincs CDV/áfakód/megyekód-whitelist) → NAV-oldali hibás számlaadat. |

**INFO (7):** WH-1 (grace-period `ends_at` nullázás — *lásd lentebb, súlyosság-vita*), WH-3 (nincs timestamp-alapú sorrend-védelem), WH-4 (`type` nélküli payload → 500, csak secret birtokában), WH-5 (nincs pruning a `stripe_webhook_events`-en), SIG-2 (replay a 300 s ablakon — az aláírás nem fogja, az event-id idempotencia fogja), BILL-4 (nem-404 `updatePartner`-hiba a számlát is blokkolja — tudatos fail-closed), BILL-6 (nincs storno-út — tudatos, riasztással).

## Érdemi súlyosság-viták (részletek: `05-VERIFIKACIOS-NAPLO.md`)

### WH-1 — grace-period `ends_at` nullázás · finder LOW → **INFO** (2/2 verifikátor)
Az out-of-order `updated` event `ends_at=null`-t ír egy period-end-re lemondott előfizetésre, mert a resurrect-guard csak a `stripe_status='canceled'` állapotot ismeri.
**Miért esett INFO-ra:** (a) az **entitlement azonos** — a Cashier `valid()` szemantikájában a grace-period alatt a user már jogosult, és `ends_at=null` + `active` ugyanezt adja → **nulla extra jog**; (b) a periódus végi `deleted` → `markAsCanceled()` **feltétel nélkül** zár → nincs „tartós ingyen prémium"; (c) **a javasolt guard-kiterjesztés eltörné a legitim portál-resume-ot** (a két payload bit-szinten azonos, és a portál-resume-nak a webhook az egyetlen helyi írási csatornája) → a „javítás" negatív értékű. Marad: félrevezető Settings-szöveg egy legfeljebb egy periódusig élő ablakban.
**⚠️ Feltételes eszkaláció:** **egy második fizetős ár** bevezetése esetén a rossz állapot a `swap()`-ágra vezetne, ami a lemondást a user kérése nélkül visszavonná → **valódi MEDIUM**. Árazás-változtatás előtt újraértékelendő.

### BILL-1 — új Billingo-payload-mezők · finder MEDIUM → **LOW** (2/2 verifikátor)
**Miért esett LOW-ra:** a MEDIUM két pillére megdőlt — a hiba **nem néma** (négyszintű riasztási lánc, max. 10 perc késéssel admin e-mail) és **nem okoz adatvesztést** (a pénz Stripe-nál rögzítve, a `BillingoInvoice` sor idempotensen újrafuttatható). Emellett a kár-út egy **nem bizonyított külső API-viselkedésen** áll, és a javasolt ellenszer (`Http::fake()`-es assertion) bizonyíthatóan **nem hat** rá.
**⚠️ Auditori korrekció:** egy verifikátor azt állította, hogy a `phone` ág a factory-default miatt „de-facto lefedett" — **ezt méréssel megdöntöttem** (a `billing_phone` a `withBilling()` state-ben van, nem a base `definition()`-ben; `billableUser()` → `billing_phone === null`). **A finder eredeti állítása áll: mindkét ág teszteletlen**, és a `phone` a súlyosabb, mert **minden** userre kimegy.

## Megdőlt PLAN-feltevések

1. **„Trial újra-igényelhető / dupla keret szerezhető plan-váltással"** — MEGDŐLT. A `subscription_trial_days = 0` (trial ma **nem is indul**), és az `isEligibleForSubscriptionTrial()` a `subscriptions()->exists()`-re épül → lemondás+újra-előfizetés **nem** ad újabb próbaidőt. A napi/havi számláló-megosztottság **döntően a user hátrányára** működik; az egyetlen nyereség-irány negatív ROI (1990 Ft napi 20 írásért).
2. **„Cashier-invoice letöltő végpont auditálandó"** — RÉSZBEN MEGDŐLT. Nincs `findInvoiceOrFail`-alapú végpont; a NAV-számla saját `BillingoInvoice`-modellből jön, explicit `user_id ===` ownership-ellenőrzéssel.
3. **„A `stripe/*` CSRF-wildcard jövőbeli mutáló route-ot nyithat"** — MEGDŐLT mint nyitott kockázat: **őrszem-teszt kényszeríti ki** (`StripeWebhookSecurityTest.php:72-88`), hogy a `stripe/` alatt a webhook az egyetlen mutáló route — a jövőbeli regresszió **programozottan fogott**.
4. **„A crash-ablak a Billingo-hívás után / lokális mentés előtt nyitott"** — MEGDŐLT. Konkrétan kezelve: `issuing_started_at` a `createDocument` **előtt** perzisztálódik, retry-nál a `findIssuedDocument()` **pontos** comment-egyezéssel visszakeres → nincs dupla NAV-számla.

## Regressziók és korábbi-verdikt-megdöntések

**Kód-regresszió: NINCS.** A `0362351 "billing phone and company reg"` commit (a legutóbbi, 2026-07-20-i Fázis 2 audit **után** érkezett, és pontosan ezt a felületet módosította) **nem tört el működő számlázást**: a `partnerPayload` mindkét új mezőt truthy-guard mögé tette, a `hasBillingDetails()` szigorítás pedig a checkout-kapuban **irányít** (`billing.edit`-re redirect), nem zár ki, a futó előfizetők havi megújítását pedig nem érinti. A validáció szimmetrikus (`required_if`/`prohibited_if`), a mass-assignment-határ sértetlen. Két gyengeség maradt utána: **BILL-1** és **BILL-2**.

**Korábbi verdikt megdöntve (felfelé, lefedettségi hézag):** a 2026-07-20-i kör a **limit-race dimenziót „teljesen tiszta (0 lelet)"**-ként zárta. Ez a kör **3 LOW-t** talált ott (LIM-1, LIM-2, RACE-1). **Ez nem kód-regresszió** — a viselkedés vélhetően korábban is így volt —, hanem a korábbi audit **lefedettségi hézaga**: az akkori kör a *write-oldali* TOCTOU-t vizsgálta, a *downgrade utáni retention/read* oldalt és a refund-utak atomicitását nem.

**A korábbi kör 4 LOW-jának jelenlegi állapota (mind NYITOTT, egyik sem javult és nem is rosszabbodott):**

| Korábbi ID | Mai megfelelő | Állapot |
|---|---|---|
| WH-1 (foglalás nem közös tranzakcióban) | **WH-2** | NYITOTT, azonos mechanizmus. Ez a kör pontosította: a *kivételes* út tesztelt és helyes, a rés kizárólag a **nem-kivételes** (timeout/OOM/SIGKILL) úton áll fenn. |
| WH-2 (részmutáció-visszagörgetés) | — | NYITOTT mint architektúrális megfigyelés; ez a kör INFO-alatti szintre sorolta (a pénz-ágon nincs valós kitettség: a dispatch az egyetlen mutáció, a `handleCustomerDeleted` köztes crashe a **biztonságos** irányba visz). |
| CSRF-1 (boot-guard a `stripe.enabled`-hez kötve) | **SIG-1** | NYITOTT, azonos. Ez a kör **empirikusan mérte** a fail-open mechanizmust (üres secret → 0 middleware). |
| BILL-1 (per-invoice lock → árva partner) | — | NYITOTT (a `billingo:issue:{stripeInvoiceId}` kulcs ma is per-invoice). Ez a kör a lock-granularitást **helyesnek** ítélte a *dupla számla* szempontjából; az árva-partner maradék pénzmentes, operátor takarítja. |

## Kihagyott (kivezetett) PLAN-pontok

A Fázis 2 szakasz **egyetlen** pontja sem hivatkozik kivezetett feature-re → **nem kellett pontot kihagyni.**
A kizárási lista (kvíz, cloze, rendhagyó igék, szabad írás, `ReviewController`) a Fázis 1 és 5-6 köreit érinti, nem ezt.

**Következmény a teszt-baseline-ra:** a full suite **34 elhasaló tesztje mind `RouteNotFoundException`** a kivezetett feature-ök tesztjeiben (`QuizTest`, `ClozeTest`, `IrregularVerbTest`, `practiceCheck`, `StreakTest` kvíz-esete) — **dimenzión kívüli, ismert maradék**, nem Fázis 2 regresszió. A **money-kör külön futtatva teljesen zöld: 160 teszt** (`Webhook|Stripe|Billing|Subscription|Pricing|Invoice|Checkout`, 592 assertion).

## Dimenziónkénti bontás

| # | Dimenzió (PLAN-pont) | HIGH | MEDIUM | LOW | INFO | Fájl |
|---|---|---|---|---|---|---|
| 1 | Webhook-idempotencia + out-of-order (W-M1/W-L5 regresszió) | 0 | 0 | 1 | 4 | `01-dim-1-webhook-idempotencia.md` |
| 2 | `stripe/*` CSRF-kizárás + aláírás-verifikáció | 0 | 0 | 1 | 1 | `02-dim-2-stripe-csrf-alairas.md` |
| 3 | Free↔Pro limitkapuk TOCTOU/race | 0 | 0 | 3 | 1 | `03-dim-3-limit-race-toctou.md` |
| 4 | Billingo/NAV fail-módok + job-idempotencia + PII | 0 | 0 | 4 | 2 | `04-dim-4-billingo-nav-szamlazas.md` |

*(A PLAN Fázis 2 szakasza pontosan 4 felsorolás-pontból áll → 1 pont = 1 finder-dimenzió, csoportosítás nem kellett.)*

## Végső verdikt

- **HIGH: 0 · MEDIUM: 0 · LOW: 9 · INFO: 7.** Go-live blokkoló **nincs**.
- A **pénz- és jogosultság-integritás kód-oldalon tiszta**: a webhook-idempotencia (event-id unique + atomikus foglalás), az aláírás-lánc (éles configban fail-closed, őrszem-teszttel védve), a limitkapuk (mind a 6 per-user kulccsal, a check a lock-closure-ön belül) és a NAV-számlázás (négyrétegű dupla-számla-védelem, kezelt crash-ablak, minimalizált PII) mind helytálltak az adverzariális vizsgálatban.
- A 9 LOW **egyike sem** ad cross-user hatást vagy pénzügyi nyereséget: 6 szűk concurrency/crash-ablakban jelentkezik öngyógyuló vagy riasztott következménnyel, 2 adat-minőségi/compliance jellegű (BILL-2, BILL-5), 1 pedig tudatos termék-döntés (LIM-1 soft downgrade).
- **A legfontosabb ops-maradék: BILL-3** — nem a legsúlyosabb, de a lánc **egyetlen valóban néma** útja, és pontosan a 2026-07-22-i élő incidens mintáját ismétli. A `queue:monitor` queue-neve nem konfigurációkövető.
- **Két, jövőre szóló figyelmeztetés rögzítve:** (1) egy **második fizetős ár** bevezetése a WH-1-et INFO-ból MEDIUM-má léptetné (swap-ág); (2) a BILL-1 séma-kérdést csak **egy valós Billingo teszt-profilos `POST /partners` hívás** zárja le — a mockolt suite erre szerkezetileg képtelen.

**A Fázis 2 riport elkészült. A többi fázisra NEM léptem — jóváhagyásra vár.**
