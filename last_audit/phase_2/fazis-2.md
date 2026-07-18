# Fázis 2 — Pénz & előfizetés end-to-end (audit-riport)

> Készült: 2026-07-17 · a `last_audit/PLAN.md` **Fázis 2**-jének kizárólagos lefuttatása.
> Mód: **multi-agent workflow** — dimenziónkénti finderek (Opus), majd adverzariális (cáfolásra promptolt) verifikáció.
> **Csak dokumentálás — kód NEM módosult** (audit-no-fixes szabály).

## Módszertan

- **4 finder**, egyenként egy dimenzióra (webhook / CSRF / limit-race / Billingo), mind **Opus** modellen, séma-kényszerített leletformátummal (fájl, sor, súlyosság, forgatókönyv, bizonyíték, kihasználhatóság).
- **Verifikáció:** minden leletre adverzariális, cáfolásra promptolt verifikátor, amely a kódot ténylegesen újraolvassa. A terv szerint HIGH/MEDIUM-gyanús leletre 2–3 független verifikátor, LOW-ra 1 kör futott volna — **a finderek egyetlen HIGH/MEDIUM leletet sem emeltek** (mind LOW), így minden lelet 1 körös verifikációt kapott. (Ha bármely finder HIGH/MEDIUM-et jelöl, automatikusan 3-szavazatos cáfoló panel indult volna rá.)
- 13 agent összesen, 0 hiba, ~747k token.

## Összegzés

| | Darab |
|---|---|
| Összes lelet | 9 |
| **Megerősített** (upheld) | **5** — mind **LOW** |
| Cáfolt (refuted / INVALID) | 4 |
| **HIGH** | **0** |
| **MEDIUM** | **0** |

**Verdikt: NINCS launch-blokkoló találat.** A pénz/előfizetés kritikus mutáló ágai (NAV-számla, előfizetés-állapot, flashcard-keret, AI-keret) egyenként idempotensek, illetve atomi foglalással védettek. A korábbi javítások (W-M1 sub-resurrect guard, DuplicateSubscription lock, refund-riasztás, InvoiceGenerator unique-kulcs + Cache::lock) a helyükön vannak és helyesen működnek. Ami maradt: 5 defenzív / ops-függő LOW, egyik sem reálisan kihasználható támadóval.

---

## Megerősített leletek (5 × LOW)

### F2-W-1 — Nincs központi Stripe event-id idempotencia-guard (LOW)
- **Fájl:** [app/Http/Controllers/StripeWebhookController.php:34](app/Http/Controllers/StripeWebhookController.php#L34)
- **Dimenzió:** webhook · **Verdikt:** megerősítve (1/1 nem cáfolta, high)
- **Forgatókönyv:** A Stripe legalább-egyszer kézbesít; timeout/5xx után ugyanazt az `evt_...`-t újraküldi. A Cashier `handleWebhook` minden kézbesítést frissen dolgoz fel, nincs feldolgozott-event-id tábla/cache (grep `stripe_event|processed_event|idempoten` → 0 találat az app-ban).
- **Miért csak LOW:** A **két tényleges mutáló mellékhatás külön-külön idempotens** — (a) NAV-számla: `InvoiceGenerator` unique `stripe_invoice_id` + `Cache::lock`; (b) előfizetés-állapot: Cashier `updateOrCreate`/`firstOrNew` a `stripe_id`-re + a resurrection-guard + dup-cleanup lock. Dupla kézbesítés MA nem okoz dupla számlát vagy állapot-korrupciót. A refund/ismeretlen-customer ágak csak `Log::critical`-t hívnak → replaykor legfeljebb egy plusz log-sor.
- **Maradvány-kockázat:** bármely **jövőbeli** nem-idempotens handler (metered-usage könyvelés, kredit-jóváírás, e-mail) dupla kézbesítéskor duplán futna. Egy központi event-id dedup egyetlen ponton zárná ezt le. Előre mutató, defenzív.

### F2-W-3 — A feltámasztás-guard egyirányú: elveszett `deleted` esemény után feléledhet a sub (LOW)
- **Fájl:** [app/Http/Controllers/StripeWebhookController.php:150](app/Http/Controllers/StripeWebhookController.php#L150)
- **Dimenzió:** webhook · **Verdikt:** megerősítve (1/1 nem cáfolta, high)
- **Forgatókönyv:** A guard (155–172) csak akkor dob el egy nem-canceled `updated` eseményt, ha a helyi sor **már** `stripe_status=canceled`. Ha a `customer.subscription.deleted` **véglegesen elveszik** (Stripe ~3 nap után feladja a retry-t, vagy az endpoint hosszan hibás/letiltott), a helyi sor sosem lesz canceled — így egy azt követő elavult `updated(active)` pillanatkép a parent ágon `stripe_status=active, ends_at=null`-ra állít, és a guard nem szól közbe (`isLocallyCanceled=false`). Halott Stripe-sub → tartós helyi Pro.
- **Miért csak LOW:** A `deleted` esemény **teljes** elvesztése ritka és nem felhasználó által kiváltható. Nincs periodikus reconcile/sync a kódban (`routes/console.php` csak queue-alert/monitor/sanctum-prune), így a drift végleges deleted-vesztésnél nem korrigálódik. Defenzív hardening: periodikus Stripe-reconcile.

### F2-LIMITS-L2 — `AiUsageService::reserve()` per-becslés overshoot konkurens hívásnál (LOW)
- **Fájl:** [app/Services/AiUsageService.php:46](app/Services/AiUsageService.php#L46)
- **Dimenzió:** limit-race · **Verdikt:** megerősítve (1/1 nem cáfolta, high)
- **Forgatókönyv:** A `where('ai_credits_used','<',$limit)->increment($estimate)` a **nyers** limitre szűr (nem limit-mínusz-estimate-re). A klasszikus read-then-write TOCTOU-t az egyetlen atomi UPDATE lezárja, de N párhuzamos UPDATE a keret pontos határán mind átcsúszhat, mielőtt a saját becslését rátölti → összesen `limit + (N-1)×becslés` költhető, majd a `settle()` a valós költségre igazít.
- **Miért csak LOW:** A túllépés felső korlátja aprócska — szó-lookupnál ~pár száz mikro (`<$0.001`), a `ta-ai` throttle (30/perc) + circuit breaker szűkíti az ablakot, a `settle()` korrigál. Nincs teljes keret-megkerülés, nincs jogosulatlan Pro. Reális pénzügyi kár elhanyagolható; a viselkedés kód-szinten tudatos.

### F2-BILL-L1 — Billingo HTTP-hívásoknak nincs explicit timeout-ja (LOW)
- **Fájl:** [app/Services/Billingo/BillingoClient.php:145](app/Services/Billingo/BillingoClient.php#L145)
- **Dimenzió:** billingo · **Verdikt:** megerősítve (1/1 nem cáfolta, high)
- **Forgatókönyv:** A `request()` nem állít `->timeout()`/`->connectTimeout()`-ot → a Guzzle defaultra hagyatkozik. Ha a `createDocument` a NAV-számlát **már kiadta** a Billingóban, de a válasz lassan/soha nem érkezik, és a worker hard-killeli a folyamatot a `finally { $lock->release() }` ELŐTT, a lock a 120s TTL-ig beragad. A retry az `issuing_started_at`-ot látva a `findIssuedDocument()`-re fut, ami a Billingo **szabadszavas** keresésétől függ (`comment=stripe_invoice_id`); ha az index eventual-consistency miatt késik, `null`-t ad, és a retry **második NAV-számlát** állít ki (kézi sztornó).
- **Miért csak LOW:** A crash-recovery védelem (`issuing_started_at` + `findIssuedDocument` + lock) a helyén van; a lelet a **maradvány**-ablakot azonosítja, amit ez nem tud teljesen bezárni (a Billingo v3-nak nincs idempotency-key headere — a kód maga elismeri: „az ablak így nem tűnik el teljesen"). Nem támadó, keskeny, ops-függő fail-mód. **Hardening:** explicit HTTP-timeout + a `worker --timeout > lock-TTL(120s) > retry_after(90s)` invariáns rögzítése a deploy-konfigban.

### F2-BILL-L2 — Számla-fail riasztások egyetlen globális órás throttle-kulcson osztoznak (LOW)
- **Fájl:** [app/Listeners/AlertAdminOfLoggedError.php:42](app/Listeners/AlertAdminOfLoggedError.php#L42)
- **Dimenzió:** billingo (cross-dim: monitoring) · **Verdikt:** megerősítve (1/1 nem cáfolta, high)
- **Forgatókönyv:** A pénz/számla fail-módok mind error+ szinten logolnak: ismeretlen-customer money-loss ([StripeWebhookController.php:50](app/Http/Controllers/StripeWebhookController.php#L50)), refund NAV-sztornó emlékeztető (:86), duplikált előfizetés (:229), `GenerateBillingoInvoice::failed()` report()-ja. Az `AlertAdminOfLoggedError` **egyetlen** konstans cache-kulcsot használ (`error-monitoring:alerted`, órás), esemény-diszkriminátor nélkül, és a `Cache::add` a küldés ELŐTT zárja az órás keretet. Ha egy órán belül **két különböző** kritikus pénzügyi esemény történik, csak az **első** ad admin-levelet; a másodikat elnyeli — csak a `laravel.log`-ban marad.
- **Miért csak LOW:** Nem közvetlen pénzügyi kár, hanem **észlelési hézag**. A job-bukásokra (`GenerateBillingoInvoice failed`) a `MonitorFailedJobs` külön, id-alapú, throttle-független második biztosítékot ad. A három `Log::critical` **pénz-ág** (ismeretlen customer, refund, dup-sub) viszont **nem** job-bukás, azokra a throttle-ablakon belül nincs második nyom az e-mailen kívül. Minden ág logol, így a nyom sosem vész el teljesen.

---

## Cáfolt leletek (4 × INVALID)

### F2-W-2 — charge.refunded nem downgrade-el (feltárt, de HELYES viselkedés) — CÁFOLVA
- **Fájl:** [app/Http/Controllers/StripeWebhookController.php:80](app/Http/Controllers/StripeWebhookController.php#L80)
- **Miért cáfolt:** A kód-magatartás pontos (a refund csak riaszt, nem vált Pro-t), de **nem hézag**: (a) kizárólag **admin-akcióval** (Stripe dashboard refund) váltható ki, nincs önkiszolgáló Pro-szerzés/privilégium-eszkaláció; (b) a „Pro marad" a **helyes** viselkedés — ha az admin refundol egy charge-ot DE nem mondja le a subscription-t, az szándékosan azt fejezi ki, hogy az előfizetés maradjon élő (goodwill). Downgrade-hez a Stripe „Cancel subscription" küld `deleted`/`updated`-et, amit a rendszer helyesen kezel; (c) automatikus downgrade charge-refundra **hibás** lenne (részleges/arányos refund nem indokol teljes downgrade-et — ez a W-L7 döntés jó oka); (d) nincs tartós pénz-kár (élő sub → Stripe a köv. ciklusban újra terhel).

### F2-W-4 — `handleCustomerSubscriptionDeleted` nincs override-olva — CÁFOLVA
- **Fájl:** [app/Http/Controllers/StripeWebhookController.php:98](app/Http/Controllers/StripeWebhookController.php#L98)
- **Miért cáfolt:** A `deleted` ágon a Cashier ős fut (`markAsCanceled` a payload id-jére szűrve) — **scoped és idempotens**, ismételt deleted = no-op. A duplikátum-takarítás a `created` ágon való futása helyes: a cancellation **sosem növeli** az aktív sorok számát, ezért a deleted ágra de-dup logikát tenni értelmetlen. Tranziens extra nem-canceled sor **nem** ad többlet-jogosultságot (`activeSubscription()` az első `valid()`-ot adja, `currentPlan()` csak premium/free-t különböztet). A dupla-terhelés a `created` ágon guardolt + riasztott (`DuplicateSubscriptionCleanupTest` fedi). Tudatos, helyes tervezés.

### F2-CSRF-1 — Aláírt payload replay 300s-en belül (log-zaj) — CÁFOLVA
- **Fájl:** [app/Http/Controllers/StripeWebhookController.php:80](app/Http/Controllers/StripeWebhookController.php#L80)
- **Miért cáfolt:** A lelet egyetlen konkrét kárvektora (riasztás-elárasztás) dől: az `AlertAdminOfLoggedError` **globális órás throttle**-ja miatt bármennyi replaykor is legfeljebb óránként egy levél megy ki → e-mail-elárasztás fizikailag lehetetlen; marad néhány plusz `laravel.log` sor (triviális). Pénzügyi hatás nincs (számla + sub idempotens; a refund/ismeretlen-customer ág csak logol). Az előfeltétel (érvényes aláírt törzs + `Stripe-Signature` megszerzése) maga is titok-/log-szivárgást vagy MITM-et feltételez — a webhook secret nélkül forgery lehetetlen. **CSRF-oldali fő kérdés tisztázva:** az aláírás-verifikáció megkerülhetetlen, a `stripe/*` wildcard alatt a webhookon kívül nincs más CSRF-védelem nélküli mutáló route.

### F2-LIMITS-L1 — Extension-írás keret Origin-fejléc alapú best-effort attribúciója — CÁFOLVA
- **Fájl:** [app/Concerns/TogglesWordStatus.php:43](app/Concerns/TogglesWordStatus.php#L43)
- **Miért cáfolt:** A leírás pontos (Origin nélküli hívás nem fogyasztja az `extension_writes_per_day` keretet a megosztott web-végpontokon), de **nincs fizetős kapu mögötte**: a webes szó-státusz és saját-szó felvitel szándékosan **ingyenes, korlátlan** alapfunkció (nincs `words_per_day`/`custom_words` plan-limit a `config/plans.php`-ben). A megkerülhető `extension_writes_per_day` (20) puszta **visszaélés-limit**, ami mögött route-throttle (`60/perc`) áll; a dedikált extension/player végpontok viszont **unconditional** `reserveExtensionWrite()` + `throttle:20,1`. A valódi fizetős kapu (flashcard-keret 50) teljesen **független** az Origin-attribúciótól és `User::reserveFlashcardSlots()` per-user `Cache::lock`-kal atomi módon védett minden létrehozási ponton. Nincs pénz-kár, nincs jogosulatlan Pro. (F1-L2 / PL-M1 döntésekkel konzisztens.)

---

## Fázis 2 tervpontok — lefedettség

| Tervpont (PLAN.md 61–65. sor) | Eredmény |
|---|---|
| Webhook-idempotencia + out-of-order (W-M1/W-L5 regresszió) | Regressziók **állnak**; F2-W-1 (központi dedup hiánya) + F2-W-3 (elveszett-deleted feléledés) — mindkettő LOW, defenzív |
| `stripe/*` CSRF-kizárás helyessége (aláírás = egyetlen védelem, megkerülhetetlen-e) | **Megkerülhetetlen** — a wildcard alatt a webhook az egyetlen CSRF-nélküli mutáló route; F2-CSRF-1 replay-vektor cáfolva |
| Free↔Pro átmenetek minden limitkapunál — TOCTOU/race | Flashcard-slot + AI-keret **atomi foglalással védett**; csak F2-LIMITS-L2 per-becslés overshoot (elhanyagolható) marad |
| Billingo/NAV fail-módok + job-idempotencia + PII a payloadban | Idempotencia (unique kulcs + lock + crash-guard) **áll**; **PII-szivárgás nem talált**; F2-BILL-L1 (timeout) + F2-BILL-L2 (riasztás-throttle) LOW |

---

## Ajánlott (nem kötelező, LOW) hardening — a jóváhagyásod után, ha kéred

1. **F2-BILL-L1** — explicit `->timeout()`/`->connectTimeout()` a `BillingoClient::request()`-ben, és a deploy-konfigban rögzíteni a `worker --timeout > 120s > 90s` invariánst *(a legkonkrétabb, legkisebb kockázatú fix)*.
2. **F2-W-3** — periodikus Stripe-reconcile (pl. `cashier:sync` jellegű ütemezett parancs) az elveszett-`deleted` drift ellen.
3. **F2-BILL-L2** — a riasztás-throttle kulcsába esemény-diszkriminátor (level/üzenet-hash), hogy egy órán belül több különböző pénz-esemény is átmenjen.
4. **F2-W-1** — központi feldolgozott-event-id dedup (jövőbeli nem-idempotens handlerek védelmére).
5. **F2-LIMITS-L2** — `where('ai_credits_used','<', limit - estimate)` a per-becslés overshoot bezárására.

> **Emlékeztető:** e riport csak dokumentál. A fenti fixek egyike sem került alkalmazásra. **A többi fázis (3–8) NEM indult el — a jóváhagyásodra várok.**
