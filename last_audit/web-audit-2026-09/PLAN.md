# Webapp audit — fizetős éles üzemre való alkalmasság

> Indult: 2026-09-21 · Tárgy: a webapp (`app/`, `routes/`, `config/`, `database/`)
> **Átdolgozva 2026-09-21-én** a tulajdonos által megadott kontextus alapján.

## A vizsgálat kérdése

Nem az, hogy „van-e sebezhetőség a kódban". Hanem:

> **Rábízhatunk-e fizető felhasználót erre a rendszerre úgy, hogy a pénzük és az adatuk
> biztonságban van, a szolgáltatás megy, ha mégis elromlik valami akkor arról tudomást
> szerzünk és orvosolni tudjuk, és közben a törvényt is betartjuk?**

Ez négy külön kérdés, és mind a négyre önálló bizonyíték kell. Egy rendszer lehet
sebezhetőség-mentes és mégis alkalmatlan éles üzemre — ha némán veszít el számlákat.

## Kiinduló álláspont: a korábbi „0 HIGH · 0 MEDIUM" verdikt nem megnyugtató

A `last_audit/` alatt két teljes kör futott, mindkettő tisztán zárt. Ezt **nem** vesszük
bizonyítéknak, két okból:

1. **Mindkettő kódolvasásos audit volt, futó rendszer nélkül** (a PHP-verzió miatt a tesztek
   sem futottak). A „nem találtam hibát az olvasáskor" és a „működik" két különböző állítás.
2. **Mindkettő azt kérdezte, hogy sebezhető-e a kód** — nem azt, hogy *üzemeltethető*-e.
   A jelen audit legfontosabb kérdései (megfigyelhetőség, számlázási megfelelés, adat-jogok)
   olyan területek, ahol egy hiba nem „sebezhetőségként" jelentkezik, hanem néma
   működésképtelenségként. Ezekre a korábbi körök nem is kérdeztek rá.

**Következmény: a scope nem szűkül a változás-deltára.** A pénz- és adat-utakat teljes
egészében újranézzük, függetlenül attól, változott-e a kódjuk. Egy 2026-07 óta érintetlen
Stripe-webhook ugyanúgy okozhat elveszett előfizetést, mint egy tegnap írt.

## Környezeti állapot (2026-09-21)

A korábbi terv blokkolója **megszűnt**: a CLI PHP 8.4.24, az `artisan` indul, a webapp
localhoston fut. Ez minőségi változás — mostantól nemcsak olvasni tudunk kódot, hanem
**futtatni is**: teszt, tinker, valódi kérés. Ahol egy leletet futtatással lehet bizonyítani
vagy cáfolni, ott ezt meg is tesszük, nem elemzésre hagyatkozunk.

---

## Menetek

### 1. menet — Terepfelmérés: tesztek, hibakövetés, a valóság
**Státusz: LEFUTOTT (2026-09-21)** — eredmények: ALLAPOT.md 9-10. pont

Mielőtt bármit auditálnánk, tudnunk kell, milyen állapotban van a rendszer, és mi az,
amit egyáltalán észrevennénk.

- **A teljes teszt-suite lefuttatása.** Hány teszt van, mit fednek, mi megy át. Ez az audit
  alapja: piros teszt mellett nincs értelme finomságokról beszélni.
- **Fedettségi térkép a pénz-utakon:** a Stripe-webhook, a Billingo-számlázás és a
  limitkapuk mennyire tesztelt. A fedetlen pénz-út önmagában lelet.
- **Hibakövetés — már most látható hiány:** a `composer.json`-ban **nincs Sentry, Bugsnag,
  Flare vagy bármilyen hibakövető**. Éles hiba jelenleg legfeljebb fájl-logba kerül a
  szerveren, amit senki nem néz. A kérésed („ha hiba van, könnyen megtaláljuk") ezzel
  jelenleg **nem teljesül**. Felmérjük, mi van helyette (`ApplicationErrorDetected`
  notification, log-csatornák), és mennyit ér.
- **A meglévő őrzők tényleges állapota:** a `routes/console.php` ütemez
  `queue:alert-failed`-et, `queue:monitor`-t és `cashier:reconcile-subscriptions`-t —
  de ezek csak akkor mennek, ha a szerveren fut a `schedule:run` cron, és van hova
  e-mailt küldeni. Ellenőrizzük a konfigurációt, nem a szándékot.

### 2. menet — A pénz útja, végponttól végpontig
**Státusz: LEFUTOTT (2026-09-21)** — eredmények: ALLAPOT.md 12-13. pont

A teljes fizetési lánc, nem csak a változott része. A vezérkérdés minden lépésnél:
**mi történik, ha ez a lépés elbukik, és honnan tudnánk meg?**

- **Stripe-webhook:** aláírás-ellenőrzés, idempotencia (kétszer érkező esemény),
  sorrendtévesztés, elveszett esemény. A `cashier:reconcile-subscriptions` tényleg
  behálózza-e a réseket.
- **Fizetett, de nem kapott hozzáférést** — és a fordítottja: **lemondott, de még fizet**
  vagy **lemondott, és még hozzáfér**. Mindkét irányú hiba külön-külön végigkövetve.
- **Billingo/NAV számlázás:** a `GenerateBillingoInvoice` job elbukása. Ha egy számla nem
  jön létre, az **jogszabályi mulasztás**, nem kényelmi hiba. Mi a retry-politika, mi
  történik a végleg elbukott jobbal, és értesül-e róla ember.
- **Áfa és számlaadat-helyesség:** az `InvoiceGenerator` (18 kB) által előállított számla
  tartalmaz-e mindent, amit a magyar számlázási szabály megkövetel. EU-s vevő, áfa-kulcs,
  fordított adózás.
- **Visszatérítés, sztornó, csomagváltás** közbeni állapotok.
- **Csomag-limitek:** a `config/plans.php` (`books: 7 → 3` szűkítés) — a meglévő, 3-nál
  több könyvvel rendelkező fizető felhasználóval mi történik.

### 3. menet — Felhasználói adat: védelem és jogi megfelelés
**Státusz: LEFUTOTT (2026-09-21)** — eredmények: ALLAPOT.md 14-15. pont

- **Már most látható hiány:** a kódban **nincs nyoma fiók-törlésnek vagy adat-exportnak**.
  A `resources/js/pages/legal/privacy.tsx` létezik — de a benne ígért jogokhoz tartozó
  *működő mechanizmus* nem látszik. A GDPR törlési és hordozhatósági joga fizetős
  szolgáltatásnál nem opcionális. **Ellenőrizzük, és ha tényleg hiányzik, az HIGH.**
- **Az adatkezelési tájékoztató és a valóság egyezése:** amit a privacy-oldal állít
  (mit gyűjtünk, meddig tartjuk, kinek adjuk tovább), az fedi-e a tényleges kódot —
  Stripe, Billingo, az AI-szolgáltató, a YouTube-átirat. **Az AI-nak elküldött
  felhasználói szöveg harmadik félnek átadott adat** — szerepel-e a tájékoztatóban.
- **IDOR és adat-szivárgás:** más felhasználó adata elérhető-e — kiemelten az Inertia-propokon
  át, ahol könnyű túl sokat átadni.
- **Jelszó, session, token** kezelése; a Sanctum-tokenek élettartama és visszavonhatósága.
- **Adatmegőrzés:** a törölt felhasználó adata tényleg eltűnik-e, vagy ott marad
  kapcsolt táblákban.

### 4. menet — Üzemeltethetőség: észrevesszük-e, ha elromlik
**Státusz: KÖVETKEZŐ**

Ez a menet közvetlenül a kérésed második feléről szól, és **önálló súlyú**, nem utógondolat.

- **Hibakövetés:** a hiányzó hibakövető pótlására konkrét javaslat.
- **Naplózás minősége a pénz-utakon:** egy elveszett fizetésnél a naplóból
  rekonstruálható-e, mi történt — vagy csak annyi látszik, hogy „exception".
  Van-e korrelációs azonosító, ami egy felhasználó egy tranzakcióját összefűzi.
- **Naplózási adatvédelem (a kettő ütközik):** nem kerül-e a logba kártyaadat, token,
  személyes adat. A jó hibakeresés és a GDPR itt feszül egymásnak.
- **Riasztási láncok:** a `FailedJobsDetected`, `QueueBacklogDetected`,
  `ApplicationErrorDetected` — hova mennek, észreveszi-e valaki, van-e vakfolt.
- **Egy elbukott számlázási job kézi újrafuttathatósága** — mennyire nehéz helyreállni.
- **Adatmentés és visszaállítás:** van-e, tesztelt-e. (Ha ez ops-hatáskör, akkor is
  rögzítjük nyitott kérdésként.)

### 5. menet — AI-használat és -költség
**Státusz: tervezett**

Az AI közvetlen pénzkiadás, ezért ez is „pénz-út".

- **`AttachAiBudgetWarning`** (új middleware): nem szivárogtat-e más felhasználó
  keret-adatát az Inertia-propokon.
- **`AiUsageService`:** a keret-számlálás **race-mentes-e** — két párhuzamos kérés
  átviheti-e a kereten. Ez futtatással is vizsgálható.
- **Minden AI-belépési pont egységes kapuzása:** web, bővítmény, player, admin. Van-e út,
  ami a `ai.budget` middleware mellett megy el.
- **`TextAnalysisController`** (+574 sor): felhasználói input és AI-hívás találkozása,
  prompt-injekció és költség-robbanás szempontjából.
- **A felhasználó felé mit ígérünk:** ha elfogy a keret, az megfelel-e annak, amit
  fizetéskor ígértünk.

### 6. menet — Biztonság a maradék felületen
**Státusz: tervezett**

Az előző menetekbe be nem sorolt kockázatok.

- A route-fájlok teljes átszervezése (`web.php` −91 sor, 9 új route-fájl): **middleware-lánc
  diff** — veszített-e bármelyik route védelmet a mozgatás során. A korábbi audit
  middleware-térképe a régi `web.php`-ra készült, tehát elavult.
- Az új végpontok input-validációja.
- `ArticleTextExtractor` (+342 sor) és `BookTextExtractor` (+268 sor): felhasználó által
  megadott forrásból származó szöveg — SSRF, erőforrás-kimerítés.
- `ReportController` → `ReportSubmitted` lánc (user-input → e-mail).

---

## Hogyan dolgozunk

1. **Audit-no-fixes:** a menetek dokumentálnak, nem javítanak. A javítás külön döntés.
   Kivétel: ha olyat találunk, ami **éles rendszerben épp most okoz kárt** — azt azonnal
   jelezzük, nem várunk a menet végéig.
2. **Menetenként friss beszélgetés**; a menet végén csak a leletlista kerül ide.
3. **Bizonyíték-alapú leletek.** Amit futtatással lehet igazolni, azt futtatjuk. A lelet
   formátuma: fájl, sor, súlyosság, konkrét forgatókönyv (bemenet/állapot → hatás),
   és hogy **mi cáfolná**.
4. **Adverzariális önellenőrzés:** minden HIGH/MEDIUM-gyanút cáfolni kell próbálni,
   mielőtt leletként rögzül.
5. **Őszinte verdikt.** Ha egy terület rendben van, azt mondjuk ki — nem termelünk
   látszat-leleteket. Ha valami nincs rendben, azt a valódi súlyán nevezzük meg, akkor is,
   ha kellemetlen vagy sok munkát jelent. **A hiányzó dolog is lelet**: nemcsak a rossz kód
   számít, hanem az sem, ami nincs ott, pedig kellene.
6. **A „nem tudom" megengedett válasz.** Ahol a kódolvasás nem dönt el valamit (pl. a
   szerveren tényleg fut-e a cron), azt nyitott kérdésként rögzítjük, nem tippelünk.

## Súlyossági skála (erre az auditra szabva)

- **HIGH** — pénzt veszít, adatot szivárogtat, jogszabályt sért, vagy némán hibázik egy
  pénz-úton.
- **MEDIUM** — rontja a helyreállíthatóságot vagy a felderíthetőséget; kedvezőtlen
  körülmények közt HIGH-á válik.
- **LOW** — valós, de korlátozott hatású.
- **INFO / nyitott kérdés** — nem lelet, hanem tisztázandó.
