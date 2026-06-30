# Fizetés – production teendők és figyelmeztetések

Ez a lista a fizetési/számlázási folyamat élesítéséhez tartozó nyitott pontokat
gyűjti össze. A kód biztonsági szempontból rendben van; az alábbiak az
üzemeltetési és env-szintű teendők.

Utolsó frissítés: 2026-06-29

---

## 1. ⚠️ KRITIKUS — `STRIPE_WEBHOOK_SECRET` az éles szerveren

A webhook hitelességét a Cashier aláírás-ellenőrzése védi. Ez **csak akkor
működik**, ha az éles `.env`-ben a `STRIPE_WEBHOOK_SECRET` az **éles
webhook-endpoint** titka (nem a Stripe CLI-é, és nem üres).

**Veszély, ha üres/rossz:** a Cashier nem ellenőrzi az aláírást, így bárki
küldhetne hamis `invoice.payment_succeeded` eseményt → felesleges Billingo-számla.

**Ellenőrzés:**
- Stripe Dashboard → Developers → Webhooks → az éles endpoint **"Signing secret"**-je
- egyezzen az éles `.env` `STRIPE_WEBHOOK_SECRET` értékével.

Ez az egyetlen pont, amit kódból nem lehet garantálni — egy env-érték a szerveren.

---

## 2. Job queue / worker bevezetése (megbízhatóság)

Jelenleg a Billingo-számlázás **szinkron** fut a webhookban (`dispatchSync`),
mert nincs folyamatosan futó queue worker. Ez működik és biztonságos
(idempotens, unique `stripe_invoice_id`), de:

- ha a Billingo lassú vagy leáll, a webhook-válasz is elhúzódik;
- a Stripe ~20 mp után **timeoutol és újraküldi** az eseményt → felesleges
  terhelés, késleltetett számla.

**Cél (worker mellett):** a webhook azonnal 200-at ad, a számlázás a háttérben
fut és önállóan újrapróbálkozik.

**Mikor:** a Ploi/VPS átálláskor, ahol lesz tartós `queue:work`.
**Teendő akkor:** a `StripeWebhookController::handleInvoicePaymentSucceeded`-ben
a `dispatchSync()` visszaváltása `dispatch()`-re + a worker beüzemelése
(`php artisan queue:work`, supervisor/Ploi daemon).

---

## 3. Webhook-dedup deploy élesre

A `handleCustomerSubscriptionCreated` tartalmaz egy védőhálót, ami a párhuzamos
(dupla) aktív előfizetéseket automatikusan lemondja. A tesztek alapján élesen ez
a kód **még nem futott** — érdemes kideployolni.

**Megjegyzés:** a dedup csak a DB-ben lévő előfizetéseket nézi. Ha kézzel törölsz
ki előfizetést a DB-ből, a Stripe oldalán megmaradó előfizetést nem fogja meg
(ez okozta a korábbi dupla esetet — nem kód-hiba, hanem kézi DB-törlés
mellékterméke).

---

## Háttér / már elvégzett javítások

- **Konkurens kiállítás elleni atomi zár (B2):** a számlázás `Cache::lock("billingo:issue:{stripe_invoice_id}")` mögött fut, így a párhuzamos webhook-kézbesítés (Stripe-újraküldés lassú Billingo alatt) NEM állít ki két NAV-számlát. A unique kulcs csak a duplikált sort fogta — a duplikált `createDocument`-hívást a zár előzi meg. (Teszttel fedve.)
- **Partner-adat frissítés számlázáskor (B5):** ha a felhasználó módosítja a számlázási adatait, a meglévő Billingo-partnert a következő számlázáskor `PUT /partners/{id}` frissíti — nem keletkezik elavult partneradatú számla és nem duplikálódik a partner. (Teszttel fedve.)
- **Véglegesen elbukott számla nyoma (B4):** a `GenerateBillingoInvoice::failed()` minden próba kimerülése után `report()`-ol (Sentry/log), hogy egy kiállítatlan NAV-számla ne maradjon észrevétlen — főleg az async (queue) átállás után fontos.
- **Reziduális kockázat (queue-átállásra):** ha a Billingo `createDocument` a Billingo oldalán SIKERES, de a válasz/ACK elveszik (hálózat), az újrapróba egy második dokumentumot hozhat létre. A zár az egyidejűséget oldja, ezt nem. Tartós retry mellett (worker) érdemes ellenőrizni, támogat-e a Billingo idempotency-key fejlécet, és ráakasztani a `stripe_invoice_id`-t.
- **Checkout hardening:** a `PricingController`-ben a Stripe API-hibák
  (`ApiErrorException`) el vannak kapva a swap- és a checkout-ágon is →
  nincs 500 és nincs árva ügyfél kezeletlen kivételből. (Teszttel fedve.)
- **0 összegű számla:** a trial-induló (€0) `invoice.payment_succeeded`-re nem
  készül Billingo-számla (`InvoiceGenerator` összeg-guard). (Teszttel fedve.)
- **Teszt-adatok:** a Stripe teszt-tranzakciók (charge, kifizetett számla) **nem
  törölhetők** egyesével; csak a Dashboard "Delete all test data" (egész
  teszt-fiókot wipe-ol, az árakat is → újra kell hozni + `.env` frissítés).
