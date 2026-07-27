# Dimenzió B — YouTube caption/transcript lánc + UserBook IDOR

> PLAN Fázis 4a, 2. pont: „YouTube caption/transcript lánc (`YouTubeCaptionService`, `YoutubeTranscript`, `UserBook`):
> külső API-hiba kezelés (`TransientCaptionException`), parsing-injection, méret/cost-plafon, IDOR a könyveken."
>
> Finder: független agent · orchestrátor-keresztellenőrzés: YT-2 (kvóta-aszimmetria) inline megerősítve.
> **Csak dokumentálás — kód NEM módosult.**

## Összesítő

| HIGH | MEDIUM | LOW | INFO |
|---|---|---|---|
| 0 | 0 | 2 | 6 |

**IDOR = 0** (10/10 action scoped). **XXE strukturálisan kizárt** (0 XML-parser az egész `app/`-ban).

---

## IDOR-tábla (minden action egyenként ellenőrizve)

| Action | fájl:sor | Scoping-mechanizmus | Verdikt |
|---|---|---|---|
| `listYoutube` | `TextAnalysisController.php:1528` | `YoutubeTranscript::where('user_id', $user->id)` (query-szintű) | CLEAN |
| `storeYoutube` | `:1603` | `'user_id' => $user->id` create-nél; id nem a requestből | CLEAN |
| `getYoutubePage` | `:1628` | `abort_unless($transcript->user_id === $request->user()->id, 403)` | CLEAN |
| `youtubeOverview` | `:1643` | ugyanaz az `abort_unless` | CLEAN |
| `deleteYoutube` | `:1656` | ugyanaz, a `->delete()` ELŐTT | CLEAN |
| `listBooks` | `:787` | `UserBook::where('user_id', $user->id)` | CLEAN |
| `uploadBook` | `:1720` | `'user_id' => $user->id` create-nél | CLEAN |
| `getBookPage` | `:1747` | `abort_unless($book->user_id === $request->user()->id, 403)` | CLEAN |
| `bookOverview` | `:1760` | ugyanaz | CLEAN |
| `deleteBook` | `:1828` | ugyanaz, a `->delete()` ELŐTT | CLEAN |

A guard minden bound action **első utasítása** — nincs korai olvasás, nincs leak-before-abort.
Az overview-cache kulcsai user-szuffixáltak (`:1646`, `:1763`), így a cache-elt elemzés sem léphet át useren.

---

## LOW leletek

### YT-1 · `app/Services/YouTubeCaptionService.php:384-406` · LOW · caption-`baseUrl` letöltés host-allowlist és IP-pinning nélkül

- **Forgatókönyv:** a támadó DNS-t poisonol vagy MITM-el a szerver és a `www.youtube.com` közé (vagy a YouTube-válasz kompromittálódik), és a `captionTracks[].baseUrl`-be belső URL-t ír (pl. `http://169.254.169.254/latest/meta-data/`). A `Http::get($url)` (`:390-395`) redirecteket követ, nincs `assertPublicHost`, nincs `CURLOPT_RESOLVE` — a válasz törzse `parseCaptionBody`-n átmegy, és `storeYoutube` visszaadja a felhasználónak (`:1621`).
- **Verifikációs verdikt:** CONFIRMED gap, de **NEM támadó-vezérelt**.
- **Miért LOW:** a felhasználó bemenete kizárólag a 11 karakteres videoId (`extractVideoId` regex `:46-49`; extension oldalon `ExtensionController.php:526`) — a cél-URL-t nem ő adja, hanem a YouTube. Kell hozzá hálózati pozíció vagy Google-kompromittálás; HTTPS mérsékli. A `MAX_CAPTION_BYTES` progress-guard (`:386-393`) jelen van, tehát a méret-oldal fedve.
- **Aszimmetria:** a `fetchSource` webes ága ugyanezt a kérdést `assertPublicHost` + `CURLOPT_RESOLVE` + hoponkénti újravalidálással kezeli (`TextAnalysisController.php:255-309`) — a caption-ág nem.
- **Regresszió-státusz:** a 2026-07-20-i kör SSRF-3-ként LOW-nak minősítette. **Host-allowlist azóta NEM került be** (`grep -rn assertPublicHost app/` → csak `TextAnalysisController.php:171,212,271`). Változatlanul nyitott, a no-fix elv szerint várt.

### YT-2 · `routes/extension.php:30` + `ExtensionController.php:518-542` · LOW · az extension YouTube-végpont semmilyen csomag- vagy napi kvótát nem ismer *(ÚJ LELET)*

- **Forgatókönyv:** Free felhasználó bejelentkezik, majd az endpointot 30 kérés/perc-cel hívja mindig ÚJ, cache-ben nem lévő videoId-kkal (`throttle:30,1,ext-yt`). Minden cache-miss 2-5 kimenő YouTube-kérést indít (`fetchViaInnertube` 3, `fetchViaTimedtextApi` max 3, `fetchViaPageScraping` 3 — `YouTubeCaptionService.php:120-134`) → ~90-150 kimenő kérés/perc, óránként >5000, **korlátlan napi mennyiségben**.
- **Hatás:** a YouTube rate-limitelheti/blokkolhatja a szerver IP-jét (a funkció MINDEN felhasználónak elhal), plusz worker-lekötés (a lassú ág 20+15+3×10 s timeouttal ~1 perc/kérés).
- **A rés maga — orchestrátor által inline megerősítve:** a webes ág a letöltés ELŐTT kapuz (`TextAnalysisController.php:1550-1556`, `youtubeLimitError`, Free 3 / Pro 40 — `config/plans.php:29,40`), majd a zár alatt újra (`:1597-1600`). Az extension-ág `youtubeTranscript` metódusában viszont **csak** `if (! $request->user())` (`:520`) + videoId-regex (`:526`) + throttle van — csomag-limit és napi keret nulla.
- **Verifikációs verdikt:** CONFIRMED (finder + orchestrátor önálló kód-olvasás).
- **Miért LOW és nem MEDIUM:** hitelesítést igényel (nem anonim); a throttle korlátozza a burst-öt; a videónkénti 24 h megosztott cache (`CACHE_TTL_HOURS`, `:13`) a valós használatot amortizálja; és a kár a szolgáltató saját IP-reputációja/erőforrása, **nem felhasználói adat** — nincs bizalmasság- vagy integritás-sértés.
- **Megjegyzés:** ez az egyetlen extension-végpont a `verified` csoporton kívül (`routes/extension.php:24-30`) — olvasó végpont, nem hoz létre user-tartalmat, tehát a `verified`-kihagyás szándékos és dokumentált. A **költség-oldalt** azonban semmi nem fedi.

---

## INFO / CLEAN tételek

### YT-3 · `YouTubeCaptionService.php:80-81, 93` · INFO · a negatív cache megosztott, de nem poisonolható
A `youtube:transcript-miss:{videoId}` kulcsot bármely hitelesített user kiváltja, és utána 15 percig MINDEN user 422-t kap ugyanarra a videóra. **Forgatókönyv-hiány:** a támadó nem tudja rákényszeríteni a YouTube-ot, hogy feliratos videóra üres tracklistát adjon — a miss csak akkor íródik, ha az összes stratégia **hiba nélkül** ad üres eredményt (`:140-144`). Az átmeneti hiba explicit `TransientCaptionException`-t kap (`:141`), amit a `fetchTranscript` elkap és **NEM** cache-el (`:88-91`); ezt két teszt bizonyítja (`tests/Feature/YouTubeCaptionServiceTest.php:36-58`). Ez a helyes fail-open-a-retry-felé viselkedés. Maradék: 15 perces ablak videónként, támadói kontroll nélkül → INFO.

### YT-4 · `YouTubeCaptionService.php:411-431, 620-650` · INFO · parsing-injection CLEAN, XXE strukturálisan kizárt
`parseCaptionBody` három ága: `json_decode` (`:416`), VTT `preg_split` (`:450`), és „XML"-ág, ami `preg_match_all` + `strip_tags` + `html_entity_decode` (`:623-630`). **Semmilyen XML-parser nincs:** `grep -rn "simplexml|DOMDocument|XMLReader|xml_parse|libxml" app/` → **0 találat az EGÉSZ app-ban**. XXE, billion-laughs, XInclude: nem alkalmazható.

XSS-oldal mindkét renderelőn zárt:
- **React:** `youtube-panel.tsx:91` `{t.title}`, `:134` `{transcript.title}`, szegmensek JSX-szövegként — auto-escape. A 3 `dangerouslySetInnerHTML`-találat egyike sincs ezen az adatúton (`two-factor-setup-modal.tsx:81`, `rich-text-editor.tsx:320` sanitizerrel, `lib/sanitize-html.ts`).
- **Extension:** `chrome-extension/src/youtube.js:858` `body.innerHTML`-t használ, DE minden interpolált érték escape-elt: a szöveg `ytWordsToHtml`-en megy át, ami minden tokent `esc()`-el szöveg- ÉS attribútum-kontextusban (`:291,299,307,312`; `esc` = `src/shared.js:38-45`, `& < > " '` mind fedve), a `data-t="${seg.t}"` pedig `formatYtTime`-mal `Math.floor`-ozott szám (`:653-660`). Egy `<script>`-et tartalmazó felirat-track irodalmi szövegként jelenik meg.

Elvi apróság: a `(.*?)` nem-mohó match + `strip_tags` hibás/nem záró tagnál elnyelhet szöveget — ez **adatvesztés** (rövidebb szegmens), nem injektálás, mert a kimenet mindkét renderelőn escape-elődik → INFO.

### YT-5 · `YouTubeCaptionService.php:22`, `TextAnalysisController.php:743, 1591` · INFO · méret/költség-plafon többrétegű
- `MAX_CAPTION_BYTES = 8 MB` (`YouTubeCaptionService.php:22`), curl progress-callbackkel **menet közben** érvényesítve (`:386-393`) + post-hoc védőháló `Http::fake` alá (`:401-403`).
- `MAX_TRANSCRIPT_BYTES = 12 MB` a *tömörített* blobra (`TextAnalysisController.php:743`), ellenőrzés `:1591` — a MEDIUMBLOB „Data too long" 500-ast zárja; a `gzencode` tudatosan a lock ELŐTT fut (`:1575`).
- Szegmens/oldal: `SEGMENTS_PER_PAGE = 50` (`YoutubeTranscript.php:11`), a `page` `max(1, min(..., total_pages))`-el clamp-elve (`:1630`, könyvnél `:1749`) — nincs negatív/túlfutó offset.
- Darabszám/user: `youtube_transcripts` 3/40 (`config/plans.php:29,40`), TOCTOU-védett zár alatt újraellenőrizve (`:1597-1600`). Könyvek: `books` 1/7 + 30 MB `BOOK_STORAGE_LIMIT` (`:768-778`), ugyanígy (`:1714-1717`).
- AI/overview: `MAX_OVERVIEW_CHARS = 2_000_000` (`:1777`), 10 perces cache (`:1780`), cache-miss a napi `text_analyses_per_day` keretbe számít (`reserveDailyAnalysis`, `:363-393`), hibánál refund (`:1812`).

A „10 órás videó" forgatókönyv: a felirat a 8 MB-os curl-sapkánál megszakad → `ConnectionException` → `sawTransientError` → 422-es üzenet. **Nem OOM, nem 500.**

Teljesítmény-jegyzet: a `getPage`/`segments()` a TELJES blobot kitömöríti és `json_decode`-olja egy 50 szegmenses oldalhoz is (`YoutubeTranscript.php:27,38`) — 12 MB-os blobnál tetemes per-request memória, de a `throttle:60,1,ta-page` + a 12 MB felső korlát miatt nem fegyverezhető → INFO.

### YT-6 · `YouTubeCaptionService.php:43-59`, `ExtensionController.php:526` · CLEAN · videoId allowlist-validált, request-injection zárt
Webes ág: `extractVideoId` négy regexe kizárólag `([a-zA-Z0-9_-]{11})`-et engedhet capture-be (`:46-49`), a bemenet előtte `url:http,https|max:2000` validált (`:1541`, `:165`). Extension ág: `preg_match('/^[a-zA-Z0-9_-]{11}$/', ...)` **anchor-olva** (`:526`). Mivel `%0d%0a`, `&`, `?`, `/`, `.` egyike sincs a charsetben, a `'https://www.youtube.com/watch?v='.$videoId` interpoláció (`:158,209,327`) CRLF-injektálásra, extra query-paraméterre és path-traversalra zárt. A `fetchViaTimedtextApi` ráadásul `urlencode()`-ol is (`:286`).

### YT-7 · `TransientCaptionException.php:12` + minden hívó · CLEAN · nincs kezeletlen út, nincs stack-trace/kulcs-szivárgás, nincs hammering
Az osztály `extends \RuntimeException` (`:12`), így a `catch (\RuntimeException $e)` ágak elkapják. Mind a 4 hívási hely fedett: `ExtensionController.php:533-536` (`\Throwable` → generikus `no_captions`), `TextAnalysisController.php:1558-1564`, `:169-181`, `:175`. A kiszivárgó `getMessage()` fix magyar szöveg (`:141`, `:144`) — nincs benne URL, host vagy kulcs. Az `INNERTUBE_API_KEY` (`:219-223`) a YouTube publikus web-kulcsa, nem projekt-titok, és sosem kerül válaszba. Retry: a stratégiák **sorosan, egyszer** futnak (`:120-134`), a belső `foreach`-ek max 2-3 formátumot próbálnak (`:258`, `:288`, `:347`) — nincs `Http::retry()`, nincs exponenciális újrapróbálás. Felső korlát egy cache-missre ~9 kimenő kérés. (A per-request összesített timeout viszont ~65 s — lásd YT-2.)

### YT-8 · `routes/text-analysis.php:7-28`, `routes/extension.php:30` · INFO · middleware-térkép
A 10 könyv/transcript route mind a `['auth', 'verified', EnsureOnboardingComplete::class]` csoportban (`routes/text-analysis.php:7`): store 10/perc, page 60/perc, overview 10/perc; a két `destroy` throttle nélkül (idempotens, self-only törlés). Nincs külön Pro-gate, de nem is kell — a differenciálás a `planLimit`-en történik. **Anonim hívó egyetlen drága utat sem ér el.** Az extension-végpont session-cookie-alapú `$request->user()` ellenőrzéssel (`ExtensionController.php:520`); az `extension.php` a `routes/web.php:90`-en included, tehát a `web` csoportban fut (`bootstrap/app.php:29-35`), így a session-auth valós, és `throttle:30,1,ext-yt` jelen van. **Hitelesített ÉS throttle-olt igen — kvótázott nem** (YT-2).

---

## PLAN-feltevés MEGDŐLT

Ebben a dimenzióban **egyetlen PLAN-feltevés sem dőlt meg** — a PLAN mind a négy vizsgálati pontja (API-hiba-kezelés, parsing-injection, méret/cost-plafon, IDOR) élő és értelmes tárgyú.

A **korábbi audit** három ellenőrzésre kiadott állítása független verifikáción átment:

1. „Mind a 6 metódus `abort_unless($x->user_id === user()->id, 403)`-ot használ" → **MEGERŐSÍTVE**, sőt pontosítva: 6 bound action `abort_unless`-szel + 4 unbound action query-szintű `where('user_id')`-vel = **10/10 scoped**.
2. „NINCS XML-parser a láncban" → **MEGERŐSÍTVE és kiterjesztve**: nem csak a láncban, hanem az egész `app/`-ban nulla `simplexml`/`DOMDocument`/`XMLReader`/`libxml`.
3. „`fetchCaptionBody` guard/pinning nélkül tölt le, csak MITM/DNS-poisoning útján elérhető" → **MEGERŐSÍTVE**, host-allowlist azóta nem került be. Súlyosság: LOW, egyetértés a prior értékeléssel.

**Új, korábban nem tárgyalt lelet:** YT-2 — a webes és az extension YouTube-belépő pont közti kvóta-aszimmetria. A 2026-07-20-i kör ezt nem vizsgálta (akkor a YT-dimenzió 0 LOW / 5 INFO-val zárt), tehát ez **nem regresszió, hanem új lefedettség**.
