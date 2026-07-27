# Fázis 6 audit — Input/output biztonság

> Készült: **2026-07-27** · a `last_audit/PLAN.md` **CSAK Fázis 6** szakasza (sorok 102–107).
> **Csak dokumentálás** — semmilyen kódot és tesztet nem módosítottam (audit-no-fixes szabály).
> **Mód:** 4 párhuzamos finder (PLAN-pontonként egy), majd a HIGH/MEDIUM-gyanús leletekre
> **cáfolásra promptolt** adverzariális verifikáció eltérő lencsékkel (kihasználhatóság /
> valós blast-radius / meglévő védelem a láncban), LOW-ra egykörös.

## Vezetői összefoglaló

**0 HIGH · 0 MEDIUM · 8 LOW · 29 INFO · 0 go-live blokkoló.**

A PLAN Fázis 6 **mind a négy** központi feltevése megdőlt vagy elavult (részletek lent).
A három MEDIUM-gyanús lelet közül a verifikáció **kettőt LOW-ra**, **egyet INFO-ra** vitt le —
egyik sem maradt MEDIUM. Sanitizer-bypasst 40 payload valódi HTML-parseren futtatva **nem találtunk**.

| Dimenzió | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|
| D1 — Mass-assignment / `$fillable` | 0 | 0 | 2 | 7 |
| D2 — Validáció-lefedettség | 0 | 0 | 2 | 4 |
| D3 — XSS / render-injection | 0 | 0 | 2 | 10 |
| D4 — CSV / fájl I/O | 0 | 0 | 2 | 8 |
| **Összesen** | **0** | **0** | **8** | **29** |

### A 8 LOW egy sorban

| ID | Fájl | Lényeg | Kategória |
|---|---|---|---|
| MA6-1 | `PlayerPairing.php:14` | `poll_secret_hash` fillable egy **hitelesítés nélküli** végpont modelljén; a védelem csak a hívási hely fegyelmén múlik | defense-in-depth |
| MA6-2 | 8 modell | `user_id` a fillable-ban; mind a 10 hívási hely relációt vagy hardcode-olt `$user->id`-t használ | redundáns felület |
| VAL-1 | `FlashcardCardController` 5 bulk-metódus | korlátlan `ids` tömb, kvadratikus validátor-költség, nincs throttle | erőforrás-kimerítés |
| VAL-2 | `OnboardingController.php:51-56` | korlátlan tömb + `exists` N+1, végtelenül ismételhető — **az ONB-1 duplikátuma** | erőforrás-kimerítés |
| XSS-6 | `lookup-popup.js:424` | `innerHTML` `esc()` nélkül; ma zárt (fix map), de **két testvér-helye escape-el** — ez a kilógó eset | regresszió-kockázat |
| XSS-7 | `search-modal.js:45` | `innerHTML +=` re-serializál; ma hardcoded tartalom | regresszió-kockázat |
| CSV-5 | `FlashcardCsvController.php:196-210` | többsoros cella 2. sora `=`-lel kezdődhet a nyers fájlban; szabványos parser egy cellának olvassa | csak naiv fogyasztónál |
| CSV-6 | `FlashcardCsvController.php:157-164` | UTF-16 CSV **némán** szemétté válik, `skipped` = 0 | adatminőség |
| CSV-7 | `FlashcardCsvController.php:48` | fix `,` elválasztó; a magyar Excel `;`-t ír → minden sor kihagyva (de jelzi) | UX / adatminőség |

*(A CSV-5/6/7 három tétel — a táblázat 9 sora 8 LOW + 1: a CSV-7 UX-határeset, súlyozásban LOW.)*

Egyik LOW sem kihasználható cross-user hatással, egyik sem go-live blokkoló.

---

## Megdőlt PLAN-feltevések

A PLAN Fázis 6 négy pontjából **négy** premisszája bizonyult hibásnak vagy elavultnak:

1. **„Mass-assignment / `$fillable` sweep mind a **18** modellen — érzékeny mező (`is_admin`, `stripe_id`, `ai_*`) átírható-e."**
   → **MEGDŐLT.** A modellszám ma **19**. Az `is_admin` **oszlop nem is létezik** (a `users` 38 oszlopa közt nincs szerep-oszlop; az admin `ADMIN_EMAIL`-gate). A `stripe_*`, `ai_credit*`, `lifetime_access`, `plan_override`, `trial_ends_at`, `invite_id`, `terms_accepted_at`, `billingo_partner_id` **egyike sincs** a `User` fillable-jában. Az `app/` alatt **egyetlen `$request->all()` átadás sincs** create-be/fill-be, nincs `Model::unguard()`, nincs `$guarded = []`. Mind a 19 modellnek van explicit fillable-felülete.

2. **„csak **8 FormRequest** létezik; a többi mutáló végpont inline `validate()`-tel vagy validáció nélkül dolgozik?"**
   → **MEGDŐLT / ELAVULT SZÁM.** A tényleges szám **15** (9 + 6 a `Settings` alatt). A validáció *megléte* teljeskörű: **0 olyan mutáló végpont van, ahol input validáció nélkül jutna DB-be.** A hézag nem a meglétben, hanem a *minőségben* van (VAL-1/VAL-2: hiányzó `max:` sapkák).

3. **„XSS / render-injection … React `dangerouslySetInnerHTML` sweep + extension DOM-írás."**
   → **MEGDŐLT (a premissza implicit feltevése).** A PLAN regex-alapú sanitizert sejtetett. Mind a három sanitizer (`lib/sanitize-html.ts`, extension `sanitizeAiHtml`, player `rebuildSafeNodes`) **DOM/`<template>` + allowlist** alapú, ami a teljes regex-megkerülési osztályt szerkezetileg zárja. **40 payload valódi HTML-parseren (headless Chrome): 0 veszélyes maradvány, mind idempotens.**

4. **„CSV / fájl import-export edge-ek (encoding, méret, sortörés)."**
   → **RÉSZBEN MEGDŐLT.** Nincs OOM-vektor: az import **streamel** (`fopen` + `fgetcsv`), három egymást fedő sapkával (`max:2048` = 2 MB, `MAX_IMPORT_ROWS` = 5000, `MAX_FIELD_LENGTH` = 10000). Mérve: 200 000 soros fájl → **6 MB csúcs-memória, 8,2 ms**. Az encoding-hézag (a korábbi CSV-2) azóta **lezárult** a `normalizeEncoding()` cp1252-fallbackkel; maradt a szűkebb UTF-16 eset (CSV-6).

**Bónusz megdőlés:** a PLAN „129 saját route" (lefedettség-mátrix) → ma **123 route, ebből 75 mutáló** (a csökkenés kizárólag a kivezetett feature-ökből).

---

## Kihagyott (kivezetett) pontok

A Fázis 6 szakasz **nem hivatkozik** egyetlen kivezetett feature-re sem, így kihagyandó PLAN-pont nem volt. A kivezetett felületeket (`QuizController`, `ClozeController`, `IrregularVerbController`, `WordController::quiz`/`practice`, `TextAnalysisController::practiceCheck`, `ReviewController` + a `pages/words/{quiz,cloze,practice}.tsx`, `pages/irregular-verbs/` és a hozzájuk tartozó tesztek) mind a négy finder scope-ból kizárta.

Két járulékos megállapítás a kivezetés kapcsán:
- Az **`IrregularVerb` modellbe nincs élő írási út** — a route ki van kommentelve, egyetlen írója a seeder `upsert()`-je.
- Az `is_irregular` mező, a `verb_*` igealakok, a „Rendhagyó ige" checkbox és a „rendhagyó" badge **élő funkciók**, normál auditálási körben voltak (a szólistán és a szövegelemző lookup-dialogjában); a `words.sentence-check` végpont szintén (a szövegelemzőé).

---

## Regressziók és korábbi verdiktek felülvizsgálata

Referencia: `reaudit-phase6/` (2026-07-20) — az az összesítő **0 HIGH / 0 MEDIUM / 3 LOW / 8 INFO**-t adott.

| Korábbi lelet | Akkori állapot | Ma | Megjegyzés |
|---|---|---|---|
| **MA-4** (`is_imported` a `Flashcard` fillable-ban) | LOW, nyitva | ✅ **JAVÍTVA, regresszió nélkül** | Kikerült a fillable-ból; mind az 5 `is_imported`-író hely explicit property-set vagy query-builder `insert`. A modell doc-blokkja rögzíti az indoklást és az elvetett alternatívát. |
| **XSS-2** (`youtube.js:786` nyers `${html}`) | LOW, nyitva | ✅ **JAVÍTVA** | A `setYtPanelMessage` ma `textContent`-et használ. |
| **CSV-2** (encoding-normalizálás hiánya) | LOW, nyitva | ✅ **LEZÁRVA** | A `normalizeEncoding()` cp1252-fallback bekerült. A maradék szűkebb UTF-16-hézag új, szűkebb leletként: **CSV-6**. |
| **MA-2** (nincs `is_admin` oszlop) | REFUTED | ✅ **HELYTÁLLÓ** | `db:table users` 38 oszlopa közt nincs szerep-oszlop. Kiegészítés: az e-mail-gate önmagában sem eszkalálható (unique index + `hasVerifiedEmail()` + az e-mail-váltás nullázza az `email_verified_at`-ot + `current_password` kötelező). |
| **MA-3** (`User` fillable entitlement-mentes) | CONFIRMED tiszta | ✅ **HELYTÁLLÓ** | A 17 fillable mező egyike sem entitlement; mindkét `User::fill()` szűk `validated()`-et kap. |
| **CSV-1** („formula-injection tiszta") | CONFIRMED tiszta | ⚠️ **PONTOSÍTVA** | Az előző kör csak ASCII-prefixeket próbált. A bájt-indexelés minden **nem-ASCII** kezdetű mezőt átenged (CSV-4) — de a verifikáció ezt **INFO**-ra vitte (nincs kézbesítési lánc, az Excel-premissza alátámasztatlan). Az ASCII-védelem valóban teljes, sőt erősebb, mint hitték. |
| **VAL-1/VAL-2** („mind a 77 route validál") | CONFIRMED tiszta | ⚠️ **HATÓKÖR PONTOSÍTVA** | Az állítás **ma is igaz** a validáció *meglétére*. De az akkori kör a *minőséget* nem mérte — a mostani VAL-1/VAL-2 nem új romlás, már akkor is fennállt. Javasolt a verdiktet „meglét: tiszta / minőség: nem vizsgált"-ra pontosítani. |

**Valódi regresszió: 0.** Nincs olyan felület, ami korábban tiszta volt és most nem.

---

## A három súlyosság-vita kimenetele

Részletek: [`05-VERIFIKACIOS-NAPLO.md`](05-VERIFIKACIOS-NAPLO.md)

| Lelet | Finder | V1 | V2 | Döntőbíró | **Végső** |
|---|---|---|---|---|---|
| **VAL-1** bulk `ids` | MEDIUM | CONFIRMED → LOW | CONFIRMED → MEDIUM | CONFIRMED → LOW | **LOW** |
| **VAL-2** onboarding | MEDIUM | — | CONFIRMED → MEDIUM | CONFIRMED → LOW (**duplikátum**) | **LOW** |
| **CSV-4** unicode-bypass | MEDIUM | REFUTED → INFO | — | — | **INFO** |

**A VAL-vitát eldöntő mérés** (a döntőbíró mérte, auditvezetőként függetlenül újramérve):

```
mutating routes: 75 · throttled: 35 · NOT throttled: 40
```

V2 kulcsérve — „a `routes/flashcards.php` az egyetlen throttle-mentes route-fájl, ezek outlierek" — **tényszerűen hamis**: a throttle-mentesség a **többség (53%)**, köztük az egész `folders/*`, `admin/*`, `words/{word}`, `text-analysis/books/{book}`. V2 fájl-szinten nézte; route-szinten a kép megfordul. Ez egybevág a Fázis 5 kör független mérésével (~50 throttle-mentes mutáló route), és **konzisztenciát is kikényszerít**: a VAL-2 **szó szerint ugyanaz a lelet**, mint a ma reggeli Fázis 5 kör **ONB-1**-e (ugyanaz a fájl, ugyanazok a sorok, ugyanaz az N+1) — amit ott egy 3-körös verifikáció már MEDIUM→LOW-ra vitt.

Két finder-premissza a verifikáció során **megdőlt**:
- „200k elem = fatal error `ValidationRuleParser.php:227`" → **nincs fatal error**; reprodukálva 128M limittel: `elapsed=426.81s peak=126.0MB`. A hibamód **hang**, nem crash.
- „a költség a Free kártyakeret-kapu ELŐTT merül fel" → **nincs mit megkerülni**: 5 bulk-metódusból 4-nek (`bulkDelete`, `bulkReset`, `bulkDirection`, `bulkMove`) **nincs is kvóta-kapuja**.

---

## Mérési adatok

**Validátor-költség korlátlan `ids` tömbre** (izolált `Validator::make()`, Laravel 13.16.1 / PHP 8.4) — kvadratikus, nem lineáris:

| n | idő | µs/elem |
|---|---|---|
| 1 000 | 0,022 s | 22 |
| 8 000 | 0,434 s | 54 |
| 32 000 | 5,85 s | 183 |
| 64 000 | 28,9 s | 451 |
| 200 000 | 426,81 s | peak 126 MB (nincs fatal) |

A `max_input_vars=1000` **nem véd**: JSON-törzsnél a Laravel `json_decode`-dal parse-ol, nem a PHP `$_POST`-tal — mérve 50 000 elem 3 ms alatt beolvasva, a payload 0,28 MB.

**CSV-import memória-profil** — nincs OOM-vektor:

| Eset | Fájl | Feldolgozva | Csúcs-memória | Idő |
|---|---|---|---|---|
| 2 KB/soros a `max:2048` határon | 2049 KB | 1048 sor | 4 MB | — |
| 200 000 rövid sor (worst case) | 1172 KB | 5000 sor (sapka) | **6 MB** | **8,2 ms** |

**Sanitizer-bypass mérés:** 31 + 9 payload, headless Chrome (valódi HTML-parser), 3 sanitizer → **40/40 esetben 0 veszélyes maradvány, `idempotent: true`**.

**Teszt-futás (módosítás nélkül):** `--filter="Csv|Import|Export|Book|Youtube"` → **24 passed (55 assertions), 3,32 s**.
A meglévő CSV-tesztek **nem fedik** a CSV-4 unicode-prefix és a CSV-6 UTF-16 vektort — ezért maradtak észrevétlenek.

---

## Kiemelendő pozitívumok

- **IDOR = 0** mind a négy dimenzióban. A `Flashcard.deck_id` 8 írási helye közül a `move()` az egyetlen, ahol user-inputból jön — és pont ott van explicit `abort_unless($targetDeck->user_id === ...)`. A bulk `ids` nem `exists`-elt, de a `$deck->flashcards()->whereIn()` scope miatt **nem IDOR**, és a követő törlések is a leszűrt `$ownedIds`-t használják.
- A **`Word` globális szótári sornak pontosan két írási útja van**: `WordController::update` (**kettős védelem** — route `can:admin` *és* kontroller `Gate::authorize('admin')`; a `rank` és `extra_forms` még adminnak sem írható, mert kimaradt a szabályhalmazból) és az `ImportWords` CLI. Minden user-facing „szó-státusz" művelet a `user_word` **pivot**-ot írja, nem a globális sort.
- **A felirat-szöveg (idegen oldalról, a legkockázatosabb út)** végig `esc()`-elt — szöveg- és attribútum-kontextusban is. A `"><img src=x onerror=...>` feliratú videó látható szövegként jelenik meg.
- **AI-tartalom (prompt-injection):** a szerver HTML-t épít a Gemini-válaszból (`TextAnalysisController:1081-1144`), de **mind a 10 AI-mező** `htmlspecialchars`-olt; a `style`-ok hardcoded-ok.
- Az **új 1.24 felirat-gyorsgesztus kód** végig DOM-API — **egyetlen HTML-sink sincs benne**; az `isTrusted`-guard megmaradt.
- A pénzügyi/entitlement-lánc: `BillingValidationRules` (allowlist + regex + `prohibited_if`), az admin-enumok mind `in:`-zártak, a `revokePlayerDevice` a tulajdont a lekérdezésbe építi.

---

## Nyitott, e fázison túlmutató tételek (nem Fázis 6 leletek)

1. **A 40 throttle-mentes mutáló route rendszerszintű kérdése** — valós architekturális tétel, de nem e két lelet terhe; önálló INFO-ként érdemes vinni. Élesben `nginx + php8.4-fpm` fut 1–2 GB RAM-os VPS-en, ahol a `pm.max_children` reálisan 5–15.
2. **Detekciós hézag (ops):** a `MonitorFailedJobs` / `queue:alert-failed` / `queue:monitor` **csak a queue-t** figyeli; szinkron HTTP-latenciát és FPM-telítettséget semmi. Egy erőforrás-kimerítés így megmagyarázatlan kimaradásként jelentkezne.
3. **Architekturális megjegyzés:** a `POST /extension/flashcard` a `front`/`back` mezőt **HTML-sanitizálás nélkül tárolja** (`ExtensionController.php:257-291`). Ma **nem** sebezhetőség — self-only, és minden kijárat sanitizál. De a védelem tisztán **output-oldali**: egy jövőbeli, sanitizert kihagyó render-pont self-XSS-t, **pakli-megosztás bevezetése esetén stored XSS-t** nyitna.
4. **⚠️ Újranyitási feltétel:** ha a **pakli-megosztás / publikus paklik** valaha bekerülnek, a **CSV-4** leletet **MEDIUM-ként újra kell nyitni** (akkor a kézbesítési lánc szakadása megszűnik), és a 3. pont is súlyt vált.

---

## Fájlok

| Fájl | Tartalom |
|---|---|
| [`01-dim1-mass-assignment.md`](01-dim1-mass-assignment.md) | D1 — mass-assignment / `$fillable` sweep mind a 19 modellen |
| [`02-dim2-validacio.md`](02-dim2-validacio.md) | D2 — végpontonkénti validáció-lefedettségi táblázat + leletek |
| [`03-dim3-xss.md`](03-dim3-xss.md) | D3 — XSS / render-injection (React + extension + player + Blade) |
| [`04-dim4-fajl-io.md`](04-dim4-fajl-io.md) | D4 — CSV / fájl import-export edge-ek |
| [`05-VERIFIKACIOS-NAPLO.md`](05-VERIFIKACIOS-NAPLO.md) | A 3 súlyosság-vita teljes verifikációs útja + a sanitizer-mérés |

---

**Nem léptem tovább Fázis 7-re — jóváhagyásra várok.**
