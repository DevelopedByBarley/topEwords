# D1 — `SecurityHeaders` middleware tartalma

**PLAN-pont:** „CSP, HSTS, `X-Frame-Options`/frame-ancestors, `X-Content-Type-Options`, referrer-policy — teljes-e."

**Verdikt: 0 HIGH · 0 MEDIUM · 3 LOW · 3 INFO.**

**A PLAN-feltevés („a SecurityHeaders hiányos lehet") RÉSZBEN ÁLL:** a *tartalom* teljes,
a *lefedettség* nem. Az `api` csoport egyetlen headert sem kap. Vektor azonban nincs mögötte.

---

## Módszertani figyelmeztetés (fontos a jövőbeli körökre)

A finder első nekifutásra `php artisan route:list --json`-ból azt állapította meg, hogy
mind a 160 route megkapja a `SecurityHeaders`-t. **Ez téves volt:** a `route:list` a csoport
*nevét* (`web`/`api`) írja ki, nem a kibontott middleware-osztályokat, így a `SecurityHeaders`
string soha nem jelenik meg benne, és a szűrő némán 0 találatot ad. A helyes forrás a
futásidejű kernel (`middlewareGroups`). **Aki ezt újra-ellenőrzi, ne a `route:list`-ből dolgozzon.**

---

## Leletek

### D1-1 · Az `api` middleware-csoport nem kap biztonsági headert · LOW

- **fájl:** [bootstrap/app.php:29-35](../../bootstrap/app.php#L29-L35)
- **súlyosság:** LOW
- **forgatókönyv:** A `$middleware->web(append: [... SecurityHeaders::class])` kizárólag a `web`
  csoporthoz fűz. A futásidejű kernel szerint az `api` csoport csak `SubstituteBindings`.
  Így a 14 `api/player/*` route és az `/up` **nem kap** `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, HSTS és CSP headert.
  A vizsgált és **elvetett** támadási út: mind a 14 route `application/json`-t ad
  (`ExtensionController`/`PlayerPairingController`), Sanctum Bearer-tokenes auth (nem cookie),
  tehát a keretezés nem renderel semmit, és nincs ambient-credential támadás.
  **Valós (kicsi) költség:** a hiányzó **HSTS**. Egy player-app felhasználó ellenséges Wi-Fin,
  aki az első kérését `http://topwords.eu/api/player/me`-re küldi, mielőtt bármely `web`-válasz
  HSTS-t rögzített volna, ezt az egy kérést plaintextre kényszerítve elveszítheti a Bearer-tokent.
  Aktív MITM kell hozzá + az első kérésnek `api/*`-ra kell esnie; a meglévő HSTS `preload`
  direktívája ezt nagyrészt tárgytalanná teszi.
- **verdikt:** CONFIRMED (a headerek hiánya), de a hatás LOW.

### D1-2 · A rich text szerver-oldalon sanitizálatlan; egyetlen védelem a kliens-sanitizer · LOW (self-XSS)

- **fájl:** [app/Http/Controllers/ExtensionController.php:254-265](../../app/Http/Controllers/ExtensionController.php#L254-L265) · [resources/js/components/ui/rich-text-editor.tsx:320](../../resources/js/components/ui/rich-text-editor.tsx#L320)
- **súlyosság:** LOW
- **forgatókönyv:** A `front`/`back`/`front_notes`/`back_notes` validációja csak
  `string|max:10000` — nincs HTML-sanitizálás szerver-oldalon. A nyers markup bekerül a DB-be,
  és `dangerouslySetInnerHTML`-lel renderelődik (`study.tsx`, `calibrate.tsx`, `card-preview-dialog.tsx`).
  **Miért nem MEDIUM:** a `FlashcardDeck`-nek nincs megosztás/publikus/kollaboráció relációja,
  és a `FlashcardStudyController:23,80,106` `abort_unless($deck->user_id === $request->user()->id, 403)`-mal
  őriz. A támadó csak a **saját** paklijába injektálhat, és csak ő rendereli. **Blast radius = a
  támadó saját böngészője** — self-XSS, nincs jogosultság-nyereség.
  Épp ezért védhető a `script-src 'unsafe-inline'` is.
- **verdikt:** CONFIRMED (a sanitizálás hiánya íráskor), a hatás self-only.

### D1-3 · A sanitizer engedi a `style` attribútumot és újra-szerializál (mXSS-felület) · LOW

- **fájl:** [resources/js/lib/sanitize-html.ts:27-29, 68-70, 79](../../resources/js/lib/sanitize-html.ts#L27-L29)
- **súlyosság:** LOW
- **forgatókönyv:** Két szerkezeti gyengeség, mindkettő a D1-2 self-only sugarán belül:
  1. A `style` az `ALLOWED_ATTRS`-ben van, és **denylist** regexszel szűrt
     (`expression(|javascript:|url(`), nem allowlisttel. A denylist CSS-szűrés történetileg
     megkerülhető (`url\28`, escape-elt `\75rl`, CSS custom property). Hatás: CSS-injekció —
     a saját kártya elcsúfítása/overlay, nem szkriptfuttatás.
  2. A `sanitizeWithDom` a `tpl.innerHTML`-t adja vissza — **szerializál-majd-újraparse-ol**
     körút. A React ezt más kontextusban (`<div>`, nem `<template>`) parse-olja újra: ez a
     klasszikus mXSS-előfeltétel. Működő payloadot **nem sikerült igazolni** (nincs `jsdom`/`happy-dom`
     a `node_modules`-ban), és a `DROP_TAGS` helyesen kiveszi az `svg`/`math` névtér-pivotokat
     a részfával együtt, még a szerializálás előtt. Ezért keményítési hézag, nem igazolt bypass.
  **Helyesen kezelve (nem lelet):** az `on*` attribútumok az allowlist-ellenőrzés előtt törlődnek;
  a `href` a `SAFE_URL`-lel szűrt, így a `javascript:` elutasított; a `script`/`style`/`iframe`/`form`/`base`
  részfástul törlődik; az ismeretlen tagek unwrap-olódnak.
- **verdikt:** PLAUSIBLE (mXSS), CONFIRMED (denylist-gyengeség), hatás self-only.

---

## INFO

### D1-4 · COOP / CORP / COEP nincs beállítva · INFO
[app/Http/Middleware/SecurityHeaders.php:23-30](../../app/Http/Middleware/SecurityHeaders.php#L23-L30) —
átnézve azok a folyamatok, amelyek miatt számítanának: nincs `window.open`/`window.opener`
használat, nincs `SharedArrayBuffer` vagy cross-origin izolációs igény, nincs cross-origin
beágyazás. A `frame-ancestors 'none'` + `X-Frame-Options: DENY` a keretezési irányt már lefedi.
A sanitizer minden `<a>`-ra ráteszi a `rel="noopener noreferrer"`-t (79. sor), ami az egyetlen
helyet zárja, ahol user-tartalom `opener` handle-höz juthatna.

### D1-5 · Az `app()->isProduction()` nem hamisítható — a gyanú CÁFOLVA · INFO
[app/Providers/AppServiceProvider.php:30-39](../../app/Providers/AppServiceProvider.php#L30-L39) ·
[config/app.php:40](../../config/app.php#L40) — az `APP_ENV` default értéke `'production'`
(hiányzó/üres esetén **biztonságos** irányba esik), és az `assertKnownEnvironment` nem enged
bootolni ismeretlen `APP_ENV`-vel — épp azért, hogy egy `prod`/`live` elgépelés ne dobja el némán
az összes keményítést. Az `APP_ENV` nem kérés-befolyásolt. Nincs hamisítási út.
A CSP prod-only gate-elése is indokolt: dev-ben a Vite HMR inline refresh-szkriptjét és
websocketjét törné el.

### D1-6 · Egyetlen kontroller sem távolítja el/írja felül a headereket · INFO
`headers->set` / `->header(` / `withHeaders` / `headers->remove` söprés az `app/`-ban:
a `SecurityHeaders.php`-n kívüli összes találat **kimenő** `Http::` kérésre vonatkozik
(Gemini, Billingo, YouTube), vagy **beérkező** headert olvas. A saját válasz-headereket
semmi nem mutálja. A `DownloadController` fix, 3 elemű slug→fájlnév allowlisttel dolgozik,
nincs user-vezérelt útvonal vagy content-type.

---

## Összegzés

A legerősebb elérhető állítás — hogy a `script-src 'unsafe-inline'` veszélyes — **nem éli túl
a kóddal való szembesítést:** az egyetlen untrusted HTML-sink tulajdonos-scope-olt, tehát még
teljes sanitizer-bypass esetén is self-XSS az eredmény.

Fordítva viszont: a middleware docblockjának állítása, hogy „the app has no untrusted HTML sinks
(stored rich text is sanitized via lib/sanitize-html)" **pontatlan** — a sanitizálás kizárólag
kliens-oldalon, renderkor fut, íráskor soha. A biztonsági kimenet ma ugyanaz, de ez a komment
felhatalmazna egy jövőbeli fejlesztőt, hogy pakli-megosztást vagy admin-előnézetet építsen,
és ezzel a D1-2-t self-XSS-ből **tárolt, felhasználók közti XSS-sé** alakítsa.
**Ez az egyetlen dolog, amit itt érdemes módosítani — és az egy komment, nem kód.**
