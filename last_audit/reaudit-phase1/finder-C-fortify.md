# Finder C — Fortify Auth-Flow (Phase 1 re-audit)

Independent adversarial re-audit of the Fortify authentication surface: 2FA lifecycle,
password-reset tokens, `password.confirm` gating on sensitive mutations, server-side
`REGISTRATION_ENABLED` enforcement, and rate limiters. Code/config read-only; no changes made.

Stack verified: `laravel/framework` 13.16.1, `laravel/fortify` v1.36.2.

## SUMMARY

| Severity | Count |
|----------|-------|
| HIGH     | 0     |
| MEDIUM   | 0     |
| LOW      | 3     |

Findings: **C-L1** (no throttle on `password.confirm.store` current-password check), **C-L2**
(`password.confirm` gate on settings mutations is coupled to the 2FA feature flag — turns off if
2FA is ever disabled), **C-L3** (password-reset token lifetime 60 min is generous but standard).

No HIGH/MEDIUM. The Fortify auth flow is soundly configured: 2FA requires a confirm-step, every
2FA-management route is behind `RequirePassword`, recovery codes are single-use, disabling 2FA
requires re-auth, registration is genuinely removed server-side when disabled, and every auth
endpoint carries a rate limiter.

### Flow → protection table

| Flow / route | Protection present? | Notes |
|---|---|---|
| Login POST (`login.store`) | **Y** | `throttle:login` = 5/min per (email+IP) — `FortifyServiceProvider.php:98-102` |
| 2FA challenge POST (`two-factor.login.store`) | **Y** | `throttle:two-factor` = 5/min per (login.id ‖ IP) — `:90-96` |
| Register POST (`register.store`) | **Y** | `throttle:register` = 10/min per IP — `:106`, `:119` |
| Forgot-password POST (`password.email`) | **Y** | `throttle:password-request` = 5/min per IP — `:107`, `:120` |
| Reset-password POST (`password.update`) | **Y** | `throttle:password-request` = 5/min per IP — `:107`, `:121` |
| 2FA enable (`two-factor.enable`) | **Y** | `RequirePassword` middleware (re-auth) |
| 2FA confirm (`two-factor.confirm`) | **Y** | `RequirePassword` + confirm-step enforced (`confirm=>true`) |
| 2FA disable (`two-factor.disable`) | **Y** | `RequirePassword` middleware (re-auth) |
| 2FA QR / secret / recovery-codes (view+regenerate) | **Y** | `RequirePassword` on all seven `user/two-factor-*` routes |
| Recovery-code reuse | **Y (single-use)** | `replaceRecoveryCode()` strips used code — Fortify `TwoFactorAuthenticatedSessionController:61` |
| `REGISTRATION_ENABLED=false` | **Y (server-side)** | Feature dropped → `/register` + `register.store` routes ABSENT (verified) |
| Password change (`user-password.update`) | **Y (current_password)** | `PasswordUpdateRequest` requires `current_password` re-auth + `throttle:6,1` |
| Profile delete (`profile.destroy`) | **Y (current password)** | `ProfileDeleteRequest` requires `password` re-auth + `throttle:6,1` |
| Sub cancel/resume (`subscription.cancel/resume`) | **Y (password.confirm)** | `SubscriptionController::middleware()` gates cancel/resume/edit |
| Player-device revoke (`security.player-devices.*`) | **Y (password.confirm)** | `SecurityController::middleware()` gates revoke/edit |
| `password.confirm.store` (current-pw check) | **N (no throttle)** | see **C-L1** |

---

## C-L1 No rate limiter on the `password.confirm` current-password check
- **Severity:** LOW
- **File:** app/Providers/FortifyServiceProvider.php:115-129 (route-throttle wiring); Fortify route `password.confirm.store` middleware `web, Authenticate:web` (no `throttle:*`)
- **Surface:** POST `user/confirm-password` (`password.confirm.store`), and by extension `RequirePassword` on the 2FA routes
- **Scenario:** An attacker who has already hijacked an authenticated session (stolen session cookie / an unlocked, walked-away machine) but does NOT know the password wants to clear the `password.confirm` gate that protects sub-cancel, player-device-revoke, and all 2FA management. `password.confirm.store` verifies the submitted password against the hash with no throttle middleware, so they can POST candidate passwords in a loop against that single endpoint at full speed to brute-force the current password and unlock every gated action. The app-level `configureRouteThrottling()` only attaches limiters to `register.store`, `password.email`, `password.update` — it does not cover `password.confirm.store`.
- **Evidence:**
  - `FortifyServiceProvider.php:118-122`
    ```php
    $throttles = [
        'register.store' => 'throttle:register',
        'password.email' => 'throttle:password-request',
        'password.update' => 'throttle:password-request',
    ];
    ```
    (no `'password.confirm.store' => ...` entry)
  - `php artisan route:list` → `POST user/confirm-password  password.confirm.store  mw=web,Illuminate\Auth\Middleware\Authenticate:web` (no throttle).
- **Why not higher/lower:** Not MEDIUM because it is a pure post-auth escalation: the attacker must already hold a live session, so it is not an unauthenticated brute-force of the primary credential (that path, `login.store`, IS throttled at 5/min). It only lets a session-hijacker turn a *known-session / unknown-password* position into a *known-password* one to defeat re-auth gates. Bcrypt's per-attempt cost and the fact that a session-hijacker can already read most data without the password reduce impact. Not informational because there genuinely is an unthrottled online password-guessing oracle here; adding it to the `$throttles` map (or a small `throttle:6,1`) would close it.

## C-L2 `password.confirm` gate on settings mutations is coupled to the 2FA feature flag
- **Severity:** LOW
- **File:** app/Http/Controllers/Settings/SecurityController.php:30-33; app/Http/Controllers/Settings/SubscriptionController.php:32-35
- **Surface:** `subscription.cancel` / `subscription.resume`; `security.player-devices.destroy` / `destroy-all`
- **Scenario:** The `password.confirm` re-auth middleware on these sensitive mutations is only attached when BOTH `Features::canManageTwoFactorAuthentication()` AND the `confirmPassword` 2FA option are enabled. Today `config/fortify.php:153-157` enables 2FA with `confirmPassword=>true`, so the gate is live. But if an operator ever removes `Features::twoFactorAuthentication()` from the feature array (a plausible ops decision — "we don't want 2FA yet"), these controllers silently drop `password.confirm` entirely, and a hijacked session could then cancel a paying subscription or revoke all player devices with no re-auth. The protection is correct *now* but is load-bearing on an unrelated feature flag.
- **Evidence:**
  - `SecurityController.php:30-33`
    ```php
    return Features::canManageTwoFactorAuthentication()
        && Features::optionEnabled(Features::twoFactorAuthentication(), 'confirmPassword')
            ? [new Middleware('password.confirm', only: ['edit', 'revokePlayerDevice', 'revokeAllPlayerDevices'])]
            : [];
    ```
  - Identical pattern in `SubscriptionController.php:32-35` for `['edit', 'cancel', 'resume']`.
- **Why not higher/lower:** Not MEDIUM because with the current, committed config the gate IS active (verified: both routes carry `password.confirm` in the middleware chain) — this is a latent coupling, not a present hole; exploiting it requires a config change the attacker cannot make. Not informational because the coupling is real and non-obvious: whoever disables 2FA would have no signal they just removed re-auth from billing/device mutations. Worth a comment or an unconditional `password.confirm` on the mutation routes.

## C-L3 Password-reset token lifetime is 60 minutes
- **Severity:** LOW
- **File:** config/auth.php:99-100
- **Surface:** password-reset flow (`password.reset` / `password.update`)
- **Scenario:** A reset token is valid for 60 minutes (`'expire' => 60`). If a reset email is intercepted, forwarded, or lingers in a shared/again-opened mailbox within that hour, the token can be used to take over the account. Shorter windows (15–30 min) reduce that exposure. Token *reuse after consumption* is NOT possible — Laravel's `PasswordBroker::reset()` calls `$this->tokens->delete($user)` on success, so a token is one-shot; and `ResetUserPassword` additionally revokes player Bearer tokens on reset (`ResetUserPassword.php:31`), so a post-reset attacker session is also cut. The `'throttle' => 60` prevents re-requesting a new token more than once per 60s.
- **Evidence:**
  - `config/auth.php:99-100`
    ```php
    'expire' => 60,
    'throttle' => 60,
    ```
- **Why not higher/lower:** Not MEDIUM because 60 minutes is Laravel's shipped default, tokens are single-use and hashed at rest, the request endpoint is IP-throttled (5/min, C-table), and reset revokes player tokens — so this is a window-tightening hardening item, not a live flaw. Not informational because a shorter TTL is a cheap, standard improvement for a credential-recovery token.

---

## Verified-correct protections (no finding)

- **2FA confirm-step is enforced.** `config/fortify.php:153-157` sets `'confirm' => true`. `EnableTwoFactorAuthentication` only writes `two_factor_secret`/`two_factor_recovery_codes` — it does NOT set `two_factor_confirmed_at`. `hasEnabledTwoFactorAuthentication()` requires a non-null `two_factor_confirmed_at` (Fortify `TwoFactorAuthenticatable.php:21-25`), and `ConfirmTwoFactorAuthentication` sets it only after verifying a TOTP code against the secret. So 2FA is not "active" until the user proves possession of the authenticator. No half-enabled-lockout hole.
- **Disabling 2FA requires re-auth.** `DELETE user/two-factor-authentication` (`two-factor.disable`) carries `RequirePassword`. There is no un-gated disable path.
- **Every 2FA-management route is behind `RequirePassword`:** enable, confirm, disable, qr-code, secret-key, recovery-codes (view), regenerate-recovery-codes — all seven verified in `route:list` with `Illuminate\Auth\Middleware\RequirePassword`.
- **Recovery codes are single-use.** On a successful recovery-code login, `TwoFactorAuthenticatedSessionController:61` calls `$user->replaceRecoveryCode($code)`, which `str_replace`s the used code out of the stored set (`TwoFactorAuthenticatable.php:47-55`). Codes are compared with `hash_equals` (constant-time). Regeneration replaces all 8 at once.
- **`REGISTRATION_ENABLED=false` is enforced server-side, not just in the UI.** `config/fortify.php:150` conditionally includes `Features::registration()` in the feature array; with it absent Fortify does not register the routes. Verified empirically: `REGISTRATION_ENABLED=false php artisan route:list` shows the `register` and `register.store` routes **absent**. The `canRegister` prop (`FortifyServiceProvider.php:58`, `routes/web.php:17`) is a secondary UI hint, not the enforcement point.
- **Invite-only registration is TOCTOU-safe.** `CreateNewUser.php:48-90` re-checks and `lockForUpdate()`s the invite row inside the DB transaction, so concurrent registrations cannot exceed `max_uses`.
- **All four rate limiters exist and are keyed sanely.** `login` = 5/min per lowercased-email+IP; `two-factor` = 5/min per session `login.id` with IP fallback (documented rationale for the fallback at `:91-95`); `register` = 10/min per IP; `password-request` = 5/min per IP (covers both `password.email` and `password.update`). No auth endpoint was found without a limiter **except** `password.confirm.store` (see C-L1).
- **Password change and account delete both require re-authentication in the request layer** (independent of the `password.confirm` session gate): `PasswordUpdateRequest` requires `current_password`, `ProfileDeleteRequest` requires `password` (`current_password` rule via `currentPasswordRules()`), both with `throttle:6,1`. Password change also rotates `remember_token` and revokes player tokens (`SecurityController.php:130-140`).
- **Password-reset tokens cannot be replayed after use** (Laravel deletes the token on successful reset) and a reset revokes player Bearer tokens (`ResetUserPassword.php:31`).
- **Password strength:** all password entry points (register, reset, change) share `Password::default()` + `confirmed` via `PasswordValidationRules` (`app/Concerns/PasswordValidationRules.php:15-17`).

## Notes / residual (not findings)

- `config/auth.php:115` `password_timeout` = 10800s (3h) is Laravel's default confirm-window; combined with C-L2's coupling it means a 3-hour re-auth grace on the gated settings mutations, which is standard.
- The `password.confirm` gate protects `edit` + the mutations together, so the confirm happens when the page is opened and the POST reuses that window — a deliberate, sound pattern (documented in both controllers' docblocks).
