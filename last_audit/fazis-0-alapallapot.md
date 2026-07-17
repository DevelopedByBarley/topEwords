# Fázis 0 — Alapállapot (2026-07-17)

## Eredmények

| Ellenőrzés | Eredmény |
|---|---|
| Teszt-suite | ✅ **659 passed** (2492 assertion), 25s |
| `composer audit` | ✅ 0 sebezhetőség |
| `npm audit --omit=dev` | ✅ 0 sebezhetőség |
| Pint `--test` | ⚠️ csak nem-app-kód: 5 tesztfájl EOF-újsor, `tests/Pest.php` import-sorrend, + a teljes `backup/before billing/` legacy-könyvtár (24 fájl). `app/`, `config/`, `routes/`, `database/` tiszta. |
| Git | ✅ tiszta (csak `.claude/settings.json` + követetlen `last_audit/`), szinkron `origin/main`-nel |

## Route-térkép (165 route, middleware szerint csoportosítva)

Teljes térkép: scratchpad `routes_by_mw.txt` (fázisok bemenete). Besorolás:

- **Middleware NÉLKÜL (4):** `POST _boost/browser-logs`, `GET+PUT storage/{path}`, `GET up`
  - `filesystems.disks.local.serve = true` **megerősítve** → a `storage/{path}` route ÉL. → **Fázis 4b**
  - `_boost/browser-logs`: Boost dev-eszköz; prod-ban nem regisztrálódhat → **Fázis 8 prod-flag lista**
- **Publikus web (9):** `/`, `guide`, `handbook`, `pricing`, `pricing/success`, `privacy`, `terms`, `sitemap.xml`, `sanctum/csrf-cookie`
  - `pricing/success` kontroller-oldali `hasValidSignature()` → **Fázis 1**
- **⚠️ Extension route-ok (8): `web` + throttle, `Authenticate` middleware NÉLKÜL** —
  `extension/badge|decks|lookup|search|statuses|add-word|create-flashcard|youtube-transcript`.
  Auth valószínűleg kontroller-oldali (session/token) → **Fázis 1 kiemelt ellenőrzés**
- **Auth-only (kb. 30):** settings-csoport, subscription, player-device-revoke, 2FA (RequirePassword-dal), verify-flow
- **Auth+verified (5):** onboarding, player/connect, pricing/portal, pricing/checkout
- **Auth+verified+onboarding (~75):** a teljes feature-felület (words, flashcards, TA, review, cloze, quiz…) — mind throttle-lal vagy anélkül
- **Admin (6):** `admin/*` (5) + `PATCH words/{word}` — `Authorize:admin` gate ✅
- **Sanctum player-API (13):** pair+exchange publikus (throttle 10/perc ill. 30/perc, device-flow by design), a többi `auth:sanctum` + `abilities:player` + saját throttle ✅
- **Stripe (2):** webhook `VerifyWebhookSignature`, payment-page `VerifyRedirectUrl` (Cashier-standard)
- Furcsaság: a `settings` URI MINDEN HTTP verbre válaszol (GET|POST|PUT|PATCH|DELETE) — valószínűleg redirect; kozmetika.

## .env.example ↔ .env kulcs-diff

- **`.env.example`-ből HIÁNYZÓ, kódban használt kulcsok:** `GEMINI_API_KEY` + 12 GEMINI_MODEL/FALLBACK kulcs,
  `REGISTRATION_ENABLED`, `REGISTRATION_INVITE_ONLY`, `ONBOARDING_ENABLED` (+ DB_* — az example sqlite-ot feltételez, OK).
  → LOW: friss deploy `.env.example`-ből kiindulva ezeket némán defaultolná (registration=true, invite_only=FALSE!, onboarding=true).
  **Az invite-only default FALSE** — élesben explicit `REGISTRATION_INVITE_ONLY=true` kell, ha az a szándék. → Fázis 8 lista.
- `.env.example`-ben van, `.env`-ben nincs: `BILLINGO_ITEM_NAME` (config-default van, OK).
- **Halott kulcs a `.env`-ben:** `TRIAL_DAYS=0` — a config a `SUBSCRIPTION_TRIAL_DAYS`-t olvassa (az is 0). Kozmetika.
- Lokálisan `ONBOARDING_ENABLED=false` — élesben eldöntendő érték → Fázis 8.

## Prod-kötelező flag-ek (baseline, Fázis 8 véglegesíti)

`APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`, éles Stripe+Billingo kulcsok,
`SANCTUM_TOKEN_PREFIX`, `ADMIN_EMAIL`, `REGISTRATION_INVITE_ONLY` explicit érték, `ONBOARDING_ENABLED` döntés,
Boost/`storage/{path}` serve kikapcsolás ellenőrzése.

## Melléklelet (nem blokkoló)

- `backup/before billing/` legacy-könyvtár a repo gyökerében (nem publikus, de pint-et buktatja, repo-zaj) — törlés/kizárás megfontolandó.
