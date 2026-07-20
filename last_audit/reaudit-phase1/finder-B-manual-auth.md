# Finder B — Middleware-Bypassing Manual Auth Checks (Phase 1 re-audit)

**Scope:** Public routes (no auth middleware) that perform sensitive actions gated only by an in-controller check — signed URL, token compare, manual `Auth::check()`/`$request->user()`, `abort_unless`, `hash_equals`. Independent re-audit; no `last_audit/` reports consulted.

**Verdict:** No HIGH, no MEDIUM. The three named suspects (`pricing/success` signature, `sitemap.xml` closure, Stripe webhook signature) are all **verified correct**. 3 LOW notes, all self-only / design-tradeoff / defense-in-depth. The manual-auth surfaces (extension web routes, player-pairing device flow) enforce authorization correctly and unbypassably.

## SUMMARY

| Severity | Count |
|---|---|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 3 |
| Verified correct (no finding) | 6 |

### Every PUBLIC route (no auth middleware) and its ACTUAL auth mechanism

Routes are "public" = the middleware column carries **no** `Authenticate` / `auth:*` guard. Auth (if any) is enforced *inside* the controller/closure.

| Route | Method | Actual gate (in controller/closure) | Correct? |
|---|---|---|---|
| `/` , `/guide`, `/handbook`, `/terms`, `/privacy` | GET | None — genuinely public static Inertia pages | ✅ intended |
| `pricing` | GET | None — public marketing page; reads only `$user?->…` (null-safe) | ✅ |
| `pricing/success` | GET | `$request->hasValidSignature()` (25 h temporarySignedRoute) → else soft-redirect. Performs **no** state mutation. | ✅ verified |
| `sitemap.xml` | GET (closure, web.php:29) | None needed — renders a **fully static** 3-URL blade (`/`, `/terms`, `/privacy`); no DB, no user data | ✅ verified |
| `stripe/webhook` | POST | `VerifyWebhookSignature` middleware (Stripe HMAC-SHA256, constant-time, tolerance 300s) verified **before** handler runs; CSRF-exempt by design | ✅ verified |
| `extension/lookup,search,statuses,badge,decks` | GET | Manual `if (! $request->user()) return 401` (web session guard) | ✅ |
| `extension/add-word`, `extension/create-flashcard` | POST | Manual `$request->user()` 401 + `canWriteFromExtension()` 403 + atomic reserve | ✅ |
| `extension/youtube-transcript` | GET | Manual `$request->user()` 401 + video-id regex | ✅ |
| `api/player/pair` | POST | None (guest device-flow start); IP throttle 10/1; only creates a pending pairing row | ✅ |
| `api/player/pair/exchange` | POST | `poll_secret` (32-byte, SHA-256-hashed) + `user_code` DB match; approval flag; atomic single-use delete-claim | ✅ verified |

All *other* routes in the dump carry `Authenticate` (web or `auth:sanctum`) in the middleware column and are out of scope for Dimension B.

---

## NF-1 pricing/success — signed URL check verified correct (no finding)
- **Severity:** — (verified correct)
- **File:** app/Http/Controllers/PricingController.php:179-197; routes/web.php:24-27
- **Surface:** GET `pricing/success` (public, `web` only)
- **Analysis:** The route is intentionally public so a lapsed signature yields a graceful redirect instead of a raw 403 right after a successful payment (comment at web.php:25-26). The controller enforces the signature itself: `if (! $request->hasValidSignature())`. The URL is minted with `URL::temporarySignedRoute('pricing.success', now()->addHours(25))` (line 132) — the signature covers the full URL incl. the `expires` param, so params cannot be tampered. **Crucially, `success()` performs NO state mutation** — it only reads `$request->user()?->activeSubscription()` and returns a flash redirect. Provisioning happens exclusively in the webhook (`checkout.session.completed`), never here. Therefore replaying a valid (unexpired) success link, or visiting it as another user, grants nothing: it renders a flash message and redirects to `pricing`. There is no idempotency concern because there is no side effect to duplicate.
- **Why not a finding:** No provisioning, no entitlement grant, no write. Replay is inert. Signature correct and covers what matters.

## NF-2 sitemap.xml — no private data leak (no finding)
- **Severity:** — (verified correct)
- **File:** routes/web.php:29-31; resources/views/sitemap.blade.php:1-18
- **Surface:** GET `sitemap.xml` (public closure)
- **Analysis:** The closure returns `response()->view('sitemap')`. The blade is a **static** file listing exactly three hard-coded public URLs (`https://topwords.eu/`, `/terms`, `/privacy`). No Eloquent queries, no `$user`, no loop over user-generated or unpublished content, no request-derived data. Nothing private is reachable.
- **Why not a finding:** Zero dynamic content; nothing to leak.

## NF-3 Stripe webhook — signature is the sole gate and verified before mutation (no finding)
- **Severity:** — (verified correct)
- **File:** routes/web.php:41; app/Http/Controllers/StripeWebhookController.php:40-72; vendor Cashier `VerifyWebhookSignature`; config/cashier.php:49-53
- **Surface:** POST `stripe/webhook`
- **Analysis:** The route carries `Laravel\Cashier\Http\Middleware\VerifyWebhookSignature` in the middleware stack (route dump confirms). That middleware runs `WebhookSignature::verifyHeader(payload, Stripe-Signature, config('cashier.webhook.secret'), tolerance)` and throws `AccessDeniedHttpException` on any failure — **before** `handleWebhook` executes, so no mutation is reachable for an unsigned/forged request. Verified in the SDK: `verifyHeader` requires a well-formed `Stripe-Signature` header (missing header ⇒ `getTimestamp` returns -1 ⇒ throws), compares with `Util::secureCompare` (constant time), and enforces the 300s timestamp tolerance — so **replay** of an old captured event is rejected once outside tolerance. Within tolerance, the app's own `stripe_webhook_events` event-id idempotency (insertOrIgnore, lines 49-63) makes a replayed event a no-op 200. Every state-mutating handler (`handleInvoicePaymentSucceeded`, `handleChargeRefunded`, `handleCustomer*`, `handleCustomerSubscription*`) is a `protected` method only reachable *after* the signature gate. Empty-secret path: if `STRIPE_WEBHOOK_SECRET` is unset, an attacker still cannot forge a matching HMAC (they lack the secret regardless of its value) and cannot craft a valid header, so the middleware fails closed in production.
- **Why not a finding:** Signature verified before any mutation; replay defeated by tolerance + event-id dedup; no unsigned mutation path.

## NF-4 CSRF exemption scoped to stripe/* — no extra hole (no finding)
- **Severity:** — (verified correct)
- **File:** bootstrap/app.php:27
- **Surface:** `validateCsrfTokens(except: ['stripe/*'])`
- **Analysis:** CSRF is disabled for the `stripe/*` prefix (required — Stripe cannot send a CSRF token). The only route registered under `stripe/` in this app is `stripe/webhook` (Cashier's other stripe/* routes are not published here; the route dump shows only the webhook). The webhook is independently protected by the signature middleware, so the CSRF exemption creates no additional unauthenticated-mutation surface. A malicious cross-site POST to `stripe/webhook` still dies at signature verification.
- **Why not a finding:** Wildcard is broader than strictly necessary but the only matching route is signature-gated; blast radius nil. (See LOW-1 for the future-route note.)

## NF-5 Extension web routes — manual session-auth gate present on every method (no finding)
- **Severity:** — (verified correct)
- **File:** routes/extension.php:11-23; app/Http/Controllers/ExtensionController.php (every action)
- **Surface:** `extension/*` (web + throttle only, no `auth` middleware)
- **Analysis:** By design these carry no auth middleware so an unauthenticated caller gets a JSON 401 instead of an HTML login redirect (comment at extension.php:6-7). Auth is resolved by the `web` session guard (`$request->user()`), and **every** action opens with `if (! $request->user()) return response()->json(['error' => 'unauthenticated'], 401)` (lines 47, 139, 215, 238, 324, 411, 483, 514, 558; `badge` returns `count:0`). Ownership is enforced per query (`$request->user()->customWords()`, `->knownWords()`, `->flashcardDecks()->find()`), so no IDOR. Write actions add plan gate + atomic `reserveExtensionWrite()`. Session cookie ⇒ CSRF still applies to the POST routes (they are NOT under `stripe/*`).
- **Why not a finding:** Gate uniformly present, ownership-scoped, no bypass. (See LOW-2 on the missing `verified` layer vs the web equivalents.)

## NF-6 Player pairing device-flow — secret compare + single-use claim correct (no finding)
- **Severity:** — (verified correct)
- **File:** app/Http/Controllers/PlayerPairingController.php:37-165; routes/api.php:16-21
- **Surface:** POST `api/player/pair` + `api/player/pair/exchange` (guest, IP-throttled)
- **Analysis:** `store` (guest) creates a pending row with a 256-bit `poll_secret` of which only the SHA-256 hash is stored; response returns the plaintext secret once. `exchange` (guest) looks the row up by `poll_secret_hash = sha256(input)` AND normalized `user_code`, requires `isApproved()` (approval is a CSRF-protected, `auth`+`verified` web POST in `approve()`), then claims the token via an atomic `whereKey(...)->delete() === 1` guard so only one concurrent poll wins — single-use enforced at the DB. Token minted with `['player']` ability + explicit 90-day TTL. The secret is high-entropy and hashed, so the DB index lookup (not constant-time) is not timing-attackable in practice. `approve()` deliberately takes no URL param / pre-fill (phishing-resistant, comment 65-71).
- **Why not a finding:** Correct capability-style token exchange; approval requires a full authenticated + email-verified web session; single-use is atomic.

---

## LOW-1 CSRF exemption uses a wildcard (`stripe/*`) rather than the exact webhook path
- **Severity:** LOW
- **File:** bootstrap/app.php:27
- **Surface:** CSRF middleware config
- **Scenario:** Today only `stripe/webhook` lives under `stripe/`. If a future developer adds any *state-changing, session-authenticated* route under the `stripe/` prefix (e.g. a `stripe/portal-return` handler), it would be **silently exempt from CSRF** by inheriting this wildcard, without the author noticing. No current exploit — this is a latent footgun, not a live hole.
- **Evidence:**
  ```php
  $middleware->validateCsrfTokens(except: ['stripe/*']);
  ```
- **Why not higher/lower:** LOW not MEDIUM because there is exactly one matching route today and it is signature-gated, so blast radius is currently zero; it is a documented decision in prior audits (Cashier historically registers other `stripe/` routes). Flagging only as a future-safety note — narrowing to `stripe/webhook` would remove the trap.

## LOW-2 Extension web routes skip `verified` (email-verification) that their web/player twins enforce
- **Severity:** LOW
- **File:** routes/extension.php:11-23 (no `verified`); contrast routes/api.php:45 (player twins wrapped in `verified`) and words/flashcards web routes (all carry `EnsureEmailIsVerified`)
- **Surface:** `extension/add-word`, `extension/create-flashcard`, and the extension status/importance writes
- **Scenario:** A signed-up-but-unverified user (valid `web` session, `email_verified_at = null`) could create custom words / flashcards through the extension endpoints, whereas the equivalent web routes and the Sanctum player write-routes require a verified email. Self-only: the user acts on their own account, no cross-user or privilege effect. Gain is limited to bypassing the email-verification prerequisite for content creation.
- **Evidence:** `routes/extension.php` write routes carry only `throttle`; the player write-twins are inside `Route::middleware('verified')` (api.php:45). ExtensionController checks `$request->user()` but never `hasVerifiedEmail()`.
- **Why not higher:** Self-scoped, no entitlement/money/cross-user impact; extension auth is a session cookie that only exists after login. Purely a consistency gap with the web surface. LOW.

## LOW-3 `pricing/success` signed link is not user-scoped (shareable within its 25 h window)
- **Severity:** LOW
- **File:** app/Http/Controllers/PricingController.php:132, 179-197
- **Surface:** GET `pricing/success`
- **Scenario:** The `temporarySignedRoute('pricing.success', +25h)` carries no user identifier in the signature. If user A's success URL leaks (browser history, referrer, shared screenshot) within 25 hours, user B visiting it gets a valid signature. Because `success()` then keys the flash message off `$request->user()?->activeSubscription()` (the *visitor's* subscription, not A's), B sees at most a generic "payment processing"/"active" message about B's own state — no data about A, no provisioning, no mutation. Effect is a possibly-misleading flash message to the visitor.
- **Evidence:**
  ```php
  $successUrl = URL::temporarySignedRoute('pricing.success', now()->addHours(25));
  // ...
  if (! $request->hasValidSignature()) { return redirect()->route('pricing')->with('info', …); }
  if ($request->user()?->activeSubscription() === null) { return …'feldolgozás alatt'…; }
  ```
- **Why not higher:** No side effect, no cross-user data disclosure (all reads are of the *visitor's* own user), signature still required. The link being non-user-scoped is harmless because the endpoint is a read-only flash redirect. LOW / near-informational.

---

## Closing note
Every Dimension-B suspect resolves to **verified correct**. The manual `$request->user()` gate on the extension controller and the device-flow secret/single-use logic on player pairing are uniformly applied and unbypassable. The Stripe webhook is signature-verified before any mutation, with tolerance-based replay protection layered over app-side event-id idempotency. The three LOWs are a CSRF-wildcard future-footgun, an email-verification consistency gap on the extension writes (self-only), and a non-user-scoped but side-effect-free success link. None is a launch blocker.
