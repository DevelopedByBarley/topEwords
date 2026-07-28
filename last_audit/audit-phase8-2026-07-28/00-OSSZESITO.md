# Fázis 8 audit — Infra, headers & deploy-készenlét

**Dátum:** 2026-07-28 · **Commit:** `6852fe6` · **Módszer:** multi-agent workflow (5 finder + 4 adverzariális verifikátor)
**Szabály:** CSAK DOKUMENTÁLÁS — kód nem módosult, tesztfájl nem módosult.

---

## Vezetői összefoglaló

| Súlyosság | Darab |
|---|---|
| 🔴 HIGH | **0** |
| 🟠 MEDIUM | **0** |
| 🟡 LOW | **10** |
| ℹ️ INFO | **13** |

**Go-live blokkoló kód-szintű lelet: 0.**

A kör **2 MEDIUM-gyanút** termelt (D5-1 queue-név drift, D4 MEDIUM-1 üres `ADMIN_EMAIL`).
Mindkettő **2/2 arányban REFUTED** lett az adverzariális verifikáción, és **LOW**-ra került.
Egyetlen MEDIUM sem maradt állva — ez a hetedik egymást követő kör ugyanezzel a mintázattal.

**A kör legfontosabb új lelete nem biztonsági, hanem deploy-higiéniai:** a `backup/`
könyvtár **4629 git-trackelt fájlja (147 MB)** minden `git pull` deployjal kimegy a prodra,
annak ellenére, hogy szerepel a `.gitignore`-ban. Ezt egyik korábbi Fázis 8 kör sem találta meg.

---

## A dimenziók (a PLAN Fázis 8 hat pontjából)

A PLAN Fázis 8 szakasza 6 felsorolás-pontból áll. A 6 pont **5 koherens dimenzióba**
csoportosítva (a „queue/worker éles-config" és a „go-live checklist" pont egy dimenzió,
mert ugyanaz a kód- és ops-felület fedi őket):

| Dim | Tárgy | HIGH | MED | LOW | INFO |
|---|---|---|---|---|---|
| D1 | `SecurityHeaders` middleware tartalma (CSP, HSTS, XFO, nosniff, referrer) | 0 | 0 | 3 | 3 |
| D2 | CORS (`config/cors.php`) — extension/player felé | 0 | 0 | 0 | 3 |
| D3 | `public/` debug/dev-fájlok, `.env`/kulcs-szivárgás | 0 | 0 | 3 | 1 |
| D4 | Prod-kötelező env flag-ek + boot-guardok | 0 | 0 | 4 | 6 |
| D5 | Queue/worker + failed_jobs + error-log riasztás + go-live | 0 | 0 | 3* | 2 |

\* a D5-1 MEDIUM→LOW leminősítés után

---

## MEGDŐLT PLAN-feltevések

A PLAN Fázis 8 szakasza 2026-07-17-i állapotot tükröz. **6 feltevése dőlt meg:**

1. **`public/oc.php` létezik** → **MEGDŐLT.** A fájl nincs meg, és soha nem volt git-trackelve
   (`git ls-files public/` = 13 fájl, nincs köztük). A memóriában élő „⚠️ deploykor `rm public/oc.php`"
   teendő **elavult, törölhető**.
2. **`public/downloads/` `.DS_Store`-ral és kicsomagolt extension-forrással** → **MEGDŐLT.**
   A könyvtár nem létezik; a letöltések auth-gate-elt route-on mennek a docroot-on kívüli
   `storage/app/private/downloads`-ból ([DownloadController.php:28-30](../../app/Http/Controllers/DownloadController.php#L28-L30)).
3. **CORS `*` credentials mellett** → **MEGDŐLT.** Nincs `config/cors.php`; a framework-default
   `allowed_origins=['*']` **de** `supports_credentials=false`, és — ez az új érv — az
   extension cookie-auth route-jai a `web` csoportban vannak
   ([routes/web.php:90](../../routes/web.php#L90)), tehát a CORS `paths` (`api/*`) **kívül esnek rajtuk**.
4. **`ADMIN_EMAIL` nincs kikényszerítve / hiányzik** → **részben MEGDŐLT.** A `.env.example:76-77`
   nagybetűs figyelmeztető kommentet tartalmaz a kulcs felett, és az éles `.env:67` **ki van töltve**.
5. **„Élő Stripe-kulcs kikényszerítés" kétirányú** → **MEGDŐLT.** Csak a teszt-kulcs-prodban irány
   őrzött; a live-kulcs-lokálisan irány őrizetlen (D4-LOW-2).
6. **A 2026-07-22-i incidens `queue:monitor` néma hiba volt** → **MEGDŐLT.** Az incidens saját
   rekordja szerint a riasztási lánc **elindult** (~10 perc késéssel). A D5-1 egy *másik*,
   még be nem következett hibamód.

---

## Kihagyott (kivezetett) pontok

A Fázis 8 szakasz **egyetlen** kivezetett feature-re sem hivatkozik (kvíz, cloze, rendhagyó igék,
szabad írás, `ReviewController`) — ez a fázis tisztán infra/deploy jellegű. **Kihagyott pont: 0.**

---

## Regressziók

**Regresszió: 0.** Ami korábban tiszta volt, tiszta maradt.

A korábbi Fázis 8 körök (`project_phase8_audit_2026-07-19`, `project_reaudit_phase8_2026-07-21`)
HIGH/MEDIUM leletet nem tartalmaztak, így nincs mit újra-ellenőrizni nyitottság szempontjából.
A korábbi körök 3 LOW-ja (HDR-API-1, CSP-1, DEPLOY-1) **változatlanul fennáll**, azonos indoklással
(most D1-1, D1-3, D3-2/D3-3 néven).

**Új, korábban nem talált lelet:** D3-1 (`backup/` git-trackelt, 147 MB). Ez nem regresszió —
a helyzet a `9065088` commit óta fennáll, csak eddig egyik kör sem nézett rá.

---

## Megdöntött korábbi verdiktek

| Korábbi verdikt | Új verdikt | Indok |
|---|---|---|
| „A CORS `*` azért ártalmatlan, mert `supports_credentials=false`" (2026-07-21) | **Kiegészítve/pontosítva** | Igaz, de nem ez a fő védelem. A valódi ok: az extension cookie-auth route-jai a `web` csoportban vannak, a CORS `paths` (`api/*`) rájuk sem vonatkozik. Ha valaki `api/*` alá mozgatja őket, ez a réteg összeomlik. |
| „A `SecurityHeaders` a `web`-append miatt teljes" | **Pontosítva** | A tartalom teljes, a *lefedettség* nem: az `api` csoport 14 route-ja nulla headert kap. Vektor nincs (JSON-only, Bearer-auth), de a HSTS-hiány `api/*`-on valós, ha kicsi, kockázat. |
| A `SecurityHeaders` docblock állítása: „the app has no untrusted HTML sinks (stored rich text is sanitized)" | **PONTATLAN** | A sanitizálás **kizárólag kliens-oldalon, renderkor** történik — íráskor soha. Ma ugyanaz az eredmény (self-XSS), de a komment félrevezetné azt, aki később pakli-megosztást épít. |
| D5-1 / BILL-3 / P7B-1 „queue-név drift" korábbi LOW | **LOW megerősítve, új bizonyítékkal** | Új tény, amit egyik korábbi kör sem ellenőrzött: `WorkCommand::getQueue()` **ugyanazt a config-kulcsot** olvassa, mint a dispatch → `DB_QUEUE` állítása a workert és a dispatchert **együtt** mozgatja, tehát torlódás sem keletkezik. |

---

## A verifikációs út (súlyosság-viták)

Részletesen: [`06-verifikacios-naplo.md`](06-verifikacios-naplo.md).

| Lelet | Finder | V1 | V2 | Végleges |
|---|---|---|---|---|
| **D5-1** queue-név drift | MEDIUM | REFUTED (LOW) | REFUTED (LOW) | **LOW** (2/2 refuted) |
| **D4-M1** üres `ADMIN_EMAIL` | MEDIUM | REFUTED (LOW) | REFUTED (LOW) | **LOW** (2/2 refuted) |

Mindkét vitában **eltérő lencsét** kaptak a verifikátorok (kihasználhatóság / blast-radius,
illetve triggerelhetőség / defense-in-depth), és mindkettő **függetlenül, más bizonyítékkal**
jutott ugyanarra a leminősítésre.

---

## Leletfájlok

- [`01-dim-D1-security-headers.md`](01-dim-D1-security-headers.md)
- [`02-dim-D2-cors.md`](02-dim-D2-cors.md)
- [`03-dim-D3-public-secrets.md`](03-dim-D3-public-secrets.md)
- [`04-dim-D4-prod-env-flags.md`](04-dim-D4-prod-env-flags.md)
- [`05-dim-D5-queue-alerting-golive.md`](05-dim-D5-queue-alerting-golive.md)
- [`06-verifikacios-naplo.md`](06-verifikacios-naplo.md)

---

## Ajánlott teendők (prioritás szerint — NEM végrehajtva)

1. **`git rm -r --cached backup`** — 4629 fájl / 147 MB kivezetése a deployból (D3-1).
   A `.gitignore:40` már megvan, csak a tracking maradt bent.
2. `SANCTUM_TOKEN_PREFIX=tpw_` felvétele az éles `.env`-be — a `.env.example` helyes,
   a deployolt env nem követte (D4-LOW-4).
3. `queue:monitor` argumentum config-követővé tétele (egysoros, D5-1).
4. Szimmetrikus Stripe-kulcs-guard: `sk_live_` tiltása nem-prod környezetben (D4-LOW-2).
5. `FIZETES_PRODUCTION_TEENDOK.md:38-44` frissítése — a doksi még `dispatchSync()`-ről ír,
   a kód már `dispatch()`-et használ (D5-4).
6. A `SecurityHeaders` docblock pontosítása a sanitizálás helyéről (D1, kommentmódosítás).
