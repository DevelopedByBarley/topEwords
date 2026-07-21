# Fázis 2 (Pénz & Előfizetés) — Független Újra-Audit — Összesítő

> Készült: 2026-07-20 · HEAD `3983752` main, working tree tiszta.
> **Módszer:** multi-agent workflow — 4 dimenziónkénti finder párhuzamosan (webhook-idempotencia,
> stripe/* CSRF+aláírás, Free↔Pro limit-race/TOCTOU, Billingo/NAV számlázás) + verifikációs kör.
> A finderek **CSAK a PLAN.md Fázis 2 szövegét** kapták; a korábbi `last_audit/` riportokat NEM olvasták.
> **Csak dokumentálás** (audit-no-fixes) — kód nem módosult. 9 agent, 0 hiba, 615k token.

## Eredmény: 0 HIGH · 0 MEDIUM · 4 LOW (mind CONFIRMED, egyik sem emelt súly)

A `limit-race` (TOCTOU) dimenzió **teljesen tiszta** (0 lelet) — a `reserve*` Cache::lock foglalások
atomikusak, a napi írás / flashcard-slot / deck / AI-keret kapuk nem törhetők párhuzamos kéréssel.

| ID | Dimenzió | Végső súly | Fájl:sor | Állítás |
|---|---|---|---|---|
| WH-1 | Webhook idempotencia | LOW | `StripeWebhookController.php:49` | A foglalás (insertOrIgnore) nincs közös tranzakcióban a kezelővel: párhuzamos duplikátum azonnal 200-at nyugtáz; ha az eredeti utána elhasal és törli a foglalást, az esemény nyomtalanul elveszhet. |
| WH-2 | Webhook idempotencia | LOW | `StripeWebhookController.php:67` | A catch-ági foglalás-törlés csak a marker-sort vonja vissza, a kezelő már commitolt részmutációit nem — re-delivery-kor a kezelő módosított állapotra fut újra. |
| CSRF-1 | stripe/* CSRF + aláírás | LOW | `AppServiceProvider.php:101` | A boot-guard a `services.stripe.enabled`-hez van kötve, nem a route létezéséhez; `STRIPE_ENABLED=false` + üres secret mellett a webhook aláírás- és CSRF-ellenőrzés nélkül fogad payloadot. |
| BILL-1 | Billingo/NAV számlázás | LOW | `InvoiceGenerator.php:206` | A lock per-invoice, nem per-user; párhuzamos invoice (dupla-checkout) / crash esetén dupla vagy árva Billingo partner keletkezhet ugyanahhoz a userhez — pénzügyi hatás nélkül. |

## HIGH/MEDIUM részletek

**Nincs egyetlen túlélt HIGH vagy MEDIUM lelet sem.** Mind a 4 lelet LOW; a verifikáció egyiket sem
emelte magasabbra és egyiket sem cáfolta (4/4 CONFIRMED, high konfidencia, 0 PARTIAL, 0 REFUTED).

## LOW-leletek — részletes indoklás

### WH-1 — Foglalás nincs a kezelővel közös tranzakcióban
Ritka párhuzamos dupla-kézbesítés + egyidejű crash esetén esemény veszhet. **Öngyógyul:** a napi
`cashier:reconcile-subscriptions` a beragadt aktív ágat elkapja; a későbbi külön event-id-jű
sub-események (`invoice.payment_succeeded`/`updated`) `updateOrCreate`/`firstOrNew` útján pótolják a sort.
Egyetlen nem-recoverable maradék: elmaradt NAV-számla (a Stripe-terhelés Stripe-oldalon rögzített) →
compliance/ops-hézag, nem integritás-sérülés. **Nem támadó-triggerelhető** (a re-delivery-t a Stripe adja).

### WH-2 — Részmutáció-visszagörgetés hiánya
A Cashier-kezelők nem tranzakcionálisak; köztes crash → re-delivery → módosult soron újrafutás.
**Ma nincs kár:** a sub-frissítés snapshotból abszolút felülírással konvergál; az invoice-ág külön
(`billingo:issue:` lock + `stripe_invoice_id` unique + crash-guard) fut; nincs additív mellékhatás
(a `currentPlan()` származtatott, nem tárolt-inkrementált). **Valós jövőbeli kockázat-mag:** a helyesség
az egyenkénti kezelő-idempotencián múlik; a kód kommentje által nevesített jövőbeli kredit-jóváírás itt
duplán hatna. Dokumentációs/architektúrális megfigyelés.

### CSRF-1 — Boot-guard a stripe.enabled-hez kötve
`STRIPE_ENABLED=false` + üres secret mellett a webhook aláírás- és CSRF-ellenőrzés nélkül fogad payloadot.
Két egymást erősítő korlát tartja LOW-n: **(A)** a sérülékeny ablak pontosan az a deploy, ahol nincs
számlázás (checkout 404, nincs stripe_id, nincs mit ellopni), és számlázás bekapcsolásakor a guard
kikényszeríti a secretet — a sérülékeny állapot egybeesik a "nincs nyeremény" állapottal; **(B)** a mutáló
kezelők `getUserByStripeId` mögött no-op 200-at adnak ismeretlen customerre → per-áldozat `cus_...` titok
kellene, amit az app sehol nem publikál és nem enumerálható. A `StripeWebhookSecurityTest:35-39` szándékosan
rögzíti, hogy disabled+üres-secret mellett a boot sikerül.

### BILL-1 — Partner-létrehozás race
A lock per-invoice (`billingo:issue:{stripeInvoiceId}`), nem per-user; két párhuzamos invoice
(dupla-checkout, ismert W-L5 bemenet) vagy createPartner-utáni/save-előtti crash esetén két Billingo
partner jön létre, az egyik árva marad. **Pénzügyi hatás nincs** (`stripe_invoice_id` unique + a
dokumentum-crash-guard kizárja a dupla NAV-számlát); a kár kizárólag árva/dupla partner-rekord a Billingo
vevő-törzsben, egyetlen userre szűkítve — operátor takarítja. A jövőbeli számlák determinisztikusan mindig
az utoljára mentett partner-id-t használják (nincs folytatólagos rossz-partner számlázás).

## Cáfolt (REFUTED) leletek

Nincs. Mind a 4 finder-lelet verifikátori megerősítést kapott (4/4 CONFIRMED), 0 PARTIAL, 0 REFUTED.

## Végső verdikt

- **HIGH: 0 · MEDIUM: 0 · LOW: 4** (mind túlélt, mind CONFIRMED/high).
- **Go-live blokkoló: NINCS.**
- A Stripe-webhook, a Cashier-kezelők, a limitkapuk és a Billingo/NAV-számlázás **pénz- és
  jogosultság-integritása kód-oldalon tiszta**. A 4 maradék LOW mind szűk concurrency/crash-ablakban
  jelentkezik, öngyógyuló vagy pénzmentes következménnyel (elmaradt NAV-számla, illetve árva Billingo-partner)
  → dokumentálandó/ops-jellegű maradék, nem indulás-blokkoló.
