# Dimenzió F — PWA service worker

**Audit dátuma:** 2026-07-27
**Terjedelem:** `public/sw.js`, PWA-manifest, SW-regisztráció, build-lánc (`vite.config.ts`, `package.json`), logout-flow cache-ürítés, szerver-oldali cache-fejlécek
**Módszer:** teljes fájl-olvasás + projekt-szintű grep + git-történet (`752e44c`) + őrszem-teszt olvasás. Kódmódosítás NEM történt.

---

## Összesítő

| Súlyosság | Darab |
|---|---|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 1 |
| INFO | 5 |
| **REFUTED (PLAN-lelet megdőlt)** | **4 a 4-ből** |

**Egymondatos verdikt:** A PLAN Fázis 4b 5. pontja által leírt PWA **már nem létezik** — a `vite-plugin-pwa` kikerült a projektből, a `public/sw.js` ma egy szándékosan megírt **self-destruct tombstone**, ami minden cache-t töröl és deregisztrálja magát; a PLAN mind a négy konkrét kockázata (pages-cache, elavult precache, `SKIP_WAITING`, bunny.net CacheFirst) a `752e44c` commit-tal lezárult, és 4 őrszem-teszt védi a visszaesést.

---

## A 10 vizsgálati pont mátrixa

| # | Vizsgálat | Megállapítás | Súly |
|---|---|---|---|
| 1 | `sw.js` stratégiák, workbox-alapú? | **Kézzel írt**, 51 soros, 0 caching-stratégia. Csak `install` + `activate`. Workbox-import nincs. | INFO-1 |
| 2 | **Cache-el-e authentikált HTML/JSON-t?** | **NEM.** Nincs `fetch` event-listener → a SW soha nem lép be a hálózati útba. Cache-írás matematikailag lehetetlen. | **REFUTED** |
| 3 | Cache-ürítés logoutkor? | Frontendben nincs (`caches.delete` nulla találat `resources/js/`-ben), de **nem is kell**: a SW aktiválódáskor egyszer, globálisan töröl MINDENT. | INFO-2 |
| 4 | Hol regisztrálódik a SW? | **SEHOL.** `navigator.serviceWorker` nulla találat az egész repóban. `app.tsx`, `app.blade.php` tiszta. `vite-plugin-pwa` nincs a `package.json`-ban. | **REFUTED** |
| 5 | Scope `/`, API/Inertia-XHR elfogás, navigációs fallback | Nincs `fetch` handler → semmit nem fog el. Navigációs fallback nincs (`offline.html` törölve). | **REFUTED** |
| 6 | `SKIP_WAITING` message-listener, build-hash a cache-névben | `message` listener **nincs**. A `skipWaiting()` az `install`-ban hívódik, nem külső üzenetre. Cache-név nincs (nem hoz létre cache-t). | **REFUTED** |
| 7 | Külső origin (`fonts.bunny.net`) CacheFirst | A `fonts-cache` CacheFirst route **eltávolítva**. A bunny.net ma sima `<link rel="stylesheet">` a blade-ben, CSP-vel korlátozva. | **REFUTED** |
| 8 | `push` / `notificationclick` / `sync` handler | Egyik sincs. Nulla payload-feldolgozási felület. | — |
| 9 | `fetch` ág, ami request-URL-t használ cache-kulcsnak | Nincs `fetch` handler → cache-poisoning felület nulla. | — |
| 10 | PWA manifest, `start_url` | `public/manifest.webmanifest` **nem létezik**, blade-ben nincs `<link rel="manifest">`. A `public/build/manifest.json` a **Vite asset-manifest**, nem PWA-manifest. | INFO-3 |

---

## Leletek

### LOW-1 — Árva PWA-ikonok a `public/` gyökérben, manifest nélkül

- **Fájl · sor:** `public/pwa-192.png`, `public/pwa-512.png` (2026-04-15, 6 KB + 22 KB)
- **Súlyosság:** LOW
- **Forgatókönyv:** *(bemenet/állapot → hatás)* Támadó a `https://topwords.eu/pwa-512.png` URL-t hívja. Két nyilvánosan elérhető, semmilyen manifestből nem hivatkozott fájl válaszol. Ez nem ad hozzáférést semmihez — a tényleges hatás **információszivárgás a technológiai stackről** (a projekt egykor PWA volt), plusz egy jövőbeli auditor/fejlesztő félrevezetése: az ikonok jelenléte azt sugallja, hogy van PWA-manifest, holott nincs.
- **Indoklás:** Miért nem INFO: van konkrét, reprodukálható bemenet (a két URL) és mérhető, ha csekély hatás (fingerprint + karbantartási zaj). Miért nem MEDIUM: az ikonok statikus képek, nem kód, nem tartalmaznak adatot, és semmilyen kód-útvonalon nem hivatkozottak. A `752e44c` commit az `offline.html`-t és a `workbox-*.js`-t törölte, de ezt a két PNG-t bent hagyta. **Megjegyzés:** ha a PWA valaha visszatér, ezek újra kellenek — a törlés nem egyértelműen helyes lépés, ezért ez tudatos döntést igénylő LOW, nem hiba.

---

### INFO-1 — A `sw.js` egy szándékos self-destruct tombstone (kiváló minta)

- **Fájl · sor:** `public/sw.js:1-51`
- **Súlyosság:** INFO (pozitív megállapítás)
- **Megállapítás:** A fájl mindhárom kötelező takarító lépést végrehajtja:
  - `sw.js:27` — `self.skipWaiting()` az `install`-ban (nem vár a régi példány leállására)
  - `sw.js:37-38` — `caches.keys()` teljes bejárás + `Promise.allSettled(… caches.delete …)` — **nevesített lista helyett teljes kulcs-bejárás**, ami helyes: a régi precache-cache neve build-hash-függő volt, nem hardcode-olható
  - `sw.js:41` — `self.registration.unregister()`
  - `sw.js:46-47` — `clients.matchAll({type:'window'})` + `client.navigate(client.url)` — a nyitott fülek újratöltése
- **Miért ez a helyes megoldás a fájl-törlés helyett:** a böngésző egy már telepített service workert 404-es válaszra **nem** deregisztrál, csak a frissítést hagyja ki. A puszta törlés a szerverről takarított volna, a korábbi látogatók böngészőjéből nem — a régi `pages-cache` (bejelentkezett oldalak HTML-je) határozatlan ideig életben maradt volna. A tombstone ugyanazon az URL-en marad, de takarít és kivezeti önmagát.
- **`allSettled` választás:** helyes — egyetlen cache törlésének hibája nem buktatja a többit, és nem akasztja meg a rá következő `unregister()`-t.

---

### INFO-2 — A tombstone lefedi a logout-maradvány forgatókönyvet, frontend-beavatkozás nélkül

- **Fájl · sor:** `resources/js/components/user-menu-content.tsx:52` (logout-link), `public/sw.js:37-38`
- **Súlyosság:** INFO
- **A PLAN forgatókönyve végigvezetve:** megosztott gép → user A bejelentkezik → kijelentkezik → user B ugyanabban a böngészőprofilban.
  - **Ha B gépén soha nem volt a régi SW telepítve:** nincs cache, nincs SW, nincs maradvány. Vége.
  - **Ha volt telepítve (2026-07-18 előtti látogató):** a következő `sw.js` letöltésnél (a böngésző byte-diffet néz, és ez teljesen más fájl) a tombstone települ → `activate` → **minden Cache Storage kulcs törlődik**, beleértve A korábbi `pages-cache` bejegyzéseit → `unregister()`. Ezután nincs SW, ami bármit is kiszolgálna.
- **Miért nem kell logout-oldali `caches.delete()`:** a takarítás **egyszeri és globális**, nem per-session. Egy logout-hook redundáns lenne, és — mivel a SW már deregisztrálta magát — nem is lenne mit takarítania.

---

### INFO-3 — Nincs szerver-oldali `Cache-Control: no-store` az authentikált válaszokon

- **Fájl · sor:** `app/Http/Middleware/SecurityHeaders.php:19-41` (a header-készlet), `bootstrap/app.php:33-39` (middleware-stack)
- **Súlyosság:** INFO
- **Megállapítás:** A `SecurityHeaders` middleware `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`, `Permissions-Policy` fejléceket állít, produkcióban HSTS + CSP-t is — de **`Cache-Control`-t nem**. A projektben sehol nincs `no-store` (grep: `app/`, `bootstrap/`, `config/`, `public/.htaccess` → nulla találat).
- **Miért csak INFO és nem lelet:** Laravel a session-t indító válaszokra alapból `Cache-Control: no-cache, private` fejlécet küld a `StartSession` middleware-en keresztül, ami a megosztott-proxy-cache-elést kizárja. A böngésző bfcache/back-gomb maradvány elméletileg fennáll, de:
  1. ez **nem SW-kérdés** — a SW ma nem cache-el semmit, tehát ezen a dimenzión kívül esik;
  2. a back-gombos maradvány kezeléséhez az `AuthenticateSession` middleware (`bootstrap/app.php:33`) már gondoskodik arról, hogy a logout után minden további kérés kidobjon.
- **Ha a PWA valaha visszatér:** ez a hiányzó `no-store` **azonnal a védelmi vonal hiányává válik** — akkor egy explicit `Cache-Control: no-store, private` az authentikált útvonalakra kötelező előfeltétel lenne, mielőtt bármilyen navigációs cache-stratégia bekerül. Ezt érdemes a PWA-visszatérés feltételeként rögzíteni.

---

### INFO-4 — Négy őrszem-teszt védi a visszaesést

- **Fájl · sor:** `tests/Feature/ServiceWorkerRetirementTest.php:9-47`
- **Súlyosság:** INFO (pozitív megállapítás)
- **Lefedettség:**
  1. `:9` — a `sw.js` **nem** tartalmaz `pages-cache` / `precacheAndRoute` / `NetworkFirst` / `workbox` sztringet (a konkrét kockázat rögzítése, nem általános smoke-teszt)
  2. `:21` — a három kötelező tombstone-lépés (`caches.delete`, `registration.unregister`, `skipWaiting`) jelen van
  3. `:32` — nincs `workbox-*.js` és nincs `offline.html` a `public/`-ban
  4. `:39` — **`node --check` szintaktikai validáció** — ez a legjobb teszt a négy közül: elkapja azt az él-esetet, ahol maga a takarító SW hibás, az `install` elhasal, és a **RÉGI service worker marad aktív** — vagyis a fix némán hatástalan lenne
- **Hiányzó lefedettség (nem lelet):** nincs teszt arra, hogy a `sw.js` **létezik**. Ha valaki törli a fájlt, a 1-3. teszt `file_get_contents` warninggal/üres sztringgel elhasalna, a 3. viszont zölden átmenne. A gyakorlatban a bukás így is bekövetkezik, tehát a védelem működik.

---

### INFO-5 — A `sw.js` git-követett, a `public/build/` nem — a tombstone deployálódik

- **Fájl · sor:** `.gitignore:4` (`/public/build`), `git ls-files public/sw.js` → követett
- **Súlyosság:** INFO
- **Megállapítás:** Ez a kombináció **helyes és szükséges** a tombstone működéséhez. A `public/build/` ignorált (build-kor generálódik), a `public/sw.js` viszont verzió-követett, tehát a deploy kiviszi a szerverre, és a `https://topwords.eu/sw.js` URL a tombstone-t szolgálja ki. Ha a `sw.js` is ignorált lenne, a tombstone soha nem érné el a felhasználókat, és a régi SW-ek a gépeken maradnának.
- **Nincs Laravel-route, ami a `sw.js`-t szolgálná ki** (grep `routes/`, `app/` → nulla) — statikus fájlként megy ki, ami a helyes SW-scope-hoz (`/`) kell. Ha route-on keresztül menne, a `Service-Worker-Allowed` scope-kérdés felmerülne; így nem.

---

## PLAN-feltevés MEGDŐLT

A PLAN Fázis 4b 5. pontja **teljes egészében elavult**. A leírt PWA a `752e44c` commit-tal (2026-07-18) ki lett vezetve. Pontról pontra:

### ❌ MEGDŐLT 1 — „`public/sw.js` + workbox"

- **PLAN állítás:** a SW workbox-alapú.
- **Valóság:** a mai `public/sw.js` **51 soros, kézzel írt tombstone**, egyetlen workbox-import nélkül. A `vite-plugin-pwa` **nincs** a `package.json`-ban (sem `dependencies`, sem `devDependencies`), és a `vite.config.ts` plugin-listája (`laravel`, `inertia`, `react`, `tailwindcss`, `wayfinder`) sem tartalmazza. **Nincs generátor, ami workbox-kimenetet állítana elő.**

### ❌ MEGDŐLT 2 — „`offline.html` + `build/registerSW.js`"

- **PLAN állítás:** ezek a fájlok léteznek.
- **Valóság:** **egyik sem létezik.** A `public/offline.html` és a `public/build/registerSW.js` a `752e44c` commit-ban törlődött (`git log --diff-filter=D` megerősíti). A `find public -name "workbox*" -o -name "offline*" -o -name "*.webmanifest"` **nulla találatot** ad. *(A feladatkiírás előzetes megállapítása helyes volt.)*

### ❌ MEGDŐLT 3 — „a `NetworkFirst` »pages-cache« bejelentkezett oldalak HTML-válaszait is cache-eli"

- **PLAN állítás:** ez a fő kockázat, aktív.
- **Valóság:** **A mai `sw.js`-ben nincs `fetch` event-listener.** Ez a döntő tény: `fetch` handler nélkül a service worker soha nem lép be a hálózati kérés-válasz útba, tehát **fizikailag képtelen bármit cache-elni** — sem HTML-t, sem Inertia-JSON-t, sem API-választ. A `pages-cache` és a `NetworkFirst` stratégia a régi (`git show 752e44c` diff `-` oldalán látható) generált kimenetből eltávolítva.
- A régi kód valóban tartalmazta: `registerRoute(({request})=>"navigate"===request.mode, new NetworkFirst({cacheName:"pages-cache", networkTimeoutSeconds:5, plugins:[]}), "GET")` — **denylist nélkül**, `plugins:[]` üres, tehát tényleg minden navigációs választ írt. A PLAN kockázat-leírása a **múltbeli** állapotra pontos volt.
- **Ma a lelet REFUTED**, és a takarítás visszamenőleg is megtörtént (a tombstone törli a régi `pages-cache`-t a korábbi látogatók gépén).

### ❌ MEGDŐLT 4 — „`SKIP_WAITING` update-flow" és „elavult precache deploy után" és „külső `fonts.bunny.net` CacheFirst"

- **`SKIP_WAITING`:** a régi kód `self.addEventListener("message", s => s.data && "SKIP_WAITING"===s.data.type && self.skipWaiting())` listenerrel rendelkezett. A mai `sw.js`-ben **nincs `message` listener**; a `skipWaiting()` az `install`-ban hívódik (`sw.js:27`), belülről, nem külső üzenetre. **Nincs kliensből triggerelhető felület.**
- **Elavult precache:** a régi `precacheAndRoute` **73 hash-elt asset-et** sorolt fel (pl. `build/assets/app-CTryjRrN.js`), amikből mára mind 404 — de a `precacheAndRoute` hívás **teljesen eltávolítva**. A mai SW nem hoz létre cache-t, tehát nincs cache-név, amiben build-hash lehetne.
- **`fonts.bunny.net` CacheFirst:** a régi `registerRoute(/^https:\/\/fonts\.bunny\.net\/.*/i, new CacheFirst({cacheName:"fonts-cache", …}))` **eltávolítva**. A bunny.net ma sima `<link rel="stylesheet">` a `resources/views/app.blade.php`-ban, és a produkciós CSP explicit engedélyezi (`SecurityHeaders.php:57-58`: `style-src … https://fonts.bunny.net`, `font-src 'self' https://fonts.bunny.net`). **Opaque response poisoning nem áll fenn**, mert nincs SW-cache a külső origin válaszaira.

### ❌ MEGDŐLT 5 (bónusz) — implicit PLAN-feltevés: „a projekt PWA"

- **Valóság:** a `resources/views/app.blade.php` **nem tartalmaz `<link rel="manifest">` sort**, és `public/manifest.webmanifest` nem létezik. A `resources/js/app.tsx` nem regisztrál service workert. A `navigator.serviceWorker` sztringre a teljes repo (node_modules/vendor nélkül) **nulla találatot** ad. **A projekt ma nem PWA** — nem telepíthető, nincs offline-mód, nincs SW-életciklus a friss látogatóknál.

---

## Záró értékelés a blast radius-ról

A feladatkiírás kifejezetten kérte a valós blast radius felmérését a „megosztott gép + logout-maradvány" forgatókönyvre. **A lelet REFUTED**, két független okból, amikből bármelyik önmagában elég:

1. **A SW nem cache-el.** Nincs `fetch` handler → nincs cache-írás → nincs mit olvasni. Ez nem konfigurációs kérdés, hanem a kód szerkezetéből következő lehetetlenség.
2. **A SW nem is regisztrálódik.** Nincs `navigator.serviceWorker.register()` hívás sehol → friss látogatónál a `sw.js` soha nem is töltődik le.

A történelmi maradvány (2026-07-18 előtti látogatók gépén telepített régi SW) kezelése **aktívan megoldott**: a tombstone a következő `sw.js` frissítés-ellenőrzésnél települ, teljes Cache Storage-bejárással töröl, deregisztrál, és újratölti a nyitott füleket. Ez a maximum, amit szerver-oldalról el lehet érni.

**Nincs teendő.** Az egyetlen LOW (árva ikonok) kozmetikai. Az INFO-3 (`no-store` hiánya) **nem mai kockázat**, de a PWA esetleges visszatérésekor előfeltétellé válik — érdemes ezt a döntést a PWA-visszatérés kapujaként rögzíteni.
