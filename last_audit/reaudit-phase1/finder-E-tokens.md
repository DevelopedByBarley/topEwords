# Finder E — Token Lifecycle (Phase 1 re-audit, independent)

Scope: player-token + extension-token creation, abilities/scope, expiration, revocation,
uniformity, and the device-pairing flow. Code-only, documentation-only. No files modified.
No `last_audit/` prior reports were read.

## SUMMARY (severity counts)

- HIGH: 0
- MEDIUM: 0
- LOW: 4  (E-L1 verified-gating uniformity note, E-L2 approved-but-unclaimed pairing residue,
  E-L3 device-name display trust, E-L4 revoke throttle vs. list-cardinality)
- INFORMATIONAL / DEFENDED (no finding, documented for the record): D-1 (TransientToken bypass
  is inert), D-2 (IDOR on tokenId is closed), D-3 (sanctum.expiration=null contradiction resolved).

Net: the token lifecycle is clean. There is **exactly one** token type in the whole app
(the `player` PAT), it is ability-scoped, it carries an explicit 90-day per-token expiry that
the Sanctum guard DOES enforce, revocation is user-scoped with a real row delete and no IDOR,
and the pairing code is high-entropy, one-time, time-limited, and user-bound. Findings below are
all LOW self-only / hardening notes.

---

## TOKEN TABLE

| Token type | How issued | Abilities | Expiry | Revocable? how |
|---|---|---|---|---|
| **Player PAT** (desktop lejátszó) | `PlayerPairingController::exchange` → `User::createToken('topwords Player – <device>', ['player'], now()->addDays(90))` (PlayerPairingController.php:150-154) | `['player']` only — enforced by `abilities:player` (`CheckAbilities`, requires ALL) on every `api/player/*` data route | **90 days**, explicit per-token `expires_at`; guard enforces it independently of `config.expiration` | YES: (a) per-device — `DELETE settings/security/player-devices/{tokenId}` → row delete; (b) all — `DELETE settings/security/player-devices` → `User::revokePlayerTokens()`; (c) auto on password change / reset / profile-email change; (d) self via `POST api/player/disconnect`; (e) daily `sanctum:prune-expired` removes expired rows |
| **Extension** (Chrome) | **NOT a token.** Session/cookie auth via the `web` guard; controller checks `$request->user()` manually and returns `csrf_token()` only when a session exists (ExtensionController.php:40-49) | n/a (session, not PAT) | n/a (session lifetime) | Via normal session/logout; no PAT row to revoke |
| Any `*` (full-access) token | **Never minted anywhere** — the only `createToken` call in the entire codebase is the player one (grep: 1 hit) | — | — | — |

Extension and player are **NOT uniform by design**: the extension is a first-party cookie SPA
(session), the player is a headless Bearer client (PAT). Both reuse the same `ExtensionController`
data methods; the only token-bearing client is the player.

---

## Resolution of the `sanctum.expiration = null` vs "90-day" contradiction

**Resolved: player tokens DO expire in 90 days. There is no immortality.**

- `config/sanctum.php:53` → `'expiration' => null`. Per the framework, this null disables the
  **global** minutes-based override only.
- The Sanctum guard check is a **two-clause AND** (vendor/laravel/sanctum/src/Guard.php:128-129):
  - `(! $this->expiration || $token->created_at->gt(now()->subMinutes($this->expiration)))`
    — with `expiration=null`, `! $this->expiration` is `true`, so this clause never rejects.
  - `(! $token->expires_at || ! $token->expires_at->isPast())`
    — this clause independently rejects any token whose **per-token** `expires_at` is in the past.
- The player token is created **with** an explicit `expires_at = now()->addDays(90)`
  (PlayerPairingController.php:150-154; `PlayerPairing::TOKEN_LIFETIME_DAYS = 90`,
  PlayerPairing.php:25). The `personal_access_tokens.expires_at` column exists and is indexed
  (migration: `$table->timestamp('expires_at')->nullable()->index()`).

So: `config.expiration=null` ≠ "tokens never expire" here — it only means "no *global* TTL
override forcing a *shorter* age on all tokens." The per-token 90-day `expires_at` is set at
creation and enforced by clause 2 of the guard. After 90 days the guard rejects the Bearer token,
`sanctum:prune-expired --hours=24` (routes/console.php) reaps the row daily, and
`SecurityController::playerDevices` already filters expired rows from the UI
(SecurityController.php:67). The memory note "player-token 90 days" is correct and verified in code.

---

## D-1 (DEFENDED, no finding) TransientToken::can() always-true bypass is inert here
- **Severity:** informational
- **File:** vendor/laravel/sanctum/src/TransientToken.php:15-18; bootstrap/app.php (no `statefulApi`)
- **Surface:** `abilities:player` middleware on `api/player/*`
- **Scenario considered:** Sanctum's `TransientToken::can()` returns `true` for *any* ability, so a
  first-party **session-cookie** request would satisfy `abilities:player` unconditionally
  (and the `api/player/*` group has no CSRF). If the api group were stateful, a logged-in user's
  browser session (or a CSRF-forged cross-site POST riding the cookie) could reach the CSRF-free
  player write endpoints.
- **Evidence:** `EnsureFrontendRequestsAreStateful` / `statefulApi()` is applied **nowhere** in the
  project (grep across app/, bootstrap/, config/ = 0 hits). The api routes therefore run stateless:
  `auth:sanctum` authenticates the api group **only** via Bearer PAT, never via the session cookie,
  so no `TransientToken` is ever produced on these routes. `config/sanctum.php` `stateful` domains
  matter only when that middleware is present.
- **Why documented, not a finding:** the always-true `can()` is real but unreachable — the config
  that would expose it is absent. Worth a one-line regression guard: if someone later adds
  `->statefulApi()` or moves player routes under the `web`/stateful stack, the CSRF-free player
  writes become session-forgeable. Currently: no exposure.

## D-2 (DEFENDED, no finding) No IDOR on tokenId in per-device revoke
- **Severity:** informational
- **File:** app/Http/Controllers/Settings/SecurityController.php:88-97; routes/settings.php:34-37
- **Surface:** `DELETE settings/security/player-devices/{tokenId}`
- **Scenario considered:** attacker passes another user's token id to revoke/enumerate it.
- **Evidence:** lookup is scoped to the caller: `$request->user()->tokens()->whereKey($tokenId)->first()`
  — a foreign token id resolves to `null` and nothing is deleted. `->whereNumber('tokenId')` on the
  route rejects non-numeric ids. An extra `isPlayerToken()` guard (`abilities === ['player']`, exact
  match, not `->can('player')`) prevents deleting any future broader-scoped token via this endpoint.
  The frontend passes only `device.id` (security.tsx:242), never a user id.
- **Why documented, not a finding:** ownership + numeric binding + ability match = closed. No IDOR.

## D-3 (DEFENDED, no finding) Password/reset/email-change purge Bearer tokens
- **Severity:** informational
- **File:** SecurityController.php:130-140 (password), app/Actions/Fortify/ResetUserPassword.php:31
  (reset), app/Http/Controllers/Settings/ProfileController.php:73 (email change);
  core: User::revokePlayerTokens (User.php:460-466)
- **Evidence:** all three account-security transitions call `revokePlayerTokens()`, which deletes
  every token with exactly `abilities === ['player']`. Without this, a leaked Bearer token would
  survive a password reset (the classic "attacker keeps access after victim resets" gap). Covered.

---

## E-L1 Player read endpoints (`me`, lookup, search) are reachable by an unverified account
- **Severity:** LOW
- **File:** routes/api.php:23-30 (read group has `auth:sanctum`+`abilities:player`, NOT `verified`);
  PlayerPairingController::me (PlayerPairingController.php:171-179)
- **Surface:** player token / `GET api/player/me`, `lookup`, `statuses`, `search`, `decks`
- **Scenario:** a user who never confirmed their email can still pair a player (the pairing approve
  page IS `verified`-gated in web.php:58, so in practice they can't reach approve without verifying —
  see note) and then read their own vocab/lookup/AI-lookup via the token. The write group
  (`add-word`, `create-flashcard`, `update-status`) IS `verified`-gated (api.php:45), so no content
  creation. This is a **uniformity/gating** observation, not a breach: reads expose only the caller's
  own data and public dictionary content.
- **Evidence:** `Route::middleware(['auth:sanctum', 'abilities:player'])->group(...)` wraps the read
  group with no `verified`; the approve web route is `Route::middleware(['auth', 'verified'])`
  (web.php:58), so a token can only exist for an already-verified user in the normal flow. The gap is
  purely theoretical (token minted, then email un-verified is not a supported transition).
- **Why not higher:** self-only data, no cross-user read, no writes; the pairing approval itself is
  behind `verified`, so a token for an unverified account cannot arise through the intended flow.
- **Why not lower:** it is a real asymmetry — reads are not `verified`-gated while writes are — worth
  noting so a future refactor that lets tokens outlive verification doesn't silently open reads.

## E-L2 Approved-but-never-claimed pairing rows linger up to 10 min carrying user_id
- **Severity:** LOW
- **File:** PlayerPairingController::approve (PlayerPairingController.php:103-108);
  exchange delete (PlayerPairingController.php:146)
- **Surface:** pairing flow / `player_pairings` row
- **Scenario:** after `approve` stamps `user_id`+`approved_at`, the row is only deleted when the app
  polls `exchange` and successfully claims it. If the app never polls (crashes, closed), the approved
  row — which now links a `user_id` to a still-live `poll_secret_hash` — persists until `expires_at`
  (≤10 min) or the next `store()`/expiry sweep. Anyone holding the raw `poll_secret` in that window
  can still redeem it for a token. The secret is only known to the originating app (never sent to the
  browser), so this requires the app's local secret to have leaked.
- **Evidence:** `approve` calls `forceFill([...])->save()` (no delete); the row is removed only in
  `exchange` on a successful claim (line 146) or when expired (`store()` prune line 44 /
  `exchange` expiry delete line 132). `LIFETIME_MINUTES = 10` bounds the window.
- **Why not higher:** window ≤10 min; redemption requires the high-entropy raw `poll_secret`
  (`bin2hex(random_bytes(32))` = 256-bit) which never leaves the originating device; only the SHA-256
  hash is stored. One token, `player`-scoped, revocable. This is device-flow phishing surface already
  understood — the code-level primitive (entropy/one-time/expiry) is sound.
- **Why not lower:** the approved row briefly binds a real `user_id` to a redeemable secret; a
  claim-on-approve or shorter approved-TTL would shrink the residue. Genuine (small) hardening gap.

## E-L3 Device name is user-controlled and surfaced in the token name + settings UI
- **Severity:** LOW
- **File:** PlayerPairingController::sanitizeDeviceName (PlayerPairingController.php:230-235);
  used in token name (line 151) and shown by SecurityController::playerDevices (line 73)
- **Surface:** pairing `store` `device_name` → PAT `name` → settings/security list
- **Scenario:** the `device_name` from the guest `store` call becomes part of the token `name`
  (`'topwords Player – '.$device_name`) and is later rendered in the Összekötött eszközök list. An
  attacker who tricks a victim into approving *their* pairing controls this string; if the frontend
  ever rendered it unescaped it would be stored-XSS. React/Inertia escapes by default, and the
  backend strips control chars (`\p{C}+`) and caps to 100 chars, so today it is inert.
- **Evidence:** `sanitizeDeviceName` removes only Unicode control chars and trims/caps length — it
  does NOT strip `<`, `>`, quotes; safety relies entirely on the React renderer escaping. The value
  originates from an unauthenticated `store()` request (device-flow phishing already accepted).
- **Why not higher:** rendered through React (auto-escaped), control chars stripped, length-capped;
  no HTML-context sink found; self-only (appears only in the pairing victim's own settings).
- **Why not lower:** it is untrusted, attacker-influenceable text stored verbatim and displayed —
  a defense-in-depth note in case any surface (email, PDF, blade) later renders it raw.

## E-L4 Per-device revoke throttle (10/min) vs. unbounded device list
- **Severity:** LOW
- **File:** routes/settings.php:30-37 (`throttle:10,1,player-device-revoke` on both revoke routes);
  SecurityController::playerDevices (no cap on returned rows)
- **Surface:** `DELETE settings/security/player-devices[/{id}]`
- **Scenario:** the "revoke all" endpoint exists precisely for the many-device case, so this is minor:
  but if a user (or a compromised-then-recovering account) had accumulated >10 live player tokens,
  per-device revocation is rate-limited to 10/min. The mitigation is the single-shot
  `revokeAllPlayerDevices` (also 10/min but deletes all in one request), so a user is never actually
  stuck. `playerDevices()` itself lists all non-expired player tokens with no LIMIT.
- **Evidence:** both revoke routes share `throttle:10,1`; `revokeAllPlayerDevices` → one query,
  `revokePlayerTokens()` deletes every player token in a single request.
- **Why not higher:** "revoke all" fully covers the mass case in one un-throttled-by-cardinality
  call; per-device throttle only paces the UI. No lockout, no security loss.
- **Why not lower:** noting the list is uncapped and per-device revoke is paced, in case a UX flow
  ever depends on revoking many individually.

---

## Pairing-flow assessment (code-level primitives)

| Property | Verdict | Evidence |
|---|---|---|
| Code entropy (user_code) | Adequate | 8 chars from a 30-symbol confusion-free alphabet ≈ 30^8 ≈ 2^39 over a ≤10-min window; uniqueness enforced by DB unique index + retry loop (generateUniqueUserCode, lines 196-209). Human-verification code, not the secret. |
| Secret entropy (poll_secret) | Strong | `bin2hex(random_bytes(32))` = 256-bit CSPRNG; only SHA-256 hash stored (`poll_secret_hash`), raw never persisted and never sent to the browser (lines 47, 51, 123). |
| Time-limited | Yes | `expires_at = now()+10min` (LIFETIME_MINUTES=10); checked in `approve` (isExpired), `exchange` (isExpired → 410 + delete), and swept in `store` prune (line 44). |
| One-time redemption | Yes, race-safe | Atomic claim via conditional delete: `PlayerPairing::whereKey(...)->delete() !== 1` gates token issuance (lines 146-148) — two concurrent polls, only the one whose DELETE affected a row gets a token; the loser gets the same 404 as an already-claimed code. |
| User-binding | Yes | `approve` stamps `user_id = $request->user()->id` under an authenticated + `verified` web session with CSRF (web.php:58-60); `exchange` mints the token for `$pairing->user` (lines 141, 150); `isApproved()` requires both `approved_at` and non-null `user_id` (PlayerPairing.php:45-48). |
| No token in URL / no password to client | Yes | Token returned only in the `exchange` JSON body (line 158); the approve page has no URL params / no prefill by design (controller docblock, connect() lines 65-75) so a phishing link can't one-click approve a foreign pairing. |
| Guest endpoints throttled | Yes | `player/pair` 10/min, `player/pair/exchange` 30/min, `player/connect` (approve) 10/min — all IP-bucketed (api.php:16-21, web.php:60). |

Residual risk = the accepted device-flow phishing vector (tricking a victim into approving the
attacker's `user_code`) — a social/UX risk, not a code defect. The code-level primitives
(entropy, one-time, expiry, user-binding, secret handling) are all correctly implemented. The only
code-level hardening notes are E-L2 (claim-on-approve to shrink the approved-but-unclaimed residue)
and E-L3 (device-name display trust).
