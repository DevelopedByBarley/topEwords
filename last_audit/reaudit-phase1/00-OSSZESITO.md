# Fázis 1 — FÜGGETLEN újra-audit (összesítő)

> Készült: 2026-07-20 · Kiindulás: `last_audit/PLAN.md` **Fázis 1** (auth, session, jogosultság — rendszerszintű).
> Módszer: multi-agent workflow — **6 dimenziónkénti finder** (párhuzamos) + **1 adverzariális, cáfolásra hangolt verifikátor-kör** a LOW-kra.
> Az előző auditoktól **teljesen független**: a finderek CSAK a PLAN.md scope-ját kapták, a `last_audit/` korábbi riportjait NEM olvasták.
> **Csak dokumentálás — kód nem módosult** (audit-no-fixes szabály).
> Baseline: HEAD `7f1281e`, branch `main`, working tree tiszta (csak `.claude/settings.json`).

---

## VÉGEREDMÉNY: 0 HIGH · 0 MEDIUM · 17 LOW (részben átfedő)

Egyetlen dimenzióban **sincs** privilégium-határ hiba, IDOR, vagy request-triggerelhető auth/session-gyengeség.
Mivel nulla HIGH/MEDIUM-gyanús lelet született, a 2–3 fős cáfoló verifikátor-kör (HIGH/MEDIUM-onként) tárgytalan;
helyette egy egykörös, cáfolásra hangolt verifikátor spot-check-elte a legkonkrétabb LOW-állításokat és a legmagasabb
értékű IDOR-jelöltet. Egyetlen finder-túllövés (C-L1 szövegezés) és egyetlen alul-számolás (`stripe/*` route-szám)
korrigálva; egyik sem emeli a súlyosságot.

### Dimenziónkénti bontás

| Finder | Dimenzió (PLAN.md Fázis 1) | HIGH | MED | LOW | Riport |
|---|---|---:|---:|---:|---|
| A | Middleware-láncok (`auth`/`verified`/`abilities`/`throttle`/onboarding) | 0 | 0 | 4 | `finder-A-middleware.md` |
| B | Middleware-en KÍVÜLI kézi auth (public routes: success/sitemap/webhook) | 0 | 0 | 3 | `finder-B-manual-auth.md` |
| C | Fortify auth-flow (2FA, reset, `password.confirm`, registration, rate-limit) | 0 | 0 | 3 | `finder-C-fortify.md` |
| D | Session hardening (cookie, invalidálás, token-rotálás, CSRF) | 0 | 0 | 3 | `finder-D-session.md` |
| E | Token életciklus (player PAT, `sanctum.expiration`, revokálás, pairing) | 0 | 0 | 4 | `finder-E-tokens.md` |
| F | IDOR-sweep + policy-lefedettség + ReviewController | 0 | 0 | 0 | `finder-F-idor.md` |
| — | **Adverzariális verifikátor-kör (LOW + IDOR-eszkaláció)** | — | — | — | `verifier-low-round.md` |

---

## A PLAN.md Fázis 1 minden tétele — lefedve

| PLAN.md tétel | Verdikt | Hol |
|---|---|---|
| Middleware-láncok minden route-csoporton | TISZTA — nincs alul-védett mutáló/drága route | A |
| Kézi auth: `pricing/success` `hasValidSignature()` | HELYES — aláírás-kapuzott, **állapot-mutáció nélkül** (provisioning csak webhookban) | B |
| Kézi auth: `sitemap.xml` publikus closure | HELYES — statikus, 3 hardcode-olt publikus URL, 0 DB | B |
| Kézi auth: Stripe-webhook aláírás | HELYES — aláírás mutáció ELŐTT + event-id idempotencia + tolerancia | B |
| Fortify 2FA (enable/confirm/disable + recovery) | HELYES — confirm-step kényszerítve, mind a 7 route `RequirePassword`, recovery egyszer-használatos | C |
| Jelszó-reset token-élettartam | HELYES — 60 perc (Laravel default), egyszer-használatos, reset revokálja a player-tokent | C |
| `password.confirm` érzékeny műveleteknél | HELYES ma — de 2FA-flaghez kötött (C-L2) + `password.confirm.store` nincs throttle-olva (C-L1) | C |
| `REGISTRATION_ENABLED=false` szerveroldali zárás | HELYES — a register route-ok **ténylegesen eltűnnek** (empirikusan igazolva), nem csak UI-rejtés | C |
| login/register/2fa/password-request rate-limiterek | HELYES — mind a 4 létezik, épkézláb kulcsolva | C |
| `AuthenticateSession` a láncban | HELYES — `bootstrap/app.php:29-30`, jelszó-hash-alapú device-kill | D |
| `same_site`/`http_only`/`SESSION_SECURE_COOKIE` | HELYES — lax/true/prod-failsafe-true; boot-guard rossz APP_ENV-re | D |
| Session-invalidálás jelszó/email-váltáskor + token-rotálás | HELYES jelszóra (mindkét ág); email-váltás nem killeli más session-t (LOW-D1, standard) | D |
| Player/extension token élettartam + `sanctum.expiration=null` tisztázás | TISZTÁZVA — player PAT **90 nap explicit `expires_at`**, guard 2. klóz kikényszeríti; extension = session, NEM token | E |
| Token visszavonás egységessége | HELYES — user-scoped delete, nincs IDOR a tokenId-n; auto-revoke jelszó/reset/email-en | E |
| IDOR-sweep mind a 129 route `{id}`/`{slug}`/`{token}` bindingjén | TISZTA — **0 IDOR**; nested binding kétszintű; move/bulk-move target-deck újra-authorizál | F |
| Policy-lefedettség (csak 3 policy) — a többi hol authorizál? | VÁLASZ: inline `abort_unless($m->user_id===...)` VAGY user-scoped reláció minden policy-nélküli entitáson | F |
| `ReviewController` (review + review/complete) | **ELTÁVOLÍTVA** — nincs controller/route/hivatkozás; nincs mit auditálni | F |

---

## LOW-leletek (kanonikus lista, duplikátumok összevonva)

A `stripe/*` CSRF-wildcard és az extension-`verified` hézag több finderben is megjelent — itt egyszer soroljuk.

| ID | Lelet | Fájl | Súly | Verifikátor-verdikt |
|---|---|---|---|---|
| **L1** | Extension write route-ok (`add-word`,`create-flashcard`) nincsenek `verified`-del, a player-ikrek igen | `routes/extension.php:19-20` vs `routes/api.php:45` | LOW (self-only) | CONFIRMED |
| **L2** | Extension/player write-ok nincsenek `EnsureOnboardingComplete`-tel (web-en van) | `routes/extension.php`, `routes/api.php` | LOW (self-only) | — |
| **L3** | Guest `player/pair` auth nélkül hoz létre DB-sort (throttle-olt, self-pruning) | `PlayerPairingController.php:37-63` | LOW | — |
| **L4** | `settings` redirect minden HTTP-verbre válaszol (mutáció nélkül) | `routes/settings.php:11` | LOW (kozmetika) | — |
| **L5** | `password.confirm.store` nincs throttle-olva (session-hijacker offline-lassú próbálgatás a SAJÁT jelszóra) | `FortifyServiceProvider.php:118-122` | LOW | **CORRECTED** — a "guessing oracle" szöveg túlzó: saját jelszó, nincs cross-session nyereség |
| **L6** | `password.confirm` gate a 2FA-feature-flaghez kötött (kikapcsolt 2FA → néma re-auth-vesztés) | `SecurityController.php:30-33`, `SubscriptionController.php:32-35` | LOW (latens csatolás) | CONFIRMED |
| **L7** | Jelszó-reset token 60 perc (default; rövidebb TTL olcsó hardening) | `config/auth.php:99` | LOW | — |
| **L8** | Email-váltás nem invalidálja a többi session-t (standard Laravel; új email verifikálatlan → verified-lockout) | `ProfileController.php:27-48` | LOW | — |
| **L9** | `stripe/*` CSRF-kizárás prefix-wildcard (jövőbeli session-auth mutáló route néma kockázata) | `bootstrap/app.php:27` | LOW | **CORRECTED** — ma **2** route (`webhook` POST + `payment/{id}` GET), egyik sem session-auth mutáló → nincs élő lyuk |
| **L10** | `SESSION_SECURE_COOKIE` prod-failsafe pontos `APP_ENV=production`-höz kötött (de boot-guard fedi) | `config/session.php:175` | LOW (gyakorlatilag nulla) | — |
| **L11** | Player read-ek (`me`/lookup/search) nincsenek `verified`-del (write-ok igen; pairing-approve verified) | `routes/api.php:23-30` | LOW (self-only, elméleti) | — |
| **L12** | Approved-but-unclaimed pairing-sor ≤10 percig redeemable marad (raw poll_secret kell hozzá) | `PlayerPairingController.php:103-146` | LOW | CONFIRMED |
| **L13** | Device-name user-kontrollált, token-névbe + settings-listába kerül (ma React-escape-elt) | `PlayerPairingController.php:230-235` | LOW (defense-in-depth) | — |
| **L14** | Per-device revoke 10/min throttle vs. korlátlan device-lista ("revoke all" fedi a tömeges esetet) | `routes/settings.php:30-37` | LOW | — |
| **L15** | `robots.txt` statikus `Disallow: /` árnyékolja az env-tudatos `RobotsController`-t (SEO/deploy, nem security) | `public/robots.txt` | LOW (deploy-checklist) | — |
| **L16** | `up` health-check publikus (framework-default, elhanyagolható) | framework default | LOW | — |
| **L17** | Locale-cookie `GET /locale/{locale}` CSRF nélkül (nem mutál állapotot a cookie-n túl) | locale route | LOW | — |

---

## Verifikátor-kör kimenete (cáfolási pass)

Egy adverzariális, cáfolásra promptolt verifikátor 6 konkrét állítást + 1 IDOR-eszkalációt ellenőrzött a valós kódban:

1. **L1 (extension-verified):** CONFIRMED — valós aszimmetria.
2. **L5 (password.confirm throttle):** **CORRECTED** — a map-tartalom és a throttle-hiány igaz, de a "password-guessing oracle" megfogalmazás túlzó: az endpoint a hívó SAJÁT jelszavát ellenőrzi `Authenticate:web` mögött, cross-session privilégiumot nem ad. Súly marad LOW.
3. **L6 (password.confirm 2FA-csatolás):** CONFIRMED — a feltételes middleware pontosan úgy van, ahogy állították.
4. **L9 (`stripe/*` route-szám):** **CORRECTED** — a "csak `stripe/webhook`" finder alul-számolt; ténylegesen **2** route (`POST stripe/webhook` aláírás-verifikált + `GET stripe/payment/{id}` Cashier SCA). Egyik sem session-auth mutáló → nincs mai CSRF-lyuk, csak jövőbeli wildcard-kockázat.
5. **L12 (pairing-residue):** CONFIRMED — a delete csak `exchange()`-ben, `approve()`-ban nem; `LIFETIME_MINUTES=10`.
6. **IDOR-eszkaláció (flashcard `move`/`bulkMove`):** CONFIRMED, **nincs IDOR** — a target-deck tulajdon-ellenőrzés jelen van mindkét ágon (`:150`, `:312`), és a `bulkMove` a forrás-id-kat `$deck->flashcards()->whereIn(...)`-en átszűri, mielőtt a tulaj-verifikált `$targetDeck->id`-t írná. Cross-user exploit nem konstruálható.

---

## Összevetés az előző (2026-07-17) Fázis 1 auditttal — a felhasználó kérésére utólag

Ez a riport **függetlenül** készült. A felhasználó a végén összevetheti a memóriában rögzített korábbi Fázis 1 zárással
(`project_system_audit_phase1_2026-07-17.md`), amely szintén **0 HIGH/MEDIUM/IDOR**-t és lezárt LOW-kat rögzített.
Az itt talált LOW-k jellege egybevág (extension-`verified` self-only hézag, `stripe/*` CSRF-wildcard tudatos döntés,
`SESSION_SECURE_COOKIE` failsafe boot-guarddal, ReviewController kivezetve) — **nincs regresszió, nincs új HIGH/MEDIUM**.

## Státusz

- Fázis 1 kód-oldala **tiszta**; go-live blokkoló: **0**.
- A többi fázisra (2–8) **NEM léptem** — a felhasználó jóváhagyására várok.
- Kód nem módosult.
