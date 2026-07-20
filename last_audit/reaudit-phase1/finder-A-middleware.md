# Finder A — Middleware Chains (Phase 1 re-audit)

## SUMMARY

Independent walk of every route's middleware chain (`routes.json` dump + all six route files + `bootstrap/app.php` + `EnsureOnboardingComplete` + the controllers that self-gate). Scope: routes UNDER-protected relative to what they do — missing `auth`/`verified`/`abilities`/`EnsureOnboardingComplete`, throttle gaps on expensive/auth endpoints, over-broad ability scope, onboarding-gate bypass/lockout.

**Counts:** HIGH 0 · MEDIUM 0 · LOW 4 (A-L1 extension writes miss `verified`; A-L2 extension/player writes miss `EnsureOnboardingComplete`; A-L3 guest `player/pair` unauth row-creation; A-L4 `settings` redirect answers all verbs).

Headline: **no privilege boundary is missing.** Every mutating/expensive route is authenticated (middleware or in-controller `if (! $request->user())` for the JSON clients), every AI endpoint is self-gated (`admin || hasAiAccess()` + `aiLimitGuard`), the two admin-only AI/dev endpoints (`practiceCheck`, `geminiListModels`) and the global word-edit (`words/{word}` PATCH) carry `can:admin`/`Gate::check('admin')`, ownership is enforced in-controller everywhere I checked (custom-words, decks, invoice download, player status). The `verified`/onboarding asymmetries below are self-only writes to the actor's own account, so they land LOW. The player token surface is correctly `verified`-gated at mint time, which neutralises the missing `verified` on the read/AI player routes.

### Middleware → route classification

| Class | Chain | Routes |
|---|---|---|
| **Public** | `web` only | `/`, `/guide`, `/handbook`, `/terms`, `/privacy`, `pricing`, `pricing.success` (self-signature-gated), `sitemap.xml` |
| **Webhook** | `web` + `VerifyWebhookSignature` (CSRF-exempt via `stripe/*`) | `stripe/webhook` |
| **Guest + IP-throttle** | `api` + `throttle` | `player/pair` (10,1), `player/pair/exchange` (30,1) |
| **Auth (session), no verified** | `web` + `auth` (+ throttle) | all `settings/*` (in-controller `RequirePassword`/password-rules where sensitive), `subscription.invoice.download` |
| **Auth + verified** | `web` + `auth` + `verified` (+ throttle) | `pricing.checkout`, `pricing.portal`, `player.connect`, `player.approve`, `onboarding`, `onboarding.complete` |
| **Auth + verified + onboarding** | `web` + `auth` + `verified` + `EnsureOnboardingComplete` (+ throttle) | `dashboard`, `achievements`, all `words/*`, `flashcards/*`, `text-analysis/*`, `folders/*`, `custom-words/*`, `irregular-verbs` |
| **Auth + verified + admin** | `web` + `auth` + `verified` + `can:admin` | `admin`, `admin/*`, `words/{word}` PATCH |
| **Sanctum + player ability** | `api` + `auth:sanctum` + `abilities:player` (+ throttle) | `player/me`, `player/lookup`, `player/statuses`, `player/search`, `player/decks`, `player/gemini-lookup`, `player/gemini-flashcard`, `player/disconnect` |
| **Sanctum + player ability + verified** | + `verified` | `player/update-status`, `player/update-importance`, `player/add-word`, `player/create-flashcard` |
| **Manual auth (session), no middleware auth** | `web` + `throttle` only; `if (! $request->user())` in controller | all `extension/*` (`lookup`, `search`, `statuses`, `badge`, `decks`, `add-word`, `create-flashcard`, `youtube-transcript`) |

---

## A-L1 Extension write endpoints lack `verified` (player equivalents have it)
- **Severity:** LOW
- **File:** routes/extension.php:19-20 vs routes/api.php:45-60
- **Route/surface:** `POST extension/add-word`, `POST extension/create-flashcard` (`web` + `throttle:20,1,ext-write`, manual `if (! $request->user())`)
- **Scenario:** A user registers, does NOT confirm their email, logs in (Fortify permits an unverified session), and drives the Chrome extension against their live session cookie. The web extension writes (`addWord`, `createFlashcard`) run because their only gate is `if (! $request->user())` in `ExtensionController` — there is no `verified` middleware and `canWriteFromExtension()`/`reserveExtensionWrite()` (app/Models/User.php:365, :388) never check `hasVerifiedEmail()`. The desktop-player twins of the exact same controller methods ARE `verified`-gated (routes/api.php:45 wraps `player/add-word` + `player/create-flashcard`), so the two clients disagree on the same action.
- **Evidence:** `extension.php:19` `Route::post('extension/add-word', …)->middleware('throttle:20,1,ext-write');` — no `verified`. Compare `api.php:45` `Route::middleware('verified')->group(function () { … player/add-word … })`. Controller gate is only `ExtensionController.php:139` `if (! $request->user())` and `:145` `if (! $request->user()->canWriteFromExtension())`.
- **Why not higher/lower:** Blast radius is self-only — the write lands in the actor's OWN `user_word`/`user_custom_words`/`flashcards`. No cross-user reach, no money, no entitlement. It is a policy inconsistency (unverified accounts can seed their own vocabulary via the extension while the player forbids it), not a security boundary breach. Not zero because the app declares "content-creating endpoints require `verified`" (api.php:41-44 comment) and this surface silently doesn't honour it.

## A-L2 No `EnsureOnboardingComplete` on any extension/player write (onboarding-gate bypass)
- **Severity:** LOW
- **File:** routes/extension.php (whole file), routes/api.php:45-64
- **Route/surface:** every `extension/*` and `player/*` write (`add-word`, `create-flashcard`, `update-status`, `update-importance`) — none carry `EnsureOnboardingComplete`, while every equivalent web route (`custom-words.store`, `words.status`, `flashcards.cards.store`, …) is inside the `EnsureOnboardingComplete` group (words.php:14, flashcards.php:13).
- **Scenario:** A brand-new user who has not completed onboarding (`onboarding_completed_at === null`) is redirected away from `dashboard`/`words`/`flashcards` by `EnsureOnboardingComplete` (app/Http/Middleware/EnsureOnboardingComplete.php:16). But they can still POST `extension/add-word` / `extension/create-flashcard` (session cookie) — or, once paired, `player/add-word` — and create real content before onboarding, bypassing the gate the web UI enforces.
- **Evidence:** `EnsureOnboardingComplete.php:16` `if ($request->user()?->onboarding_completed_at === null) { return redirect()->route('onboarding'); }`. It appears in `web.php:70`, `words.php:14`, `flashcards.php:13`, `text-analysis.php:7` — and NOWHERE in `extension.php` or `api.php`.
- **Why not higher/lower:** Onboarding is a UX funnel, not an authorization boundary; skipping it writes only to the actor's own account and grants no privilege, quota, or data they wouldn't get after onboarding. The web-vs-client inconsistency is the only substance, hence LOW not informational. There is NO lock-out risk in the gate itself (it redirects to a route the same user can complete), so the reverse failure mode is clean.

## A-L3 Guest `player/pair` mints DB rows with no auth (throttled, self-pruning)
- **Severity:** LOW
- **File:** routes/api.php:16-18, app/Http/Controllers/PlayerPairingController.php:37-63
- **Route/surface:** `POST player/pair` — `api` + `throttle:10,1,player-pair` only, no `auth`.
- **Scenario:** An unauthenticated attacker POSTs `player/pair` with a `device_name` up to 100 chars, 10×/min/IP, each call `PlayerPairing::create(...)` inserting a row. It is a guest endpoint by design (the desktop app has no token yet). No token is ever returned without an authenticated+verified user approving the `user_code` (`exchange` returns a token only when `isApproved()`, controller :137), so this yields no data and no access — only unauthenticated row creation.
- **Evidence:** `api.php:16` route has no `auth`; `PlayerPairingController.php:44` `PlayerPairing::where('expires_at', '<', now())->delete();` prunes expired rows on every call, and `:53` sets a `LIFETIME_MINUTES` expiry, so the table self-limits. Throttle `10,1` caps a single IP.
- **Why not higher/lower:** No token/data leak (approval requires an authenticated verified browser session; the exchange claim is atomic, :146). Bounded write amplification against a self-pruning, per-IP-throttled table — a DB-noise nuisance at most, not a privilege or DoS lever. Correctly a guest endpoint; flagged only so the unauth write is on record.

## A-L4 `settings` redirect route answers every HTTP verb
- **Severity:** LOW
- **File:** routes/settings.php:11 (`Route::redirect('settings', '/settings/profile')`)
- **Route/surface:** `settings` — `web` + `auth`, methods `GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS` (per routes.json), action `Illuminate\Routing\RedirectController`.
- **Scenario:** Any authenticated user hitting `settings` with any verb (e.g. `DELETE /settings`) receives a 302 to `/settings/profile`. `RedirectController` performs no mutation, so there is nothing to exploit; it is only a surprising method surface (a bare `Route::redirect` registers all verbs).
- **Evidence:** routes.json shows `"method":"GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS"` for `uri":"settings"` with `"action":"Illuminate\\Routing\\RedirectController"`. `auth` is present; no CSRF concern because the target is a pure redirect.
- **Why not higher/lower:** Zero state change — a redirect controller. Purely cosmetic (verb hygiene); included for completeness of the middleware walk, not because any action is reachable.

---

## Categories checked and found CLEAN (explicit)

- **Missing `auth` on a mutating route:** none. Every POST/PUT/PATCH/DELETE is either middleware-`auth` or JSON-client manual-auth (`if (! $request->user())`) — verified in `ExtensionController` (all 8 methods, lines 47/139/215/238/324/411/483/514/540/558) and the Sanctum group (api.php:23).
- **Missing `abilities`/over-broad token scope:** clean. Player tokens are minted with exactly `['player']` (PlayerPairingController.php:150-154) and every token route enforces `abilities:player` (api.php:23). No wildcard/`*` ability anywhere.
- **AI endpoints unprotected:** clean. `geminiWordLookup`/`geminiFlashcard`/`wordInsight`/`sentenceCheck` all `abort_unless(Gate::check('admin') || $request->user()?->hasAiAccess(), 403)` + `aiLimitGuard` (TextAnalysisController.php:1015,1235,1296,1375). `practiceCheck` (:1152) and `geminiListModels` (:1363) are `admin`-only. Player AI routes reuse these same self-gated methods.
- **`verified` on the player read/AI routes (api.php:23-39):** absent but MOOT — a `player` token can only be minted through `player.approve`, which is `auth`+`verified` (web.php:58-61), so the holder was verified at issue time.
- **Admin surface:** all `admin/*` under `auth`+`verified`+`can:admin` (web.php:45); the one global-data write outside that group, `words/{word}` PATCH, carries its own `can:admin` (words.php:18) and `Gate::authorize('admin')` (WordController.php:521).
- **Ownership / IDOR on `{param}`-bound mutations:** spot-checked clean — `custom-words/*` scope to `$request->user()->customWords()` (ExtensionController.php:337,424), `createFlashcard` deck via `$request->user()->flashcardDecks()->find()` (:262), invoice download `abort_unless($invoice->user_id === $request->user()->id, 404)` (SubscriptionController.php:96), player status/importance via `$request->user()->customWords()`/`knownWords()`.
- **`RequirePassword` gaps:** `password.update` and `profile.destroy` lack the middleware but require the current password in their form requests (`PasswordUpdateRequest`/`ProfileDeleteRequest` → `currentPasswordRules()`), so re-auth is enforced in-controller. `security.edit`, `subscription.edit`/`cancel`/`resume`, and `player-devices.destroy*` DO carry `RequirePassword`. `billing.update` (own address only) and `invoice.download` (own invoice read) intentionally omit it — non-sensitive.
- **Throttle gaps on expensive/auth endpoints:** none found. Auth-sensitive routes are tight (`password-update` 6/1, `profile-update`/`profile-delete` 6/1, `billing-update` 10/1, `subscription-manage` 10/1, `player-pair` 10/1, `player-approve` 10/1). Every AI route is 30/1; YouTube/book/fetch scrapers 10–30/1; reads 60–120/1. Consistent per-prefix buckets prevent one client draining another's frame.
- **Onboarding lock-out:** none — `EnsureOnboardingComplete` redirects to `onboarding` (itself reachable by the same user), no dead-end.
