# Fázis 1 — Auth, session, jogosultság · FÜGGETLEN újra-ellenőrzés

> Készült: 2026-07-17 · multi-agent workflow (dimenziónkénti Opus-finderek + adverzariális Opus-verifikátorok).
> **Ez az ellenőrzés szándékosan függetlenül készült** a meglévő `last_audit/fazis-1.md`-től — a finderek NEM olvasták azt, sem a korábbi todo/memória-riportokat. Cél: a korábbi Fázis-1 megállapítások független megerősítése/cáfolása. Az összevetés a két riport között külön lépés.
> Szabály: **csak dokumentálás, kód nem módosult** (audit-no-fixes).

## Módszertan

- **5 dimenzionális finder** (mind `model: opus`, párhuzamosan), séma-kényszerített leletformátummal:
  1. IDOR / objektum-szintű jogosultság (BOLA) sweep mind a 129 route-bindingjén
  2. Middleware-láncok + middleware-en kívüli kézi auth (`pricing/success`, `sitemap`, `stripe/webhook`, admin-gate, extension auth-nélküli route-ok)
  3. Fortify auth-flow (2FA, jelszó-reset, password-confirm, `REGISTRATION_ENABLED`, rate-limiterek, invite)
  4. Session hardening + Sanctum token-életciklus (cookie-flag-ek, `AuthenticateSession`, token-TTL, visszavonás, CSRF)
  5. ReviewController (status-SRS): IDOR, plafon-bypass, streak-race, input-validáció
- **Adverzariális verifikáció:** a HIGH/MEDIUM-gyanús / nem-triviális leletekre külön, cáfolásra promptolt Opus-verifikátor. Mivel **egyetlen HIGH/MEDIUM sem** keletkezett, a két legkevésbé triviális LOW-t (FA-L1, SESS-L1) vetettük adverzariális körbe. A többi LOW triviálisan igaz vagy egyértelműen alacsony hatású → egykörös.

## Végeredmény

**0 HIGH · 0 MEDIUM.** A Fázis 1 auth/session/jogosultsági felülete tiszta a launch szempontjából.

| Azonosító | Súlyosság | Kategória | Verdikt |
|---|---|---|---|
| FA-L1 — reset nem rotálja a remember_token-t | ~~LOW~~ | session/token | **REFUTED** (adverzariális) — a Fortify `CompletePasswordReset` rotálja |
| SESS-L1 — fiók-törlés árva Sanctum tokent hagy | LOW | token | **CONFIRMED** (adverzariális) — de beválthatatlan, adat-higiénia |
| SESS-L2 — `player/disconnect` nincs throttle | LOW | rate-limit | egykörös (self-limiting) |
| SESS-L3 — `stripe/*` CSRF-wildcard tágabb a kelleténél | LOW | csrf | egykörös (ma nincs érintett route) |
| MW-L1 — `PUT settings/flashcards` nincs throttle | LOW | rate-limit | egykörös (saját adat, nem IDOR) |
| FA-L2 — subscription cancel/resume nincs password-confirm | LOW | authz | egykörös (Stripe-portálon visszavonható) |
| FA-L3 — `two-factor` limiter null-kulcs fallback nélkül | LOW | rate-limit | egykörös (normál flow védett) |
| FA-L4 — `REGISTRATION_ENABLED` nincs a `.env.example`-ben | LOW | konfig-hardening | egykörös (szerveroldali zárás helyes) |
| REV-4 — kliens-vezérelt due-léptetés helyesség-ellenőrzés nélkül | LOW | korrektség | egykörös (csak saját haladást érint) |

**Nettó: 8 érvényes LOW** (FA-L1 cáfolva). Egyik sem launch-blokkoló; egyik sem authz/IDOR-hatású.

---

## Dimenzió 1 — IDOR / BOLA sweep · **0 lelet**

A legkritikusabb dimenzió teljesen tiszta. Infrastruktúra-tények:
- **Nincs** `resolveRouteBinding`/`getRouteKeyName` felülírás, **nincs** globális scope, **nincs** `scopeBindings` egyik modellen sem. A route-model-binding tehát NEM szűr automatikusan user-re — a védelem a kontrollerben van, és minden bound-model route-on ott is van.
- Minden bound-model route védett egyike által: `abort_unless($x->user_id === $request->user()->id, 403/404)`, VAGY `Gate::authorize(...)` policy, VAGY admin-middleware (invite), VAGY megosztott szótár-`Word` user-scope-olt `user_word` pivoton keresztül.

Kifejezetten ellenőrzött kritikus pontok — mind TISZTA:
- **Player device-token törlés** (`SecurityController::revokePlayerDevice`): `$request->user()->tokens()->whereKey($tokenId)` + `isPlayerToken()` — idegen token-id nem törölhető.
- **Invoice-letöltés** (`SubscriptionController::downloadInvoice`): `abort_unless($invoice->user_id === $request->user()->id, 404)` (saját `BillingoInvoice` modell, nem Cashier).
- **YoutubeTranscript / UserBook** page/overview/destroy: mind `abort_unless(...->user_id === ..., 403)`.
- **Flashcard card ops**: minden metódus ellenőrzi `$deck->user_id`-t ÉS `$flashcard->deck_id === $deck->id`-t; move/bulkMove a célpaklit is újra-verifikálja.
- **Extension** (auth-nélküli route-ok): objektumok mind user-reláción át (`$request->user()->flashcardDecks()->find(...)` → idegen id 404).
- **Invite** törlés: nincs per-object owner-check, de a teljes `admin/*` group `Authorize:admin` mögött van; globális admin-erőforrás = by-design, nem IDOR.

## Dimenzió 2 — Middleware & kézi auth · **1 LOW (MW-L1)**

- **MW-L1** (LOW, rate-limit) — `routes/settings.php` `PUT settings/flashcards` nem kap throttle-vödröt, míg a testvér settings-mutációk (billing-update 10/1, profile-update 6/1) igen. Saját, user-scope-olt adat (`$request->user()->flashcardSettings()->updateOrCreate`), nincs jogosultsági hatás — tisztán write-amplifikáció mélységi-védelem.

Tisztának igazolt:
- **Extension auth-nélküli endpointok**: minden végpont `if (! $request->user()) return 401` guarddal indul, minden adat user-scope-olt; a `badge` szándékosan publikus (`{count:0}`). Nincs publikus szivárgás/írás.
- **Player pairing** (`pair`/`exchange` auth nélkül): helyes device-flow, token csak jóváhagyott párosításra, atomi egyszer-használatos beváltás, token soha nem URL-ben.
- **`pricing/success`**: első lépés `hasValidSignature()` → különben redirect; utána csak saját session-adat.
- **`sitemap.xml`**: statikus, nincs user/DB-adat.
- **`stripe/webhook`**: minden Cashier-override az aláírás-ellenőrzött dispatchen keresztül fut, nincs aláírás nélküli ág.
- **admin-gate**: `Gate::define('admin', fn ($u) => $u->isAdmin())`, `isAdmin()` = `ADMIN_EMAIL`-egyezés ÉS `hasVerifiedEmail()`.

## Dimenzió 3 — Fortify auth-flow · **4 LOW (FA-L1 cáfolva → 3 marad)**

- **FA-L1** (**REFUTED**) — a finder szerint a jelszó-reset nem rotálja a `remember_token`-t. Adverzariális verifikáció: a Fortify `NewPasswordController::store` a projekt `ResetUserPassword` Action-je UTÁN közvetlenül meghívja a `CompletePasswordReset`-et, ami `setRememberToken(Str::random(60))`-t hív. A remember_token tehát **rotálódik** minden reseten; a támadó reset utáni remember-cookie-ja érvénytelen. **Nincs teendő.**
- **FA-L2** (LOW, authz) — subscription cancel/resume csak `auth`+throttle mögött, nincs `password.confirm`. A csapat tudatosan jelszóhoz kötötte a device-revoke/email-váltás/jelszóváltás/fiók-törlés műveleteket; a cancel kimaradt. Hatás alacsony (Stripe-portálon visszavonható).
- **FA-L3** (LOW, rate-limit) — `two-factor` limiter kulcsa `by(session('login.id'))` fallback nélkül; null-kulcson elvi közös vödör. A normál challenge-flow session-nel fut → védett; a null-ág gyakorlati elérhetősége bizonytalan.
- **FA-L4** (LOW, konfig-hardening) — `REGISTRATION_ENABLED` (`config/fortify.php` default `true`) nincs a `.env.example`-ben. A szerveroldali zárás helyes és tényleges (a route be sem regisztrálódik ha `false`), de a hiányzó doksi miatt deploykor véletlenül nyitva maradhat a regisztráció.

Tisztának igazolt: 2FA-feature aktív és `RequirePassword` mögött (minden `two-factor-*` route), jelszó-reset erős szabály (`Password::default`) + 60p TTL + player-token-revoke, `AuthenticateSession` globálisan a web-en, email-váltás/fiók-törlés jelszóhoz kötve, login-limiter email+IP alapú, invite lejár + max_uses + TOCTOU-védett (`lockForUpdate`).

## Dimenzió 4 — Session & Sanctum token · **3 LOW (SESS-L1 CONFIRMED)**

- **SESS-L1** (LOW, token, **CONFIRMED**) — fiók-törléskor (`ProfileController::destroy`) a `personal_access_tokens` sorok nem törlődnek: a `morphs('tokenable')` FK-cascade nélküli, nincs `deleting`-hook/Observer, a Sanctum `HasApiTokens` nem takarít, és a controller sem hív `revokePlayerTokens()`-t. Adverzariális verifikáció megerősítette a tényt, ÉS hogy a súlyosság **LOW marad** (nem MEDIUM): a Sanctum Guard `supportsTokens(null) === false` + az `auth:sanctum` middleware 401-et ad a törölt userre — az árva token **beválthatatlan**, csak adat-higiéniai maradvány a napi `sanctum:prune-expired`-ig. (Megjegyzés: a többi user-birtokolt tábla — flashcard_decks, user_word, player_pairings stb. — mind `cascadeOnDelete`; a token az egyetlen kivétel.)
- **SESS-L2** (LOW, rate-limit) — `player/disconnect` nincs throttle; self-limiting (csak a saját tokent törli, utána 401).
- **SESS-L3** (LOW, csrf) — `validateCsrfTokens(except: ['stripe/*'])` wildcard tágabb a `stripe/webhook`-nál; ma nincs más `stripe/`-prefixű saját route, jövőbeli bővítés kockázata.

**Fontos tisztázás (PLAN-feltevés cáfolva):** a PLAN szerint `sanctum.expiration = null` → örökéletű player-token. **Téves.** A `PlayerPairingController::exchange` explicit `createToken(..., ['player'], now()->addDays(90))`-t ad (`PlayerPairing::TOKEN_LIFETIME_DAYS = 90`); a `null` globális `expiration` csak akkor írná felül a per-token `expires_at`-ot, ha nem-null lenne. A player-token tehát **90 nap után lejár** — a memóriában rögzített "90 nap" helyes.

Tisztának igazolt: cookie `secure` prod-ban fail-safe `true`, `http_only` true, `same_site` lax; `AuthenticateSession` a web-láncban; token kizárólag `['player']` ability; device-revoke user-scoped + `RequirePassword`; jelszóváltás/reset revoke-olja a player-tokeneket; extension POST-ok CSRF-token-kötelesek a web-guardon.

## Dimenzió 5 — ReviewController · **1 LOW (REV-4)**

- **REV-4** (LOW, korrektség) — a `POST review/complete` a helyesség jelzése nélkül állítja `reviewed_at`-ot, így a szó az INTERVALS[status] napig kiesik a due-listából akár rossz válasznál is; nincs session-nonce, ami kötné a küldött id-ket a kiadott sessionhöz. Kizárólag a saját tanulási haladást érinti, más userre nulla hatás → korrektségi, nem biztonsági (lehet terméktervezési döntés is).

Tisztának igazolt: **IDOR nincs** — mindkét update-ág user-scope-olt (`where('user_id', $user->id)->whereIn(...)`); MAX_PER_SESSION (50) szerver-oldalon kényszerített (`validate max:50` + `array_slice`); a `complete` KIZÁRÓLAG `reviewed_at`-ot ír — nincs streak/pont/status-mutáció, ezért idempotens és nincs race; input-validáció (ids tömb max:50, id string max:32) megfelelő.

---

## Összevetés a korábbi Fázis-1 riporttal (`fazis-1.md`) — *elvégzendő*

Ez a riport függetlenül készült; a két riport egymás mellé tétele (fedik-e egymást a LOW-k, van-e a korábbiban olyan találat amit ez nem hozott vagy fordítva) a következő lépés, a jóváhagyásod után.

## Megállás
A Fázis 1 kész. A PLAN Fázis 2–8 **NEM indult** — a felhasználó kérésére itt megállok és a jóváhagyását várom.
