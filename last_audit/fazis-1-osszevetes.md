# Fázis 1 — a két audit összevetése

> Készült: 2026-07-17 · A `fazis-1.md` (első audit + fixek) és a `fazis-1-fuggetlen-ellenorzes.md` (mai független újra-ellenőrzés) egymás mellé tétele.

## Kulcs-megállapítás

**A két audit egybehangzik: 0 HIGH, 0 MEDIUM, nincs launch-blokkoló.** Az IDOR-sweep mindkét körben **0 lelet** — ez a legfontosabb egyezés.

A LOW-k látszólagos eltérése egyetlen tényre vezethető vissza: **a `fazis-1.md` 9 LOW-jából 8-at az első audit után JAVÍTOTTAK** (2026-07-17, commitolatlan; lásd `fazis-1.md` „Javítások" táblázat + a working-tree módosításai: `FortifyServiceProvider`, `routes/settings.php`, `routes/words.php`, `ProfileUpdateRequest`, `SecurityController`, `config/session.php`, `User`, `ResetUserPassword`, `ReviewController`, + új `ReviewTest`/`SessionSecureCookieTest`).

A mai finderek a **javított kódot** olvasták, ezért a korábbi leletek nagy részét helyesen **tisztának** találták. Ez erős kereszt-validáció: a fixek ténylegesen megfogták a hézagokat.

## Lelet-szintű megfeleltetés

| `fazis-1.md` lelet | Fix megtörtént? | Mai független ellenőrzés | Egyezés |
|---|---|---|---|
| **F1-L1** — `password.update` nincs throttle | ✅ (`throttle:password-request`) | Nem hozta leletként → a fix látszik a `FortifyServiceProvider`-ben | ✔ konzisztens |
| **F1-L2** — extension írás megkerüli az email-verifikációt | ❌ NYITVA (üzleti döntés) | **Nem hozta** — a finder az extension null-user guardot és scope-ot nézte, az email-verifikáció-aszimmetriát nem emelte ki | ⚠ rés (lásd lent) |
| **F1-L3** — settings billing/profile throttle nélkül | ✅ (throttle a 3 route-on) | Csak `PUT settings/flashcards`-ot hozott (MW-L1) — a billing/profile MOST throttle-os | ✔ a fix beállt; MW-L1 új szomszéd |
| **F1-L4** — email-csere nincs password-confirm | ✅ (`current_password` kötelező) | **Tisztaként** igazolta: „email-váltás jelszóhoz kötve" | ✔ fix verifikálva |
| **F1-L5** — player-device-revoke nincs password-confirm | ✅ (`password.confirm` a revoke-okon) | **Tisztaként** igazolta: „device-revoke user-scoped + RequirePassword" | ✔ fix verifikálva |
| **F1-L6** — `SESSION_SECURE_COOKIE` Secure-flag hézag | ✅ (fail-safe prod-default) | **Tisztaként** igazolta: „cookie secure prod-ban fail-safe true" | ✔ fix verifikálva |
| **F1-L7** — jelszóváltás nem vonja vissza a player-tokeneket | ✅ (`revokePlayerTokens()` update+reset) | **Tisztaként** igazolta: „jelszóváltás/reset revoke-olja a player-tokeneket" | ✔ fix verifikálva |
| **F1-L8** — `review/complete` nincs ids-plafon/throttle | ✅ (`max:50` + `throttle:30,1`) | REV-2/REV-5 **tisztaként** igazolta a plafont+throttle-t | ✔ fix verifikálva |
| **F1-L9** — `review` GET nincs throttle | ✅ (`throttle:60,1,words-play`) | Nem hozta → a fix látszik (`words-play` a review GET-en) | ✔ fix verifikálva |

## Új szempontok, amiket a mai ellenőrzés hozott (az elsőben nem szerepeltek)

Ezek mind **LOW**, egyik sem launch-blokkoló:

- **MW-L1** — `PUT settings/flashcards` nincs throttle. Az első audit F1-L3-a a billing/profile route-okat fedte, de a flashcards-settings PUT-ot nem — ez kimaradt a fix-körből is. Ugyanaz a mintázat, mint az F1-L3 volt.
- **SESS-L1** — **fiók-törlés árva Sanctum-tokent hagy** (nincs FK-cascade/hook a `personal_access_tokens`-en). Az első audit F1-L7-e a jelszóváltás/reset ágat fedte és fixelte, de a **fiók-törlés** ágat nem vizsgálta. Adverzariálisan CONFIRMED, de LOW (a token beválthatatlan a törölt userrel). **Új, valós adat-higiéniai hézag.**
- **SESS-L3** — `validateCsrfTokens(except: ['stripe/*'])` wildcard tágabb a kelleténél. Jövőbeli-bővítés kockázat, ma nincs érintett route. Az első audit ezt tisztaként említette, a mai külön LOW-ként.
- **FA-L2 / FA-L3** — subscription cancel/resume nincs password-confirm; 2FA-limiter null-kulcs fallback nélkül. Az első auditban nem szerepeltek; mindkettő LOW.

## Eltérések, amiket tisztázni érdemes

1. **F1-L2 (extension email-verifikáció) — a mai ellenőrzés NEM reprodukálta.**
   Az első audit CONFIRMED/LOW-nak jelölte és NYITVA hagyta (üzleti döntés). A mai middleware-finder az extension-felületet tisztának mondta, mert a null-user guardra és a user-scope-ra fókuszált, **nem** vizsgálta explicit, hogy a `canWriteFromExtension()` ellenőrzi-e a `hasVerifiedEmail()`-t. **Ez nem cáfolat, hanem lefedettségi rés a mai körben.** → Ha akarod, egy célzott ellenőrzéssel megnézem, hogy az F1-L2 aszimmetria a jelenlegi kódban is fennáll-e (várhatóan igen, mert nem volt rá fix).

2. **FA-L1 (remember_token reset-rotálás) — a mai finder tévesen hozta, az adverzariális kör cáfolta.**
   A mai finder azt állította, a reset nem rotálja a remember_token-t; a verifikátor REFUTED (a Fortify `CompletePasswordReset` rotálja). Az első audit ezt a hibát nem követte el — ott az F1-L7 a *player-tokenre* fókuszált, a remember_token-t nem állította hiányosnak. Vagyis itt a mai kör adott egy fals pozitívot, amit a saját verifikációja kiszűrt.

## Összegzés

- **Biztonsági tartalom:** a két audit egybevág — 0 HIGH/MEDIUM, 0 IDOR, a token/session/Fortify-felület védett.
- **A korábbi 8 fixet a mai független kör de facto verifikálta** (a javított állapotot tisztaként látta).
- **Egy valóban új, érdemi LOW:** SESS-L1 (fiók-törlés árva token) — ezt az első audit nem fedte.
- **Egy lefedettségi rés a mai körben:** F1-L2 (extension email-verifikáció) — nem ellenőrizve újra; nyitott üzleti döntésként az első auditban él.
- **Nincs ellentmondás**, ami launch-blokkolót jelentene.
