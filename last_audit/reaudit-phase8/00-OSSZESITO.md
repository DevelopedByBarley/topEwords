# Fázis 8 — Független újra-audit: Infra, headers & deploy-készenlét

> Készült: 2026-07-21 · Módszer: multi-agent-stílusú workflow — dimenziónkénti finderek + minden
> HIGH/MEDIUM-gyanús leletre 2–3 független, cáfolásra promptolt adverzariális verifikátor; LOW-ra egykörös.
> **Kizárólag a `last_audit/PLAN.md` alapján, a korábbi Fázis 8 riportoktól függetlenül.** A többi audit-fájlt
> szándékosan nem olvastam — a cél a független második vélemény, hogy utólag összevethető legyen.
> **Csak dokumentálás — kódot nem módosítottam (audit-no-fixes szabály).**

## Verdikt

**0 HIGH · 0 MEDIUM · 3 LOW · 6 INFO.** Go-live-blokkoló kód-szintű lelet: **0.**

A PLAN Fázis 8 által felvetett négy fő gyanú (SecurityHeaders-hiányosság, CORS-wildcard,
public/ szivárgás, prod-env-flag-hézag) **mind adverzariálisan lebontva = nem exploitálható**.
A rendszer erős, jól dokumentált, teszttel fedett prod-hardening réteget hordoz (AppServiceProvider
boot-guardok + SecurityHeaders + env-derivált secure-cookie). A maradék 3 LOW mind vagy deploy-ops
(nem kód), vagy defense-in-depth-lehetőség valós vektor nélkül.

## Lefedett dimenziók (PLAN 114–121. sor)

| # | Dimenzió | Eredmény |
|---|---|---|
| D1 | SecurityHeaders middleware (CSP/HSTS/XFO/nosniff/referrer/permissions) | TISZTA — teljes fejléc-készlet, prod-CSP navigációs/framing-lock |
| D2 | CORS (`config/cors.php` — nincs override, framework-default) | TISZTA — wildcard `*` + `supports_credentials=false` = biztonságos token-API minta |
| D3 | public/ dev/debug fájlok + kulcs-szivárgás | TISZTA — `oc.php` nincs; `.DS_Store`+`.env*` gitignore-olt, git-deployon nem jut ki |
| D4 | Prod-kötelező env flag-ek + config-tényellenőrzés | TISZTA — boot-guardok kikényszerítik (ENV-1/2, Stripe-kulcs, secure-cookie) |
| D5 | Queue/worker + failed_jobs + error-log riasztás éles-config | TISZTA — `queue:alert-failed`+`queue:monitor` 10 percenként ütemezve |

## Leletek súlyosság szerint (séma-kényszerített, lásd 01-LELETEK.md)

| ID | Súlyosság | Cím | Verdikt |
|---|---|---|---|
| HDR-API-1 | LOW/INFO | `api/*` JSON-válaszok nem kapják a `SecurityHeaders` middleware-t | Nincs HTML-render-felület → nincs vektor; opcionális nosniff-kiterjesztés |
| CORS-1 | LOW/INFO | `allowed_origins = ['*']` az `api/*`-on | `supports_credentials=false` + Bearer-token (nem cookie) → nincs vektor |
| DEPLOY-1 | LOW | `public/.DS_Store` a munkakönyvtárban (belső fájlnév-nyom) | gitignore-olt + NEM tracked → git-deployon nem jut prodra; ops-checklist |
| CSP-1 | INFO | `script-src 'unsafe-inline'` gyengíti a CSP XSS-rétegét | Nincs untrusted HTML sink (sanitizáció + szerver-SVG) → dokumentált kompromisszum |
| ENV-INFO-1 | INFO | Helyi `.env`: `APP_ENV=local`, `APP_DEBUG=true` | Helyes dev-állapot; a boot-guard prodban kikényszeríti a false-t |
| SANCTUM-INFO-1 | INFO | `sanctum.expiration = null` (globális örök-token) | A PLAN feltételezett "ütközése" MEGDŐL: player-token per-token `expires_at` = +90 nap |

## A PLAN feltevéseinek tény-státusza

- **„CORS `*` credentials mellett veszélyes"** → MEGDŐL: `supports_credentials = false`, a wildcard csak
  cookie-mentes, Bearer-token-alapú kéréseket enged, amit a böngésző CORS-modellje ártalmatlanná tesz.
- **„`storage/{path}` publikus serve"** (PLAN 4b/8) → már a Fázis 4b-ben lezárva (`serve:false`); Fázis 8-ban
  nem tér vissza. Itt csak megerősítve, hogy a public/ nem hordoz kiszolgálható PHP-t (`oc.php` nincs).
- **„`sanctum.expiration = null` ütközik a 90-nap-pal"** → MEGDŐL: a `createToken(..., now()->addDays(90))`
  harmadik argumentum per-token lejáratot ad; a globális null nem jelent örök player-tokent. Konzisztens a
  `sanctum:prune-expired` napi takarítással.
- **„public/downloads kicsomagolt extension-forrás"** (PLAN 93) → NINCS: a `downloads/` már csak `.zip`+`.dmg`+`.exe`
  bináris letöltőt tartalmaz, a kicsomagolt könyvtár megszűnt → az a felület nem létezik.

## Teszt-állapot

- `SecurityHeadersTest` (3) + `EnvironmentBootGuardTest` (6) + `SessionSecureCookieTest` (2) — **mind zöld.**
- A prod-hardening minden kritikus ága (ENV-1/ENV-2/secure-cookie/CSP/HSTS) teszttel fedett.

## Nem kód (ops/deploy — kontextus, változatlanul nyitva)

- `rm` nem kell (`oc.php` már nincs); deploy-checklist: `.DS_Store` ne kerüljön ki rsync-deploynál (git-deployon N/A).
- Éles env: `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`(auto), `SANCTUM_TOKEN_PREFIX=tpw_`,
  éles Stripe/Billingo kulcsok, `ADMIN_EMAIL` — a boot-guardok a hibás értékeknél leállítják a bootot.
- Cron (`schedule:run`) + queue worker a szerveren (Ploi) — a riasztási lánc ezekre épül.

## Következtetés

Fázis 8 a kód-oldalon **lezárható** — go-live-blokkoló kód-szintű lelet nincs. A maradék tisztán ops/deploy
(env-értékek beállítása, cron/worker indítása), amit a boot-guardok fail-closed módon védenek.

**A többi fázisra NEM léptem tovább — a PLAN-nak megfelelően itt megállok és a jóváhagyásodra várok.**
