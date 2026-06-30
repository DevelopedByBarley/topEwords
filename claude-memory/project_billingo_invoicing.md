---
name: project-billingo-invoicing
description: "Billingo v3 invoicing integration — architecture, env vars, and the test-profile gotcha"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b1306c5-20ab-4d91-bc36-a1811f3bac80
---

NAV-kompatibilis számlázás Billingo v3 REST API-val, a sikeres Stripe fizetésre (`invoice.payment_succeeded` webhook) kapcsolva. Why: a Stripe önmagában nem ad magyar számlát; a user már használ Számlázz.hu-t könyvelésre, de a SaaS-bevételek automatizálásához a Billingo modern REST API-ja jobb. Két számlázó párhuzamosan futhat (külön sorszámtartomány), nincs NAV-ütközés.

**Architektúra** (réteges, natív HTTP — nem SDK, hogy mockolható és függőségmentes legyen):
- `config/services.php` → `billingo` blokk
- `App\Services\Billingo\BillingoClient` (vékony Http kliens, AppServiceProvider köti az api_key-jel)
- `App\Services\Billingo\InvoiceGenerator` (leképezés + idempotencia)
- `App\Jobs\GenerateBillingoInvoice` (tries=4, backoff)
- `App\Models\BillingoInvoice` + `billingo_invoices` tábla; `users.billingo_partner_id`
- `StripeWebhookController::handleInvoicePaymentSucceeded` indítja a számlázást
- Tesztek: `tests/Feature/BillingoInvoiceTest.php`

**GOTCHA — nincs queue worker a tárhelyen:** a jelenlegi production tárhelyen NEM fut állandó `queue:work` (és a user nem tud élesben parancsot futtatni). Ezért a webhook `dispatchSync()`-kel SZINKRON számláz (nem `dispatch()`), a kérésen belül. Hiba esetén nem-200 → Stripe újraküld → idempotencia véd. Ha lesz Ploi/VPS futó workerrel, `dispatchSync` → `dispatch` az egysoros visszaállítás.

**GOTCHA — webhook eseménylista:** a Stripe Dashboard végpontján KÉZZEL kell felvenni az `invoice.payment_succeeded`-et (+ Cashier defaultok). Ennek hiánya volt az eredeti „semmi nem kerül a jobba" ok — a subscription létrejött (`customer.subscription.created` ki volt pipálva), de a számlázó esemény el sem indult.

**Env-ek:** `BILLINGO_ENABLED`, `BILLINGO_API_KEY`, `BILLINGO_BLOCK_ID` (0 = első tömb auto), `BILLINGO_VAT` (alap `AAM`, configból váltható), `BILLINGO_ITEM_NAME`.

**Idempotencia + konkurencia:** `billingo_invoices.stripe_invoice_id` unique + firstOrCreate adja az egy-sor garanciát, DE ez önmagában NEM véd a párhuzamos `createDocument`-hívástól (két egyidejű webhook-kézbesítés mindkettő láthatja `isIssued()===false`-nak → két NAV-számla). Ezért a kiállítás `Cache::lock("billingo:issue:{stripe_invoice_id}", 120)` atomi zár mögött fut (cache driver `database` → támogatja); a zárat meg nem kapó futás `null`-t ad vissza. Reziduális: a „Billingo-oldalon sikeres, de ACK elveszett" eset nem védett — idempotency-key kellene hozzá (queue-átállásra). Partner: egyszer jön létre (`users.billingo_partner_id`), de MINDEN számlázáskor `PUT /partners/{id}`-vel frissül a friss számlázási adatra (B5). Elbukott job: `failed()` → `report()` (B4).

**GOTCHA — teszt profil:** a user jelenleg Billingo *fejlesztői teszt profilban* van. Ez NEM állítható élesre. Production-höz ÚJ profil kell → új `BILLINGO_API_KEY` ÉS új `BILLINGO_BLOCK_ID`. A kód nem változik, csak a `.env`.

**Pénznem — HUF (döntés 2026-06-29):** a számlázás HUF-ban megy (a Billingo-fiók alappénzneme HUF), mert egyszerűbb és NAV-os magyar üzletnél természetes. Kell hozzá: Stripe HUF Price-ok (új ID-k a `.env`-be) + `CASHIER_CURRENCY=huf`, `CASHIER_CURRENCY_LOCALE=hu_HU`. A Stripe a HUF-ot 2 tizedesként kezeli (összeg 100 többszöröse, pl. 299000 = 2990 Ft), ezért az `amount_paid/100` matek HELYES marad — NEM olyan, mint a JPY (nulla-decimális).

**conversion_rate (KRITIKUS, ezért bukott élesen 422-vel):** a Billingo NEM konvertál automatikusan — devizás (nem HUF) számlánál a `conversion_rate` KÖTELEZŐ, különben `422 Validation Failed: conversion_rate required`. A korábbi „auto MNB-átváltás" feltételezés TÉVES volt. Megoldás a kódban: `InvoiceGenerator::documentPayload` HUF-nál nem küld conversion_rate-et; nem-HUF-nál a `BillingoClient::exchangeRate($from,$to,$date)` lekéri a Billingo `GET /v3/currencies?from=&to=&date=` végpontjáról a teljesítés-napi MNB-árfolyamot (válasz mező: `conversation_rate` — Billingo elírása), és ráteszi. Így HUF most működik, EUR/külföld pedig már jövőbiztos.

**Külföldi fizetés megnyitása — a currency már megoldott (guardolt kód), a valódi nehézség az ÁFA/NAV:** EU B2C → OSS (vevő-ország ÁFA-kulcsa), EU B2B érvényes adószámmal → reverse charge 0%, AAM határon át jellemzően nem vihető. A kód ma EGY fix `BILLINGO_VAT`-ot használ (csak hazai eset). Külföld = külön fázis, ÁFA-logikával kezdve.

Kapcsolódó: [[project-extension-paywall]] (a fizetős funkciók iránya).
