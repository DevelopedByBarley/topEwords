# Dimenzió 1 — Webhook-idempotencia és out-of-order események

> PLAN.md Fázis 2, 1. pont: *„Webhook-idempotencia és out-of-order események (W-M1/W-L5 regresszió-ellenőrzés)."*
> HEAD `527d205` · 2026-07-26 · CSAK DOKUMENTÁLÁS

## Felület-térkép

`app/Http/Controllers/StripeWebhookController.php` (322 sor, `extends Laravel\Cashier\…\WebhookController`):

| Sor | Funkció |
|---|---|
| `:40-72` | `handleWebhook` override — event-id idempotencia (`insertOrIgnore` a `stripe_webhook_events`-be, `:49`); `$reserved === 0` → érdemi munka nélkül 200 (`:56`); kivételkor marker-törlés + rethrow (`:65-71`) |
| `:85-109` | `handleInvoicePaymentSucceeded` — Billingo job dispatch; ismeretlen customer + pozitív terhelés → `Log::critical` (`:101`) |
| `:131-147` | `handleChargeRefunded` — nincs auto-sztornó, csak `Log::critical` |
| `:171-187` | `handleCustomerDeleted` — visszaírja az admin-adta ajándék-`trial_ends_at`-et |
| `:201-226` | `handleCustomerSubscriptionUpdated` — **W-M1 resurrect-guard** |
| `:228-239` | `handleCustomerSubscriptionCreated` → parent + duplikátum-takarítás |
| `:249-272` | **W-L5 user-szintű lock** (`stripe:dup-subs:{user_id}`, `block(10s)`) |
| `:306-321` | `duplicateSubscriptionsFor` — keeper = első `valid()`, fallback legrégebbi |

Migráció `2026_07_17_183925…:21` — `event_id` **unique**. `bootstrap/app.php:27` — CSRF-kizárás `stripe/*`.

## Regresszió-ellenőrzés (a PLAN által kért két célpont)

### W-M1 „sub-resurrect" — VÉDELEM JELEN VAN, regresszió NINCS
A `16f489c`-ben bevezetett guard szó szerint jelen a mai `:201-226`-on. A `tests/Feature/SubscriptionResurrectionGuardTest.php` 4 tesztje őrzi.
**Miért teljes a lezárási utakra:** a `markAsCanceled()` (`vendor/…/Subscription.php:1140-1146`) mindig `stripe_status=canceled` **és** `ends_at=now()`-ot ír — így mind a `deleted`-handler, mind a `customer.deleted`, mind a reconcile-lezárás ebbe az állapotba visz, tehát mindhárom úton védett a feltámasztás.

### W-L5 „dup-sub" — VÉDELEM JELEN VAN, regresszió NINCS
Az `f7f24cb` lockja a mai `:259-271`-en; `DuplicateSubscriptionCleanupTest.php:63-88` explicit teszt.
**Erősebb, DB-szintű alsó garancia:** `subscriptions.stripe_id` **unique** (`2026_04_08_161316…:19`) + a Cashier `updateOrCreate`-je (`vendor/…/WebhookController.php:83-92`) → **ugyanazon** Stripe-subscription két párhuzamos eventje soha nem hoz két sort. A takarítás csak a valóban két különböző Stripe-előfizetés (két Checkout) esetére kell.

## Leletek

### WH-1 — A resurrect-guard nem védi a grace-period (period end-re lemondott) előfizetést
- **fájl:sor**: `app/Http/Controllers/StripeWebhookController.php:206-222` (guard) vs. `vendor/laravel/cashier/src/Http/Controllers/WebhookController.php:176-177` (`else` → `ends_at = null`)
- **súlyosság**: **INFO** *(finder: LOW → 2 verifikátor egyhangúlag INFO)*
- **verifikációs verdikt**: **PLAUSIBLE** — a mechanizmus CONFIRMED, a lelet mint *javítandó defekt* REFUTED
- **forgatókönyv (bemenet → hatás)**:
  1. User a Stripe portálon „cancel at period end"-et választ → helyi sor: `stripe_status='active'`, `ends_at=<periódus vége>`.
  2. Befut egy még soha nem ACK-olt, **késleltetett** `updated` event a cancel ELŐTTI snapshottal (`cancel_at_period_end=false`, nincs `cancel_at`/`canceled_at`, `status=active`).
  3. A guard `:206` átengedi (érkező status ≠ `canceled`), és a `:209-212` helyi-canceled check is hamis, mert a sor `stripe_status` = `'active'` — a guard **kizárólag** a `stripe_status='canceled'` állapotot ismeri.
  4. A parent `:176-177` `else` ága **`ends_at = null`**-t ír.
  5. → `SubscriptionController.php:83` (`cancel_at_period_end` = `onGracePeriod()`) hamis lesz → a Settings UI a „Lemondva — …-ig megmarad" helyett az **„Aktív prémium előfizetés… havonta automatikusan megújul"** szöveget mutatja (`resources/js/pages/settings/subscription.tsx:158-170`).
- **hatás**: **kizárólag megjelenítési félrevezetés.** Entitlement-hatás **nulla**, pénzhatás **nulla** (lásd a szavazatok indoklását).
- **szavazatok indoklása**:
  - **V1 (kihasználhatóság-lencse) → PLAUSIBLE / INFO.** A „re-delivery" ág **CÁFOLVA**: az `insertOrIgnore` event-id dedupe (`:49-63`) miatt egy már feldolgozott event soha nem éri el a parentet. Csak a „késleltetett első kézbesítés" ág áll. **Döntő érv:** a legitim portál-resume és a stale event payloadja **bit-szinten azonos** (`status=active`, `cancel_at_period_end=false`), és a portál-resume-nak **ez az egyetlen** helyi írási csatornája (`SubscriptionController.php:165-184` külső `Inertia::location` redirect, semmi szinkron utómunka). A guard kiterjesztése tehát **eltörné a portálon keresztüli resume-ot** → a user visszavonja a lemondást, a Stripe tovább számláz, az app mégis Free-re esik. Az a „javítás" negatív értékű: nem-pénzhatású UI-hibát cserélne pénzhatású, nem öngyógyuló hibára. A mai kód a snapshot-szemantika kikényszerítette helyes kompromisszum.
  - **V2 (blast-radius-lencse) → PLAUSIBLE / INFO.** Az entitlement **azonos** a két állapotban: `valid()` = `active() || onTrial() || onGracePeriod()`; grace-periodban az `onGracePeriod()` igaz, `ends_at=null` esetén az `active()` igaz (mert `canceled()` = `!is_null(ends_at)` → hamis) → **mindkettő `true`**, nulla extra jog. A jog a **helyes időpontban lejár**: a periódus végi `deleted` → `markAsCanceled()` (`Subscription.php:1140`) feltétel nélkül zár, a korábbi `ends_at`-től függetlenül. Az újra-lemondás **öngyógyít** (a `cancel()` visszaírja a helyes `ends_at`-et, `Subscription.php:1052-1069`).
- **auditori megerősítés (saját ellenőrzés)**: a Cashier `resume()` (`Subscription.php:1155-1167`) szintén `ends_at`-et nullázza → az `ends_at=null` a `cancel_at_period_end=false` snapshotra **szándékolt szemantika**, nem hiba.
- **meglévő védelem**: a napi `cashier:reconcile-subscriptions` **NEM** gyógyítja (csak `stripe_status`-t szinkronizál, `ReconcileStripeSubscriptions.php:152-189`; a `syncStripeStatus()` sem ír `ends_at`-et) — a lelet egyetlen erős pontja. De a periódus végi `deleted` mindenképp lezár, tehát a rossz állapot legfeljebb a periódus hátralévő részéig él.
- **⚠️ FELTÉTELES ESZKALÁCIÓ (regressziós figyelmeztetés)**: ma a `PricingController.php:109` `stripe_price === $priceId` guard zárja a `swap()`-ot (egyetlen fizetős ár van, `config/services.php` → `STRIPE_PRO_PRICE_ID`). **Egy második fizetős ár bevezetése** esetén a rossz állapotban a `:69` grace-period-kapu nem fogna, a user átcsúszna a swap-ágra, és a `swap()` (`Subscription.php:735-740`, `getSwapOptions:874-876`) `cancel_at_period_end=false`-t küldene a Stripe-nak → **a lemondás visszavonása a user kérése nélkül** = valódi MEDIUM. Ezt a leletet tehát árazás-változtatás előtt újra kell értékelni.

### WH-2 — A foglalás-marker és a kezelő nem közös tranzakcióban: nem-kivételes crash után az esemény véglegesen elveszik
- **fájl:sor**: `app/Http/Controllers/StripeWebhookController.php:49-71`
- **súlyosság**: **LOW**
- **verifikációs verdikt**: **CONFIRMED** (LOW-ra egykörös verifikáció; a finder medium konfidenciája a trigger-valószínűségre vonatkozik, nem a mechanizmusra)
- **forgatókönyv (bemenet → hatás)**:
  1. `:49` a marker beszúrása **külön, azonnal commitolt** írás (nincs `DB::transaction` a `handleWebhook` körül).
  2. A `parent::handleWebhook` közben a PHP-worker **nem-kivétellel** hal meg: `max_execution_time` timeout, OOM-killer, php-fpm process kilövése (deploy-restart), SIGKILL. Ilyenkor a `:67` `catch (\Throwable)` **nem fut le**, a marker-törlés kimarad.
  3. A Stripe nem kapott 200-at → újraküldi ugyanazt az `evt_…`-t.
  4. `:56` a re-delivery a **meglévő** markert látja → „már feldolgozva" + 200, érdemi munka nélkül.
  5. → A részlegesen vagy egyáltalán nem feldolgozott esemény **véglegesen elveszik**, és maga az idempotencia-mechanizmus nyeli el.
- **hatás**: `invoice.payment_succeeded`-nél kimaradt NAV-számla (compliance); `customer.subscription.deleted`-nél beragadt aktív előfizetés.
- **szavazatok indoklása / miért nem MEDIUM**: (1) a `:67` catch a *kivételes* esetek döntő többségét kezeli — `StripeWebhookIdempotencyTest.php:89-105` bizonyítja; (2) a Billingo-számlázás **aszinkron job** (`:93`), a dispatch után a job a `jobs` táblában a webhook-válaszon túl is életben marad → a dispatch-utáni crash **nem** veszíti el a számlát; (3) a `deleted`-elvesztést a napi `cashier:reconcile-subscriptions` **pótolja** — ez a parancs explicit célja. Mindkét pénz/entitlement-releváns ágnak van tehát külön öngyógyító hálója. **Nem támadó-triggerelhető** (folyamat-szintű halál kell épp a webhook-ablakban).
- **megjegyzés a javíthatóságról**: a marker+kezelő közös tranzakcióba tétele nem triviálisan jobb — a Billingo-dispatch és a Cashier Stripe-API-hívásai miatt hosszú tranzakciót és `AFTER_COMMIT`-problémákat hozna.

### WH-3 — Nincs timestamp/`created` alapú sorrend-védelem; a guard állapot-alapú és aszimmetrikus
- **fájl:sor**: `app/Http/Controllers/StripeWebhookController.php:201-226`; a `stripe_webhook_events` tábla nem tárol `created`/`event_created_at`-ot (migráció `:19-24`)
- **súlyosság**: **INFO**
- **verifikációs verdikt**: **CONFIRMED** (mint megfigyelés)
- **forgatókönyv**: két nem-terminális `updated` sorrendcseréje (pl. `active` → `past_due`, majd a régebbi `active` érkezik utóbb) → a `past_due` felülíródik `active`-ra, a user átmenetileg több jogot kap.
- **miért INFO, nem MEDIUM**: (1) a Stripe `event.created` nincs eltárolva, összevetés ma nem lehetséges; (2) a napi reconcile `syncStripeStatus`-a **pontosan ezt** simítja vissza (max. 24 órás ablak); (3) a Stripe a fizetési kísérletnél újabb eventet is küld; (4) nem támadó-triggerelhető.

### WH-4 — `type` nélküli payload: 500 az aláírt kérésre
- **fájl:sor**: `vendor/laravel/cashier/src/Http/Controllers/WebhookController.php:43` (védelem nélküli `$payload['type']`), belépés `StripeWebhookController.php:46`/`:66`
- **súlyosság**: **INFO**
- **verifikációs verdikt**: **CONFIRMED**
- **forgatókönyv**: érvényesen aláírt, `type` kulcs nélküli JSON → `Undefined array key "type"` → 500. Az override `:51` null-safe, a parent nem.
- **miért INFO**: a triggerhez **a webhook-secret birtoklása kell** — aki ezt kiváltja, már a Stripe-titok tulajdonosa, nincs privilégium-emelés. A Stripe sosem küld `type` nélküli eventet. A marker nem ragad be (a `TypeError` is `Throwable` → `:68` törli).

### WH-5 — Nincs retention/pruning a `stripe_webhook_events` táblán
- **fájl:sor**: `database/migrations/2026_07_17_183925_create_stripe_webhook_events_table.php:19-24`; nincs `Prunable`, nincs scheduler-bejegyzés
- **súlyosság**: **INFO**
- **verifikációs verdikt**: **CONFIRMED**
- **forgatókönyv**: a tábla korlátlanul nő. A Stripe max ~3 napig próbál újraküldeni, tehát a 3 napnál régebbi sorok idempotencia-szempontból értéktelenek. Néhány ezer előfizetőnél évi ~10^5 sor — elhanyagolható; a unique index miatt a lookup logaritmikus. Nincs korrektségi hatás; nem DoS-vektor (csak aláírt kérés ír bele).

## Ami TISZTÁNAK bizonyult

1. **Idempotencia alapeset — TISZTA.** Ugyanaz az `evt_…` kétszer: `insertOrIgnore` + unique index **atomikusan** dönt (nem read-then-write TOCTOU); két igazán párhuzamos re-delivery esetén is pontosan egy nyer. A kivétel-ági marker-törlés tesztelt.
2. **Ismeretlen/hamis customer-id — TISZTA, nem 500 és nem is néma.** `Cashier::findBillable` null → minden override `instanceof User` ággal védett (`:90`, `:174`, `:209`, `:234`). A pénz-releváns ág **hangos**: `:101` `Log::critical`, ha pozitív terhelés érkezett ismeretlen customerhez.
3. **Részmutáció-visszagörgetés — a pénz-ágon nincs valós kitettség.** A `handleInvoicePaymentSucceeded` egyetlen mutációja egy queue-dispatch; a számla-idempotenciát a `stripe_invoice_id` unique adja. A `handleCustomerDeleted` két írása nem-atomikus, de a köztes crash a **biztonságos** irányba visz (elveszett ajándék-hónap, nem szerzett jogosultság).
4. **Öngyógyítási lánc — kétirányú.** A guard a „nem éledhet fel" irányba véd; a napi reconcile az „elveszett `deleted` nem hagy ingyen prémiumot" irányba. A reconcile kétfázisú kör-fékkel (`:93-104`), tehát rossz `STRIPE_SECRET` esetén sem lesz tömeges-lezárás fegyverré; átmeneti Stripe-hiba nem zár le élőt (`:156-164`: csak `resource_missing`-re zár).

## Összegzés

**0 HIGH · 0 MEDIUM · 1 LOW (WH-2) · 4 INFO (WH-1, WH-3, WH-4, WH-5).**
Egyik lelet sem támadó-triggerelhető — mindegyik Stripe-oldali sorrend-anomáliát vagy folyamat-szintű crasht igényel. A PLAN által nevesített **mindkét** regresszió-célpont (W-M1, W-L5) jelen van a kódban és teszttel védett.
