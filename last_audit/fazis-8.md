# Fázis 8 — Infra, headers & deploy-készenlét — audit

> Készült: 2026-07-19 · a go-live előtti utolsó, teljes lefedettségű audit záró (infra) köre.
> Fókusz: a `SecurityHeaders` middleware tartalma (CSP / HSTS / `X-Frame-Options` / `X-Content-Type-Options` / referrer- és permissions-policy); a CORS-felület és a `stripe/*` CSRF-kizárás; a `storage/{path}` publikus fájl-serve (`filesystems.local.serve = true`) GET+PUT végpontjai; a prod-kötelező env-flag-ek (`APP_DEBUG`, `APP_ENV`, `SESSION_SECURE_COOKIE`, éles Stripe/Billingo kulcsok, `SANCTUM_TOKEN_PREFIX`, `ADMIN_EMAIL`) lefedettsége és boot-idejű guardjai; a queue/worker + log éles-config; a `public/` maradványok; és a go-live checklist kód-oldali teljessége.
> Módszer: **multi-agent workflow** — 5 dimenzió-finder párhuzamosan (cáfolásra promptolva), majd minden HIGH/MEDIUM-gyanús leletre **3 független, cáfolásra promptolt adverzariális verifikátor** külön nézőpontból (reprodukció / blast-radius+támadói-modell / mitigáció+teszt-lefedettség), LOW-ra egykörös blast-lencse. Séma-kényszerített leletformátum (fájl, sor, súlyosság, forgatókönyv, kód-bizonyíték, verifikációs verdikt). **Csak dokumentálás — kód nem módosult (audit-no-fixes).**
> Futás: 19 agent (5 finder + 13 verifikátor + a szintézis a scriptben), 0 hiba a teljes futásban. 13 nyers → 12 dedupolt lelet (fájl:sor szerinti összevonás). A CORS/CSRF-finder **üres eredménnyel zárt** (tiszta felület). A kulcs-tények (az `isProduction()` szigorú string-egyezése, a `storage/{path}` aláírás-kapuzása, a `config/app.php` fail-safe `APP_ENV` defaultja) a verifikátorok által **külön kód-olvasással és PHP-méréssel is igazolva**.

## Lefedett dimenziók (5)

1. **SecurityHeaders / CSP / HSTS teljesség** — a header-készlet minden route-on rákerül-e; a CSP/HSTS prod-only aktiválás következményei; `script-src 'unsafe-inline'`, `img-src https:` szélessége; HSTS `includeSubDomains; preload` visszafordíthatatlansága; hiányzó direktívák.
2. **CORS + CSRF-kizárás** — `config/cors.php` léte / `HandleCors` a láncban; a natív kliensek (extension/player) CORS-igénye; a `stripe/*` CSRF-kizárás felületének változatlansága (SESS-L4 regresszió).
3. **`storage/{path}` publikus fájl-serve + `public/` maradványok** — a `serve=>true` GET+PUT végpontok middleware-hiánya és aláírás-kapuja; path-traversal; a disk tényleges használata; `sw.js`/`robots.txt`/`.htaccess`/`oc.php` állapot.
4. **Prod-kötelező env-flag-ek + titok-szivárgás** — `APP_DEBUG`/`APP_ENV`/`SESSION_SECURE_COOKIE`/`SANCTUM_TOKEN_PREFIX`/`ADMIN_EMAIL` kód-szintű boot-guardjai és `.env.example`-dokumentáltsága; a `sanctum.expiration = null` vs. a 90-napos token-TTL tisztázása; repóban maradt kulcs.
5. **Queue/worker + log éles-config + go-live checklist + kliens-artefaktok** — `QUEUE_CONNECTION`/`LOG_*` prod-config; a `public/downloads/topwords-extension.zip` egyezése az auditált forrással; a maradék kód-oldali go-live tételek.

---

## Összegzés

| Súlyosság | Db | Leletek |
|---|---|---|
| **HIGH** | **0** | — |
| **MEDIUM** | **0** | — (ENV-1 finder-MEDIUM → 3-lencsés verifikáció LOW-ra húzta) |
| **LOW** | **11** | HDR-1 · HDR-2 · HDR-3 · HDR-4 · HDR-5 · STORAGE-2 · ENV-1 · ENV-2 · ENV-3 · ENV-4 · LOG-1 |
| **REFUTED** | **1** | STORAGE-3 |

**Go-live blokkoló: 0.** A teljes Fázis 8-felület CLEAN a támadói-triggerelhetőség szempontjából — **egyetlen lelet sem befolyásolható request-adattal**; mind ops/deploy-diszciplína vagy defense-in-depth hardening. A finderek egyetlen MEDIUM-gyanút emeltek (ENV-1, az `APP_ENV`-egyezésre kötött hardening-réteg); a 3 lencsés adverzariális verifikáció **mindhárom lencsén PARTIAL/LOW-ra húzta** (nem támadó-triggerelt, a hiányzó `APP_ENV` fail-safe production-re old, a hatás redeployra öngyógyul). A CORS/CSRF-felület tiszta.

### A három legfontosabb megállapítás

1. **A teljes Fázis 8-ból hiányzik a request-triggerelhető felület — ez a legfontosabb pozitív megállapítás.** A `SecurityHeaders` header-készlete helyes és teljes (a nem-fejlesztést-törő fejlécek — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`, `Permissions-Policy` — feltétel NÉLKÜL futnak; a CSP/HSTS prod-only, mert dev-en törnék a Vite HMR-t). A `stripe/*` CSRF-kizárás a Fázis 1 SESS-L4 óta változatlan (a `stripe/` alatt a webhook az egyetlen mutáló, aláírás-védett route; a `stripe/payment/{id}` GET). CORS-felület nincs: nincs `config/cors.php`, nincs `HandleCors` a láncban — helyesen, mert az extension és a player natív (nem böngésző-origin) kliens, Sanctum Bearer-tokennel, így nem indít CORS-preflightet; sehol nincs `Access-Control-Allow-Origin: *` credentials mellett.

2. **A `storage/{path}` (GET + PUT) valós, de kihasználhatatlan felület — a `serve=>true` egy sosem-használt diszkre nyit két aláírás-kapuzott route-ot.** A `filesystems.local.serve = true` miatt a keret regisztrál egy `GET|HEAD storage/{path}` (`storage.local`) és egy `PUT storage/{path}` (`storage.local.upload`) route-ot, **middleware NÉLKÜL** (a `SecurityHeaders` sem fut rájuk — STORAGE-2). A PUT route tehát tényleg létezik, nem csak a GET. Adverzariálisan azonban **mindkettő megkerülhetetlen**: a `local` disk `root = storage/app/private`, `visibility` kulcs nélkül → `private`, így a `ServeFile`/`ReceiveFile` `hasValidSignature()` **APP_KEY feletti HMAC-aláírást** követel; path-traversal `PathTraversalDetected → 404`; az app **sehol nem generál** ilyen aláírt URL-t (a `local` disk használatlan — `disk('local')`/`Storage::put` grep negatív), és a served válaszra a `ServeFile` **maga rak** `Cache-Control: no-store` + `Content-Security-Policy: default-src none; sandbox` fejlécet. Nincs jogosulatlan olvasás/írás; a mérséklés egyetlen config-sor (`serve => false`), mert a diszk funkció nélküli. → LOW / deploy-hardening.

3. **A prod-hardening-réteg egyetlen `APP_ENV==='production'` string-egyezésen függ — valós ops-törékenység, de nem MEDIUM.** Egy elgépelt `APP_ENV=prod` / `live` / záró-szóköz **némán, egyszerre** kapcsolná ki a CSP-t, a HSTS-t, a `SESSION_SECURE_COOKIE` fail-safe-ot, a `Password::defaults()` erős-jelszó szabályt, a `DB::prohibitDestructiveCommands`-ot és az `AlertAdminOfLoggedError` error-riasztást (mind az `isProduction()` szigorú `=== 'production'`-jén — Fázis 8 verifikátor: `vendor/.../Application.php:775`). A 3 lencsés verifikáció mégis LOW-ra húzta: (a) **nem támadó-triggerelt** — semmilyen request-adat nem folyik az `APP_ENV`-be; (b) a **hiányzó/üres `APP_ENV` fail-SAFE** production-re old (`config/app.php:40` `env('APP_ENV', 'production')`), tehát csak egy aktívan elgépelt, nem-üres string a vektor; (c) **redeployra öngyógyul** (egy `.env`-sor + `config:cache`). Ugyanakkor **nincs boot-idejű guard** ismeretlen `APP_ENV`-re (holott a `STRIPE_WEBHOOK_SECRET`-re van hangos boot-assert az `AppServiceProvider`-ben) — dokumentált LOW hardening-tétel, nem indulás-blokkoló.

---

## Összegző tábla (verifikált leletek)

| id | súlyosság | cím | fájl:sor | verdikt (lencsék) |
|---|---|---|---|---|
| HDR-1 | **LOW** | A CSP+HSTS teljes egésze védőháló nélkül az `APP_ENV==='production'` egyezésen múlik (más réteggel közös single-point) | [SecurityHeaders.php:32](../app/Http/Middleware/SecurityHeaders.php#L32) | CONFIRMED · LOW (ops-only, reverzibilis, defense-in-depth) |
| HDR-2 | **LOW** | `script-src 'unsafe-inline'` — ma nincs kihasználható sink (Blade `e()` semlegesít), de nonce/hash preferálható jövőbeli sinkre | [SecurityHeaders.php:56](../app/Http/Middleware/SecurityHeaders.php#L56) | CONFIRMED · LOW (0 élő sink, hardening backlog) |
| HDR-3 | **LOW** | HSTS `includeSubDomains; preload` — gyakorlatilag visszafordíthatatlan, minden aldomainre HTTPS-t kényszerít | [SecurityHeaders.php:35](../app/Http/Middleware/SecurityHeaders.php#L35) | CONFIRMED · LOW (önkárosító availability-footgun, ops-kontroll) |
| HDR-4 | **LOW** | `serve=>true` middleware-nélküli `storage/{path}` GET+PUT route-okat regisztrál (aláírás-védett, használatlan diszk) | [filesystems.php:36](../config/filesystems.php#L36) | CONFIRMED · LOW (aláírás-kapu + üres diszk, felesleges felület) |
| HDR-5 | **LOW** | `img-src https:` — bármely HTTPS origin engedélyezett (nincs kép-sink, `connect-src 'self'` amúgy is blokkolja az exfilt) | [SecurityHeaders.php:59](../app/Http/Middleware/SecurityHeaders.php#L59) | CONFIRMED · LOW (0 élő hatás, jövőbe-mutató hardening) |
| STORAGE-2 | **LOW** | A `storage/{path}` serve-route-ok a web-csoporton KÍVÜL regisztrálódnak → a `SecurityHeaders` nem fut rájuk (a `ServeFile` maga rak sandbox-CSP-t) | [bootstrap/app.php:29](../bootstrap/app.php#L29) | CONFIRMED · LOW (keret-inherens, `ServeFile` saját izolációja fedi) |
| ENV-1 | **LOW** | A teljes prod-hardening (6 réteg) egyetlen `APP_ENV` string-egyezésen függ — elgépelés (`prod`) némán mindent kikapcsol | [AppServiceProvider.php:64](../app/Providers/AppServiceProvider.php#L64) | PARTIAL · LOW (finder-MEDIUM → 3 lencse mind LOW: nem támadó-triggerelt, unset fail-safe, redeployra gyógyul) |
| ENV-2 | **LOW** | Nincs boot-guard az `APP_DEBUG=true` ellen prodban; a `.env.example` `APP_DEBUG=true` default naiv másolásnál stack-trace-szivárgás | [config/app.php:53](../config/app.php#L53) | CONFIRMED · LOW (kétlépcsős ops-elgépelés, fail-safe default megvan) |
| ENV-3 | **LOW** | `SANCTUM_TOKEN_PREFIX` nincs a `.env.example`-ben → a hoster secret-scanning nem jelzi a szivárgott player-tokent | [config/sanctum.php:68](../config/sanctum.php#L68) | CONFIRMED · LOW (defense-in-depth detekció, tokenek 90-nap TTL-esek) |
| ENV-4 | **LOW** | A `.env.example` nem dokumentál több prod-kritikus kulcsot (`GEMINI_API_KEY`, üres `ADMIN_EMAIL`, prod queue/cache-override) | [.env.example:40](../.env.example#L40) | CONFIRMED · LOW (deploy-doc hézag, minden bukás fail-safe) |
| LOG-1 | **LOW** | Prod-log nincs napi rotációra állítva (`LOG_STACK=single`) — `laravel.log` korlátlanul hízik, nincs kód-oldali retenció | [.env.example:19](../.env.example#L19) | CONFIRMED · LOW (passzív disk-növekedés, `daily` channel készen áll) |
| STORAGE-3 | **REFUTED** | `robots.txt` `Disallow` felsorolja a belső/auth útvonalakat — állított info-szivárgás | [robots.txt:3](../public/robots.txt#L3) | REFUTED · NONE (konvenció-alapú, auth-védett, nem-titok útvonalak) |

**Dedup-megjegyzés:** 1 nyers lelet vonódott össze: a `file-serve` finder `STORAGE-1`-e (`serve=>true` felesleges felület, `config/filesystems.php:36`) és a `headers-csp` finder `HDR-4`-e ugyanarra a config-sorra és mechanizmusra mutatott → **HDR-4 alatt egyesítve**. A `prod-env-secrets` és az `infra-queue-deploy` finder egyaránt `ENV-1` id-t adott két KÜLÖNBÖZŐ leletre (az egyik az `AppServiceProvider` hardening-kötése, a másik a `.env.example` kulcs-hiánya); a report ezeket **ENV-1** (AppServiceProvider) és **ENV-4** (.env.example) néven különíti el.

---

## Leletenkénti részletezés

### ENV-1 — LOW — A teljes prod-hardening réteg egyetlen `APP_ENV` string-egyezésen függ
**Fájl:** [AppServiceProvider.php:64-68](../app/Providers/AppServiceProvider.php#L64) · **Finder-súly:** MEDIUM · **Verdikt:** PARTIAL, súly **LOW** (mind a 3 lencse PARTIAL/LOW)

**Forgatókönyv:** Deploykor a `.env`-be `APP_ENV=prod` (vagy `Production`, `live`, záró-szóköz) kerül a `production` helyett. A Laravel `isProduction()` szigorú `=== 'production'` egyezés (verifikátor méréssel: `vendor/laravel/framework/.../Application.php:775`), így **egyszerre, némán** kikapcsol hat, prodra kötött védelem: (1) `SESSION_SECURE_COOKIE` env-default `false` lesz ([config/session.php:175](../config/session.php#L175)) → session-süti `Secure` flag nélkül; (2) HSTS nem megy ki; (3) CSP nem megy ki ([SecurityHeaders.php:32](../app/Http/Middleware/SecurityHeaders.php#L32)); (4) `Password::defaults()` → `null` ([AppServiceProvider.php:68](../app/Providers/AppServiceProvider.php#L68)) → nincs 12-karakteres/uncompromised jelszó-policy; (5) `DB::prohibitDestructiveCommands(false)` ([:65](../app/Providers/AppServiceProvider.php#L65)) → `migrate:fresh`/`wipe` engedélyezve; (6) az `AlertAdminOfLoggedError` korán visszatér ([:29](../app/Listeners/AlertAdminOfLoggedError.php#L29)) → az error-riasztás elnémul.

**Miért LOW (és miért nem MEDIUM):** mind a három verifikátor PARTIAL/LOW-t adott. (a) **Nincs támadó-trigger** — hat hatás mind egy szerveroldali `.env`-elgépeléstől függ, amelyhez semmilyen route/middleware/input nem vezet; a go-live HIGH-küszöb (támadó-triggerelt VAGY katasztrofális+öngyógyulás-képtelen) egyik ágon sem teljesül. (b) **Fail-safe alapértelmezés már létezik:** [config/app.php:40](../config/app.php#L40) `env('APP_ENV', 'production')` → a hiányzó/üres `APP_ENV` production-re old (minden guard BEKAPCSOL); a veszélyes állapot csak egy aktívan elgépelt, nem-üres string. (c) **Öngyógyulás:** egy `.env`-fix + `config:cache` azonnal helyreállít, nincs irreverzibilis kár; a domináns alhatások hardening/observability jellegűek (a `prohibitDestructiveCommands` kiesése is csak UGYANAZT az operátort védi, aki elgépelte az envet — nem támadó-elérhető), az egyetlen passzív-kihasználható ág (Secure-cookie) is csak TLS-strip/MITM ÉS a `SESSION_SECURE_COOKIE` explicit hiánya mellett hat.

**Valós, de LOW maradék:** nincs boot-idejű guard, ami ismeretlen `APP_ENV`-re elutasítaná/figyelmeztetne a boot-ot — holott a kódbázis ismeri a mintát (`AppServiceProvider` boot-assert a `STRIPE_WEBHOOK_SECRET`-re). A `SessionSecureCookieTest` a helyes `production` fail-safe-et fedi, a typo-ágat nem (teszt-hézag).

**Megfontolandó fix (nem alkalmazva — audit-no-fixes):** boot-idejű `assertKnownEnvironment()` (whitelist: `local`/`testing`/`staging`/`production`, egyébként `RuntimeException`/warn, a webhook-assert mintájára); és/vagy a `SESSION_SECURE_COOKIE` explicit deploy-flagre kötése env-string-egyezés helyett.

---

### HDR-1 — LOW — A CSP+HSTS teljes egésze védőháló nélkül az `APP_ENV==='production'` egyezésen múlik
**Fájl:** [SecurityHeaders.php:32](../app/Http/Middleware/SecurityHeaders.php#L32) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A `SecurityHeaders` a CSP-t ÉS a HSTS-t is csak az `app()->isProduction()` ágban küldi. Ez ugyanaz a single-point, mint az ENV-1 — a HDR-1 kifejezetten a **fejléc-oldalról** dokumentálja: ha az éles `APP_ENV` nem pontosan `production`, az oldal némán CSP és HSTS nélkül megy ki. **Enyhítő tény:** a nem-fejlesztést-törő fejlécek (`X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) feltétel NÉLKÜL futnak, tehát a clickjacking-védelem ilyenkor is él.

**Miért LOW:** ops-only, nem támadó-triggerelt, reverzibilis, defense-in-depth. Egy részállítás **cáfolva**: a finder szerint az üres `APP_ENV` `local`-ra esne — valójában `config/app.php:40` fail-safe production-re old. A valós vektor csak a nem-üres hibás érték vagy a `.env.example` szerkesztetlen másolása. (Az ENV-1-gyel közös gyökér; a fixet ott dokumentáljuk.)

---

### HDR-2 — LOW — `script-src 'unsafe-inline'` — ma nincs kihasználható sink
**Fájl:** [SecurityHeaders.php:56](../app/Http/Middleware/SecurityHeaders.php#L56) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A CSP `script-src 'self' 'unsafe-inline'`-t enged. Az egyetlen dinamikus adatot fogadó inline script a root Blade-ben van (`app.blade.php:11` `const appearance = '{{ $appearance ?? "system" }}'`), és a `$appearance` a **nem titkosított** `appearance` cookie-ból jön (`encryptCookies except`), tehát értéke elvben támadó-kontrollált.

**Miért LOW:** a verifikátor **PHP-méréssel** igazolta, hogy a Blade `{{ }}` = `e()` = `htmlspecialchars(ENT_QUOTES)` semlegesíti a breakout-ot (`'` → `&#039;`, `</script>` → `&lt;/script&gt;`) `<script>` kontextusban; `grep '{!!'` a `resources/views/` alatt **0 találat**; a két kliens-oldali `dangerouslySetInnerHTML` megbízható forrás (Fortify QR-SVG) illetve sanitizált (`sanitizeHtml`). Élő kihasználható sink: **0**. A kockázat tisztán jövőbe-mutató (egy jövőbeli untrusted inline sink nem kapna védelmet); a két statikus inline blokk ideális nonce/hash-jelölt.

---

### HDR-3 — LOW — HSTS `includeSubDomains; preload` gyakorlatilag visszafordíthatatlan
**Fájl:** [SecurityHeaders.php:35](../app/Http/Middleware/SecurityHeaders.php#L35) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`. A `preload` beküldés a böngészők HSTS-preload listájára rövid távon gyakorlatilag visszafordíthatatlan (removal request után is hetekig bennmarad), az `includeSubDomains` pedig a `topwords.eu` MINDEN aldomainjére HTTPS-t kényszerít.

**Miért LOW:** a header hardcoded literál (nincs injekciós felület, nincs request-input); nem támadó-triggerelhető. A hibamódja kizárólag **availability** (egy jövőbeli csak-HTTP-s aldomain — régi blog/mail-UI/staging-sub — elérhetetlenné válna a már-meglátogatott böngészőkben), sosem confidentiality/privilege. Önkárosító, összetett, jövőbeli forgatókönyv; a mitigáció (minden aldomain HTTPS-en) standard. A puszta header-kiadás önmagában nem iratja fel a domaint a preload-listára — az egy külön ops-akció.

**Megfontolandó (nem fix):** go-live előtt tudatosan megerősíteni, hogy az apex + minden tervezett aldomain csak-HTTPS lesz, mielőtt a domaint a `hstspreload.org`-ra beküldik.

---

### HDR-4 — LOW — `serve=>true` middleware-nélküli `storage/{path}` GET+PUT route-okat regisztrál (aláírás-védett, használatlan diszk)
**Fájl:** [filesystems.php:36](../config/filesystems.php#L36) · **Verdikt:** CONFIRMED, súly **LOW** · *(egyesítve a `file-serve` finder STORAGE-1-ével)*

**Forgatókönyv:** A `local` disk `serve => true` miatt a keret regisztrál egy `GET|HEAD storage/{path}` (`storage.local`) és egy `PUT storage/{path}` (`storage.local.upload`) route-ot, **minden middleware-csoport (web/auth) nélkül** (`route:list -v` verifikálva). A PUT route tehát valóban létezik — nem csak a GET.

**Miért LOW:** adverzariálisan **mindkettő megkerülhetetlen**. A `local` disk `root = storage_path('app/private')`, `visibility` kulcs nélkül → `private`, így a `ServeFile::hasValidSignature()` a public-ág FALSE-ja miatt **APP_KEY feletti HMAC relatív-aláírást** követel; a `ReceiveFile` `?upload=1` + valid aláírást; `PathTraversalDetected → 404`. Az app **sehol nem használja a local disket** (`disk('local')`/`Storage::put`/`temporaryUrl` grep negatív) → nincs kiadott aláírt URL, amit replay-elni/tamperelni lehetne, és APP_KEY nélkül a támadó nem hamisíthat aláírást. Nincs jogosulatlan olvasás/írás. Felesleges támadási felület (két végpont, ami a `SecurityHeaders`-t és a rate-limitet sem kapja), amit `serve => false`-ra állítva ki lehet iktatni, mert a diszk funkció nélküli.

---

### HDR-5 — LOW — `img-src https:` — bármely HTTPS origin engedélyezett
**Fájl:** [SecurityHeaders.php:59](../app/Http/Middleware/SecurityHeaders.php#L59) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A CSP `img-src 'self' data: https:` — bármely HTTPS originről tölthet képet, ami elvben tetszőleges-origin tracking/beacon vektor lenne.

**Miért LOW:** nincs untrusted-HTML sink, ami támadó-kontrollált `<img src=...>` tag-et rendelne. A verifikátor igazolta: a stored rich text sanitizerén (`sanitize-html.ts`) az `img` tag **nincs az allowlisten → unwrap-olódik** (a tag eltűnik), a másik `dangerouslySetInnerHTML` a Fortify 2FA QR-SVG, és a React kódbázisban **0** `<img src={dinamikus-user-adat}>` binding van. Ráadásul a `connect-src 'self'` (60. sor) eleve blokkolja a fetch/XHR/beacon-exfiltrációt. Élő hatás: 0. Tisztán jövőbe-mutató hardening (szűkebb whitelist: `self` + `data:` + a ténylegesen használt `fonts.bunny.net`).

---

### STORAGE-2 — LOW — A `storage/{path}` serve-route-ok a web-csoporton KÍVÜL regisztrálódnak → a `SecurityHeaders` nem fut rájuk
**Fájl:** [bootstrap/app.php:29-35](../bootstrap/app.php#L29) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A `SecurityHeaders` csak a `$middleware->web(append: [...])` láncba kerül; a `storage/{path}` route-okat a `FilesystemServiceProvider` bare `Route::get/put(...)->where('path','.*')`-tal regisztrálja, csoport/middleware nélkül — így a globális X-Frame-Options / X-Content-Type-Options / CSP hardening nem alkalmazódik rájuk.

**Miért LOW:** enyhítő tény, hogy a served válaszra a `ServeFile` **maga rak** `Cache-Control: no-store` + `Content-Security-Policy: default-src none; style-src unsafe-inline; sandbox` fejlécet — a `sandbox` erősebb keret-tiltás, mint az `X-Frame-Options`, a `default-src none` minden subresource-t blokkol. A legérdemibb izoláció tehát keret-szinten megvan. A diszk üres, a GET aláírás-kapuzott (lásd HDR-4), így valós hatás nincs; keret-inherens registrációs sajátosság, nem ops-elgépelés és nem támadó-triggerelhető. A HDR-4 `serve => false` mitigációja ezt is okafogyottá teszi.

---

### ENV-2 — LOW — Nincs boot-guard az `APP_DEBUG=true` ellen prodban
**Fájl:** [config/app.php:53](../config/app.php#L53) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** `config/app.php:53` helyes fail-safe defaultot ad (`(bool) env('APP_DEBUG', false)`), de nincs kódszintű assert, ami prodban (`APP_ENV=production`) leállítaná/figyelmeztetne, ha az `APP_DEBUG` mégis `true`. A `.env.example`-ben `APP_DEBUG=true` a default (`:4`) — igaz, `APP_ENV=local` profillal. A kockázat csak akkor sül el, ha valaki a `.env.example`-t vaktában prod `.env`-nek másolja, az `APP_ENV`-et `production`-ra állítja, de az `APP_DEBUG=true` sort bent felejti → részletes Whoops/Ignition stack trace + config-értékek szivárognak minden 500-as hibán.

**Miért LOW:** kétlépcsős ops-elgépelés (egy sort módosítani ÉS egy másikat elfelejteni), nem támadó-triggerelt, a helyes default kódban megvan, és a következmény (info-disclosure) reverzibilis (egy `.env`-sor + `config:clear`), nem ad ingyen hozzáférést/pénz-előnyt/tömeges exfiltrációt. A kódbázis ismeri a boot-guard mintát (`assertStripeWebhookSecured`), így egy debug-assert indokolt lenne — de nem blokkoló.

---

### ENV-3 — LOW — `SANCTUM_TOKEN_PREFIX` nincs a `.env.example`-ben
**Fájl:** [config/sanctum.php:68](../config/sanctum.php#L68) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** `config/sanctum.php:68` `'token_prefix' => env('SANCTUM_TOKEN_PREFIX', '')` (üres default), és a `.env.example` egyáltalán nem listázza a változót, így deploykor senki nem állítja be. Következmény: a kiadott player-tokeneknek nincs felismerhető prefixük → a GitHub/git-hoster secret-scanning nem tudja jelezni, ha egy player-token véletlenül repóba/logba kerül (a prefix pont ezt a detekciós integrációt szolgálná).

**Miért LOW / a memória-állítás tisztázása:** defense-in-depth **másodlagos detekció**, nem sebezhetőség — a prefix nem előz meg visszaélést, csak ÉRTESÍT szivárgáskor. **A `sanctum.expiration = null` MOOT:** az egyetlen `createToken` ([PlayerPairingController.php:150-154](../app/Http/Controllers/PlayerPairingController.php#L150)) explicit `now()->addDays(90)` lejáratot ad (`PlayerPairing::TOKEN_LIFETIME_DAYS = 90`) → **nincs örökéletű token**, egyezik a memóriában rögzített „player-token 90 nap"-pal. Az extension nem is Bearer-tokent használ (session-cookie auth); a Sanctum-tokenek kizárólag player-tokenek. Worst case: 1 szivárgott token = 1 user player-ability, ≤90 nap TTL, Settingsből visszavonható.

**Megfontolandó (nem fix):** `.env.example`-be egy `SANCTUM_TOKEN_PREFIX=tpw_` sor + prod beállítás, hogy a scanning-integráció aktiválódjon.

---

### ENV-4 — LOW — A `.env.example` nem dokumentál több prod-kritikus kulcsot
**Fájl:** [.env.example:40](../.env.example#L40) · **Verdikt:** CONFIRMED, súly **LOW** · *(a `prod-env-secrets` finder ENV-1-e ütközött id-ben az AppServiceProvider-leletével; ez a `.env.example`-lelet ENV-4-re átnevezve)*

**Forgatókönyv:** Egy tiszta VPS-újratelepítés a `.env.example`-ből indul referencia-sablonként. Több, csak kódból ismert prod-kritikus kulcs hiányzik vagy üres: `GEMINI_API_KEY` teljesen hiányzik (`config/services.php:54` olvassa; üresen minden AI-lookup hibára/kör-megszakítóra fut — de self-inflicted); `ADMIN_EMAIL=` üres (`MonitorFailedJobs.php:40` üres esetén `return FAILURE` → a failed-jobs riasztás csendben elmarad; ütemezve `routes/console.php:22` `everyTenMinutes`); és nincs listázva a prod-ban használt Redis/queue-override (a sablon `QUEUE_CONNECTION=database`-t mutat).

**Miért LOW:** kizárólag ops-elgépelés triggereli (a `.env` git-ignore-olt, kézzel szerkesztett; a sablon csak referencia). Minden bukás **fail-safe**: az AI hiba-irányba bukik (nem GRANT-ol), a failed job **bent marad** a táblában (retryelhető, semmi nem semmisül meg — csak az admin-e-mail nem megy ki, ami observability-vakfolt), a database queue-driver helyesen fut; mind reverzibilis `.env`-szerkesztéssel + config-cache-sel. Nincs támadó-trigger, ingyen hozzáférés, pénz-előny vagy adat-kiszivárgás. *(Az üres `ADMIN_EMAIL` observability-hatását a Fázis 7 ALERT-1 már rögzítette; ez a lelet a `.env.example`-dokumentáltság oldaláról egészíti ki, nem duplikálja.)*

---

### LOG-1 — LOW — Prod-log nincs napi rotációra állítva (`LOG_STACK=single`)
**Fájl:** [.env.example:19](../.env.example#L19) · **Verdikt:** CONFIRMED, súly **LOW**

**Forgatókönyv:** A `.env.example` `LOG_STACK=single`-t ír, a `stack` channel ezt örökli (`config/logging.php:57`), így prodban is egyetlen, sosem forgatott `storage/logs/laravel.log`-ba ír minden. A `daily` channel (14 napos retenció, `config/logging.php:68-74`) készen áll, de nincs bekötve → a log-fájl korlátlanul nő (hosszú távú disk-telítődés), nincs automatikus retenció.

**Miért LOW:** passzív, csak a saját app írja; `grep app/ Log::debug` = **0 találat** (a tényleges Log-hívások ritka, belső hiba/riasztási úton mennek), tehát a `LOG_LEVEL=debug` prodban **nem valós szivárgás** (a legrészletesebb kibocsátott szint az `info`, a vendor-deprecation `LOG_DEPRECATIONS_CHANNEL=null`-ra megy). Támadó nem tudja szándékosan méretre pumpálni a fájlt. Nem irreverzibilis (a fájl bármikor forgatható/törölhető), a mitigáció egyetlen `.env`-sor (`LOG_STACK=daily` + `LOG_DAILY_DAYS=14`) vagy szerver-oldali `logrotate`.

---

### STORAGE-3 — REFUTED — `robots.txt` `Disallow`-listája állítólagos info-szivárgás
**Fájl:** [robots.txt:3-13](../public/robots.txt#L3) · **Verdikt:** REFUTED, súly **NONE**

**Állítás:** A `robots.txt` explicit `Disallow`-listája (`/dashboard`, `/words`, `/folders`, `/settings` + minden auth-útvonal) felfedi a belső útvonal-térképet.

**Miért REFUTED:** a `Disallow` **zéró titkos tudást** ad hozzá. A listázott app-útvonalak auth+verified fal mögöttiek (Fázis 1: IDOR-mentes), az auth-útvonalak (`/login`, `/register`, `/reset-password`, `/two-factor-challenge` stb.) **stock Laravel Fortify konvenciós útvonalak** a kanonikus URL-en — bárki, aki felismeri, hogy ez Laravel/Fortify app (amit a header-ek/cookie-nevek/markup már elárul), másodpercek alatt kitalálja őket. Semmi sem érhető el ezeken az útvonalakon érvényes hitelesítés nélkül; nincs ingyen hozzáférés, pénz-előny, adat-kiszivárgás; a „2FA aktív megerősítése" gyenge (a `/two-factor-challenge` amúgy is csak helyes jelszó után jelenik meg 2FA-s fióknál). Best-practice higiéniai észrevétel (egyetlen `Disallow: /` tisztább lenne), **nem** biztonsági defektus.

---

## Tiszta felületek (finder-verifikált, lelet nélkül)

- **CORS** — nincs `config/cors.php`, nincs `HandleCors` a middleware-láncban. Az extension és a player **natív (nem böngésző-origin) kliens** Sanctum Bearer-tokennel, így nem indít CORS-preflightet; nincs böngésző-oldali cross-origin fetch, ami CORS-hiány miatt törne. Sehol nincs `Access-Control-Allow-Origin: *` credentials mellett. → a CORS/CSRF-finder üres eredménnyel zárt.
- **`stripe/*` CSRF-kizárás** — a Fázis 1 SESS-L4 óta változatlan: a `stripe/` prefix alatt (route:list) a `POST stripe/webhook` az egyetlen mutáló, aláírás-védett route; a `stripe/payment/{id}` GET. A `bootstrap/app.php` `validateCsrfTokens(except: ['stripe/*'])` felülete nem bővült.
- **`SecurityHeaders` alap-készlet** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Permitted-Cross-Domain-Policies: none`, `Permissions-Policy` (camera/mic/geolocation/payment/usb/interest-cohort mind letiltva) — feltétel nélkül, minden web-válaszon.
- **`public/` maradványok** — nincs `oc.php` (ellenőrizve); a `.DS_Store` git-ignore-olt és NEM trackelt (helyi artefakt); a `.htaccess` `Options -Indexes -MultiViews` tiltja a könyvtár-listázást; a `sw.js` a SW-2 (Fázis 4) self-destruct tombstone, jogos.
- **`public/downloads/topwords-extension.zip`** — 17 fájl, kizárólag az auditált extension-forrás (manifest + `src/` + ikonok + popup); nincs benne dev-maradvány/érzékeny fájl.
- **Sanctum token-élettartam** — a `sanctum.expiration = null` config-szintű alap MOOT: a player-tokenek explicit 90-napos TTL-t kapnak a `PlayerPairingController`-ben (lásd ENV-3).

## Nyitva maradt, NEM kód (ops/deploy — kontextus)

Ezek NEM leletek — a go-live checklist tiszta ops-tételei, kód-oldali teendő nélkül:

- **Prod `.env` értékek** (a szerveren, nem a repóban): `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, éles `STRIPE_*`/`BILLINGO_*` kulcsok, `GEMINI_API_KEY`, nem-üres `ADMIN_EMAIL`, `SANCTUM_TOKEN_PREFIX`, prod `QUEUE_CONNECTION`/`CACHE_STORE`, `LOG_STACK=daily`.
- **Worker + cron:** a `queue:work` és a `schedule:run` cron éles indítása/felügyelete (Ploi), a `MonitorFailedJobs` `everyTenMinutes` heartbeatje (Fázis 7 SCHED-1 kontextus).
- **Log-retenció:** `LOG_STACK=daily` vagy szerver-oldali `logrotate` (LOG-1 ops-oldala).
- **HSTS preload:** apex + minden tervezett aldomain csak-HTTPS megerősítése a `hstspreload.org`-beküldés előtt (HDR-3).
- **Infra:** DNS, HTTPS/TLS-termináció, uptime/CPU-RAM-disk monitor (Ploi/UptimeRobot), Chrome Web Store extension-feltöltés, éles Stripe/Billingo árak.

## Megfontolandó defense-in-depth fixek

Egyik sem go-live-blokkoló; prioritási sorrendben. **Az 1–4. tétel 2026-07-20-án ALKALMAZVA** (a felhasználó explicit kérésére, az audit-no-fixes után):

1. **✅ ALKALMAZVA — Boot-idejű `assertKnownEnvironment()`** — az `AppServiceProvider`-ben whitelist (`local`/`testing`/`staging`/`production`), egyébként `RuntimeException` (ENV-1 + HDR-1 közös gyökere; a `STRIPE_WEBHOOK_SECRET` boot-assert mintájára). Ez a legmagasabb hozamú tétel, mert egyszerre fedi a legtöbb LOW-t. Teszt: `EnvironmentBootGuardTest` (ENV-1 ág).
2. **✅ ALKALMAZVA — `APP_DEBUG=true`-assert prodban** (ENV-2) — `assertDebugDisabledInProduction()`, ugyanabban a boot-guard-blokkban. Teszt: `EnvironmentBootGuardTest` (ENV-2 ág).
3. **✅ ALKALMAZVA — `filesystems.local.serve => false`** (HDR-4/STORAGE-2) — a használatlan diszk két felesleges route-jának kiiktatása. Verifikálva: `route:list` alatt nincs `storage/` route. Őrszem-teszt: `StorageServeDisabledTest`.
4. **✅ ALKALMAZVA — `.env.example` kiegészítése** — `GEMINI_API_KEY`, `SANCTUM_TOKEN_PREFIX=tpw_`, explicit `APP_ENV`/`APP_DEBUG` prod-komment, `ADMIN_EMAIL` magyarázat, `LOG_STACK=daily` prod-komment (ENV-3 + ENV-4 + LOG-1 doc-oldala).
5. **CSP `nonce`/`hash`** a két statikus inline blokkra, majd `'unsafe-inline'` elhagyása + szűkebb `img-src` (HDR-2 + HDR-5) — jövőbe-mutató hardening, **nem alkalmazva** (nagyobb frontend-átalakítás, 0 élő sink).

**A javítások után: 731 teszt zöld, Pint tiszta.** Nyitva már csak a HDR-2/HDR-5 CSP-szűkítés (opcionális, 0 élő hatás) és a tisztán ops/deploy tételek (prod `.env` + worker/cron + monitor + HSTS-preload megerősítés).

---

**Az utolsó átfogó audit (Fázis 0–8) ezzel a fázissal lezárult a kód-oldalon.** A Fázis 8 nem talált go-live-blokkolót; a teljes infra/header/deploy-felület request-triggerelhető sebezhetőségtől mentes. A megmaradt teendők ops/deploy-diszciplína (prod `.env` + worker/cron + monitor) és opcionális defense-in-depth hardening.
