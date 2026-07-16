# 🔍 Pay/Billing/Subscription + Stripe webhook + Player-token audit — TopWords

> Készült: 2026-07-16 · Hatókör: fizetés/számlázás/előfizetés (Stripe Checkout + Cashier v16),
> Stripe webhook + Billingo (NAV) számlázási pipeline, desktop-player párosítás/token (Sanctum v4).
> Módszer: 3 párhuzamos mélyvizsgálat + a Medium-találatok kézi ellenőrzése a kódban.
> Csak dokumentáció — javítás nem történt.
>
> **RE-AUDIT (2026-07-16 délután, a d40207c után):** a W-M2 + S-M1 + W-L1 javítása kézzel
> ellenőrizve HELYES és teljes (részletek az egyes tételeknél), a javítások új hibát nem
> vezettek be; a terület mind a 164 tesztje zöld (70 pay/webhook + 94 player/extension).
> Új találat egyetlen Low (S-L7). A W-M1 és PL-M1 változatlanul nyitott.

**Összegzés: nincs HIGH találat.** A fizetési mag (ár-manipuláció, webhook-aláírás, idempotencia,
mass assignment, IDOR, limit-race-ek) továbbra is masszív. 4 Medium és ~15 Low maradt, jellemzően
ritka race-ek, néma hibautak és UX/ops hézagok. A korábbi nyitott „webhook re-fetch" tétel pontosan
be lett határolva: csak az előfizetés-állapotot érinti (W-M1), a Billingo/pénz-útvonalat nem.

Jelölésmagyarázat: `[ ]` = nyitott · `[x]` = kész · `[~]` = folyamatban

---

## 🟠 MEDIUM

### [x] W-M1 — Sorrenden kívüli `customer.subscription.updated` feltámaszthat egy halott előfizetést

> **JAVÍTVA (2026-07-16):** felülírt `handleCustomerSubscriptionUpdated` a
> `StripeWebhookController`-ben — a helyben már `canceled` előfizetésre érkező nem-canceled
> státuszú update biztosan elavult (a Stripe törölt előfizetést soha nem támaszt fel), ezért
> `Log::warning`-gal eldobjuk, a Cashier alap-útja nem fut le. Konzisztens (canceled→canceled)
> update és ismeretlen előfizetés létrehozása változatlanul átmegy. Out-of-order szimuláció:
> új `SubscriptionResurrectionGuardTest` (4 teszt).

- **Hely:** örökölt `vendor/laravel/cashier/.../WebhookController.php:132-208` (az app `StripeWebhookController`-e nem írja felül a `handleCustomerSubscriptionUpdated`-et — kézzel ellenőrizve)
- **Forgatókönyv:** a Stripe nem garantál esemény-sorrendet. Ha a `customer.subscription.deleted`
  feldolgozása után befut egy késleltetett/újraküldött korábbi `updated` (`status=active`,
  `cancel_at=null`), a Cashier a payload-pillanatképet ellenőrzés nélkül írja rá a helyi sorra
  (`firstOrNew` → `stripe_status=active`, `ends_at=null`) → a `valid()` újra igaz → **tartós ingyen
  prémium**, mert a Stripe-oldalon az előfizetés halott, több korrekciós esemény nem jön.
- Nem támadó-vezérelt (aláírás-ellenőrzött), de valós bevétel-lyuk ritka race esetén.
- **Ez a korábbi nyitott „webhook re-fetch" tétel érdemi magja.** A Billingo-oldalon a re-fetch
  NEM szükséges: az `amount_paid`/`currency`/`paid_at` egy lezárt fizetés immutábilis tényei,
  az idempotencia az immutábilis `in_...` ID-n áll.
- **Teszt:** nincs out-of-order szimuláció.
- **Javítási irány (kérésre):** felülírt `handleCustomerSubscriptionUpdated`-ben re-fetch a Stripe
  API-ról, vagy `active` update figyelmen kívül hagyása helyben `canceled` előfizetésen.

### [x] W-M2 — `invoice.payment_succeeded` ismeretlen customerre néma 200 → a NAV-számla észrevétlenül kimarad

> **JAVÍTVA (d40207c), re-auditban ellenőrizve:** ismeretlen customer + pozitív terhelés +
> bekapcsolt Billingo esetén `Log::critical` riasztás megy (a 200-as ACK marad, helyesen — a
> retry nem hozná létre a usert). 0 összegnél és kikapcsolt Billingónál nincs riasztás. Mind a
> három ág tesztelt (`BillingoInvoiceTest`).

- **Hely:** `app/Http/Controllers/StripeWebhookController.php:26-36` (kézzel ellenőrizve)
- **Forgatókönyv:** ha `getUserByStripeId()` null-t ad (pl. (a) a `customer.deleted` előbb futott le
  és a Cashier kinullázta a `users.stripe_id`-t, majd befut egy utolsó/újraküldött invoice-esemény;
  (b) dashboardról indított, helyi userhez nem kötött előfizetés), a handler **log, riasztás és
  retry nélkül** 200-at ad. Pénz beszedve, Billingo/NAV-számla nincs, nyoma sincs. Ez ellentmond a
  pipeline saját elvének („NAV-kötelezettség, nem maradhat észrevétlen" — a job `failed()`-je pont
  ezért hangos).
- **Teszt:** `BillingoInvoiceTest` sosem küld ismeretlen `customer`-t; hiányzik.
- **Javítási irány:** `Log::critical`/`report()`, ha Billingo enabled + bruttó > 0 + nincs user.

### [x] S-M1 — A past_due „sikertelen terhelés" sáv elérhetetlen — az ea6c599-beli L2-fix halott kód

> **JAVÍTVA (d40207c), re-auditban ellenőrizve:** új `hasPastDueSubscription` prop a `valid()`-et
> megkerülő lekérdezésből (`stripe_status='past_due'` + `ends_at IS NULL`), a sáv az `isPremium`
> blokkon KÍVÜL renderel, kártya-frissítés gombbal a billing portálra. A fail-closed hozzáférés
> változatlan. 4 render-teszt (`SubscriptionPastDueDisplayTest`). Maradék: az új S-L7 (lásd lent).

- **Hely:** `app/Http/Controllers/Settings/SubscriptionController.php:22,47-60` +
  `resources/js/pages/settings/subscription.tsx:107,115` (kézzel ellenőrizve)
- **Forgatókönyv:** a Cashier defaultja `deactivatePastDue=true` (az app sehol nem hívja a
  `keepPastDueSubscriptionsActive()`-ot — greppel ellenőrizve), így past_due-nál a `valid()` hamis →
  `activeSubscription()` null → `isPremium=false` ÉS `subscription=null`. A sáv
  (`subscription?.stripe_status === 'past_due'`, tsx:115) az `{isPremium && ...}` blokkban (tsx:107)
  ül, tehát **mindkét kapuja hamis, pont amikor kellene**. A sikertelen terhelésű user a
  „nincs előfizetés / upsell" nézetet látja kártyafrissítési felszólítás helyett → önkéntelen churn;
  ha újra checkoutol, második előfizetés keletkezik (a duplikátum-takarító lekezeli, de critical-riasztás-zajjal).
  A hozzáférés fail-closed (helyes), ez tisztán recovery-UX/korrektség.
- **Teszt:** nincs past_due-s render-teszt (a `past_due` csak a DuplicateSubscriptionCleanup- és
  ProfileUpdate-tesztben szerepel) — ezért nem bukott ki.
- **Javítási irány:** dedikált `hasPastDueSubscription` prop `valid()`-et megkerülő lekérdezésből
  (`subscriptions()->where('stripe_status','past_due')`), az `isPremium` blokkon kívül renderelve.

### [ ] PL-M1 — Napi írás-keret megkerülhető: `update-importance` keret nélkül vesz fel szót „known"-ként

- **Hely:** `app/Http/Controllers/ExtensionController.php:443-445` (route: `player.update-importance`,
  60/perc throttle; kézzel ellenőrizve)
- **Forgatókönyv:** az `updateStatus` minden státusz-felvételnél `reserveExtensionWrite()`-ot hív, az
  `updateImportance` viszont pivot nélküli szótári szónál `syncWithoutDetaching([... 'status'=>'known' ...])`-ot
  csinál **keret-ellenőrzés nélkül**. Egy kimerített keretű Free user `importance: 1`-gyel szavanként
  ugyanazt éri el, mint a keret-terhelt „known" írás; a plafon csak a throttle (60/perc ≈ 86k/nap).
- **Fontos kontextus:** a metódus PHPDoc-ja kimondja: „A webes viselkedéssel egyezően nem számít az
  írás-keretbe" — azaz szándékos web-paritás (a `WordController::importance` ugyanígy működik).
  Hasonló a 2026-07-14-es üzleti döntéshez (Free napi 20 írás marad) — **döntést igényel**: vagy
  elfogadott paritás (akkor dokumentált-lezárt), vagy mindkét oldalon keretbe számítandó az
  importance-útvonalú *felvétel* (a meglévő szó importance-módosítása maradhat ingyen).
- **Melléklelet (PL-L6):** ez az út a streak/achievement-könyvelést (`recordStatusActivity`) is kihagyja.
- **Teszt:** csak prémium userrel tesztelt az attach-út; kimerített keretű Free user nincs lefedve.

---

## 🟡 LOW

### Fizetés / előfizetés

- [x] **S-L1 — Nincs throttle a `subscription.cancel`/`resume`-on** (`routes/settings.php:44-45`) —
  mindkettő élő Stripe API-hívás; a testvér-route-ok (portal 10/perc, checkout 20/perc) throttle-oltak.
  A `billing.update` szintén throttle nélküli, de az csak DB-írás. **JAVÍTVA (2026-07-16):**
  közös nevesített `throttle:10,1,subscription-manage` mindkét route-on (a nevesítés szándékos:
  a sima `throttle:10,1` bejelentkezett usernél route-független kulcsot használ, így a portal
  és az invoice-letöltés számlálójával osztozna). Teszt: SubscriptionTest.
- [ ] **S-L2 — A regisztráció némán eldobja a `billing_country`-t** (`app/Actions/Fortify/CreateNewUser.php:65-72`) —
  a form gyűjti, a rules validálja, a `$billingFields` kihagyja. Ma kozmetikai (csak HU engedélyezett,
  az InvoiceGenerator `?: 'HU'` defaultol), de második ország engedélyezésekor számlázási csapda.
- [ ] **S-L3 — `hasBillingDetails()` nem követeli meg a `billing_type`-ot** (`app/Models/User.php:221-227` +
  `InvoiceGenerator.php:166`) — direkt POST-tal regisztrált user (name/zip/city/address kitöltve,
  type nélkül) átmegy a checkout-kapun, és de facto céges vevő adószám nélküli NAV-számlát kaphat
  (a `taxcode` csak `billing_type === 'company'`-nál kerül a partner-payloadba). A Settings-oldali
  validáció szigorú; a regisztráció→checkout út teszteletlen.
- [ ] **S-L4 / W-L6 — Fióktörlés a fizetés→számla ablakban** — (a) a queue-ban ülő
  `GenerateBillingoInvoice` a törléskor `ModelNotFoundException`-nel hal (hangos, de a kötelező
  számla kézi feladat marad); (b) a `billingo_invoices.user_id` `cascadeOnDelete`, így a helyi
  számla-nyilvántartás (stripe↔billingo linkelés) törlődik (a Billingo marad a külső igazságforrás).
  Megfontolandó: `nullOnDelete` + nullable, vagy törlés-blokk függő számla-jobnál.
- [ ] **S-L5 — Checkout-kapu sorrend + félrevezető üzenet grace-újracheckoutnál**
  (`PricingController.php:57,66,84-86`) — (a) lifetime user számlázási adat nélkül „töltsd ki a
  számlázási adatokat" üzenetet kap egy nem is szükséges fizetéshez (a `hasBillingDetails`-kapu a
  lifetime-elágazás ELŐTT fut); (b) grace-periódusos lemondott előfizetésre „Már ez az aktív
  csomagod" jön `resume()` helyett. Mindkettő csak direkt POST-tal érhető el, UI-ból nem.
- [ ] **S-L6 — Halott `subscribed` middleware-alias** (`bootstrap/app.php:25`) — 0 route használja;
  a kapuzás szándékosan limit-alapú, de az alias hamis biztonságérzetet kelt. Törölni vagy használni
  (releváns a tervezett extension-paywallnál).
- [x] **S-L7 — ÚJ (re-audit): past_due-nál a recovery-sáv MELLETT az ingyenes-csomag upsell is
  renderel** (`subscription.tsx:222`: `!isSubscribed && !isOnTrial && !hasActiveAccess` past_due-nál
  mind igaz) — a user egyszerre látja a „frissítsd a kártyád" sávot ÉS a „Váltás Prémiumra" gombot;
  utóbbi a pricing→checkout úton MÁSODIK előfizetést indít (az `activeSubscription()` past_due-nál
  null, így a swap-ág nem fogja meg). A duplikátum-takarító lekezeli (keeper-logika + critical
  riasztás + cancelNow), tehát pénz nem vész el, de elkerülhető zaj. **JAVÍTVA (2026-07-16):**
  mindkét irány megvalósítva — (1) új `User::hasPastDueSubscription()` helper (a
  SubscriptionController inline lekérdezése is erre vált); (2) szerveroldali checkout-kapu a
  `PricingController::checkout`-ban: nem-lezárt past_due előfizetésnél a checkout info-üzenettel a
  subscription-settingsre irányít (kártya-frissítés), új előfizetés nem indul; (3) a
  `subscription.tsx` upsell-blokkja `!hasPastDueSubscription`-re is feltételes. Tesztek:
  PricingCheckoutGatekeeperTest +2 (kapu + lezárt past_due nem zár), 44+51 kapcsolódó teszt zöld.

### Stripe webhook / Billingo

- [x] **W-L1 — Crash-ablak a `createDocument()` és a DB-írás közt → dupla NAV-számla**
  (`InvoiceGenerator.php`) — **JAVÍTVA (d40207c), re-auditban ellenőrizve:** `issuing_started_at`
  jelző a hívás ELŐTT perzisztálva; ha a retry jelzőt talál dokumentum-id nélkül, előbb
  Billingo-oldali visszakeresés a comment-horgonyra (`stripe_invoice_id:...`), pontos
  comment-egyezéssel — új kiállítás csak akkor, ha ott sincs nyom. 3 új teszt. **Dokumentált
  maradék-kockázat** (idempotency-key híján nem zárható nullára): (a) a visszakeresés a Billingo
  `/documents?query=` szabadszavas keresésére támaszkodik — ha az élesben nem indexeli a comment
  mezőt vagy a crash utáni első retrykor (≥60–90 mp) még nem friss, a régi dupla-kiállítás jön
  vissza (nem rosszabb, mint a fix előtt); (b) a 120s lock-TTL alatt most már akár 6 szekvenciális
  30s-os HTTP-hívás is futhat (list+partner+árfolyam+create+send) — elvi túlfutás, gyakorlatban
  továbbra sem reális.
- [x] **W-L2 — `fulfillment_date`/`due_date` UTC-ben számolódik, nem Europe/Budapest-ben**
  (`InvoiceGenerator.php:258-265`, `config/app.php` timezone=UTC) — budapesti 00:30-as fizetés egy
  nappal korábbi teljesítési dátumot kap, és az MNB-árfolyam-lookup is a tolt dátumot használja.
  AAM ÁFA mellett fiskális hatása nulla; 27%-ra váltásnál hóhatáron rossz ÁFA-időszak.
  **JAVÍTVA (2026-07-16):** a `paidAt()` a formázás előtt Europe/Budapest zónára vált — a
  teljesítési dátum és az árfolyam-nap is a magyar naptári nap. 2 új teszt (BillingoInvoiceTest,
  23:30 UTC → másnapi budapesti dátum + árfolyam-lookup dátuma).
- [ ] **W-L3 — Teljes Stripe invoice-payload (ügyfél-PII) a `jobs`/`failed_jobs` táblában**
  (`GenerateBillingoInvoice.php:33-36`) — a jobnak csak ~7 mező kell, mégis a teljes objektum
  (customer_email/name/address) szerializálódik és a `failed_jobs`-ban korlátlanul megmarad.
  Nem szivárgás (azonos DB-trust), de backup/log-shipping PII-felületet szélesít.
- [x] **W-L4 — `round($grossMinor/100, 2)` két tizedesjegyes valutát feltételez**
  (`InvoiceGenerator.php:200`; `:182` hiányzó currency → 'EUR' default) — HUF/EUR-ra helyes
  (tesztelt), zero-decimal valutánál (JPY) 1/100-ad összeg menne számlára. Ma alvó invariáns —
  komment vagy currency-whitelist elég. **JAVÍTVA (2026-07-16):** HUF/EUR-whitelist a
  `documentPayload()`-ban — ismeretlen valutánál RuntimeException (a job hangosan bukik,
  failed-job riasztással), rossz összegű számla nem születhet. Teszt: BillingoInvoiceTest (JPY).
- [ ] **W-L5 — Konkurencia-hézagok:** (a) egyazon user két első számlája (külön `in_...` lock)
  két `createPartner`-t futtathat → árva partner a Billingóban (kozmetikai);
  (b) két igazán párhuzamos `customer.subscription.created` mindegyike a másik commitja előtt
  futtathatja a `duplicateSubscriptionsFor()`-t → a dupla-előfizetés-háló nem fog, a riasztás
  elmarad (a dupla terhelés a következő ciklusnál derülne ki). Szekvenciálisan alaposan tesztelt,
  a konkurencia érdemben nem tesztelhető.
- [ ] **W-L7 — Refund és Billing-Portal „pause" kezeletlen** — `charge.refunded`-re nincs handler
  (néma 200), dashboardról adott refundnál nincs NAV-sztornó-emlékeztető; ha a Stripe portálban
  valaha engedélyeznék a „pause collection"-t, a paused előfizetés `status=active` marad →
  `valid()` igaz → ingyen jogosultság. Ops/folyamat-tétel, nem kódhiba.

### Player-token

- [x] **PL-L1 — Az `exchange` nem atomi: dupla token-kiadási race** (`PlayerPairingController.php:116-159`) —
  két konkurens poll ugyanazzal a `poll_secret`-tel mindkettő kaphat tokent; az „egyszer
  használatos" csak best-effort. Nem támadható (a 256-bites secret kell hozzá); következmény egy
  árva, 90 napig élő token. `whereKey(...)->delete() === 1` kapu a kiadás előtt lezárná.
  **JAVÍTVA (2026-07-16):** a token-kiadás előtt a sor törlése az atomi claim — csak a
  ténylegesen törlő kérés kap tokent, a vesztes 404-et. A meglévő single-use tesztek fedik.
- [ ] **PL-L2 — Párosítási kód eltéríthető a kódot megismerő harmadik fél által** (`:81-109`) —
  bármely bejelentkezett fiók jóváhagyhat bármely függő kódot; aki a 10 perces ablakban látja az
  áldozat kódját (screen share, válla fölött), a SAJÁT fiókjába hagyhatja jóvá → az áldozat playere
  csendben az ő fiókjához kötődik, a mentett szavak/AI-tartalom oda folyik. Az `isApproved()`-check
  → `forceFill()` ráadásul TOCTOU. Meglévő mitigációk: kód csak az eszközön látszik, 10 perc lejárat,
  az exchange-válasz mutatja a kötött fiók nevét/emailjét. Dokumentált maradék-kockázat.
- [ ] **PL-L3 — Device-flow phishing maradék: a jóváhagyó oldal semmit sem erősít meg jóváhagyás előtt**
  (`:72-75,103-108`) — a támadó a saját eszköze kódját mondatja be az áldozattal a `/player/connect`-en →
  90 napos player-token az áldozat fiókjához. Jó mitigációk megvannak (kézi kódbevitel, URL-prefill
  tiltva — tesztelt; auth+verified+CSRF); az eszköznév csak a siker-flashben látszik — egy jóváhagyás
  ELŐTTI megerősítő lépés az eszköznévvel tovább gyengítené. A device-flow minta velejárója.
- [x] **PL-L4 — A Settings eszközlista lejárt tokeneket is élőként mutat** (`SecurityController.php:57-72`) —
  nincs `expires_at`-szűrés; a napi `sanctum:prune-expired --hours=24`-ig (max ~2 nap) halott eszköz
  látszik csatlakoztatottnak. A guard maga helyesen elutasítja a lejárt tokent. Kozmetikai.
  **JAVÍTVA (2026-07-16):** `expires_at`-szűrés a `playerDevices()` lekérdezésében (null vagy
  jövőbeli). Teszt: SecurityTest (lejárt token nem jelenik meg).
- [x] **PL-L5 — Elavult komment: „1 éves" token-élettartam** (`routes/console.php:29-30`) — a valós
  érték 90 nap (`PlayerPairing::TOKEN_LIFETIME_DAYS`). Doc-rot; a prune-job helyes.
  **JAVÍTVA (2026-07-16):** komment 90 napra igazítva.
- [ ] **PL-L6 — Az importance-útvonalú szófelvétel nem könyvel streaket/achievementet**
  (`ExtensionController.php:443-445`) — lásd PL-M1 melléklelete.

---

## ✅ Ellenőrizve és RENDBEN találva (lefedettség)

**Fizetés/előfizetés:** kliens-oldali ár/plan-manipuláció kizárt (price ID csak configból, `{plan}`
hard-pinned); consent szerver-oldalon kikényszerítve; entitlement/billing oszlopok nem fillable-ök;
trial-farmolás blokkolva; ajándék-hónap→checkout trial-átvitel helyes; számla-letöltés IDOR/enumeráció
ellen védett (404 + throttle); past_due/incomplete/unpaid fail-closed; grace period hozzáférést tart;
fióktörlés minden élő előfizetést lemond és hibánál megszakad; minden Stripe-hívás
ApiErrorException-kezelt (nincs 500); számlázási mezők NAV-biztos validációja (kontrollkarakter,
adószám-regex, required_if/prohibited_if, country-whitelist) tesztelve.

**Webhook/Billingo:** aláírás-ellenőrzés + boot-time fail-closed guard (secret nélkül el sem indul,
tesztelt); CSRF-kivétel csak `stripe/*`; route-shadowing tiszta (route:list + route:cache ellenőrizve);
replay/duplikált delivery teljesen idempotens (unique `stripe_invoice_id` + cache-lock +
LockTimeoutException→retry + resume-on-partial-failure); ACK csak durable queue-írás után; nulla
összegű számla helyesen kihagyva; összeg-forrás `amount_paid` (fillér→Ft helyes, tesztelt); FX
fail-closed MNB-árfolyammal; partner-404 self-heal; e-mail-küldés külön idempotens; `customer.deleted`
megőrzi az ajándék-hónapot és lifetime/override flageket; jogosultság sosem fizetési eseményből,
csak subscription-állapotból származik.

**Player-token:** kód-entrópia matek rendben (31⁸ ≈ 8,5×10¹¹, approve 10/perc/user × 10 perc ablak →
~10⁻¹⁰ találati esély; exchange-hez 2²⁵⁶-os poll_secret kell); secretből csak SHA-256 hash tárolódik;
ability-szeparáció teljes (`auth:sanctum` SEHOL máshol nincs az appban, a player-token a web/extension
route-okon inert); Sanctum per-token `expires_at` a guardban kikényszerítve + napi prune; a visszavonás
szigorú `abilities === ['player']` szűréssel tényleg minden player-tokent elér (jól tesztelt);
throttle-kulcsolás per-IP/per-user helyes, keresztkimerítés kizárt; mass assignment és IDOR védett;
add-word/create-flashcard/update-status atomi, fail-closed keret-foglalással + refunddal; AI-végpontok
havi kerettel kapuzva (429 a Gemini-hívás előtt, tesztelt); ellopott token blast radiusa korlátozott
(nincs settings/billing/jelszó/token-kezelés).

**Plan-limitek (re-auditban külön ellenőrizve):** a limitek egyetlen forrása a `config/plans.php`;
konfig-teljességi teszt védi, hogy elgépelt kulcs ne váljon korlátlanná (`planLimit` fail-closed);
minden érvényesítési pont bejárva: flashcards/decks (atomi `reserveFlashcardSlots`/`DeckSlot`
minden create-ponton, TOCTOU-védett), text_analyses_per_day + extension_writes_per_day (atomi
increment, hiányzó cache-sornál fail-closed, refund hibaágon), quiz/cloze per-round plafon, books +
youtube_transcripts, ai_budget_micros (atomi reserve a Gemini-hívás ELŐTT, player-route-okon is
tesztelve). Downgrade (Pro→Free) azonnal érvényesül (a limit élőben a `currentPlan()`-ból számolódik,
a meglévő túllógó adat megmarad, új létrehozás blokkolva — szándékos). 44 dedikált limit-teszt zöld
(`PlanLimitTest` + `AiUsageTest` + `AiCacheTest`). Az egyetlen ismert rés a limit-szöveten továbbra
is a PL-M1 (importance-útvonal, üzleti döntésre vár).

**Tesztrés-lista (a per-finding jelzéseken túl):** nincs teszt lejárt player-token elutasítására;
nincs blast-radius regressziós teszt (player-token web/extension route-on); nincs out-of-order
webhook-teszt. (A past_due render-teszt és az ismeretlen-customer webhook-teszt a d40207c-vel pótolva.)
