# Dimenzió E — Chrome extension + publikus extension-forrás

**Audit dátuma:** 2026-07-27
**Terjedelem:** `chrome-extension/` (manifest 1.24, 6457 sor JS), `routes/extension.php`, `app/Http/Controllers/ExtensionController.php`, `app/Http/Controllers/DownloadController.php`, `public/`
**Kizárva:** `*.zip` (a 1.24 kivételével — verzió-drift ellenőrzéshez), `backup/` (nem létezik)
**Módszer:** csak dokumentálás, kód nem módosult.

---

## Összesítő

| Súlyosság | Db | Azonosítók |
|---|---|---|
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 3 | **EXT-M1** (verifikáció után LOW), EXT-L1, EXT-L2 |
| INFO | 6 | EXT-I1 … EXT-I6 |
| **Összesen** | **9** | |

> **⚠️ SÚLYOSSÁG- ÉS MINŐSÍTÉS-KORREKCIÓ a verifikációs kör után.** A finder eredetileg **MEDIUM**-ot adott az EXT-M1-re, és **„részleges regressziónak"** nevezte. Három független, eltérő lencséjű adverzariális verifikátor (kihasználhatóság · blast-radius · meglévő védelmek) **3/3 szavazattal LOW-ra** minősítette, és a **„regresszió" címkét git-bizonyítékkal megdöntötte**. A fenti tábla a **végleges** súlyokat mutatja. Részletek: `07-verifikacios-naplo.md`.

**Verdikt:** a bővítmény támadási felülete szűk és tudatosan tervezett — nincs `externally_connectable`, nincs `web_accessible_resources`, nincs `<all_urls>` host-permission, nincs token-tárolás, nincs `eval`/`executeScript`/remote script. A legsúlyosabb lelet egy **hiányzó `isTrusted`-guard új felületen** (nem regresszió): a friss (1.24) felirat-gyorsgesztus közös kezelője csak a `click`-ágat védi, a `mousedown` (hosszú-nyomás) és `dblclick` ágat nem — miközben a `page-highlight.js` ugyanezt a mintát helyesen, centralizáltan oldja meg.

---

## A 11 vizsgálati pont mátrixa

| # | Pont | Verdikt | Lelet |
|---|---|---|---|
| 1 | manifest: permissions / host_permissions / CSP / WAR / externally_connectable | **TISZTA** | EXT-I1, EXT-L1 |
| 2 | `onMessage` / `onMessageExternal` sender-ellenőrzés (confused deputy) | **TISZTA** | EXT-I2 |
| 3 | `isTrusted`-guard (M2 regresszió-ellenőrzés) | **NEM regresszió** (a régi fix ép) — **új felületen hiányzó guard** | **EXT-M1** (LOW) |
| 4 | `window.postMessage` listener-ek | **N/A — nincs egy sem** | EXT-I3 |
| 5 | Token-tárolás (`storage.local`/`sync`/`localStorage`, page-world) | **TISZTA** | EXT-I4 |
| 6 | DOM-injekció (`innerHTML` külső adatból) | **TISZTA** | EXT-I5 |
| 7 | Backend-hívások origin / HTTP / CORS | **TISZTA** | EXT-I6 |
| 8 | Felirat-gyorsgesztus payload sanitizálás (1.22–1.24) | **TISZTA (sanitizálás), lásd M1 (gesztus)** | — |
| 9 | `chrome.tabs` / `scripting.executeScript` | **N/A — nincs `scripting` permission** | — |
| 10 | `eval` / `new Function` / `unsafe-eval` / remote script | **TISZTA — egy sem** | — |
| 11 | Verzió-drift + dev-maradvány | **TISZTA — bitre azonos** | EXT-L2 |

---

## 1. `manifest.json` — permissions és exponált felület

`chrome-extension/manifest.json:1-52`

| Mező | Érték | Értékelés |
|---|---|---|
| `manifest_version` | `3` | ✅ MV3 — a remote-code és `unsafe-eval` tiltás alapból érvényes |
| `permissions` | `activeTab`, `contextMenus`, `storage` | ✅ mindhárom indokolt (lásd lent) |
| `host_permissions` | `https://topwords.eu/*` | ✅ **szűk** — nem `<all_urls>`, nem `*://*/*`, HTTPS-only |
| `content_security_policy` | **nincs** | ✅ MV3 alapértelmezett CSP marad (`script-src 'self'`) |
| `externally_connectable` | **nincs** | ✅ web-origin és más extension nem küldhet üzenetet |
| `web_accessible_resources` | **nincs** | ✅ egyetlen fájl sem érhető el oldalról → **nincs fingerprinting-felület** |
| `minimum_chrome_version` | `110` | ✅ |

**Permission-indoklás (sorszámmal igazolva):**
- `contextMenus` → `background.js:176,182` (két menüpont létrehozása)
- `storage` → `background.js:103,115,123,133` (státusz-cache) + `shared.js:67,87`
- `activeTab` → a popup „Oldal statisztikái" gombja (`popup.js:104`) az aktív fülön futó content scripttel beszél

**Kulcsfontosságú megállapítás a `web_accessible_resources` hiányáról:** mivel egyetlen erőforrás sem web-accessible, egy tetszőleges oldal nem tudja `chrome-extension://<id>/...` URL-lel megállapítani, hogy a felhasználó telepítette-e a bővítményt (a klasszikus extension-fingerprinting vektor). A content script által beszúrt DOM (`#tw-yt-bar-host`) ugyan detektálható, de az csak YouTube/Netflix nézőoldalon és csak bekapcsolt felirat-sávnál létezik.

**`content_scripts.matches: ["<all_urls>"]`** (`manifest.json:29`) — lásd EXT-L1.

---

## 2. Üzenet-kezelők: sender-ellenőrzés

Két `chrome.runtime.onMessage` listener van, **`onMessageExternal` egy sincs**:

| Fájl · sor | Guard |
|---|---|
| `background.js:222-228` | `if (sender.id !== chrome.runtime.id) return;` ✅ |
| `src/page-highlight.js:394-400` | `if (sender.id !== chrome.runtime.id) return;` ✅ |

**Confused deputy értékelés — NEM áll fenn.** Kettős védelem:
1. `externally_connectable` hiányában a web-origin `chrome.runtime.sendMessage`-e eleve nem jut el a listenerhez (a Chrome nem is exponálja az API-t az oldalnak, ha nincs deklarált matches).
2. Ha mégis eljutna (pl. más extension), a `sender.id` egyeztetés eldobja.

A `background.js:229-463` privilegizált ágai (`ADD_WORD`, `UPDATE_STATUS`, `QUICK_STATUS`, `CREATE_FLASHCARD`, `GEMINI_*`) tehát csak saját kontextusból hívhatók.

---

## 3. `isTrusted`-guard — REGRESSZIÓ-ELLENŐRZÉS

### Meglévő guardok (a korábbi M2-fix él)

| Fájl · sor | Esemény | Guard |
|---|---|---|
| `src/lookup-popup.js:14` | `mousedown` (dupla-klikk popup) | ✅ |
| `src/lookup-popup.js:73` | `keydown` (gyorsbillentyűk, 1–5 státusz) | ✅ |
| `src/page-highlight.js:247` | `hlSpanFromEvent()` — **centralizált** | ✅ |
| `src/flashcard-modal.js:356` | `keydown` (Escape) | ✅ |
| `src/shared.js:296` | `click` | ✅ |

A `page-highlight.js` a helyes minta: a guard a **közös span-feloldó helperben** (`hlSpanFromEvent:246-249`) ül, ezért mind a négy handler (`mousedown:275`, `dblclick:298`, `click:312`, `mouseup`) automatikusan örökli. Az eredeti M2-fix tehát az oldal-kiemelésen sértetlen.

### EXT-M1 · ~~MEDIUM~~ → **LOW** (verifikáció után) · `src/shared.js:247-290` — a felirat-gesztusok `mousedown`/`dblclick` ága guard nélkül

**Fájl · sor:** `chrome-extension/src/shared.js:247` (`mousedown`), `:278` (`dblclick`) — szemben a `:296` (`click`) meglévő guardjával.

**Súlyosság:** **LOW** (finder: MEDIUM → 3 verifikátor 3/3 szavazattal LOW)
**Verifikációs verdikt:** **CONFIRMED** a technikai ténymagra · **REFUTED** a MEDIUM súlyra és a „regresszió" minősítésre

**Verifikációs út** (részletesen: `07-verifikacios-naplo.md`):
- *Kihasználhatóság-lencse* — a támadás **működik** (a listener a shadow rooton **belüli** `#bar` elemen ül, tehát a támadónak buborékolásra sem kell hagyatkoznia; a `mousedown`-ág `mouseup` nélkül 500 ms múlva magától tüzel). **De a támadó-modell szűk:** hirdetés-iframe cross-origin miatt **kiesik**, rosszindulatú kiterjesztés ellen az `isTrusted` amúgy sem érdemi védelem (annak `dispatchEvent`-je is `isTrusted:false`, viszont `chrome.scripting`-gel bármit tud) → az egyetlen nem-degenerált vektor egy **előre telepített ellenséges user-script** (Tampermonkey), ami már önmagában súlyosabb kompromittáltság.
- *Blast-radius-lencse* — **a finder súlyosbító feltevése MEGDŐLT:** a `user_word` pivot csak `status`/`reviewed_at`/`importance`-t hordoz, **SRS-ütemezés nincs benne**, és a `flashcards` FK a `words`-höz köt, nem a pivothoz → a `detach` **nem** cascade-el ütemezési adatra. Egyetlen valós veszteség a néma `importance` (csillagozás). Self-only, enum-validált (`in:known,learning,saved,pronunciation,practice`), `throttle:60,1,word-writes` alatt, a UI-ban látható. Free usernél a napi 20-as extension-keret kimeríthető — éjfélkor lejár.
- *Meglévő-védelmek-lencse* — a `sender.id`-guard és a CSRF-token **szerkezetileg tehetetlen** ezzel a vektorral (a saját content script küldi, a tokent a background maga szerzi be). **Viszont a „regresszió" állítás tárgyilag téves** — lásd alább.

**A „regresszió" minősítés MEGDŐLT (git-bizonyíték):** a `git log -S` szerint az `attachCaptionWordGestures` **és** a benne lévő egyetlen `isTrusted`-sor **ugyanabban a commitban** (`fbf4405`, „Extension 1.24") született, `src/shared.js`-be **tiszta +162 soros beszúrásként, 0 törléssel**. A `shared.js` teljes `--follow` történetében soha nem volt más `isTrusted`-előfordulás. **Guardot senki nem távolított el** — a korábbi M2-fix a `lookup-popup.js` / `page-highlight.js` felületeit védte, azok ma is védettek. Ez tehát **új felület hiányzó guarddal**, nem visszaesés.

**Az aszimmetria pontosan:**

```
shared.js:247  root.addEventListener('mousedown', (e) => {   // ← NINCS isTrusted
shared.js:255      const span = wordSpanFromEvent(e);          //   → 500 ms után quickStatus(span,'saved')
shared.js:278  root.addEventListener('dblclick', (e) => {    // ← NINCS isTrusted
shared.js:279      const span = wordSpanFromEvent(e);          //   → azonnal quickStatus(span,'known')
shared.js:292  root.addEventListener('click', (e) => {
shared.js:296      if (!e.isTrusted) { return; }               // ← VAN guard (csak itt)
```

A `wordSpanFromEvent` callbackek (`youtube.js:267,764`, `netflix.js:109`) csak `e.target?.closest?.('.tw-word')`-öt csinálnak — **nem** tartalmaznak `isTrusted`-ellenőrzést, ellentétben a `page-highlight.js` `hlSpanFromEvent`-jével.

**Támadási forgatókönyv (bemenet/állapot → hatás):**

*Állapot:* a felhasználó be van jelentkezve a topwords.eu-ra (session cookie él), YouTube nézőoldalon van, és bekapcsolta a TopWords felirat-sávot (a `#tw-yt-bar-host` létezik).

*Bemenet:* a YouTube oldalon futó tetszőleges nem megbízható JS — reálisan **egy másik, kevésbé bizalmas kiterjesztés content scriptje**, vagy YouTube-oldali XSS/injektált third-party script:

```js
const bar = document.getElementById('tw-yt-bar-host').shadowRoot; // mode:'open' → elérhető
bar.querySelectorAll('.tw-word').forEach(span =>
    span.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
);
```

*Hatás:* minden szintetikus `dblclick` átmegy a `:278` ágon (nincs guard) → `quickStatus(span, 'known')` → `onQuickStatus` = `quickStatusOnCaptionWord` (`youtube.js:330`) → `sendMsg({type:'QUICK_STATUS', ...})` → `background.js:241-279` **szerveroldali állapotírás** a `/words/{id}/status` végponton, a háttér által beszerzett érvényes CSRF-tokennel. Mivel a szerver **toggle-szemantikát** használ (`background.js:251-252`), ismételt küldéssel a státusz oda-vissza billeg. Így az oldal tömegesen és csendben átírhatja a felhasználó tanulási státuszait (pl. a teljes felirat „Tudom"-ra állítása), amit a felhasználó csak később, az SRS-ütemezés elromlásán vesz észre.

*A `mode:'open'` shadow root a kihasználhatóság feltétele:* `youtube.js:256` (felirat-sáv), `youtube.js:745` (átirat-panel), `netflix.js:97,266` — mind `open`, tehát a `shadowRoot` az oldalról bejárható. Ezzel szemben a valóban érzékeny felületek (`lookup-popup.js:155,214`, `search-modal.js:39`, `flashcard-modal.js:375`) `mode:'closed'`-ok. A `shared.js:293-295` kommentje maga is pontosan ezt az `open`-shadow-DOM kockázatot nevezi meg — a guardot viszont csak a `click`-ágra tette meg.

**Miért nem HIGH (a finder eredeti érvei — a verifikáció mind helybenhagyta):**
- Nincs adat-kiszivárgás és nincs jogosultság-emelés: a QUICK_STATUS ág kizárólag státuszt állít, a `background.js:246` `found`/`id` ellenőrzése miatt csak a felhasználó **saját, már meglévő** szavain. Új szót nem hoz létre, flashcardot nem készít, AI-kreditet nem éget (a `ADD_WORD`/`CREATE_FLASHCARD`/`GEMINI_*` ágakhoz kliens-oldali `csrf` kell, ami csak `closed` shadow DOM-os felületekről érhető el).
- Throttle korlátozza a tempót, így a „teljes szótár átírása" nem egy kérésben megy. *(Pontosítás a verifikációból: az érdemi fék az **írási** végponton ül — `routes/words.php:24` `throttle:60,1,word-writes`, közös vödör minden szó-írásra —, nem az `ext-read` vödrön; a finder ez utóbbit idézte.)*
- A támadónak már kódfuttatása kell a YouTube/Netflix oldalon — ami eleve emelt pozíció.

**Miért LOW és nem MEDIUM (a verifikációs kör 3/3 döntése — felülírja a finder alábbi érvelését):**

> *A finder eredeti indoklása így szólt:* „integritás-sértés a felhasználó tanulási adatain, csendben, felhasználói interakció nélkül, kihasználva a bővítmény hitelesített munkamenetét; és ez egy **korábban javított osztályú hiba részleges visszatérése** az új (1.22–1.24) kódúton."

Ebből az érvelésből a verifikáció **két tartóoszlopot kidöntött**:
1. **A „részleges visszatérés" (regresszió) tárgyilag téves** — a `fbf4405` tiszta +162 soros beszúrás 0 törléssel; guardot senki nem távolított el (git-bizonyíték fent).
2. **A „tanulási adatok sérülése" túlbecsült** — a `user_word` pivot nem hordoz SRS-ütemezést, és nincs cascade a `flashcards` felé; a tényleges kár a szó-státusz (kézzel javítható, a UI-ban látható) és a néma `importance`-vesztés.

Ami megmaradt: valós, de szűk integritás-zaj self-only hatókörrel, szigorúan nem-alap fenyegetésmodellben (előre telepített ellenséges user-script). **A fix ettől még indokolt** — költsége egyetlen sor, és a kódbázis saját konvencióját állítja helyre.

**Javaslat (nem alkalmazva):** a guardot a `page-highlight.js` mintájára a `shared.js:208` `attachCaptionWordGestures` közös belépési pontjára kell tenni — pl. a `wordSpanFromEvent` hívások előtt egy `if (!e.isTrusted) return;` mindhárom ágon, vagy a helper becsomagolása.

---

## 4. `window.postMessage` listener-ek

### EXT-I3 · INFO · nincs egyetlen `postMessage` sem

`grep -rn "postMessage" background.js popup.js src/` → **0 találat**. Sem küldő, sem fogadó oldal. Az `origin`/`event.source` ellenőrzés kérdése tehát tárgytalan: a content script és a background kizárólag a `chrome.runtime` csatornán beszél (`sendMsg`, `shared.js:109-123`), ami izolált és a `sender.id`-vel védett (2. pont).

---

## 5. Token-tárolás

### EXT-I4 · INFO · nincs perzisztens hitelesítő token — cookie-alapú a modell

**Auth-modell:** a `background.js:10-11` `fetch(..., { credentials: 'include' })`-et használ, azaz a topwords.eu **session cookie-jára** támaszkodik. Ebből következik:

- **Nincs bearer/API-token sehol.** `grep -rniE "api[_-]?key|secret|password"` → 0 érdemi találat.
- **`chrome.storage.sync`: nem használt** (0 találat) — nem szinkronizálódik Google-fiókon át.
- **`localStorage`: nem használt** (0 találat) — ami kritikus, mert a content script `localStorage`-a a **host oldal** tárolója lenne, tehát bármely oldal olvashatná.
- **`chrome.storage.local`** csak két dolgot tárol: a `tw_statusCache` szó→státusz térképet (`background.js:81`) és a `hlEnabled` kapcsolót (`page-highlight.js:380`). Ez izolált tároló, oldalról nem érhető el.

**CSRF-token életútja (a legérzékenyebb adat):** a szerver a JSON-válaszban adja vissza (`ExtensionController.php:40-43,90`), a content script változóban tartja (`search-modal.js:89,183` → `searchCsrf`; `lookup-popup.js:530,549,610` → `data.csrf`), és `sendMsg`-gel visszaküldi a háttérnek. **Sosem kerül DOM-ba, sem attribútumba, sem `dataset`-be** — ellenőrizve: a `csrf` egyetlen `innerHTML`-sablonban sem szerepel. Mivel a content script izolált világban fut, a token a page-world JS elől el van zárva.

**`world: "MAIN"`: sehol nincs deklarálva** (`manifest.json:27-50` egyik content script bejegyzésében sem, és `grep "world"` → 0 találat). Minden content script izolált világban fut → a page JS nem fér a `searchCsrf`/`data.csrf` változókhoz.

---

## 6. DOM-injekció külső adatból

### EXT-I5 · INFO · minden külső adat escape-elt vagy allowlist-sanitizált

Végigkövettem a 38 `innerHTML`-írást. Nincs escape-eletlen külső adat:

| Adatforrás | Sink | Védelem |
|---|---|---|
| Felirat-szöveg (YouTube/Netflix DOM) | `youtube.js:386`, `netflix.js:168`, `youtube.js:863` | `ytWordsToHtml` (`youtube.js:279-317`) — **szöveg- ÉS attribútum-kontextusban** is `esc()`: `:291` (sep), `:299` (`attr` a `data-yt-word`-höz), `:307,312` (szövegtörzs) |
| API keresési találat | `search-modal.js:265-282` | `esc(r.word)`, `esc(r.meaning_hu)` |
| API szó-részletek | `search-modal.js:758-772`, `lookup-popup.js:431,464,498` | `esc()` minden dinamikus mezőn |
| **AI-generált HTML** (Gemini) | `flashcard-modal.js` | `sanitizeAiHtml()` (`:69-118`) — allowlist tag-lista (`:27-46`), `DROP_TAGS` teljes részfa-törléssel (`:49-63`), **minden attribútum törlése** a szűrt `style` kivételével, `url(` tiltás a CSS-ben (`:100`), és `replaceChildren(fragment)` nyers `innerHTML` helyett |

Az `esc()` (`shared.js:38-45`) mind az 5 releváns karaktert kezeli (`& < > " '`), tehát idézett attribútumból sem lehet kitörni.

**A `data-t="${seg.t}"` (`youtube.js:861`) escape-eletlen** — de a `seg.t` a saját backendünk `youtubeTranscript` válaszából jön, és a fogyasztója `Number(row.dataset.t)` (`youtube.js:775`), ami nem-numerikus értékre `NaN`-t ad. A `data-idx="${i}"` egy ciklusváltozó. Nem lelet.

---

## 7. Backend-hívások, origin, CORS

### EXT-I6 · INFO · hardcode-olt HTTPS origin, nincs CORS-lazítás

- **Origin:** `background.js:1` és `shared.js:4` — `const APP_URL = 'https://topwords.eu';` **hardcode-olt, nem konfigurálható**, HTTPS-only. Egy kompromittált `chrome.storage` sem tudja átirányítani a hívásokat. `grep "http://"` → 0 találat, `grep "localhost|127.0.0.1"` → 0 találat.
- **`host_permissions` illeszkedik:** kizárólag `https://topwords.eu/*` — a bővítmény más originre nem is tudna hitelesített cross-origin kérést küldeni.
- **CORS: `config/cors.php` NEM LÉTEZIK**, és `bootstrap/app.php`-ban sincs `HandleCors` regisztrálva → a Laravel nem ad `Access-Control-Allow-Origin` fejlécet. Ez **helyes**: a bővítmény a deklarált `host_permissions` alapján kérhet, nem CORS-preflighten keresztül, tehát nem kell (és nem is szabad) origint engedélyezni. Nincs `*` wildcard, nincs `supports_credentials: true` kombináció.
- **Végpont-védelem** (`routes/extension.php`): az auth kézzel, a controllerben (`ExtensionController.php:47-49,520-522,546,564-566`), hogy JSON-hibát adjon redirect helyett. Az írás-végpontok `verified` middleware mögött (`:24-27`), külön throttle-vödrökkel (`ext-read` 120/perc, `ext-write` 20/perc, `ext-yt` 30/perc). A `youtube-transcript` route látszólag middleware nélküli, de a `:520` `if (! $request->user())` 401-et ad — nem anonim végpont.

---

## 8. Felirat-gyorsgesztus payload (1.22–1.24)

**Kifelé (DOM → backend):** a `quickStatus` (`shared.js:227-245`) a `span.dataset.ytWord`-ből veszi a szót, levágja a körülölelő aposztrófokat, és `QUICK_STATUS`-ként küldi. A `background.js:243` `encodeURIComponent`-tel teszi query-be, a szerver oldalon a `lookup` szigorú DB-egyezést csinál. Nem string-konkatenált SQL, nem template-injekció.

**Befelé (API-válasz → DOM):** a válasz `forms`/`status` mezői a cache-be mennek (`background.js:143-169`), majd a `STATUS_COLORS` **fix konstans map**-en (`shared.js:14-20`) keresztül lesz belőlük szín (`shared.js:234`, `youtube.js:300`) — a szerver által küldött státusz-string sosem kerül közvetlenül stílusba vagy HTML-be. Ha ismeretlen státusz jönne, `color` = `undefined` és a stílus kimarad. **Sanitizálás rendben.**

A gyorsgesztus *aktiválási* oldala viszont hiányos — lásd **EXT-M1**.

---

## 9-10. Dinamikus kódfuttatás

| Vizsgált | Eredmény |
|---|---|
| `chrome.scripting.executeScript` | **nincs** — a `scripting` permission sincs deklarálva |
| `chrome.tabs` használat | csak `chrome.tabs.create()` (`background.js:204,214`), statikus `APP_URL`-re, `encodeURIComponent`-tel paraméterezve — nem kódinjekció |
| `eval(` | 0 találat |
| `new Function` | 0 találat |
| `unsafe-eval` a CSP-ben | nincs CSP-felülírás, tehát az MV3 default tiltás él |
| Remote script (CDN) | 0 találat; `popup.html:55` egyetlen `<script src="popup.js">`-t tölt, lokálisan |

MV3-konform, nincs mit kifogásolni.

---

## 11. Verzió-drift és dev-maradvány

### Drift: NINCS

A `chrome-extension/` forrást kicsomagolt `topwords-extension-1.24.zip`-pel összevetve (`diff -r`, kizárva `*.zip`, `build-zip.sh`, `.DS_Store`):

```
NO DRIFT
```

**Bitre azonos.** A `manifest.json:4` `"version": "1.24"` egyezik a legfrissebb zip nevével. A `build-zip.sh:17-33` explicit fájllistával dolgozik, és `:36-41` hibára fut, ha bármelyik hiányzik — így a csomag nem tartalmazhat véletlen extra fájlt (pl. `.env`, backup).

### Dev-maradvány: NINCS

| Keresett | Találat |
|---|---|
| `console.log/debug/warn/error` | **0** a teljes bővítményben |
| `//# sourceMappingURL` | 0 |
| `.env`, kulcs, jelszó | 0 |
| teszt-/staging-endpoint | 0 (az egyetlen origin a hardcode-olt prod HTTPS URL) |
| `localhost` / `127.0.0.1` | 0 |

### EXT-L2 · LOW · a régi verziójú zipek a repóban maradtak

**Fájl:** `chrome-extension/topwords-extension-1.19.zip` … `-1.23.zip` (5 db)

**Forgatókönyv:** ezek **nincsenek publikusan szolgálva** (nem a `public/` alatt vannak, a `DownloadController` pedig csak a `storage/app/private/downloads/topwords-extension.zip` stabil nevű másolatot streameli) — így közvetlen webes hozzáférés nincs. A kockázat közvetett: ha a repó valaha publikussá válik vagy egy deploy a `chrome-extension/` könyvtárat is a webgyökér alá másolja, a régi verziók a **már javított sérülékenységek** (pl. az 1.18 előtti M2 `isTrusted`-hiány, a H1 `isTrusted`-guard) forráskódját szolgáltatnák a támadónak — nem exploit önmagában, hanem a régi hibák pontos térképe azoknak a felhasználóknak, akik nem frissítettek.

**Miért LOW:** nincs jelenlegi expozíciós út; tisztán higiéniai/defense-in-depth. Javaslat: a régi zipek törlése vagy `.gitignore`-olása, csak a legfrissebb tartása.

### EXT-L1 · LOW · `content_scripts.matches: ["<all_urls>"]`

**Fájl · sor:** `chrome-extension/manifest.json:29`

**Forgatókönyv:** a 7 alap content script (`shared`, `styles`, `tokenizer`, `lookup-popup`, `search-modal`, `flashcard-modal`, `page-highlight`) **minden** oldalon lefut — netbank, webmail, belső admin felületek is. Ott globális `mousedown`/`keydown`/`click` listenereket regisztrál (`lookup-popup.js:11,51,68`, `page-highlight.js:125-128`), és bekapcsolt kiemelésnél `TreeWalker`-rel bejárja a teljes DOM-ot (`page-highlight.js:~90-122`), a szöveges csomópontokat span-ekre bontva. Egy bővítmény-oldali hiba így a legérzékenyebb oldalakon is felszínre kerül, és a szó-lekérdezések implicit módon jelzik a backend felé, milyen szavakat olvas a felhasználó (bár csak explicit gesztusra).

**Enyhítő tényezők (ezért LOW, nem MEDIUM):**
- A `host_permissions` **nem** `<all_urls>`, ezért a content script **nem** tud tetszőleges originre hitelesített kérést küldeni — minden hálózati hívás a háttéren, a topwords.eu felé megy.
- A kiemelés alapból kikapcsolt (`hlEnabled` opt-in, `page-highlight.js:380`), a popup csak explicit dupla-klikk+tartásra nyílik (`lookup-popup.js:24-26`), és a `SKIP_TAGS` + `closest('a, button, [role=...]')` szűrő (`page-highlight.js:100-110`) kihagyja az interaktív elemeket.
- Az `esc()` és a `closed` shadow DOM miatt a beszúrt UI nem szennyezi a host oldalt.

Funkcionálisan indokolt (a „bármely oldalon szókeresés" a termék lényege), de érdemes dokumentálni tudatos kockázatvállalásként; a CWS-review is jellemzően rákérdez.

---

## PLAN-feltevés MEGDŐLT

### ❌ „`public/downloads/topwords-extension/` publikusan szolgált kicsomagolt könyvtár" (Fázis 4b, 6. pont)

**A feltevés NEM ÁLL FENN — a könyvtár nem létezik.**

Bizonyítékok:
1. `ls public/downloads` → `No such file or directory`. A `public/` teljes listája (18 bejegyzés) nem tartalmaz `downloads`-ot.
2. `git ls-files public/downloads` → **üres**; verziókövetve sincs semmi.
3. A git-történet igazolja a kivezetést: a `public/downloads*` útvonalon törlő commitok között szerepel az `1e81725 "Fázis 3-4 LOW-kör: SSRF port-allowlist, AI-L1, YouTube méret-sapkák, extension-guardok"`.
4. A jelenlegi terjesztési út **auth mögötti stream**: `build-zip.sh:50-54` a `storage/app/private/downloads/`-ba másol (a szkript kommentje explicit: *„A fájl a PRIVÁT diskre megy: a DownloadController streameli hitelesítés után, a public/ alól nem elérhető"*), a `routes/web.php:68-71` pedig `Route::middleware(['auth','verified'])` csoportban, `throttle:20,1,downloads` limittel adja ki.
5. A `DownloadController.php:16-30` **slug→fájlnév allowlisttel** (`'extension' => 'topwords-extension.zip'`) dolgozik, nem a user-inputot fűzi útvonalba — path traversal sem lehetséges. A `abort_unless(array_key_exists(...))` ismeretlen slugra 404-et ad.

**Nincs más publikusan szolgált extension-forrás sem:**
- `public/.htaccess:3` → `Options -MultiViews -Indexes` (nincs könyvtárlistázás), és minden nem létező fájl az `index.php` front controllerre megy.
- `public/storage` symlink **nem létezik** (`ls: No such file or directory`) → a `storage/app/public` sem érhető el webről.
- A `routes/`-ban egyetlen route sem szolgál ki extension-fájlt a `downloads.show`-on kívül.

### ⚠️ Részben megdőlt: „`isTrusted`-guard (M2 regresszió)"

A PLAN egyszerű regresszió-ellenőrzést feltételezett („még megvan-e"). A valóság árnyaltabb: **az eredeti M2-fix helyén van** és a `page-highlight.js`-ben centralizáltan, mintaszerűen megoldott — de az **1.24-ben bevezetett új felirat-gesztus kódút** (`shared.js:208-333`) csak részben örökölte a mintát: a `click` védett, a `mousedown` és `dblclick` nem. Tehát nem a régi fix veszett el, hanem az új kód nem vette át teljesen. Lásd **EXT-M1**.

> **A verifikációs kör megerősítette és élesítette ezt a megfogalmazást:** a `git log -S` szerint az `attachCaptionWordGestures` és a benne lévő egyetlen `isTrusted`-sor **ugyanabban a commitban** (`fbf4405`) született, tiszta beszúrásként. Ezért a helyes minősítés **„új felület hiányzó guarddal"**, és a riport korábbi „részleges regresszió" szóhasználata elhagyandó. **A PLAN M2-regresszió-feltevése tehát MEGDŐLT: regresszió nincs.**

---

## Leletek összefoglalása

| ID | Súly | Fájl · sor | Egy mondatban |
|---|---|---|---|
| **EXT-M1** | **LOW** *(finder: MEDIUM → 3/3 verifikátor LOW)* | `src/shared.js:247,278` | A felirat-gyorsgesztus `mousedown`/`dblclick` ága nem ellenőrzi az `event.isTrusted`-et (a `click` ága igen), így a `mode:'open'` shadow rooton át szintetikus eseményekkel átírhatók a felhasználó **saját, már meglévő** szavainak státuszai. Reális vektor csak előre telepített ellenséges user-script; self-only, adatszivárgás nélkül, throttle alatt, kézzel visszaállítható. **Nem regresszió** — `fbf4405` tiszta beszúrás. |
| EXT-L1 | LOW | `manifest.json:29` | A content scriptek `<all_urls>`-en futnak (globális listenerek + DOM-bejárás minden oldalon), bár a `host_permissions` szűk marad. |
| EXT-L2 | LOW | `chrome-extension/*.zip` | 5 régi verziójú zip (1.19–1.23) a repóban — jelenleg nem szolgált, de a már javított hibák forráskódját őrzi. |
| EXT-I1 | INFO | `manifest.json` | MV3, szűk `host_permissions`, nincs WAR / `externally_connectable` / CSP-lazítás; mindhárom permission indokolt. |
| EXT-I2 | INFO | `background.js:225`, `page-highlight.js:397` | Mindkét `onMessage` listener `sender.id`-t ellenőriz; `onMessageExternal` nincs → confused deputy nem áll fenn. |
| EXT-I3 | INFO | — | Egyetlen `postMessage` sincs a kódbázisban; a 4. pont tárgytalan. |
| EXT-I4 | INFO | `background.js:10`, `shared.js:4` | Cookie-alapú auth, nincs perzisztens token; `sync`/`localStorage`/`world:MAIN` sehol; a CSRF-token sosem kerül DOM-ba. |
| EXT-I5 | INFO | `youtube.js:279-317`, `flashcard-modal.js:69-118` | Minden külső adat `esc()`-elt (szöveg + attribútum), az AI-HTML allowlist-sanitizált `replaceChildren`-nel. |
| EXT-I6 | INFO | `background.js:1`, `routes/extension.php` | Hardcode-olt HTTPS origin, nincs `config/cors.php` (helyesen), throttle-vödrök végpont-osztályonként. |
