# Verifikációs napló — Fázis 2 audit, 2026-07-26

Csak azokat a leleteket részletezi, ahol **érdemi súlyosság-vita** volt (finder-súly ≠ végső súly),
plusz azt az egy esetet, ahol egy **verifikátor tényállítását kellett korrigálni**.

## Módszertan

- **HIGH/MEDIUM-gyanús lelet** → 2 független verifikátor, **eltérő lencsével**, kifejezetten **cáfolásra** promptolva.
  Bizonytalanság esetén a default `refuted=true`. Többségi szavazat dönt.
- **LOW** → egykörös verifikáció.
- A finderek a PLAN Fázis 2 szövegét kapták; a korábbi `last_audit/` verdikteket **nem** olvasták (független ítélet).
- Az auditor (koordinátor) minden súlyosság-döntő tényállítást **saját olvasással visszaellenőrzött** — két helyen ez
  eredményt módosított (lásd BILL-1 korrekció és WH-1 megerősítés).

---

## 1. WH-1 — grace-period `ends_at` nullázás · **LOW → INFO**

**Verifikációs út:** Finder A: LOW → V1 (kihasználhatóság): INFO → V2 (blast-radius): INFO → **végső: INFO**

| Lencse | Verdikt | Kulcsérv |
|---|---|---|
| **V1 — kihasználhatóság / triggerelhetőség** | PLAUSIBLE / INFO | A „re-delivery" ág **CÁFOLVA** (az event-id dedupe miatt már feldolgozott event nem éri el a parentet) → csak a „késleltetett első kézbesítés" ág áll. **Döntő:** a legitim portál-resume és a stale event payloadja **bit-szinten azonos**, és a portál-resume-nak a webhook az **egyetlen** helyi írási csatornája → a guard kiterjesztése **eltörné a resume-flow-t** (Stripe számláz, app Free-re esik) = pénzhatású, nem öngyógyuló hiba. A „javítás" **negatív értékű**. |
| **V2 — valós blast-radius** | PLAUSIBLE / INFO | Az entitlement **azonos**: `valid()` = `active() || onTrial() || onGracePeriod()`; grace-periodban az `onGracePeriod()`, `ends_at=null`-nál az `active()` igaz → **mindkettő `true`**, nulla extra jog. A periódus végi `deleted` → `markAsCanceled()` **feltétel nélkül** zár → nincs „tartós ingyen prémium". Az újra-lemondás **öngyógyít**. |

**Miért változott a súlyosság:** a finder a hatást „a lemondás helyben eltűnik" formában írta le, ami entitlement-szivárgást sugall.
Mindkét verifikátor kimutatta, hogy **entitlement-hatás nincs** és **pénzhatás sincs** — a maradék kizárólag a Settings-oldal
félrevezető szövege („Aktív prémium" a „Lemondva — …-ig" helyett) egy legfeljebb egy számlázási periódusig élő ablakban.
Súlyosbító körülmény nélkül ez a séma-kényszer szerint **INFO** („ha nem tudsz konkrét bemenet→kár utat leírni, az INFO").

**Auditori megerősítés (saját olvasás):** a Cashier `resume()` (`vendor/…/Subscription.php:1155-1167`) **maga is** nullázza az
`ends_at`-et → az `ends_at=null` a `cancel_at_period_end=false` snapshotra **szándékolt szemantika**, nem hiba.
Ez V1 „szükségszerű tervezési kompromisszum" érvét önállóan is megerősíti.
Emellett visszaellenőriztem, hogy a `ReconcileStripeSubscriptions` **valóban nem** ír `ends_at`-et (csak a lezárási ágon) —
azaz a finder egyetlen erős pontja (nincs öngyógyítás a reconcile-ból) **helyes**, csak nem elég a LOW-hoz.

**⚠️ Feltételes eszkaláció rögzítve:** ma a `PricingController:109` `stripe_price === $priceId` guard zárja a `swap()`-ot
(egyetlen fizetős ár van). **Egy második fizetős ár bevezetése** esetén a rossz állapot a swap-ágra vezetne, ami
`cancel_at_period_end=false`-t küldene a Stripe-nak = a lemondás visszavonása a user kérése nélkül → **valódi MEDIUM**.
Árazás-változtatás előtt ezt a leletet újra kell értékelni. *(A guardot saját olvasással ellenőriztem.)*

---

## 2. BILL-1 — a `0362351` új Billingo-payload-mezői teszteletlenek · **MEDIUM → LOW**

**Verifikációs út:** Finder D: MEDIUM → V1 (séma-helyesség): LOW → V2 (blast-radius): LOW → **végső: LOW** (`test-coverage`)

| Lencse | Verdikt | Kulcsérv |
|---|---|---|
| **V1 — séma-helyesség / a kiváltó feltétel** | PLAUSIBLE / LOW | A repóban **nincs** Billingo-sémadokumentáció → a mezőnév-helyesség se nem igazolható, se nem cáfolható. A „a Billingo ignorálja az extra mezőt" cáfolás **megbukott** (a projekt-memória rögzít egy élesben mért `422 Validation Failed`-et a `conversion_rate`-re, tehát a szerző séma-feltevése **már egyszer megdőlt élesben**) — de az hiányzó *kötelező*, nem ismeretlen *extra* mező volt. **Döntő a LOW-ra:** a suite `Http::fake()`-el dolgozik, így egy hozzáadott assertion **csak azt bizonyítaná, hogy a saját kódunk beteszi a kulcsot**, nem hogy a Billingo elfogadja → **a javasolt ellenszer nem hat a kár-útra** → a lelet valódi tartalma teszt-lefedettségi hézag. |
| **V2 — blast-radius / védelem a láncban** | PLAUSIBLE / LOW | A MEDIUM két pillére megdőlt: **(a) „néma"** — a lánc négy szinten hangos (`->throw()` → nem-404 továbbdobás → `tries=4` + `failed()`/`report()` → `queue:alert-failed` 10 percenként **szinkron** admin e-maillel) → egy 422 max. 10 percen belül riaszt; **(b) „integritás-sérülés/adatvesztés"** — a pénz a Stripe-nál rögzítve, a `BillingoInvoice` sor a unique kulcson létrejön, és a javítás után a **változatlan sor újrafuttatható** a dupla-számla-guardok védelmében → teljes, adatvesztés-mentes helyreállítás. **Projekt-precedens:** a korábbi Fázis 2 „BILL-1" (árva partner) is LOW volt „pénzügyi hatás nincs, operátor takarítja" érveléssel; a jelen lelet szigorúan kisebb hatású. |

**Miért változott a súlyosság:** a MEDIUM egy **feltételes külső API-viselkedésen** állt („HA a Billingo 422-zik"), aminek a
következménye bizonyítottan **hangos és teljesen visszafordítható**. A séma-kényszer szerint a nem bizonyított kiváltó feltétel +
ops-jellegű következmény = LOW, `test-coverage` kategóriában.

### ⚠️ Auditori korrekció — egy verifikátori tényállítás megdöntve

**V2 azt állította**, hogy a `phone` ág „de-facto lefedett", mert a `UserFactory` defaultot ad rá — és ezzel a hézagot
1 mezőre szűkítette. **Ez téves.** Saját ellenőrzés:

- A `billing_phone` a **`withBilling()` state**-ben van (`database/factories/UserFactory.php:85-94`), **nem** a base
  `definition()`-ben (`:25`) — a `grep` szerint a factory **minden** billing-mezője csak ebben a state-ben létezik.
- A `billableUser()` (`tests/Feature/BillingoInvoiceTest.php:20-31`) `User::factory()->create([...])`-ot hív, **`withBilling()` nélkül**.
- **Empirikus mérés** (eldobható próba-teszt, utána törölve, a repo érintetlen): `billableUser()` → **`billing_phone === null`**.

→ **Finder D eredeti állítása áll: mindkét ág (`phone` ÉS `registration_number`) teszteletlen.**

**Következmény a lelet tartalmára (nem a súlyra):** ez a `phone` ágat **kockázatosabbá** teszi, mint V2 gondolta, mert a
`phone` **MINDEN** userre kimegy (a `hasBillingDetails()` már megköveteli a telefont), nem csak a cégesekre — egy rossz
`phone` mezőnév **össz-felhasználós** számlázási leállás lenne, nem szűk céges eset. A súly ennek ellenére **LOW marad**,
mert V2 két megdöntő érve (hangos hiba, teljes retry-olhatóság) ettől független és változatlanul áll, és mert a `phone`
a legtriviálisabb, legvalószínűbben helyes partner-mezőnév.

**Tanulság a módszerre:** két verifikátor egymásnak ellentmondó tényállítása esetén a koordinátornak **mérnie** kell,
nem szavazatot számolni. Itt a mérés a *findert* igazolta a verifikátorral szemben.

---

## 3. Egykörös LOW-verifikációk (súlyosság nem változott)

| ID | Finder-súly | Végső | Verifikáció |
|---|---|---|---|
| WH-2 | LOW | LOW | CONFIRMED. A nem-kivételes crash (timeout/OOM/SIGKILL) valós, a `catch` nem fut le, a marker beragad. LOW-n tartja: a Billingo-ág aszinkron job (a dispatch túléli a webhook-ablakot), a `deleted`-ág öngyógyul a napi reconcile-ból, és nem támadó-triggerelhető. |
| SIG-1 | LOW | LOW | CONFIRMED, a mechanizmus **empirikusan mérve** (üres secret → 0 middleware). LOW-n tartja: a sérülékeny config egybeesik a „nincs `stripe_id`, nincs mit mutálni" állapottal; teszt explicit rögzíti a szándékoltságot. |
| LIM-1 | LOW | LOW | CONFIRMED. Saját ellenőrzés: a study-út csak ownership-et vizsgál, a lista nem `take()`-el; a write-oldal viszont `current + adding <= limit`-tel **fail-closed** → a downgraded user be van fagyasztva. Termék-döntés, self-only, nincs ismétlődő szolgáltatói költség. |
| LIM-2 | LOW | LOW | CONFIRMED. A nap/hónap-határ szerveroldali (`app.timezone=UTC` fixen, nincs kliens-bemenet a kulcsban); a keret-aszimmetria **döntően a user hátrányára** működik; az egyetlen nyereség-irány negatív ROI. |
| RACE-1 | LOW | LOW | CONFIRMED. A `> 0` guard szűkíti az ablakot, a `decrement` maga atomikus, a **fő** kapu felfelé sosem téveszt. Nyereség ±1-2 slot, pénzhatás nulla. |
| BILL-2 | LOW | LOW | CONFIRMED, a regex-viselkedés **saját méréssel** igazolva (`"(((((("`, `"------"`, 6 szóköz → mind PASS). LOW-n tartja: a karakterosztály kizárja az injektálást, a kár a saját számlájára korlátozódik és riaszt. |
| BILL-3 | LOW | LOW | CONFIRMED, `schedule:list`-tel ellenőrizve (`queue:monitor 'database:default'`). LOW-n tartja: a mai `.env` egyezik. **De ez a lánc egyetlen valóban NÉMA útja** (a nem-feldolgozott job nem bukik el → egyik riasztási lánc sem fog rá), és pontosan a 2026-07-22-i élő incidens mintája → ops-szempontból a legfontosabb maradék. |
| BILL-5 | LOW | LOW | CONFIRMED, a regex-lyuk mérve (`"99999999-9-99"` PASS). LOW-n tartja: compliance-, nem pénzügyi kár; a vevő önsorsrontása; mindkét kimeneti ág nyomot hagy. |

## 4. Nulla-lelet dimenzió-részek (cáfolt gyanúk)

Ezeket a finderek **aktívan keresték és nem találták** — a PLAN gyanúi itt megdőltek:

- **IDOR a számla-letöltésen** — explicit `user_id ===` + `isIssued()` + 404-nem-403 + `throttle:30,1` + 4 teszt.
- **Dupla NAV-számla** — négyrétegű védelem, a crash-ablak (`issuing_started_at` + `findIssuedDocument` exact-comment match) **konkrétan kezelve**.
- **PII a job-payloadban** — `onlyNeededFields` (7 mező) + `SerializesModels` (ID-only) + ID-only logok + `limit(500)` a riasztó e-mailben.
- **AI-keret dupla-refund** — a `callGemini` négy kilépési ága pontosan egyszer zárul; a `refund()` nullára clamp-ol atomikus `CASE WHEN`-nel.
- **TOCTOU a limitkapukon** — mind a 6 kapu per-user kulccsal, a limit-lekérdezés a lock-closure-ön **belül**.
- **W-M1 / W-L5 regresszió** — mindkét korábbi fix **jelen van** és teszttel védett.
