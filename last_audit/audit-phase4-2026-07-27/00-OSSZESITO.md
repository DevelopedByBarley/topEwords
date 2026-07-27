# Fázis 4 audit — összesítő (2026-07-27)

> `last_audit/PLAN.md` **Fázis 4a (Külső integrációk & SSRF)** + **Fázis 4b (Publikus fájl-felület & kliens-kód)** teljes újra-auditja.
> Módszer: 6 párhuzamos finder-dimenzió, séma-kényszerített leletformátum, majd **adverzariális verifikáció** minden
> MEDIUM-gyanús leletre (eltérő lencsés verifikátorok, cáfolásra promptolva, `refuted=true` default, többségi szavazat).
> **Csak dokumentálás — kód NEM módosult** (audit-no-fixes szabály). A `PLAN.md` sem szerkesztve.

---

## Végeredmény

| Dimenzió | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|
| **A** — SSRF `fetch-source` (4a/1) | 0 | 0 | 4 | 6 |
| **B** — YouTube caption-lánc + `UserBook` IDOR (4a/2) | 0 | 0 | 2 | 6 |
| **C** — `storage/{path}` + fájl-feltöltés (4b/1-2) | 0 | 0 | 3 | 6 |
| **D** — Electron player (4b/3) | 0 | 0 | 4 | 9 |
| **E** — Chrome extension + publikus forrás (4b/4, 4b/6) | 0 | 0 | 3 | 6 |
| **F** — PWA service worker (4b/5) | 0 | 0 | 1 | 5 |
| **ÖSSZESEN** | **0** | **0** | **17** | **38** |

### Go-live blokkoló: 0

**A kör MEDIUM nélkül zárt** — de nem azért, mert nem volt gyanú: **két lelet indult MEDIUM-ként**, és mindkettőt
az adverzariális kör minősítette le. Ez a kör legfontosabb eredménye, részletesen: `07-verifikacios-naplo.md`.

| Lelet | Finder | Verifikátorok | Végső | Mi dőlt meg az indoklásból |
|---|---|---|---|---|
| **EXT-M1** `shared.js` hiányzó `isTrusted` | MEDIUM | **3/3 LOW** | **LOW** | a **„regresszió" címke** (git-bizonyíték) **és** a feltételezett SRS-adatvesztés |
| **SSRF-A1** CGNAT/multicast range-rés | MEDIUM | **2/2 LOW** | **LOW** | a **„full-read SSRF"** minősítés **és** a multicast-vektor (empirikusan `rc=7`) |

---

## A két súlyosság-vita dióhéjban

### EXT-M1 — `chrome-extension/src/shared.js:247,278` → **LOW**

A friss (1.24) felirat-gyorsgesztus `mousedown`/`dblclick` ága nem ellenőrzi az `event.isTrusted`-et, míg a `click`-ág igen.
A `mode:'open'` shadow root miatt a támadás **működik** — sőt könnyebb, mint a finder leírta (a listener a shadow rooton
*belüli* elemen ül; a `mousedown`-ág `mouseup` nélkül 500 ms múlva magától tüzel), és sem a `sender.id`-guard, sem a CSRF nem
állítja meg (a saját content script küldi, a tokent a background maga szerzi be).

**Mégis LOW**, mert a hatás szűk: kizárólag a felhasználó **saját, már meglévő** szavainak státusza írható át
(self-only, enum-validált, `throttle:60,1,word-writes`, a UI-ban látható, kézzel javítható). A reális támadó-modell egyetlen
nem-degenerált eleme egy **előre telepített ellenséges user-script** — a hirdetés-iframe cross-origin miatt kiesik, egy
rosszindulatú kiterjesztés ellen pedig az `isTrusted` amúgy sem érdemi védelem.

> **⚠️ A „regresszió" minősítés MEGDŐLT.** A `git log -S` szerint az `attachCaptionWordGestures` **és** a benne lévő egyetlen
> `isTrusted`-sor **ugyanabban a commitban** (`fbf4405`) született, tiszta **+162 soros beszúrásként, 0 törléssel**.
> Guardot senki nem távolított el; a korábbi M2-fix a `lookup-popup.js`/`page-highlight.js` felületein **ma is ép**.
> Ez **új felület hiányzó guarddal**, nem visszaesés. → lásd a „Regressziók" szakaszt.

**Fix-érték:** a LOW ellenére kiugró ár-érték arányú — egyetlen `if (!e.isTrusted) return null;` a `wordSpanFromEvent`-ben
(a `page-highlight.js:247` **saját, meglévő** centralizált mintája szerint) mind a három ágat lefedi.

### SSRF-A1 — `TextAnalysisController.php:233` → **LOW** (a 2026-07-20-i verdikt helybenhagyva)

A `filter_var(NO_PRIV_RANGE|NO_RES_RANGE)` valóban átengedi a CGNAT `100.64.0.0/10`, a `198.18.0.0/15` és a `224.0.0.0/4`
tartományt (empirikusan reprodukálva). **De nincs elérhető cél**: egygépes Rackhost VPS, minden backend `127.0.0.1`-en,
és **nincs overlay-hálózat** (Tailscale/WireGuard/Docker) nyoma sehol a repóban — a finder Tailscale-érve hipotetikus, nem
e deployment tulajdonsága. A multicast empirikusan `rc=7` **t≈0.001s** alatt (TCP-handshake multicast célcímre fogalmilag
lehetetlen), a `198.18/15` `rc=56`.

A „full-read" minősítést a védelmi lánc többi rétege is cáfolja: **port-allowlist** `[80,443,8080,8443]` hoponként
újraellenőrizve (Redis/Postgres/memcached/Docker-API/Kubelet elérhetetlen, két teszt igazolja), kétrétegű séma-szűrés
(gopher→Redis→RCE kizárva), `Content-Type`-kapu + `strip_tags` + **a 35 karakternél rövidebb sorok eldobása** → egy bináris
vagy soralapú protokoll-válasz megsemmisül. Csak GET, fix User-Agent, nulla támadó-vezérelt fejléc.

**Amit a lelet életben tart (LOW, nem INFO):** a védelem **környezet-független invariánsnak látszik, miközben nem az** —
egy hoszting-váltás némán rést nyithat. Defense-in-depth: explicit CIDR-denylist, vagy pozitív „globálisan routolható
unicast" ellenőrzés. **Újraértékelendő a tervezett új gépre költözéskor.**

---

## Megdőlt PLAN-feltevések (19 db)

A PLAN 2026-07-17-i állapotot tükröz; az alábbi pontok tárgya **már nem létezik vagy nem úgy van**. Ezek értékes leletek.

### Fázis 4a
1. **„IPv6 / IPv4-mapped IPv6 bypass"** → nem áll fenn: a `parse_url` bracket-megtartása + a `gethostbyname`
   IPv6-inkompatibilitása miatt **minden IPv6 blokkolt**. ⚠️ *Járulékosan, nem szándékosan — és nincs teszt, ami őrizné.*
2. **„a video-ID ág megkerüli a host-ellenőrzést"** → megkerüli, de **ártalmatlan**: csak 11 karakteres ID jut át, a cél
   hardcode-olt `youtube.com`.
3. **„`MAX_FETCH_BYTES` csak utólag vág"** → **menet közben szakít** (`CURLOPT_PROGRESSFUNCTION`); hamis `Content-Length`
   sem kerüli meg.
4. **„`CURLOPT_RESOLVE`: csak első feloldás?"** → **valódi pinnelés**, valós curl-hívással igazolva: a DNS-t teljesen
   kiiktatja → rebinding és round-robin hatástalan.

### Fázis 4b
5. **`storage/{path}` GET+PUT route létezik és middleware nélküli** → **nem létezik**; `route:list | grep -i storage` üres,
   `config/filesystems.php:39` `'serve' => false` (kommentelt, tudatos döntés).
6. **CSV formula-injection nyitott az exporton** → **zárt** mind a 4 prefixre (`FlashcardCsvController.php:200`),
   round-trip empirikusan igazolva.
7. **EPUB zip-bomba: nincs kicsomagolás előtti méret-ellenőrzés** → **van**: `statName()` a `getFromName()` **előtt**,
   + kumulatív 40 MB stop + 500 spine-cap + dedup + 10 MB kimenet-cap.
8. **PDF-feltöltés él (pdfparser)** → **kivezetve**; `smalot/pdfparser` nincs a `composer.lock`-ban.
9. **„a `TextAnalysisController:1611` fájl-feltöltés"** → a valódi hely `:1662-1743` (`uploadBook`).
10. **`.php`/`.html` átcsúszhat CSV-ként és web-elérhetővé válhat** → kettősen kizárt: `mimes:csv,txt`, és **a fájl nem is
    kerül lemezre**.
11. **Electron: deep-link/protocol-handler injection** → **nincs támadási felület**: `setAsDefaultProtocolClient`,
    `open-url`, `second-instance`, argv-parsing, `build.protocols` — egyik sem létezik.
12. **Electron: auto-update aláírás/feed** → **nincs updater**: sem `electron-updater`, sem `autoUpdater`, sem
    `build.publish`. *(Az aláírás-hézag viszont valós — EL-L3.)*
13. **`public/downloads/topwords-extension/` publikusan szolgált könyvtár** → **nem létezik** (az `1e81725` commit vezette ki).
    A terjesztés ma **auth mögötti stream** privát diskről (`DownloadController`, slug-allowlist, `auth`+`verified`+throttle);
    `public/storage` symlink sincs, a `.htaccess` tiltja a könyvtárlistázást.
14. **PWA: `public/sw.js` + workbox** → nincs workbox, `vite-plugin-pwa` sincs a `package.json`-ban.
15. **PWA: `offline.html` + `build/registerSW.js`** → **mindkettő törölve**.
16. **PWA: `NetworkFirst` „pages-cache" HTML-t cache-el** → **eltávolítva**. *(A PLAN a múltbeli állapotra pontos volt —
    a régi kód valóban denylist nélkül cache-elt.)*
17. **PWA: `SKIP_WAITING` flow + elavult precache + `fonts.bunny.net` CacheFirst** → mind eltávolítva.
18. **Implicit: „a projekt PWA"** → **már nem az**; `manifest.webmanifest` nincs, `navigator.serviceWorker` nulla találat.
19. **Extension: „az M2 `isTrusted`-guard regresszált-e"** → **nem regresszált** (git-bizonyíték, lásd fent). A PLAN
    regresszió-feltevése megdőlt; helyette **új felületen** hiányzik a guard.

---

## Regressziók

**Klasszikus regresszió (korábban tiszta → most nem): 0.**

A leggyanúsabb jelölt az extension **1.21 → 1.24** ugrása volt (új felirat-gyorsgesztus, közös `shared.js` kezelő), és a
finder valóban „részleges regressziót" jelentett. **A verifikáció ezt git-bizonyítékkal megdöntötte**: `fbf4405` tiszta
beszúrás, 0 törlés; a `shared.js` teljes történetében soha nem volt más `isTrusted`-előfordulás; a korábban javított
felületek (`lookup-popup.js:14,73`, `page-highlight.js:247`) **ma is védettek**.

**Az új felület viszont hiányos védelemmel született** — ez nem regresszió, de a tanulság ugyanaz: a `page-highlight.js`
centralizált mintáját az új kódút nem vette át. *(Ez az egyetlen olyan pont a körben, ahol a kódbázis a saját, bevált
konvenciójától tért el.)*

### Az előző kör (2026-07-20) 3 LOW leletének mai állapota

| Lelet | 2026-07-20 | Ma | Megjegyzés |
|---|---|---|---|
| **SSRF-1** CGNAT `100.64/10` | LOW | **NYITVA** (SSRF-A1, LOW) | verdikt **helybenhagyva** 2/2 szavazattal; a mostani kör kiterjesztette `198.18/15` + `224/4` + NAT64-re |
| **SSRF-3** caption-`baseUrl` guard nélkül | LOW | **NYITVA** (YT-1, LOW) | változatlan; továbbra sem támadó-vezérelt (a `baseUrl` a YouTube JSON-jából jön) |
| **EL-1** macOS ad-hoc aláírás | LOW | **NYITVA** (EL-L3, LOW) | **kiterjesztve**: a Windows-build teljesen aláíratlan, és auto-update sincs → kiadott példány nem javítható |

Egyik korábbi LOW sem záródott le — mindhárom tudatosan vállalt, ops/terjesztés-oldali maradék.

---

## A 17 LOW lelet dimenziónként

**A — SSRF (4):** `SSRF-A1` CGNAT/benchmark/multicast range-rés *(finder MEDIUM → 2/2 LOW)* · `A2` full-read proxy-jelleg
publikus hostokra (a végpont rendeltetése) · `A3` hibaüzenet-orákulum a pontos HTTP-státuszkódból (`:665`) · `A4` multicast
átengedése külön mechanizmusként.

**B — YouTube-lánc (2):** `YT-1` caption-`baseUrl` letöltése `assertPublicHost`/pinning nélkül *(nem támadó-vezérelt)* ·
`YT-2` **ÚJ**: az extension YouTube-végpontja (`routes/extension.php:30`) semmilyen csomag- vagy napi kvótát nem ismer
— kvóta-aszimmetria a webes úthoz képest.

**C — fájl-felület (3):** `CSV-C1` ISO-8859-2 ékezet-torzulás importnál · `CSV-C2` ellenőrizetlen `fopen()` visszatérési
érték · `EPUB-C1` a kumulatív méret-stop sorrendje.

**D — Electron (4):** `EL-L1` a `seek`/`set-speed`/`set-*-track` IPC-handlerek típus-/tartomány-validáció nélkül *(mpv
argv-alapú, nincs shell → korlátozott)* · `EL-L2` hiányzó `form-action` a CSP-ben *(a `will-navigate` guard függetlenül
blokkol)* · `EL-L3` macOS ad-hoc aláírás + **aláíratlan Windows-build** + nincs auto-update · `EL-L4` Electron 33 kifutott ág
*(enyhítő: `sandbox:true`)*.

**E — extension (3):** `EXT-M1` hiányzó `isTrusted` a felirat-gesztuson *(finder MEDIUM → 3/3 LOW)* · `EXT-L1` a content
scriptek `<all_urls>`-en futnak *(a `host_permissions` szűk marad)* · `EXT-L2` 5 régi verziójú zip (1.19–1.23) a repóban
— nem szolgált, de javított hibák forrását őrzi.

**F — PWA (1):** árva `pwa-192.png`/`pwa-512.png` manifest nélkül — fingerprint + karbantartási zaj, adat nem szivárog.

---

## Kihagyott (kivezetett) pontok

A Fázis 4 szakasz **egyetlen** kivezetett feature-re sem hivatkozik (kvíz, cloze, rendhagyó igék, szabad írás,
`ReviewController`) — kihagyásra nem volt szükség. A PDF-feltöltés kivezetése viszont érintette a 4b/2 pontot: ez a
**megdőlt PLAN-feltevések** közt szerepel (8. tétel), nem kizárásként.

Az `is_irregular` mező és az igealakok a parancs kikötése szerint **normál auditálási körben** maradtak (a C és E dimenzió
érintette őket a szó-felviteli és CSV-utakon) — nincs rájuk lelet.

---

## Nyitott, döntést igénylő tételek

Sorrend a javasolt figyelem szerint. **Fix egyikre sem történt.**

1. **EXT-M1 `isTrusted`-guard** — LOW, de egysoros fix, ami a kódbázis saját mintáját állítja helyre. A legjobb ár-érték
   arányú tétel a körben.
2. **`EL-L3` aláírás** — go-live/terjesztési kérdés: Developer ID + notarizáció (macOS), Windows code signing. Auto-update
   hiányában **kiadott példány nem javítható** — ez a súlyosabbik fele.
3. **`YT-2` kvóta-aszimmetria** — az extension YouTube-végpontja megkerüli a csomag-limitet. Üzleti döntés, nem biztonsági.
4. **`SSRF-A1` CIDR-denylist** — ma ártalmatlan, de a **hoszting-váltás kapufeltétele** legyen. Teszt-hézag is tartozik hozzá
   (CGNAT-vektorra nincs teszt).
5. **PWA-visszatérés kapufeltétele** — ha a PWA valaha visszajön, az authentikált válaszokra kell `Cache-Control: no-store`
   (ma a `SecurityHeaders` middleware nem állít ilyet; jelenleg nem kockázat, mert a SW nem cache-el).
6. **`EL-L4` Electron 33 → támogatott ág** — karbantartási ütemezés kérdése.
7. **Teszt-hézagok** *(megfigyelés, nem lelet)*: az IPv6-blokkolás **járulékos** és nincs teszt, ami őrizné; a content
   scriptekre nincs JS-teszt-infrastruktúra (`isTrusted`/`QUICK_STATUS` őrszem-teszt nincs).

---

## Fájlok

| Fájl | Tartalom |
|---|---|
| `00-OSSZESITO.md` | ez a dokumentum |
| `01-dim-A-ssrf.md` | SSRF `fetch-source` — 11 bypass-vektor egyenként, empirikusan verifikálva |
| `02-dim-B-youtube-lanc.md` | YouTube caption-lánc + `UserBook` IDOR-tábla (10/10 action CLEAN) |
| `03-dim-C-fajl-felulet.md` | `storage/{path}` + CSV/EPUB feltöltés-export |
| `04-dim-D-electron-player.md` | Electron player — 12 pontos hardening-mátrix |
| `05-dim-E-chrome-extension.md` | Chrome extension 1.24 + publikus extension-forrás |
| `06-dim-F-pwa-sw.md` | PWA service worker (tombstone-verifikáció) |
| `07-verifikacios-naplo.md` | **a két súlyosság-vita teljes útja** — finder-verdikt → lencsénkénti verifikátor-érvelés → döntés |
