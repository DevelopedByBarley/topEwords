# Független újra-audit — Fázis 6: Input/output biztonság

> Készült: 2026-07-20 · a `last_audit/PLAN.md` **CSAK Fázis 6** része.
> **Független** újra-audit: kizárólag a `PLAN.md`-t olvastam; a korábbi audit-riportokat (`last_audit/fazis-6.md`, `project_phase6_audit_2026-07-19` és a többi memória-tétel) **szándékosan figyelmen kívül hagytam**, hogy az eredmény összevethető legyen az előző körrel.
> **Csak dokumentálás** — semmilyen kódot, tesztet nem módosítottam (audit-no-fixes szabály).
> **Mód:** multi-agent-jellegű workflow — dimenziónkénti finder (cáfolásra promptolt adverzariális verifikációval), a HIGH/MEDIUM-gyanús leletekre 2–3 független, cáfoló verifikátor-kör, LOW-ra egykörös. A fő-fájlokat saját kézzel is bejártam.

## Scope (PLAN.md Fázis 6, sorok 102–107)

1. **Mass-assignment / `$fillable` (`$guarded`) sweep** mind a 18 modellen — érzékeny mező (`is_admin`, `stripe_id`, `ai_*`) átírható-e.
2. **Validáció-lefedettség** — minden mutáló route-nak van-e validációja; a nem-FormRequest végpontok inline `validate()`-tel vagy anélkül dolgoznak-e. Végpontonkénti lista.
3. **XSS / render-injection** — AI-generált és user-tartalom megjelenítése: React `dangerouslySetInnerHTML` sweep + extension/player DOM-írás (`innerHTML`).
4. **CSV / fájl import-export edge-ek** — encoding, méret, sortörés, CSV-injection (kereszthivatkozás Fázis 4b-vel).

## Vizsgált élő kód-felület

| Felület | Mennyiség | Megjegyzés |
|---|---|---|
| Eloquent modellek | 18 | mind `#[Fillable([...])]` attribútummal vagy `protected $fillable`-lel — nincs `unguard()` |
| Mutáló route-ok (POST/PUT/PATCH/DELETE) | 77 (saját) | `route:list --except-vendor` |
| FormRequest | 14 | a PLAN 8-at említett; azóta bővült (Flashcard×5, FlashcardDeck×3, UserCustomWord×2, Settings×5) |
| React HTML-render sink | 2 | `RichTextContent` (sanitizált) + 2FA QR-SVG (szerver-generált) |
| Extension/player `innerHTML` sink | ~50 | `esc()` / `sanitizeHtml` / shadow-DOM + `replaceChildren` diszciplína |
| Fájl-feltöltés/-export végpont | 4 | CSV import+export, EPUB könyv-feltöltés, számla-PDF passthrough |

---

## Eredmény — összegzés

**0 HIGH · 0 MEDIUM · 3 LOW · 8 INFO · 0 go-live blokkoló.**

A PLAN Fázis 6 két központi feltételezése (mass-assignment-rés érzékeny mezőkön; hiányos validáció a kevés FormRequest miatt) **függetlenül is megdőlt** — minden érzékeny mező explicit ki van zárva a fillable-ból, és minden mutáló végpont validál vagy nem fogyaszt request-body-t.

| ID | Dimenzió | Súlyosság | Kategória | Verdikt |
|---|---|---|---|---|
| MA-1 | Mass-assignment | INFO | design | **REFUTED** — nincs globális `unguard()`; a 13 „üresnek látszó" modell valójában `#[Fillable([...])]`-attribútumos (nem sdebezhető) |
| MA-2 | Mass-assignment | INFO | design | **REFUTED** — `is_admin` oszlop nem is létezik; admin = `ADMIN_EMAIL` gate |
| MA-3 | Mass-assignment | INFO | design | CONFIRMED tiszta — `stripe_*`,`ai_*`,`lifetime_access`,`plan_override`,`trial_ends_at`,`invite_id`,`billingo_partner_id`,`terms_accepted_at` egyike sincs a `User` fillable-jában; csak `forceFill`/direkt property-set állítja |
| MA-4 | Mass-assignment | LOW | defense-in-depth | CONFIRMED — `is_imported` a `Flashcard` fillable-jában van; nem kihasználható (a `StoreFlashcardRequest` nem validálja, így `validated()` sosem adja vissza), de a keret-megkerülés csak a FormRequest-diszciplínán múlik |
| VAL-1 | Validáció | INFO | coverage | CONFIRMED tiszta — mind a 77 mutáló route validál (FormRequest / inline `validate()` / `TogglesWordStatus` helper) VAGY body-mentes erőforrás-akció (DELETE/reset/skip/duplicate/disconnect) |
| VAL-2 | Validáció | INFO | correctness | CONFIRMED tiszta — az admin- és entitlement-érintő végpontok (`setAccess`,`grantFreeMonth`,`WordController@update`) `Gate::authorize` mögött, szigorú `in:`/`exists:` szabályokkal |
| XSS-1 | XSS/render | INFO | correctness | CONFIRMED tiszta — minden React rich-text a `RichTextContent`-en át megy, ami mindig `sanitizeHtml()`-ez (allowlist + `on*`/`javascript:`/`data:` strip, SSR fail-safe üres string) |
| XSS-2 | XSS/render | LOW | defense-in-depth | CONFIRMED — 1 nyers `${html}` sink (`youtube.js:786 setYtPanelMessage`); nem kihasználható (minden hívó hardcoded string vagy `extErrorMessage` szótár + build-idejű `APP_URL`), de a nyers-HTML paraméter hívó-fegyelmezettségre bíz |
| XSS-3 | XSS/render | INFO | correctness | CONFIRMED tiszta — extension/player minden user/AI-mező `esc()`-elt; `STATUS_COLORS/LABELS` kliens-konstansok; a stat-számok numerikusak |
| CSV-1 | Fájl I/O | INFO | correctness | CONFIRMED tiszta — CSV-export formula-injection védett (`=+-@`→`'` prefix, minden mező idézőjelben, quote-duplázás); `stripHtml` trim-el a képlet-ellenőrzés előtt (nincs leading-whitespace-bypass) |
| CSV-2 | Fájl I/O | LOW | robustness | CONFIRMED — CSV-import nem normalizálja a bemeneti kódolást (nincs `mb_convert_encoding` UTF-8-ra); nem-UTF-8 fájlnál a mezők eltorzulhatnak. Nincs biztonsági hatás (a render sanitizál), csak adatminőség. |

> A 3 LOW mind **defense-in-depth / adatminőség** kategória — egyik sem kihasználható, egyik sem go-live blokkoló.

---

## HIGH/MEDIUM-gyanús leletek adverzariális verifikációja

Két lelet érte el a „gyanús, verifikálni kell" küszöböt; mindkettőt **cáfolásra promptolt, több körös** verifikáció bontotta le.

### Gyanú A — nyers `${html}` innerHTML-sink (kezdeti súlyosság-becslés: HIGH)
- **Hely:** `chrome-extension/src/youtube.js:786` — `body.innerHTML = \`<div class="msg">${html}</div>\``.
- **1. verifikátor (cáfoló):** a `setYtPanelMessage(html)` **összes** hívója (`youtube.js:798,900,905,928,939,947`) vagy hardcoded magyar literál, vagy `extErrorMessage(resp?.error, fallback)`. Utóbbi (`shared.js:97`) **fix szótárból** ad vissza értéket, különben a szintén hardcoded `fallback`-et.
- **2. verifikátor (cáfoló):** az egyetlen interpolációt tartalmazó hívó (`youtube.js:939`) `${APP_URL}`-t szúr be, ami **build-idejű konstans**, nem futásidejű/hálózati adat. A szerver-válasz (`resp.error`) csak enum-kulcsként fut be a szótárba, sosem nyers stringként a DOM-ba.
- **Verdikt:** **nem exploitálható.** A `${html}` sink szándékosan fogad megbízható markupot (a bejelentkezési link). Súlyosság HIGH → **LOW (XSS-2, defense-in-depth)**: a biztonság a hívók fegyelmezettségén múlik, nem strukturális garancián.

### Gyanú B — CSV formula-injection az exportban (kezdeti súlyosság-becslés: MEDIUM)
- **Hely:** `FlashcardCsvController::csvRow()` (`app/Http/Controllers/FlashcardCsvController.php:182`).
- **1. verifikátor (cáfoló):** a `=`,`+`,`-`,`@` kezdetű mezők elé `'` kerül → Excel/Sheets nem futtatja képletként.
- **2. verifikátor (adverzariális bypass-keresés):** klasszikus megkerülések — (a) vezető whitespace/`\t`/`\r` a képlet-karakter előtt: **kizárva**, mert a mezőt előbb `stripHtml()` **trim**-eli; (b) mező-szeparátor-injektálás (`,`/`\t`/`\r`/`\n`): **kizárva**, mert minden mező idézőjelbe van csomagolva és a belső `"`-k duplázva → a vezérlőkarakterek a cellán belül maradnak.
- **3. verifikátor (round-trip):** export→import round-trip a `textToHtml`/`stripHtml` páron át `htmlspecialchars`-szal escape-el, a re-import `sanitizeHtml` render-út alatt marad → nincs tárolt-XSS lánc sem.
- **Verdikt:** **nem exploitálható.** A védelem teljes; a lelet CSV-1-ként INFO (tiszta).

Egyéb gyanúk, amelyek nem érték el a MEDIUM-küszöböt: `UserBook`/`YoutubeTranscript`/`UserAchievement`/`BillingoInvoice` `user_id`-je a `$fillable`-ban → mindegyik create-helyen **hardcoded `$user->id`** (auth-userből), sosem request-input; a `Word`/`UserCustomWord` `status`/`importance`/`is_irregular` mezői user-facing route-okon **explicit szűk `update(['mező' => ...])`**-tel, nem mass-assign.

---

## Tesztelési megerősítés (független)

- `php artisan test --filter="Csv|Import|Export|MassAssign|Fillable|Sanitize|Xss"` → **35 passed (145 assertions)** — a CSV import/export, mass-assignment és sanitizer viselkedés a leírtnak megfelelő.
- Kódot/tesztet **nem** módosítottam.

## Konklúzió

- **0 go-live blokkoló.** A Fázis 6 három tengelye (mass-assignment, validáció, XSS/CSV) strukturálisan zárt.
- A PLAN két explicit feltevése (mass-assignment-rés; validáció-hézag a kevés FormRequest miatt) **megdőlt** — a `#[Fillable]`-attribútum L13-stílus + a `validated()`/helper-diszciplína teljeskörű.
- A 3 LOW (MA-4 `is_imported`, XSS-2 nyers `${html}`, CSV-2 encoding-normalizálás hiánya) **defense-in-depth / adatminőség**; egyik sem kihasználható. Fix csak explicit kérésre.
- **Nem léptem tovább** Fázis 7-re — jóváhagyásra várok.

### Fájlok
- `01-dim-1-2-mass-assign-valid.md` — Dimenzió 1 (mass-assignment) + Dimenzió 2 (validáció-lefedettség), séma-kényszerített leletekkel.
- `02-dim-3-4-xss-csv.md` — Dimenzió 3 (XSS/render) + Dimenzió 4 (CSV/fájl I/O), séma-kényszerített leletekkel.
