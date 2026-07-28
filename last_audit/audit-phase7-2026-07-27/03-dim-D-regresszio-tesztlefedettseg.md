# Fázis 7 — Dimenzió D — Regresszió a korábbi F7 leletekre + teszt-lefedettség

**Finder-dimenzió:** D — regresszió-ellenőrzés a korábbi Fázis 7 leletekre + teszt-lefedettség

Leletek: 8

> A verifikátorok kifejezetten CÁFOLÁSRA voltak promptolva; bizonytalanság esetén a
> default `refuted=true`. HIGH/MEDIUM-ra 3 eltérő lencse, LOW-ra egykörös.

---

## P7D-1 — REC-1 2. rétege (kör-fék) a JELENLEGI állományon TELJESEN INERT — 1 aktív előfizetés, a MIN_KILL_COUNT_FOR_GUARD=5 küszöb alatt

| | |
|---|---|
| **Fájl:sor** | `app/Console/Commands/ReconcileStripeSubscriptions.php:56` |
| **Végső súlyosság** | **INFO** (finder: MEDIUM → **INFO**) |
| **Verifikációs verdikt** | REFUTED/REFUTED/REFUTED — 3/3 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: (a) A VPS APP_ENV NEM 'production' (a .env-ben APP_ENV=local; a memória szerint a VPS test-mode-ban fut) → az assertStripeSecretMatchesEnvironment első sora `if (! app()->isProduction() ...) return;` → az 1. réteg NEM FUT. VAGY (b) prodban sk_live_ prefixű, de MÁS FIÓK kulcsa → a prefix-only guard (str_starts_with($secret,'sk_test_')) átengedi. Ezután a mért aktív állomány 1 sor. A Stripe minden retrieve-re resource_missing-et ad → killCount=1. A tripsKillSwitch() első ága: `if ($killCount < 5) return false;` → a fék NEM aktív → mind az 1 (vagy 4 sornál mind a 4) fizető előfizetés lezáródik markAsCanceled()-del: stripe_status='canceled' + ends_at=now(). Hatás: a fizető felhasználó azonnal elveszti a Pro-belépést, a grace-period ends_at-je felülíródik; a Stripe-nál viszont ÉL az előfizetés → tovább terhel. Néma adat-divergencia: a Log::critical elmegy, de e-mail-riasztás CSAK ha app()->isProduction() (AlertAdminOfLoggedError:41) — nem-prod APP_ENV-en még a critical-log-riasztás is kiesik. Vagyis pontosan abban a konfigurációban, ahol az 1. réteg nem fut, a 3. (riasztási) réteg sem.

### Bizonyíték

ReconcileStripeSubscriptions.php:62-65 `MIN_KILL_COUNT_FOR_GUARD = 5`; :148-155 `tripsKillSwitch(): if ($killCount < self::MIN_KILL_COUNT_FOR_GUARD) { return false; }`. AppServiceProvider.php:120-122 `if (! app()->isProduction() || ! config('services.stripe.enabled')) { return; }` és :126 `str_starts_with($secret, 'sk_test_')` — prefix-only. AlertAdminOfLoggedError.php:40-42 `if (! app()->isProduction()) { return; }`. Mérve: `Subscription::query()->active()->count()` = 1, `Subscription::count()` = 8, `User::count()` = 2. .env:2 `APP_ENV=local`. A saját teszt kimondja a rést: ReconcileStripeSubscriptionsTest.php:243 „kis állományon a fék nem akad be (1 sorból 1 lezárás = 100%, de a küszöb alatt)" — szándékolt viselkedés, de a korai életszakaszban ez = fék nélküli állapot.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem távolról kihasználható: kizárólag ops-hiba (rossz módú/fiókú kulcs) váltja ki, nem támadó. A blast radius jelenleg 1 sor, és a markAsCanceled csak helyi adat — a Stripe-oldali igazságforrás sértetlen, kézzel visszaállítható. A 2. és 3. réteg kiesése ELLENÉRE a Log::critical a szerver-logban ott van.

**Miért nem alacsonyabb:** Nem hygiene: a korábbi kör „kettős védelem" verdiktje ténybelileg HAMIS a jelenlegi konfigurációban — a mért állomány-méret mellett a 2. réteg matematikailag nem tud aktiválódni, az 1. réteg pedig APP_ENV≠production alatt vissza sem tér, tehát a védelem NULLA rétegű. Valós pénz-hatású adatvesztés (elveszett grace-period, letiltott fizető user).

### Verifikációs szavazatok

**1. szavazat — REFUTED** (`refuted=true`, javasolt: INFO)

VERIFIED PREMISES (all factually true in code): MIN_KILL_COUNT_FOR_GUARD=5 with tripsKillSwitch() early-returning false below it (:128-130); assertStripeSecretMatchesEnvironment early-returns on non-production (:122); the guard is prefix-only on 'sk_test_' (:128); AlertAdminOfLoggedError returns early on non-production (:41); markAsCanceled() sets stripe_status='canceled' + ends_at=now() (vendor/laravel/cashier/src/Subscription.php:1140); measured active=1, all=8, users=2, .env APP_ENV=local. Cited line numbers are wrong (56 vs 128, 62-65 vs 43, 148-155 vs 126-133) but that is cosmetic. So no premise is outright false — yet the exploitability framing collapses on four independent grounds.

(1) THE CAUSAL CHAIN IS BROKEN FOR THE MAIN BRANCH. reconcile() converts a Stripe error into a CloseDecision ONLY for InvalidRequestException whose getStripeCode() === 'resource_missing' (:160-161). Everything else is rethrown (:164). A "wrong account" key is either revoked/invalid — yielding Stripe\Exception\AuthenticationException, which is NOT InvalidRequestException, so it rethrows into $failed and closes NOTHING — or a valid live key for a different live account. Only that last, very narrow case produces resource_missing. The finder's branch (b) therefore does not generally hold.

(2) THE TWO BRANCHES ARE MUTUALLY EXCLUSIVE WITH THE HARM. Branch (a) is non-production APP_ENV, but the measured active=1 comes from the LOCAL dev database (users=2 — the developer's own machine), not from production. On the VPS, non-production APP_ENV pairs with a TEST-mode key reading TEST-mode subscriptions, which retrieve normally: no resource_missing, no closure. To manufacture mass resource_missing you need exactly the key/data mismatch that branch (b) requires — and branch (b) is defeated by (1).

(3) THE "INERTNESS" IS CORRECT BEHAVIOR, NOT A DEFECT. At activeCount=1, killCount=1 is mathematically indistinguishable from the legitimate case the guard exists to ALLOW: a single genuinely stuck row from a lost customer.subscription.deleted webhook — the command's entire raison d'être. A ratio-based guard cannot separate signal from noise at n=1; that is a property of statistics, not a coding flaw. Firing at n=1 would break the primary function. The test at ReconcileStripeSubscriptionsTest.php:243 documents this as deliberate, and the finder itself concedes "szándékolt viselkedés". A guard that declines to fire where it cannot discriminate is not a vulnerability.

(4) BLAST RADIUS IS ONE ROW AND SELF-HEALING, WITH ZERO ADVERSARIAL REACHABILITY. Worst case at the measured state is 1 local row with stripe_status='canceled' + ends_at=now(). No Stripe call is made; Stripe remains authoritative and the next webhook or next daily reconcile repairs it. No remote or authenticated user can influence any input — the sole lever is the production .env, and an actor able to write it already owns the deployment.

RESIDUAL VALUE: the one real observation is the CORRELATED SILENCE — both the layer-1 boot guard and the layer-3 email alert key off app()->isProduction(), so a non-production APP_ENV drops both together. That is genuine, but it is a general property of the app's whole alerting design (an already-accepted pattern, consistent with prior rounds finding the "single unthrottled endpoint"-style premises systemically false), not specific to the kill switch, and it carries no attacker-reachable scenario. Per the brief, an ops-typo is not an adversarial attack and pushes severity down.

VERDICT: The finding is not reproducible as described — the primary trigger branch is blocked by the resource_missing-only gate, and the alleged defect is a documented, correct design tradeoff. This is at most an INFO-grade observation about guard resolution limits on a tiny dataset, not a MEDIUM. Recommend closing as REFUTED, noting the correlated-silence observation for the record.

> **Talált mitigáció:** Multi-layer: (1) reconcile() only treats InvalidRequestException with getStripeCode()==='resource_missing' as a close candidate — every other Stripe error (notably AuthenticationException from a revoked/invalid key) is RETHROWN at ReconcileStripeSubscriptions.php:164, caught by the per-subscription catch(\Throwable) at :79-84, and counted as $failed, never as a CloseDecision. This eliminates the finder's branch (b) for all but a valid-key-for-a-foreign-live-account. (2) On the real VPS, non-production APP_ENV coexists with a test-mode key retrieving test-mode subscriptions — these resolve normally, producing no resource_missing and no closure. (3) markAsCanceled() writes only local columns; Stripe stays the source of truth, so the divergence self-heals on the next customer.subscription.updated webhook or the following day's reconcile run (which sees a live sub and syncStripeStatus()-es it back). (4) Every trigger path requires write access to the production .env — an actor with that capability can grant Pro directly and has no need of this path.

**2. szavazat — REFUTED** (`refuted=true`, javasolt: INFO)

A finder MINDEN kód-idézete pontos (MIN_KILL_COUNT_FOR_GUARD=5 a :43-on, tripsKillSwitch :126-133, prefix-only guard :128, AlertAdminOfLoggedError:41), de a leletet kiváltó ÁLLAPOT-premisszák hamisak, ezért a forgatókönyv nem áll össze.

MEGDŐLT PREMISSZA 1 (a legfontosabb): „A VPS APP_ENV NEM production". A finder a repo .env:2 `APP_ENV=local` sorát hozza bizonyítékként — de ez a /Applications/XAMPP/xamppfiles/htdocs/topEwords/.env, a fejlesztő lokális gépe. Ugyanebben a fájlban APP_DEBUG=true, amit az assertDebugDisabledInProduction prodban RuntimeException-nel elutasít → ez a fájl definíció szerint nem a prod-konfig. A VPS dokumentált .env-je: APP_ENV=production, APP_DEBUG=false. Következmény: prodban az 1. réteg fut, ÉS az AlertAdminOfLoggedError sem esik ki — vagyis a finder legerősebb retorikai fogása („ahol az 1. réteg nem fut, ott a 3. sem") érvénytelen: a két réteg ugyanazon a feltételen (isProduction) áll, tehát EGYÜTT aktívak, nem együtt hiányoznak.

MEGDŐLT PREMISSZA 2: a mért „1 aktív előfizetés" élő fizető állományként való kezelése. A VPS test-módban fut, élő Stripe-kulcs nélkül; a 8 subscription / 2 user a fejlesztő fixture-je. A lelet állított hatása (Pro-hozzáférés elvesztése, Stripe tovább terhel, ends_at felülírása) LIVE fizető előfizetőt igényel → jelenleg nincs kár-felület.

Az (b) alforgatókönyv (prodban sk_live_ prefixű, de MÁS FIÓK kulcsa) valós rés a prefix-only ellenőrzésben, de: (i) nem kombinálható a mért 1-soros test-módú állománnyal — nincs olyan állapot, ahol mindkettő fennáll; (ii) prodban ilyenkor az AlertAdminOfLoggedError AKTÍV, tehát a Log::critical e-mailt is szül (Notification::route + notifyNow, szinkron küldés) → nem „néma" divergencia; (iii) ops-elgépelés, nem adverzariális vektor, alacsony bekövetkezési valószínűséggel.

A kihagyott negyedik fedő réteg: a destruktív ág belépési feltétele a resource_missing kivétel. Egyező kulcs ↔ adat esetén nincs kivétel, nincs CloseDecision, nincs markAsCanceled. A tömeges lezáráshoz kulcs/fiók-mismatch kell — pontosan az, amit az 1. réteg (prodban) és a go-live checklist céloz.

A MIN_KILL_COUNT küszöb alatti inertség nem defekt: a ReconcileStripeSubscriptionsTest:208 és :243 explicit őrszem-tesztek arra, hogy a legitim kis-állományú lezárás MENJEN át. Ez tervezési kompromisszum (a parancs célja épp a beragadt sorok lezárása), nem kihagyott védelem.

Marad INFO-szintű megfigyelés (forgatókönyv nélkül, ezért nem MEDIUM/LOW): (1) a prefix-only sk_test_ ellenőrzés nem fogja a rossz FIÓKÚ sk_live_ kulcsot — go-live előtt érdemes a kulcs mellé egy tényleges Stripe account-id/ping ellenőrzést tenni; (2) a kör-fék a go-live utáni első néhány fizető előfizetőnél szerkezetileg nem tud védeni. Egyik sem kihasználható, egyiknek sincs jelenlegi blast radiusa.

Verdikt: REFUTED (a kiváltó premisszák hamisak + több fedő védelem prodban aktív). A megmaradó észrevétel súlya INFO, nem MEDIUM.

> **Talált mitigáció:** A finder két kiváltó premisszája közül mindkettő hamis a valós állományon. (1) A VPS APP_ENV=production — a hivatkozott `.env:2 APP_ENV=local` a LOKÁLIS XAMPP dev-példány fájlja, nem a VPS-é; ugyanez a fájl APP_DEBUG=true-t tartalmaz, amit az AppServiceProvider:82-88 assertDebugDisabledInProduction PRODBAN boot-hibával elutasít → bizonyítottan nem lehet ez a prod-konfig. A dokumentált VPS .env: APP_ENV=production, APP_DEBUG=false. Így prodban app()->isProduction() TRUE → az 1. réteg (assertStripeSecretMatchesEnvironment) FUT, ÉS az AlertAdminOfLoggedError:41 early-return NEM lép be → a 3. (riasztási) réteg is fut. A finder központi érve („pontosan ott nem fut a 3. réteg, ahol az 1. sem") csak a fejlesztői laptopra igaz, ahol nincs fizető felhasználó. (2) A mért „1 aktív előfizetés" TEST-MODE adat: a VPS szándékosan test-módban fut, élő kulcs nélkül (2026-06-30 döntés, a go-live monetizáció elhalasztva); Subscription::count()=8, User::count()=2 = a fejlesztő saját fixture-jei. A hivatkozott hatás („a fizető felhasználó elveszti a Pro-t, a Stripe tovább terhel") LIVE-módú fizető állományt igényel, ami még nem létezik → a mai blast radius NULLA. Negyedik, a finder által kihagyott fedő réteg: a markAsCanceled() csak azokra a sorokra fut, ahol az asStripeSubscription() resource_missing-et dob; EGYEZŐ test-kulcs + test-módú sorok esetén a retrieve sikeres, a close-ág sosem aktiválódik — kulcs/adat-mismatch kell hozzá, és az az környezet (production) épp az, ahol az 1. és 3. réteg aktív. Végül a MIN_KILL_COUNT_FOR_GUARD=5 küszöb alatti inertség nem rés, hanem a dokumentált és tesztelt SZÁNDÉK (a 243. sori teszt épp azt rögzíti, hogy a legitim „1-2 beragadt sor" kis állományon MENJEN át) — egy 1-az-1-nél tripelő fék a parancs teljes létértelmét blokkolná; a finder ezt a tesztet úgy idézi, mintha a rést kimondaná, holott a szándékolt viselkedést mondja ki.

**3. szavazat — REFUTED** (`refuted=true`, javasolt: LOW)

A finder három hordozó premisszája közül kettő HAMIS, a harmadik (a leg­ijesztőbb „néma" tulajdonság) pedig csak a hamis ágban áll fenn.

1) PREMISSZA (a) HAMIS — rossz .env-et olvasott. A `.env:2 APP_ENV=local` a LOKÁLIS FEJLESZTŐI .env: ellenőrizve `APP_URL=http://localhost:8000`, `DB_HOST=127.0.0.1`, `DB_DATABASE=topewords`, `APP_DEBUG=true`, `STRIPE_SECRET=sk_test_…`. A deployolt VPS .env Ploi-menedzselt, `APP_ENV=production` + `APP_DEBUG=false` (project_vps_deployment: „.env essentials (Ploi → Environment): APP_ENV=production, APP_DEBUG=false"). A finder egy dev-fájlt tulajdonított a prodnak. Ráadásul ez a .env production módban nem is tudna elindulni: assertDebugDisabledInProduction (AppServiceProvider:80-89) RuntimeException-t dob APP_DEBUG=true-ra, és assertStripeSecretMatchesEnvironment (:128) dob a sk_test_ prefixre. Vagyis az általa leírt konfiguráció boot-blokkolt, nem néma sebezhető.

2) A MÉRÉS ROSSZ ADATBÁZISON KÉSZÜLT. Újramérve: `config('app.env')=local`, `database=topewords`, `users=2`, `active=1`, `total=8`. Ez a lokális dev DB — a prod a VPS MySQL `topwords`, a valós importált user-állománnyal. A lelet CÍME („a JELENLEGI állományon TELJESEN INERT, 1 aktív előfizetés") tehát egy olyan adatbázison mért számra épül, amelyen az ütemezett parancs valós pénzzel soha nem fut. Ez nem bizonyíték a produkciós populációról.

3) A „3. réteg is kiesik" COUPLING HAMIS a megmaradó ágban. A (b) ág (sk_live_ prefixű, de MÁS fiók kulcsa) definíció szerint `APP_ENV=production` — ezért az AlertAdminOfLoggedError:41 `if (! app()->isProduction()) return;` NEM lép be, a Log::critical → szinkron notifyNow admin-e-mail elmegy (ADMIN_EMAIL kitöltve). A finder legerősebb állítása („pontosan abban a konfigurációban, ahol az 1. réteg nem fut, a 3. sem") kizárólag az (a) ágra igaz, ami a deployolt környezetre hamis.

AMI MEGMARAD (és már dokumentált LOW): a MIN_KILL_COUNT_FOR_GUARD=5 padló SZÁNDÉKOS tervezési kompromisszum — a kód kommentje (:39-43) és a saját teszt (ReconcileStripeSubscriptionsTest:243-255) is kimondja. 5 alatti jelöltszámnál a ráta-fék nem akad be, így egy rossz-fiókú sk_live_ kulccsal (P7-L1 prefix-only boot-guard rés) elvileg legfeljebb 4 sor záródhat le körönként. Súlyosbító tényező, amit a finder NEM idézett, de én ellenőriztem: a StripeWebhookController::handleCustomerSubscriptionUpdated resurrect-guard (:206-222) egy helyileg `canceled` sorra érkező későbbi `updated` webhookot ELDOB → a téves lezárás NEM öngyógyul. Ez viszont blast-radiusban is LOW: (i) feltétel = egy MÁS Stripe-fiók éles kulcsának telepítése prodba (ops-elgépelés, nem adverzariális támadás, alacsony valószínűség), (ii) maximum 4 sor, (iii) HANGOS (soronkénti Log::critical + prod admin-e-mail), (iv) operátorral triviálisan visszafordítható (stripe_status/ends_at visszaírás vagy Cashier syncStripeStatus), (v) a Stripe-oldali előfizetés érintetlen, tehát pénz nem veszik el, csak a helyi entitlement divergál. Ez pontosan a 2026-07-21-i kör P7-L1/P7-L2 LOW-jainak területe, nem MEDIUM.

MELLÉKLELET — PLAN-feltevés MEGDŐLT: a „a repo .env tükrözi a deployolt konfigurációt" implicit feltevés hamis; a lokális .env (localhost, sk_test_, APP_DEBUG=true) és a VPS Ploi-.env két különböző állapot, és a boot-guardok pontosan a kettő összekeveredését (test-kulcs prodban) fogják meg fail-closed módon.

Verdikt: REFUTED (a hordozó premisszák hamisak). A maradék, valós megfigyelés súlya LOW — és már lezárt/dokumentált LOW.

> **Talált mitigáció:** Két egymást fedő boot-guard zárja ki a finder (a) ágát: AppServiceProvider::assertDebugDisabledInProduction (:80-89) hard-throw APP_DEBUG=true + production esetén, és assertStripeSecretMatchesEnvironment (:120-136) hard-throw sk_test_ kulcsra prodban — azaz pontosan az a .env, amit a finder bizonyítékként idéz (.env:2 APP_ENV=local, APP_DEBUG=true, sk_test_), production módban NEM bootol. A megmaradó (b) ágban (sk_live_ rossz fiók, APP_ENV=production) app()->isProduction() definíció szerint TRUE, ezért az AlertAdminOfLoggedError:41 korai return NEM fut → a closeDeadSubscription() Log::critical-ja (:197) szinkron (notifyNow) admin-e-mailt küld a beállított ADMIN_EMAIL-re. A lezárás tehát hangos és operátorral triviálisan visszafordítható (stripe_status/ends_at visszaírás, ill. Cashier resync), maximum 4 soron.

---

## P7D-2 — TEST-1 MEGERŐSÍTVE: a reconcile active() scope kizárja a past_due-t → a dunning-bukás VÉGLEG past_due-ban ragad, a napi egyeztetés soha nem látja újra

| | |
|---|---|
| **Fájl:sor** | `app/Console/Commands/ReconcileStripeSubscriptions.php:86` |
| **Végső súlyosság** | **LOW** |
| **Verifikációs verdikt** | CONFIRMED — 0/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: user előfizetése past_due lesz (kártya-elutasítás). Vagy a webhook írja be, vagy a reconcile maga (reconcile() :215-227 → syncStripeStatus() → stripe_status='past_due', ReconcileOutcome::Synced). Ezután a Stripe dunning lezajlik és a sub canceled/unpaid lesz — DE a customer.subscription.deleted webhook elveszik. A napi cashier:reconcile-subscriptions `Subscription::query()->active()` scope-ot használ, amely a Cashier::$deactivatePastDue=true default miatt EXPLICITEN kizárja a past_due-t (mérve a raw SQL-ben). Hatás: a helyi sor véglegesen `past_due` + `ends_at=null` marad; a self-healing lánc, amiért a parancs egyáltalán létezik, épp erre az állapotra nem hat. Adat-szemét (örökre nyitott sor); jogosultsági kár NINCS, mert az activeSubscription() is deactivatePastDue-t követ, tehát a user már nem kap Pro-t.

### Bizonyíték

Mért raw SQL (`Subscription::query()->active()->toRawSql()`): `... and stripe_status != 'incomplete_expired' and stripe_status != 'unpaid' and stripe_status != 'past_due' and stripe_status != 'incomplete'`. Cashier Subscription.php:254-256 `if (Cashier::$deactivatePastDue) { $query->where('stripe_status','!=',STATUS_PAST_DUE); }`. Az app SOHA nem állítja át a flag-et: `grep -rn 'deactivatePastDue' app config bootstrap` → csak KOMMENTEK (User.php:110, PricingController.php:82, SubscriptionController.php:69), egyetlen `Cashier::$deactivatePastDue = ` értékadás sincs. A teszt ezt a rést nem fedi: ReconcileStripeSubscriptionsTest.php:163 csak azt gyakorolja, hogy egy LOKÁLISAN active sor past_due-ra szinkronizál — a fordított (már lokálisan past_due) irányra nincs teszt.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nincs pénzhatás és nincs jogosultsági kár: a past_due sor a deactivatePastDue miatt már nem ad Pro-belépést, tehát a „beragadt ingyen prémium" — amiért a parancs készült — NEM következik be. A kár tisztán adathigiéniai (soha le nem záruló sor a subscriptions táblában).

**Miért nem alacsonyabb:** Nem puszta megfigyelés: konkrét, végigszámolt forgatókönyv, amelyben a self-healing mechanizmus egy valós állapotra bizonyítottan nem hat, és amelyet a meglévő teszt-készlet is elkerül.

### Verifikációs szavazatok

**1. szavazat — CONFIRMED** (`refuted=false`, javasolt: MEDIUM)

A finder MINDEN tényállítását ellenőriztem a valós app- és vendor-kódban; egyik premissza sem dőlt meg.

MEGERŐSÍTETT PREMISSZÁK:
1. `ReconcileStripeSubscriptions.php:67` valóban `Subscription::query()->active()->cursor()` — a kör bemenete a Cashier `active()` scope.
2. Vendor `Cashier.php:58`: `public static $deactivatePastDue = true;` (default). `Subscription.php:254-256`: `if (Cashier::$deactivatePastDue) { $query->where('stripe_status','!=',STATUS_PAST_DUE); }` — szó szerint ahogy a finder idézte.
3. A flag-et az app SOHA nem állítja át. `grep -rn 'deactivatePastDue' app config bootstrap routes` → 3 találat, MIND komment (User.php:110, PricingController.php:82, SubscriptionController.php:69), egyetlen értékadás sincs. A `Providers/*.php`-ban sincs `Cashier::` hívás. A `keepPastDueSubscriptionsActive()` (vendor Cashier.php:191) soha nem hívódik.
4. A mért raw SQL-t magam is újrafuttattam: `... and stripe_status != 'incomplete_expired' and stripe_status != 'unpaid' and stripe_status != 'past_due' and stripe_status != 'incomplete'` — pontosan egyezik a finder bizonyítékával.
5. A past_due-t beíró út létezik: `reconcile()` :174-186 → `syncStripeStatus()` → `stripe_status='past_due'`, `ReconcileOutcome::Synced`. `ends_at` érintetlen (null) marad, tehát a következő körben a sor a scope-on kívül esik → soha többé nem olvassa. A self-healing lánc valóban pont erre az állapotra vak.
6. A teszt-rés is áll: `ReconcileStripeSubscriptionsTest.php` „az eltérő, de élő státuszt (pl. past_due) szinkronizálja" teszt `localStatus: 'active'`-ból indul — a fordított (lokálisan MÁR past_due) irányra nincs teszt. A kör-fék tesztjei (`seedActiveSubscriptions`) mind `active` sorokat vetnek.

CÁFOLATI KÍSÉRLETEIM — MIND KUDARCOT VALLOTT:
- Webhook-alternatíva: a Cashier `handleCustomerSubscriptionDeleted` (WebhookController.php:217-228) valóban gyógyítana, de a forgatókönyv premisszája épp az, hogy ez az esemény elveszett. Nem mitigáció.
- User-oldali kiút: `SubscriptionController::cancel()` :122 és `resume()` :147 MINDKETTŐ `activeSubscription()`-t hív, ami past_due-nál null → `cancel()` `return back()` (:125) no-op, `resume()` „Nincs visszavonható lemondás." Egyik sem tudja lezárni a sort.
- Entitlement: a finder állítása helyes, `activeSubscription()` (User.php:94-100) `valid()`-ot követ, ami deactivatePastDue-t tiszteli (vendor Subscription.php:234) → a user NEM kap Pro-t. Jogosultsági kár tényleg nincs.

AMIT A FINDER ALÁBECSÜLT (súlyosság-emelés indoka LOW→MEDIUM):
A finder „adat-szemét, jogosultsági kár nincs"-ként minősíti, de van egy valós, felhasználót érintő funkcionális következmény, amit nem vett észre: `PricingController.php:86-88` egy dedikált kapu — `if ($subscription === null && $user->hasPastDueSubscription()) { return redirect()->route('subscription.edit')->with('info', 'A meglévő előfizetésed sikertelen terhelés miatt szünetel. Új előfizetés helyett frissítsd a kártyaadataidat...'); }`. `hasPastDueSubscription()` (User.php:114-120) pontosan `stripe_status='past_due' AND ends_at IS NULL`-t keres — vagyis EXAKTUL a beragadt sort. Következmény: a beragadt sor VÉGLEG kizárja a felhasználót az újra-előfizetésből, és egy TÉNYSZERŰEN HAMIS üzenetre tereli („frissítsd a kártyát, a hozzáférés magától visszaáll") — miközben a Stripe-nál a sub már canceled/nem létezik, tehát semmilyen kártyafrissítés nem indít újra terhelést. A fizetni AKARÓ user önerőből nem tud fizetni, és a hibaüzenet félrevezeti. Ez nem puszta adat-hygiene: elveszett bevétel + support-teher, önkiszolgáló kiút nélkül.

Súlyosság MEDIUM, nem HIGH: valós kár, de szűk feltétel-lánc kell (past_due-ba esés ÉS a rá következő terminális webhook elvesztése), nincs adverzariális kihasználhatóság, nincs jogosultság-emelés, és a blast radius egy-egy user (nem tömeges). A javítás iránya: a reconcile ne az `active()` scope-on iteráljon, hanem a „lokálisan nyitott" halmazon (`whereNull('ends_at')->where('stripe_status','!=','canceled')`), hogy a past_due/unpaid/incomplete sorokat is visszaellenőrizze.

> **Talált mitigáció:** Nincs blokkoló mitigáció. Minden potenciális gyógyító út zárt: a webhook (a forgatókönyv premisszája szerint elveszett), a `cancel()`/`resume()` mindkettő `activeSubscription()`-ön keresztül megy (ami past_due-nál null → `return back()` no-op), és a napi reconcile `active()` scope-ja explicit kizárja a past_due-t. Az egyetlen kézi kiút a Stripe billing-portál vagy admin DB-beavatkozás — egyik sem automatikus self-healing.

---

## P7D-3 — ALERT-1 MEGERŐSÍTVE (nyitva): üres ADMIN_EMAIL → mind a HÁROM riasztási út némán elhal, boot-guard nincs, a .env.example üresen szállítja

| | |
|---|---|
| **Fájl:sor** | `config/app.php:27` |
| **Végső súlyosság** | **LOW** |
| **Verifikációs verdikt** | CONFIRMED — 0/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: friss prod-deploy .env.example-ből, ADMIN_EMAIL kitöltése kimarad (a példa-fájl `ADMIN_EMAIL=` üresen szállít). Hatás mindhárom úton: (1) MonitorFailedJobs:46-51 → `$this->error(...)` + return FAILURE — a cron STDERR-je tipikusan nem olvasott, de legalább nem-nulla exit; (2) AlertAdminOfQueueBacklog:24-28 → `return;` NÉMÁN, a QueueBusy esemény elveszik; (3) AlertAdminOfLoggedError:44-48 → `return;` NÉMÁN. Vagyis pont a 2026-07-22-i elmaradt-NAV-számla incidens detektálási lánca esik ki teljesen, hangtalanul. Az AppServiceProvider::boot() négy másik env-hézagra (APP_ENV, APP_DEBUG, STRIPE_WEBHOOK_SECRET, STRIPE_SECRET) fail-closed boot-guardot tesz — az ADMIN_EMAIL kimaradt ebből a mintából.

### Bizonyíték

config/app.php:27 `'admin_email' => env('ADMIN_EMAIL'),` — nincs default, nincs validáció. .env.example:78 `ADMIN_EMAIL=` (üres). AppServiceProvider.php:30-35 boot(): assertKnownEnvironment / assertDebugDisabledInProduction / assertStripeWebhookSecured / assertStripeSecretMatchesEnvironment — ADMIN_EMAIL-guard NINCS (`grep -rn 'admin_email' app/Providers/` → 0 találat). AlertAdminOfQueueBacklog.php:24-28 és AlertAdminOfLoggedError.php:44-48: néma `return`. A viselkedés TESZTELT (QueueMonitoringTest.php:72, :108, ErrorLogMonitoringTest.php:104) — vagyis a némaság szándékolt és rögzített.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Tisztán ops-konfigurációs hézag, nem támadási felület; a jelenlegi éles .env-ben az ADMIN_EMAIL KI VAN töltve (mérve: .env:67), tehát nem aktuálisan fennálló hiba, csak egy jövőbeli újratelepítés csapdája.

**Miért nem alacsonyabb:** Nem INFO: konkrét deploy-forgatókönyv konkrét hatással (a teljes riasztási lánc néma kiesése), és a projektben LÉTEZIK a bevett fail-closed boot-guard minta, amelybe ez a mező következetlenül nem került be.

### Verifikációs szavazatok

**1. szavazat — CONFIRMED** (`refuted=false`, javasolt: LOW)

A finder MINDEN tényállítását ellenőriztem a valós kódban, és mind IGAZ — egyetlen hamis premissza sincs, ezért refuted=false.

Ellenőrzött tények:
- config/app.php:27 → `'admin_email' => env('ADMIN_EMAIL'),` — default nélkül, validáció nélkül. PONTOS.
- .env.example:78 → `ADMIN_EMAIL=` üresen. PONTOS.
- app/Console/Commands/MonitorFailedJobs.php:38-43 → `$this->error('Nincs ADMIN_EMAIL beállítva…')` + `return self::FAILURE`. PONTOS (nem-nulla exit, de a cron STDERR tipikusan nem olvasott).
- app/Listeners/AlertAdminOfQueueBacklog.php:21-24 → néma `return;`. PONTOS.
- app/Listeners/AlertAdminOfLoggedError.php:45-48 → néma `return;`. PONTOS.
- AppServiceProvider::boot() (30-38) valóban négy boot-guardot hív (assertKnownEnvironment, assertDebugDisabledInProduction, assertStripeWebhookSecured, assertStripeSecretMatchesEnvironment) — és `grep -rn 'admin_email' app/Providers/` → 0 találat. A minta-aszimmetria VALÓS.
- A némaság TESZTELT és rögzített szerződés: QueueMonitoringTest.php:107-114 („ADMIN_EMAIL nélkül a torlódás-riasztás némán kimarad"), :72 (`assertExitCode(1)` a commandnál), ErrorLogMonitoringTest.php:104-112. PONTOS.
- Mindhárom út tényleg ugyanarra az egy config-kulcsra van kötve, tehát egyetlen üres env-változó egyszerre viszi el a failed-job, a queue-torlódás és a prod error-log detektálást — vagyis pont a 2026-07-22-i elmaradt-NAV-számla incidens detektálási láncát.

Súlyosság: a finder LOW-ja HELYTÁLLÓ, nem kell lefelé vinni INFO-ra, de MEDIUM-ra sem emelni:
- MEDIUM ellen: a trigger ops-elgépelés/kihagyás, NEM adverzariális — távoli szereplő nem tudja sem kiváltani, sem kihasználni. A hatás másodrendű (detektálás-vesztés), nem közvetlen adat-/pénzvesztés vagy auth-rés. A bekövetkezési valószínűséget két dolog nyomja: a .env.example explicit figyelmeztető kommentje és az isAdmin() fail-closed viselkedése (403-oló admin-felület = hangos, azonnali tünet). Az éles .env-ben az érték be van állítva.
- INFO ellen: van konkrét állapot → konkrét hatás lánc, a projekt SAJÁT bevett boot-guard mintájától való következetlen eltérés, és épp azt a hibamódot érinti, ami ebben a projektben MÁR EGYSZER bekövetkezett (elmaradt NAV-számla). Ez több, mint forgatókönyv nélküli megfigyelés.

Egy pontosítás a lelet címéhez: a „a .env.example üresen szállítja" igaz, de a „némán" szó itt félrevezető — a példa-fájl két kommentsorban pont ezt a vakfoltot írja le. A némaság a FUTÁSIDEJŰ viselkedésre igaz (2 listener), a MonitorFailedJobs pedig nem is néma (error + exit 1). Javasolt fix ugyanaz, amit a finder implikál: egy ötödik boot-guard (`assertAdminEmailConfigured`) a meglévő minta szerint, prodban.

> **Talált mitigáció:** Nincs blokkoló mitigáció. Két, a finder által NEM említett részleges ellensúly van: (1) a `.env.example:76-77` két kommentsora pont ezt a hibamódot dokumentálja („Élesben KÖTELEZŐEN kitöltendő — üresen a MonitorFailedJobs riasztás csendben elmarad (observability-vakfolt)"), tehát a példa-fájl NEM tájékoztatás nélkül szállítja üresen; (2) `User::isAdmin()` (app/Models/User.php:179-186) UGYANARRA a config-értékre fail-closed (`$adminEmail !== null && ...`), így üres ADMIN_EMAIL mellett az `admin` gate MINDENKIT megtagad → a teljes /admin felület 403-ol. Ez egy azonnal látható, hangos tünet friss deploykor: az üzemeltető egyáltalán nem tud belépni az adminba. Ez nem szünteti meg a riasztási vakfoltot, de erősen csökkenti annak esélyét, hogy a félrekonfigurálás hosszan észrevétlen maradjon. Emellett az éles .env-ben az érték BE VAN állítva (.env:67), és a tétel nyitott ops-checklist-elemként követve van (project_queue_monitoring.md).

---

## P7D-4 — SCHED-3 MEGERŐSÍTVE (nyitva): a stripe_webhook_events tábla korlátlanul növekszik, prune sem ütemezett, sem Prunable

| | |
|---|---|
| **Fájl:sor** | `app/Http/Controllers/StripeWebhookController.php:49` |
| **Végső súlyosság** | **INFO** (finder: LOW → **INFO**) |
| **Verifikációs verdikt** | CONFIRMED — 0/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: minden bejövő Stripe-esemény insertOrIgnore-ral idempotencia-markert ír a stripe_webhook_events táblába; a marker CSAK kivétel esetén törlődik (:68), sikeres feldolgozásnál szándékosan MARAD (ez az idempotencia lényege). Hatás: a tábla monoton nő az app életciklusán át. Nincs prune: sem `Schedule::command('model:prune')`, sem Prunable trait, sem manuális törlő parancs. A `sanctum:prune-expired` mintát a projekt ismeri (routes/console.php), erre a táblára nem alkalmazta. Jelen méret mérve: 0 sor (test-mode), tehát a hatás jövőbeli és lassú (esemény/hó nagyságrend).

### Bizonyíték

`grep -rn 'stripe_webhook_events' app database routes` → 4 találat: StripeWebhookController.php:49 (insertOrIgnore), :68 (delete CSAK hiba-ágon), és a create/drop migráció (2026_07_17_183925). `grep -rn 'prune|Prunable' app/Models` → 0 érdemi találat (AiWordCache.php:15 csak KOMMENTBEN veti el a Prunable-t). `php artisan schedule:list` → 4 feladat, egyik sem prune-olja ezt a táblát. Mérve: `DB::table('stripe_webhook_events')->count()` = 0.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nincs sem biztonsági, sem korrektségi hatás — az idempotencia pontosan attól működik, hogy a marker megmarad. A növekedés üteme az előfizetői forgalommal skálázódik, ami a mért állomány (1 aktív sub) mellett évekig elhanyagolható; a tábla két indexelt oszlop.

**Miért nem alacsonyabb:** Nem INFO: van konkrét, ha lassú, hibamód (határtalan tábla-növekedés go-live után), és a projekt saját, máshol alkalmazott prune-mintája ide bizonyítottan nem került be — azonosítható hézag, nem puszta megfigyelés.

### Verifikációs szavazatok

**1. szavazat — CONFIRMED** (`refuted=false`, javasolt: INFO)

A finder MINDEN tényállítását ellenőriztem a valós kódban, és mindegyik IGAZ:

1. `StripeWebhookController.php:49` insertOrIgnore — minden aláírt, id-vel bíró eseményre ír marker-sort. IGAZ.
2. A `:68` delete KIZÁRÓLAG a catch-ágon fut; sikeres feldolgozásnál a sor szándékosan marad (ez maga az idempotencia-mechanizmus, tehát nem is törölhető egyszerűen). IGAZ.
3. Nincs prune SEMMILYEN formában — és ez erősebb, mint a finder állította: nincs `Prunable`/`MassPrunable` sehol, nincs `model:prune` az ütemezésben, nincs manuális törlő parancs, nincs `TRUNCATE`, és nincs későbbi migráció, ami hozzáérne. RÁADÁSUL nincs Eloquent modell ehhez a táblához (az `app/Models/`-ben nincs StripeWebhookEvent), így a `model:prune` akkor sem érné el, ha valaki beütemezné — a javítás tehát több egy schedule-sornál.
4. A `schedule:list` 4 feladata közül egyik sem prune-olja ezt a táblát (a routes/console.php olvasásával megerősítve). A projekt ismeri a mintát (`sanctum:prune-expired --hours=24`, expliciten „hogy a tábla ne hízzon" kommenttel) és itt nem alkalmazta — ez a következetlenség valós.
5. `AiWordCache.php:15` csak KOMMENTBEN veti el a Prunable-t. IGAZ.

Tehát a lelet NEM megdönthető: a tábla valóban monoton nő, korlát és takarítási út nélkül.

MIÉRT INFO mégis LOW helyett: a finder maga is „jövőbeli és lassú" hatást ír, de nem kvantifikálja. Mért sorszélesség ~160 B. Reális 8 Stripe-esemény/fizető/hó mellett: 100 előfizető → ~1,5 MB/év; 1 000 → ~15 MB/év; 10 000 → ~150 MB/év. Ennek a projektnek a léptékén (egyetlen fizetős ár 1990 Ft, jelenleg 0 sor, test mode) a tábla több év alatt egyjegyű megabájtig jut. Lekérdezés-degradáció sincs. Nincs tehát hibaforgatókönyv — se disk-kimerülés, se lassulás, se funkcionális törés — bármely belátható időhorizonton. A módszer szerint az a lelet, amelynek forgatókönyve „a tábla 2035-ben kissé nagyobb", forgatókönyv nélküli megfigyelés, azaz INFO.

Egy pontosítás a jegyzőkönyvhöz: ez higiéniai/konzisztencia-adósság, NEM ütemezett-parancs vagy riasztási defekt, tehát a Fázis 7 scope szélén áll — a `schedule:list` hozta felszínre, de a tényleges hézag a webhook/adatmegőrzési rétegben van.

A leendő javításhoz (nem lelet): a megőrzési idő legyen hosszabb a Stripe újraküldési ablakánál (a Stripe ~3 napig retryol, és dashboardról később kézzel is újraküldhető) — a túl agresszív prune (pl. 24 h) újranyitná pont azt a dupla-feldolgozási rést, amiért a tábla létezik. Biztonságos bound ~30+ nap, és modellt vagy raw-query parancsot igényel.

> **Talált mitigáció:** Nincs blokkoló mitigáció — a lelet ténybelileg áll. Ami a súlyt leviszi, az nem védelem, hanem a nagyságrend: mért sorszélesség ~160 B (unique index-bejegyzéssel együtt; az `evt_` id ~28 karakter, nem 255), és az egyetlen olvasási út az insert unique-index próbája, ami O(log n) — nincs lekérdezés-degradáció tízmilliós sorszámig sem.

---

## P7D-5 — SCHED-1 MEGERŐSÍTVE (nyitva): a 4 ütemezett feladaton nincs onFailure / pingOnFailure / heartbeat — leállt schedule:run cron észrevétlen (a riasztók MAGA is ütemezett)

| | |
|---|---|
| **Fájl:sor** | `routes/console.php:22` |
| **Végső súlyosság** | **LOW** |
| **Verifikációs verdikt** | CONFIRMED — 0/1 refuted |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: a Ploi-beli `schedule:run` cron leáll (szerver-újratelepítés, elrontott crontab, PHP-verzió-váltás miatt hibás bináris-útvonal). Hatás: körkörös vakság — mind a queue:alert-failed, mind a queue:monitor MAGA is ütemezett feladat, tehát a scheduler kiesésével pont az a lánc esik ki, amely a néma queue-hibát (= elmaradt NAV-számla) jelezné, ÉS a napi cashier:reconcile-subscriptions is csendben leáll. Semmi nem szól: nincs sem onFailure(), sem pingOnFailure(), sem sendOutputTo/emailOutputOnFailure, sem külső dead-man-switch (healthchecks.io-típusú ping). Az egyetlen jel a laravel.log hiánya, amit senki nem figyel.

### Bizonyíték

routes/console.php:22-23,33,44: `Schedule::command('queue:alert-failed')->everyTenMinutes();` / `Schedule::command('queue:monitor', [...])->everyTenMinutes();` / `Schedule::command('sanctum:prune-expired --hours=24')->daily();` / `Schedule::command('cashier:reconcile-subscriptions')->daily();` — láncolt hook egyiken sem. `grep -rn 'onFailure|pingOnFailure|emailOutputOnFailure|withoutOverlapping|sendOutputTo' routes/console.php app/` → 0 találat. `php artisan schedule:list` megerősíti: pontosan 4 feladat, csupasz.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Ops-monitoring hézag, nem kód-defekt; kizárólag infra-esemény (leállt cron) váltja ki, és a memória szerint az uptime/erőforrás-monitoring külön nyitott ops-tételként már ismert. A tényleges pénz-kár csak akkor jelentkezik, ha EGYSZERRE áll a cron ÉS bukik egy Billingo-job.

**Miért nem alacsonyabb:** Nem INFO: a hibamód forgatókönyve konkrét és a hatása körkörös (a detektor önmaga az ütemezett feladat), ami a lánc egyetlen egypontos meghibásodása.

### Verifikációs szavazatok

**1. szavazat — CONFIRMED** (`refuted=false`, javasolt: LOW)

A finder MINDEN tényállítását ellenőriztem a valós kódban és a vendor-kódban; egyik premissza sem hamis.

MEGERŐSÍTVE:
1. routes/console.php:22,23,34,47 — mind a 4 Schedule::command() csupasz, láncolt hook egyiken sem.
2. Saját grep `onFailure|pingOnFailure|emailOutputOnFailure|withoutOverlapping|sendOutputTo|thenPing|pingOnSuccess|appendOutputTo` a routes/ app/ bootstrap/ config/ fákon → 0 találat (a finder grepjét megismételtem, egyezik).
3. Külső dead-man-switch nincs: healthchecks.io|cronitor|uptimerobot|betterstack|ohdear|pingdom|heartbeat|deadman → 0 találat; a composer.json nem tartalmaz monitoring-csomagot.
4. A framework ScheduledTaskFailed/ScheduledTaskSkipped eseményeire NINCS listener (app/Listeners/ pontosan 2 fájl, egyik sem az). Ráadásul ezek csak akkor tüzelnek, AMIKOR a schedule:run tényleg fut — strukturálisan képtelenek halott cront detektálni.
5. A körkörösség VALÓS: a queue:alert-failed és a queue:monitor maga a két everyTenMinutes() bejegyzés, tehát a halott scheduler pont a queue-hiba-riasztást viszi el.
6. bootstrap/app.php `health: '/up'` — nincs DiagnosingHealth listener, tehát csupasz 200 OK, nulla scheduler-tudat. Ez a legközelebbi mitigáció-jelölt, és nem mitigál.

EGY PREMISSZA PONTOSÍTÁSRA SZORUL (súlyt csökkent, nem dönt meg): a finder szerint „semmi nem szól", az egyetlen jel az olvasatlan laravel.log. Ez a legsúlyosabb esetre túlbecsüli a vakságot. A GenerateBillingoInvoice::failed() report()-ol (app/Jobs/GenerateBillingoInvoice.php:82), és az AlertAdminOfLoggedError a MessageLogged-re ül — scheduler-független ÉS queue-független (notifyNow, szinkron). Tehát egy véglegesen elbukott számla-job a cron kiesése ellenére is e-mailt küld. A maradék rés szűkebb a jelzettnél: a backlog-eset (leállt worker, a jobok meg sem próbálódnak) + a soha le nem futó reconcile — ezek valóban némák.

SÚLYOSSÁG: a maradék kockázat valós, de ops/infra-hygiene rés, nem adverzariális támadási felület. Előfeltétele operátori hiba (elrontott crontab, szerver-újratelepítés), a legsúlyosabb következményt pedig részben független riasztási út fedi. Ez LOW — egyezik a finder saját súlyozásával, nem indokolt sem felfelé, sem lefelé mozdítani. Nem távoli/kihasználható, nincs adatvesztés (a queue-jobok a táblában maradnak, a worker újraindítása után feldolgozódnak), tehát MEDIUM/HIGH nem áll.

> **Talált mitigáció:** Nincs blokkoló mitigáció. Részleges (nem blokkoló) mitigáció: az AlertAdminOfLoggedError a MessageLogged eseményre ül, NEM ütemezett és NEM queue-n keresztül küld (notifyNow) — így a GenerateBillingoInvoice::failed() -> report() (app/Jobs/GenerateBillingoInvoice.php:82) és a ReconcileStripeSubscriptions report()/Log::critical hívásai a scheduler kiesésétől FÜGGETLENÜL is e-mailt küldenek. Ez a legsúlyosabb következményt (véglegesen elbukott NAV-számla job) lefedi, de a backlog-esetet (leállt worker, a jobok meg sem próbálódnak, tehát nem is buknak el és nem logolnak) és a soha le nem futó reconcile-t nem. A bootstrap/app.php `health: '/up'` végpont NEM mitigáció: nincs DiagnosingHealth listener, csupasz 200 OK, nulla scheduler-tudattal.

---

## P7D-6 — P7-L4 MEGERŐSÍTVE (nyitva): a MonitorFailedJobs vízjele közönséges Cache-kulcs — cache:clear / optimize:clear után a táblában maradt bukásokról ÚJRA riaszt

| | |
|---|---|
| **Fájl:sor** | `app/Console/Commands/MonitorFailedJobs.php:21` |
| **Végső súlyosság** | **INFO** |
| **Verifikációs verdikt** | — (INFO, verifikáció nem indokolt) |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: N elbukott job van a failed_jobs táblában, a riasztás róluk már elment (vízjel = max id). Deploy közben `php artisan optimize:clear` (vagy `cache:clear`) törli a database cache store sorait, benne a vízjelet. A következő 10 perces körben `Cache::get(KEY, 0)` → 0 → `where('id','>',0)` az ÖSSZES még bent lévő bukást újra lejelenti egy e-mailben. Hatás: duplikált riasztó-levél; a helyes irányba téved (dupla > néma), és a kód KOMMENTBEN explicit tudatos döntésként vállalja.

### Bizonyíték

MonitorFailedJobs.php:19-22 komment: „Ha a cache-t kiürítik (pl. optimize:clear), a táblában még bent lévő bukásokról újra megy a riasztás — inkább duplán, mint sehogy." :26-29 `Cache::get(self::LAST_ALERTED_ID_CACHE_KEY, 0)`; :62 `Cache::forever(...)` a küldés UTÁN (helyes: sikertelen küldés nem lép vízjelet). Mért store: `config('cache.default')` = database, tehát a `cache:clear` valóban truncate-eli. Mért állapot: failed_jobs = 0 sor, tehát ma nulla hatás.

### Súlyosság-indoklás

**Miért nem súlyosabb:** A hibamód a fail-safe irányba téved (több levél, nem néma kiesés), a kód szándékos, dokumentált tervezési döntés, és a hatás egyetlen extra e-mail. Nincs adatvesztés, nincs pénz-hatás, nincs biztonsági él.

**Miért nem alacsonyabb:** Nem lehet lejjebb — az INFO a legalacsonyabb fokozat. Megfigyelésként érdemes rögzíteni, mert a korábbi kör leletét változatlanul fennállónak igazolja.

---

## P7D-7 — Teszt-hézag: a 6 console-parancs közül 2 (ImportWords, FixWordLevels) TELJESEN teszteletlen — épp a két legnagyobb blast-radiusú tömeges words-mutáció

| | |
|---|---|
| **Fájl:sor** | `app/Console/Commands/FixWordLevels.php:26` |
| **Végső súlyosság** | **LOW** |
| **Verifikációs verdikt** | — (INFO, verifikáció nem indokolt) |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: bárki (ember vagy jövőbeli refaktor) módosítja a FixWordLevels rank-sávjait vagy az ImportWords upsert-oszlopait. Hatás: semmilyen teszt nem bukik el — sem a ConfirmableTrait-guard megléte (a --force nélküli prod-viselkedés), sem a level-számítás korrektsége, sem az upsert kulcs/oszlop-listája nincs lefedve. A FixWordLevels egyetlen nyers `DB::update('UPDATE words SET level = CASE ...')`-tel a TELJES words táblát (10k sor) átírja, az ImportWords pedig `Word::upsert($data, ['word'], ['rank','level','updated_at'])`-tel írja felül. Így egy regresszió (pl. elrontott sáv-határ vagy elgépelt oszlopnév a --force-os deploy-scriptben) csendben, tesztjelzés nélkül átmehet, és a level alapú megjelenítés/limitek globálisan elcsúsznak.

### Bizonyíték

`grep -rn 'words:import|words:fix-levels|FixWordLevels|ImportWords' tests/` → EGYETLEN találat, és az sem teszt rájuk: WordTest.php:591 puszta KOMMENT („Mirrors ImportWords::handle, which bypasses the saving event via upsert()"). Kontrasztként a másik 4 parancs LEFEDETT: ai:cache:clear → AiCacheTest.php:43/63/80 (a --force/megerősítés-mátrix mindhárom ága), billing:end-trial → EndTrialNowTest.php:6/12/20, queue:alert-failed → QueueMonitoringTest.php (5 teszt), cashier:reconcile-subscriptions → ReconcileStripeSubscriptionsTest.php (9 teszt). A CLAUDE.md kimondja: „Every change must be programmatically tested."

### Súlyosság-indoklás

**Miért nem súlyosabb:** Nem futásidejű defekt, hanem lefedettségi hézag: a két parancs manuális, nincs ütemezve (`schedule:list` megerősíti), és a ConfirmableTrait+--force guard a kódban BENNE van, csak nincs őrszem-tesztje. Nincs adverzariális út.

**Miért nem alacsonyabb:** Nem INFO: a hézag konkrét és aszimmetrikus — pont a két legdestruktívabb (teljes-táblás) mutáción nincs egyetlen sor teszt sem, miközben a másik négyen részletes mátrix van, tehát ez következetlenség, nem semleges megfigyelés.

---

## P7D-8 — P7-L2 MEGERŐSÍTVE (nyitva): a kör-fék >50%-os sávja legitim tömeges lemondásnál is FAILURE-t ad, és nincs részleges kimenet

| | |
|---|---|
| **Fájl:sor** | `app/Console/Commands/ReconcileStripeSubscriptions.php:49` |
| **Végső súlyosság** | **INFO** |
| **Verifikációs verdikt** | — (INFO, verifikáció nem indokolt) |

### Forgatókönyv (bemenet/állapot → hatás)

Bemenet/állapot: kis-közepes állomány (pl. 8 aktív sub) és valós incidens — ár-emelés vagy szolgáltatás-kimaradás után 5 user tényleg lemond, ÉS az 5 customer.subscription.deleted webhook elveszik (pl. a 2026-07-22-i queue-drift mintája). killCount=5 ≥ MIN(5) ÉS 5/8=62,5% > 50% → a fék TRIPEL: SEMMIT nem zár le, FAILURE. Hatás: az 5 valóban halott sor helyileg aktív marad („ingyen prémium" pontosan abban a helyzetben, amiért a parancs készült), és a fék minden további napi körben újra tripel, amíg operátor kézzel be nem avatkozik. A Log::critical + $this->error hangos, tehát nem néma — de a self-healing tartósan blokkolt.

### Bizonyíték

ReconcileStripeSubscriptions.php:49-57 `MAX_KILL_RATIO = 0.5`; :148-155 `tripsKillSwitch()`: `($killCount / max($activeCount,1)) > self::MAX_KILL_RATIO`. :118-131 a tripelés ága: `Log::critical(...); $this->error(...); return self::FAILURE;` — nincs részleges lezárás, nincs fallback. A viselkedés tesztelt és szándékolt: ReconcileStripeSubscriptionsTest.php:191 → `expect($probe->closed)->toBeEmpty()`.

### Súlyosság-indoklás

**Miért nem súlyosabb:** Szándékos, hangos, fail-safe tervezési kompromisszum (inkább ne zárjunk le semmit, mint hogy egy kulcs-mismatch kinyírja az állományt), Log::critical + nem-nulla exit kód jelzi. A kár nem adatvesztés, hanem egy self-healing kör késleltetése, amit az operátor kézzel elvégezhet. A tripelés feltétele igen szűk.

**Miért nem alacsonyabb:** Nem lehet lejjebb — az INFO a legalacsonyabb fokozat; a korábbi kör leletének változatlan fennállását rögzíti.

---

## Megdőlt PLAN-feltevések (ebben a dimenzióban)

- MEGDŐLT — „REC-1 kettős védelem, LEZÁRVA": a 2026-07-21-i REFUTED verdikt a JELENLEGI konfigurációban ténybelileg hamis. Mért aktív állomány = 1 sub, a 2. réteg (kör-fék) MIN_KILL_COUNT_FOR_GUARD=5 küszöbe alatt matematikailag nem tud aktiválódni; az 1. réteg (boot-guard) pedig `if (! app()->isProduction()) return;`-gel azonnal visszatér, a .env-ben APP_ENV=local. A védelem nem kettős, hanem a korai életszakaszban NULLA rétegű (P7D-1).

- MEGDŐLT — „a ConfirmableTrait-fix megkerülhető nem-interaktív cron/CI alatt": a vendor-lánc végigkövetve az ELLENKEZŐJE igaz. ConfiguresPrompts.php:32 → Prompt.php:111-115 `if (! static::$interactive) { return $this->default(); }`, és a ConfirmableTrait `confirm(..., default: false)`-t hív → nem-TTY alatt a parancs FAILURE-rel, mutáció NÉLKÜL kilép. A fix FAIL-CLOSED; egyetlen megkerülés az explicit --force.

- MEGDŐLT — TEST-2 „a reconcile handle() teszteletlen": a handle() kör-fék-logikája négy handle()-szintű teszttel, valós DB-sorokon, a KillSwitchProbe alosztállyal teljesen lefedett (ReconcileStripeSubscriptionsTest.php:191/208/226/243). A lelet elavult.

- MEGDŐLT — „a boot-guardok (assertStripeSecretMatchesEnvironment / assertStripeWebhookSecured) teszteletlenek": négy őrszem-tesztjük van, csak nem az EnvironmentBootGuardTest-ben, hanem a StripeWebhookSecurityTest.php:8/20/44/48/53/57-ben. A fájlnév-alapú keresés vezette félre a korábbi kört.

- MEGDŐLT — a P7-L3 lelet („a 4 manuális destruktív parancson nincs prod-guard") LEZÁRHATÓ: a fix megvan, COMMITOLVA (git status üres, `git show HEAD:...` tartalmazza), és érdemben véd. A maradék hézag NEM a guard, hanem a hozzá tartozó teszt hiánya két parancson (P7D-7).

- MEGDŐLT — „az ops-elgépelés a fő REC-1 kockázat": a mért állapot szerint nem az elgépelés, hanem az ÁLLOMÁNY-MÉRET a domináns tényező. Az sk_test_ prefix-elgépelést a boot-guard prodban elkapja; a valódi rés a más-fiókú sk_live_ kulcs (P7-L1, továbbra is nyitva) KOMBINÁLVA az 5 alatti aktív állománnyal, ahol a fék inert.

- MEGERŐSÍTVE (nem dőlt meg) — SCHED-3, ALERT-1, P7-L1, P7-L2, P7-L4 és TEST-1 mind VÁLTOZATLANUL nyitva: nincs stripe_webhook_events prune (0 találat), nincs ADMIN_EMAIL boot-guard (0 találat app/Providers-ben), a prefix-guard továbbra is prefix-only, a fék 5–50% sávja változatlan, a vízjel közönséges cache-kulcs, és az active() scope raw SQL-je mérve kizárja a past_due-t.

- ÚJ, korábban nem rögzített tétel — a riasztási lánc HARMADIK rétege is APP_ENV-hez kötött: AlertAdminOfLoggedError.php:40-42 `if (! app()->isProduction()) return;`. A nem-production APP_ENV (a VPS test-mode) egyszerre némítja el a REC-1 boot-guardot ÉS a reconcile Log::critical-jából származó e-mail-riasztást — a két hézag KORRELÁLT, nem független, ami a P7D-1 forgatókönyv súlyát emeli.

- MEGERŐSÍTVE — BILL-3 (Fázis 2) a Fázis 7 oldaláról is áll: routes/console.php:23 `Schedule::command('queue:monitor', [config('queue.default').':default', '--max=25'])` — a queue-NÉV fixen `default`, csak a connection dinamikus. A `config/queue.php:42 'queue' => env('DB_QUEUE', 'default')` viszont env-vel átírható; `grep -n DB_QUEUE .env .env.example` → 0 találat (ma nincs drift), de a 2026-07-22-i incidens pontosan ez a minta volt. A `queue:monitor` így egy nem-default DB_QUEUE mellett a HELYTELEN queue-t figyelné → néma torlódás.

## TISZTA (verifikálva)

- P7-L3 fix VALÓS ÉS FAIL-CLOSED — a korábbi kör legfontosabb nyitott tétele érdemben lezárult. Mind a 4 manuális destruktív parancs (ClearAiCache:24-31, EndTrialNow:20+48, FixWordLevels:23-29, ImportWords:26-33) `use ConfirmableTrait` + `if (! $this->confirmToProceed()) { return self::FAILURE; }` + `--force` opció. A fix COMMITOLVA van, nem csak a working tree-ben: `git status --short` üres, `git diff HEAD --stat -- app/Console` üres, `git show HEAD:app/Console/Commands/ClearAiCache.php | grep -c ConfirmableTrait` = 2. A KRITIKUS kérdés (nem-interaktív cron/CI megkerülés) végigkövetve a vendorban: ConfiguresPrompts.php:32 `Prompt::interactive(($input->isInteractive() && defined('STDIN') && stream_isatty(STDIN)) || runningUnitTests())` → nem-TTY/--no-interaction alatt interactive=false → Prompt.php:111-115 `static::$interactive ??= stream_isatty(STDIN); if (! static::$interactive) { return $this->default(); }` → a ConfirmableTrait `confirm('...', default: false)`-t hív, tehát a default FALSE → confirmToProceed() false-t ad → a parancs FAILURE-rel kilép MUTÁCIÓ NÉLKÜL. A nem-interaktív út tehát FAIL-CLOSED, nem megkerülés. Megkerülési út csak az explicit `--force`.

- EndTrialNow guard-sorrend HELYES és értéket ad: a confirmToProceed() szándékosan a user+subscription feloldás UTÁN fut (EndTrialNow.php:48), ezért a megerősítő szöveg kiírja az érintett e-mailt és stripe_id-t (`"Éles terhelés indul: {$user->email} ({$subscription->stripe_id})"`) — pont az elgépelt-e-mail hibamód ellen véd, amit egy handle()-eleji guard nem tudna. A nem-létező user / nincs aktív sub / nincs trial ágak mind a guard ELŐTT, mutáció nélkül FAILURE-re futnak.

- REC-1 1. rétege (boot-guard) LÉTEZIK ÉS TESZTELT: AppServiceProvider::assertStripeSecretMatchesEnvironment() a boot()-ban regisztrált (:35), és négy őrszem-tesztje van — StripeWebhookSecurityTest.php:44 (production+sk_test → dob), :48 (production+sk_live → átmegy), :53 (local+sk_test → nem dob), :57 (stripe disabled → nem dob). Az assertStripeWebhookSecured szintén tesztelt (:8). Cáfolom azt a feltevést, hogy a boot-guardok teszteletlenek lennének — csak nem az EnvironmentBootGuardTest-ben vannak (ott ENV-1/ENV-2 lakik).

- TEST-2 CÁFOLVA: a reconcile handle() KÖR-FÉK-logikája teljes egészében tesztelt, valós DB-sorokon, Stripe-HTTP nélkül, a KillSwitchProbe alosztállyal (ReconcileStripeSubscriptionsTest.php:47-79 `runHandle()` + döntés-térkép + rögzített `closed[]`). Négy handle()-szintű fék-eset fut: 10/10 tripel (:191), 3/100 átmegy (:208), 10/100 átmegy (:226), 1/2 átmegy (:243). Ehhez jön 5 reconcile()-szintű döntési teszt (:127-:190), köztük az a fontos negatív eset, hogy a resource_missingtől ELTÉRŐ Stripe-hiba nem nyelődik el (:173) — vagyis egy tranziens Stripe-500 nem lesz lezárás.

- A riasztási lánc mindhárom ága SZINKRON (notifyNow) és NEM ShouldQueue — a „queue bajáról szóló riasztás nem mehet a queue-n" elv következetesen betartva: MonitorFailedJobs.php:55-57, AlertAdminOfQueueBacklog.php:34-35, AlertAdminOfLoggedError.php:71-77. Mindhárom Notification-osztály explicit kommenttel indokolja a ShouldQueue elhagyását (ApplicationErrorDetected:9-10, FailedJobsDetected:9-11, QueueBacklogDetected:9-10) — egyiken sem szerepel `implements ShouldQueue`.

- MonitorFailedJobs vízjel-sorrend HELYES (nincs riasztás-vesztés): a `Cache::forever(LAST_ALERTED_ID, ...)` a :62 sorban, a notifyNow UTÁN fut. Ha a levélküldés dob, a vízjel NEM lép → a következő kör újrapróbálja. A fail-safe irány (dupla helyett soha) helyesen választva. Tesztelt: QueueMonitoringTest.php:47 (assertSentOnDemandTimes 1) és :59 (2).

- ALERT-2 (throttle küldés ELŐTT zár) CÁFOLVA mint hiba — ez a REKURZIÓ-VÉDELEM, nem defekt: AlertAdminOfLoggedError.php:57-59 `if (! Cache::add($this->throttleKey($event), true, now()->addHour())) { return; }` szándékosan a notifyNow ELŐTT zár, mert ha maga a levélküldés error-t logolna, a MessageLogged újra ide futna — a korai zár szakítja meg a végtelen ciklust, a :78-81 néma `catch (Throwable)` pedig azt biztosítja, hogy a riasztó ne törje el az eredeti kérést és ne is logoljon (ami újra rekurzálna).

- ALERT-3 (globális burst-sapka) MŰKÖDIK és a helyes irányba téved: AlertAdminOfLoggedError.php:96-101 `globalBurstExhausted()`: `Cache::add(KEY, 0, now()->addHour())` (a DatabaseStore.php:214-235 add NEM nyúl a TTL-hez, ha a kulcs létezik → az óra-ablak nem csúszik el minden hibával, ez helyes), majd `Cache::increment(KEY) > 10`. Tesztelt: ErrorLogMonitoringTest.php:69. Ez a 439477a diff-audit-fix, változatlanul a helyén.

- ALERT-4 (beteg cache-store) MÉRVE ÉS FAIL-OPEN, azaz a biztonságos irányba: ha a database cache sor a `Cache::add` és a `Cache::increment` között eltűnik (éjféli prune), a DatabaseStore.php:284-286 `incrementOrDecrement` `is_null($cache)` esetén FALSE-t ad; PHP-ben `false > 10` === false (mérve `php -r 'var_dump(false > 10);'` → bool(false)) → globalBurstExhausted() FALSE → a riasztás ÁTMEGY. A beteg cache tehát nem NÉMÍTJA a riasztást, hanem átengedi.

- Scheduler-regisztráció ÉP, nulla drift: a routes/console.php a bootstrap/app.php `withRouting(commands: ...)`-án van bekötve (bootstrap/app.php:17), és `php artisan schedule:list` PONTOSAN a 4 várt feladatot adja (queue:alert-failed */10, queue:monitor 'database:default' --max=25 */10, sanctum:prune-expired --hours=24 daily, cashier:reconcile-subscriptions daily). A 4 manuális destruktív parancs BIZONYÍTOTTAN nincs ütemezve — vagyis nincs olyan út, amelyen a ConfirmableTrait-guardot egy cron nem-interaktívan kerülné meg.

- Event-regisztráció ÉP (auto-discovery működik): a QueueBusy → AlertAdminOfQueueBacklog lánc végpontról-végpontra tesztelt — QueueMonitoringTest.php:85, :98 (óránként max 1×), :108 (ADMIN_EMAIL nélkül néma). A MessageLogged → AlertAdminOfLoggedError lánc 8 teszttel fedett (ErrorLogMonitoringTest.php:16-104), benne a nem-prod (:95) és az error-alatti szint (:84) negatív esetek.

- A KÖR TESZTJEI ZÖLDEK, nulla regresszió: `php -d memory_limit=512M vendor/bin/pest --compact --filter='AiCache|EndTrial|ErrorLog|Queue|Reconcile|Billingo|Console|Command|Schedul|Import|FixWord|Monitor'` → 127 passed (389 assertions), 5.79s, 0 failed. Egyetlen piros sem, tehát a Dimenzió-D fő kérdésére (regresszió) a válasz: NINCS teszt-szintű regresszió. Kivezetett feature-hez tartozó bukás sem volt a szűrőben.

- Nulla kód-regresszió a riasztási láncban 2026-07-19 óta: `git log --since=2026-07-18 -- app/Console app/Listeners app/Notifications routes/console.php app/Providers app/Jobs` → 4 commit, egyik sem nyúlt a Console-parancsokhoz a ConfirmableTrait-körön kívül. `git diff --stat 439477a~1 HEAD -- app/Listeners app/Notifications` → egyetlen fájl, AlertAdminOfLoggedError.php +40/-7 (ez a burst-plafon HOZZÁADÁSA, tehát megerősítés, nem gyengítés). A MonitorFailedJobs.php mtime 2026-07-04 óta változatlan.

- A reconcile két-fázisú felépítése helyesen izolálja a destruktív írást: az 1. fázis (:87-106 cursor()->each) a close-ágon SEMMIT nem ír DB-be, csak CloseDecision-t gyűjt; a DB-írás kizárólag a fék jóváhagyása után, a :133-141 külön ciklusban fut. A `cursor()` memória-biztos nagy állományon is. A per-sor `catch (\Throwable)` + `report($e)` + `$failed++` biztosítja, hogy egy törölt owner vagy tranziens Stripe-hiba ne állítsa meg az egész kört, és a végső exit-kód `$failed > 0 ? FAILURE : SUCCESS` — a részleges hiba nem sikkad el.

- Az ImportWords külső letöltése nem SSRF-felület: a `$url` HARDKÓDOLT konstans (ImportWords.php:37, a first20hours/google-10000-english raw GitHub-URL), nincs sem opció, sem argumentum, sem env, amivel felhasználó/operátor átirányíthatná. A letöltés hibáját kezeli (`if ($content === false) → FAILURE`), az upsert 500-as chunkokban fut.

- Teszt-lefedettségi leltár (melyik Fázis-7 fájlra VAN teszt): ReconcileStripeSubscriptions → ReconcileStripeSubscriptionsTest.php (9 teszt); MonitorFailedJobs + AlertAdminOfQueueBacklog + FailedJobsDetected + QueueBacklogDetected → QueueMonitoringTest.php (8 teszt); AlertAdminOfLoggedError + ApplicationErrorDetected → ErrorLogMonitoringTest.php (8 teszt); ClearAiCache → AiCacheTest.php (a --force/megerősítés mátrix 3 ága: 43/63/80); EndTrialNow → EndTrialNowTest.php (3 teszt); AppServiceProvider boot-guardok → EnvironmentBootGuardTest.php (ENV-1/ENV-2, 6 teszt) + StripeWebhookSecurityTest.php (Stripe-guardok). NINCS teszt: ImportWords, FixWordLevels (lásd P7D-7), és nincs őrszem-teszt a routes/console.php ütemezés-tartalmára (schedule:list-alapú assert).
