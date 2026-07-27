# Verifikációs napló — Fázis 6 (2026-07-27)

> Csak azok a leletek szerepelnek itt, ahol **érdemi súlyosság-vita** volt.
> Minden verifikátor **cáfolásra** volt promptolva; bizonytalanság esetén a default `refuted=true`.
> Eltérő verdikt esetén **többségi szavazat / döntőbíró** dönt.

---

## Vita 1 — VAL-1 (bulk `ids` korlátlan tömb)

**Finder-súlyosság: MEDIUM** — `FlashcardCardController` 5 bulk-művelete (`bulkDelete/bulkMove/bulkDirection/bulkReset/bulkReverse`) `'ids' => ['required','array']` `max:` nélkül, `ids.*` csak `['integer']`; kvadratikus validátor-költség, nincs throttle.

### Verifikátor-1 — lencse: **kihasználhatóság**
Verdikt: **CONFIRMED, de MEDIUM → LOW**

| Érv | Tartalom |
|---|---|
| (a) | A finder „200k = fatal error `ValidationRuleParser.php:227`" állítása **MEGDŐLT**. Reprodukálva 200 000 elemmel, `memory_limit=128M`: `OK n=200000 elapsed=426.81s peak=126.0MB` — nincs fatal error, nincs memory exhaustion, csak lassulás. A hivatkozott sor egy `array_merge` a `mergeRulesForAttribute()`-ban, ami nem dob. |
| (b) | Egy 8 s-os kérés a `MaxRequestWorkers 150` pool 0,67%-át köti le → a leviteléhez ~150 párhuzamos kapcsolat kell. |
| (c) | A támadó `auth` + `verified` mögött van: azonosítható, tiltható. |
| (d) | A minta nem egyedi (az onboarding ugyanilyen) → architekturális jellemző, nem kiemelt kockázat. |

Saját mérése (izolált `Validator::make()`, Laravel 13.16.1 / PHP 8.4):

| n | idő | µs/elem |
|---|---|---|
| 1 000 | 0,022 s | 22 |
| 8 000 | 0,434 s | 54 |
| 32 000 | 5,85 s | 183 |
| 64 000 | 28,9 s | 451 |

### Verifikátor-2 — lencse: **valós blast radius**
Verdikt: **CONFIRMED, MEDIUM marad**

| Érv | Tartalom |
|---|---|
| (a) | A finder „keret-kapu megkerülés" premisszája **HAMIS**: 5 metódusból 4-nek (`bulkDelete`, `bulkReset`, `bulkDirection`, `bulkMove`) nincs is kvóta-kapuja; csak a `bulkReverse` hív `reserveFlashcardSlots`-ot. Nincs mit „megkerülni". |
| (b) | A hibamód nem crash, hanem **hang** (50k = 24,3 s, 70 MB peak) — rosszabb, mert a crash felszabadítja a workert, a hang nem. |
| (c) | A kódbázis ~30 nevesített throttle-bucketet használ; minden nehéz út throttle-özött **és** sapkázott (`ta-analyze` 30/1 + `max:15000` + napi kvóta; CSV-import 5000 sor + 2 MB + kvóta-kapu lock alatt). A `routes/flashcards.php` az **egyetlen** throttle-mentes route-fájl → ezek **outlierek**. |
| (d) | Éles: **egyetlen** VPS, php8.4-fpm — a worker-pool telítése minden usert megtagad. |
| (f) | Detekciós hézag: a `MonitorFailedJobs`/`queue:monitor` csak a queue-t figyeli; szinkron HTTP-latenciát / FPM-telítettséget semmi. |

### Döntőbíró — lencse: **van-e már védelem a láncban**
Verdikt: **CONFIRMED — LOW** (V1-nek ad igazat, de más indoklással)

Pontonkénti ítélet:

| Érv | Ítélet |
|---|---|
| V1 (a) nincs fatal error | **IGAZ** — a finder premisszája megdőlt |
| V1 (b) `MaxRequestWorkers 150` | **HAMIS** — ez a **lokális XAMPP** `httpd-mpm.conf`-ból való; élesben `nginx + php8.4-fpm` fut, Apache ott nem is létezik. V1 kvantitatív magja érvénytelen. |
| V1 (c) azonosítható támadó | **IGAZ**, valós mérséklés |
| V1 (d) a minta nem egyedi | **IGAZ és mérésileg alátámasztott** |
| V2 (a) keret-premissza hamis | **IGAZ** (V2 saját beismerése) |
| V2 (b) hang > crash | **IGAZ** mechanizmusként, de nem lelet-specifikus |
| V2 (c) „30 bucket, ezek outlierek" | **HAMIS** — lásd alább |
| V2 (d) egy VPS | **IGAZ**, de mind a 40 throttle-mentes route-ra igaz |
| V2 (f) detekciós hézag | **IGAZ** — valós ops-hiányosság, önálló INFO-t érdemel |

**A vitát eldöntő mérés** (a döntőbíró mérte, én — az auditvezető — függetlenül újramértem `route:list --json`-ból):

```
mutating: 75   throttled: 35   NOT throttled: 40
```

A throttle-mentes mutáló route-ok között ott az egész `folders/*`, `admin/*`, `words/{word}`, `text-analysis/books/{book}`, `flashcards/*`. **A throttle-mentesség a többség (53%), nem outlier.** V2 azért jutott ellenkező következtetésre, mert fájl-szinten nézte (a `words.php`-ban *van* 7 throttle — de a 13 mutáló route-jából csak néhányra vonatkozik). Route-szinten a kép megfordul.

**Végső súlyosság: LOW.** Nem MEDIUM, mert a súlyt hordozó „kilógó végpont" premissza megdőlt (40/75 társ), nincs cross-user hatás, se privilégium-emelés, a kár az `abort_unless` + `whereIn` ownership-szűrő miatt a saját pakli méretére plafonos. Nem INFO, mert a mechanizmus valós és mért, és a `max:` sapka olcsó, kockázatmentes javítás.

---

## Vita 2 — VAL-2 (onboarding korlátlan tömb + `exists` N+1)

**Finder-súlyosság: MEDIUM** — `OnboardingController.php:51-56`, 300 elem = 300 külön DB-lekérdezés, nincs `whereIn`-összevonás, nincs throttle.

- **Verifikátor-2** önállóan verifikálta és **megerősítette** a „végtelenül ismételhető" tulajdonságot: a `routes/web.php:77` csoportján csak `['auth','verified']` van, az `EnsureOnboardingComplete` **nem védi a saját POST route-ját**, és a `complete()` sosem ellenőrzi újra az `onboarding_completed_at`-ot. A javasolt cáfolat („egyszer futtatható") tehát **megbukott**.
- **A döntőbíró** ezt is verifikálta (igaz), de megtalálta a döntő tényt:

> **VAL-2 = az ONB-1 duplikátuma.** `last_audit/audit-phase5-2026-07-27/02-dim-b-onboarding.md:32` — ugyanaz a fájl, ugyanazok a sorok (`:51-56`), ugyanaz a `routes/web.php:77`, ugyanaz az `exists` N+1, ugyanaz a throttle-hiány. Azt a leletet egy 3-körös adverzariális verifikáció **ma (2026-07-27) MEDIUM → LOW**-ra vitte.

A Fázis 5 napló az ismételhetőséget **már beárazta** („a támadás nem hal el magától — a lelet javára"), és mégis LOW lett, mert a kár plafonos: az upsert a `user_word` PRIMARY KEY-ére megy → ismétlés = UPDATE, max ~10 000 sor/user, **nulla tárhely-növekedés**. Ráadásul a `GET /onboarding` (6× `ORDER BY RAND()`) olcsóbb vektort ad ugyanazon a fiókon.

**Végső súlyosság: LOW — és duplikátumként jelölve.** Ugyanaz a lelet nem lehet két súlyú két audit-körben; a konzisztencia kötelezően LOW-t diktál.

---

## Vita 3 — CSV-4 (unicode-whitespace formula-injection bypass)

**Finder-súlyosság: MEDIUM** — `FlashcardCsvController.php:200`: a `$field[0]` **bájtot** olvas, nem karaktert, és a `stripHtml()` `trim()`-je csak ASCII whitespace-t vág → az U+00A0 / U+200B prefixű mező elől elmarad a védő aposztróf.

### Verifikátor — lencse: **kézbesítési lánc + a hatás-premissza**
Verdikt: **REFUTED → INFO**

**(a) A technikai megkerülés IGAZ** — reprodukálva a valós `stripHtml()` + `csvRow()` logikával, bájtszinten:

| Payload | Export-mező (hex) | Prefix-aposztróf? |
|---|---|---|
| `=HYPERLINK(...)` | `22 27 3d 48…` | **IGEN** |
| `\u{00A0}=HYPERLINK(...)` | `22 c2a0 3d 48…` | **NEM** |
| `\u{200B}=HYPERLINK(...)` | `22 e2808b 3d…` | **NEM** |
| `\u{FEFF}=1+1` | `22 efbbbf 3d…` | **NEM** |
| `\t=HYPERLINK(...)` | `22 27 3d…` | **IGEN** (a `trim()` levágja a TAB-ot → `=` lesz az első bájt) |
| `\r=cmd\|'/c calc'!A1` | `22 27 3d…` | **IGEN** |

Az ASCII-vektorok tehát **erősebben** fogva vannak, mint a finder hitte. Nem található átcsúszó ASCII-prefix.

**A HTML-entity-sorrend vektor CÁFOLVA** (a verifikátor külön kereste, mint potenciálisan erősebb leletet): a `stripHtml()` sorrendje `strip_tags()` → `html_entity_decode()` → `trim()`, tehát a dekódolás valóban a képlet-check **előtt** fut — ami elvben rést nyitna. De a tárolási lánc bezárja: a `textToHtml()` `htmlspecialchars()`-ol, így a `&#61;HYPERLINK(...)` bemenet `&amp;#61;…`-ként tárolódik, a dekódolás pedig a **literál** `&#61;` stringet adja vissza, nem `=`-t. Mért kimenet: `22 26 23 36 31 3b…`. Az egyszeres dekódolás pontosan visszabontja az egyszeres enkódolást — nincs aszimmetria.

**(b) A kézbesítési lánc SZAKAD — ez a döntő pont.** Kimerítően ellenőrizve:
- A `flashcard_decks` táblának 6 oszlopa van (`id, user_id, name, description, created_at, updated_at`) — **nincs** `is_public` / `shared_with` / `visibility`.
- A `FlashcardDeck` 4 relációja közül egyik sem cross-user; a `share|public|clone|team|collaborat` grep 0 valódi találat.
- **Nincs admin-export**: az AdminController-ekben 0 találat `flashcard|export|csv`-re.
- Mind a 37 flashcard-route self-only: konzisztens `abort_unless($deck->user_id === $request->user()->id, 403)` (17+ előfordulás); az export első sora is ez.
- Az extension `createFlashcard` a paklit `$request->user()->flashcardDecks()->find(...)`-dal keresi.

→ A támadó kizárólag a **saját** paklijába tud tartalmat juttatni, és kizárólag a **sajátját** exportálja. Ez **self-XSS-ekvivalens**: a user a saját maga beírt payloadját nyitja meg a saját gépén. Definíció szerint nem sebezhetőség.

**(c) Az Excel-premissza ALÁTÁMASZTATLAN.** A lelet sarkalatos állítása („az Excel a vezető NBSP-t figyelmen kívül hagyja a képlet-felismerésnél") nincs mérve, és két ok szól ellene: (1) a képlet-detekció az első karaktert nézi — az U+00A0 nyomtatható szöveges karakter (Unicode `Zs`), nem szintaktikai whitespace; az NBSP létezésének lényege, hogy a feldolgozó **ne** kezelje whitespace-ként; (2) a mező **mindig idézőjelben** van (mérve: `0x22` nyit és zár), az Excel az idézőjeles mezőt szöveges literálként veszi fel. A finder a round-tripet csak a PHP-kimenetig mérte — épp azt a lépést nem, amin az egész impact áll.

**Végső súlyosság: INFO.** A MEDIUM két meg nem alapozott premisszán állt: egy nem létező kézbesítési láncon és egy nem mért Excel-viselkedésen. A lelet valós, de kozmetikai kód-szagot azonosít (`mb_substr($field, 0, 1)` lenne a helyes forma).

> ⚠️ **Újranyitási feltétel:** ha a pakli-megosztás / publikus paklik valaha bekerülnek a termékbe, ezt a leletet **MEDIUM-ként újra kell nyitni** — akkor a (b) szakadás megszűnik, és már csak a (c) Excel-premissza tartaná.

---

## Vita 4 — a sanitizer-bypass keresés (XSS, D3)

Nem súlyosság-vita, hanem **negatív eredmény mérésen**, ezért érdemel naplót: a PLAN feltételezése regex-alapú sanitizert sejtetett, ami klasszikusan megkerülhető. A finder ezért nem olvasásból ítélt, hanem kiemelte mind a három sanitizer kódját (`lib/sanitize-html.ts`, extension `sanitizeAiHtml`, player `rebuildSafeNodes`), és **headless Chrome-ban, valódi HTML-parserrel** futtatott rajtuk 31 + 9 payloadot (`on\nerror=`, backtick-quote, unquoted attr, `javascript&#58;`, `java\tscript:`, dupla-kódolás, nem lezárt tagek, `<svg/onload=>`, mXSS `<noscript>`-variánsok).

**Eredmény: mind a 40 esetben 0 veszélyes maradvány, `idempotent: true`.**

Ok: mind a három sanitizer **DOM/`<template>` + allowlist** alapú, nem regex — a böngésző parsere előbb normalizál, utána fut a szűrés, ami a teljes felsorolt megkerülési osztályt szerkezetileg zárja. Az mXSS-hez kontextus-váltó elemnek kellene túlélnie: az `svg`/`math`/`style`/`noscript`/`template`/`base` mind DROP, a `textarea`/`title`/`xmp`/`plaintext` nincs az allowlisten → unwrap. Egyetlen ilyen elem sem éli túl az első kört — ezt az idempotencia-mérés igazolja is.
