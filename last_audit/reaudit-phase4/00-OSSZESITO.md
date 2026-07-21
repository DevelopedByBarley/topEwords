# Független újra-audit — Fázis 4 (Külső integrációk & SSRF + Publikus fájl-felület & kliens-kód)

> Készült: 2026-07-20 · a `last_audit/PLAN.md` **CSAK Fázis 4a + 4b** független újra-auditja.
> Módszer: dimenziónkénti párhuzamos finderek (4 agent) + séma-kényszerített leletformátum.
> A finderek **kizárólag a PLAN.md-t** kapták kontextusként; a korábbi audit-riportokat NEM olvasták → teljesen független megerősítés.
> **Csak dokumentálás — kód NEM módosult** (audit-no-fixes szabály).

## Végeredmény

| | HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|---|
| **Fázis 4a — SSRF (`fetch-source`)** | 0 | 0 | 2 | 1 |
| **Fázis 4a — YouTube-lánc** | 0 | 0 | 0 | 5 |
| **Fázis 4b — storage/{path} serve** | 0 | 0 | 0 | 1 |
| **Fázis 4b — backend fájl-feltöltés** | 0 | 0 | 0 | 4 |
| **Fázis 4b — Electron player** | 0 | 0 | 1 | 1 |
| **Fázis 4b — Chrome-extension** | 0 | 0 | 0 | 0 |
| **Fázis 4b — PWA service worker** | 0 | 0 | 0 | 1 |
| **Fázis 4b — public/downloads zip** | 0 | 0 | 0 | 0 |
| **ÖSSZESEN** | **0** | **0** | **3** | **13** |

- **Go-live blokkoló: 0.** HIGH/MEDIUM egy sem → adverzariális verifikátor-kör nem indult (a workflow szerint az csak HIGH/MEDIUM-gyanúra jár; a 3 LOW egykörös finder-verdikttel zárt, mindegyik CONFIRMED).
- A PLAN.md két legnagyobb feltételezett rése **NEM áll fenn**:
  - a `storage/{path}` middleware-nélküli GET+PUT serve **le van kapcsolva** (`serve=false`, 0 regisztrált route);
  - a PWA `sw.js` **self-destruct tombstone** (nincs fetch/cache handler) → a cache-leak/stale-cache/külső-font aggály tárgytalan.

---

## A 3 LOW lelet

### SSRF-1 — CGNAT-tartomány (100.64.0.0/10) nem blokkolt
- **Fájl / sor:** `app/Http/Controllers/TextAnalysisController.php:227-235` (`assertPublicHost` IP-validáció)
- **Súlyosság:** LOW · **Verdikt:** CONFIRMED reachable (finder + saját inline reprodukció is megerősítette)
- **Forgatókönyv:** `POST fetch-source url=http://100.64.0.1/` → `parse_url` a csupasz IP-t adja → `filter_var(..., NO_PRIV_RANGE|NO_RES_RANGE)` **PUBLIC-nak** minősíti (a PHP beépített flagek nem fedik a 100.64/10 CGNAT-sávot) → a guard átengedi, a szerver GET-eli. Egyes felhő-/overlay-hálózatokon (pl. Tailscale `100.64/10`) belső szolgáltatás elérhető a szerver forrás-IP-jéről.
- **Miért LOW:** hitelesített + `throttle:30/perc` mögött; hatás erősen deployment-függő (egyszerű VPS-en a 100.64/10 nem routolható belső célra); a response-body szöveggé konvertálódik (nincs nyers bináris/JSON exfiltráció); a **cloud-metadata `169.254.169.254` külön BLOKKOLT** (megerősítve). Megfontolható a `100.64.0.0/10` (+ teljesség kedvéért `0.0.0.0/8`) explicit denylistelése.
- **Saját keresztellenőrzés (inline PHP):** `100.64.0.1 / 100.127.255.255` → `PASS(reachable)`; `169.254.169.254 / 10.0.0.1 / 192.168.1.1 / 0.0.0.0 / 127.0.0.1` → `blocked`. A finder mérése pontos.

### SSRF-3 — YouTube caption-`baseUrl` letöltése guard/pinning nélkül
- **Fájl / sor:** `app/Services/YouTubeCaptionService.php:384-406` (`fetchCaptionBody`, hívva 259/348-ból)
- **Súlyosság:** LOW · **Verdikt:** CONFIRMED gap, de NEM támadó-vezérelt
- **Forgatókönyv:** a caption `baseUrl` a YouTube saját JSON-válaszából jön, majd sima `Http::get($url)` tölti le — `assertPublicHost` nélkül, `CURLOPT_RESOLVE` IP-pinning nélkül, redirect-követéssel. Csak transport-kompromittálás (MITM / DNS-poisoning / YouTube-oldali kompromittálás) mellett irányítható belső URL-re; a user csak a 11-karakteres videoId-t adja. HTTPS mérsékli. Defense-in-depth: itt is jó lenne `assertPublicHost`+pinning vagy host-allowlist (`*.youtube.com`, `*.googlevideo.com`).

### EL-1 — Electron macOS build ad-hoc aláírás (nincs Developer ID / notarizáció / hardened runtime)
- **Fájl / sor:** `topwords-player/scripts/adhoc-sign.js:29-38`, `package.json` (nincs `mac.hardenedRuntime`/entitlements/notarize)
- **Súlyosság:** LOW · **Verdikt:** CONFIRMED (tudatosan dokumentált go-live teendő, nem kód-hiba)
- **Forgatókönyv:** a macOS build `codesign --sign -` (ad-hoc) — nem hitelesít fejlesztőt, nem old Gatekeepert, hiányzik a hardened runtime + notarizáció. Kompromittált letöltési csatorna manipulált binárist adhat. **Nem request-triggerelhető seb;** terjesztési/ops hardening, éles nyilvános terjesztés előtti Developer ID + notarizáció teendő (a script fejléc-kommentje maga is jelzi).

---

## A 13 INFO (tiszta) tétel — dimenziónként

### Fázis 4a — SSRF (`fetch-source`) [1 INFO]
- **SSRF-2 (INFO):** faux-YouTube URL (`http://169.254.169.254/youtube.com/watch?v=...`) átugorja az `assertPublicHost`-ot, de **ártalmatlan**: ha `videoId !== null`, a `fetchTranscript($videoId)` fut (nem `fetchWebpageText($url)`), a támadó hostja eldobódik, a letöltés hardcode-olt `https://www.youtube.com`-ra megy 11-char videoId-vel. Törékenységi megjegyzés: jövőbeli refaktor, ami ebben az ágban az eredeti `$url`-t használná, teljes SSRF-t nyitna → host-horgonyzott videoId-kinyerés robusztusabb lenne.
- **TISZTA vektorok (adverzariálisan reprodukálva, fail-closed):** IPv6-literál / IPv4-mapped IPv6 (`[::ffff:169.254.169.254]`), redirect-lánc per-hop host-revalidáció, DNS-rebinding (valódi `CURLOPT_RESOLVE` pinning — TOCTOU zárva), séma-szűrés (`file/gopher/dict/ftp/data` két rétegen tiltott), relatív redirect resolve, octal/decimal/hex IP-kódolás, privát/reserved IP-k (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16 metadata, 0.0.0.0), userinfo-trükk (`http://expected.com@169.254...`), kétrétegű `MAX_FETCH_BYTES` (menet közbeni progress-callback), port-allowlist `[80,443,8080,8443]` minden hopra.

### Fázis 4a — YouTube-lánc [5 INFO]
- **YT-1:** tranziens vs. permanens hiba-kezelés helyes — negatív cache nem mérgezhető (`TransientCaptionException` nem cache-elődik, csak a definitív `RuntimeException` kap 15p negatív cache-t).
- **YT-2:** parsing-injection (XXE / entity-expansion / stored-XSS) kizárva — **nincs egyetlen XML-parser sem** a láncban (regex + `strip_tags` + `html_entity_decode` + `json_decode`); a kimenet React text-node (auto-escape).
- **YT-3:** méret/cost-plafon kétrétegű — 8 MB letöltési sapka (curl-progress) + 12 MB tömörített tárolási sapka + `MAX_OVERVIEW_CHARS` 2M + napi AI-keret.
- **YT-4:** IDOR = 0 — mind a 3 YouTube- és mind a 3 könyv-metódus `abort_unless($x->user_id === user()->id, 403)`; overview-cache user-taggelt (`:u{id}`).
- **YT-5:** video-ID SSRF kizárva — 11-karakteres regex-kapu (`[a-zA-Z0-9_-]{11}`) + fix `www.youtube.com` host; a general web-fetch külön teljes SSRF-védelemmel.
- *(Kiegészítő megfigyelés, nem lelet):* nincs unique constraint `(user_id, video_id)`-re → ugyanaz a videó többször menthető, de a plan-limit korlátozza (csak kvóta-fogyás, nincs biztonsági hatás).

### Fázis 4b — storage/{path} serve [1 INFO]
- **STOR-1:** a PLAN által feltételezett middleware-nélküli storage-serve **NEM aktív**. `config/filesystems.php:39` `'serve' => false` (explicit kommenttel); `route:list --path=storage` = 0 route (165-ből egy sem); nincs `LocalController`/`ServeFile`/`Storage::serve` regisztráció; funkcionális igény sincs (`disk('local')`/`temporaryUrl` = 0 használat). Path-traversal / arbitrary-write / anonim-hozzáférés mind moot — nincs végpont.
- *(Saját inline keresztellenőrzés is megerősítette: `route:list --path=storage` = nincs találat, `serve => false`.)*

### Fázis 4b — backend fájl-feltöltés [4 INFO]
- **UP-1:** CSV-import validáció + streamelt `fgetcsv` (nincs OOM) + `MAX_IMPORT_ROWS=5000` + `MAX_FIELD_LENGTH=10000` + ownership-kapu + keret-zár.
- **UP-2:** CSV-export formula-injection escape **teljes** — mind a 4 veszélyes prefix (`= + - @`) `'`-prefixszel semlegesítve, `"`-duplikálással.
- **UP-3:** EPUB-feltöltés — zip-bomba a kicsomagolás **előtt** eldől (`statName` méret-ellenőrzés + kumulatív 40 MB stop), spine-plafon (500) + dedup a CPU-DoS ellen, `normalizePath` a `..`-ra, `mimetypes`+`extensions`+`max` validáció. (PDF tudatosan kivezetve.)
- **UP-4:** feltöltött fájl NEM perzisztálódik lemezre (PHP-tmp `getRealPath`, request végén törlődik; nincs `store()`/`storeAs()`/`move()`) és NEM publikus — csak a gzip-elt szöveg megy a DB-be, ownership-kapuzott route-ok mögé.

### Fázis 4b — Electron player [1 INFO]
- **EL-2 (INFO):** CSP nincs explicit `script-src`/`connect-src`, de `default-src 'self'` funkcionálisan lefedi (inline script tiltva) — kozmetikai szigorítási lehetőség.
- **TISZTA (7 dimenzió):** `contextIsolation:true`+`nodeIntegration:false`+`sandbox:true`; `setWindowOpenHandler=deny` + `will-navigate=preventDefault`; token `safeStorage`-titkosítva (0600, plaintext-mentes); `shell.openExternal` origin-allowlist-kapuzott (`isOwnUrl`); **nincs deep-link/protocol-handler felület**; IPC szűk + minden handler `isTrustedSender` + típus/hossz/whitelist-validáció; fájl-betöltés natív-dialógus-allowlistre szűkítve; renderer 0 hálózati hívás; AI-HTML allowlist-sanitizer (`sanitizeAiHtml` + `replaceChildren`).

### Fázis 4b — Chrome-extension [0 lelet, TISZTA]
- Sender-guard megvan (`sender.id !== chrome.runtime.id`); **nincs `postMessage`-fogadó, nincs `externally_connectable`/`onMessageExternal`** → web-origin nem éri el a hátteret; M2 `isTrusted` guard **nem regresszált** (minden felhasználói eseménykezelő `if (!e.isTrusted) return;`); permissions szűk (`activeTab, contextMenus, storage`, `host_permissions: https://topwords.eu/*`); **nincs tárolt bearer-token** (cookie-alapú + kérésenkénti CSRF), `tw_statusCache` 401-re törlődik; minden szerver/AI-adat `esc()` vagy allowlist-`sanitizeAiHtml`. Verzió 1.21.

### Fázis 4b — PWA service worker [1 INFO]
- **SW self-destruct tombstone** — csak `install`(skipWaiting) + `activate`(minden cache törlése + `unregister()` + fülek újratöltése); nincs `fetch`/`NetworkFirst`/`CacheFirst`/`message` handler; nincs élő `serviceWorker.register` a `resources/`-ban; `offline.html`/`registerSW.js`/`manifest.webmanifest` nem áll elő. → a cache-leak/stale-cache/külső-font aggály mind tárgytalan.
- **INFO:** `resources/js/vite-env.d.ts:2` elárvult `/// <reference types="vite-plugin-pwa/client" />` — kozmetikai holt típus-ref, nincs biztonsági hatás.

### Fázis 4b — public/downloads zip [0 lelet, TISZTA]
- A kiszolgált `public/downloads/topwords-extension.zip` **byte-azonos** a `chrome-extension/` forrással (mind a 17 fájl diff-azonos, verzió 1.21 mindkét oldalon — nincs kiadás-drift). Nincs dev-maradvány (`.DS_Store`/`.git`/`.map`/`.env`/kulcs/token), nincs `console.log`/`debugger`/`TODO`, nincs hardcoded titok/dev-URL — csak legitim prod-végpontok (`topwords.eu`, google/youtube/netflix). A PLAN-ben említett *kicsomagolt könyvtár* nem létezik, csak a zip.

---

## Nem-kód megfigyelések (dokumentálva, a no-fix elv szerint NEM végrehajtva)

- **Teszt-lefedettségi hézag (SSRF):** a meglévő tesztek fedik a private-IP / redirect-internal / port / méret eseteket, de **nincs teszt** IPv6-mapped, CGNAT (100.64/10), decimal/octal, vagy faux-YouTube-guard-skip vektorokra. Regressziós tesztek felvétele javasolt — de csak a felhasználó jóváhagyásával (audit-no-fixes).
- **Megfontolható defense-in-depth (mind opcionális, LOW):** `100.64.0.0/10` (+ `0.0.0.0/8`) explicit denylist a `assertPublicHost`-ban (SSRF-1); host-horgonyzott videoId-kinyerés (SSRF-2); `assertPublicHost`+pinning vagy host-allowlist a caption-`baseUrl`-re (SSRF-3); Developer ID + notarizáció + hardened runtime a player go-live-hoz (EL-1).

## Összevetés a korábbi audittal

Ez a kör **függetlenül** (csak PLAN.md alapján) futott. Az összevetést a korábbi Fázis 4 riporttal a felhasználó végzi el — a fő tartalmi egyezés-jelöltek: PDF-kivezetés (UP-3), storage `serve=false` döntés (STOR-1), M2 isTrusted extension-guard (Chrome-extension dimenzió). Regresszió egyik korábbi zárt tételhez képest sem merült fel.
