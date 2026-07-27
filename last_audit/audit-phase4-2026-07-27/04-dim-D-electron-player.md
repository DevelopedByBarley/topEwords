# Dimenzió D — Electron player

**Audit dátuma:** 2026-07-27
**Hatókör:** `topwords-player/src/{main.js, preload.js, auth-store.js, renderer.js, topwords-api.js, mpv-bridge.js, mpv-render-bridge.js, index.html}`, `topwords-player/package.json`, `topwords-player/scripts/adhoc-sign.js`
**Módszer:** kizárólag dokumentálás, kód nem módosult.
**Súlyozási alap (a megbízás szerint):** desktop app, a támadó NEM a szerver-oldalról jön. MEDIUM+ csak reális távoli/külső triggerrel (rosszindulatú feliratfájl, kompromittált/MITM API-válasz, deep-link egy weboldalról). „A user megnyitja a devtoolst” nem támadás.

---

## Összesítő

| Súlyosság | Darab | Azonosítók |
|---|---|---|
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 4 | EL-L1, EL-L2, EL-L3, EL-L4 |
| INFO | 9 | EL-I1 … EL-I9 |

**Összesen: 13 lelet (0 HIGH, 0 MEDIUM, 4 LOW, 9 INFO).**

Rövid ítélet: a kliens az Electron biztonsági alapmintáit **következetesen** alkalmazza (`contextIsolation:true` + `nodeIntegration:false` + **`sandbox:true`**, szűk contextBridge-felület, sender-ellenőrzés MINDEN IPC-handleren, CSP meta-tag, navigáció- és ablaknyitás-tiltás, `safeStorage`-ban tárolt token, hardcode-olt + allowlistelt API-origin, natív-dialógus-kötött médiaútvonal). A PLAN Fázis 4b/3. pont négy feltételezett résterületéből **kettő tárgya nem is létezik** (deep-link/protocol-handler, auto-update). Nincs olyan lelet, amelyhez távoli triggerrel exploitálható út vezetne.

---

## Hardening-mátrix (a 12 vizsgálati pont)

| # | Pont | Fájl : sor | Állapot | Verdikt |
|---|---|---|---|---|
| 1 | BrowserWindow `webPreferences` | `src/main.js:46-51` | `preload` abszolút (`path.join(__dirname,'preload.js')`), `contextIsolation:true`, `nodeIntegration:false`, **`sandbox:true`**. `webSecurity`, `allowRunningInsecureContent`, `nodeIntegrationInSubFrames`, `experimentalFeatures`, `webviewTag`, `enableRemoteModule` **sehol nincs beállítva** → mind a biztonságos Electron-alapértelmezésen | ✅ TISZTA |
| 2 | preload `contextBridge` felület | `src/preload.js:13-165` | 3 névtér (`player`, `account`, `words`), **26 fix, nevesített metódus**; NINCS generikus `invoke(channel,…)`, NINCS `fs`/`exec`/`eval`/`require`/`process` kiszivárogtatás. A csatornanevek a preloadban **literálok** — a renderer nem tud tetszőleges csatornát címezni | ✅ TISZTA (a channel-szűrés strukturálisan megoldott) |
| 3 | `ipcMain` handlerek bemenet-validációja | `src/main.js:183-806` | 22 `ipcMain.handle`, **mind** `isTrustedSender(event)`-tel kezd (`main.js:75-80`: sender + `senderFrame === mainFrame`). Erős validáció: `word-lookup:296`, `word-update-status:360-366`, `word-update-importance:386-392`, `word-add:462-468` + `sanitizeAiWordFields:431-450` (mező-allowlist + hossz), `flashcard-create:514-534`, `ai-lookup:563`, `ai-flashcard:580`. Fájlrendszer: csak `dialog.showOpenDialog` (`603`, `784`) — nincs renderer-vezérelt olvasás/írás. Processz-indítás: **nincs** (a `spawn`-os `mpv-bridge.js` halott kód, lásd EL-I5). URL-nyitás: `shell.openExternal` egyetlen helyen, origin-ellenőrzéssel (`235`) | ⚠️ 4 handler validálatlan → EL-L1 |
| 4 | `mpv-bridge.js` / `mpv-render-bridge.js` — command injection | `mpv-render-bridge.js:152, 319-321`; `mpv-bridge.js:51-58` | Az **élő** híd (`mpv-render-bridge.js`) FFI-t használ: `mpv_command(ctx, char**)` — **nincs shell, nincs `exec`, nincs `shell:true`**, az argumentumok külön argv-elemek. A halott `mpv-bridge.js` `spawn()`-t használ, tömb-argumentumokkal (nem shell) és `os.tmpdir()`-beli sockettel (`:31`) — de sehonnan nincs behívva | ✅ Command injection kizárva; socket-jog → EL-I5 |
| 5 | `shell.openExternal` séma-/origin-validáció | `src/main.js:231-235` + `topwords-api.js:90-96` | Egyetlen hívás. Előtte `api.isOwnUrl(pair.verification_url)`: `new URL(url).origin === BASE_URL` — **teljes origin-egyezés** (séma+host+port). `file://`, `javascript:`, `smb://` mind eltérő originnel bukik. A `BASE_URL` maga is allowlistelt (`topwords-api.js:41-67`) | ✅ TISZTA (fail-closed) |
| 6 | Navigációs guard | `src/main.js:59-62` | `setWindowOpenHandler(() => ({action:'deny'}))` + `will-navigate` → `preventDefault()`. Az oldal `loadFile`-lal töltődik (`54`), nem remote URL-ről | ✅ TISZTA; `webContents.on('will-attach-webview')` hiányzik, de `webviewTag` default false → nem releváns |
| 7 | Deep-link / protocol handler | — | `setAsDefaultProtocolClient`, `open-url`, `second-instance`, `requestSingleInstanceLock`, `process.argv`-parsing: **egyik sem szerepel a kódbázisban**; a `package.json` `build` blokkjában nincs `protocols` bejegyzés | 🚫 **PLAN-feltevés MEGDŐLT** (nincs támadási felület) |
| 8 | Token-tárolás (`auth-store.js`) | `src/auth-store.js:32-73` | `safeStorage.encryptString` (macOS Keychain / Windows DPAPI), `fs.writeFileSync(..., {mode: 0o600})` az `app.getPath('userData')`-ba. Ha nincs OS-titkosítás → **nem ír lemezre**, csak memóriában él (`33-35`). Sérült fájl → törlés + `null` (`57-62`). Logout: szerver-oldali revoke + `clearToken()` (`main.js:251-268`). Plaintext fájl / localStorage: **nincs** | ✅ TISZTA; lejárat → EL-I7 |
| 9 | `topwords-api.js` — szerver-URL, TLS, token-átadás | `src/topwords-api.js:17-146` | `DEFAULT_BASE_URL='https://topwords.eu'` hardcode; env-override CSAK allowlistre (`28-64`: HTTPS→topwords.eu, HTTP→localhost/127.0.0.1/::1), különben **dob**. TLS: sehol nincs `rejectUnauthorized:false` / `NODE_TLS_REJECT_UNAUTHORIZED` / `app.commandLine.appendSwitch('ignore-certificate-errors')`. Token **Authorization: Bearer** fejlécben (`116`), soha nem query-ben. `redirect:'error'` (`128`) → nincs redirect-alapú token-szivárgás. `AbortSignal.timeout` minden kérésen | ✅ TISZTA (kiemelten jó) |
| 10 | `index.html` / `renderer.js` — CSP, DOM-írás | `index.html:5`; `renderer.js:1087-1195, 612-682` | CSP meta: `default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none';`. Nincs inline `<script>`, nincs inline event handler. A felirat-szavak `document.createTextNode`/`textContent`-tel épülnek (`630, 644`) — **soha nem `innerHTML`-lel**. Az `innerHTML` 6 helyen fordul elő, mind **kiürítésre** (`= ''`) — kivéve a sanitizer inert `<template>`-jét (`1189`). Az AI-HTML allowlist-sanitizeren megy át, majd `replaceChildren` (`1346-1347`) | ✅ TISZTA; CSP-rések → EL-L2 |
| 11 | Auto-update | — | `electron-updater`, `autoUpdater`, `publish`/feed-konfiguráció: **egyik sem szerepel** a kódban vagy a `package.json`-ban | 🚫 **PLAN-feltevés MEGDŐLT** (nincs updater); ellenben aláírás-hézag → EL-L3 |
| 12 | Electron-verzió | `package.json:61`, `node_modules/electron/package.json` | Deklarált `^33.0.0`, **telepített `33.4.11`**. Az Electron 33 az Electron támogatási politikája (legutóbbi 3 stabil ág) szerint **kifutott ág** — nem kap további biztonsági/Chromium-patcheket. Konkrét CVE-számot bizonyíték nélkül nem állítok | ⚠️ Verzió-tény → EL-L4 |

---

## Leletek

### EL-L1 · LOW — Négy lejátszásvezérlő IPC-handler validálatlan értéket ad az mpv-nek

**Fájl · sor:** `topwords-player/src/main.js:730-752` (`seek`, `set-speed`, `set-subtitle-track`, `set-audio-track`) → `topwords-player/src/mpv-render-bridge.js:568-598`

**Állapot:** ezek az egyedüli handlerek, amelyek a `isTrustedSender` után **semmilyen típus-/tartomány-ellenőrzést nem végeznek** a payloadon; az érték `String(value)`-ként kerül az mpv parancs-argv-be:

```js
// main.js:730
ipcMain.handle('seek', async (event, seconds) => {
    if (isTrustedSender(event) && mpv) {
        await mpv.seek(seconds);          // nincs Number.isFinite / tartomány-ellenőrzés
    }
});
// mpv-render-bridge.js:569
this.#command(['seek', String(seconds), 'absolute']);
```

Ellenpélda a jó mintára ugyanebben a fájlban: `set-pause` (`main.js:725`) igenis ellenőriz (`typeof paused === 'boolean'`), és a szó-műveletek mind erősen validálnak (`360-366`, `514-534`).

**Támadási forgatókönyv (bemenet → hatás):** a triggerhez **renderer-kompromittálás kell**, ami ebben az appban nincs bizonyítottan elérve (CSP + sanitizer + text-only felirat-renderelés zárja). Ha mégis: a támadó `window.player.setSpeed('yes')` / `setSubtitleTrack('--config-dir=/tmp/evil')`-szerű értékeket küldhet. Hatás **korlátozott**: (a) `mpv_command` argv-alapú, **nincs shell** → nincs parancs-injektálás; (b) a parancsforma `['set', <property>, <érték>]`, ahol a **property-név fix literál** — a támadó csak az ÉRTÉKET vezérli, tehát nem tud másik mpv-propertyt (pl. `script`, `input-conf`, `ytdl-raw-options`) beállítani, és `--`-kapcsolók sem értelmeződnek `set`-argumentumként. A reális hatás: érvénytelen érték → mpv hibakód, amit a kód eldob → funkcionális zaj, esetleg abszurd `speed` érték (audio-driver terhelés). A `seek` esetén `String(NaN)` → `"NaN"`, amit az mpv elutasít.

**Indoklás:** nem MEDIUM, mert (1) nincs távoli/külső trigger — a bemenet forrása a saját, CSP-védett renderer; (2) még kompromittált renderer mellett is csak érték-pozíciót vezérel egy fix property-hez, ami se RCE-hez, se adat-szivárgáshoz nem vezet. LOW, mert **rés a defense-in-depth mintában**: a fájl minden más handlere validál, ez a négy kivétel, és a `mpv-render-bridge` a **sandbox nélküli főfolyamatban**, FFI-n át beszél egy natív könyvtárral — ott az „ismeretlen alakú bemenet ne jusson át” elv értéke a legnagyobb.

---

### EL-L2 · LOW — A CSP-ből hiányzik a `script-src` szűkítés, a `connect-src`/`img-src`/`frame-src` explicit tiltása és a `form-action`

**Fájl · sor:** `topwords-player/src/index.html:5`

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none';" />
```

**Állapot:** a `default-src 'self'` a `script-src`/`connect-src`/`img-src`/`frame-src`/`media-src` hiányzó direktíváira lefedésként örökül szolgál, tehát külső host felé **nincs betöltés**, és inline script nem futhat (a `default-src 'self'` nem tartalmaz `'unsafe-inline'`-t). Ami TÉNYLEGESEN hiányzik: `form-action` (nem örököl `default-src`-ből) és a `frame-ancestors`. A `style-src 'unsafe-inline'` szükséges is (a sanitizer `style` attribútumot enged át, `renderer.js:1118-1135`) — de tágítja az adat-exfiltráció elméleti felületét.

**Támadási forgatókönyv:** feltételezve egy renderer-XSS-t (amit a jelenlegi kód nem enged, lásd EL-I1), a támadó `<form action="https://evil.tld">` submitjével navigálhatna — de ezt a `main.js:60-62` `will-navigate` preventDefault és a `setWindowOpenHandler` deny **függetlenül blokkolja**. Adat-exfiltráció `img-src`/`connect-src` felé: `default-src 'self'` zárja. Tehát **jelenleg nincs kihasználható út**; a lelet a réteg vékonyságáról szól, nem törésről.

**Indoklás:** LOW (nem INFO), mert konkrét, megnevezhető direktíva-hiány (`form-action 'none'`), és mert a `'unsafe-inline'` stílus + sanitizer-átengedett `style` attribútum kombináció egy jövőbeli sanitizer-regressziónál (pl. ha az `AI_HTML_ALLOWED_STYLE_PROP` bővül `background`/`-image` irányba) exfiltrációs csatornává válna. Ma nincs hatás.

---

### EL-L3 · LOW — A macOS build ad-hoc aláírással megy ki, Windowsra egyáltalán nincs aláírás; nincs auto-update, tehát nincs frissítési út sem

**Fájl · sor:** `topwords-player/scripts/adhoc-sign.js:26-35`, `topwords-player/package.json:33` (`afterPack`), `package.json:47-58` (win target: `nsis`+`portable`, aláírás-konfiguráció nélkül)

```js
execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
```

**Állapot:** az `adhoc-sign.js` fejléc-kommentje maga is rögzíti, hogy ez **nem hitelesít fejlesztőt és nem old Gatekeepert**, és élesben Developer ID + notarizáció kell. A Windows-oldalon nincs `win.certificateFile`/`signtool` konfiguráció, tehát az `.exe`/NSIS-telepítő **aláíratlan**. Auto-updater nincs (12. pont), tehát a kiadott bináris frissítése kézi újratöltésre épül.

**Támadási forgatókönyv (külső trigger, ezért nem puszta INFO):** a felhasználó a topwords oldalról tölti le a telepítőt. (a) **Terjesztési MITM / letöltő-oldal kompromittálás**: aláíratlan (Win) vagy ad-hoc aláírt (mac) binárisnál a felhasználónak nincs kriptográfiai eszköze felismerni a cserét — a Gatekeeper/SmartScreen figyelmeztetés a legitim buildnél IS megjelenik, ezért a felhasználó megtanulja átkattintani, és a trójai buildet ugyanúgy elfogadja. (b) **Frissítési út hiánya**: egy jövőbeli kliens-oldali sebezhetőség javítása nem jut el a már telepített példányokra automatikusan; a Fázis-4 hatókörön belül ez az egyetlen olyan hézag, aminek élettartam-hatása van.

**Indoklás:** LOW, nem MEDIUM: (1) ez **build/terjesztési** hézag, nem futásidejű kódhiba; (2) a HTTPS-en kiszolgált letöltés a legvalószínűbb MITM-vektort lefedi; (3) a fájl kommentje bizonyítja, hogy a hézag **tudott és dokumentált**, konkrét go-live teendőkkel. Go-live checklist-tétel, nem kód-lelet.

---

### EL-L4 · LOW — Az Electron 33.4.11 kifutott (EOL) főverzió-ágon van

**Fájl · sor:** `topwords-player/package.json:61` (`"electron": "^33.0.0"`), telepített: `33.4.11` (`node_modules/electron/package.json`)

**Állapot (csak verzió-tény, CVE-találgatás nélkül):** az Electron támogatási politikája a **legutóbbi három stabil ágat** tartja karban; a 33-as ág ezen kívül esik, tehát a beépített Chromium/V8/Node **nem kap további biztonsági javítást**. A `^33.0.0` range emiatt a jövőben sem húz be patcheket (a 33.x maga sem jelenik meg többé).

**Támadási forgatókönyv:** a renderer által feldolgozott, kívülről érkező adat (a) a **felirat szövege** (rosszindulatú `.srt`/`.ass`, EL-I2), (b) az **API-válaszok** (`statuses`, `lookup`, AI-flashcard HTML). Ha egy jövőbeli, patch nélkül maradó Chromium-hiba a renderer-folyamatban kihasználható, azt ez az adatfolyam eléri. **Fontos enyhítő tény:** a renderer **`sandbox:true`-val** fut (`main.js:50`), tehát egy renderer-kompromittálás önmagában nem ad rendszer-hozzáférést — még egy sandbox-escape is kellene hozzá.

**Indoklás:** LOW: konkrét, ma működő exploit-lánc nincs bizonyítva (a megbízás tiltja a CVE-találgatást), viszont a „nem kap többé javítást” állapot mérhető, elévülő kockázat, és a frissítés (Electron 3x LTS-ágra emelés + `npm run dist` újrafuttatás) alacsony költségű. Az EL-L3-mal együtt olvasandó: frissítés hiányában a kiadott példányok is ezen a verzión ragadnak.

---

## INFO-leletek (forgatókönyv nélküli megfigyelések / megerősítések)

| ID | Fájl : sor | Megfigyelés |
|---|---|---|
| **EL-I1** | `renderer.js:1095-1195` | **Az AI-HTML sanitizer erős.** A parse inert `<template>`-be megy (`1189`) → a `<img onerror>`-szerű tagek már a parse-kor sem futnak/töltenek. A `rebuildSafeNodes` **friss elemeket épít és SEMMILYEN attribútumot nem másol** a szűrt `style`-on kívül → `href`/`src`/`on*` strukturálisan lehetetlen. A `AI_HTML_DROP_TAGS` tartalmazza az `svg`/`math`/`template`-et → namespace-confusion és mutation-XSS trükkök a teljes részfa eldobásával zárva. A `copySafeStyle` longhand-allowlisttel dolgozik és `url(` mintát utasít. Nem találtam bypasst. |
| **EL-I2** | `renderer.js:612-682`, `mpv-render-bridge.js:405-444` | **A feliratszöveg-út XSS-mentes.** A `sub-text` a `MAX_STRING_BYTES = 4096` plafonnal dekódolódik (`mpv-render-bridge.js:125-132, 425-432`) → egy több MB-os „egysoros” rosszindulatú felirat nem terheli túl a tokenizálót (DoS-fék). A renderer az overlay-t `textContent` + `createTextNode`-dal építi (`630, 644`), az `innerHTML` csak kiürítésre (`614`). Egy `<script>`-et tartalmazó `.srt` **sima szövegként jelenik meg**. |
| **EL-I3** | `renderer.js:381` | A tokenizáló regexe `/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu` — beágyazott kvantor kvantoron belül, ami elvben ReDoS-gyanús alak. **Gyakorlatilag nem katasztrofális**: a belső csoport kötelező elválasztó-karakterrel (`'`/`’`/`-`) kezdődik, ami az alternatívák közti visszalépést lineárissá teszi, ráadásul a bemenet a 4096 bájtos plafon miatt korlátos. Nem tekintem leletnek. |
| **EL-I4** | `renderer.js:66, 146, 639`, `102-115` | A `statusMap` a szerver JSON-jából jön, és `statusMap[key]` mintával olvassuk — prototípus-lánc miatt egy `"constructor"`/`"toString"` kulcsú keresés örökölt függvényt adna vissza. **Ártalmatlan**, mert az eredményt azonnal a hardcode-olt `STATUS_LABELS[status]`-hoz méri (`640`), és csak `st-<ismert>` CSS-osztály kerülhet ki. Írás nem történik prototípusra (`797-812` saját kulcsokat állít). |
| **EL-I5** | `mpv-bridge.js` (egész fájl), `verify-bridge.js:19` | **Halott kód.** Ez az egyetlen `child_process.spawn`-t használó modul (`:51`), és **`src/` alól semmi nem hivatkozza** — csak a `verify-bridge.js` fejlesztői script. A csomagolt build `files` mintája (`package.json:20-28`) `src/**/*.js`-t visz, tehát a fájl **bekerül a disztribúcióba**, jóllehet sosem töltődik be. A benne lévő `os.tmpdir()`-alapú, `topwords-mpv-<pid>.sock` nevű IPC-socket (`:31`) többfelhasználós gépen elvben előre kitalálható útvonal — de mivel a modul nem fut, ez ma nem támadási felület. Takarítási javaslat (nem biztonsági követelmény): a fájl kizárása a buildből vagy törlése. |
| **EL-I6** | `main.js:600-638` | **Kiemelendő jó minta.** Az `open-media` nem fogad tetszőleges utat: csak az `allowedMediaPaths` halmazban lévő, a **natív dialógusból** származó abszolút út tölthető be (`622`, `636`). Ez egy csapásra kizárja, hogy egy kompromittált renderer `http(s)://`/`rtmp://` URL-t adjon az mpv `loadfile`-jának (SSRF + natív demuxer-felület a sandbox nélküli főfolyamatban). Az `add-subtitle-file` (`775-806`) ugyanígy dialógus-kötött — a renderer még útvonalat sem adhat át. |
| **EL-I7** | `auth-store.js` (egész), `main.js:183-205` | A tárolt tokennek **nincs kliens-oldali lejárati metaadata**; a fájl addig él, amíg a szerver 401/403-mal el nem utasítja (`main.js:196-200` → `clearToken()`). Ez konzisztens a szerver-oldali 90 napos player-token-lejárattal (korábbi auditkör), és a `safeStorage`+0600 mellett elfogadható. Megjegyzendő: a `saveToken` `false` visszatérése (nincs OS-titkosítás) a UI-ig eljut (`main.js:170` `persisted`), de a renderer nem jelzi külön a felhasználónak. |
| **EL-I8** | `main.js:59-62` | A `will-navigate` guard megvan, `will-attach-webview` és `will-frame-navigate` nincs — **nem szükséges**, mert `webviewTag` alapból `false`, és az oldal `loadFile`-lal, `'self'` CSP-vel fut, alframe nélkül. Az `isTrustedSender` (`75-80`) explicit `senderFrame === mainFrame` ellenőrzést végez, ami pont az alframe-forrású IPC-t zárja. |
| **EL-I9** | `topwords-api.js:107-146` | Minden kérésen `AbortSignal.timeout` (15 s, AI-nál 45 s) és `redirect: 'error'`. A hibakezelés a nyers szerver-szöveget nem tükrözi a UI-ba: a `wordActionError` (`main.js:331-348`) fix, magyar üzenetekre képez le, csak ismert hibakódokat fordít. Ez a főfolyamat→renderer irányú információszivárgást minimalizálja. |

---

## PLAN-feltevés MEGDŐLT

A PLAN Fázis 4b 3. pontja négy vizsgálandó területet nevez meg. Ebből **kettőnek nincs tárgya** a kódbázisban:

### 1. „deep-link/protocol-handler injection” — **MEGDŐLT**

**Bizonyíték:** a `topwords-player/` teljes forrásában (a `node_modules` és `dist` nélkül) **egyetlen találat sincs** a következőkre: `setAsDefaultProtocolClient`, `open-url`, `second-instance`, `requestSingleInstanceLock`, `process.argv`-parsing. A `package.json` `build` blokkja (`13-59`) nem tartalmaz `protocols` bejegyzést, tehát az electron-builder nem is regisztrál egyedi sémát a telepítéskor.

**Következmény:** a feltételezett „egy weboldal `topwords-player://…` linkkel paramétert injektál” vektor **nem létezik**. A párosítás iránya ellentétes és biztonságos: az app nyitja a rendszer-böngészőt (`main.js:235`), origin-ellenőrzés után — nem a böngésző hívja az appot. Ez a tervezési döntés önmagában megszünteti a teljes deep-link támadási osztályt.

### 2. „auto-update / aláírás-ellenőrzés / HTTP vs HTTPS feed” (12. vizsgálati pont) — **MEGDŐLT**

**Bizonyíték:** nincs `electron-updater` a `dependencies`/`devDependencies` között (`package.json:60-66`), nincs `autoUpdater`-hivatkozás a forrásban, és nincs `build.publish` feed-konfiguráció. **Nem létező updater nem tud aláíratlan vagy HTTP-s feedet behúzni.**

**Következmény:** a feltételezett „kompromittált update-feed → RCE” vektor nem áll fenn. A hiányzó frissítési út viszont **másfajta** kockázat, amit EL-L3-ban dokumentáltam (kiadott példányok nem javíthatók), és ami EL-L4-gyel (EOL Electron-ág) együtt olvasandó.

### Amit a PLAN helyesen sejtett, de a kód már megoldott

- **„`contextIsolation:true`/`nodeIntegration:false` megerősítés”** — nemcsak megvan, hanem `sandbox: true`-val kiegészítve (`main.js:46-51`), ami a PLAN által nem is kért, szigorúbb szint.
- **„`shell.openExternal` cél-URL validáció (csak várt origin)”** — pontosan ez van megvalósítva (`main.js:231` + `topwords-api.js:90-96`), teljes origin-egyezéssel, fail-closed módon.
- **„token tárolása (`auth-store.js`)”** — `safeStorage` + 0600 + „nincs OS-titkosítás → nem írunk lemezre” fallback. A feltételezett plaintext-tárolás **nem áll fenn**.

---

## Zárás

A Fázis 4b Electron-dimenziója **0 HIGH és 0 MEDIUM** leletet hozott. A négy LOW közül kettő (EL-L3, EL-L4) **go-live/ops-jellegű** (aláírás + notarizáció, Electron-ág frissítés), egy (EL-L1) defense-in-depth-rés a lejátszásvezérlő IPC-handlerek validációjában távoli trigger nélkül, egy (EL-L2) pedig CSP-direktíva-finomítás, aminek ma nincs kihasználható útja. A PLAN két feltételezett támadási osztályának (deep-link, auto-update) **nincs tárgya**.

**A megbízás szerint javítás nem történt — ez a dokumentum kizárólag leletlista.**
