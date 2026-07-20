# Finder D — Session Hardening (independent re-audit)

Adversarial re-audit of Phase 1 Dimension D: `AuthenticateSession`, cookie flags, session
invalidation on credential change, token rotation, and CSRF exclusion scoping.
Documentation only — no code modified. Prior audit reports under `last_audit/` were NOT read.

## SUMMARY

| Severity | Count |
|----------|-------|
| HIGH     | 0     |
| MEDIUM   | 0     |
| LOW      | 3     |

Net assessment: **no request-triggerable session weakness.** The session hardening layer is
correct and defense-in-depth. `AuthenticateSession` is in the web chain; both password-change
paths rotate the remember token AND revoke player Bearer tokens; the `stripe/*` CSRF exclusion
covers exactly two routes (one GET-only, one signature-verified webhook) with no over-match into
mutating web routes; the `SESSION_SECURE_COOKIE` prod fail-safe is backed by a boot-guard against
the one misconfiguration (mistyped APP_ENV) that could silently disable it. All three LOWs are
either standard framework behavior or require an operator misconfiguration to bite.

## Config table (config/session.php)

| Setting | Value / derivation | Line | Prod-safe? |
|---------|--------------------|------|------------|
| `driver` | `env('SESSION_DRIVER','database')`; `.env`=database | 21 | Y — server-side store, cookie holds only the ID |
| `lifetime` | `(int) env('SESSION_LIFETIME',120)` = 120 min | 35 | Y (idle timeout; acceptable) |
| `expire_on_close` | `env(...,false)` = false | 37 | Y (standard; note in LOW-D3) |
| `encrypt` | `env('SESSION_ENCRYPT',false)` = false | 50 | Y — DB driver stores payload server-side; cookie = ID only. Not a leak vector |
| `secure` | `env('SESSION_SECURE_COOKIE', env('APP_ENV')==='production')` | 175 | **Y** — fail-safe true in prod even if env flag unset |
| `http_only` | `env('SESSION_HTTP_ONLY', true)` = true | 188 | **Y** — JS cannot read the cookie (XSS→session-theft mitigated) |
| `same_site` | `env('SESSION_SAME_SITE','lax')` = lax | 205 | **Y** — lax; combined with CSRF token this is correct |
| `partitioned` | false | 218 | Y (N/A; same_site≠none) |
| `serialization` | `'json'` (hardcoded) | 234 | **Y** — no PHP object-injection gadget-chain surface |
| `path` | `/` | 146 | Y |
| `domain` | `env('SESSION_DOMAIN')` = null | 159 | Y (host-only cookie) |

**Verified-correct, explicitly noted:**
- `AuthenticateSession::class` IS appended to the web group — `bootstrap/app.php:29-30`.
- `same_site=lax` + `http_only=true` + `secure`(prod) + CSRF token = a correctly layered cookie.
- `serialization=json` hardcoded — no `php` deserialization gadget surface even if APP_KEY leaked.
- CSRF web-group protection is ON; only `stripe/*` excluded (`bootstrap/app.php:27`), see LOW-D2.
- Password-change (settings) rotates `remember_token` + revokes player tokens — `SecurityController.php:132-137`.
- Password-reset (forgot flow) rotates `remember_token` via Fortify `CompletePasswordReset` AND
  revokes player tokens via `ResetUserPassword` — `ResetUserPassword.php:25-31` + `CompletePasswordReset::__invoke`.
- Account delete invalidates + regenerates token — `ProfileController.php:79-80`.
- Registration logs out + invalidates + regenerates token (email-verify-first) — `RegisterResponse.php:23-28`.
- Settings password change requires `current_password` — `PasswordUpdateRequest.php:21` — so a
  hijacked session alone cannot rotate the password without the current one.

---

## [LOW-D1] Email change does not invalidate other sessions
- **Severity:** LOW
- **File:** app/Http/Controllers/Settings/ProfileController.php:27-48
- **Surface:** flow (profile / email update)
- **Scenario:** A user changes their account email. `update()` fills the model, nulls
  `email_verified_at`, saves, and sends the verify mail — but it never calls
  `logoutOtherDevices()` / does not rotate the password hash or remember token. Other live
  sessions (including one an attacker may hold) remain valid after the email change. There is no
  cross-device kill on email change the way there is on password change.
- **Evidence:**
  ```php
  $user->fill($request->validated());
  $emailChanged = $user->isDirty('email');
  if ($emailChanged) { $user->email_verified_at = null; }
  $user->save();
  if ($emailChanged) { $user->sendEmailVerificationNotification(); }
  return to_route('profile.edit');   // no session invalidation, no token rotation
  ```
- **Why not higher/lower:** This is standard Laravel behavior — `AuthenticateSession` keys on the
  *password* hash, not email, so email change is intentionally not a session-kill event. Blast
  radius is low: (a) the changed email is unverified (`email_verified_at=null`), so any
  `verified`-gated route is now locked out; (b) an attacker cannot use email change alone to seize
  the account because password reset would still go to the *new* email only after verification
  and the password-change path itself requires `current_password`. It is a hardening gap (an
  account-takeover victim who changes only their email won't boot the attacker), not an exploit.
  LOW, not MEDIUM: no privilege gain, no request-triggerable session forgery.

## [LOW-D2] `stripe/*` CSRF exclusion is a prefix wildcard (future-route risk)
- **Severity:** LOW
- **File:** bootstrap/app.php:27
- **Surface:** config (CSRF except list)
- **Scenario:** `validateCsrfTokens(except: ['stripe/*'])` exempts every current and future route
  under the `stripe/` prefix from CSRF verification. Today the prefix resolves to exactly two
  routes — `GET stripe/payment/{id}` (Cashier SCA confirm page, non-mutating) and
  `POST stripe/webhook` (Stripe signature-verified). Neither is CSRF-forgeable in a harmful way:
  the GET mutates nothing; the webhook authenticates via Stripe's signature (and the app
  boot-guards a non-empty `STRIPE_WEBHOOK_SECRET`, `AppServiceProvider.php:99-108`). The residual
  risk is purely forward-looking: if someone later registers a *state-changing, session-authed*
  route under `stripe/…`, it would silently inherit the CSRF exemption and become CSRF-forgeable.
- **Evidence:**
  ```php
  $middleware->validateCsrfTokens(except: ['stripe/*']);
  ```
  `php artisan route:list` under `stripe/`:
  ```
  GET|HEAD  stripe/payment/{id}   cashier.payment   (non-mutating SCA confirm view)
  POST      stripe/webhook        cashier.webhook   (Stripe signature verified)
  ```
- **Why not higher/lower:** Not exploitable *now* — the only mutating route in the prefix is the
  webhook, whose signature check is the real authenticator and is boot-enforced. It's a
  pattern-shape hazard, not a live hole, and the wildcard exists because Cashier itself registers
  routes under `stripe/` (narrowing it to `stripe/webhook` would risk future Cashier routes
  breaking). LOW: requires a future code change to become a vulnerability.

## [LOW-D3] `SESSION_SECURE_COOKIE` prod fail-safe hinges on exact `APP_ENV=production` (mitigated)
- **Severity:** LOW
- **File:** config/session.php:175
- **Surface:** config
- **Scenario:** The Secure cookie flag in production is not set by a hard-coded true but derived:
  `env('SESSION_SECURE_COOKIE', env('APP_ENV') === 'production')`. If `SESSION_SECURE_COOKIE` is
  unset (the documented normal case — `.env.example:43` leaves it commented) the flag defaults to
  true **only** when `APP_ENV` is exactly the string `production`. A mistyped `APP_ENV` (`prod`,
  `live`, `"production "`) would make the fail-safe evaluate false and ship the session cookie
  without Secure over a downgraded/HTTP path, enabling sidejacking.
- **Evidence:**
  ```php
  'secure' => env('SESSION_SECURE_COOKIE', env('APP_ENV') === 'production'),
  ```
- **Why not higher/lower:** The one scenario that bites (mistyped `APP_ENV`) is closed by a
  boot-guard: `AppServiceProvider::assertKnownEnvironment()` (`AppServiceProvider.php:54-69`)
  throws and refuses to boot if `APP_ENV` is not one of `local|testing|staging|production`, so a
  typo like `prod`/`live` cannot silently disable the flag — the app won't start at all. An unset
  `APP_ENV` fail-safes to `production` via `config/app.php`. The residual hazard is essentially
  nil (a valid non-prod env like `staging` legitimately gets no Secure flag, which is correct).
  Documented as LOW because the derivation *looks* fragile in isolation but is backed by the
  boot-guard; requires operator misconfiguration that the guard already blocks.

---

## Sub-dimension verdicts

**AuthenticateSession in chain:** PRESENT & CORRECT. `bootstrap/app.php:29-30` appends it to the
web group. Mechanism verified in framework source (`AuthenticateSession.php:60-68`): it stores the
password hash in session and logs out (`logout()` → `logoutCurrentDevice()` + `session()->flush()`
+ throws `AuthenticationException`) any request whose stored hash no longer matches the DB hash.
Because both password-change paths change the DB hash, all other devices are killed on their next
request. Also covers `remember`-cookie sessions (`AuthenticateSession.php:51-57`).

**Cookie flags:** All prod-safe. `http_only=true` (default), `same_site=lax` (default),
`secure`=prod fail-safe true. `encrypt=false` is fine because the DB driver keeps the payload
server-side and the cookie carries only the session ID.

**Password-change session invalidation + token rotation:** CORRECT on both paths.
- Settings (`SecurityController.php:130-140`): `forceFill(password + remember_token=Str::random(60))`
  → AuthenticateSession kills other sessions (hash change); rotated remember_token kills other
  "remember me" cookies; `revokePlayerTokens()` kills the Bearer/player API tokens. Requires
  `current_password` (`PasswordUpdateRequest.php:21`).
- Reset/forgot (`NewPasswordController.store` → `ResetUserPassword.reset` +
  `CompletePasswordReset`): DB hash changes (AuthenticateSession kills sessions), remember_token
  rotated by `CompletePasswordReset::__invoke`, player tokens revoked by `ResetUserPassword.php:31`.

**Token rotation on login/privilege change:** Login goes through Fortify's default
`AuthenticatedSessionController`, which regenerates the session on login (framework `LoginResponse`
via `regenerate()`), preventing session fixation. Registration (`RegisterResponse.php:23-28`)
logs out + invalidates + regenerates token. Account delete
(`ProfileController.php:75-80`) logs out + invalidates + regenerates token. No app-owned
privilege-elevation flow bypasses this.

**CSRF:** Web group is CSRF-protected. Only `stripe/*` excluded (LOW-D2); the exclusion resolves
to one GET (non-mutating) and one signature-verified webhook — no session-authed mutating route is
wrongly exempt today.
