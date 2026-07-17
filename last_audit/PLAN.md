# Utolsó átfogó audit — TELJES terv (v3)

> Készült: 2026-07-17 · go-live előtti utolsó, teljes lefedettségű biztonsági + korrektségi audit.
> Fókusz: **cross-cutting / integrációs** — a rendszer egészét nézi, nem az egyes feature-öket külön.
> A terv a tényleges kód-felülethez igazítva (2026-07-17-i bejárás):
> **129 saját route (165 összesen a vendorral) · 30 controller · 18 modell · 10 service · 1 job · 5 console parancs · 3 policy · 3 notification · 2 listener · 8 FormRequest.**
> **Kliensek:** Chrome-extension (`chrome-extension/`) + Electron desktop player (`topwords-player/`) — ezek is kód-felület.

## Kiinduló állapot (2026-07-17)

- Working tree tiszta (csak `.claude/settings.json` permission-bővítés, nem alkalmazás-kód).
- Branch szinkronban `origin/main`-nel, nincs nem-pusholt commit, nincs stash, nincs elárvult kódfájl.
- **659 teszt zöld** (2492 assertion).
- `composer audit` = 0 sebezhetőség · `npm audit --omit=dev` = 0 sebezhetőség.
- A memória-indexben "commitolatlan"-ként jelölt LOW-fixek valójában mind be vannak commitolva.

## Miért v3 (mi maradt ki az első két tervből)

Az első terv a "feature-eket entity-enként már auditáltuk" feltevésre támaszkodott; a v2 hozzáadott 4 vakfoltot.
A **teljes kód-felület bejárása** (route:list + könyvtár-térkép) után **további rendszerszintű felületek** derültek ki,
amelyek egyik korábbi tervben sem szerepeltek — ezek nélkül az audit NEM teljeskörű:

- **`storage/{path}` publikus fájl-serve** (GET + PUT, `filesystems.local.serve = true`, **middleware NÉLKÜL**) —
  Laravel `LocalController` végpont: path-traversal / tetszőleges olvasás- és írás-felület. Sosem auditálva.
- **Kliens-kód mint támadási felület:** Electron player IPC/preload (`contextIsolation`, `openExternal`, deep-link),
  Chrome-extension `background.js` + content-script üzenetkezelés (`isTrusted`, origin-ellenőrzés). Eddig csak backend-nézőpont.
- **Fortify auth-felület:** 2FA-flow, jelszó-reset, jelszó-megerősítés, `REGISTRATION_ENABLED` kapcsoló, egyedi rate-limiterek.
- **Session/cookie + `SecurityHeaders` + CORS + CSRF-kizárás** (`stripe/*` a CSRF alól kivéve — helyes-e).
- **Config-tényellenőrzés:** `SESSION_SECURE_COOKIE` (env-függő, prod-kötelező), `sanctum.expiration = null`
  (token sosem jár le — ütközik a memóriában rögzített "player-token 90 nap"-pal → tisztázandó).

Az eredeti 5 → v2 9 → **v3 10 fázis** (az új Fázis 4b: kliens-kód + publikus fájl-felület).

---

## Fázisok

### Fázis 0 — Alapállapot
- Teszt-suite (`php artisan test`), Pint `--test`, `composer audit`, `npm audit`.
- Teljes `route:list` térkép (middleware-oszloppal) → minden route besorolása: publikus / auth / auth+verified / sanctum.
- `.env.example` ↔ éles `.env` elvárás-diff (kulcs-lista, nem érték); a prod-kötelező flag-ek listája (lásd Fázis 8).

### Fázis 1 — Auth, session, jogosultság (rendszerszintű)
- Middleware-láncok bejárása minden route-csoporton (`auth`, `verified`, `auth:sanctum`, `abilities:*`, `throttle`, `EnsureOnboardingComplete`).
- **Middleware-en KÍVÜLI, kézi auth-ellenőrzések** — amit a middleware-bejárás definíció szerint kihagy:
  `pricing/success` kontroller-oldali `hasValidSignature()`, `sitemap.xml` publikus closure, Stripe-webhook aláírás.
- **Fortify auth-flow:** 2FA engedélyezés/megerősítés/letiltás + recovery-kódok, jelszó-reset token-élettartam,
  `password.confirm` érzékeny műveleteknél, `REGISTRATION_ENABLED=false` szerveroldali zárásának tényleges hatása,
  login/register/2fa/password-request rate-limiterek (`FortifyServiceProvider`).
- **Session hardening:** `AuthenticateSession` a láncban, `same_site`, `http_only`, `SESSION_SECURE_COOKIE` prod-kötelezőség,
  session-invalidálás jelszó-/email-váltáskor, token-rotálás.
- Player-token + extension-token életciklus, visszavonás, lejárat egységessége — **`sanctum.expiration = null` tisztázása**
  (kódban van-e explicit `expires_at`/TTL a player/extension tokeneken, vagy tényleg örökéletűek).
- **IDOR-sweep mind a 129 saját route `{id}`/`{slug}`/`{token}` bindingjén** — A user → B erőforrása, minden entity:
  Word, Folder, Flashcard*, FlashcardDeck/Folder, Quiz, Cloze, UserBook, PlayerPairing, UserCustomWord, Invite, BillingoInvoice.
  Policy-lefedettség: csak 3 policy (Folder, FlashcardFolder, UserCustomWord) létezik — a többi entity hol authorizál?
- **`ReviewController` (`review` + `POST review/complete`)** — státusz-alapú review külön feature:
  IDOR (más user szavának státusz-mutációja), streak-könyvelés race, `MAX_PER_SESSION` plafon-bypass,
  a review-intervallum (`INTERVALS`) helyes alkalmazása.

### Fázis 2 — Pénz & előfizetés end-to-end
- Webhook-idempotencia és out-of-order események (W-M1/W-L5 regresszió-ellenőrzés).
- `stripe/*` CSRF-kizárás helyessége: aláírás-verifikáció az egyetlen védelem — megkerülhetetlen-e.
- Free↔Pro átmenetek minden limitkapunál (napi írás, flashcard-slot, AI-keret) — TOCTOU/race.
- Billingo/NAV számlázás fail-módok (Stripe siker + Billingo hiba), `GenerateBillingoInvoice` job idempotencia + PII a payloadban.

### Fázis 3 — AI-terhelés, cache-izoláció & költség
- Rate-limit + kvóta minden AI-belépési ponton (web, extension, player) egységes-e (`AiUsageService`).
- Circuit breaker + 429-mapping + cache viselkedés kimaradás alatt (`AiCacheService`).
- **`AiWordCache` megosztott-cache izoláció** — nem szivárog-e egyik user tartalma a másikhoz; cache-poisoning
  (cache-kulcs képzése: user-független szó-kulcs helyes-e, tartalmazhat-e egyik user PII-jét).

### Fázis 4a — Külső integrációk & SSRF
- **`text-analysis/fetch-source` SSRF-felület** — user-megadott URL szerver-oldali letöltése.
  A `assertPublicHost` + `safeFetch` védelem (per-hop host-újravalidálás, `CURLOPT_RESOLVE` IP-pinnelés
  DNS-rebinding ellen, `MAX_FETCH_BYTES` guard) **megkerülhetetlenségének** verifikálása:
  IPv6 / redirect-lánc / a video-ID ág megkerüli-e a host-ellenőrzést / relatív-redirect resolve / `file://`,`gopher://` séma.
- **YouTube caption/transcript lánc** (`YouTubeCaptionService`, `YoutubeTranscript`, `UserBook`):
  külső API-hiba kezelés (`TransientCaptionException`), parsing-injection, méret/cost-plafon, IDOR a könyveken.

### Fázis 4b — Publikus fájl-felület & kliens-kód  *(ÚJ)*
- **`storage/{path}` (GET + PUT):** él-e egyáltalán éles konfigban; ha igen — path-traversal, tetszőleges olvasás/írás,
  auth hiánya. Ha nincs rá funkcionális igény → deploy-checklistbe a route/`serve:true` kikapcsolása.
- **`FlashcardCsvController` + `TextAnalysisController:1611` fájl-feltöltés:** MIME/kiterjesztés/méret-validáció,
  CSV-injection (`=`,`+`,`-`,`@` cellák), memória-robbanás nagy fájlnál.
- **Electron player** (`topwords-player/src/main.js`,`preload.js`): `contextIsolation:true`/`nodeIntegration:false` megerősítés,
  `shell.openExternal` cél-URL validáció (csak várt origin), deep-link/protocol-handler injection, token tárolása (`auth-store.js`).
- **Chrome-extension** (`background.js`, content/`src`): `chrome.runtime.onMessage` origin/`sender` ellenőrzés,
  `isTrusted`-guard (M2 regresszió), CSP/host_permissions túl-tág-e a `manifest.json`-ban, token-tárolás.
- **PWA service worker** (`public/sw.js` + workbox + `offline.html` + `build/registerSW.js`) *(v3-kiegészítés az ellenőrzés után)*:
  a `NetworkFirst` "pages-cache" bejelentkezett oldalak HTML-válaszait is cache-eli — logout utáni adat-maradvány
  megosztott gépen; elavult precache deploy után; `SKIP_WAITING` update-flow; külső `fonts.bunny.net` CacheFirst.
- **`public/downloads/topwords-extension/` kicsomagolt könyvtár** *(v3-kiegészítés)*: publikusan szolgált extension-forrás —
  egyezik-e az auditált zip-pel, nincs-e benne dev-maradvány/érzékeny fájl.

### Fázis 5 — Gamification & onboarding
- **Achievement/pont-kiadás race-ei** (`AchievementService`, `UserAchievement` — a Q-L3 fix jelzi a kockázatot):
  dupla-kiadás konkurens kérésnél, unique-constraint megléte.
- **Onboarding flow** state-manipuláció (`OnboardingController`, `EnsureOnboardingComplete` middleware):
  átugorható-e a lépéssor, van-e olyan védett route ami onboarding nélkül elérhető / fordítva lock-out.

### Fázis 6 — Input/output biztonság
- Mass-assignment / `$fillable` (és `$guarded`) sweep mind a 18 modellen — érzékeny mező (pl. `is_admin`,`stripe_id`,`ai_*`) átírható-e.
- **Minden mutáló route-nak van-e validációja** — csak **8 FormRequest** létezik; a többi mutáló végpont inline `validate()`-tel
  vagy validáció nélkül dolgozik? Végpontonkénti lefedettség-lista.
- XSS / render-injection az AI-generált és user-tartalom megjelenítésénél (React `dangerouslySetInnerHTML` sweep + extension DOM-írás).
- CSV / fájl import-export edge-ek (encoding, méret, sortörés) — kereszthivatkozás Fázis 4b-vel.

### Fázis 7 — Console commands & scheduled
`EndTrialNow`, `FixWordLevels`, `ImportWords`, `ClearAiCache`, `MonitorFailedJobs` —
destruktivitás, guard-ok (prod-ban futtatható-e véletlenül tömeges mutáció), scheduler-regisztráció (`console.php` / `withSchedule`),
`MonitorFailedJobs` → `FailedJobsDetected`/`QueueBacklogDetected`/`ApplicationErrorDetected` riasztási lánc működése.

### Fázis 8 — Infra, headers & deploy-készenlét
- **`SecurityHeaders` middleware tartalma:** CSP, HSTS, `X-Frame-Options`/frame-ancestors, `X-Content-Type-Options`, referrer-policy — teljes-e.
- **CORS** (`config/cors.php`): mely origin-ek engedélyezettek az extension/player felé; nem `*`-e credentials mellett.
- `public/`-ban maradt debug/dev-fájlok (`oc.php`, `.DS_Store` a `downloads/`-ban), `.env`/kulcs-szivárgás.
- **Prod-kötelező env flag-ek explicit listája:** `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, `APP_ENV=production`,
  éles Stripe/Billingo kulcsok, `SANCTUM_TOKEN_PREFIX`, `ADMIN_EMAIL`.
- Queue/worker + failed_jobs + error-log riasztás éles-config.
- Go-live checklist véglegesítés (Stripe/Billingo éles kulcsok, DNS, HTTPS, CWS-feltöltés).

---

## Lefedettség-mátrix (mi biztos benne van)

| Felület | Fázis |
|---|---|
| 129 saját route middleware + IDOR | 1 |
| Fortify auth (2FA, reset, confirm, registration flag) | 1 |
| Session/cookie/token élettartam | 1 |
| ReviewController (status-SRS) | 1 |
| Stripe webhook + Cashier + limitkapuk | 2 |
| Billingo/NAV job | 2 |
| AI kvóta + AiWordCache izoláció | 3 |
| SSRF (fetch-source) + YouTube lánc | 4a |
| storage/{path} publikus fájl-serve | 4b |
| Fájl-feltöltés (CSV + TA) | 4b |
| Electron player IPC/preload | 4b |
| Chrome-extension üzenetkezelés | 4b |
| PWA service worker (sw.js cache) | 4b |
| public/downloads kicsomagolt extension | 4b/8 |
| Achievements + Onboarding | 5 |
| Mass-assignment + FormRequest-lefedettség + XSS | 6 |
| 5 console command + scheduler + riasztás | 7 |
| SecurityHeaders + CORS + prod-env + go-live | 8 |

## Nyitva maradt, NEM kód (kontextus)

- **Ops/deploy:** VPS `route:cache`/`migrate:status`, worker/cron + `ADMIN_EMAIL`, uptime/CPU-RAM-disk (Ploi), `rm public/oc.php`.
- **Külső feltöltés:** Chrome Web Store extension-feltöltés, éles Stripe/Billingo árak go-live-kor.
- **Szándékos "nincs értelmes fix" maradékok:** W-L5(a) árva partner, pause-collection (portálon tiltva),
  device-flow phishing (PL-L2/L3), AI-L2 cache-stampede.

## Futtatási opciók (eldöntendő)

1. **Mód:** szekvenciális (én bejárva) VAGY multi-agent workflow (párhuzamos finder + adverzariális verifikáció; alaposabb, több token).
2. **Kimenet:** riport `last_audit/`-ba + **csak dokumentálás** (audit-no-fixes szabály) VAGY riport + HIGH/MEDIUM azonnali fix.
