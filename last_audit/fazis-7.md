# Fázis 7 — Console commands & scheduled — audit

> Készült: 2026-07-19 · a go-live előtti utolsó, teljes lefedettségű audit console/scheduler köre.
> Fókusz: a 6 artisan-parancs (`ClearAiCache`, `EndTrialNow`, `FixWordLevels`, `ImportWords`, `MonitorFailedJobs`, `ReconcileStripeSubscriptions`) destruktivitása és prod-guardjai; a scheduler-regisztráció (`routes/console.php` / `bootstrap/app.php`) teljessége és rezilienciája; a riasztási lánc vég-a-végig (`MonitorFailedJobs` → `FailedJobsDetected`/`QueueBacklogDetected`/`ApplicationErrorDetected` notification-ök → `AlertAdminOfLoggedError`/`AlertAdminOfQueueBacklog` listener-ek → admin e-mail); a `ReconcileStripeSubscriptions` F2-W-3 invariánsa (átmeneti API-hiba SOHA nem zár le élő előfizetést); és a console-parancsok teszt-lefedettsége.
> Módszer: **multi-agent workflow** — 5 dimenzió-finder párhuzamosan (cáfolásra promptolva), majd minden HIGH/MEDIUM-gyanús leletre **3 független, cáfolásra promptolt adverzariális verifikátor** külön nézőpontból (reprodukció / blast-radius+támadói-modell / mitigáció+teszt-lefedettség), LOW-ra egykörös. Séma-kényszerített leletformátum (fájl, sor, súlyosság, forgatókönyv, kód-bizonyíték, verifikációs verdikt). **Csak dokumentálás — kód nem módosult (audit-no-fixes).**
> Futás: 27 agent (5 finder + 21 verifikátor + a szintézis a scriptben), 0 hiba a teljes futásban (a session-limit miatt megszakadt első kör verifikátorai a cache-ből folytatva, opus alatt újrafutottak). 19 nyers → 14 dedupolt lelet (fájl:sor szerinti összevonás). A kulcs-tények (a `resource_missing`-ág fék nélkül zár, a Cashier `active()` scope kizárja a `past_due`-t, a notification-ök `notifyNow` szinkron küldés, a scheduler-hookok hiánya) fő-agent által **külön grep-pel és kód-olvasással is verifikálva**.

## Lefedett dimenziók (5)

1. **destruktivitás & prod-guardok** — a 4 kézi parancs (`ClearAiCache`, `EndTrialNow`, `FixWordLevels`, `ImportWords`): confirm/`--force`/environment-guard megléte, argumentum/option-validáció, a mutáció scope-ja és visszafordíthatósága, `ImportWords` fájl-beolvasás (path/encoding/memória/upsert-felülírás), `ClearAiCache` törlés-szélessége + költség-következmény.
2. **scheduler-regisztráció** — `routes/console.php` + `bootstrap/app.php` + `schedule:list`: mely parancsok ütemezettek, `withoutOverlapping`/`onOneServer`/`pingOn*`/`onFailure`/`emailOutputOnFailure` hiánya, `sanctum:prune-expired` vs `sanctum.expiration`, ütemezett parancs hibájának elnyelése.
3. **riasztási lánc** — `MonitorFailedJobs` → notification-ök → admin e-mail: `ADMIN_EMAIL` hiány fail-silent hatása, `ShouldQueue` vs `notifyNow` (halott worker melletti kézbesíthetőség), riasztási hurok/loop-guard, dedup/throttle helyessége.
4. **reconcile** — `ReconcileStripeSubscriptions` (napi `cashier:reconcile-subscriptions`): az F2-W-3 invariáns megkerülhetősége (`resource_missing` ≠ törölt sub, `rate_limit` továbbdobás), blast-radius fék, `past_due`/`unpaid` állapot-átmenet, webhook-race, idempotencia.
5. **korrektség + teszt-lefedettség** — mind a 6 parancs logikai helyessége és a meglévő tesztek (`EndTrialNowTest`, `ErrorLogMonitoringTest`, `QueueMonitoringTest`, `ReconcileStripeSubscriptionsTest`) fedettsége; melyik parancsnak nincs tesztje.

---

## Összegzés

| Súlyosság | Db | Leletek |
|---|---|---|
| **HIGH** | **1** | REC-1 |
| **MEDIUM** | **0** | — (TEST-1 finder-MEDIUM → verifikáció LOW-ra húzta) |
| **LOW** | **13** | TEST-1 · SCHED-1 · ALERT-1 · CMD-1 · CMD-2 · CMD-3 · CMD-4 · SCHED-3 · ALERT-2 · ALERT-3 · ALERT-4 · TEST-2 · TEST-7 |
| **REFUTED** | **0** | — |

**Go-live blokkoló: 1 megfontolandó HIGH (REC-1) — nem támadó-triggerelt, hanem egyetlen ops-elgépelésre (rossz módú/fiókú `STRIPE_SECRET`) katasztrofális, öngyógyulásra képtelen.**

A finderek 1 HIGH- és 3 MEDIUM-gyanút emeltek; a 3 lencsés adverzariális verifikáció közül **REC-1 megtartotta a HIGH-t** (2 lencse HIGH, 1 MEDIUM), a másik három MEDIUM-gyanú (**TEST-1, SCHED-1, ALERT-1**) mind **LOW-ra dőlt** — egyik sem ad ingyen hozzáférést/pénz-előnyt, egyik sem támadó-triggerelt, és mindháromnál van már meglévő mérséklés (Stripe webhook-retry + portál-menekülőút, dedikált némaság-tesztek, infra-oldali uptime-monitor).

### A három legfontosabb megállapítás

1. **A REC-1 az egyetlen olyan lelet a teljes utolsó auditban, amely blast-radiusban a teljes fizető állományt érinti — és nem a webes/támadói felületről, hanem egy config-elgépelésből.** A `ReconcileStripeSubscriptions::reconcile()` a Stripe `resource_missing` (404) kódját a *végleges törlés* bizonyítékának veszi, és fenntartás nélkül `markAsCanceled()`-del zár. A kód **nem különbözteti meg** a valóban törölt subot a „teszt-módú vagy másik-fiókú kulcs, ami nem látja az élő subot" esettől — a Stripe mindkettőre ugyanazt a `resource_missing`-et adja (dokumentált viselkedés). Nincs blast-radius fék (`active()->cursor()->each()` sapka nélkül), és a **visszaút zárva**: a lezárt sor kiesik az `active()` scope-ból, a webhook anti-resurrect guard (W-M1) pedig eldobja a helyileg `canceled` sorra érkező `updated`-et → helyreállítás csak kézi DB-műtéttel. A Fázis 2 F2-W-3 invariáns a **tranziens** hibákra véd (a `rate_limit`-teszt bizonyítja a továbbdobást), de a kulcs-konfigurációs hiba nem tranziens, és épp a fék nélkül zár ó ágra fut.

2. **A reconcile a `past_due` sorokat egyáltalán nem látja (TEST-1) — a parancs docblokk-ígérete ezen a ponton nem teljesül.** A Cashier `scopeActive` a `deactivatePastDue=true` default (az app nem írja felül) miatt kizárja a `past_due`/`unpaid`/`incomplete` státuszt, így a napi reconcile a leggyakoribb törlési utat (dunning-bukás → `past_due` → elveszett `deleted`) sosem korrigálja. Ez viszont **fail-closed**: `past_due` nem `valid()`, tehát ingyen prémiumot nem ad — a kár a fizetni akaró user átmeneti elzárása + support-teher, nem jogosulatlan előny; ráadásul KÉT webhook (a `deleted` és bármely `canceled`-státuszú `updated`) végleges elvesztését igényli (a Stripe ~3 napig retryz), és a Billing Portal menekülőutat kínál. Ezért verifikáció után LOW.

3. **A riasztási lánc kód-oldala robusztus; a maradék LOW-k operációs/observability hézagok, nem alkalmazás-defektek.** A notification-ök szándékosan **nem `ShouldQueue`** (`notifyNow`) — épp azért, mert a queue baját jelentik; a `MonitorFailedJobs` cursor + `Cache::forever` révén bukásonként pontosan egyszer riaszt; az `AlertAdminOfLoggedError` a throttle-kulcsot atomikusan a küldés ELŐTT zárja (loop-guard a „az e-mail hibája errort logol" rekurzió ellen). A `SCHED-1`/`ALERT-1` (őrizetlen cron / üres `ADMIN_EMAIL`) valós, de **dedikált tesztekkel dokumentált, szándékos viselkedés** (`ErrorLogMonitoringTest`, `QueueMonitoringTest`), a mitigáció java infra-oldali (Ploi/UptimeRobot dead-man ping), és `isAdmin()` üres env mellett fail-closed jelez — így observability-hardening, nem MEDIUM kockázat.

---

## Összegző tábla (verifikált leletek)

| id | súlyosság | cím | fájl:sor | verdikt (lencsék) |
|---|---|---|---|---|
| **REC-1** | **HIGH** | Rossz módú/fiókú `STRIPE_SECRET` esetén a `resource_missing`-ág egyetlen napi futással az ÖSSZES élő előfizetést lezárja, fék nélkül, öngyógyulás nélkül | [ReconcileStripeSubscriptions.php:71](../app/Console/Commands/ReconcileStripeSubscriptions.php#L71) | CONFIRMED · HIGH (repro HIGH, mitigation HIGH, blast MEDIUM) |
| TEST-1 | **LOW** | A reconcile `active()` scope-ja kizárja a `past_due` sorokat → elveszett `deleted` webhook `past_due`-ban ragad (docblokk-ígéret hézagos) | [ReconcileStripeSubscriptions.php:39](../app/Console/Commands/ReconcileStripeSubscriptions.php#L39) | PARTIAL · LOW (repro MEDIUM, blast+mitigation LOW; fail-closed, dupla-webhook-veszteség kell) |
| SCHED-1 | **LOW** | A scheduler-lánc gyökere (`schedule:run` cron) heartbeat/`onFailure` nélkül — néma cron-halál minden riasztást kikapcsol | [console.php:22](../routes/console.php#L22) | PARTIAL · LOW (ops/infra, tudatos go-live tétel) |
| ALERT-1 | **LOW** | Üres `ADMIN_EMAIL` esetén a riasztási ágak némán/konzol-only kiesnek — nincs fail-loud boot-guard (Stripe-precedens ellenére) | [AlertAdminOfLoggedError.php:35](../app/Listeners/AlertAdminOfLoggedError.php#L35) | PARTIAL · LOW (monitoring-degradáció, tesztelt+fail-closed isAdmin) |
| CMD-1 | **LOW** | `ai:cache:clear` opció nélkül a TELJES AI-cache-t törli confirm nélkül (valós Gemini-újraépítési költség + átmeneti kvóta-égés) | [ClearAiCache.php:27](../app/Console/Commands/ClearAiCache.php#L27) | CONFIRMED · LOW (ops-only, lazy self-heal) |
| CMD-2 | **LOW** | `billing:end-trial` deklaráltan teszt-célú, mégis pénz-mutáló Stripe-hívás prod-guard/confirm nélkül | [EndTrialNow.php:43](../app/Console/Commands/EndTrialNow.php#L43) | CONFIRMED · LOW (hármas guard-lánc, prodban nincs trial) |
| CMD-3 | **LOW** | `words:import` validálatlan third-party távoli tartalmat upsertel confirm/tranzakció/sanity-check nélkül | [ImportWords.php:23](../app/Console/Commands/ImportWords.php#L23) | CONFIRMED · LOW (globális szótár, nem user-adat) |
| CMD-4 | **LOW** | `words:fix-levels` a szint-küszöböket a `Word::levelForRank` raw-SQL duplikátumaként hordozza → jövőbeli szétcsúszás | [FixWordLevels.php:16](../app/Console/Commands/FixWordLevels.php#L16) | CONFIRMED · LOW (ma idempotens+egyező, karbantartási kockázat) |
| SCHED-3 | **LOW** | `stripe_webhook_events` idempotencia-tábla korlátlanul hízik — sikeres feldolgozásnál nincs törlés, nincs prune-ütemezés | [StripeWebhookController.php:49](../app/Http/Controllers/StripeWebhookController.php#L49) | CONFIRMED · LOW (lassú, korlát nélküli növekedés) |
| ALERT-2 | **LOW** | A torlódás-riasztó a throttle-kulcsot a küldés ELŐTT zárja, try/catch nélkül → átmeneti SMTP-hiba 1 órára elnyeli a riasztást | [AlertAdminOfQueueBacklog.php:30](../app/Listeners/AlertAdminOfQueueBacklog.php#L30) | CONFIRMED · LOW |
| ALERT-3 | **LOW** | Az error-riasztás throttle-kulcsa üzenetenként egyedi (`md5(message)`) — dinamikus-üzenetű hibavihar levéláradatot + kérésenkénti szinkron SMTP-t okoz | [AlertAdminOfLoggedError.php:69](../app/Listeners/AlertAdminOfLoggedError.php#L69) | CONFIRMED · LOW |
| ALERT-4 | **LOW** | Beteg cache-store (`CACHE_STORE=database`) esetén a `Cache::add` kivételét a néma `catch` elnyeli → az error-riasztás csendben teljesen kikapcsol | [AlertAdminOfLoggedError.php:57](../app/Listeners/AlertAdminOfLoggedError.php#L57) | CONFIRMED · LOW |
| TEST-2 | **LOW** | A reconcile `handle()` szintje (kiválasztási scope, hibaizoláció, FAILURE exit) teszteletlen — csak a `reconcile()` döntési ágai fedettek probe-alosztályon át | [ReconcileStripeSubscriptionsTest.php:23](../tests/Feature/ReconcileStripeSubscriptionsTest.php#L23) | CONFIRMED · LOW (ez a rés engedte át a TEST-1-et) |
| TEST-7 | **LOW** | Az `AlertAdminOfLoggedError` `critical`/`alert`/`emergency` szintjeire nincs teszt, pedig a beragadt-sub riasztása `Log::critical`-on jut el az adminhoz | [ErrorLogMonitoringTest.php:16](../tests/Feature/ErrorLogMonitoringTest.php#L16) | CONFIRMED · LOW |

**Dedup-megjegyzés:** 5 nyers lelet fájl:sor-egyezés miatt összevonódott a fentiekbe: SCHED-2 (nincs `withoutOverlapping`) → SCHED-1 alá; TEST-3/4/5/6 (a `FixWordLevels`/`ImportWords`/`EndTrialNow`/`ClearAiCache` teszteletlensége) → a megfelelő CMD-lelet alá (lásd a részletezésben).

---

## Leletenkénti részletezés

### REC-1 — HIGH — Rossz módú/fiókú `STRIPE_SECRET` esetén a `resource_missing`-ág az ÖSSZES élő előfizetést lezárja
**Fájl:** [ReconcileStripeSubscriptions.php:66-78](../app/Console/Commands/ReconcileStripeSubscriptions.php#L66) · **Verdikt:** CONFIRMED, súly **HIGH** (repro CONFIRMED/HIGH, mitigation CONFIRMED/HIGH, blast PARTIAL/MEDIUM)

**Forgatókönyv:** Egyetlen tipikus ops-elgépelés — a prod `.env`-be teszt-módú vagy másik Stripe-fiókból származó `STRIPE_SECRET` kerül (go-live kulcscsere, kulcs-rotálás vagy Ploi env-visszaállítás során). Ekkor a Stripe minden `subscriptions->retrieve` hívásra 404 `resource_missing`-et ad („No such subscription … a similar object exists in live mode, but a test mode key was used"). A napi cron következő futása MINDEN helyileg aktív előfizetésre a `closeDeadSubscription` ágra fut → `markAsCanceled()` → `stripe_status=canceled` + `ends_at=now()`.

**Kár:** (1) minden fizető user azonnal elveszti a prémiumot, miközben a Stripe tovább számláz; (2) a grace-periodos sorok eredeti `ends_at`-ja feltétel nélkül `now()`-ra íródik → adatvesztés; (3) **öngyógyulásra képtelen**: a webhook anti-resurrect guard ([StripeWebhookController.php:206-222](../app/Http/Controllers/StripeWebhookController.php#L206), W-M1 fix) a helyileg `canceled` sorra érkező nem-`canceled` `subscription.updated`-et szándékosan eldobja, a reconcile pedig csak az `active()` scope-ot iterálja, ahová a lezárt sor soha nem tér vissza → helyreállítás kézi DB-műtét.

**Kód-bizonyíték:** [ReconcileStripeSubscriptions.php:66-78](../app/Console/Commands/ReconcileStripeSubscriptions.php#L66) — `catch (InvalidRequestException $e) { … if ($e->getStripeCode() === 'resource_missing') { $this->closeDeadSubscription($subscription, 'resource_missing'); return true; } throw $e; }`. A [handle() (39-50)](../app/Console/Commands/ReconcileStripeSubscriptions.php#L39) sapka nélkül iterál: `Subscription::query()->active()->cursor()->each(…)`. A [ReconcileStripeSubscriptionsTest.php:55-64](../tests/Feature/ReconcileStripeSubscriptionsTest.php#L55) pont ezt az ágat **szentesíti** (`resource_missing → markAsCanceled once`). A tranziens védelem működik ([:86-100](../tests/Feature/ReconcileStripeSubscriptionsTest.php#L86), `rate_limit` továbbdob), de a kulcs-hiba `resource_missing`-et ad, ami megkerüli.

**Miért HIGH (és miért nem MEDIUM):** két verifikátor (repro, mitigation) HIGH-t adott: a mechanizmus, a fék hiánya, az adatvesztés és a zárt visszaút mind kódszinten igazolt, és **semmilyen fék nem áll a kár útjában**. A blast-lencse MEDIUM-ra húzta a *bekövetkezési valószínűség* miatt (ops-only trigger, nem adverzariális, és egy rossz módú kulcs a teljes éles Stripe-felületet elrontaná — checkout/portál/webhook —, ami más úton is kiderülhet a következő napi futás előtt). A HIGH-t azért tartjuk meg, mert a hatás katasztrofális-ha-elsül + öngyógyulásra képtelen + irreverzibilis `ends_at`-adatvesztés, és a Log::critical riasztás csak a kár BEKÖVETKEZTE után szól. Ez az egyetlen lelet a teljes utolsó auditból, amely a teljes fizető állományt egyszerre érintheti.

**Megfontolandó fix (nem alkalmazva — audit-no-fixes):** livemode/mode-mismatch boot-guard (a `STRIPE_SECRET` prefixe `sk_live_`/`sk_test_` egyeztetése az `APP_ENV`-vel indításkor, a `assertStripeWebhookSecured` mintájára), VAGY százalék-alapú kör-fék a reconcile-ban (ha a futás az aktív állomány > N%-át zárná le, álljon le és **riasszon lezárás helyett**).

---

### TEST-1 — LOW — A reconcile `active()` scope-ja kizárja a `past_due` sorokat
**Fájl:** [ReconcileStripeSubscriptions.php:39](../app/Console/Commands/ReconcileStripeSubscriptions.php#L39) · **Verdikt:** PARTIAL, súly **LOW** (repro CONFIRMED/MEDIUM, blast PARTIAL/LOW, mitigation PARTIAL/LOW)

**Forgatókönyv:** Előfizetés sikertelen terhelés miatt `past_due` lesz (a `customer.subscription.updated` ezt helyben szinkronizálja, `ends_at=NULL`), majd a Stripe a dunning-retry-k kimerülése után törli (`canceled`). Ha ez a `customer.subscription.deleted` végleg elvész (épp az a hibamód, ami ellen a parancs készült), a helyi sor `stripe_status='past_due'`, `ends_at=NULL` állapotban ragad. A Cashier `scopeActive` (`deactivatePastDue=true` default, az app nem írja felül) kizárja a `past_due`/`unpaid`/`incomplete` sorokat → a napi reconcile SOHA nem nézi meg, riasztás sincs. Következmény: `hasPastDueSubscription()` örökre `true` → állandó past_due-sáv, és a [PricingController.php:87-89](../app/Http/Controllers/PricingController.php#L87) past_due-kapuja a `subscription.edit`-re tereli egy már nem létező előfizetésre.

**Miért LOW (a MEDIUM-gyanú lefokozva):**
- **Fail-closed:** `past_due` nem `valid()`, így `hasActiveAccess()`/`currentPlan()` Free-t ad, `activeSubscription()` null → **NINCS ingyen prémium** (a leggyakoribb HIGH-eszkalációs vektor kizárva).
- **Dupla-webhook-veszteség kell:** a `deleted` ÉS bármely `canceled`-státuszú `updated` végleges elvesztése (utóbbi a szinkron-ágon lezárna); a Stripe ~3 napig retryz → ritka tail-eset, nem a „leggyakoribb" út.
- **Menekülőút:** a `subscription.edit` a Stripe Billing Portalt kínálja (élő állapotot olvas), admin `plan_override`/kézi beavatkozás feloldja → support-úton helyreállítható.
- Egyetlen **saját** fiók, nincs cross-user hatás, nincs visszafordíthatatlan adatvesztés.

A docblokk-ígéret ([:14](../app/Console/Commands/ReconcileStripeSubscriptions.php#L14): „egy elveszett `customer.subscription.deleted` esemény sem hagy beragadt előfizetést") ezen a dunning-úton hézagos — a mag igaz, ezért nem REFUTED, de LOW.

---

### SCHED-1 — LOW — A scheduler-lánc gyökere (`schedule:run` cron) heartbeat/`onFailure` nélkül
**Fájl:** [console.php:22-47](../routes/console.php#L22) · **Verdikt:** PARTIAL, súly **LOW** (repro CONFIRMED/LOW, blast PARTIAL/LOW, mitigation PARTIAL/LOW)

**Forgatókönyv:** A Ploi cron leáll/elromlik (szerver-migráció, PHP-path változás, véletlen Ploi-törlés) → a `queue:alert-failed`, `queue:monitor` és `cashier:reconcile-subscriptions` soha többé nem fut → egy elbukott `GenerateBillingoInvoice` job (kimaradt NAV-számla) vagy leállt worker miatti torlódás hetekig észrevétlen marad, mert pont a jelző mechanizmus halt meg némán. A nem-nulla exit-kód (`MonitorFailedJobs` hiányzó ADMIN_EMAIL-nél, `ReconcileStripeSubscriptions` `$failed>0`-nál) is elnyelődik — nincs `ScheduledTaskFailed` listener.

**Kód-bizonyíték:** [console.php:22-47](../routes/console.php#L22) — mind a 4 `Schedule::command()` hook nélkül (grep `onFailure|emailOutputOnFailure|pingOn|thenPing|onSuccess` az egész `app/`+`routes/`+`config/` fára = 0 találat). A [:20 komment](../routes/console.php#L20) maga rögzíti a függést. A `bootstrap/app.php` `health: '/up'` csak a web-processz élését jelzi, a néma scheduler-halált nem detektálja.

**Miért LOW:** ops/infra observability rés, nem alkalmazás-defekt — nincs támadó, nincs user-trigger, nincs pénz/adat/auth-hatás, a legrosszabb kimenet egy már eleve ritka MÁSODLAGOS hiba (elbukott job ÉS egyidejűleg holt cron) késleltetett észlelése. A kivételt dobó parancsnál a lánc egyébként működik (`report()` → error-log → `AlertAdminOfLoggedError` → e-mail). A mitigáció (dead-man `pingOnSuccess` egy Ploi/UptimeRobot URL-re) java **repón kívül** él, és a projekt a `project_queue_monitoring.md`-ben tudatosan az infra-oldalra sorolt go-live tételként kezeli. SCHED-2 (nincs `withoutOverlapping` egyik parancson sem) ide olvasztva: a napi `cashier:reconcile-subscriptions` és `sanctum:prune-expired` egyszerre-futása a gyakorlatban nem okoz kárt (idempotens, cursor-alapú), de a hardening ugyanaz az infra-osztály.

---

### ALERT-1 — LOW — Üres `ADMIN_EMAIL` esetén a riasztási ágak némán/konzol-only kiesnek
**Fájl:** [AlertAdminOfLoggedError.php:33-37](../app/Listeners/AlertAdminOfLoggedError.php#L33) · **Verdikt:** PARTIAL, súly **LOW** (mindhárom lencse LOW)

**Forgatókönyv:** Friss deploy / `.env`-újraírás / elgépelt kulcs után az `ADMIN_EMAIL` üresen marad (a `.env.example:69` is üresen szállít). Ekkor az `AlertAdminOfLoggedError` és az `AlertAdminOfQueueBacklog` listener szó nélkül `return`-öl, a `queue:alert-failed` pedig 10 percenként `FAILURE`-ral lép ki, de csak konzolra ír. Egy elbukott `GenerateBillingoInvoice` job így értesítés nélkül maradhat.

**Miért LOW (a MEDIUM-gyanú lefokozva):**
- **Szándékos, tesztelt szerződés:** [ErrorLogMonitoringTest.php:89](../tests/Feature/ErrorLogMonitoringTest.php#L89) („ADMIN_EMAIL nélkül a riasztás némán kimarad" → `assertNothingSent`), [QueueMonitoringTest.php:72](../tests/Feature/QueueMonitoringTest.php#L72) (`assertExitCode(1)` + `assertNothingSent`), [:108](../tests/Feature/QueueMonitoringTest.php#L108). A kód-komment ([:57-60](../app/Listeners/AlertAdminOfLoggedError.php#L57)) magyarázza, miért nem dobhat/logolhat a listener (rekurzió-védelem).
- **Nem élő pénz/auth-út:** a Stripe-precedens (`assertStripeWebhookSecured` boot-time `RuntimeException`) hamis-webhook általi PÉNZ-elfogadás ellen véd; az `ADMIN_EMAIL` hiánya csak egy monitoring safety-net ágát némítja — a hiba akkor is a `laravel.log`-ban van és a `failed_jobs` táblában marad, csak az ÉRTESÜLÉS késik. Nincs adatvesztés/jogosultság-emelés.
- **Fail-closed + több jelzés:** `User::isAdmin()` szintén `admin_email`-ből él → üres env mellett SENKI nem admin (fail-closed), az admin-felület eltűnése azonnal feltűnik; a `MonitorFailedJobs.php:51` csak SIKERES küldés után lépteti a `LAST_ALERTED_ID` cache-t, így az env javítása után a bukás UTÓLAG kimegy.

---

### CMD-1 — LOW — `ai:cache:clear` opció nélkül a TELJES AI-cache-t törli confirm nélkül
**Fájl:** [ClearAiCache.php:17-27](../app/Console/Commands/ClearAiCache.php#L17) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** Ops egyetlen szó cache-sorát akarja törölni, de a `--word` opciót lefelejti: `php artisan ai:cache:clear` → az `ai_word_cache` tábla MINDEN sora törlődik megerősítés nélkül. A törlés visszafordíthatatlan; az újraépítés lazy, valós Gemini API-költséggel. Mellékhatás: cache-találatnál a user AI-kvótája sem fogy ([AiCacheService.php:32-34](../app/Services/AiCacheService.php#L32)), így wipe után a korábban ingyenes találatok is a userek napi keretét égetik. A `--task` érték nincs a `(lookup, flashcard, insight)` halmazra validálva — elgépelésnél némán 0 sort töröl (de a kiírt darabszám láthatóvá teszi).

**Kód-bizonyíték:** [:17-27](../app/Console/Commands/ClearAiCache.php#L17) — mindkét opció opcionális, szűrő nélkül a query az egész táblát törli; nincs `confirm()`/`--force`/env-guard. A `DB::prohibitDestructiveCommands` ([AppServiceProvider.php:64](../app/Providers/AppServiceProvider.php#L64)) csak a framework-parancsokat védi, ezt nem.

**Miért LOW:** csak szerver-shell hozzáféréssel futtatható, nem user-adat, az app lazy regenerációval önjavító, a kár a tábla méretével arányos (go-live előtt kicsi). **TEST-6** ide olvasztva: csak a `--task`-szűrős ág tesztelt ([AiCacheTest.php:218](../tests/Feature/AiCacheTest.php#L218)), az opció nélküli teljes wipe teszteletlen.

**Megfontolandó megelőzés:** `--all` explicit flag vagy `confirm()` a szűretlen törléshez; `--task` validálás a három ismert értékre.

---

### CMD-2 — LOW — `billing:end-trial` teszt-célú, de pénz-mutáló Stripe-parancs prod-guard nélkül
**Fájl:** [EndTrialNow.php:43](../app/Console/Commands/EndTrialNow.php#L43) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A parancs saját leírása szerint „teszteléshez" való, mégis bármely környezetben fut: ha ops véletlenül a prod SSH-n adja ki egy valós, próbaidős előfizető email-címével, a Stripe azonnal lezárja a trial-t, kiállítja és LEVONJA az első éles számlát (+ Billingo NAV-számla a webhookon) — a vállalt terhelési dátum előtt, megerősítés nélkül.

**Miért LOW:** hármas guard-lánc ([:19-23](../app/Console/Commands/EndTrialNow.php#L19) nincs user → FAILURE, [:27-31](../app/Console/Commands/EndTrialNow.php#L27) nincs aktív sub, [:33-37](../app/Console/Commands/EndTrialNow.php#L33) nincs trial) → csak létező, aktív, ténylegesen próbaidős előfizetőt érinthet; prodban a jelenlegi modellben nincs trial (`SUBSCRIPTION_TRIAL_DAYS` default 0), a parancs nincs ütemezve, a kár refunddal visszafordítható. **TEST-5** ide olvasztva: a sikeres (Stripe-hívó) ág teszteletlen; a három FAILURE-ág fedett ([EndTrialNowTest.php](../tests/Feature/EndTrialNowTest.php)).

**Megfontolandó megelőzés:** `$this->confirm()` + `App::isProduction()` figyelmeztetés a Stripe-mutáció előtt.

---

### CMD-3 — LOW — `words:import` validálatlan távoli tartalmat upsertel confirm nélkül
**Fájl:** [ImportWords.php:19-23](../app/Console/Commands/ImportWords.php#L19) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A parancs futásidőben tölti le a szólistát egy külső GitHub raw URL-ről (`@file_get_contents`, timeout és tartalom-validáció nélkül), és prodban rákérdezés nélkül upserteli. Ha az upstream fájl tartalma/sorrendje megváltozik (repo-átvétel, szerkesztés), az összes ~10k szó `rank`+`level` értéke némán átrendeződik a prod DB-ben.

**Kód-bizonyíték:** [:23](../app/Console/Commands/ImportWords.php#L23) `$content = @file_get_contents($url);` — csak a `false`-t kezeli, darabszám/formátum sanity-check nincs; [:52](../app/Console/Commands/ImportWords.php#L52) `Word::upsert(...)` chunk-onként, tranzakció nélkül.

**Miért LOW:** globális szótár-tábla (nem user-adat), kézi ops-parancs, nincs ütemezve. **TEST-4** ide olvasztva: teljesen teszteletlen; a `@`-elnyomott letöltési hibaág félrevezető sikert adhat részleges tartalomnál.

---

### CMD-4 — LOW — `words:fix-levels` a szint-küszöböket raw-SQL duplikátumként hordozza
**Fájl:** [FixWordLevels.php:16-26](../app/Console/Commands/FixWordLevels.php#L16) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A parancs ma biztonságos: a teljes-tábla `UPDATE` determinisztikus és idempotens (kétszeri futtatás = azonos eredmény), a `words.rank` NOT NULL, a küszöbök ma pontosan egyeznek a `Word::levelForRank` match-ágaival. A kockázat a **duplikáció**: ha a szint-határok egyszer változnak és csak a modellben írják át, a parancs következő futása a régi küszöbökkel írja felül a szinteket.

**Kód-bizonyíték:** [:16-26](../app/Console/Commands/FixWordLevels.php#L16) — a raw `CASE`-küszöbök (1000/2000/4000/6000/8000 → 1–6) a [Word.php:21-31 `levelForRank()`](../app/Models/Word.php#L21) kézi másolata; a raw `UPDATE` megkerüli az egyetlen igazság-forrást.

**Miért LOW:** karbantarthatósági kockázat, nem aktuális hiba. **TEST-3** ide olvasztva: a parancs teljesen teszteletlen, a küszöböket nyers SQL-ben ellenőrzi.

---

### SCHED-3 — LOW — A `stripe_webhook_events` idempotencia-tábla korlátlanul hízik
**Fájl:** [StripeWebhookController.php:49](../app/Http/Controllers/StripeWebhookController.php#L49) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** Minden beérkező Stripe-webhook egy sort ír a `stripe_webhook_events`-be (idempotencia-dedup); törlés kizárólag a kivétel-ágon ([:65-71](../app/Http/Controllers/StripeWebhookController.php#L65)), sikeres feldolgozásnál soha, és nincs prune-ütemezés. Évek alatt lassan, de korlát nélkül nő a tábla — a dedup-ablakhoz néhány nap is elég lenne.

**Miért LOW:** lassú, nem funkcionális törést okozó növekedés. **Megfontolandó megelőzés:** napi prune a `sanctum:prune-expired` mintájára (pl. 30 napnál régebbi sorok törlése).

---

### ALERT-2 — LOW — A torlódás-riasztó a throttle-kulcsot a küldés előtt zárja, try/catch nélkül
**Fájl:** [AlertAdminOfQueueBacklog.php:30-35](../app/Listeners/AlertAdminOfQueueBacklog.php#L30) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A worker leáll, a `queue:monitor` `QueueBusy`-t lő, a listener `Cache::add`-dal AZONNAL lezárja az 1 órás throttle-t, majd a `notifyNow` egy átmeneti SMTP-hibán kivételt dob. A kivétel kezeletlenül propagál (a scheduled task FAILURE), a riasztás elveszett, és a throttle miatt 1 órán át nem próbálkozik újra. (A testvér `AlertAdminOfLoggedError`-nak van `try/catch`-e — itt hiányzik, de ott a némítás loop-guard, itt viszont épp az elveszett-riasztás okozója.)

**Miért LOW:** átmeneti SMTP-hiba + aktív torlódás egyidejűsége kell; a következő `queue:monitor` futás (10 perc) újra `QueueBusy`-t lő, de a throttle 1 órára fog. **Megfontolandó megelőzés:** `notifyNow` után léptetni a throttle-t, vagy `try/catch`-ben a kulcsot felszabadítani küldés-hibánál.

---

### ALERT-3 — LOW — Az error-riasztás throttle-kulcsa üzenetenként egyedi
**Fájl:** [AlertAdminOfLoggedError.php:67-70](../app/Listeners/AlertAdminOfLoggedError.php#L67) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A throttle kulcsa `level + md5(üzenet)`, ezért csak a KARAKTERRE azonos üzenet fojtódik. Ha egy hibaágban a kivétel-üzenet dinamikus részt hordoz (rekord-id, SQL-binding, külső API válasz-töredék), minden előfordulás új kulcsot kap → nincs globális óránkénti sapka, egy hibavihar levéláradatot és kérésenkénti szinkron SMTP-kört okoz (ami a kérés-latenciát is növeli).

**Miért LOW:** a különböző-üzenet szándékos tervezési döntés (különböző hiba ne nyelje el a másikat); a kockázat a dinamikus-üzenetű hibavihar szűk esete. **Megfontolandó megelőzés:** másodlagos globális óránkénti felső korlát (pl. max N e-mail/óra összesen) a per-üzenet throttle mellett.

---

### ALERT-4 — LOW — Beteg cache-store esetén az error-riasztás csendben kikapcsol
**Fájl:** [AlertAdminOfLoggedError.php:39-60](../app/Listeners/AlertAdminOfLoggedError.php#L39) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A throttle a database cache store-on él (`CACHE_STORE=database`). Ha a cache-réteg beteg (hiányzó/sérült cache tábla egy deploy-migráció után, vagy DB-elérési hiba), a `try`-blokk ELSŐ utasítása (`Cache::add`) dob, és a `catch (Throwable)` — szándékos hurok-védelemként — némán elnyeli → soha nem jut el a `notifyNow`-ig. Pont akkor néma, amikor a DB/cache maga a baj.

**Miért LOW:** szűk, infra-degradációs eset; a hurok-védelem (a `catch` nem dobhat/logolhat, mert az újra ide futna) helyes tervezés, csak a mellékhatása a néma kiesés. **Megfontolandó megelőzés:** a `Cache::add` külön try-ága, ami hiba esetén fail-open módon átengedi a küldést (a duplikáció-kockázatot vállalva).

---

### TEST-2 — LOW — A reconcile `handle()` szintje teszteletlen
**Fájl:** [ReconcileStripeSubscriptionsTest.php:23-29](../tests/Feature/ReconcileStripeSubscriptionsTest.php#L23) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A `ReconcilerProbe` csak a protected `reconcile()`-t gyakorolja mockolt Subscription-ökkel; egyetlen teszt sem hoz létre DB-ben előfizetés-sorokat és futtatja a `$this->artisan('cashier:reconcile-subscriptions')`-t. Így a **kiválasztási scope** regressziója észrevétlen marad — pontosan ez a rés engedte át a TEST-1 hiányosságot (nincs teszt, ami egy `past_due` sort beszúr és elvárja, hogy a reconcile lássa). A hibaizoláció (`$failed++` + `report()`) és a `FAILURE` exit-kód is teszteletlen a `handle()` szintjén.

**Miért LOW:** teszt-adósság, nem futásidejű hiba. A TEST-1 fix-tesztjének természetes helye.

---

### TEST-7 — LOW — A riasztó listener `critical`/`alert`/`emergency` szintjeire nincs teszt
**Fájl:** [ErrorLogMonitoringTest.php:16](../tests/Feature/ErrorLogMonitoringTest.php#L16) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** Az `AlertAdminOfLoggedError::ALERT_LEVELS` (`emergency`/`alert`/`critical`/`error`) kódszinten helyesen kezeli a `critical`-t, de az `ErrorLogMonitoringTest` minden pozitív riasztás-tesztje kizárólag `Log::error`-t használ. A `ReconcileStripeSubscriptions::closeDeadSubscription` ([:112](../app/Console/Commands/ReconcileStripeSubscriptions.php#L112)) épp `Log::critical`-lal riaszt a beragadt-sub lezárásról — ezt az utat egyetlen teszt sem járja be.

**Miért LOW:** a kód helyes (a `critical` szint benne van a konstansban), csak a bizonyíték-teszt hiányzik. **Megfontolandó megelőzés:** dataset a négy `ALERT_LEVELS` szintre az `ErrorLogMonitoringTest`-ben.

---

## Verifikált CLEAN területek (rögzítés a teljesség kedvéért)

| terület | eredmény |
|---|---|
| **`notifyNow` szinkron küldés** | **CLEAN** — mindhárom notification szándékosan NEM `ShouldQueue`; a riasztás a queue bajáról szól, ezért nem bízható a queue-ra. Halott worker mellett is kézbesíthető. |
| **`MonitorFailedJobs` dedup** | **CLEAN** — cursor a `LAST_ALERTED_ID` cache fölött + `Cache::forever` csak SIKERES küldés után → bukásonként pontosan egyszer riaszt, nem spam-el és nem nyel el. |
| **`AlertAdminOfLoggedError` loop-guard** | **CLEAN** — a throttle-kulcsot atomikusan (`Cache::add`) a küldés ELŐTT zárja, a `catch (Throwable)` nem dob/logol → az „email-hiba errort logol" rekurzió nem indul be. |
| **Reconcile tranziens-védelem (F2-W-3)** | **CLEAN a tranziens ágra** — a nem-`resource_missing` Stripe-hibát (`rate_limit` stb.) továbbdobja, nem zár le élő subot; teszttel fedve. (A rés kizárólag a nem-tranziens kulcs-hiba `resource_missing`-jén van — lásd REC-1.) |
| **`sanctum:prune-expired` vs token-lejárat** | **CLEAN** — a player-token explicit 90 napos `expires_at`-tal jön létre ([PlayerPairingController.php:150-153](../app/Http/Controllers/PlayerPairingController.php#L150), `TOKEN_LIFETIME_DAYS`), így a napi prune ténylegesen töröl lejárt sorokat; a `sanctum.expiration=null` globális default a per-token `expires_at`-ot nem írja felül. |
| **`queue:monitor` scheduled paraméterek** | **CLEAN** — `config('queue.default').':default'` + `--max=25` egyezik a tényleges `database` connection default queue-jával (`schedule:list`: `'database:default' --max=25`). |
| **`FixWordLevels` idempotencia** | **CLEAN ma** — determinisztikus teljes-tábla `UPDATE`, `rank` NOT NULL, küszöbök egyeznek a modellel (a kockázat kizárólag jövőbeli duplikáció-szétcsúszás, lásd CMD-4). |

---

## Következtetés

A Fázis 7 **egy megfontolandó HIGH-t (REC-1)** talált — az egyetlen olyan leletet az utolsó auditban, amely blast-radiusban a teljes fizető állományt érinti, és nem a webes/támadói felületről, hanem egy ops-config-elgépelésből. A támadói-modell szerint nem user-triggerelt, de a hatás (tömeges prémium-vesztés + Stripe tovább-számláz + `ends_at` adatvesztés + öngyógyulás-képtelenség) és a fék teljes hiánya indokolja a HIGH-t. A többi 13 lelet mind **LOW**, kivétel nélkül self-only vagy ops/observability jellegű: a három finder-MEDIUM (TEST-1, SCHED-1, ALERT-1) az adverzariális verifikációban LOW-ra dőlt, mert egyik sem ad ingyen hozzáférést/pénz-előnyt, egyik sem támadó-triggerelt, és mindegyiknél van már meglévő mérséklés vagy szándékos, tesztelt viselkedés. **A riasztási lánc kód-oldala robusztus** (`notifyNow` szinkron küldés, egyszer-riasztó dedup, loop-guard); a maradék ALERT-LOW-k a lánc szélső hibamódjai.

**A jelen fázis szabálya szerint kód nem módosult — minden lelet CSAK dokumentálva.** A go-live előtti mérlegelésre a REC-1 (livemode-guard vagy százalék-alapú kör-fék) az egyetlen, amelynek fixét érdemes megfontolni; a többi olcsó hardening, nem blokkoló.
