# Fázis 6 — Dimenzió 3 (XSS/render-injection) + Dimenzió 4 (CSV/fájl I/O)

> Független finder + adverzariális verifikáció. Csak dokumentálás.
> Séma: **fájl · sor · súlyosság · forgatókönyv · verifikációs verdikt.**

---

## Dimenzió 3 — XSS / render-injection

### Módszer
1. `grep dangerouslySetInnerHTML resources/js/` → 2 sink.
2. `grep innerHTML|insertAdjacentHTML|outerHTML|document.write` az extension + player forrásában → ~50 sink.
3. Az `esc()` (`chrome-extension/src/shared.js:38`) és `sanitizeHtml()` (`resources/js/lib/sanitize-html.ts`) helperek ellenőrzése.
4. Heurisztikus szűrő: minden `innerHTML`-templátumban lévő `${...}` interpoláció, amelyik **nem** `esc()`/`encodeURIComponent`/ismert konstans/numerikus → 1 találat (`${html}`).

### React sink-térkép
| Sink | Adatforrás | Védelem | Verdikt |
|---|---|---|---|
| `rich-text-editor.tsx:320` (`RichTextContent`) | flashcard `front/back/*_notes` (user + AI) | `sanitizeHtml(html)` minden híváskor | tiszta |
| `two-factor-setup-modal.tsx:81` | `qrCodeSvg` | **szerver-generált** Fortify QR (app-titokból), nem user-input | tiszta |

`RichTextContent` az **egyetlen** komponens, ami user rich-textet renderel, és a hívói (`card-preview-dialog.tsx`, `flashcards/study.tsx`, `flashcards/calibrate.tsx`) mind rajta keresztül mennek.

### XSS-1 — React rich-text render — CONFIRMED tiszta
- **Fájl/sor:** `resources/js/lib/sanitize-html.ts:82`, `resources/js/components/ui/rich-text-editor.tsx:315`.
- **Súlyosság:** INFO.
- **Forgatókönyv:** az extension-API-n át `<img onerror=…>`/`<script>` tartalmú flashcard tárolása → tárolt XSS a web-render során.
- **Verifikáció:** a `sanitizeHtml` allowlist-alapú (tag/attr whitelist), töröl minden `on*` handlert, `javascript:`/`data:` URL-t, CSS `expression()`/`url()`-t, és a veszélyes tageket (`script/iframe/svg/...`) egészben dobja. SSR-ben **fail-safe** üres stringet ad (nem gyengébb regex). A render **mindig** ezen megy át. **CONFIRMED tiszta.**

### XSS-2 — nyers `${html}` sink az extension YouTube-paneljében — CONFIRMED (LOW)
- **Fájl/sor:** `chrome-extension/src/youtube.js:786` (`setYtPanelMessage`).
- **Súlyosság:** LOW (defense-in-depth).
- **Forgatókönyv:** ha attacker-kontrollált string jutna a `setYtPanelMessage(html)`-be, `<div class="msg">${html}</div>` nyersen a shadow-DOM-ba írná.
- **Adverzariális verifikáció (2 kör, lásd összesítő „Gyanú A"):** minden hívó hardcoded literál vagy `extErrorMessage()` (fix szótár + hardcoded fallback); az egyetlen interpoláló hívó `${APP_URL}` build-konstanst szúr be. A szerver-`resp.error` csak enum-kulcsként fut a szótárba, sosem nyers stringként. **Nem exploitálható**, de a garancia a hívók fegyelmén múlik, nem strukturális escaping-en → LOW.

### XSS-3 — extension/player DOM-írás user/AI-mezőkkel — CONFIRMED tiszta
- **Fájl/sor:** `search-modal.js:265`, `lookup-popup.js:464/498`, `youtube.js:288 (ytWordsToHtml)`, `netflix.js:174`, `flashcard-modal.js:386`, `popup.js:67`, `topwords-player/src/renderer.js`.
- **Súlyosság:** INFO.
- **Forgatókönyv:** szerver/AI által visszaadott `word`/`meaning_hu`/`extra_meanings`/`part_of_speech` vagy felirat-szöveg nyersen a DOM-ba.
- **Verifikáció:** minden ilyen mező `esc()`-elt (HTML-entity encoder), a felirat-tokenek `esc(token.text)`; a `STATUS_COLORS`/`STATUS_LABELS` **kliens-konstansok**; a `popup.js` stat-értékei (`total`,`withStatus`,`count`,`pct`) numerikusan számoltak. A player ugyanezt a `replaceChildren`+`esc` diszciplínát követi (kód-komment: „sosem nyers innerHTML-lel"). A heurisztikus szűrő a player-forráson **0 nem-escapelt** interpolációt adott. **CONFIRMED tiszta.**

---

## Dimenzió 4 — CSV / fájl import-export edge-ek

### Módszer
`FlashcardCsvController` teljes olvasása; `TextAnalysisController::uploadBook` validáció; `ExtensionController::createFlashcard` mező-capek; összes export-végpont (`grep text/csv|Content-Disposition|streamDownload`).

### Fájl-I/O térkép
| Végpont | Validáció | Extra guard | Verdikt |
|---|---|---|---|
| `POST flashcards/{deck}/csv-import` | `mimes:csv,txt`,`max:2048` (2 MB) | 5000 sor-cap, 10000 char/mező-cap, BOM-kezelés, slot-limit zár alatt, `textToHtml` (`htmlspecialchars`) | tiszta |
| `GET flashcards/{deck}/export` (CSV) | ownership | **formula-injection véd** (`=+-@`→`'`), quote-duplázás, filename-sanitizálás | tiszta |
| `POST text-analysis/books` (EPUB) | `mimetypes:application/epub+zip,application/zip`,`extensions:epub`,`max:30720` | zip-bomba pre-check (`safeReadZipEntry`), PDF tudatosan kivezetve (CPU-DoS) | tiszta |
| `POST extension/create-flashcard` | minden mező `max:`, `color` regex, `word_id` `exists:words`, deck rel-scope | keret-foglalás zár alatt, refund elbukásra | tiszta |
| `GET settings/subscription/invoice PDF` | ownership 404 + `isIssued()` | Billingo bináris passthrough, `application/pdf`, filename-sanitizálás | tiszta (nem CSV-scope) |

### CSV-1 — CSV-export formula-injection — CONFIRMED tiszta
- **Fájl/sor:** `app/Http/Controllers/FlashcardCsvController.php:182` (`csvRow`).
- **Súlyosság:** INFO.
- **Forgatókönyv:** a user `=cmd|…`/`+`/`-`/`@` kezdetű flashcard-tartalmat ment; export után Excel/Sheets képletként futtatná (CSV-injection / adat-exfiltráció).
- **Adverzariális verifikáció (3 kör, lásd összesítő „Gyanú B"):** (1) `=+-@` prefix `'`-vel; (2) vezető-whitespace-bypass kizárva a `stripHtml` **trim** miatt; mező-szeparátor-injektálás kizárva a teljes idézőjelezés + quote-duplázás miatt; (3) export→import round-trip `htmlspecialchars`+`sanitizeHtml` alatt marad. **CONFIRMED tiszta.**

### CSV-2 — import-encoding nincs normalizálva — CONFIRMED (LOW)
- **Fájl/sor:** `app/Http/Controllers/FlashcardCsvController.php:34–48`.
- **Súlyosság:** LOW (robustness/adatminőség).
- **Forgatókönyv:** nem-UTF-8 (pl. Latin-1/Windows-1250) CSV feltöltése; a `fgetcsv` bájt-szinten olvas, nincs `mb_convert_encoding` UTF-8-ra → az ékezetes karakterek eltorzulva tárolódnak, esetleg érvénytelen UTF-8 kerül a DB-be.
- **Verifikáció:** csak a BOM-ot kezeli (UTF-8 BOM strip), egyéb kódolást nem konvertál. **Nincs biztonsági hatás** — a `mb_strlen`-capek és a render-oldali `sanitizeHtml` így is védenek, XSS/overflow nem nyílik. Kizárólag adatminőség (torz ékezetek). **CONFIRMED mint LOW robustness-megjegyzés.**

---

## Dimenzió 3+4 összegzés
**0 HIGH · 0 MEDIUM · 2 LOW (XSS-2, CSV-2) · 3 INFO.** Minden XSS-sink escaping/sanitizer mögött; a CSV/fájl-felület MIME/méret/hossz/sor-capekkel és formula-injection-védelemmel zárt. A 2 LOW defense-in-depth (nyers `${html}` hívó-fegyelem) és adatminőség (import-encoding) — nem kihasználható.
