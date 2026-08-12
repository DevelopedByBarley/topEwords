# Bővítmény-audit — 2. kör (a 2026-08-10-i részleges kör befejezése)

**Dátum:** 2026-08-11
**Verzió:** Chrome extension 1.31
**Előzmény:** `EXTENSION_AUDIT_2026-08-10.md` — abból 3/6 terület futott le (CWS-policy, kliens-biztonság, csomag-integritás); a workflow a verify fázisban beállt.
**Ez a kör a maradék 3 területet fedi le**, workflow nélkül, három párhuzamos agenttel: backend-jogosultság, SSRF/felirat-lánc, kliens-működési bugok.

> Ez dokumentáló audit. **Semmit nem javítottunk.**

---

## Összesítés

| Terület | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|
| Backend-jogosultság | 0 | 0 | 4 | 5 |
| SSRF / felirat-lánc | 0 | 2 | 4 | 1 |
| Kliens-működés | 1 | 4 | 7 | 8 |
| **Összesen** | **1** | **6** | **15** | **14** |

**A HIGH nem biztonsági, hanem működési** (Netflix-lag). Biztonsági oldalon a kör **0 HIGH**.

**Store-blokkoló továbbra is pontosan 1, és nem kód:** a CWS-review nem tud fiókot csinálni (`REGISTRATION_INVITE_ONLY=true`). Lásd `EXTENSION_GO_LIVE_TEENDOK.md:39-52`.

**Csomag-integritás újramérve:** az élő forrás mind a 13 fájlon md5-azonos a `topwords-extension-1.31/` snapshottal — vagyis a `b7ac205`, `948c655`, `254180e` commitok már benne vannak a snapshotban is. „Amit feltöltünk = amit auditáltunk" ma is igaz.

---

## HIGH

### CL-1 — A Netflix-lag mért magyarázata (működési, nem biztonsági)

`chrome-extension/src/netflix.js:416-419` — a vezérlő-observer a **teljes `document.body`-t** figyeli `subtree: true`-val:

```js
nfxControlsObserver.observe(document.body, { childList: true, subtree: true });
```

A Netflix lejátszó DOM-ja folyamatosan mutálódik (progress-bar, felirat-frame, kontrollok), így a rAF-callback akár 60×/s lefut, és minden alkalommal `reconcileNfxLyrics()` → `ensureNfxToggle()` + `ensureNfxBar()`. A `pending` flag frame-re összevonja, de nem teszi ingyenessé.

**A súlyosbító, és ez a lényeg:** a felirat-observer (`netflix.js:222-227`) `subtree:true` **+ `characterData:true`**-val fut, és a callbackje `innerText`-et olvas (`netflix.js:193`). Az `innerText` — a `textContent`-tel szemben — **kikényszeríti a layoutot**. Mutáció → forced reflow → DOM-írás → újabb mutáció: tankönyvi layout thrash.

**Amit az agent adverzariálisan megdöntött saját magában:** a „önmagát tápláló ciklus" komponens **NEM áll fenn** — a `bar.innerHTML` írás a shadow rooton belül történik (`netflix.js:168`), a shadow-belső mutációk pedig nem buborékoznak fel a `body`-t figyelő observerhez. Ami marad, és önmagában is HIGH: body-szintű subtree observer + frame-enkénti `innerText` forced reflow.

**A YouTube-ág ugyanezt jól oldja meg:** `#movie_player`-t figyel, nem a `body`-t (`youtube.js:1119-1121`), és `textContent`-et olvas (`youtube.js:420`). A Netflix-ág átállítása erre a mintára a kézenfekvő irány.

### ⚠️ A lagra soha nem volt javítás

A memóriában `85c3e67 "lag problem test"` szerepelt a lag-fix commitként. **Mérve: ez a commit nulla `chrome-extension/` fájlt érint.**

```
resources/js/components/public/*.tsx | 24 +-
resources/js/lib/scroll-trigger.ts   | 16 +
resources/js/pages/dashboard.tsx     | 260 +++++---
tests/Feature/MobileScrollPerformanceTest.php | 102 ++
```

`git show 85c3e67 -- chrome-extension` → **üres diff**. Ez a commit a **weboldal** mobil-scroll teljesítményét javította. A bővítmény-lagra tehát soha nem történt javítási kísérlet.

### `b7ac205` (Netflix navigáció-észlelés) értékelése

A commit **helyes** megállapításra épül: a `history.pushState` becsomagolása izolált világban hatástalan (a content script a saját `history`-jét cseréli, az oldal a magáét hívja). A wrapper törlése indokolt volt.

**A mellékhatás, amit a commit nem mér fel:** a navigáció-észlelést a `nfxControlsObserver`-re terhelte (`netflix.js:408-410`). Ezzel a `body`-szintű subtree observer **kritikus úttá vált** — nem opcionális kényelmi elem többé, hanem a navigáció-észlelés hordozója. Következmény: **a CL-1 javítása (observer szűkítése a lejátszóra) most már nem végezhető el önmagában** — elvágná a navigáció-észlelést is.

---

## MEDIUM

### SSRF-1 — A felirat-lánc követi a HTTP-redirecteket host-újraellenőrzés nélkül

`app/Services/YouTubeCaptionService.php:153, 207, 225, 290, 322, 390` — mind a hat kimenő hívás `Http::timeout(...)` **`withoutRedirecting()` nélkül**.

Mérve (`ReflectionClass` a `PendingRequest::$options`-on): `allow_redirects` nincs beállítva → a Guzzle default érvényes (`RedirectMiddleware.php:29-34`): **5 hopot követ, `http`-re is, host-ellenőrzés nélkül.**

Éles aszimmetria a szomszédos ággal: `TextAnalysisController::safeFetch` (`:255-315`) explicit `withoutRedirecting()`-et használ, hoponként újra `assertPublicHost()`-ot hív, és `CURLOPT_RESOLVE`-val pinneli az IP-t DNS-rebinding ellen. **A caption-lánc egyikkel sem rendelkezik.**

A `baseUrl` a YouTube JSON-jából jön (`:251`, `:585`), semmilyen host-allowlist nem korlátozza. Mérve: tetszőleges host szó szerint lekérődik, beleértve a `169.254.169.254` cloud metadata endpointot.

**Miért nem HIGH — az agent megdöntötte a saját exploitját:** a `captionTracks`-injekció a YouTube escape-elésén elhasal — a `extractCaptionUrl` (`:522`) a `"captionTracks":` literált keresi, a YouTube pedig minden támadó-vezérelt szöveget (cím, leírás, csatornanév) JSON- vagy HTML-escape-el:

```
\"captionTracks\":            → nem tartalmazza a keresett kulcsot (guard áll)
&quot;captionTracks&quot;:    → nem tartalmazza (guard áll)
```

Nincs mért, végponttól végpontig futó támadói út. Ez **egy hiányzó védelmi réteg egy megbízhatónak feltételezett partneren**, nem élő exploit. A guard-hiány viszont valós: a védelem 100%-ban a YouTube integritásán ül.

**Súlyosbító (SSRF-1b):** a lánc **nem blind, hanem exfil-képes.** A lekért tartalom parseolt szegmensekként szó szerint visszamegy a kliensnek (`ExtensionController.php:578-581`). Mérve `baseUrl = http://127.0.0.1:8080/secret`-tel: a válasz `{segments:[{t:0, x:"AWS_SECRET_ACCESS_KEY=..."}]}`.

### DOS-1 — 5× kérés-amplifikáció + a transient ág nem cache-elődik → YouTube-oldali IP-tiltás

`YouTubeCaptionService.php:115-145` — három stratégia sorban, mérve **egyetlen végponti hívásra 5 kimenő YouTube-kérés** (a watch-oldal kétszer is).

Mérve a `throttle:30,1,ext-yt` vödrön: **30 hívás = 150 YouTube-kérés / perc / fiók**, a 31. helyesen 429. A kulcs user-ID (`ThrottleRequests.php:224-233`), tehát **fiókonként külön** 150/perc. 10 fiók = 1500 kérés/perc a szerver egyetlen IP-jéről.

**Súlyosbító, mérve:** a transient (429/5xx) ág szándékosan nem negatív-cache-el (`:140-142`), ezért ugyanaz az ID végtelenül újra-scrape-elhető — 3 azonos hívás = 15 kimenő kérés. Ez az ördögi kör: **ha a YouTube rate-limitelni kezd, a rendszer fokozza a terhelést.** Nincs circuit breaker, ellentétben az AI-ággal (`912aec8`).

Blast radius: a szerver IP-jének YouTube-oldali tiltása → a felirat-funkció minden felhasználónak elhal.

### CL-2 — A Netflix nav-interval örökre fut minden Netflix-fülön

`netflix.js:505-528` — a 2 mp-es `setInterval` **csak** akkor áll le, ha `extAlive()` hamis. Sem a `destroyNfxSubtitles()`, sem a `handleNfxNavChange()` nem hív `clearInterval`-t.

**Az agent megdöntötte a „halmozódás" vádat:** a `startNfxNavWatch` egyetlen hívóhelye a top-level `netflix.js:531`, és az `if (nfxNavInterval) return;` guard idempotens → a `popstate` nem halmozódik, az interval nem duplázódik.

Ami marad: a fül soha nem tud teljesen idle-be menni (a Chrome nem tudja felfüggeszteni, amíg 2 mp-enként JS fut), akkor sem, ha a user soha nem nyitott lejátszót. A tervezés tudatos (`netflix.js:475-477`: a poll a `/watch`-ból kilépést figyeli, tehát muszáj a lejátszón kívül is futnia), a költség viszont valós.

### CL-3 — 9 másodperces vak sáv a status-cooldown alatt

`youtube.js:484-488` — egyetlen hiba után 15 s cooldown, ami alatt minden reconcile némán visszatér (`youtube.js:601-604`, `netflix.js:344-348`).

**Mért időzítés-hézag:** az értesítés timeout **6000 ms** (`netflix.js:186`), a cooldown **15000 ms** (`youtube.js:48`) → **9 másodperc, amikor sem értesítés, sem tartalom nincs.**

Nem HIGH, mert a natív felirat közben látható marad (szándékos védelem) — a user nem veszít funkciót, csak a TW-réteget, és nem érti, miért.

### CL-4 — `search-modal.js`: hiányzó `statusSaveInFlight` zár → néma állapot-divergencia

A `lookup-popup.js:566` és a `popup.js:273` **is** definiál `statusSaveInFlight`-ot, épp az átfedő kérések ellen (a `lookup-popup.js:563-565` kommentje ezt kimondja). A `search-modal.js`-ben **nincs** — mérve: `grep statusSaveInFlight src/search-modal.js` → 0 találat.

**A konkrét bug:** a szerver toggle-szemantikájú (`background.js:236-239`: azonos státusz újraküldése = levétel). Dupla-klikk a státusz-gombon → két POST ugyanazzal a státusszal → a szerver az elsőn **beállít**, a másodikon **levesz** → a UI (optimistic, `search-modal.js:801-807`) a beállítottat mutatja, a DB-ben nincs státusz.

Reprodukció: Alt+W → találat → dupla-klikk a „Tudom" gombra.

**Cáfolat-kísérletek, mind megdőltek:** a `sendMessage` párhuzamos, a `background.js` message-handlere minden üzenetre külön `fetchJson`-t indít sorosítás nélkül (`background.js:364`); a háttérben nincs zár (0 Map, 0 in-flight követés); a `dblclick`-guard a felirat-spanokra vonatkozik (`shared.js:295`), nem a modál gombjaira.

Ugyanez a hiányzó zár a fontosság-csillagokra is igaz (`search-modal.js:840-866`, `lookup-popup.js:534-561`).

**Ez a legkonkrétabb, legkönnyebben reprodukálható funkcionális hiba a jelentésben.**

### CL-5 — `ytStatusWaiters` várólista egyetlen callback-úton ürül

`youtube.js:492-497` — a lista kiürítése **kizárólag** a `sendMsg` callbackjében. Ha a callback nem fut le, a lista örökre ≥1 elemű, és minden további `ensureYtStatusMap` a `length > 1` ágon némán visszatér → **a státusztérkép soha többé nem töltődik be ezen a lapon.**

**Erős cáfolat:** a `shared.js:118-132` `sendMsg` kezeli a `chrome.runtime.lastError`-t és a `try/catch`-et is, mindkét ág hív callbacket — ez lefedi a „SW halott / context invalidated" esetet. A maradék keskeny ablak (a SW-t a böngésző a `fetchJson` közben termináltatja) kódból nem bizonyítható → az agent ezt **GYANÚ**-nak jelölte, nem leletnek.

**Ami mért tény és önmagában is baj:** a `destroyYtSubtitles` a `ytStatusMap`-et nullázza (`youtube.js:1132`), de a `ytStatusWaiters`-t **nem** → A→B videóváltásnál egy még nyitott waiter-lista átlóg az új menetbe.

---

## LOW

### Backend-jogosultság (0 HIGH, 0 MEDIUM — IDOR = 0)

| ID | Lelet |
|---|---|
| **AUTHZ-1** | `extension/youtube-transcript` (`routes/extension.php:29`) az **egyetlen** végpont `verified` és onboarding-kapu nélkül → megerősítetlen Free fiók 30/perc szerver-oldali scrape-et indíthat. **Az agent megdöntötte a saját entitlement-érvét:** a `youtube_transcripts` plan-limit *elmentett* átiratok darabszáma, a bővítmény-végpont nem perzisztál → más erőforrás, nem fizetés-kerülés. |
| **AUTHZ-2** | Az `addWord` (`ExtensionController.php:189-209`) nem futtatja a `notInMainWordList()` szabályt, amit a webes `StoreUserCustomWordRequest.php:22-29` igen → a bővítményből felvihető olyan saját szó, ami a fő szólistában már szerepel, és a `lookup` némán árnyékba teszi. **Részben megdőlt:** a `(user_id, word)` unique index + a controller ütközés-kezelése (`:236-240`) a duplikátum-felét lezárja. |
| **AUTHZ-3** | Az `extension_writes_per_day` keret **Origin-alapon** foglal (`TogglesWordStatus.php:67-74`) → `curl`-lel (Origin nélkül) a webes íróutakon kihagyható. **A súlyosság megdőlt:** a `config/plans.php` nem tartalmaz semmilyen szó-limitet egyik csomagban sem — a saját szó nem fizetős erőforrás. A flashcard-cap a webes úton is fut. Dokumentált, tudatos döntés (`TogglesWordStatus.php:36-38`). |
| **AUTHZ-4** | `player/disconnect` (`PlayerPairingController.php:187`) 500-azik `TransientToken` auth esetén. **Részben megdőlt:** az `api` csoportra nincs `statefulApi()` (`bootstrap/app.php:23-42`), mérve éles session-cookie-val 401. Marad regresszió-csapda. |

### SSRF / felirat-lánc

| ID | Lelet |
|---|---|
| **SSRF-2L** | A nem-ankerezett `extractVideoId` (`:45-50`) átengedi a `https://evil.com/youtube.com/watch?v=...`-formát, és ilyenkor az `assertPublicHost` **nem fut le** (`fetchSource:167-176`). **Mérve fail-safe:** a támadó URL-je teljesen elvetődik, csak a 11 karakteres ID marad, ami hardkódolt `https://www.youtube.com/...`-ba kerül. A `169.254.169.254` soha nem lett lekérve. Regresszió-csapda: ha bárki később a `$url`-t is használni kezdi az ID-s ágon, a rés azonnal valódi. |
| **DOS-2** | Az extension YT-végponton nincs `verified`, ellentétben minden más kimenő-hatású route-tal. Mérve: unverified user → 422, de **5 kimenő kérés elment**. |
| **DOS-3** | 5 kimenő hívásból csak 1 rendelkezik méret-sapkával (`MAX_CAPTION_BYTES`, `:384-406`). Mérve 30 MB válasszal: **32 MB memória-növekedés, a sapka nem lőtt.** Nem támadó-vezérelt → LOW. |
| **DOC-1** | A `MAX_CAPTION_BYTES` doc-comment (`:376-380`) állítása részben hamis: a fallback ág `RuntimeException`-t dob, amit a `:274`/`:362` catch **nem** fog el → a 2. és 3. stratégia soha nem fut le, és a negatív cache 15 percre lezárja a videót minden felhasználónak. Nem biztonsági lelet, de félrevezeti a jövőbeli olvasót. |

### Kliens-működés

**CL-6** — `lookup-popup.js` öt document-szintű listenere soha nem takarodik el, **de nem is halmozódik** (top-level, egyszer futó regisztráció). Az `onOutsideClick` párosítása „véletlenül" helyes (`:137` → `hidePopup`). Törékeny, de működik.
**CL-7** — `youtube.js:714-718`: `scroll`/`resize` throttle nélkül hív `positionYtPanel`-t (`getBoundingClientRect` + `style` írás), `capture:true`-val minden görgethető konténerre. **Enyhítés:** a drága ág csak színházi módban fut; a listener-párosítás 3 attach / 3 detach, named reference → **halmozódás megdőlt**.
**CL-8** — `timeupdate` throttle nélkül (~4×/s), de a belső `idx === ytPanelActiveIdx` korai kilépés (`:919-921`) megvédi → **a vád gyakorlatilag megdőlt**; marad a tekerésenkénti O(n) fallback-keresés.
**CL-9** — Hardcode-olt szolgáltatói szelektorok: a **YouTube-ág védett** (`ytCaptionTextSeen` bizonyíték-mechanizmus + 5 s explicit értesítés, `:430-433, 450-464` — példaértékű fail-safe), a **Netflix-ágnak nincs ekvivalense**: a `hideNfxNativeCaptions()` feltétel nélkül fut, és a 4 s-os értesítés szövege félrevezető („Kapcsold be a feliratot a Netflixen"), miközben a valódi ok elavult szelektor lehet.
**CL-10** — `popup.js:134-153`: az induló auth-próba `.then(r => r.json())`-je nincs parse-szinten catch-elve (szemben a `runSearch`-csel, `:1222`), és hibaágon a `csrfToken` `null` marad → félrevezető „munkameneted lejárt" üzenet. **Gyakorlatilag megdőlt:** a `runSearch` mindig lefut a mentés előtt és felülírja a tokent (`:1242-1244`).
**CL-11** — `flashcard-modal.js:8`: az `fcDecksCache` csak `deck_not_found`-ra invalidálódik → pakli-**átnevezés** után a régi név látszik. Kozmetikai.
**CL-12** — `search-modal.js:41-45`: `innerHTML +=` a `<style>` felcsatolása után → a 22 KB-os CSS újraszerializálódik. Működik, de eltér a máshol következetes `appendChild`-mintától.

---

## INFO

- **INFO-1** — `src/page-highlight.js` (636 sor) **holt kód**: sem a manifestben, sem a zipben. A `shared.js:186` kommentje viszont **élőként hivatkozik rá** („ugyanazzal a gesztus-készlettel, mint a weboldal-kiemelésen (page-highlight.js)") → a komment félrevezető.
- **INFO-2** — `background.js`: **0 listener, 0 timer, 0 observer, 0 in-flight Map**. MV3-szempontból ez a helyes minta.
- **INFO-8** — `search-modal.js` és `popup.js` **~200 sor duplikált űrlaplogika**, ami **már divergál**: a popup-változat `irregularCheck.checked = Boolean(...)` (`popup.js:1065`) mindig ír, a modál-változat csak `if (resp.is_irregular)` (`search-modal.js:630-633`) → a modálban egy AI-újralekérés **nem tudja levenni** a rendhagyó-jelölést, a popupban igen.
- **Nyilatkozat-drift (az előző körből, változatlan):** az Adatkezelési tájékoztató 7. pontja még az 1.28-as `<all_urls>` működést vallja be (`privacy.tsx:487-502`), és letagadja a `tw_statusCache`-t (`:533-535`).

---

## Mérten tiszta

### Backend
- **IDOR = 0**, mind a 8 metódus user-szűkített. A `deck_id` nem `find()`-dal, hanem a relációból: `$request->user()->flashcardDecks()->find(...)` → 404 idegen paklira (`:308-312`). A `lookup` custom-ágán az `orWhere` helyesen zárójelezve (`:139-150`), nem lóg ki a user-szűrő alól.
- **Napi extension-keret atomi**: `Cache::add` + `Cache::increment` (`User.php:398-422`), a database store `increment`-je `lockForUpdate`-el fut → nincs TOCTOU. Fail-closed a `$count === false` ágon.
- **Kártyakeret** `Cache::lock`-kal, az extension-út azonos a webessel (`ExtensionController.php:327` ≡ `FlashcardCardController.php:49`).
- **Mass assignment**: a reláció írja a `user_id`-t, a payload `user_id`-je nem is validált. Az `is_imported` szándékosan nincs fillable-ben.
- **PlayerPairing**: `poll_secret` csak SHA-256-ban, egyszer-használatos atomi DELETE-claim (`:146-148`), token `['player']` ability-re szűkítve, jelszóváltáskor visszavonva.

### Megdőlt biztonsági gyanúk (a cáfolat értéke)
- **Guest nem meríti mások throttle-vödrét**: hitelesítve `sha1(user_id)`, guestként `sha1(domain|ip)` — a két kulcstér nem ütközhet (`ThrottleRequests.php:224-233, 340-343`).
- **A `verified` middleware tényleg 403-at ad JSON-nál** (`EnsureEmailIsVerified.php:31-39`), a kliens küldi az `Accept: application/json`-t (`background.js:15`). Mérve: `ExtensionTest.php:743-766` — mindkét író végponton 403, 0 létrejött szó.
- **CSRF-mentes cross-site POST: teszt-artefakt volt** — a `PreventRequestForgery.php:99,130` `runningUnitTests()`-nél kihagyja az ellenőrzést. Élesben a `web` csoport véd, a kliens küldi az `X-CSRF-TOKEN`-t.
- **Player-ability szűkítés működik**: `other`-ability token → 403 mindkét player-végponton.
- **SQL-injekció nincs**: a `whereRaw`-ágakon az oszlopnév kódkonstans, a user-input kötött paraméter, LIKE-metakarakterek `addcslashes`-szel escape-elve.
- **A `?v=` paraméter maximálisan kényszerített**: `^[a-zA-Z0-9_-]{11}$` `trim()` után, 17 bypass-kísérlet mind REJECT (cirill `а`, fullwidth `／`, `\x00`, `\r`, `\n`, path-traversal, query-injekció).
- **TLS-lazítás 0** (`withoutVerifying` grep: 0 találat), **retry-vihar 0**, timeout mind a 6 híváson explicit, **proxy-injekció nem lehetséges** (`HTTP_PROXY` csak CLI-n hat).
- **Hibaüzenet-szivárgás 0**: `{error: "no_captions"}` — semmi célhost/HTTP-státusz/`getMessage()` a partnerről.
- **Cache-poisoning nincs**: a kulcs videó-ID-izolált, poisoninghoz a YouTube válaszát kellene kontrollálni. A negatív cache mint cross-user DoS **nem kihasználható**: csak definitív „nincs felirat"-ra íródik, amit a támadó nem tud kikényszeríteni.
- **`fetch-source` SSRF-guard teljes** (a *másik* ág): `withoutRedirecting()` + hoponkénti `assertPublicHost` + `CURLOPT_RESOLVE` IP-pinning + port-allowlist + méret-sapka. Teszt-fedés: `TextAnalysisTest.php:391-460`.

### Kliens
- **MV3-suspend biztonság**: a `statusCacheMem` storage-backed tombstone-mechanizmussal (`background.js:74-122`) — a SW-leállás nem okoz állapotvesztést. **A „elveszett cache" gyanú megdőlt.**
- **`chrome.runtime.lastError`**: 3/3 hívóhely kezeli. **„Extension context invalidated"**: `extAlive()` try/catch-elt, mind a 4 hosszú életű observer/interval ezzel bontja le magát — rendszerszintű minta.
- **Navigáció-generáció** (`ytNavToken`/`nfxNavToken`) helyesen implementált: minden async init-callback token-ellenőrzéssel kezdődik (5 hely) → A késett átirata nem renderelhet B paneljébe. **Ez a race-osztály lezárva**, kivéve a `ytStatusWaiters`-t (CL-5).
- **`popup.js` keresés-race**: `searchSeq` generáció-számláló, az üres mező is inkrementál — példaértékű.
- **Tokenizálás nem szűk keresztmetszet**: `WeakMap`-cache (`tokenizer.js:11`), feliratkeretenként csak az 1-2 soros szöveg tokenizálódik. **A „minden keretre tokenizál" gyanú megdőlt.**
- **CC-tulajdonjog**: a `ytCcKickPending`/`ytWeEnabledCC` páros mind a 3 kilépési úton visszaadja a natív feliratot a usernek — nem hagy beragadt állapotot.
- **`sanitizeAiHtml`**: allowlist-alapú, `DocumentFragment` + `replaceChildren`, soha nem nyers `innerHTML`.
- **Zip-integritás**: mind a 13 fájl bájtazonos a live forrással.

---

## Teszt-fedettségi hézagok

1. **A caption-láncnak egyetlen SSRF-tesztje sincs** (a `fetch-source`-nak van: `TextAnalysisTest.php:389-460`). Nincs őrszem-teszt arra, hogy a `baseUrl` nem-YouTube hostra ne mehessen → az SSRF-1 esetleges javítása után sem védené semmi a regressziótól.
2. **`CACHE_STORE=array` a tesztekben** (`phpunit.xml:25`) → a `reserveExtensionWrite()` **fail-closed ága soha nem fut le teszt alatt** (`User.php:411-419`). A SEC_AUDIT L2 fix teszt-fedetlen.
3. **Cross-user olvasás nincs őrizve** a `lookup`/`search`/`statuses` custom-ágain: van teszt a saját szó megtalálására, de egy sem arra, hogy más useré NEM jelenik meg. (Az írás-oldali IDOR őrzött.)
4. **`extension/youtube-transcript` + unverified fiók** nincs őrizve egyik irányban sem.
5. **`player/disconnect` nem-PAT auth-ága** (AUTHZ-4) nincs tesztelve.

**Referencia-suite zöld:** `ExtensionTest` + `PlayerWordActionsTest` + `PlayerPairingTest` = **111 teszt / 378 assertion, mind passed.**

---

## Ha javításra kerül sor, ez a sorrend adódik

1. **CL-4** — a `statusSaveInFlight` zár átvitele a `search-modal.js`-be. Legkonkrétabb valós bug, a minta már megvan két másik fájlban.
2. **SSRF-1** — `withoutRedirecting()` a 6 caption-hívásra + őrszem-teszt. Kis diff, megszünteti a partner-integritásra épülő bizalmat.
3. **CL-1 + `b7ac205`** — a Netflix-observer szűkítése a lejátszóra és `innerText` → `textContent`. **Együtt kell a navigáció-észlelés dedikált jelre állításával**, különben elvágja azt.
4. **DOS-1** — circuit breaker a YouTube-hívásokra (az AI-ág mintájára, `912aec8`), vagy a transient ág rövid negatív-cache-e.
5. **CL-3** — a cooldown és az értesítés-timeout összehangolása (9 s vak sáv).
