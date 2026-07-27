# Dimenzió C — Publikus fájl-felület: `storage/{path}` + fájl-feltöltések

> PLAN Fázis 4b, 1-2. pont: „`storage/{path}` (GET + PUT): él-e egyáltalán éles konfigban…" és
> „`FlashcardCsvController` + `TextAnalysisController:1611` fájl-feltöltés: MIME/kiterjesztés/méret-validáció,
> CSV-injection (`=`,`+`,`-`,`@` cellák), memória-robbanás nagy fájlnál."
>
> Finder: független agent · orchestrátor-keresztellenőrzés: escaping, deck-séma, `fopen` inline megerősítve.
> **Csak dokumentálás — kód NEM módosult.**

## Összesítő

| HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|
| 0 | 0 | 3 | 6 |

A dimenzió lényegében **TISZTA**. A PLAN három legnagyobb feltevése (storage-route létezik, CSV formula-injection nyitott, EPUB zip-bomba) mind **MEGDŐLT** — a védelmek megvannak, sorszámmal igazolva.

**A dimenzió súlyozását egyetlen strukturális tény hajtja:** a paklik és kártyák kizárólag self-scope-ban élnek — nincs megosztás, nincs seeder, nincs cross-user írási út —, így minden export-oldali lelet definíció szerint LOW-plafonos.

---

## Part 1 — `storage/{path}` route: NEM LÉTEZIK

`php artisan route:list | grep -i storage` → **üres** (exit 1), a 159 route közül egy sem.
`config/filesystems.php:33-42`: a `local` disk `'serve' => false`, magyarázó kommenttel (36-39. sor, HDR-4/STORAGE-2 hivatkozás). A middleware nélküli GET+PUT `storage/{path}` route-pár **nem regisztrálódik**. Ez nem lelet, hanem megdőlt PLAN-feltevés.

**Fájlt kiszolgáló egyéb utak** — teljes `app/` + `routes/` grep (`Storage::download`, `->download(`, `response()->file`, `response()->stream`, `temporaryUrl`, `Storage::url`, `readfile`, `streamDownload`) pontosan **kettőt** talált:

| Hely | Státusz |
|---|---|
| `app/Http/Controllers/DownloadController.php:30` | **G dimenzió auditálja** (külön finder) |
| `app/Http/Controllers/Settings/SubscriptionController.php:113` | `response()->streamDownload(...)`, Cashier-számla — nincs fájlrendszer-útvonal user-inputból |

`file_get_contents` request-inputtal: **nincs**. Az egyetlen találat `app/Console/Commands/ImportWords.php:35` — CLI-parancs, nem HTTP-felület.

---

## Part 2 — FlashcardCsvController

### Feltöltés-validáció
`FlashcardCsvController.php:28`: `['required', 'file', 'mimes:csv,txt', 'max:2048']`.

**`.php`/`.html` fájl NEM csúszik át:** a `mimes:` a Symfony guesser MIME-jét kéri, és a kliens-kiterjesztésnek is egyeznie kell a MIME-hez tartozó listával (`vendor/symfony/mime/MimeTypes.php:2271`: `csv => [text/csv, application/csv, text/x-comma-separated-values, text/x-csv]`). Egy `.php` kiterjesztésű fájl `text/x-php`-ként detektálódik → elutasítva.

**Ez amúgy is mellékes:** a feltöltött fájl **soha nem kerül lemezre** — `:34` csak `getRealPath()`-ot hív a PHP tmp-fájlra, olvassa (`:35-86`), majd a request végén a PHP törli. Nincs `store()`/`storeAs()`/`move()` sehol a `app/Http/Controllers/` alatt (grep igazolva). Web-elérhetőség tehát **nem áll fenn**.

### Formula injection az exporton — ZÁRT, mind a 4 prefixre
`:196-210` `csvRow()`, a döntő sor **`:200`**: `in_array($field[0], ['=', '+', '-', '@'], true)` → `'` prefix, majd `"` duplikálás (`:204`).
A finder empirikusan végigvitte a teljes round-tripet (`=cmd|'/c calc'!A1` → web-editor tárolás → `stripHtml` → `csvRow`): a kimenet `"'=cmd|'/c calc'!A1"`, a képlet **neutralizált**. Orchestrátor inline újraolvasással megerősítve.

Tab/CR prefix: a `csvRow()` ezeket nem kezeli, de nem is kell — a `stripHtml()` `trim()`-je (`:193`) levágja a vezető whitespace-t (mérve: `"<p>\t=cmd|calc</p>"` → `"=cmd|calc"`), utána a `:200` elkapja. **Nincs bypass.**

### A victim kizárólag maga a támadó — a súlyozás alapja
`database/migrations/2026_04_04_184400_create_flashcard_decks_table.php:15-19` — a `flashcard_decks` séma: `id, user_id, name, description, timestamps`. **Nincs** `is_public`/`shared`/`shared_with` oszlop *(orchestrátor inline megerősítve)*. Nincs flashcard-seeder (`database/seeders/` grep: 0 találat). Minden kártya-írási út self-scoped (`FlashcardCardController.php:47, 66, 116-117, 126-127, 141-142, 150, 163-164, 193-194, 203, 217, 234, 277, 302, 312` — minden metódus `abort_unless($deck->user_id === $request->user()->id, 403)`).

Támadó tehát **nem tud** tartalmat juttatni más user exportjába → cross-machine hatás nincs → **CLEAN**.

### Memória / caps
Streamelt olvasás: `:35` `fopen` + `:48` `fgetcsv` soronként — **nincs** `file_get_contents`/`file()` a teljes fájlra. A konstansok: `MAX_IMPORT_ROWS = 5000` (`:14`, érvényesítve `:49`), `MAX_FIELD_LENGTH = 10000` (`:21`, érvényesítve `:69`).
A `$rows` tömb teljesen memóriában áll az insert előtt (`:75-83`), de a **`max:2048`** (2 MB fájl) ezt jóval a row/field-capok előtt lekötözi: 2 MB fájlból legfeljebb ~2M karakter mezőadat jöhet, tehát a caps-alapú elméleti worst-case **nem érhető el**. Nincs lelet.

### IDOR — 0
Mindkét irányban zárt, azonos mintával: import `:25` `abort_unless($deck->user_id === $request->user()->id, 403)`; export `:128` ugyanaz. A route-ok `['auth', 'verified', EnsureOnboardingComplete::class]` mögött (`routes/flashcards.php:13`, 38-39. sor).

### Parsing / atomicitás
- **BOM:** `:38-41` kezelve, `rewind()` ha nincs BOM.
- **Ékezetek:** `:157-164` `normalizeEncoding()` — `mb_check_encoding` után `mb_convert_encoding(..., 'Windows-1252')`. A kód **cp1252**-t feltételez, nem ISO-8859-2-t → lásd CSV-C1.
- **Idézett mezőben sortörés:** `fgetcsv` natívan kezeli; a `textToHtml()` (`:171`) `preg_split`-tel bont `<p>`-kre.
- **Atomicitás: rendben.** A hibás sorok nem szakítják meg a feldolgozást, `continue`-val kimaradnak és számlálódnak (`:54-73`, `$skipped`), a user visszajelzést kap (`:114-116`). Az insert egyetlen `DB::transaction`-ban fut (`:93-97`), user-szintű `reserveFlashcardSlots` zár alatt (`:92`), `LockTimeoutException` barátságosan kezelve (`:99-104`). **Nincs részleges adat.**

---

## Part 3 — EPUB feltöltés (TextAnalysisController)

A valódi upload-kezelés a `uploadBook()`-ban van, **`:1662-1743`** — nem a PLAN-ban említett ~1611. soron.

### Validáció
`:1674`: `'required|file|mimetypes:application/epub+zip,application/zip|extensions:epub|max:30720'` — hármas kapu: valós MIME + kiterjesztés + 30 MB. Rate-limit: `routes/text-analysis.php:25` `throttle:10,1,ta-books`. Második védvonal `:1692-1695`: a `match` `default` ága `RuntimeException`-t vet, hogy egy jövőbeli formátum ne csúszhasson át némán.

### Zip-bomba — mind a 4 védelem megvan
| Védelem | Hely | Mechanizmus |
|---|---|---|
| Kicsomagolás **előtti** méret-ellenőrzés | `:2130-2139`, döntő sor **`:2134`** | `$zip->statName($name)` + `($stat['size'] ?? 0) > MAX_EPUB_ENTRY_BYTES` → `false` **a `getFromName()` ELŐTT**; per-entry cap 5 MB (`:719`) |
| Kumulatív stop | `:1867-1870` | `MAX_EPUB_TOTAL_BYTES = 40 MB` (`:722`), a ciklus `break`-el |
| Spine-cap + dedup | `:2053`, `:2048-2051` | `MAX_EPUB_SPINE_ITEMS = 500` (`:728`) + `$seenPaths` — preparált OPF ismételt `idref`-jei nem tömöríttetik ki újra ugyanazt (#R11 CPU-DoS) |
| Path traversal | `:2109-2122` `normalizePath()` | `..` → `array_pop`, üres és `.` szegmensek dobva |
| Kimenet-cap | `:736`, `:746-749`, `:1881` | `MAX_BOOK_TEXT_BYTES = 10 MB`, MEDIUMBLOB (16 MB) alatt tart — 422 helyett nem 500 |

**A path traversal amúgy is másodlagos:** a normalizált út csak `statName()`/`getFromName()` **zip-belső** lookup-kulcsa (`:2073`, `:2132`, `:2138`) — nincs fájlrendszer-írás, nincs extract-to-disk, tehát `../` sem tudna a zipből kiírni. Kettős védelem.

### PDF — kivezetve
`composer.json`/`composer.lock`: `smalot/pdfparser` **nincs** (az egyetlen „Pdf"-találat a Cashier opcionális `spatie/laravel-pdf` suggest-je, `composer.lock:1282`). PDF-út nem létezik; a `:1664-1672` komment dokumentálja a kivezetés okát (mért 163 s szuperlineáris `getText()`).

### Perzisztencia
**Nem kerül lemezre.** `:1693` csak `getRealPath()`-ot ad a `ZipArchive::open()`-nek, a kinyert szöveg `gzencode`-olva DB-be megy (`:1709`, `:1723`). A PHP tmp-fájl a request végén törlődik.

---

## LOW leletek

### CSV-C1 · `FlashcardCsvController.php:157-164` · LOW · ISO-8859-2 CSV ékezet-torzulás
- **Forgatókönyv:** a user Excel/LibreOffice-ból ISO-8859-2 (Latin-2) kódolású CSV-t exportál — magyar nyelvterületen reális —, amiben `ő` (0xF5) és `ű` (0xFB) szerepel. A `mb_check_encoding($field, 'UTF-8')` false-t ad, ezért a `:163` **cp1252**-ként konvertál: a 0xF5 `õ`-vé, a 0xFB `û`-vé válik. A kártya csendben hibás ékezettel jön létre, a user hibás szót tanul be és exportál tovább.
- **Verdikt:** CONFIRMED.
- **Miért LOW:** kizárólag adat-integritás/UX, csak a saját adatán, semmilyen biztonsági határt nem sért; nincs cross-user hatás. Nem MEDIUM, mert nincs bizalmasság-/integritás-sértés más felé, és a felhasználó a kártyán látja a hibát.

### CSV-C2 · `FlashcardCsvController.php:35` · LOW · ellenőrizetlen `fopen()` visszatérési érték
- **Forgatókönyv:** ha a PHP tmp-fájl a validáció és a `fopen` közt eltűnik (tmp-cleanup, megtelt lemez, `open_basedir`), a `$handle === false`, és a `:38` `fread(false, 3)` `TypeError`-t vet → HTTP 500, stack trace a logba, a user értelmezhetetlen hibát kap egy amúgy érvényes fájlra. *(Orchestrátor inline megerősítve: `:35` `$handle = fopen($path, 'r');` — nincs `if (! $handle)` guard, a `:38` közvetlenül használja.)*
- **Verdikt:** CONFIRMED.
- **Miért LOW:** kizárólag robusztusság/hibakezelés; nem kiváltható megbízhatóan támadó által (a tmp-fájl léte a PHP kezében van), a hatás egy 500-as a saját requestre, adatvesztés nincs (az insert el sem indul). Nem MEDIUM, mert nincs DoS-amplifikáció és nincs adat-hatás.

### EPUB-C1 · `TextAnalysisController.php:1859-1876` · LOW · a kumulatív stop az utolsó entry kitömörítése UTÁN dönt
- **Forgatókönyv:** preparált EPUB 500 spine-elemmel (a `:2053` cap alatt), mindegyik pont 5 MB alatti, magas tömörítésű HTML. A per-entry cap (`:2134`) mindegyiket átengedi, a kumulatív 40 MB stop (`:1868`) viszont csak MIUTÁN az entry már kitömörült és a `strlen()` megtörtént — vagyis a break előtti utolsó entry teljes 5 MB-ja plusz a `htmlToCleanText()` regex-lánca (`:1893-1908`) lefut rá. Egy request így néhány másodperc CPU-t és ~45 MB csúcs-memóriát kötöget.
- **Verdikt:** CONFIRMED (mért nagyságrend, nem elméleti).
- **Miért LOW:** a caps a nagyságrendet megfogják (40 MB összesen, nem több száz MB), a `throttle:10,1,ta-books` (`routes/text-analysis.php:25`) percenként 10-re fogja, és a feltöltés `auth`+`verified`+onboarding mögött van, tehát a támadónak igazolt fiók kell. Nincs OOM, nincs worker-lefogás percekre (szemben a kivezetett PDF-fel). Nem MEDIUM, mert a védelem fail-closed és a költség a hitelesített user saját kvótájából megy.

---

## INFO tételek

- **INFO-1 · `config/filesystems.php:39`** — a `serve => false` szándékos, kommentelt döntés. **Regressziós veszély:** ha valaha `disk('local')->temporaryUrl()`-re lesz szükség, ez a sor visszabillen és middleware nélküli GET+PUT route-ok jelennek meg.
- **INFO-2 · `FlashcardCsvController.php:200`** — formula-injection escaping mind a 4 prefixre él; tab/CR a `:193` `trim()` miatt nem kihasználható. CLEAN.
- **INFO-3 · `create_flashcard_decks_table.php:15-19`** — nincs megosztás-oszlop, nincs seeder, minden kártya-írási út self-scoped → az export-oldali formula-injection **strukturálisan** self-only. **Regressziós figyelmeztetés:** ha valaha megosztott/publikus pakli jön, a CSV-export escaping azonnal biztonság-kritikussá válik.
- **INFO-4 · `FlashcardCsvController.php:25, 128`** — IDOR-védelem mindkét végponton azonos mintával, auth+verified+onboarding mögött. IDOR = 0.
- **INFO-5 · `TextAnalysisController.php:2134`** — a zip-bomba-védelem lényege: `statName()` a `getFromName()` **előtt** dönt. A PLAN-ban gyanított rés nem áll fenn.
- **INFO-6** — egyetlen feltöltési út sem perzisztál lemezre (nincs `store`/`storeAs`/`move` a `app/Http/Controllers/` alatt); a fájlok a PHP tmp-könyvtárában élnek a request idejére. **Ez a legerősebb szerkezeti védelem: web-elérhető feltöltött fájl nem létezhet.**

---

## PLAN-feltevés MEGDŐLT (6 db)

1. **`storage/{path}` GET/PUT route létezik és middleware nélküli.** → Nem létezik. `route:list | grep -i storage` üres; `config/filesystems.php:39` `'serve' => false`.
2. **CSV formula injection nyitott az exporton.** → Zárt mind a 4 prefixre (`:200`), round-trip empirikusan igazolva. Ráadásul strukturálisan self-only (nincs pakli-megosztás).
3. **EPUB zip-bomba: nincs kicsomagolás előtti méret-ellenőrzés.** → Van: `:2134` `statName()` a `getFromName()` előtt, + kumulatív 40 MB stop (`:1868`), + 500 spine-cap (`:2053`), + `$seenPaths` dedup (`:2048`), + 10 MB kimenet-cap (`:1881`).
4. **PDF-feltöltés él (pdfparser).** → Kivezetve; `smalot/pdfparser` nincs a `composer.lock`-ban, a `:1664-1672` komment dokumentálja az okot.
5. **Az upload-kezelés a `TextAnalysisController` ~1611. soránál van.** → A valódi hely `:1662-1743` (`uploadBook`).
6. **`.php`/`.html` átcsúszhat CSV-ként és web-elérhetővé válhat.** → Kettősen kizárt: a `mimes:csv,txt` MIME+kiterjesztés-párost kér, és a fájl amúgy sem kerül lemezre.

---

## Összevetés a 2026-07-20-i körrel

Az akkori kör ebben a körben **0 LOW / 5 INFO**-t adott (STOR-1 + UP-1..UP-4). Mostani eltérések:

- **Nincs regresszió** — mind az 5 akkori INFO-védelem a helyén (escaping, streamelt import, zip-bomba-caps, nem-perzisztálás).
- **3 új LOW**, amit az előző kör nem vizsgált: CSV-C1 (ISO-8859-2 ékezet), CSV-C2 (`fopen` guard), EPUB-C1 (kumulatív stop sorrendje). Ezek **új lefedettség**, nem visszaesés.
- **Pontosítás az előző riporthoz:** az akkori szöveg „8 MB letöltési sapkát" írt a `fetchSource`-ra; a valóság `MAX_FETCH_BYTES = 2 MB` (`TextAnalysisController.php:245`). A 8 MB a caption-lánc `MAX_CAPTION_BYTES`-a (`YouTubeCaptionService.php:22`) — a két konstans összekeveredett az előző összesítőben.
