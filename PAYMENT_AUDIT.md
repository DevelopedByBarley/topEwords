# 🔍 Fizetési alrendszer audit — TopWords

> Készült: 2026-06-23 · Hatókör: Stripe Checkout + Laravel Cashier v16 fizetési folyamat
> Auditált területek: fizetés helyessége, validációk, biztonság, gördülékenység.

**Összegzés:** A pénzügyileg legérzékenyebb támadási vektorok (ár-manipuláció, webhook-hamisítás,
tömeges hozzárendelés, IDOR) **jól védettek**. Két kritikus, két magas és több közepes hiba van —
főleg a számlázási validáció ↔ kapuőr eltérése, a fióktörlés és a trial/consent kezelés körül.

Jelölésmagyarázat: `[ ]` = nyitott · `[x]` = kész · `[~]` = folyamatban

---

## 🔴 KRITIKUS

### [x] K1 — Fióktörléskor NEM mondják le a Stripe-előfizetést → a kártyát tovább terhelik

> **JAVÍTVA** (2026-06-23): `ProfileController::destroy` a `$user->delete()` előtt MINDEN még élő
> előfizetést lemond (nem csak az elsőt/aktívat):
> `$user->subscriptions()->whereNotIn('stripe_status', ['canceled','incomplete_expired'])->get()->each->cancelNow()`.
> Szándékosan lefedi a `past_due`/`incomplete` állapotot is (amit a `valid()` kihagyna), mert a Stripe azokon
> még próbálhat terhelni. Ha a lemondás hibázik, a kivétel propagál és a fiók NEM törlődik (újrapróbálható,
> nem marad árva élő előfizetés). A Stripe-ügyfél (számlatörténet) szándékosan megmarad.
> Tesztek: `tests/Feature/Settings/ProfileUpdateTest.php` — „…cancels every still-live stripe subscription"
> (két előfizetés: active + past_due, mindkettő `cancelNow` `->once()`) + „…without a subscription works".
> Ezzel a **Kö7** (részleges dupla-előfizetés védelem) is rendezve van a törlési útvonalon.

- **Hely:** `app/Http/Controllers/Settings/ProfileController.php:43-54`
- **Bizonyíték:**
  ```php
  $user = $request->user();
  Auth::logout();
  $user->delete();   // ← nincs előtte cancelNow()
  ```
- **Tény:** A Cashier **nem** mond le automatikusan a user-modell törlésekor (a v13.x billing dok.
  explicit: *„you should always cancel user subscriptions before deleting the associated user model"*).
  Grep-pel igazolva: sehol nincs `deleting` hook a kódban.
- **Hatás:** A user törli a fiókját, de a Stripe-előfizetés él tovább → a következő ciklusban is
  fizet, miközben nincs hozzáférése. Chargeback/panasz-forrás; árva Stripe `customer`.
- **Javítás:**
  ```php
  if ($sub = $user->activeSubscription()) {
      $sub->cancelNow();
  }
  $user->delete();
  ```
- **Teszt:** fióktörlés aktív előfizetéssel → az előfizetés `cancelNow`-olódik a törlés előtt.

---

### [x] K2 — Végtelen kapuőr-hurok: a számlázási űrlap elmenthető a kötelező mezők nélkül

> **JAVÍTVA** (2026-06-23): `BillingUpdateRequest`-ben a `billing_name`/`billing_zip`/`billing_city`/`billing_address`
> mostantól `required` (egyezik a `hasBillingDetails()`-szel). Front: `required` attribútum a 4 mezőn
> (`settings/billing.tsx`). Tesztek: `BillingSettingsTest` — „…requires the fields the checkout gatekeeper checks"
> + „…no redirect loop". A régi, a hibát kódoló „billing details can be empty" teszt lecserélve.

- **Hely:**
  - `app/Http/Requests/Settings/BillingUpdateRequest.php:17-25` (validációs szabályok)
  - `app/Models/User.php:163-169` (`hasBillingDetails`)
  - `app/Http/Controllers/PricingController.php:49-51` (kapuőr)
  - `routes/settings.php:20` (`billing.edit` — nincs rajta kapuőr)
- **Bizonyíték:** A `BillingUpdateRequest` csak `billing_country` + `billing_type` mezőt követel meg
  (a többi `nullable`), de a `hasBillingDetails()` épp a `billing_name`/`zip`/`city`/`address`-t vizsgálja:
  ```php
  // BillingUpdateRequest: ezek nullable-k
  'billing_name' => ['nullable', ...], 'billing_zip' => ['nullable', ...],
  // hasBillingDetails(): de ezeket követeli
  return filled($this->billing_name) && filled($this->billing_zip) && ...;
  ```
- **Forgatókönyv:** checkout → billing.edit → csak az országot tölti ki → mentés **sikeres, hibaüzenet
  nélkül** → visszamegy fizetni → `hasBillingDetails()` még mindig `false` → **újra billing.edit-re dobja**,
  anélkül hogy megmondaná, mi hiányzik. Kijuthatatlan csapda, konverzióvesztés.
  A `resources/js/pages/settings/billing.tsx` mezőin `required` attribútum sincs.
- **Javítás:** A `hasBillingDetails()` által vizsgált 4 mezőt tedd `required`-dé a `BillingUpdateRequest`-ben
  (a számlázáshoz amúgy is kellenek). Front: tedd a mezőkre a `required` attribútumot is.
- **Teszt:** `country`+`type`-only mentés → `assertSessionHasErrors(['billing_name','billing_zip','billing_city','billing_address'])`.

---

## 🟠 MAGAS

### [x] M1 — Trial-napok három helyen ellentmondanak: UI **5** / env **7** / config default **30**

> **JAVÍTVA** (2026-06-23): A trial hossz egyetlen forrásból (config) jön. `PricingController::index` átadja
> `trialDays` propként, a `pricing.tsx` ezt jeleníti meg (fejléc + FAQ) a hardcode-olt „5" helyett.
> A `config/registration.php` default 30 → **7** (üzleti érték), és a félrevezető „regisztrációkor indul"
> komment törölve. Teszt: `PricingCheckoutGatekeeperTest` — „pricing page exposes the configured trial length as a prop".

- **Hely:**
  - `resources/js/pages/pricing.tsx:183` — „5 napos próbaidőszak"
  - `resources/js/pages/pricing.tsx:496` — FAQ: „A 5 napos próbaidőszak után…"
  - `.env` — `SUBSCRIPTION_TRIAL_DAYS=7`
  - `config/registration.php:15` — `env('SUBSCRIPTION_TRIAL_DAYS', 30)` (default 30)
- **Bizonyíték:** A Stripe Checkout ténylegesen `trialDays(7)`-tel jön létre (`PricingController.php:88-91`),
  de a UI 5 napot ígér, a config-default 30. A trial-visszaszámláló a valós `trial_ends_at`-ból 7-et mutat —
  ellentmond a fejléc „5"-jének.
- **Hatás:** Megtévesztő ígéret + jogi/ÁSZF-kockázat (mikor kezdődik a számlázás). Hiányzó `.env` esetén
  30 napos trial — drámaian más üzleti viselkedés.
- **Javítás:** A trial hosszt egyetlen forrásból (config) add át propként a frontnak, ne hardcode-old a
  szövegekben. A config-default legyen az üzleti szándék (pl. 7).

### [x] M2 — Cégnél (`billing_type=company`) az adószám nem kötelező

> **JAVÍTVA** (2026-06-23): `billing_tax_number` mostantól `required_if:billing_type,company` mind a
> `BillingUpdateRequest`-ben, mind a `CreateNewUser`-ben (konzisztens). Front: `required` attribútum a
> (csak cégnél megjelenő) adószám-mezőn. Tesztek: `BillingSettingsTest` — „company billing requires a tax number"
> + „individual billing does not require a tax number".

- **Hely:** `app/Http/Requests/Settings/BillingUpdateRequest.php:19,24`; `app/Actions/Fortify/CreateNewUser.php:31-32`
- **Bizonyíték:** Nincs feltételes szabály (`required_if`). A `billing.tsx` csak cégnél jeleníti meg az
  adószám mezőt, de a `billing_type`-ot a kliens szabadon küldi, a szerver nem köti össze a kettőt.
- **Hatás:** Cég adószám nélkül menthető → hiányos/hibás számla (belföldi cégszámlán az adószám kötelező).
- **Javítás:**
  ```php
  'billing_tax_number' => ['nullable', 'required_if:billing_type,company', 'string', 'max:50'],
  ```
  Ugyanezt a `CreateNewUser`-be is, a konzisztenciáért.
- **Teszt:** cég típus adószám nélkül → `assertSessionHasErrors('billing_tax_number')`.

---

## 🟡 KÖZEPES

### [x] Kö1 — „Azonnal elérhető" a webhook előtt hamis lehet

> **JAVÍTVA** (2026-06-23): A `success()` ellenőrzi van-e aktív előfizetés; ha nincs (webhook még nem futott),
> „feldolgozás alatt" (info) üzenetet ad. Teszt: `PricingCheckoutGatekeeperTest` (pending + active ág).

- **Hely:** `app/Http/Controllers/PricingController.php:102-105`; `resources/js/pages/pricing.tsx:452-459`
- **Bizonyíték:** Cashier a subscriptiont a `checkout.session.completed` / `customer.subscription.created`
  webhookra hozza létre. A success oldal csak átirányít flash-sel, nem ellenőrzi, létrejött-e az előfizetés.
- **Hatás:** Webhook-késésnél (vagy rosszul konfigurált éles webhooknál) a `/pricing` „nincs előfizetés"-t
  mutat közvetlenül fizetés után.
- **Javítás:** A success oldalon jelezz „feldolgozás alatt" állapotot, ha még nincs subscription
  (pl. Inertia polling). Dokumentáld, hogy a webhook éles környezetben KÖTELEZŐ.

### [x] Kö2 — Consent (14 napos elállás) csak kliensoldali, szerveroldalon nincs ellenőrizve/rögzítve

> **JAVÍTVA** (2026-06-23): A consent a checkout POST része (`accept_terms`), szerveroldalon `accepted`-ként
> validálva; a tényt `terms_accepted_at` timestamp rögzíti (új migráció + `datetime` cast, NEM fillable).
> A front küldi a `accept_terms: true`-t. Tesztek: consent nélkül `accept_terms` hiba; sikeres checkoutnál
> `terms_accepted_at` kitöltve. Megj.: a dev DB-ben az oszlop kézi ALTER-rel lett hozzáadva (a migrációs
> előzmény nincs szinkronban — lásd lentebb).

- **Hely:** `resources/js/pages/pricing.tsx:91-97` vs `app/Http/Controllers/PricingController.php:38-99`
- **Bizonyíték:** A consent React state; a `router.post(checkout(...))` nem küldi el, a `checkout()` nem
  olvas/validál `consent` mezőt. A `POST /pricing/checkout/{plan}` közvetlenül is hívható a pipa megkerülésével.
- **Hatás:** Jogi/megfelelőségi kockázat — nincs auditálható nyoma, hogy a felhasználó lemondott az elállási
  jogról és elfogadta az ÁSZF-et. Kliensoldali ellenőrzés triviálisan megkerülhető.
- **Javítás:** A consent legyen a checkout POST része (`accept_terms`), szerveroldalon `accepted`-ként
  validálva; rögzítsd a tényt (pl. `consent_at` timestamp, esetleg IP/UA + dokumentum-verzió).

### [x] Kö3 — Hamis „lemondva" flash, ha a művelet nem futott le

> **JAVÍTVA** (2026-06-23): a `cancel()`/`resume()` csak tényleges művelet után ad `success`-t; grace-period /
> no-op esetben `info`. Tesztek: `SubscriptionTest` (no-op ágak).

- **Hely:** `app/Http/Controllers/Settings/SubscriptionController.php:46-68`
- **Bizonyíték:**
  ```php
  if ($subscription !== null && ! $subscription->onGracePeriod()) {
      $subscription->cancel();
  }
  return back()->with('success', 'Előfizetésed lemondva...'); // akkor is fut, ha nem történt semmi
  ```
- **Hatás:** Hamis pozitív visszajelzés (pl. versenyhelyzetben). A `resume()` no-op ága viszont semmilyen
  visszajelzést nem ad.
- **Javítás:** A flash csak akkor, ha a művelet ténylegesen lefutott (tedd az `if`-en belülre).
  A `resume()` no-op ágára adj `info` üzenetet.

### [x] Kö4 — Trial-banner „prémium funkciókat" ígér basic trial alatt is

> **JAVÍTVA** (2026-06-23): a banner szövege `isPremium`-függő („a prémium funkciókat" / „a választott
> csomagod funkcióit").

- **Hely:** `resources/js/pages/pricing.tsx:217-228`
- **Bizonyíték:** A banner csak `isOnTrial && trialDaysLeft > 0`-ra jelenik meg, csomagtól függetlenül.
- **Hatás:** Basic-trial usernek `currentPlan() === 'basic'` (nincs AI), mégis „élvezd a prémium funkciókat"-ot olvas.
- **Javítás:** Csomagfüggő szöveg: `isPremium ? 'prémium funkciókat' : 'a választott csomag funkcióit'`.

### [x] Kö5 — Országkód nem valós ISO; adószám/irányítószám formátum nélkül

> **JAVÍTVA** (2026-06-23): `billing_country` mostantól `Rule::in(['HU'])` (támogatott országok listája) +
> uppercase normalizálás (`prepareForValidation`, lásd A4). Tesztek: érvénytelen országkód elutasítva,
> „hu" → „HU". (Adószám/irányítószám regex egyelőre nem kötelező — opcionális bővítés maradt.)

- **Hely:** `app/Http/Requests/Settings/BillingUpdateRequest.php:19-21`
- **Bizonyíték:** `size:2` bármely 2 karaktert elfogad („ZZ", „99"). `billing_tax_number` csak `max:50`,
  `billing_zip` csak `max:10` — formátum nélkül.
- **Hatás:** Érvénytelen/formátumtalan számlázási adat kerülhet a DB-be (hibás számla/ÁFA). Jelenleg fix HU,
  ezért alacsonyabb a kockázat, de a tárolt adat integritása nem garantált.
- **Javítás:** Ha csak HU érvényes: `'billing_country' => ['required', Rule::in(['HU'])]`.
  Opcionális regex: adószám `^\d{8}-\d-\d{2}$`, irányítószám HU `^\d{4}$` (`required_if`/feltételesen).

### [x] Kö6 — Regisztráció ↔ settings validáció eltér

> **JAVÍTVA** (2026-06-23): a billing-szabályok közös `App\Concerns\BillingValidationRules` trait-ben
> (`billingRules(bool $required)`); a `BillingUpdateRequest` (required) és a `CreateNewUser` (optional) is ezt
> használja — egyetlen forrás.

- **Hely:** `app/Actions/Fortify/CreateNewUser.php:30-35` vs `app/Http/Requests/Settings/BillingUpdateRequest.php:20,24`
- **Bizonyíték:** A regisztrációban `billing_country` nincs is a szabályok közt, `billing_type` ott `nullable`;
  a settingsnél mindkettő `required`.
- **Hatás:** Két belépési pont eltérő szerződést támaszt ugyanazokra az adatokra; karbantarthatósági és
  adatintegritási kockázat.
- **Javítás:** Emeld ki a billing-szabályokat közös forrásba (pl. `BillingValidationRules` trait, a
  `ProfileValidationRules` mintájára), és használd mindkét helyen.

### [x] Kö7 — Részleges dupla-előfizetés védelem

> **RENDEZVE** (2026-06-23): a törlési útvonal (K1) most MINDEN élő előfizetést lemond (`whereNotIn(...)
> ->each->cancelNow()`), nem csak az elsőt — így ha edge-case-ben két aktív sor keletkezne, törléskor
> mindkettő megszűnik. A checkout továbbra is mindig `swap`-el (sosem hoz létre másodikat). A creation-time
> idempotencia (webhook-verseny elleni DB-szintű korlát) opcionális további keményítés maradt.

- **Hely:** `app/Http/Controllers/PricingController.php:59-78`; `app/Models/User.php:69-80`
- **Bizonyíték:** Az `activeSubscription()` csak az ELSŐ `valid()` sort adja vissza (premium-előbb sorrend).
  Ha webhook-versenyből 2 aktív sor keletkezne, a `swap` csak egyiket módosítja.
- **Hatás:** Normál úton (mindig swap) védett, de nincs védőkorlát több aktív sor ellen → elvi dupla számlázás.
- **Javítás:** A checkout elején ellenőrizd az ÖSSZES `valid()` subscriptiont; ha >1, logolj/abortálj.

---

## 🟢 ALACSONY

### [x] A1 — Throttle hiánya a portal/cancel/resume/billing.update route-okon

> **JAVÍTVA** (2026-06-23): `throttle:10,1` a `pricing.portal` és `subscription.portal` route-okon.
> Teszt: `SubscriptionTest` — „the subscription portal route is rate limited" (10 ok, 11. → 429).
> (A `cancel`/`resume`/`billing.update` nem kapott throttle-t — idempotensek/csak DB-írás, alacsony kockázat.)

- **Hely:** `routes/web.php:34` (`pricing.portal`), `routes/settings.php:21,35-37`
- **Hatás:** A `pricing.portal`/`subscription.portal` ismételt hívása Stripe billing-portal session-t generál
  (API-költség, Stripe rate limit). Mind auth mögött, így a felület hitelesített userre korlátozott.
- **Javítás:** `throttle:10,1` a portal route-okra.

### [x] A2 — `Billing::enabled()` a publishable kulcsot ellenőrzi, nem a `secret`-et

> **JAVÍTVA** (2026-06-23): a `Billing::enabled()` mostantól `filled(config('cashier.secret'))`-et is megköveteli.
> Tesztek: `BillingConfigTest` — enabled teljes configgal, disabled hiányzó secret / price id esetén.

- **Hely:** `app/Support/Billing.php:17-20`
- **Hatás:** Ha csak az egyik kulcs van beállítva, `enabled()` igazat adhat, de a Stripe-hívás 500-zal esik el.
  Jelenleg mindkettő be van állítva, nem aktív hiba.
- **Javítás:** Vedd be a `config('cashier.secret')` meglétének ellenőrzését is. (Opcionálisan
  `'enabled' => (bool) env('STRIPE_ENABLED', false)` a configban.)

### [x] A3 — `billing_tax_number` DB `varchar(255)` ≠ validáció `max:50`

> **JAVÍTVA** (2026-06-23): új migráció (`align_billing_tax_number_length_on_users_table`) `varchar(50)`-re
> szűkíti. A dev DB-n kézi ALTER-rel alkalmazva (migrate szinkronon kívül). Éles SQL:
> `ALTER TABLE users MODIFY billing_tax_number VARCHAR(50) NULL DEFAULT NULL;`

- **Hely:** `database/migrations/2026_06_23_085927_add_billing_details_to_users_table.php`; `BillingUpdateRequest.php:19`
- **Javítás:** Hangold össze (DB `varchar(50)` vagy validáció `max:255`).

### [x] A4 — Nincs normalizálás (országkód uppercase, trim)

> **JAVÍTVA** (2026-06-23): a `BillingUpdateRequest::prepareForValidation()` uppercase-eli és trimmeli a
> `billing_country`-t (a Kö5 javítással együtt).

- **Hely:** `app/Http/Requests/Settings/BillingUpdateRequest.php` (nincs `prepareForValidation`)
- **Hatás:** `"hu"` is átmegy és úgy tárolódik, miközben a default `'HU'` → későbbi `=== 'HU'` összehasonlítás hibázhat.
- **Javítás:**
  ```php
  protected function prepareForValidation(): void
  {
      $this->merge([
          'billing_country' => $this->billing_country ? strtoupper(trim($this->billing_country)) : $this->billing_country,
      ]);
  }
  ```

### [x] A5 — `PAGE_LOADED_AT` modulszintű → SPA-navigáció után elavulhat a trial-számláló

> **JAVÍTVA** (2026-06-23): a modulszintű `PAGE_LOADED_AT` törölve a `pricing.tsx`-ből és a
> `subscription.tsx`-ből; a `trialDaysLeft` most render-időben `Date.now()`-val számol.

- **Hely:** `resources/js/pages/pricing.tsx:57`; `resources/js/pages/settings/subscription.tsx:29`
- **Javítás:** Számold render-időben / `useMemo`-val a mountkor. Kozmetikai.

### [x] A6 — Trial Checkout-minimum 48 óra

> **JAVÍTVA** (2026-06-23): a checkout `max(2, $trialDays)`-t ad át (Stripe Checkout min. 48 óra), így
> 1 napos beállítás sem futna hibára. A config default már 7 (lásd M1).

- **Hely:** `config/registration.php:15`
- **Hatás:** Ha a trial valaha 1 napra kerülne, a Stripe Checkout hibázna.
- **Javítás:** Default = tényleges érték (7); validáld, hogy `>= 2`, ha Checkout-tal megy.

---

## ✅ Ami jól van megoldva (megerősítve — nincs teendő)

- **Ár/csomag-manipuláció védett:** `{plan}` `abort_unless(in_array(...))`, a `price_id` kizárólag
  szerveroldalon a configból dől el. (`PricingController.php:41,53-55`)
- **Webhook biztonság:** `VerifyWebhookSignature` aktív, secret beállítva; az `AppServiceProvider` boot-időben
  kivételt dob, ha `STRIPE_ENABLED=true` de hiányzik a secret. CSRF-kivétel pontosan a `stripe/*`-ra.
- **Tömeges hozzárendelés:** az entitlement-oszlopok (`lifetime_access`, `ai_access`, `plan_override`,
  `trial_ends_at`, `stripe_*`) szándékosan nincsenek a `#[Fillable]`-ben; `invite_id` `forceFill`-lel. (`User.php:20-24`)
- **IDOR védett:** minden művelet `$request->user()`-re hat, nincs user-id az URL-ben; `hasStripeId()` őrfeltétel
  a portál előtt. (`SubscriptionController.php`, `PricingController.php:110`)
- **Swap dupla számlázás helyett**; `subscriptionPlan()` árból dönt (swap után is helyes);
  `Inertia::location` külső URL-ekhez; aláírt 1 órás success URL; front/back gating egyezik.
- **Új subscription 3DS/SCA a Stripe Checkout oldalán kezelt** — az új-subscription ágban nem kell
  `IncompletePayment` elkapás.
- **`?checkout=cancelled` POST→redirect→flash kezelés** helyes (URL-tisztítás + flash kijuttatás).

---

## 📋 Javasolt megvalósítási sorrend

1. **K1** — fióktörlésnél `cancelNow()` (folyamatos számlázás megszüntetése)
2. **K2** — `BillingUpdateRequest` kötelező mezők ↔ `hasBillingDetails()` egyezővé tétele (hurok megszüntetése)
3. **M2** — cég adószám `required_if`
4. **M1** — trial-napok egyetlen forrásból
5. **Kö1–Kö3** — webhook-késés kezelése, szerveroldali consent + rögzítés, hamis flash javítása
6. A maradék közepes/alacsony tételek tetszőleges sorrendben.

> Minden javításhoz teszt kell (CLAUDE.md elvárás). Javasolt új tesztek: hurok-bizonyíték (K2),
> cég-adószám (M2), érvénytelen országkód (Kö5), mass-assignment guard, consent (Kö2), fióktörlés+lemondás (K1).
