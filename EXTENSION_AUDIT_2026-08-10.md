# Bővítmény-audit — 2026-08-10 (RÉSZLEGES)

Vizsgált artefaktum: **Chrome extension 1.31** (`chrome-extension/`, `topwords-extension-1.31.zip`) és a backend-végpontjai.
Kérdés: bug, biztonsági rés, backend, és **van-e bármi, ami miatt nem kerülhetne fel a Chrome Web Store-ba**.

> ⚠️ **Ez a kör nem futott végig.** 6 finder indult, **3 fejezte be** (CWS-policy, kliens-biztonság, csomag-integritás); a workflow a verify fázisban beállt. Ezért:
> - **3 terület auditálatlan**: backend-jogosultság, SSRF/transcript-lánc, kliens-működési bugok. → [Mi van hátra](#mi-van-hátra)
> - **Az alábbi leletek ELLENŐRIZETLENEK** (a 2-szavazatos adverzariális szűrés egyetlen verdiktet adott vissza). Az eddigi audit-körökben pont az ilyen finder-premisszák dőltek meg rendre — a súlyokat ennek fényében kezeld.
>
> Ami viszont **mérés, nem állítás**: a „tisztának talált" szakasz nagy része parancs-kimenetre épül (`unzip -l`, `diff -r`, md5, grep-darabszámok), azt a beállás nem érinti.

---

## 1. Verdikt

**Egyetlen store-blokkoló van, és az nem kód: a review-nak nincs teszt-fiókja.** Kód-oldalon és csomag-oldalon nem találtunk elutasítási okot a lefutott 3 területen — se távoli kódot, se felesleges engedélyt, se szemetet vagy titkot a csomagban, se élő XSS-t. A csomag-integritás kérdésére a válasz **igen**: amit feltöltenél, az bájtazonos az auditált forrással.

A kockázat súlypontja nem a kódban van, hanem a **nyilatkozat és a valóság eltérésében**: az Adatkezelési tájékoztató és a publikus kézikönyv még az 1.28-as, `<all_urls>`-korszakbeli működést írja le. Ez nem blokkolja a feltöltést, de utólagos eltávolítás alapja lehet.

---

## 2. STORE-BLOKKOLÓ

### 🚫 POL-1 — Teszt-fiók nélkül a review nem tudja értékelni a bővítményt (HIGH)

A reviewer telepíti az 1.31-et, megnyitja a popupot, és a „Nem vagy bejelentkezve" sávot látja ([popup.html:19-21](chrome-extension/popup.html#L19-L21)). Minden érdemi végpont 401-et ad — `lookup`, `search`, `statuses`, `decks` mind ugyanezzel a guarddal indul ([ExtensionController.php:88](app/Http/Controllers/ExtensionController.php#L88), 179, 261, 284. sor). Fiókot **önerőből nem tud csinálni**: `REGISTRATION_INVITE_ONLY=true` mellett a [CreateNewUser.php:41](app/Actions/Fortify/CreateNewUser.php#L41) érvényes meghívókódot követel.

Ez a leggyakoribb elutasítási ok bejelentkezést igénylő bővítményeknél. Az [EXTENSION_GO_LIVE_TEENDOK.md:39-52](EXTENSION_GO_LIVE_TEENDOK.md#L39-L52) maga is kipipálatlan blokkolóként tartja.

**Minimális javítás:** dedikált teszt-fiók + a hitelesítő adatok beírása a CWS Dashboard „Test credentials" mezőjébe. Kód-módosítás nem kell.

*(Megjegyzés: a `REGISTRATION_INVITE_ONLY` értékét a **lokális** `.env`-ből olvastuk; a prod-értéket a repóból nem látjuk.)*

---

## 3. Nyilatkozat-drift — nem blokkoló, de eltávolítási kockázat

### ⚠️ POL-2 — Az Adatkezelési tájékoztató 7. pontja az 1.28-as működést vallja be (MEDIUM)

A kötelező Privacy policy URL-en ([privacy.tsx:487-502](resources/js/pages/legal/privacy.tsx#L487-L502)) az áll, hogy a bővítmény „a haladás követését **bármely weboldalon**" biztosítja, és a meglátogatott oldalak szövegét helyben feldolgozza kiemeléshez meg oldal-statisztikához. Az 1.31 ezek **egyikét sem tudja**: a content script két hosztra szűkült ([manifest.json:27-55](chrome-extension/manifest.json#L27-L55)).

Vagyis a jogi oldal olyan adatkezelést vall be, amit a manifest engedélyei nem is tesznek lehetővé — a CWS pedig a bejelentett adatkezelést a csomaggal veti össze.

### ⚠️ POL-3 — A tájékoztató letagadja a `tw_statusCache`-t (MEDIUM)

[privacy.tsx:533-535](resources/js/pages/legal/privacy.tsx#L533-L535): a `chrome.storage.local` „**kizárólag** a saját beállításaidat őrzi (pl. kiemelés be/ki, YouTube-felirat be/ki)". Valójában a `writeStatusCache()` a teljes szó→státusz térképet is odamenti `tw_statusCache` kulcs alatt ([background.js:100-103](chrome-extension/background.js#L100-L103)) — ez nem beállítás, hanem a fiók személyes tanulási adata, akár több ezer szó. Ráadásul a példaként hozott „kiemelés be/ki" beállítás már nem is létezik.

Ez **alul**-nyilatkozás, ami gyakrabban vezet „privacy policy incomplete" visszajelzéshez, mint a túl-nyilatkozás.

### POL-4 — A publikus kézikönyv nem létező funkciót dokumentál (LOW)

A `homepage_url`-ről elérhető `/handbook` még leírja az oldalankénti szókiemelést, status-szín-táblázattal ([handbook.tsx:1998-2030](resources/js/pages/handbook.tsx#L1998-L2030)). Reális út, hogy a listing-szöveg innen kerül átvételre.

---

## 4. Kliens-biztonság

Egyik sem store-blokkoló, és **élő, kihasználható sebezhetőséget nem találtunk**. Mind a négy LOW előfeltétele script-futtatás a `www.youtube.com` / `www.netflix.com` fő világában (pl. XSS ott) — ezért nem magasabb a súlyuk.

| ID | Súly | Lelet | Hely |
|---|---|---|---|
SEC-1 | LOW | A felirat-sáv be-kikapcsoló gombja a **lap DOM-jában** van (`.ytp-right-controls`), és a click-listenerből kimaradt az `isTrusted`-guard. A lap `document.querySelector('.tw-yt-toggle').click()`-kel perzisztens bővítmény-beállítást írhat. | [youtube.js:175](chrome-extension/src/youtube.js#L175)
SEC-2 | LOW | A felirat-sáv `mode:'open'` shadow DOM-ban rajzol, és a `.tw-word` spanekre ráírja a státusz-színt — a user **teljes megjelölt szólistája** kiolvasható oracle-ként, interakció nélkül (SEC-1-gyel indítva). | [youtube.js:256](chrome-extension/src/youtube.js#L256)
SEC-3 | LOW | A `visibilitychange` listenerből is kimaradt az `isTrusted`-guard, és `forceFresh=true`-val **szándékosan megkerüli** az 5 perces cache-t, fék nélkül → throttle-kimerítés (a user kizárása a saját bővítményéből) + szerver-terhelés. | [lookup-popup.js:128](chrome-extension/src/lookup-popup.js#L128)
SEC-4 | LOW | A `seg.t` **nyersen** megy dupla idézőjeles attribútumba (`data-t="${seg.t}"`), miközben a `seg.x` helyesen `esc()`-elt. **Ma nem kihasználható** — a szerver mindhárom parser-ágon int-re kényszerít —, de egy backend-oldali típus-változás néma XSS-regresszióvá tenné. | [youtube.js:861](chrome-extension/src/youtube.js#L861)

A guard-minta tehát **hiányos, nem hiányzó**: a szó-gesztusok védettek ([shared.js:261, 297, 318](chrome-extension/src/shared.js#L261)), a be-kikapcsolók nem.

**INFO-k:** a context-menü `analyze-page` ága nem szűri a fül URL-jét séma szerint, szemben a popup ugyanazon funkciójával ([background.js:196](chrome-extension/background.js#L196) vs. [popup.js:160](chrome-extension/popup.js#L160)) — `file://` vagy tokenes intranet-URL a szerverre kerülhet, de csak kifejezett user-kattintásra. A session-CSRF-token átjut a content scriptbe ([lookup-popup.js:530](chrome-extension/src/lookup-popup.js#L530)); a DOM-ba nem kerül, tehát a védelem az izolált világ + `SameSite=lax` páron nyugszik — egy `SESSION_SAME_SITE=none` váltás azonnal érdemi kockázattá emelné. A felirat-szó → backend írás útján a lap választja meg, **melyik** szó kerül a szótárba, de valódi gesztus mögé zárva, és a hatás egy hamis szókincs-bejegyzés. Nincs őrszem-teszt az `isTrusted`/`esc()` invariánsokra — jelenleg csak kommentek jelölik őket.

---

## 5. Csomag- és build-lánc

A **mai csomag rendben van**; a leletek arról szólnak, hogy ezt semmi nem kényszeríti ki a következő kiadásnál.

| ID | Súly | Lelet | Hely |
|---|---|---|---|
PKG-1 | LOW | A zip és a snapshot-könyvtárak git-ignoráltak → a feltöltött artefaktumnak **nincs verziókövetett provenienciája**. Enyhítés: egy bájtazonos másolat mégis trackelt. | [.gitignore:35](.gitignore#L35)
PKG-2 | LOW | `build-zip.sh` némán `rm -f`-fel felülírja az azonos verziójú zipet, és nem ellenőrzi a verzió-bumpot → elfelejtett manifest-bump után ugyanazon a néven **más bájtok**. | [build-zip.sh:47](chrome-extension/build-zip.sh#L47)
PKG-3 | LOW | A hiányzó-fájl ellenőrzés **egyirányú**: manifest→FILES drift nem derül ki. Egy új `src/foo.js` a content_scriptsben, de a FILES-ből kihagyva → exit 0, majd a Chrome elutasítja a csomagot. | [build-zip.sh:40](chrome-extension/build-zip.sh#L40)
PKG-4 | LOW | A snapshot-könyvtárat **nem a build script** állítja elő, noha a .gitignore komment annak nevezi — kézi `unzip -d` (mtime: a zip Aug 8 12:28, a könyvtár Aug 9 11:06). | [.gitignore:36](.gitignore#L36)
PKG-5 | LOW | Egyetlen teszt sem hasonlítja a **zipet** a forráshoz: az őrszemek az ÉLŐ forrást olvassák, tehát elavult csomag mellett is zöldek. | [LegalAndExtensionDisclosureTest.php:25](tests/Feature/LegalAndExtensionDisclosureTest.php#L25)

**INFO-k:** a doksi §6 zip-diffje a **3 PNG-t nem hash-eli** és extra fájlt nem detektál (két vak hibaosztály: bináris csere, beszemetelt csomag). A `chrome-extension/` gyökerében ott ül egy `.DS_Store` + 13 régi zip + 3 snapshot — a whitelistes build kizárja őket, de egy Finder „Compress" elutasítható zipet gyártana. A build nem követeli meg a tiszta git-fát.

---

## 6. Ami mérten TISZTA

- **Engedély-minimalizálás.** Mindhárom deklarált engedélyre van tényleges kódhívás (`activeTab` → popup.js:158 + background.js:199; `contextMenus` → background.js:162-183; `storage` → background.js:90-120, shared.js:76-96). Felesleges deklarált engedély **nincs**. Nincs `tabs`, `scripting`, `webRequest`, `cookies`, `history`.
- **Távoli kód (MV3 kemény szabály).** `eval`, `new Function`, string-`setTimeout`/`setInterval`, `importScripts`, `createElement('script')`, `.src=`, `document.write`, dinamikus `import()`: **0 találat** a 13 szöveges csomag-fájlon. `popup.html` egyetlen script-hivatkozása lokális, nincs inline `<script>` és nincs `on*=` attribútum. Nincs CSP-felülírás. Külső hoszt összesen kettő, mindkettő sima `<a href>` Google-kereső-link.
- **A csomag = az auditált forrás.** Élő forrás / `topwords-extension-1.31/` snapshot / zip: **mind a 16 fájlon md5-azonos**, az ikonokat is beleértve. `diff -r` nulla eltérés, `unzip -t` „No errors detected". A legutolsó bővítmény-commit (`b7ac205`, Aug 8 12:26) 2 perccel a build előtt — `find -newer` egy újabb forrásfájlt sem talál. A Letöltések oldal példánya is azonos md5.
- **Csomag-higiénia.** Nincs `.DS_Store`, `__MACOSX`, `.map`, `.git*`, README, régi zip, snapshot, teszt-fájl. Nincs minifikálás/obfuszkáció. `console.*`: 0. `debugger|TODO|FIXME|HACK`: 0.
- **Titkok / dev-környezet: nulla.** A 13 szöveges fájl összes URL-je: `topwords.eu` + `google.com/search` + `youtube.com` + `netflix.com`. A `localhost|127.0.0.1|ngrok|api_key|secret|bearer|sk_live|sk_test|xampp|http://` grep 4 találata mind a JS `RegExp.test` metódus.
- **XSS.** `insertAdjacentHTML`, `outerHTML`, `createContextualFragment`, `.srcdoc`: 0. A `popup.js` 1300 sorában **egyetlen `innerHTML` sincs**. A felirat-út — a legfontosabb ellenséges bemenet — `esc()`-elt attribútum- és szöveg-kontextusban is, dupla idézőjeles attribútumokkal. Az AI-HTML **allowlist-alapon**, inert `<template>`-ben sanitizálódik ([flashcard-modal.js:76-125](chrome-extension/src/flashcard-modal.js#L76-L125)): drop-lista a script/style/iframe/svg-re, minden attribútum törlődik a szűrt `style` kivételével.
- **Message passing.** `onMessageExternal`: 0. `externally_connectable`: nincs a manifestben. `window.addEventListener('message')` / `postMessage`: 0. Mind a 11 üzenettípus a `sender.id !== chrome.runtime.id` guard mögött ([background.js:212](chrome-extension/background.js#L212)).
- **Írás-képes listenerek.** Mindegyik vagy `isTrusted`-guardolt, vagy **`mode:'closed'`** shadow DOM-ban (a status-gombok, csillagok, „Hozzáadás", „Mentés"). A closed shadow itt valódi határ: a content script izolált világban fut, a lap `attachShadow`-hookolása nem éri el.
- **Tárolás.** A teljes `storage.local` kulcskészlet: `ytLyricsEnabled`, `ytTranscriptEnabled`, `nfxLyricsEnabled`, `hlEnabled` (halott), `tw_statusCache`. Se cookie, se player-token, se API-kulcs. `storage.sync`: 0. `localStorage`/`sessionStorage`: 0 — a bővítmény nem ír a lap tárolójába. 401-re a `tw_statusCache` tényleg **törlődik** a gépről.
- **Kimenő hálózat.** Minden `fetch` célja `https://topwords.eu`. Minden query-paraméter `encodeURIComponent`-en megy át, a bázis-URL mindenhol konstans — nyílt átirányítást nem találtunk.
- **`page-highlight.js`: szándékos és teljes kizárás.** Nincs a manifestben, nincs a zipben (1.29/1.30/1.31-en 0, az 1.28-on 1 — pont az `<all_urls>`-korszak), nincs `executeScript`, nincs `scripting` engedély, és egyetlen csomagolt fájl sem hivatkozik az üzenet-típusaira. Halott kód, de **nem szállított** halott kód. Visszaút: `ext-1.28-all-urls` tag.
- **Manifest / branding.** `name` 8 karakter, `description` 117 (limit 132), nincs idegen védjegy az ikonban, a védjegy-használat leíró jellegű, és az ÁSZF explicit disclaimert tartalmaz ([terms.tsx:454-461](resources/js/pages/legal/terms.tsx#L454-L461)). `minimum_chrome_version: 110` konzisztens a használt API-kkal. Nincs `chrome_settings_overrides`, `web_accessible_resources`, `all_urls`, `update_url`.
- **Single purpose: elfogadható.** Az oldalt módosító funkciók alapból **ki** vannak kapcsolva, a Netflix natív felirat elrejtése visszafordítható CSS-opacity.
- **Verzió-konzisztencia.** Mind a 13 release-zipben (1.19–1.31) a beágyazott manifest-verzió egyezik a fájlnévvel. A backend nem kapuz verzió szerint.
- `LegalAndExtensionDisclosureTest`: **12 passed (56 assertions)**.

---

## Mi van hátra

### A) Auditálatlan területek (a 6-ból 3) — ez a legnagyobb hézag

1. **Backend-jogosultság** — `routes/extension.php` 7 végpontja + `PlayerPairingController`: kézi auth igazolása minden metóduson, IDOR (tulajdonos-szűrés nélküli `find()`), **Free/Pro entitlement-kerülőút** (megkerülhető-e a bővítményen a webes limit), throttle-vödrök kulcsa guest esetén, adat-túlküldés a JSON-válaszokban. Ez külön is szerepelt a kérésben.
2. **SSRF / transcript-lánc** — `youtubeTranscript` + `YouTubeCaptionService`: bypass-vektorok, redirect-követés, XXE a parser-ágakon, cache-poisoning (user-független kulcs?), timeout/DoS, AI-kvóta ellenőrzés sorrendje.
3. **Kliens-működési bugok** — MV3 service-worker suspend és az elvesző globális állapot, SPA-navigáció, observer-szivárgás (a `85c3e67 lag problem test` commit: mit próbált javítani, sikerült-e), dupla-POST race, 429/401/403 UX.

Részleges támpont: a kliens-biztonsági finder a `seg.t` miatt már belenézett a backendbe, és igazolta, hogy a `videoId` szerveroldalon `/^[a-zA-Z0-9_-]{11}$/`-re szűrt ([ExtensionController.php:566](app/Http/Controllers/ExtensionController.php#L566)), a `status` enum-validált, a `seg.t` mindhárom parser-ágon int. Ez **nem** helyettesíti a 3 területet.

### B) A leletek ellenőrzése

A verify fázis egyetlen verdiktet adott vissza a beállás előtt, tehát a fenti 23 lelet finder-állítás. A korábbi körök tanulsága, hogy ezek harmada-fele megdől. Érdemes legalább a POL-1-et, POL-2-t és POL-3-at ellenőrizni, mert azokon áll a verdikt.

### C) Repóból nem eldönthető, emberi lépést igényel

- **Prod `.env`**: `REGISTRATION_INVITE_ONLY` valós értéke (a POL-1 erre épül), `LOG_STACK` / `LOG_DAILY_DAYS`.
- **CWS Developer Dashboard**: test credentials, permission justifications, privacy practices certification, single purpose, screenshotok, publisher-e-mail, 5 USD díj. A repóban csak a bemásolható szövegek vannak.
- **Élő elérhetőség**: `https://topwords.eu/privacy` és `/terms` a review pillanatában. A route-ok kód-szinten publikusak, de ha a Privacy policy URL 404, az **önmagában elutasítási ok**.
- **`CHROME_WEB_STORE_URL`**: valóban nyitott, és kód-módosítás nélkül megoldható (`config/extension.php` → env, default nélkül).
- **Ploi deploy** állapota.
- **Runtime**: a bővítményt egyik finder sem töltötte be böngészőbe. Konzol-exception a review alatt nincs kizárva. A SEC-1..SEC-3 forgatókönyvek kód-olvasásból vezetettek, nem PoC-cal igazoltak.

### D) Nem vizsgált részletek

`popup.css` CSS-alapú exfil (attribútum-szelektor) szempontjából; a `fetchViaInnertube` / `fetchViaTimedtextApi` / `fetchViaPageScraping` teljes lánca arra, hogy a cache-be kerülő szerkezet **minden** ágon `{t:int,x:string}`; a régi 1.19–1.30 snapshotok. A teljes teszt-szvit nem futott, csak a `LegalAndExtensionDisclosureTest`.

---

## Kizárva a vizsgálatból

A kivezetett feature-ök (kvíz, cloze, rendhagyó igék, szabad írás) és a `backup/` könyvtár.

## Nyers adat

A 3 lefutott finder teljes JSON-kimenete (leletek + „mit találtam tisztának" jegyzetek):
`…/scratchpad/ext_audit_partial.json`
Workflow-script az újraindításhoz: `…/workflows/scripts/extension-store-readiness-audit-wf_5b99917b-f3d.js`
