# Fázis 2 — Pénz & előfizetés (end-to-end) · FÜGGETLEN ellenőrzés

> Készült: 2026-07-18 · multi-agent workflow (dimenziónkénti Opus-finderek + adverzariális Opus-verifikátorok).
> **Ez az ellenőrzés szándékosan függetlenül készült** a meglévő Fázis-2 riporttól és a korábbi todo/memória-jegyzetektől — a finderek NEM olvasták azokat. Cél: a fizetési, számlázási és előfizetés-életciklus felület független megerősítése/cáfolása.
> Szabály: **csak dokumentálás, kód nem módosult** (audit-no-fixes).

## Módszertan

- **Dimenzió-finderek** (Opus, párhuzamosan), séma-kényszerített leletformátummal, a pénz-útvonal négy dimenziója mentén: (1) Stripe-webhook idempotencia és sorrend, (2) előfizetés-életciklus és grace-period korrektség, (3) Billingo/NAV számlázás, (4) AI/flashcard limit-foglalás és versenyhelyzetek.
- **Adverzariális verifikáció:** minden nem-triviális lelet külön, cáfolásra promptolt Opus-verifikátort kapott, amely a kódból (kontroller, Cashier-vendor, migráció, teszt) igazolta vagy cáfolta a mechanizmust ÉS az állított kárhatást; a súlyosságot függetlenül újraértékelte.

## Összegzés

| Súlyosság | Darab |
|---|---|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 5 |

**Verdikt: nincs launch-blokkoló.** 0 HIGH · 0 MEDIUM. Az öt túlélő lelet mind LOW: szűk hibaablakok (fatal/SIGKILL, out-of-order webhook, tranziens DB-hiba, zár-timeout), egyik sem támadó által kiváltható, egyik sem okoz pénz-veszteséget, jogosultság-megkerülést vagy NAV-számla-duplikációt. A kettős védőháló — event-id idempotencia + napi `cashier:reconcile-subscriptions` + Billingo `firstOrCreate`/lock — a fizetési útvonal érdemi kockázatait lefedi.

## Leletek (súlyosság szerint csökkenő sorrendben)

Mind az öt lelet LOW. A verifikáció minden esetben **egy** adverzariális verifikátorral futott.

### F2-WH-1 — Idempotencia-foglalás a munka ELŐTT commitál; nem-Throwable folyamat-halál elveszett `invoice.payment_succeeded`-hez vezet
- **Fájl:** `app/Http/Controllers/StripeWebhookController.php:49-72` · **Súlyosság:** LOW
- **Forgatókönyv:** a `handleWebhook` a `stripe_webhook_events` sort `insertOrIgnore`-ral AZONNAL, körbezáró tranzakció nélkül commitálja (49-54.), és csak UTÁNA hívja a `parent::handleWebhook`-ot (66.). A rollback kizárólag `\Throwable`-re fut (67-71.: sor törlése + rethrow). Egy nem-Throwable folyamat-megszakadás — PHP fatal memory-exhaustion, `max_execution_time`-túllépés vagy FPM/worker SIGKILL — a foglalás-commit és a kezelő befejezése között otthagyja a „feldolgozott" `event_id`-t úgy, hogy az érdemi munka soha nem futott le. Az újraküldéskor a `reserved===0` ág (56-63.) néma 200-at ad. Subscription-eseményeknél a napi `cashier:reconcile-subscriptions` pótol, de egy elveszett `invoice.payment_succeeded` esetén a Billingo/NAV-számla SOHA nem generálódik (a `GenerateBillingoInvoice` dispatch a `handleInvoicePaymentSucceeded` 93. során, a foglalás után van), és semmi nem detektálja.
- **Verifikáció:** 1/1 **CONFIRMED** (high). A mechanizmus mind az öt láncszemben igazolt: nincs körbezáró tranzakció, a Throwable-catch nem fedi a fatal/SIGKILL esetet (helyes PHP-szemantika), a reconcile csak `Subscription::active()`-t egyeztet — invoice-ágra nincs backstop. Az ablak szűk (a commit és a durabilis `jobs`-INSERT között csak lokális DB-műveletek), a trigger ritka fatal, támadó által NEM kiváltható; hatás: egyetlen NAV/Billingo-számla detektálatlanul kimarad = könyvelési hézag, nem pénz/auth-veszteség. LOW helytálló.
- **Javasolt teendő:** a foglalást és az érdemi kezelőt egyetlen DB-tranzakcióba vonni, vagy a foglaló sort csak sikeres feldolgozás UTÁN beszúrni — így a fatal-megszakadás nem hagy „feldolgozott" jelet lefutatlan számlázás mellett.

### F2-WH-2 — Sorrenden kívüli `subscription.updated` egy még AKTÍV előfizetésen visszaállíthatja az `ends_at=null`-t (ütemezett lemondás helyi tükrének elvesztése)
- **Fájl:** `app/Http/Controllers/StripeWebhookController.php:201-226` · **Súlyosság:** LOW
- **Forgatókönyv:** a `handleCustomerSubscriptionUpdated` out-of-order védelme (206-223.) KIZÁRÓLAG akkor lép közbe, ha a helyi `stripe_status` már `canceled`. Grace-period alatt (`cancel_at_period_end=true` után) a helyi státusz még `active`, de az `ends_at` be van állítva. Ha ekkor egy KORÁBBI, `active` státuszú, cancel-flag NÉLKÜLI `subscription.updated` pillanatkép fut be az újabb frissítés UTÁN, a parent kezelő (vendor `WebhookController.php:177`: `ends_at = null`) kinullázza a lemondás helyi tükrét. Külön `evt_` id-k → az event-id idempotencia nem szűri; nincs időbélyeg/verzió-alapú sorrend-őr.
- **Verifikáció:** 1/1 **PARTIAL** (high). A **kód-hézag valós** — a guard szándékosan (W-M1, `SubscriptionResurrectionGuardTest`) csak a `canceled` sorokat védi, a grace-period `active` sort nem. **A leletben állított kárhatás viszont TÉVES:** az elavult esemény csak a HELYI tükröt írja át, a Stripe valós állapotán `cancel_at_period_end=true` MARAD (befelé jövő webhook sosem ír vissza Stripe-ra), így a periódus végén a Stripe lemond és `customer.subscription.deleted`-et küld, amit a parent `markAsCanceled()`-el helyben is korrigál → **nincs pénzveszteség, nincs tartós jogosultság-túllépés**, csak átmeneti/kozmetikai helyi eltérés a grace-period ablakban. Reachability alacsony (grace-period ütemezés + KORÁBBI cancel-flag nélküli pillanatkép out-of-order kézbesítése épp utána). LOW hardening.
- **Javasolt teendő:** az `updated`-guardot az esemény `created` időbélyege / állapotátmenet alapján bővíteni (ne csak a `canceled` irányra), hogy a grace-period alatti elavult pillanatkép ne nullázhassa az `ends_at`-ot.

### LIMIT-L1 — `reserveFlashcardSlots` lock-timeout kivétele nem kezelt a CSV/bulk-reverse úton (500, NEM limit-bypass)
- **Fájl:** `app/Http/Controllers/FlashcardCsvController.php:90-96` · **Súlyosság:** LOW
- **Forgatókönyv:** a `reserveFlashcardSlots()` `Cache::lock(...)->block(10, ...)`-t használ; ha a per-user zárat 10 mp alatt nem szerzi meg (nagyon nagy párhuzamos import-terhelés ugyanarra a userre), a `block()` `LockTimeoutException`-t DOB, nem `false`-t. Az `ExtensionController@createFlashcard` (280-298.) try/catch-csel kezeli és refundál, de a `FlashcardCsvController@import` (90.) és a `FlashcardCardController@bulkReverse` (213.) NEM fogja el — a kivétel 500-ba dől.
- **Verifikáció:** 1/1 **CONFIRMED** (high). A `LockTimeoutException` a callback (insert) ELŐTT dobódik (`vendor Lock.php:124`), tehát az insert NEM fut le, kártya nem jön létre, a keret NEM sérül — **biztonságilag nem bypass**, tisztán UX/robusztusság. A `bootstrap/app.php` `withExceptions()` closure üres → default handler = HTTP 500. Kihasználhatóság alacsony: tartós (>10 mp) önmagára irányuló zár-kontenció kell, nem cross-user támadás. LOW indokolt.
- **Javasolt teendő:** a CSV-import és bulk-reverse úton is elfogni a `LockTimeoutException`-t és érthető „próbáld újra" választ adni, mint az extension-úton (barátságtalan 500 helyett).

### WH-L1 — Párhuzamos azonos webhook-kézbesítés: a duplikátum korán 200-at kap, mielőtt az eredeti feldolgozás befejeződne (NEM tartós veszteség)
- **Fájl:** `app/Http/Controllers/StripeWebhookController.php:49-72` · **Súlyosság:** LOW
- **Forgatókönyv:** két IDENTIKUS kézbesítés (eredeti + Stripe-újraküldés) egyszerre érkezik ugyanarra az `evt_…` id-ra. A delivery-A `insertOrIgnore=1` → elkezdi a feldolgozást; a delivery-B `insertOrIgnore=0` → AZONNAL `successMethod()`-ot (200) ad, mielőtt A végzett. Ha A ezután kivételbe fut, törli a sort és újradob → a Stripe A-t később ÚJRA kézbesíti, újra beszúrja, újra feldolgozza. Rövid ablakban B már „feldolgozottnak" nyugtázta azt, amit A épp elrontott.
- **Verifikáció:** 1/1 **CONFIRMED** (high). A foglaló `insertOrIgnore` önálló, nem közös tranzakcióban a `parent::handleWebhook`-kal → a párhuzamos ablak valós. **A munka azonban NEM vész el tartósan:** a soft-fail a következő Stripe-retryn helyreáll, és mindkét mutáló ág önmagában idempotens (Billingo-számla `firstOrCreate` a unique `stripe_invoice_id`-ra + atomi lock, `InvoiceGenerator.php:74`; előfizetés-ág Cashier `updateOrCreate`/`firstOrNew`), így B korai 200-a nem nyugtáz el helyrehozhatatlan, félig-commitolt munkát. Üzletileg jelentéktelen. LOW pontos.
- **Javasolt teendő:** ha teljes szerializálás kell, a beszúrt-sor utáni parent feldolgozást is user/event-szintű lock alá vonni; a jelenlegi retry-lefedettség üzletileg elégséges, így ez opcionális.

### F2-BILL-1 — `sendDocument` újraküldés dupla e-mailt okozhat, ha a sikeres küldés után az `emailed_at` DB-mentés hibázik
- **Fájl:** `app/Services/Billingo/InvoiceGenerator.php:95-98` · **Súlyosság:** LOW
- **Forgatókönyv:** a `generateForStripeInvoice` a lock alatt ellenőriz: `if (isIssued && emailed_at === null)` → `client->sendDocument()` → `record->update(['emailed_at'])`. A `sendDocument` a Billingo `/documents/{id}/send`-re POST-ol (nincs idempotency-key, a Billingo v3-nak nincs is). Ha a send HTTP-hívás sikerül (partner megkapja az e-mailt), de az azt követő `emailed_at`-írás tranziens DB-hiba miatt elhasal, a job kivétellel bukik, a queue backoff után újrapróbál, és mivel `emailed_at` továbbra is null, a `sendDocument` MÁSODSZOR is kimegy → dupla számla-e-mail.
- **Verifikáció:** 1/1 **CONFIRMED** (high). A sorrend igazolt (előbb send, utána `emailed_at`-update), a `GenerateBillingoInvoice` job `$tries=4`, `$backoff=[60,300,900]` → újrapróbál. **Nincs pénz-/NAV-számla-duplikáció:** a dokumentum-kiállítás az `isIssued()`-őr és az `issuing_started_at`/`findIssuedDocument` crash-helyreállítás mögött van; a küldési útra viszont nincs analóg védelem, sem unique index. Kis valószínűségű (sikeres send + a közvetlenül rákövetkező lokális DB-írás bukása), alacsony hatású (e-mail, nem NAV-számla). LOW pontos.
- **Javasolt teendő:** a kézbesítés idempotenciáját erősíteni; a send-előtti `emailed_at`-jelölés a fordított kockázatot (elmaradt kézbesítés) nyitná, ezért inkább dedikált „küldés-kísérlet" jelölés vagy külön retry-védelem mérlegelendő.

## Megvizsgálva, nem valósnak bizonyult

Ebben a körben **egyetlen lelet sem lett teljesen cáfolva** — nem volt REFUTED verdikt. Egy lelet (F2-WH-2) PARTIAL minősítést kapott: a kód-mechanizmus valós, de a bejelentő által állított kárhatás téves (a Stripe-oldali önkorrekció miatt nincs bevétel/hozzáférés-hatás) — a lelet a Leletek szekcióban, LOW-ra korrigált indoklással szerepel.

## Lefedettség

**Bejárt dimenziók (4):**
1. **Stripe-webhook idempotencia és sorrend** — event-id foglalás (`stripe_webhook_events`), tranzakció-határok, Throwable-rollback, párhuzamos/out-of-order kézbesítés, `reconcile-subscriptions` mint backstop. (F2-WH-1, F2-WH-2, WH-L1)
2. **Előfizetés-életciklus és grace-period** — cancel/resume, `cancel_at_period_end`, `ends_at`-tükrözés, resurrection-guard, `customer.subscription.deleted` önkorrekció. (F2-WH-2)
3. **Billingo/NAV számlázás** — `firstOrCreate`/lock idempotencia, dokumentum-kiállítás vs. kézbesítés szétválasztása, `emailed_at` garancia, job-retry/backoff. (F2-BILL-1, F2-WH-1 számlázási ága)
4. **AI/flashcard limit-foglalás** — `reserveFlashcardSlots` per-user lock, `block()`-timeout kezelés, keret-refund a create-pontokon, limit-bypass hiánya. (LIMIT-L1)

**Hatókörön kívül (NEM járta be ez a kör):**
- Fázis 1 auth/session/jogosultsági felület (külön, korábbi audit — `last_audit/phase_1/`).
- Ops/infra: éles Stripe-kulcsok/webhook-secret rotáció, Billingo prod-profil és -kulcs, VPS cron/worker futása, `ADMIN_EMAIL` riasztás-cím helyessége, queue-worker felügyelet — kód-szinten nem ellenőrizhető.
- Kliens-oldali (React) fizetési UI korrektsége és a pricing-oldal ár-illesztése.
- Nem-fizetési domainek (Quiz, Cloze, Words, Text-analysis, Dashboard, Admin, Extension/Player funkcionális felülete) — külön dedikált auditokban.

## Megállás
A Fázis 2 független ellenőrzése kész: **0 HIGH · 0 MEDIUM · 5 LOW**, launch-blokkoló nincs. A PLAN további fázisai a jóváhagyásodra várnak — itt megállok.
