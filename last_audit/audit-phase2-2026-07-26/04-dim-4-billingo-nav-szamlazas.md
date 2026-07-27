# Dimenzió 4 — Billingo/NAV számlázás fail-módok, job-idempotencia, PII

> PLAN.md Fázis 2, 4. pont: *„Billingo/NAV számlázás fail-módok (Stripe siker + Billingo hiba), `GenerateBillingoInvoice` job idempotencia + PII a payloadban."*
> HEAD `527d205` · 2026-07-26 · CSAK DOKUMENTÁLÁS
> **Kiemelt regresszió-fókusz:** a `0362351 "billing phone and company reg"` commit (2026-07-22) — a legutóbbi Fázis 2 audit (2026-07-20) UTÁN érkezett, és pontosan ezt a felületet módosította.

## A számlázási lánc tény-térképe

```
Stripe: invoice.payment_succeeded
   │
   ├─ StripeWebhookController::handleWebhook (:40-72)
   │     GUARD event-id idempotencia: stripe_webhook_events.insertOrIgnore
   │
   ├─ handleInvoicePaymentSucceeded (:85-109)
   │     GUARD nincs user + amount_paid>0 → Log::critical (kézi kiállítás)
   │     GUARD config('services.billingo.enabled')
   │     PII-SZŰKÍTÉS: onlyNeededFields() — 7 mező
   │     → GenerateBillingoInvoice::dispatch (queue)
   │
   ├─ GenerateBillingoInvoice (Jobs/:16-86)
   │     $tries=4, $backoff=[60,300,900]
   │     SerializesModels → a jobs táblában csak User-ID + a 7 mezős array
   │     failed() → report() → AlertAdminOfLoggedError → admin e-mail
   │
   ├─ InvoiceGenerator::generateForStripeInvoice (:37-129)
   │     GUARD grossMinor()<=0 (trial/100% kupon) → null, sor sem születik
   │     GUARD Cache::lock("billingo:issue:{id}", 120)->block(10)
   │           → LockTimeoutException → job elbukik → retry (SZÁNDÉKOS, nem csendes)
   │     GUARD BillingoInvoice::firstOrCreate(stripe_invoice_id)  ← DB-unique
   │
   ├─ issueDocument (:151-170)  ← crash-ablak kezelés
   │     ha issuing_started_at != null → findIssuedDocument (comment exact match) → átvétel
   │     issuing_started_at = now()  a createDocument ELŐTT perzisztálva
   │     ensurePartner() → updatePartner (404 → createPartner)
   │     documentPayload() GUARD: currency ∉ {HUF,EUR} → RuntimeException
   │
   └─ BillingoClient — connectTimeout 10s / timeout 30s, ->throw() mindenhol

DB-tény (SHOW INDEX FROM billingo_invoices):
   billingo_invoices_stripe_invoice_id_unique — Non_unique=0 ✔
   user_id FK → nullOnDelete (a NAV-nyilvántartás túléli a fióktörlést)

Letöltés: GET settings/subscription/invoices/{invoice} (routes/settings.php:48, throttle:30,1)
Ops-felügyelet: queue:alert-failed (10 perc) · queue:monitor '<conn>:default' --max=25 (10 perc)
```

## Leletek

### BILL-1 — A `0362351` két új Billingo-payload-mezője (`phone`, `registration_number`) teszteletlen
- **fájl:sor**: `app/Services/Billingo/InvoiceGenerator.php:259-261` (`phone`), `:268-270` (`registration_number`); `tests/Feature/BillingoInvoiceTest.php:20-31` (`billableUser()` fixtúra), `:440-448` (céges teszt)
- **súlyosság**: **LOW** *(finder: MEDIUM → 2 verifikátor egyhangúlag LOW)* · kategória: `test-coverage`
- **verifikációs verdikt**: **PLAUSIBLE** — a teszthiány CONFIRMED (tényszerű), a MEDIUM-ot hordozó kár-út REFUTED (feltételes és hangos)
- **forgatókönyv (bemenet/állapot → hatás)**:
  1. A `0362351` két új kulcsot vezet be a Billingo `/partners` payloadba: `phone` (`:259-261`) és `registration_number` (`:268-270`).
  2. Egyik sincs asszertálva: grep az egész `BillingoInvoiceTest`-re → **0** `phone`/`registration_number` payload-assertion (a 12 egyéb találat mind a `users` tábla validációjáról szól, nem a payloadról).
  3. **HA** a Billingo v3 partner-séma nem ismeri a mezőt (vagy más néven hívja), a `->throw()` 422-t dob → `ensurePartner` bukik → **BILL-4 miatt a `createDocument` sem fut** → **a NAV-számla nem áll ki**, mind a 4 retry elhasal.
  4. → Elmaradt NAV-számla + `failed_jobs` sor + admin-riasztás; a Stripe-fizetés érintetlen.
- **szavazatok indoklása**:
  - **V1 (séma-helyesség-lencse) → PLAUSIBLE / LOW.** A repóban **nincs** Billingo-sémadokumentáció (nincs OpenAPI/SDK/Postman; a `BillingoClient:9-12` explicit „szándékosan nem generált SDK") → a mezőnév-helyesség se nem igazolható, se nem cáfolható. A „a Billingo csendben ignorálja az extra mezőt" cáfolási kísérlet **megbukott**: a projekt-memória rögzíti a szerző élesben mért tapasztalatát (`conversion_rate` → `422 Validation Failed`), tehát a Billingo bizonyítottan 422-zik érvénytelen payloadra, és a szerző séma-feltevése **már egyszer megdőlt élesben**. *(Megszorítás: az akkori eset hiányzó KÖTELEZŐ mező volt, nem ismeretlen EXTRA mező — a kettő eltérő API-viselkedés.)* **Döntő érv a LOW-ra:** a teszt-suite `Http::fake()`-kel dolgozik, így egy hozzáadott assertion **csak azt bizonyítaná, hogy a saját kódunk beteszi a kulcsot** — arról semmit, hogy a Billingo elfogadja. A javasolt ellenszer tehát bizonyíthatóan nem hat a kár-útra → a lelet valódi tartalma teszt-lefedettségi hézag, nem működési hiba.
  - **V2 (blast-radius-lencse) → PLAUSIBLE / LOW.** A „néma hiba" pillér **határozottan megdőlt**: a lánc négy szinten hangos (`->throw()` → nem-404 továbbdobás → `tries=4` + `failed()`/`report()` → `queue:alert-failed` 10 percenként **szinkron** admin e-maillel, monoton `id`-vízjellel). Egy 422 legkésőbb 10 percen belül riaszt. Az „adatvesztés" pillér is megdőlt: a pénz a Stripe-nál rögzítve, a `BillingoInvoice` sor a unique kulcson létrejön (csak `billingo_document_id = null`), és a javítás után a **változatlan sor újrafuttatható** a dupla-számla-guardok védelmében → teljes, adatvesztés-mentes helyreállítás. Projekt-precedens: a korábbi Fázis 2 „BILL-1" (árva Billingo-partner) is **LOW** volt „pénzügyi hatás nincs, operátor takarítja" érveléssel — a jelen lelet szigorúan kisebb hatású.
- **⚠️ AUDITORI KORREKCIÓ (saját mérés, két agent ellentmondását feloldva)**: V2 azt állította, hogy a `phone` ág „de-facto lefedett", mert a `UserFactory` defaultot ad rá. **Ez téves.** A `billing_phone` a `withBilling()` **state**-ben van (`database/factories/UserFactory.php:85-94`), **nem** a base `definition()`-ben (`:25`), és a `billableUser()` nem hívja a state-et. Egy eldobható próba-teszttel **empirikusan megmértem**: `billableUser()` → `billing_phone === null` *(a próbafájl törölve, a repo érintetlen)*. Tehát **Finder D eredeti állítása áll: mindkét ág teszteletlen.**
- **következmény a súlyosságra**: ez a korrekció a `phone` ágat **kockázatosabbá** teszi, mint V2 gondolta — a `phone` **MINDEN** userre kimegy (nem csak cégesre), mert a `hasBillingDetails()` (`User.php:259`) már megköveteli a telefont. Ha a `phone` lenne rossz mezőnév, az **össz-felhasználós** számlázási leállás lenne. Ugyanakkor a `phone` egyben a legtriviálisabb, legvalószínűbben helyes partner-mező (illeszkedik a `name`/`address`/`emails`/`taxcode` lapos snake_case konvencióhoz). A LOW-t a hangos-hiba + teljes retry-olhatóság + determinisztikus, azonnali észlelhetőség tartja.
- **javasolt lezárás (nem teszt-assertion)**: egyetlen valós `POST /partners` hívás a Billingo **teszt profillal**, mindkét mezővel — órák alatt bizonyítja vagy cáfolja a sémát, amit a mockolt suite soha nem tud. Plusz egy mezőnév-jegyzet a `docs`-ba.

### BILL-2 — A `billing_phone` regex számjegy nélküli szemetet is elfogad, és az a NAV-partneradatba kerül
- **fájl:sor**: `app/Concerns/BillingValidationRules.php:54`
- **súlyosság**: **LOW**
- **verifikációs verdikt**: **CONFIRMED** *(a regex-viselkedést saját méréssel is visszaellenőriztem)*
- **forgatókönyv**:
  1. A szabály `'regex:/^\+?[\d\s()-]{6,30}$/'` — a `\d` a karakterosztályon belül **opcionális**, nincs „legalább N számjegy" kényszer.
  2. **Mért eredmény** (`php -r` futtatva): `"(((((("`, `"------"`, `"      "` (6 szóköz), `"()()()"`, `"+     -"` → **MIND PASS**; csak a 6 alatti (`"36-1"`) bukik.
  3. User beküldi `POST settings/billing`-re: `billing_phone = "(((((("`, minden más valid → mentés OK, `hasBillingDetails()` true (`filled("((((((")`), a checkout-kapu átengedi.
  4. Fizetés → `partnerPayload()` `:259-261` truthy → `'phone' => '(((((('` a Billingo `/partners` payloadban.
  5. → **(a)** a Billingo elfogadja: értelmetlen telefonszám a NAV-partnerkartonon (adat-integritási, nem jogi hiba — a telefon nem NAV-kötelező számlaelem); **(b)** a Billingo `phone`-validációja 422-zik → **self-inflicted DoS a saját számlázásán**: nem kap NAV-számlát, 4 retry elhasal, admin-riasztás.
- **szavazatok indoklása / miért LOW**: a `[\d\s()-]` osztály kizárja a `<`, `"`, `\n`, unicode-ot → **CRLF-/JSON-injektálás NEM lehetséges** (ez a fontos rész, és rendben van); `max:30` fékezi a payload-hízást. Nincs jogi/pénzügyi kár, csak a **saját** fiókja sérülhet, és arról riasztás jön. Hiányzó elem: pozitív számjegy-minimum (pl. `(?=(?:\D*\d){6})`).

### BILL-3 — `queue:monitor` fixen a `:default` queue-t figyeli → queue-név-drift esetén a NÉMA elmaradt számla nem riaszt
- **fájl:sor**: `routes/console.php:23`
- **súlyosság**: **LOW** (de a lánc **egyetlen valóban néma** útja — ops-szempontból a legfontosabb lelet)
- **verifikációs verdikt**: **CONFIRMED**
- **forgatókönyv**:
  1. `Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])` — a **connection** nevét configból veszi, a **queue nevét hardcode-olja** `default`-ra.
  2. A `GenerateBillingoInvoice`-nak nincs `$queue`/`onQueue()` → a `DB_QUEUE` env-re kerül (`config/queue.php:42`, default `'default'`).
  3. Ha a `.env`-ben `DB_QUEUE=topewords-prod` (vagy staging-örökség), a job oda kerül, a monitor viszont a `default`-ot méri → mindig 0 → `QueueBusy` sosem lő.
  4. → A számla nem áll ki, a job **nem bukik el** (nem kerül `failed_jobs`-ba, tehát a `queue:alert-failed` sem szól), csak **ül** → **NÉMA elmaradt NAV-számla**.
- **szavazatok indoklása / miért LOW**: ez **pontosan a 2026-07-22-i élő incidens** mintája (a `.env` queue-neve staging volt éles szerveren, a worker más queue-t hallgatott, a job csendben ült). Az akkori root cause a `.env`-ben javítva, de a **monitor továbbra sem konfigurációkövető** → a következő queue-név-drift ugyanígy vak lesz. Ma LOW, mert a `.env`-ben `QUEUE_CONNECTION=database` és a `DB_QUEUE` nincs felülírva → **ma egyezik** (`schedule:list`-tel ellenőrizve: `queue:monitor 'database:default'`). A `failed()`/`report()` réteg itt tehetetlen, mert a nem-feldolgozott job nem bukik el.

### BILL-4 — Nem-404 `updatePartner`-hiba a NAV-SZÁMLÁT is blokkolja
- **fájl:sor**: `app/Services/Billingo/InvoiceGenerator.php:213-233` (`:220-222` továbbdobás)
- **súlyosság**: **INFO** (tudatos, tesztelt fail-closed döntés)
- **forgatókönyv**: `ensurePartner()` meglévő partnernél mindig `updatePartner()`-t hív. A `catch (RequestException)` **csak a 404-et** kezeli (partner törölve → újra létrehozás); minden más status továbbdobódik → a `createDocument` (`:167-169`) sem fut. Tehát egy „kozmetikai" partner-adat-hiba **a számla kiállítását is megakasztja**, holott a régi partneradatokkal kiállítható lett volna.
- **miért INFO**: nem néma (retry + `failed()` + riasztás), és a fail-closed irány (inkább ne álljon ki, mint rossz adattal) számlázásnál védhető. Teszt explicit rögzíti a viselkedést (`BillingoInvoiceTest:396`). **Csak azért szerepel, mert BILL-1/BILL-2 blast-radiusát ez nagyítja fel:** egy payload-mező hibája nem „hiányzó telefonszám a számlán", hanem **„nincs számla"**.

### BILL-5 — Adószám/cégjegyzékszám csak formátumra, nem érvényességre ellenőrzött
- **fájl:sor**: `app/Concerns/BillingValidationRules.php:48` (adószám), `:62` (cégjegyzékszám)
- **súlyosság**: **LOW**
- **verifikációs verdikt**: **CONFIRMED** (a regex-lyuk mért)
- **forgatókönyv**: adószám `regex:/^\d{8}-\d-\d{2}$/` → `"00000000-0-00"`, `"99999999-9-99"` **PASS**. Nincs (a) magyar adószám-CDV ellenőrzőszám, (b) áfakód-whitelist (jogszabály szerint a 2. blokk 1–5, a `0` és `6-9` érvénytelen), (c) megyekód-whitelist (01–44 + 51). Cégjegyzékszám `regex:/^\d{2}-\d{2}-\d{6}$/` → `"99-99-999999"` PASS, nincs megyekód- (01–20) és cégforma-kód- (01–23) whitelist. → A user céges módban nem létező adószámot ad meg → a Billingo kiállítja a számlát → **NAV Online Számla adatszolgáltatásban elutasítás/hibás bejelentés**, amit a **kiállítónak** kell rendezni (compliance-kár, nem pénzügyi). Alternatív ág: a Billingo saját validációja 422-zik → nincs számla + riasztás.
- **miért LOW**: a formátum-regex + `required_if`/`prohibited_if` páros konzisztensen zárja az egyéni↔céges átmenetet (ellentmondó DB-állapot nem ragadhat); a hibás adat a **saját** számláját érinti; rossz adószám megadása a vevő önsorsrontása, nem támadás más ellen; mindkét kimeneti ág észlelhető nyomot hagy.

### BILL-6 — Nincs számla-storno/módosítás út; a refund csak `Log::critical`-t ad
- **fájl:sor**: `app/Http/Controllers/StripeWebhookController.php:131-147`; `BillingoClient.php` (nincs `cancelDocument`/`credit_note`)
- **súlyosság**: **INFO**
- `grep -rni "cancelDocument|credit_note" app/` → 0 találat. **Storno-végpont nem létezik → jogosultsági rés sem létezhet rajta.** Tudatos, kommentben dokumentált döntés (`:122-129`: részleges refund / több számla / valuta miatt az automatikus sztornó kockázatosabb). A `Log::critical` → `AlertAdminOfLoggedError` → admin e-mail + kereshető log-nyom. Konkrét bemenet→kár út nincs → nem lelet a séma-kényszer értelmében, csak ismert kézi-folyamat-igény.

## Ami TISZTÁNAK bizonyult

**1. IDOR a számla-letöltésen — TISZTA.** *(Saját ellenőrzéssel is visszamérve.)*
`SubscriptionController::downloadInvoice` (`:94-118`): a route-model-binding `where('user_id')` scope **nélkül** köt (önmagában IDOR-gyanús), de `:96` `abort_unless($invoice->user_id === $request->user()->id, 404)` **explicit, típusegyeztetett** (`===` két bigint között) ownership-ellenőrzés zárja. `:97` `abort_unless($invoice->isIssued(), 404)` → a ki nem állított sorok nem tölthetők le (nem lehet `(int) null = 0` dokumentum-id-val a Billingóra menni). **404, nem 403** → nincs létezés-orákulum, nem enumerálható. `throttle:30,1`. Teszt-fedezet: `Settings/SubscriptionTest.php:143` (idegen számla → 404), `:159` (unissued), `:121` (ConnectionException → 404, nem 500). A listázás relációból + `whereNotNull('billingo_document_id')` → idegen adat nem szivárog.
**PLAN-feltevés részben MEGDŐLT:** nincs Cashier `findInvoiceOrFail`-alapú letöltő végpont — a NAV-számla saját `BillingoInvoice`-modellből jön.

**2. Job-idempotencia / dupla NAV-számla — TISZTA, négyrétegű védelem.** *(A rétegeket egyenként visszaellenőriztem.)*
- **Réteg 1 (webhook):** `stripe_webhook_events.insertOrIgnore` az event-id-ra → ugyanaz az `evt_…` másodszor nem is dispatch-el jobot.
- **Réteg 2 (DB-unique, migrációból ÉS élő `SHOW INDEX`-ből verifikálva):** `billingo_invoices_stripe_invoice_id_unique`, `Non_unique=0` → a `firstOrCreate` egy fizetéshez fizikailag egy sort tud.
- **Réteg 3 (lock, a KRITIKUS):** `Cache::lock("billingo:issue:{$stripeInvoiceId}", 120)->block(10)`. A kulcs **per Stripe-invoice** — a helyes granularitás (két különböző számla párhuzamosan mehet, ugyanaz nem). Ez zárja azt, amit a unique kulcs NEM: a `createDocument` HTTP-hívás duplázását. A timeout **nem** csendes `return null`, hanem `LockTimeoutException` → job-bukás → retry (teszt őrzi).
- **Réteg 4 (a PLAN által kért crash-ablak — „Billingo-hívás UTÁN, lokális mentés ELŐTT"): konkrétan kezelve.** Az `issuing_started_at` a `createDocument` **ELŐTT** perzisztálódik (`:165`); retry-nál (`:155-161`) a `findIssuedDocument()` a Billingón visszakeres, és a `comment` **pontos** egyezését ellenőrzi (`:184` — nem részleges match, tehát idegen számlát nem vehet át). Találat → átvétel, új kiállítás nélkül. 3 dedikált teszt (`:572`, `:607`, `:634`).
- `ShouldBeUnique` nincs — **és nem is kell**: a fenti 4 réteg erősebb (a `ShouldBeUnique` csak a queue-ba kerülést fékezi, a worker-oldali race-t nem).

**3. „Stripe siker + Billingo hiba" fail-mód — TISZTA, egy kivétellel (BILL-3).**
`$tries=4`, `$backoff=[60,300,900]` → ~21 perc kivárás átmeneti 5xx/rate-limitre. Végleges bukás: `failed()` → `report()` → `AlertAdminOfLoggedError` → admin e-mail (per-hiba dedup + 10/óra burst-plafon), + `failed_jobs` sor → `queue:alert-failed` 10 percenként, aminek a szövege **explicit kimondja**: „Ha köztük van GenerateBillingoInvoice, az kimaradt NAV-számlát jelent!" (`FailedJobsDetected.php:35`) → **két független riasztási út**. *(`schedule:list`-tel ellenőrizve: mindkét parancs 10 percenként ütemezve.)* A „nincs helyi user" ág nem nyel: `Log::critical` + a retry hiábavalóságának felismerése.

**4. PII a payloadban és a logokban — TISZTA, tudatosan megtervezve.** *(Saját ellenőrzéssel megerősítve.)*
- **Job-payload:** `onlyNeededFields()` (`:48-65`) a Stripe invoice-t **7 mezőre** szűkíti; `customer_email/name/address/customer` **kizárva**. Tesztelve (`BillingoInvoiceTest:479`, W-L3: PII-kulcsok `not->toHaveKey`).
- A `User` a `SerializesModels` miatt **ID-ként** szerializálódik → a `jobs`/`failed_jobs` táblában nincs e-mail/cím/adószám. *(Vendorban visszaellenőriztem: `Illuminate\Foundation\Queue\Queueable` `use`-olja a `SerializesModels`-t.)*
- **Log-hívások:** mind a 4 Billingo-lánc-beli `Log::` kontextusa **kizárólag azonosító** (`user_id`, `stripe_invoice_id`, `billingo_document_id`, `stripe_customer`, összeg, valuta) — **nincs teljes payload-dump**, nincs név/e-mail/cím/adószám.
- **Riasztó e-mail:** `AlertAdminOfLoggedError::exceptionSummary()` csak `class @ file:line`-t ad, a message `limit(500)` → PII nem szivárog admin-postafiókba.
- **API-kulcs:** `X-API-KEY` headerben (`BillingoClient:158`), nem URL-ben → nem kerül `RequestException`-üzenetbe.

**5. Egyéni↔céges váltás null-ozása — TISZTA, HÁRMAS védelem.**
`BillingController::update` (`:32-35`) `individual`-nál **explicit** nullázza mind az adószámot, mind a cégjegyzékszámot (az unmountolt React-mező nem érkezik be, a `fill()` a régit bennhagyná) → a `prohibited_if:billing_type,individual` (`:46`, `:60`) a bemeneti oldalon is zárja → a `partnerPayload` (`:264-270`) harmadszor is ellenőriz (`billing_type === 'company' &&`). **Egyéni számlára adószám/cégjegyzékszám semmiképp nem kerülhet fel.** Tesztelve (`BillingSettingsTest:118`, `:180`, `:198`).

**6. Kontrollkarakter-szűrés a NAV-számlára kerülő szöveges mezőkön — RÉSZBEN tiszta (INFO).**
`$noControlChars = 'regex:/^[^\x00-\x1F\x7F]+$/u'` a `billing_name/city/address`-en → `\n`, `\r`, `\0` kizárva → **CRLF-injektálás / sortörés a jogi számlán nem megy**. Megjegyzés: az U+2028, U+0085, U+202E (RTL-override), U+00A0 **átmegy** — megjelenítés-torzítók lehetnek a PDF-en, de nem struktúra-törők; a payload JSON-kódolt → **injektálás nincs**. Nem sorolom leletnek: nincs kár-út a „csúnyán néz ki" felett.

**7. `grossMinor() <= 0` guard — TISZTA.** Trial-induló és 100%-kuponos 0 Ft-os `invoice.payment_succeeded`-re nem áll ki NAV-számla, és **nyilvántartó sor sem születik** (`:49-51`) → nincs „lefoglalt, sosem kiállított" szemét-sor.

**8. Valuta- és árfolyam-fail-closed — TISZTA.** `currency ∉ {HUF, EUR}` → `RuntimeException` (`:290-292`), **nem** rossz összegű számla (a `round($grossMinor/100, 2)` zero-decimal valután 1/100-ad összeget adna — explicit felismert és lezárt). `exchangeRate() <= 0` → `RuntimeException`. Teljesítési dátum `Europe/Budapest`-re konvertálva (`:375-384`) → az UTC-éjfél-átfordulás nem ad rossz NAV-teljesítési dátumot / MNB-napot.

**9. Számla-nyilvántartás fióktörlés után — TISZTA.** A `2026_07_17_074731` migráció `cascadeOnDelete`→`nullOnDelete`-re váltott, kommentelt könyvelési indoklással → a `stripe_invoice_id ↔ billingo_document_id` linkelés túléli a fióktörlést.

**10. Teszt-állapot:** 68 releváns teszt zöld (`BillingoInvoiceTest` + `BillingSettingsTest` + `Settings/SubscriptionTest`, 232 assertion). A teljes money-kör (`Webhook|Stripe|Billing|Subscription|Pricing|Invoice|Checkout`) **160 teszt zöld**.

## A `0362351 "billing phone and company reg"` commit regresszió-értékelése

| Változás | Regresszió-értékelés |
|---|---|
| `BillingValidationRules:54` — új `billing_phone` szabály | ⚠️ **BILL-2**: számjegy-minimum nélkül `"(((((("`-t is átengedi. Injektálás-mentes, de szemantikailag lyukas. |
| `BillingValidationRules:57-63` — új `billing_company_registration_number` | ✅ A szabály-készlet **szimmetrikus** az adószámmal (`nullable` + `required_if:company` + `prohibited_if:individual` + `regex`) — helyes minta-követés. ⚠️ **BILL-5**: csak forma, nem kód-tartomány. |
| `BillingController:34` — nullázás egyéni módban | ✅ **Helyesen** követte az adószám mintáját; e nélkül régi cégjegyzékszám ragadt volna a fiókon. Tesztelve. **Nincs regresszió.** |
| `User.php:27` — `#[Fillable]` +2 mező | ✅ Csak a 2 új *billing* mező került be; entitlement-oszlop (`lifetime_access`, `plan_override`, `stripe_*`, `billingo_partner_id`) **nem** → a mass-assignment-határ **sértetlen**. |
| `User.php:246-265` — `hasBillingDetails()` szigorítás | ⚠️ **Viselkedésváltás, nem hiba.** A migráció backfill nélkül `nullable` → minden 2026-07-22 előtti user `hasBillingDetails()` false-ra fordult. Hatás: (a) **helyes** irány — új checkout előtt a `PricingController:92` a `billing.edit`-re **irányítja** őket (nem zárja ki), kitöltik, mehet tovább *(saját ellenőrzéssel megerősítve: redirect, nem 403)*; (b) a **futó** előfizetők havi megújítása nem megy át ezen a kapun (a webhook közvetlenül dispatch-el), és a `partnerPayload` mindkét új mezőt **truthy-guard** mögé tette → legacy usernél a kulcs egyszerűen kimarad, a számla ugyanúgy kiáll, mint a commit előtt. **A szigorítás tehát NEM tör el futó számlázást** — ez a commit legjobb döntése. |
| `InvoiceGenerator:259-270` — 2 új payload-kulcs | ⚠️ **BILL-1** (a commit fő kockázata): mindkét ág **teszteletlen holt-út** a suite-ban (empirikusan mérve). BILL-4 miatt egy 422 nem csak a partner-frissítést, hanem a **NAV-számlát is** elbuktatja. |
| `UserFactory:93` — `withBilling()` +`billing_phone` | ⚠️ Csak a **state**-be került; a `BillingoInvoiceTest::billableUser()` **nem használja** → innen a BILL-1 teszthiány. *(Ez a pont egy verifikátori téves állítás korrekciója — lásd BILL-1 auditori korrekció.)* |
| Migráció `2026_07_22_070158` | ✅ Két `nullable()` string, `after()` pozicionálás, `down()` mindkettőt dobja. ⚠️ INFO: `varchar(255)` bőkezű a `max:30` phone-hoz (kozmetikai; a validáció a valódi korlát). |

**Regresszió-verdikt:** a commit **nem tört el működő számlázást** (a `partnerPayload` truthy-guardjai és a `hasBillingDetails` kapu-pozíciója miatt), a validáció szimmetrikus és `prohibited_if`-fel zárt, a mass-assignment-határ sértetlen. **Két gyengeség maradt:** a két új payload-mező teszteletlensége (BILL-1) és a telefon-regex számjegy-minimum-hiánya (BILL-2).

## Összegzés

**0 HIGH · 0 MEDIUM · 4 LOW (BILL-1, BILL-2, BILL-3, BILL-5) · 2 INFO (BILL-4, BILL-6).**

A négy legfontosabb PLAN-gyanú közül **három cáfolva**:
- **IDOR a számla-letöltésen** = nincs (explicit `user_id ===` + `isIssued()` + 404-nem-403 + throttle + 4 teszt);
- **dupla NAV-számla** = nincs (event-id dedup + DB-unique *élő `SHOW INDEX`-ből verifikálva* + per-invoice lock + `issuing_started_at`/`findIssuedDocument` crash-ablak-kezelés, 3 teszttel);
- **PII a job-payloadban** = nincs (`onlyNeededFields` + `SerializesModels` + ID-only logok).

A negyedik (Stripe siker + Billingo hiba **némán** elveszik) **csak a BILL-3 úton** áll fenn: ott a job nem *bukik el*, ezért egyik riasztási lánc sem fog rá; a `queue:monitor` lenne a védelem, és épp az nem konfigurációkövető.
