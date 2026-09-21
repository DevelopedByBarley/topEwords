# Chrome-bővítmény kódaudit — terv + eredmények

> Indult: 2026-09-17 · Tárgy: `chrome-extension/` (Manifest V3, verzió 1.0)
> Fókusz: **kliens-kód mint támadási felület** — a `last_audit/PLAN.md` Fázis 4b-ben nevesített,
> addig csak backend-nézőpontból vizsgált terület kibontása.
> Terjedelem: ~8 800 sor élő JS/CSS/HTML (11 fájl).

## Miért külön menetekben

A naiv „olvasd be az egészet és auditáld" a teljes 17 600 sort behúzza (a build-duplikátummal együtt,
kétszer ugyanazt), és utána bent is marad a kontextusban. A terv ezért:

1. **A build-duplikátumot (`topwords-extension-1.0/`) soha nem olvassuk** — egyetlen `diff` lezárja.
2. **Menetenként külön beszélgetés**, friss kontextussal; a menet végén csak a leletlista marad meg.
3. **Subagent a széles keresésre** — a „hol fordul elő X" kérdéseket subagent végzi, csak a következtetést adja vissza.

---

## Menetek

### 1. menet — Felderítés és build-integritás ✅ KÉSZ (2026-09-17)
Build-diff, manifest, kódtérkép, adatáramlás. Eredmények lentebb.

### 2. menet — Biztonság és adatkezelés ✅ KÉSZ (2026-09-18)
Az 1. menet után **szűkíthető**: a permissions-higiénia és a titok-tárolás lezárult, marad a
XSS-felület + message-validáció, azaz négy fájl célzott olvasása.
- XSS: 35 DOM-írás `innerHTML`/`insertAdjacentHTML`-lel — felirat- és backend-eredetű szövegből
  (`search-modal.js` 12, `youtube.js` 7, `lookup-popup.js` 6, `flashcard-modal.js` 5, `netflix.js` 4).
- Message-validáció: 3 `onMessage` listener, 3 `chrome.runtime.id` ellenőrzés — minden ágon megvan-e.
- CSRF a `credentials: 'include'` fetch-eknél.

### 3. menet — Helyesség és robusztusság ✅ KÉSZ (2026-09-21)
Eredmények lentebb. Az L-1 eldőlt (nem hiba), a `popup.js`-ben négy lelet (R-1…R-4).

### 4. menet — Store-megfelelés ⛔ ELVETVE (2026-09-21)
A bővítmény **már fent van a Chrome Web Store-ban**, az aktuális permission-listával átment a
felülvizsgálaton. A menet egyetlen nyitott kérdése az `activeTab` volt (L-2) — a felhasználó
döntése alapján nem foglalkozunk vele, lásd az L-2 lelet lezárását.

---

## 1. menet — eredmények (2026-09-17)

### Build-integritás: TISZTA

`diff -rq` szerint minden közös fájl **bájtra azonos** az élő `chrome-extension/` és a
`topwords-extension-1.0/` build között. Egyetlen eltérés: `src/page-highlight.js` (636 sor)
nincs a buildben.

**Ez szándékos és dokumentált.** A `build-zip.sh` kommentje szerint az 1.29-cel kivezettük az
`<all_urls>` content scriptet, és vele az oldal-kiemelést; a modul nem töltődik be sehol, a fájl
azért marad a repóban, hogy a visszahozás egy manifest-bejegyzés legyen (teljes 1.28-as állapot:
`ext-1.28-all-urls` tag). Nem hiba.

### Leletek

#### L-1 (MEDIUM, verifikálandó a 3. menetben) — a Netflix content script betölti a `youtube.js`-t
`chrome-extension/manifest.json:38-48`

A Netflix-blokk betölti a `src/youtube.js`-t (1375 sor) **és** a `netflix.js`-t is. Minden
Netflix-oldalbetöltés végigfuttatja a YouTube-specifikus DOM-logikát.

- Ha a `netflix.js` valóban támaszkodik a `youtube.js` valamelyik függvényére, a helyes megoldás
  egy megosztott modul (a `shared.js` mintájára), nem a teljes YouTube-modul behúzása.
- Ha nem támaszkodik rá, ez maradvány, és törlendő a manifestből.

Hatás: felesleges futásidő + a Netflix-ág törékenysége YouTube-változásokra.
**Eldöntendő a 3. menetben**, ami úgyis ezt a két fájlt nézi.

#### L-2 (LOW, store-releváns) — az `activeTab` permission valószínűleg felesleges
`chrome-extension/manifest.json:8`

A manifest kéri az `activeTab`-ot, de a `chrome.tabs` hívások nem igénylik:

| Hívás | Kell hozzá `activeTab`? |
|---|---|
| `chrome.tabs.create` — `background.js:202,212`, `popup.js:173,1197` | nem |
| `chrome.tabs.query({active, currentWindow})` — `popup.js:168` | csak az URL kiolvasásához |

A `tabs.query` a popupból `activeTab` nélkül is visszaad tab-objektumot, csak `url`/`title` nélkül.
**Eldöntendő:** használja-e a `popup.js:168` a tab `url`-jét. Ha igen, indokolt; ha nem, törölhető.

Miért számít: a felesleges permission CWS-felülvizsgálati ok, és növeli a telepítéskori figyelmeztetést.

> **Lezárva (2026-09-21) — nem javítjuk.** A bővítmény ezzel a permission-listával már fent van a
> store-ban, tehát a felülvizsgálati kockázat a jelen verzióra nem áll fenn. Ha később mégis
> törölnénk: permission *eltávolítása* nem vált ki új telepítési figyelmeztetést a meglévő
> felhasználóknál, szóval bármikor ráér.

#### L-3 (INFO) — halott kód élőként hivatkozva
`chrome-extension/src/page-highlight.js` (636 sor) sehol nem töltődik be, de a `shared.js` négy
kommentje (`:186`, `:260`, `:317`, `:359`) még élő modulként hivatkozik rá. Félrevezető annak,
aki legközelebb olvassa.

### Kockázati térkép (a 2. menethez)

**A permissions példásan szűk** — `storage`, `contextMenus`, `activeTab`, host_permissions egyetlen
saját domainre (`https://topwords.eu/*`). Nincs `<all_urls>`, nincs `scripting`, nincs távoli
kódbetöltés. A bővítmény-auditok szokásos fő kockázata eleve kizárva.

Mért felület:

- **chrome.* API-hívások:** `storage.local` 20, `tabs.create` 8, `runtime.lastError` 6,
  `runtime.sendMessage` 4, `contextMenus.create` 4, `runtime.onMessage` 3, `runtime.id` 3,
  `tabs.query` 2, `runtime.onInstalled` 2, `contextMenus.removeAll` 2, `contextMenus.onClicked` 2,
  `action.setBadgeText` 2.
- **Auth:** mindhárom `fetch` (`background.js:20`, `popup.js:140`, `popup.js:1225`)
  `credentials: 'include'`-dal megy a topwords.eu-ra, session-cookie alapon. **Nincs kézzel kezelt
  token** — jó hír; a CSRF-oldalt viszont a 2. menetnek ellenőriznie kell.
- **Hibakezelés nem hiányzik:** `background.js` `AbortSignal.timeout`-ot használ a fetch-nél,
  6 helyen kezeli a `chrome.runtime.lastError`-t.

---

## 2. menet — eredmények (2026-09-18)

### Összegzés: a biztonsági felület TISZTA — új lelet nincs

Mindhárom vizsgált dimenzió (XSS, message-validáció, CSRF) záródott. A kód nem véletlenül
biztonságos: minden ágon látszik a szándékos védekezés, kommentben is indokolva.

### XSS-felület: lezárva

A 35 `innerHTML`-írás nem 35 kockázat. A nem konstans adat mindenhol `esc()`-en megy át
(`shared.js:47`), ami mind az öt kritikus karaktert cseréli (`& < > " '`), így szöveg- és
idézett attribútum-kontextusban is helyes.

- **Felirat-eredetű szöveg** (a legnagyobb felület): `ytWordsToHtml()` (`youtube.js:356`) a
  token szövegét **és** a `data-yt-word` attribútumot is escape-eli (`:376`, `:384`). A felirat
  soha nem kerül nyersen DOM-ba. Ez fedi a `youtube.js:463` + `netflix.js:172` sávrajzolást és
  a `youtube.js:935` panelt is.
- **Backend-eredetű mezők**: `lookup-popup.js:498` (meaning, synonyms, example), `search-modal.js:281`
  (találati lista) — minden interpolált mező `esc()`-elt. A körülvevő HTML konstans.
- **Hibaüzenetek**: `lookup-popup.js:424` interpolálja a `msg`-t escape nélkül, **de** az
  `extErrorMessage()` (`shared.js:106`) allowlist-tábla: ismeretlen `error`-ra a hívó hardcode-olt
  fallback-jét adja vissza, a szerver stringjét soha. Mind a 11 hívóhely string-literált ad át
  fallback-nek. **Nem sebezhetőség**, de a biztonság a hívóhelyeken múlik → lásd M-1.
- **AI-HTML** (az egyetlen hely, ahol szándékosan HTML jön a szerverről): `sanitizeAiHtml()`
  (`flashcard-modal.js:76`) allowlist-alapú — tag-allowlist, veszélyes tagek teljes részfa-törlése
  (`script/iframe/svg/form/base`…), **minden** attribútum törlése a szűrt `style` kivételével,
  és a `style`-ban `url(` tiltása. Így `img`/`a` (tracking, távoli kérés) és pozicionáló CSS
  (overlay-támadás) be sem kerülhet. A védelem kétrétegű: a backend is escape-el.

### Message-validáció: lezárva

Élő kódban **egyetlen** `onMessage` listener van, a `background.js:220`, és az első érdemi
sora `sender.id !== chrome.runtime.id` → `return` (`:223`). A manifestben nincs
`externally_connectable`, így web-origin amúgy sem érhetné el — a check defense-in-depth.

A `page-highlight.js:532` második listenere **nem számít**: a modul nincs betöltve (L-3),
tehát a "3 listener / 3 ellenőrzés" 1. menetes szám valójában 1 élő listener / 1 ellenőrzés.

### CSRF és cross-origin: lezárva — a lényegi megállapítás

Az 1. menet nyitva hagyta, hogy a `credentials: 'include'` nem nyit-e CSRF-lyukat. Nem:

- **A content scriptek soha nem hívnak `fetch`-et.** Minden hálózati forgalom a
  `background.js`-en megy át (a `fetch` mindössze 3 helyen szerepel: `background.js:20`,
  `popup.js:140`, `popup.js:1225` — egyik sem content script). A kérés tehát az extension
  origin-jéről indul a `host_permissions` alatt, nem a youtube.com/netflix.com origin-ről.
  Ez azért fontos, mert enélkül a `same_site=lax` session-cookie eleve nem is menne el.
- **Írás CSRF-védett**: a `bootstrap/app.php` csak a `stripe/*`-ot menti fel
  (`validateCsrfTokens(except: ['stripe/*'])`), a `routes/extension.php` a `web` csoportban van.
  A POST-ok a lookup-válaszból kapott tokennel mennek (`X-CSRF-TOKEN: look.csrf`,
  `background.js`), a szerver a `csrfTokenIfSession()`-nel adja ki (`ExtensionController:41`).
- **Nincs regisztrált CORS-middleware és nincs `config/cors.php`.** Ez itt **helyes**: így
  idegen oldal JS-ből nem olvashatja a válaszokat (nincs `Access-Control-Allow-Origin`), az
  extension pedig `host_permissions` alapján CORS-tól függetlenül hívhat. Ha valaki később
  CORS-t vezet be, **ne** tegye rá az `extension/*` útvonalakra.
- Minden handler `$request->user()`-re gate-el (401 `unauthenticated`), az írások `verified`
  middleware + `throttle:20,1,ext-write` mögött vannak, az olvasás `throttle:120,1,ext-read`.
- Session-cookie: `http_only=true`, `secure` prod-ban, `same_site=lax`. Prod-ban CSP + HSTS
  (`SecurityHeaders.php`), `frame-ancestors 'none'`.

### Új lelet

#### M-1 (INFO, megelőző) — az `extErrorMessage` escape-mentes interpolációja hívóhely-függő

`lookup-popup.js:424` (és a hasonló ágak: `netflix.js:416`, `youtube.js:689`,
`search-modal.js:247`) a visszakapott üzenetet escape nélkül teszi `innerHTML`-be. Ma ez
biztonságos, mert az `extErrorMessage` allowlist-táblából válaszol, és mind a 11 hívó
string-literál fallback-et ad. **Nincs támadási forgatókönyv a jelenlegi kódban.**

A kockázat jövőbeli: ha valaki egyszer `extErrorMessage(data.error, data.message)`-t ír —
azaz szerver-eredetű fallback-et ad át —, az azonnal XSS lesz, csendben, mert a hívóhelyen
semmi nem jelzi az escape-kötelezettséget. Egysoros megelőzés: az `esc()`-et a beillesztéskor
alkalmazni (`${esc(msg)}`), ahogy a kód minden más ága teszi. Nem sürgős, de olcsó.

### Ami emiatt nem kell a további menetekbe

A 3. menet tisztán helyességi/robusztussági kérdés marad (L-1 döntés, DOM-scraping, SPA-navigáció,
listener-teardown, tokenizer) — biztonsági szempont nem marad nyitva benne.

---

## 3. menet — eredmények (2026-09-21)

### Összegzés

A két content script életciklus-kezelése **példás** — ott nem találtam hibát. A leletek mind a
`popup.js`-ben vannak, és mind ugyanabból fakadnak: a popup a projekt saját, máshol következetesen
alkalmazott mintáit egy-egy ponton nem követi.

### L-1 lezárva: NEM HIBA — a manifest helyes

Az 1. menet két lehetőséget vetett fel (megosztott modul kell, vagy maradvány). **Egyik sem áll.**

A `netflix.js` **ténylegesen használ** három dolgot a `youtube.js`-ből: `ytWordsToHtml()`
(`netflix.js:172`), `ensureYtStatusMap()` (`:402`), és írja a `ytStatusMap` globált (`:700`).
Tehát nem maradvány, nem törölhető.

A „felesleges futásidő" aggály viszont **tárgytalan**: a `youtube.js` teljes mellékhatásos része
egyetlen `if (location.hostname === 'www.youtube.com')` blokkban van a fájl végén (`:1329`).
Netflixen ez hamis, így **semmi nem fut le** — se listener-regisztráció, se observer, se init.
A fájl betöltése ott kizárólag függvénydefiníciók kiértékelése.

Marad egy elnevezési furcsaság (a Netflix-ág `yt*` nevű függvényeket hív), ami olvasáskor
megzavarhat, de nem hiba. Külön megosztott modulba emelni nem éri meg a mozgatás kockázatát.

### Életciklus és SPA-navigáció: TISZTA

- **Listener-párosítás teljes.** Minden `addEventListener`-nek megvan a `removeEventListener`
  párja (`youtube.js:791-800`, `:1231-1241`, `:957-962`), minden observernek a `disconnect()`
  (`:468`, `:713`, `:1246-1248`).
- **Navigációs token-minta következetes.** A `ytNavToken` (`youtube.js:46`) és az `nfxNavToken`
  (`netflix.js:25`) minden async ágat érvénytelenít; a `destroyYtSubtitles()` (`:1245`) az
  observereket, a shadow-hostot, a panelt és a natív felirat-állapotot is lebontja — sőt a
  felhasználó saját CC-beállítását is visszaállítja, ha a kick lekapcsolta.
- **A Netflix háromrétegű navigáció-észlelése átgondolt**: `popstate` + `<title>`-observer
  (a body-szintű observer helyett, CL-1) + 2 mp-es poll végső hálóként. Mindhárom `extAlive()`-ra
  takarít és leáll (`netflix.js:610-656`).
- **A `registerVocabRefreshHook` nem szivárog cross-page**: a hookok `isActive()`-ra gate-elnek
  (`shared.js:384`), a Netflix-hook `nfxEnabled`-et néz, ami YouTube-on sosem igaz.

### `tokenizer.js`: TISZTA

A split-regex capture-csoportja garantálja a páros/páratlan indexelést, a kifejezés-illesztés
helyesen a leghosszabbtól indul (`:62`), a `phraseFlagCache` `WeakMap` nem szivárog.

A terv „ékezetes szavak" kérdésére: a `HL_WORD_SPLIT` (`:10`) **szándékosan** csak ASCII
(`[a-zA-Z]+`), ékezetes betűnél elválasztóként tördel. A bővítmény angol feliratokhoz készült,
így ez konzisztens döntés, nem hiba.

### Leletek — mind a `popup.js`-ben

#### R-1 (HIGH) — a fontosság-mentésből hiányzik az in-flight zár
`chrome-extension/popup.js:564`

A `saveImportance()`-nek **nincs** szerializáló zárja, szemben a közvetlenül fölötte álló
`saveStatus()`-szal (`:494-497`, `statusSaveInFlight`). Hogy ez kimaradás és nem döntés, azt a
testvér-modul bizonyítja: a `search-modal.js` ugyanezt a panelt implementálja, és ott **mindkét**
műveletnek van zárja — `searchStatusSaveInFlight` (`:808`) **és** `searchImportanceSaveInFlight`
(`:870`). A CSS-ben sincs `.importance-row.saving` szabály, így a csillagok mentés közben
szabadon kattinthatók (a `.status-row.saving` viszont `pointer-events:none`-t tesz).

Forgatókönyv: a felhasználó gyorsan 3, majd 5 csillagra kattint. A `previous` a kattintáskor
befagy, ezért ha a korábbi kérés válasza ér vissza utoljára és hibás (pl. 429 — az írás-végpontokon
`throttle:20,1,ext-write` van), a rollback a **`null`**-t állítja vissza, holott a szerveren a 3
vagy az 5 ül. A panel 0 csillagot mutat, a szerveren más van, és ez a popup bezárásáig így marad.

Javítás: `importanceSaveInFlight` zár a `saveStatus` mintájára, `.saving` osztállyal és a
hozzá tartozó CSS-szabállyal.

#### R-2 (MEDIUM) — a popup két nyers `fetch`-e időkorlát nélkül fut
`chrome-extension/popup.js:140` (bejelentkezés-ellenőrzés), `popup.js:1225` (`runSearch`)

Mindkettő megkerüli a háttér `fetchJson` wrapperét, és `AbortSignal` nélkül hívja a `fetch`-et.
A `background.js:10-12` kommentje **szó szerint ezt a kockázatot** nevezi meg a `FETCH_TIMEOUT_MS`
indoklásaként: „egy félbemaradt (lógó) TCP-kapcsolat esetén a promise sosem oldódna fel, és a hívó
felület spinnere — »Keresés…« … — örökre ott maradna, hibaüzenet nélkül". A popup két kérése épp
ebből a védelemből marad ki.

Forgatókönyv: captive portal / VPN-bontás / félig leállt szerver, ahol a TCP nem záródik le. A
`searchMessage('Keresés…')` kiírja a töltő állapotot (`:1281`), a fetch soha nem oldódik fel, se
`.then`, se `.catch` nem fut — a felirat a popup bezárásáig ott marad.

Javítás: `signal: AbortSignal.timeout(15000)` mindkét fetch-re. Az AbortError a meglévő
`.catch()`-ekbe esik, új hibaág nem kell.

#### R-3 (MEDIUM) — a bejelentkezés-ellenőrzés nem véd a nem-JSON válasz ellen
`chrome-extension/popup.js:147`

A lánc `.then((r) => r.json())` — se `r.ok`-vizsgálat, se `.catch()` a `json()`-ön. A `runSearch`
ugyanezt **helyesen** csinálja: `r.json().catch(() => null)` (`:1232`). Az aszimmetria a hiba.

Forgatókönyv: a szerver 500/503-at ad HTML hibaoldallal (deploy, PHP fatal, Cloudflare 502/521).
A válasz megérkezik, de nem JSON → `SyntaxError` → a `.catch()` ág fut → az **offline-banner**
jelenik meg („Nincs kapcsolat"), holott van kapcsolat, csak a szerver hibázik. Ugyanez a tünet
captive portal HTML-jénél.

Javítás: `.then((r) => r.json().catch(() => null))`, és külön ág a nem-JSON / `!r.ok` esetre
„szerverhiba" szöveggel.

#### R-4 (LOW) — a `statusSaveInFlight` globális, nem soronkénti
`chrome-extension/popup.js:283`

A zár modul-szintű, de a `.saving` osztály csak a mentő sor `statusRow`-jára kerül (`:508`). A
többi sor gombja vizuálisan aktív marad, de a kattintás a `:495` `return`-jén **némán** elhal —
se mentés, se visszajelzés.

Enyhítő körülmény: a `head` kattintása mindig becsukja az előzőt (`closeOpenResult`, `:635`), így
egyszerre egy panel van nyitva, a második kattintáshoz külön lenyitás kell. Adat nem sérül, csak
egy interakció vész el. A `search-modal.js` ugyanezt a globális mintát használja, ott viszont
tényleg csak egy részletező létezik egyszerre — ott korrekt.

### Amit külön ellenőriztem és helyes

- **A keresés generation-tokene (`searchSeq`) teljes**: `popup.js:197`, `:1223`, `:1235`, `:1263`.
  Elavult választ mind a sikeres, mind a `.catch()` ág eldob; üres mezőre a `searchSeq += 1`
  (`:1275`) kifejezetten érvényteleníti a repülő kérést. Egyenértékű a `ytNavToken` mintával.
- **A `sendMsg` mindig meghívja a callbacket** (`:36-50`): `chrome.runtime.lastError` kezelve
  (`:39`), a szinkron dobás `try/catch`-ben (`:47`). A `background.js` minden popup-üzenettípusra
  `return true`-t ad és minden ágon `sendResponse`-t hív — nincs ág, ahol a zár tartósan
  beragadna vagy az AI-gomb örökre letiltva maradna.
- **Az AI-kitöltés hibaágai teljesek** (`:1000-1033`): a gombot a hibaágak **előtt** állítja
  vissza, tehát minden kimeneten felenged.
- **Nincs null DOM-dereferencia**: minden `getElementById` célja létezik a `popup.html`-ben.
  A válaszmezők `??`-vel védettek, a `chrome.tabs.query` destrukturálása `tab?.url`-lel (`:168`).
- **Timer-szivárgás nincs**: egyetlen `setInterval` sincs, a `searchDebounce` `clearTimeout`-tal
  párosított (`:1270`). A popup dokumentuma bezáráskor megsemmisül, teardown itt nem kell.

### Az audit állása

Minden menet lezárult. Nyitott, javítandó lelet: **R-1 (HIGH), R-2, R-3 (MEDIUM), R-4 (LOW)**,
plusz a korábbi **M-1** és **L-3** (INFO, megelőző/kozmetikai). Az L-1 és L-2 lezárva, nem javítjuk.

---

## Teendők — javítás későbbre halasztva (2026-09-21)

**Egyik lelet sem blokkolja az indulást**, és egyik sem indokolja a store-verzió visszatartását.
A javítás tudatosan későbbre marad; ez a lista a belépési pont, ha nekiállunk. A részletes
indoklás és forgatókönyv minden lelethez fent, a saját szakaszában.

> **Súlyosság ≠ indulási hatás.** A két tengely itt keresztbe megy: a legsúlyosabb lelet (R-1)
> nem indulási kérdés, az indulást leginkább érintő (R-3) pedig nem a legsúlyosabb. A sorrendet
> ezért nem a súlyosság adja.

### 1. csomag — R-2 + R-3 (egy menet, ugyanaz a két fetch)

A popup **első** hálózati kérését érinti, ami eldönti, megjelenik-e a „jelentkezz be" banner —
vagyis az új felhasználó első képernyőjét. Ha a szerver deploy alatt áll, minden épp akkor induló
felhasználó a félrevezető „Nincs kapcsolat" üzenetet kapja „szerverhiba" helyett.

- `popup.js:140` és `popup.js:1225` — `signal: AbortSignal.timeout(15000)` mindkét fetch-re.
  Az AbortError a meglévő `.catch()`-ekbe esik, **új hibaág nem kell**.
- `popup.js:147` — `.then((r) => r.json().catch(() => null))`, és külön ág a nem-JSON / `!r.ok`
  esetre „szerverhiba" szöveggel. A `runSearch` (`:1232`) már így csinálja — onnan másolható.

Kockázat: alacsony, a változás két sor plusz egy hibaág.

### 2. csomag — R-1 (külön menet, CSS is tartozik hozzá)

Nem indulási kérdés: bejelentkezés + keresés + találat lenyitása + gyors dupla kattintás **és**
hibás szerverválasz kell hozzá. A rendszeres használót érinti, nem az újat.

- `popup.js:564` — `importanceSaveInFlight` zár a `saveStatus()` (`:494-497`) mintájára.
- `popup.css` — `.importance-row.saving { pointer-events: none }` a `.status-row.saving`
  (`:688-691`) mintájára.
- Minta átemelhető: `src/search-modal.js:870` (`searchImportanceSaveInFlight`).

### 3. csomag — ha már ott vagyunk (olcsó, opcionális)

- **R-4** (`popup.js:283`) — a státusz-zár soronkéntivé tétele, vagy legalább a némán elnyelt
  kattintás jelzése. Adat nem sérül, csak egy interakció vész el.
- **M-1** (`lookup-popup.js:424`) — `${esc(msg)}` a beillesztéskor. Ma nem sebezhetőség, de
  egysoros megelőzés egy jövőbeli csendes XSS ellen.
- **L-3** (`shared.js:186, 260, 317, 359`) — a négy komment már nem létező élő modulra hivatkozik
  (`page-highlight.js`). Tisztán kozmetikai, a következő olvasó kedvéért.
