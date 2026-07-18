# Fázis 4 — Külső integrációk & SSRF (4a) + Publikus fájl-felület & kliens-kód (4b) — audit

> Készült: 2026-07-18 · a go-live előtti utolsó, teljes lefedettségű audit külső-integrációs és kliens-oldali köre.
> Fókusz: valós, kihasználható vagy valós reziliencia-/helyességi kockázat a szerver-oldali külső letöltésekben (SSRF, YouTube-lánc) és a publikusan szolgált fájl-/kliens-felületeken (storage-serve, fájl-feltöltés, Electron player, Chrome-extension, PWA service worker).
> Módszer: **multi-agent workflow** — 7 dimenzió-finder párhuzamosan, majd minden HIGH/MEDIUM-gyanús leletre **2–3 független, cáfolásra promptolt adverzariális verifikátor** (korrektség / kihasználhatóság / reprodukció nézőpont), LOW/INFO-ra egykörös. Séma-kényszerített leletformátum (fájl, sor, súlyosság, forgatókönyv, kód-bizonyíték, verifikációs verdikt). **Csak dokumentálás — kód nem módosult.**
> Futás: 36 agent, 0 hiba, 25 nyers lelet, ~1,78 M subagent-token, 467 tool-hívás.

## Lefedett dimenziók (7)

**Fázis 4a — külső integrációk:**
1. **ssrf-fetch-source** — a `text-analysis/fetch-source` SSRF-felület megkerülhetetlensége: DNS-rebinding, redirect-lánc, IP-formátumok, séma-szűrés, méret-guard, port-kezelés.
2. **youtube-caption** — `YouTubeCaptionService` / `YoutubeTranscript` / `UserBook` lánc: külső API-hiba, parsing-injection, méret/cost-plafon, IDOR, cache-izoláció.

**Fázis 4b — publikus fájl-felület & kliens-kód:**
3. **storage-serve** — `storage/{path}` GET+PUT vendor-route (`serve: true`): auth, path-traversal, tetszőleges olvasás/írás.
4. **file-upload-csv** — `FlashcardCsvController` + `TextAnalysisController` könyv-feltöltés: MIME/méret-validáció, CSV-injection, memória-robbanás.
5. **electron-player** — `topwords-player` main/preload/auth-store: contextIsolation, `shell.openExternal`, deep-link, IPC-felület, token-tárolás.
6. **chrome-extension** — `background.js` + content-scriptek: `onMessage` origin-ellenőrzés, `isTrusted`-guard, manifest-jogosultságok, DOM-injekció.
7. **pwa-downloads** — `public/sw.js` workbox-cache (pages-cache, fonts-cache, SKIP_WAITING) + `public/downloads/` publikusan szolgált tartalom.

---

## Összegzés

| Súlyosság | Db | Valós (CONFIRMED/PARTIAL) leletek |
|---|---|---|
| **HIGH** | **0** | — |
| **MEDIUM** | **1** | UPLOAD-PDF-1 (PDF-parse OOM a sapka előtt) |
| **LOW** | **7** | SSRF-LOW-2 · CAP-1 · CAP-2 · EXT-ISTRUSTED-1 · SW-2 · SW-3 · DL-1 |
| **INFO** | **14** | lásd lentebb |
| **REFUTED / DROP** | **3** | SW-1 · SW-4 · TOKEN-1 (verifikáció megdöntötte) |

**Go-live blokkoló: NINCS. Nulla HIGH.**

Az egyetlen MEDIUM (**UPLOAD-PDF-1**) valós, de **nem cross-user, nem RCE, nem adat-hozzáférés** — szolgáltatás-reziliencia (worker-OOM) auth+verified+throttle mögött. A három verifikátor 1 CONFIRMED/MEDIUM + 1 PARTIAL/MEDIUM + 1 PARTIAL/LOW szavazattal MEDIUM alsó élén tartotta.

### A két legfontosabb pozitív megállapítás

A terv a Fázis 4-et két konkrét gyanúra építette; **mindkettő megdőlt a kódon**:

1. **`storage/{path}` (GET+PUT) NEM auth nélküli fájl-olvasás/írás.** A route valóban middleware nélkül van regisztrálva, de a védelem a vendor-kontrollerben van: mindkét belépő **kötelező HMAC signed-URL ellenőrzést** végez (`abort_unless(hasValidSignature(...))`) még a fájlrendszer megérintése előtt, mert a `local` disknek nincs `visibility` kulcsa → `private`. A path-traversalt ezen felül a Flysystem `PathTraversalDetected` fogja meg → 404. A `storage/app/private` ráadásul gyakorlatilag üres. **(STORAGE-INFO-1/2/3)**

2. **Az SSRF-védelem a fő letöltési úton megkerülhetetlen.** A `safeFetch` **minden redirect-hopnál** újra validál (`assertPublicHost`) és **CURLOPT_RESOLVE-val a bevalidált IP-re pinnel**, `withoutRedirecting()` mellett manuálisan követve a redirecteket — így nincs check-vs-connect rés (DNS-rebinding zárva). A verifikátorok konkrétan tesztelték: loopback / 0.0.0.0 / metadata (169.254.169.254) / privát tartományok / oktális / decimális IP / `file://`,`gopher://`,`dict://`,`ftp://` sémák **mind blokkoltak**. **(SSRF-INFO-1/2/3)**

---

## Összegző tábla (CONFIRMED / PARTIAL leletek)

| id | súlyosság | cím | fájl:sor | verdikt (szavazat) |
|---|---|---|---|---|
| UPLOAD-PDF-1 | **MEDIUM** | PDF-parse a memória-sapka ELŐTT fut → worker-OOM preparált PDF-fel | [TextAnalysisController.php:1762](../app/Http/Controllers/TextAnalysisController.php#L1762) | PARTIAL (1 CONFIRMED/MED, 1 PARTIAL/MED, 1 PARTIAL/LOW) |
| SW-2 | **LOW** | Elavult, működésképtelen service worker deploy-olva (build-drift) | [public/sw.js:1](../public/sw.js#L1) | CONFIRMED (1/1) |
| EXT-ISTRUSTED-1 | **LOW** | YT/Netflix feliratsáv kattintás-kezelők `isTrusted`-guard nélkül, open shadow DOM-ban | [chrome-extension/src/youtube.js:269](../chrome-extension/src/youtube.js#L269) | CONFIRMED (1/1) |
| CAP-1 | **LOW** | `storeYoutube`: nincs méret-sapka a MEDIUMBLOB-ba írás előtt → kezeletlen 500 | [TextAnalysisController.php:1520](../app/Http/Controllers/TextAnalysisController.php#L1520) | CONFIRMED (1/1) |
| CAP-2 | **LOW** | YouTube-letöltéseknek nincs byte-sapkája (a `safeFetch`-guard nélkül) | [YouTubeCaptionService.php:249](../app/Services/YouTubeCaptionService.php#L249) | CONFIRMED (1/1) |
| SSRF-LOW-2 | **LOW** | Nincs port-allowlist a `safeFetch`-ben → korlátozott publikus port-szkennelés | [TextAnalysisController.php:250](../app/Http/Controllers/TextAnalysisController.php#L250) | CONFIRMED (1/1) |
| SW-3 | **LOW** | `SKIP_WAITING` handler `clientsClaim`/reload nélkül → felező asset-állapot | [public/sw.js:1](../public/sw.js#L1) | PARTIAL (1/1) |
| DL-1 | **LOW** | `public/.DS_Store` + `public/downloads/.DS_Store` publikusan szolgálható | [public/.htaccess:1](../public/.htaccess#L1) | CONFIRMED (1/1) |

### INFO-leletek (nincs valós kockázat, rögzítés teljesség kedvéért)

| id | cím | fájl:sor |
|---|---|---|
| STORAGE-INFO-1 | `storage/{path}` route middleware nélkül, **de** kötelező HMAC signed-URL → nem kihasználható | `vendor/.../Filesystem/ServeFile.php:27` |
| STORAGE-INFO-2 | Path-traversal nem lép ki a gyökérből (Flysystem `PathTraversalDetected` → 404) | `vendor/league/flysystem/.../WhitespacePathNormalizer.php:34` |
| STORAGE-INFO-3 | `storage/app/private` gyakorlatilag üres; az app nem használja a `storage.local` route-ot | [config/filesystems.php:36](../config/filesystems.php#L36) |
| SSRF-INFO-1 | Az SSRF-védelem megkerülhetetlen (per-hop revalidáció + IP-pinnelés) | [TextAnalysisController.php:231](../app/Http/Controllers/TextAnalysisController.php#L231) |
| SSRF-INFO-2 | A YouTube-ág host-ellenőrzés-kihagyása következmény nélküli (csak 11-karakteres videoId megy tovább) | [TextAnalysisController.php:171](../app/Http/Controllers/TextAnalysisController.php#L171) |
| SSRF-INFO-3 | A 2 MB méret-guard kétrétegű és ténylegesen megáll (curl progress-callback + body-backstop) | [TextAnalysisController.php:236](../app/Http/Controllers/TextAnalysisController.php#L236) |
| SSRF-LOW-1 | InnerTube caption `baseUrl` letöltés `assertPublicHost` nélkül — YouTube-kontrollált érték (→ INFO-ra húzva) | [YouTubeCaptionService.php:249](../app/Services/YouTubeCaptionService.php#L249) |
| SSRF-1 | Ugyanaz a `baseUrl`-hézag védelmi-mélység nézőpontból (azonos gyökér mint SSRF-LOW-1) | [YouTubeCaptionService.php:249](../app/Services/YouTubeCaptionService.php#L249) |
| AMP-1 | Egy felirat-kérés ~10 kimenő YouTube-hívást indíthat, de retry-vihar nincs és cache véd | [YouTubeCaptionService.php:105](../app/Services/YouTubeCaptionService.php#L105) |
| UPLOAD-MIME-TOLERANCE-1 | Extractor-választás kliens-kiterjesztés alapján, de tartalom-alapú `mimetypes` szűr + 422-re fut | [TextAnalysisController.php:1612](../app/Http/Controllers/TextAnalysisController.php#L1612) |
| UPLOAD-CSV-FORMULA-1 | CSV formula-guard nem fedi TAB/CR-t — a záró `trim()` miatt nem kihasználható | [FlashcardCsvController.php:186](../app/Http/Controllers/FlashcardCsvController.php#L186) |
| OPENEXT-1 | `shell.openExternal` csak azonos-origin URL-re (`isOwnUrl`) — nincs protokoll-injekció | [topwords-player/src/main.js:231](../topwords-player/src/main.js#L231) |
| SPIKE-1 | Dev-only `spike-embed` ablak sandbox nélkül + IPC-spawn, de a build kizárja (`!**/spike*/**`) | `topwords-player/spike-embed/embed-main.js:34` |
| EXT-CONTEXTMENU-1 | A context-menu a teljes `tab.url`-t a saját backendre küldi (adatvédelmi megjegyzés) | [chrome-extension/background.js:207](../chrome-extension/background.js#L207) |

### Verifikáció által MEGDÖNTÖTT leletek (REFUTED → DROP)

| id | eredeti súly | miért dőlt meg |
|---|---|---|
| **SW-1** | MEDIUM | „pages-cache bejelentkezett HTML-t cache-el, logout után adat-maradvány". A kód-tények igazak (NetworkFirst navigate-route, `plugins:[]`, nincs `no-store`), **de a támadási lánc megszakad**: a SW-t SEMMI nem regisztrálja — nincs `navigator.serviceWorker.register` sehol (forrás + buildelt bundle-ök), nincs `registerSW.js` a lemezen, nincs `<link rel=manifest>`, nincs VitePWA a `vite.config.ts`-ben. 2 REFUTED + 1 PARTIAL/INFO. |
| **SW-4** | LOW | „fonts.bunny.net CacheFirst 1 évig — CDN-kompromittálódás". Kód-tények pontosak, de ugyanaz a cáfolat: a SW nem aktiválódik. REFUTED. |
| **TOKEN-1** | INFO | „safeStorage hiányában a token némán memóriában marad". A verifikáció szerint ez **helyes minta, nem gyengeség**: plaintext token-fájl SOHA nem keletkezik; ha nincs OS-titkosítás, a kód nem ír lemezre, egyébként `encryptString` + `0o600`. DROP. |

---

## Leletenkénti részletezés

### UPLOAD-PDF-1 — MEDIUM — A PDF-parse a memória-sapka ELŐTT fut → worker-OOM
**Fájl:** [TextAnalysisController.php:1762](../app/Http/Controllers/TextAnalysisController.php#L1762) · **Verdikt:** PARTIAL (1 CONFIRMED/MEDIUM, 1 PARTIAL/MEDIUM, 1 PARTIAL/LOW)

**Forgatókönyv:** Bejelentkezett + email-verifikált felhasználó ~30 MB-os, szándékosan sok objektum-streamet / beágyazott képet tartalmazó PDF-et tölt fel a `POST text-analysis/books` végpontra. A validáció (`max:30720` = 30 MB) átengedi. Az `extractPdfText()` a Smalot `PdfParser`-t **default konfigurációval** példányosítja, és a `parseFile()` + `getText()` a **teljes dokumentumot memóriába** bontja. Csak **EZUTÁN** fut az `assertBookTextWithinCap()` 10 MB-os sapka (1767) — vagyis a memória-robbanás a sapka **előtt**, magában a parse-fázisban történik. 512M `memory_limit` mellett ez fatal error (500) / worker-újraindulás, a `throttle:10,1,ta-books` percenként 10 ilyen kérést enged felhasználónként.

**Kód-bizonyíték:**
- `1759–1770`: `$parser = new PdfParser;` (1761, **Config nélkül**) → `$parser->parseFile($path)` (1762) → `$pdf->getText()` (1763) → **csak ezután** `$this->assertBookTextWithinCap($raw)` (1767).
- Smalot v2.12.4 (`composer.lock`): `Config.php:69` `retainImageContent = true`, `Config.php:76` `decodeMemoryLimit = 0` (korlátlan). Az app-ban **sehol** nincs `setConfig` / `setRetainImageContent` / `setDecodeMemoryLimit` (grep tiszta).
- `Parser.php:79`: `file_get_contents($filename)` — a teljes fájlt memóriába tölti, majd felépíti a teljes objektum-gráfot.
- Kontraszt: `MAX_BOOK_TEXT_BYTES = 10*1024*1024` (717) csak a **már kinyert szövegre** vonatkozik.
- Route: `text-analysis.php:25` auth + verified + `EnsureOnboardingComplete`, `throttle:10,1,ta-books`. `.user.ini`: `upload_max_filesize=31M`.

**Verifikátorok:** 1 CONFIRMED/MEDIUM + 1 PARTIAL/MEDIUM + 1 PARTIAL/LOW. Mindhárom megerősítette a **mag-tényt** (a sapka a parse után fut, a Smalot default korlátlan decode-memory-vel és képtartással dolgozik). A szórás a hatás becslésében van: a LOW-szavazó a `retainImageContent` tényleges memória-szorzóját alacsonyabbra teszi, egy másik verifikátor viszont a **Flate-dekompresszió** miatt a finder becslésénél **erősebbnek** találta a vektort. Mérséklők: kötelező auth+verified, 10/perc/user throttle, 30 MB sapka, nem cross-user, nem RCE. **Végleges: MEDIUM (alsó él), PARTIAL.**

**Ajánlás:** (a) `new Config` a parserhez `setRetainImageContent(false)` + `setDecodeMemoryLimit(...)` beállítással; és/vagy (b) pre-parse oldalszám-/bájt-korlát; és/vagy (c) a könyv-feltöltés kiszervezése queue-ba, hogy egy OOM ne webes workert vigyen el. Minimum: a 30 MB-os feltöltési sapka szigorítása a reálisan szükséges méretre.

---

### SW-2 — LOW — Elavult, működésképtelen service worker van deploy-olva
**Fájl:** [public/sw.js:1](../public/sw.js#L1) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** A `public/sw.js` precache-manifestje olyan hashelt fájlokra mutat, amelyek a jelenlegi buildben **már nem léteznek** (`words-CAJ052Cj.js`, `app-CTryjRrN.js` — a lemezen `words-DE2U2m0B.js`, `app-C5lkHCXx.js`), sőt a `build/registerSW.js` és a `manifest.webmanifest` **egyáltalán nincs a lemezen**. Ha egy régi SW mégis aktív valamelyik böngészőben, a precache-install 404-ekbe fut, a workbox-precache hibázik, és a SW-frissítés félkész állapotban akadhat el. Az egész PWA-réteg inkonzisztens: nincs VitePWA a `vite.config.ts`-ben, nincs `<link rel=manifest>`, és **semmi nem regisztrálja a SW-t** — friss látogatónál nem is települ. A `sw.js` egy elárvult build-drift termék.

**Kód-bizonyíték:**
- `public/sw.js:1` precache: `{url:"build/assets/words-CAJ052Cj.js"}`, `{url:"build/registerSW.js"}`, `{url:"manifest.webmanifest"}`.
- `ls public/build/assets` → más hashek; `public/build/registerSW.js` → **MISSING**; `public/manifest.webmanifest` → nincs a lemezen és git-untracked.
- `vite.config.ts:8–24` — nincs VitePWA plugin. `app.blade.php` — nincs `rel=manifest`, nincs SW-regisztráló script.
- `grep serviceWorker|registerSW resources/ app/ public/build/assets` → **0 találat**.

**Verifikátor:** CONFIRMED. Nem támadó által kiváltott sebezhetőség, hanem deploy-drift / reziliencia-hiba. Ez a lelet egyben a **SW-1 és SW-4 cáfolatának gyökere** is.

**Ajánlás:** go-live előtt döntsd el: vagy **teljes, konzisztens PWA** (VitePWA + regisztráció + friss hashek), vagy **távolítsd el** a `public/sw.js` + `workbox-*.js` + `offline.html` árva artefaktumokat, hogy ne szolgálj félkész SW-t. A második az olcsóbb és biztonságosabb — egyben véglegesen zárja az SW-1/SW-4 elméleti vektorokat is.

---

### EXT-ISTRUSTED-1 — LOW — Feliratsáv-kattintáskezelők `isTrusted`-guard nélkül
**Fájl:** [chrome-extension/src/youtube.js:269](../chrome-extension/src/youtube.js#L269) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** Egy `youtube.com/watch` (vagy `netflix.com/watch`) oldalon futó rosszindulatú oldal-JS a `#tw-yt-bar-host` / `#tw-nfx-bar-host` **open** shadow DOM-jában lévő `.tw-word` elemre szintetikus `MouseEvent('click')`-et küld. A sáv click-listenere **nem ellenőrzi az `e.isTrusted`-et** (szemben a lookup-popup mousedown/keydown és a page-highlight handlerekkel, amelyek igen), így lefut a `handleYtWordClick`: megnyílik a jelentés-popup, a szó kimondódik (TTS), és megáll a videó.

**Miért csak LOW:** **Írási művelet nem érhető el** — a státusz/flashcard gombok a lookup-popup **zárt** (`mode:'closed'`) shadow DOM-jában vannak, oda az oldal-JS nem lát be; a lookup-válasz sem szivárog ki. A hatás legfeljebb kellemetlenség (kéretlen popup / TTS / videó-pause), és feltételezi, hogy a user előzőleg bekapcsolta a feliratsávot. Nincs adathozzáférés, nincs írás, nincs auth-megkerülés.

**Kód-bizonyíték:**
- `youtube.js:269–271`: `bar.addEventListener('click', (e) => { handleYtWordClick(...) })` — nincs `if (!e.isTrusted) return;`. Ugyanez `netflix.js:110–112` és `youtube.js:742–746` (átirat-panel).
- Open shadow: `youtube.js:256`, `netflix.js:97`, `youtube.js:721` — `attachShadow({ mode: 'open' })`.
- Kontraszt (a védett felületek): `lookup-popup.js:14` és `page-highlight.js:223` `if (!e.isTrusted) { return; }`; `lookup-popup.js:155` és `search-modal.js:39` `attachShadow({ mode: 'closed' })`.

**Ajánlás:** vedd fel az `if (!e.isTrusted) { return; }` guardot a három sáv/panel click-handlerre is (paritás a már védett handlerekkel). Egysoros változtatás, nincs funkcionális hatás.

---

### CAP-1 — LOW — `storeYoutube`: nincs méret-sapka a MEDIUMBLOB-ba írás előtt
**Fájl:** [TextAnalysisController.php:1520](../app/Http/Controllers/TextAnalysisController.php#L1520) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** Rendkívül hosszú (több órás) videó feliratánál a szegmensekből épített `$json` a memóriában marad, majd gzippelve a `compressed_segments` **MEDIUMBLOB** (max 16 MB) oszlopba kerül. A könyv-feltöltésnél van explicit `assertBookTextWithinCap()` 10 MB-os sapka — a YouTube-átiratnál **semmilyen** méret- vagy szegmensszám-korlát nincs a mentés előtt. Ha a gzippelt kimenet meghaladja a 16 MB-ot, **kezeletlen `Data too long` QueryException → 500**.

**Kód-bizonyíték:**
- `1520`: `$segments = $transcript['segments'];`, `1527`: `json_encode(...)`, `1541`: `'compressed_segments' => gzencode($json, 6)` — **nincs** `strlen($json)` / `count($segments)` ellenőrzés.
- A `fetchTranscript` try/catch-e (`1512–1518`) **csak a fetch-et** fedi; a DB-insert (`1532–1545`) a try/catch **után**, lock-blokkban fut → a QueryException nem kap tiszta kezelést.
- `bootstrap/app.php` `withExceptions` üres, nincs QueryException-render → default 500.
- Migráció: `create_youtube_transcripts_table.php:27` `compressed_segments MEDIUMBLOB NOT NULL`.

**Verifikátor:** CONFIRMED, LOW. A bemenet **nem tetszőleges méretű** (11-karakteres valós videó-ID, a méretet a YouTube adja), a 16 MB gzippelt határ csak a szélső farokban érhető el. Auth + verified + `throttle:10,1,ta-yt` mögött. Reális kimenet: ritka, kezeletlen 500 — nem DoS-vektor.

**Ajánlás:** szegmens-szám vagy `strlen($json)` sapka az insert előtt, barátságos 422-vel (mint a könyveknél), vagy a `create()` bevonása a try/catch-be.

---

### CAP-2 — LOW — A YouTube-letöltéseknek nincs byte-sapkája
**Fájl:** [YouTubeCaptionService.php:249](../app/Services/YouTubeCaptionService.php#L249) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** A `fetchViaInnertube` / `fetchViaTimedtextApi` / `fetchViaPageScraping` mind `Http::timeout(...)->get($url)->body()`-val tölti le a watch-oldalt és a felirat-tartalmat, **teljes egészében memóriába**. A webes ágon van `MAX_FETCH_BYTES` = 2 MB curl progress-callback sapka (`safeFetch`), a YouTube-ágon **nincs semmilyen méret-plafon**.

**Kód-bizonyíték:** `:199`, `:215`, `:249`, `:259`, `:282`, `:289`, `:317`, `:338`, `:347` — mind sapka nélküli `->body()` / `->json()`. Kontraszt: `TextAnalysisController.php:236–260` `CURLOPT_NOPROGRESS => false` + `CURLOPT_PROGRESSFUNCTION` sizeGuard.

**Verifikátor:** CONFIRMED, LOW. A cél-URL-ek mind YouTube-vezéreltek (a user csak a 11-karakteres videó-ID-t választja), így **nem irányítható tetszőleges nagy fájlra**; a felső korlátot a valós videó felirata adja. Reziliencia-hézag, nem kihasználható amplifikáció.

**Ajánlás:** ugyanaz a byte-sapka minta, mint a `safeFetch`-nél (vagy legalább `->timeout()` mellé egy méret-guard), hogy a YouTube-ág is konzisztens legyen a kódbázis saját konvenciójával.

---

### SSRF-LOW-2 — LOW — Nincs port-allowlist a `safeFetch`-ben
**Fájl:** [TextAnalysisController.php:250](../app/Http/Controllers/TextAnalysisController.php#L250) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** A `safeFetch` a portot az URL-ből veszi (default 80/443), de **nincs korlátozás, hogy csak 80/443 engedett**. Egy publikus IP-re mutató URL tetszőleges porttal (`:6379`, `:22`, `:9200`) átmegy az IP-guardon (az IP publikus), és a szerver oda TCP-kapcsolatot nyit. **Belső/privát IP-k portjai továbbra is blokkoltak** a `NO_PRIV_RANGE` miatt.

**Kód-bizonyíték:** `250`: `$port = parse_url($url, PHP_URL_PORT) ?: ($scheme === 'https' ? 443 : 80);` → `257`: `CURLOPT_RESOLVE => ["{$host}:{$port}:{$ip}"]`. Nincs `in_array($port, [80,443])` jellegű ellenőrzés. Az `assertPublicHost` **kizárólag az IP-t** validálja, a portot egyáltalán nem nézi.

**Verifikátor:** CONFIRMED, LOW. A maradék primitív: hitelesített, rate-korlátozott, **csak publikus IP-kre** irányuló időzítés-alapú port-felderítés — amit a támadó a saját gépéről hatékonyabban megtehet; az egyetlen marginális extra a szerver forrás-IP-je. A válasz `text/*`/`xml` content-type-ra szűkített, 2 MB-ra sapkázott, 15 000 karakterre vágva.

**Ajánlás:** 80/443 (esetleg 8080/8443) port-allowlist a `safeFetch`-ben. Nem blokkoló.

---

### SW-3 — LOW — `SKIP_WAITING` handler `clientsClaim`/reload nélkül
**Fájl:** [public/sw.js:1](../public/sw.js#L1) · **Verdikt:** PARTIAL (1/1)

**Forgatókönyv:** A SW figyeli a `SKIP_WAITING` üzenetet és azonnal `skipWaiting()`-et hív, **de nincs `clientsClaim()` és nincs kontrollált frissítési folyamat** (`controllerchange` → reload). Ha egy jövőbeli kliens elküldi a `SKIP_WAITING`-et, az új SW azonnal aktiválódik és átveszi a precache-t, miközben a betöltött oldal a **régi** JS-chunkokat futtatja; a `cleanupOutdatedCaches()` közben törölheti a régi hasheket → lazy-loadolt route-chunk 404, futásidejű hiba reload nélkül (fél régi / fél új build).

**Kód-bizonyíték:** `self.addEventListener("message", s => s.data && "SKIP_WAITING" === s.data.type && self.skipWaiting())`; `clientsClaim` előfordulás = **0**; `cleanupOutdatedCaches()` jelen van; a `SKIP_WAITING` string az egész repóban **kizárólag** a `sw.js`-ben fordul elő — nincs kliens-oldali küldő.

**Verifikátor:** PARTIAL, LOW. **Jelenleg nem kiváltható** (nincs küldő, és a SW gyakorlatilag nincs regisztrálva — SW-2). Ez egy előre-mutató reziliencia-lelet a jövőbeli PWA-bekapcsolásra. Nincs biztonsági adathatás.

**Ajánlás:** ha a PWA-t helyreállítjátok, a `SKIP_WAITING`-et **csak `controllerchange`-re történő oldal-reload-dal együtt** szabad használni. Ha a PWA-t kivezetitek (SW-2 ajánlás), ez okafogyottá válik.

---

### DL-1 — LOW — `.DS_Store` fájlok publikusan szolgálhatók
**Fájl:** [public/.htaccess:1](../public/.htaccess#L1) · **Verdikt:** CONFIRMED (1/1)

**Forgatókönyv:** A `public/` gyökérben (8196 byte) és a `public/downloads/` alatt (6148 byte) is van egy-egy macOS `.DS_Store`. A `public/.htaccess` **nem tartalmaz rejtett-fájl / dotfile letiltó szabályt** — csak a Laravel front-controller rewrite-ot és `Options -MultiViews -Indexes`-t. Mivel a `.DS_Store` fizikailag létező fájl, a `RewriteCond %{REQUEST_FILENAME} !-f` miatt **nem megy az `index.php`-ra**, hanem az Apache közvetlenül kiszolgálja. A `.DS_Store` a mappa fájl-/almappaneveit tartalmazza → könyvtárlistázás-szivárgás, ami megkerüli az `Options -Indexes`-t.

**Fontos mérséklő:** mindkét fájl **git-ignorált** (`.gitignore:13`), tehát nem verziózott és jó eséllyel nem is deployolódik — a kockázat főleg akkor él, ha a deploy rsync/scp a teljes `public/`-ot másolja szűrés nélkül. Ellenőrizve: jelenleg **nincs `oc.php` és nincs `.env`** a `public/` gyökérben.

**Ajánlás:** `.DS_Store` kizárása a deployból + dotfile-deny az `.htaccess`-be (`<FilesMatch "^\.">`). A teljes header-/exposure-audit a **Fázis 8**-é.

---

## Kereszthivatkozások és megjegyzések

- **A `public/downloads/topwords-extension/` kicsomagolt könyvtár, amit a PLAN.md a Fázis 4b hatókörébe vett, JELENLEG NEM LÉTEZIK** — a `public/downloads/` egyetlen tartalma a `.DS_Store` (DL-1). Az „egyezik-e az auditált zippel / van-e benne dev-maradvány" kérdés tárgytalan; ha go-live-kor visszakerül, **újra kell auditálni**.
- **A `chrome-extension/topwords-extension-1.13` / `-1.15` verziózott mappák törölve** (git status); az aktív forrás a `chrome-extension/` gyökér — a finderek ezt auditálták.
- **SW-2 a gyökere az SW-1 és SW-4 cáfolatának** is: mindhárom lelet ugyanabból a tényből ered (a PWA-réteg elárvult és nincs regisztrálva). Egyetlen döntés (PWA helyreállítása VAGY kivezetése) egyszerre zárja mind a hármat.
- **SSRF-LOW-1 és SSRF-1 azonos kód-gyökér** (a caption `baseUrl` letöltése `assertPublicHost` nélkül), két különböző dimenzió-finder találta meg egymástól függetlenül. Mindkettő INFO-ra került: a `baseUrl` kizárólag a YouTube saját válaszából jön, injektálásához a szerver→youtube.com útvonal kontrollja kellene (off-path előfeltétel).
- **A Fázis 3 mintája megismétlődött:** a legmagasabb súlyosságú lelet ismét reziliencia-jellegű (erőforrás-kimerítés), nem adat-/jogosultsági defektus.

## Javasolt sorrend (ha lesz javítási kör)

1. **UPLOAD-PDF-1** (MEDIUM) — Smalot `Config` + pre-parse korlát. Ez az egyetlen, ami valós üzemeltetési fájdalmat okozhat élesben.
2. **SW-2** (LOW, de go-live-döntést igényel) — PWA kivezetése vagy helyreállítása; egyben zárja SW-1/SW-3/SW-4-et.
3. **EXT-ISTRUSTED-1** (LOW) — egysoros guard-paritás, olcsó.
4. **DL-1** (LOW) — deploy-szűrés + dotfile-deny; a Fázis 8 go-live checklisttel együtt.
5. **CAP-1 / CAP-2 / SSRF-LOW-2** (LOW) — konzisztencia-javítások, ráérnek.

---

## Fázis 4 lezárva

| Terv-pont (PLAN.md) | Eredmény |
|---|---|
| `fetch-source` SSRF megkerülhetetlenség | ✅ Verifikálva — megkerülhetetlen (SSRF-INFO-1/2/3); 1 LOW (port-allowlist) |
| YouTube caption/transcript lánc | ✅ Auditálva — 2 LOW (méret-sapkák), IDOR nem található |
| `storage/{path}` publikus fájl-serve | ✅ **A gyanú megdőlt** — kötelező HMAC signed-URL + traversal-védelem (STORAGE-INFO-1/2/3) |
| Fájl-feltöltés (CSV + TA) | ✅ Auditálva — **1 MEDIUM** (PDF-OOM), CSV-injection és MIME-spoofing nem kihasználható |
| Electron player IPC/preload | ✅ Auditálva — `openExternal` origin-zárt, token-tárolás helyes, spike dev-only |
| Chrome-extension üzenetkezelés | ✅ Auditálva — 1 LOW (`isTrusted`-paritás); írási felületek zárt shadow-ban védve |
| PWA service worker | ✅ Auditálva — **a fő gyanú (SW-1) megdőlt**; 2 LOW build-drift/reziliencia |
| `public/downloads` kicsomagolt extension | ⚠️ **Tárgytalan** — a könyvtár jelenleg nem létezik; 1 LOW (`.DS_Store`) |

**Fázis 5–8 nem indult** — jóváhagyásra vár.
