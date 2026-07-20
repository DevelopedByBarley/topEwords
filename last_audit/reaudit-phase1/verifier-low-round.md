# Phase 1 LOW-round — Adversarial Verification Pass

Verifier role: refute the finders' factual claims by reading the real code at HEAD. Verdicts below quote actual `file:line`. No code was modified.

---

## Claim 1 — A-L1 / extension-verified

- **Verdict:** CONFIRMED
- **What the code actually says:**
  - `routes/extension.php:19-20` — the write routes carry ONLY a throttle, no `verified`:
    ```php
    Route::post('extension/add-word', [ExtensionController::class, 'addWord'])->name('extension.add-word')->middleware('throttle:20,1,ext-write');
    Route::post('extension/create-flashcard', [ExtensionController::class, 'createFlashcard'])->name('extension.create-flashcard')->middleware('throttle:20,1,ext-write');
    ```
    (The whole file has no `verified` anywhere; auth is done manually in the controller.)
  - `routes/api.php:45-60` — the player twins ARE wrapped in a `verified` group:
    ```php
    Route::middleware('verified')->group(function () {
        ...
        Route::post('player/add-word', ...)->name('player.add-word')...
        Route::post('player/create-flashcard', ...)->name('player.create-flashcard')...
    });
    ```
  - `ExtensionController::addWord` (line 137-147) and `createFlashcard` (line 236-246) gate ONLY on `$request->user()` (401) and `canWriteFromExtension()` (403). `canWriteFromExtension()` (`User.php:365-370`) is purely a plan/daily-quota check (`planLimit('extension_writes_per_day')`), no `hasVerifiedEmail()`. Grep of the whole controller shows zero occurrences of `hasVerifiedEmail` / `verified`.
- **Assessment:** Both halves are accurate: the extension write paths are NOT `verified`-gated while the player twins are, and the controller never checks `hasVerifiedEmail()`. Genuine asymmetry; LOW severity is fair (still requires a valid authenticated session; email-verification is the only bypassed control).

---

## Claim 2 — C-L1 / password.confirm throttle

- **Verdict:** CORRECTED
- **What the code actually says:**
  - `FortifyServiceProvider.php:118-122` — the `$throttles` map contains exactly three keys, and `password.confirm.store` is NOT among them:
    ```php
    $throttles = [
        'register.store'  => 'throttle:register',
        'password.email'  => 'throttle:password-request',
        'password.update' => 'throttle:password-request',
    ];
    ```
  - `route:list -v --path=user/confirm-password` confirms `password.confirm.store` (POST `user/confirm-password`) middleware is only:
    ```
    ⇂ web
    ⇂ Illuminate\Auth\Middleware\Authenticate:web
    ```
    No `throttle:*` present.
- **Assessment:** The map-contents half is fully CONFIRMED. The *characterization* as "an unthrottled online password-guessing oracle" is over-stated → CORRECTED. This route requires an already-authenticated session (`Authenticate:web`), so an attacker who could hit it already holds the session; it is a re-auth confirmation, not a login oracle — guessing the password here yields no privilege the attacker lacks (they can't read the boolean result cross-session, and confirming just re-stamps the caller's own `auth.password_confirmed_at`). Real residual risk is negligible; LOW is correct, but "online password-guessing oracle" mis-frames it.

---

## Claim 3 — C-L2 / password.confirm coupling

- **Verdict:** CONFIRMED
- **What the code actually says:**
  - `SecurityController.php:30-33`:
    ```php
    return Features::canManageTwoFactorAuthentication()
        && Features::optionEnabled(Features::twoFactorAuthentication(), 'confirmPassword')
            ? [new Middleware('password.confirm', only: ['edit', 'revokePlayerDevice', 'revokeAllPlayerDevices'])]
            : [];
    ```
  - `SubscriptionController.php:32-35`:
    ```php
    return Features::canManageTwoFactorAuthentication()
        && Features::optionEnabled(Features::twoFactorAuthentication(), 'confirmPassword')
            ? [new Middleware('password.confirm', only: ['edit', 'cancel', 'resume'])]
            : [];
    ```
- **Assessment:** The conditional is exactly as claimed in both controllers. Disabling the 2FA feature (or its `confirmPassword` option) returns `[]`, silently dropping the `password.confirm` re-auth from cancel/resume and player-device revoke. LOW is fair: it's a latent coupling that only bites if 2FA is ever turned off in config, which is not today's state.

---

## Claim 4 — stripe/* CSRF wildcard: how many routes

- **Verdict:** The "TWO routes" finder is CORRECT; the "only stripe/webhook" finder is REFUTED.
- **What the code actually says:**
  - `bootstrap/app.php:27` — `$middleware->validateCsrfTokens(except: ['stripe/*']);`
  - `route:list -v --path=stripe` returns exactly TWO routes:
    ```
    GET|HEAD  stripe/payment/{id}  cashier.payment › PaymentController@show
              ⇂ Laravel\Cashier\Http\Middleware\VerifyRedirectUrl
    POST      stripe/webhook       cashier.webhook › StripeWebhookController@handleWebhook
              ⇂ web
              ⇂ VerifyWebhookSignature
    ```
- **Is any stripe/ route a session-authed MUTATING route today?** NO.
  - `stripe/webhook` is POST (mutating) but is NOT session-authed — it is unauthenticated and protected by `VerifyWebhookSignature` (Stripe HMAC). CSRF exemption is required and correct here.
  - `stripe/payment/{id}` is GET only (Cashier's SCA payment-confirmation display page); GET is non-mutating and CSRF-irrelevant regardless of the exemption. It is not even in the `web` group middleware list shown (only `VerifyRedirectUrl`).
- **Assessment:** The definitive list is two routes. No CSRF hole exists today: the only mutating route under `stripe/` is signature-verified and non-session, and the other is GET. The `stripe/*` wildcard is a *future* risk (a later mutating session-authed `stripe/...` route would inherit the exemption), which matches the memory note that the wildcard was left intentionally with two sentinel tests. Finder who said "only stripe/webhook" under-counted.

---

## Claim 5 — E-L2 / pairing residue

- **Verdict:** CONFIRMED
- **What the code actually says:**
  - `PlayerPairingController::approve` (line 81-109) stamps `user_id` + `approved_at` via `forceFill(...)->save()` and returns — it never deletes the row.
  - The delete happens only in `exchange` (line 146):
    ```php
    if (PlayerPairing::whereKey($pairing->getKey())->delete() !== 1) {
        return response()->json(['error' => 'not_found'], 404);
    }
    ```
    (Plus an expiry-path delete at line 132 for already-expired rows.)
  - `PlayerPairing::LIFETIME_MINUTES = 10` (`app/Models/PlayerPairing.php:18`).
- **Assessment:** Accurate. An approved-but-never-polled pairing row stays redeemable until `expires_at` (up to ~10 min). The `poll_secret` is held only by the app that started the flow and stored as SHA-256, and `isExpired()` still gates `exchange`, so the residual window is bounded and low-value. LOW is fair.

---

## Claim 6 — F / IDOR escalation: FlashcardCardController move / bulkMove

- **Verdict:** CONFIRMED (no IDOR — the target-deck ownership check holds on BOTH paths)
- **Adversarial attack attempted:** User A tries to (a) move A's card into B's deck, or (b) pull B's card, via crafted `target_deck_id` / `ids`.
- **What the code actually says:**
  - Routes (`routes/flashcards.php:28,33`) bind a plain `{deck}` and `{flashcard}` (NOT scoped bindings), so ownership is enforced in-controller, not by the router. Verified below.
  - `move` (line 139-159):
    ```php
    abort_unless($deck->user_id === $request->user()->id, 403);          // source deck owned
    abort_unless($flashcard->deck_id === $deck->id, 403);                 // card belongs to source deck
    ... 'target_deck_id' => ['required','integer','exists:flashcard_decks,id'] ...
    $targetDeck = FlashcardDeck::findOrFail($validated['target_deck_id']);
    abort_unless($targetDeck->user_id === $request->user()->id, 403);     // TARGET deck owned
    $flashcard->update(['deck_id' => $validated['target_deck_id']]);
    ```
    - Attack (a) blocked: moving into B's deck → `$targetDeck->user_id !== A` → 403 at line 150.
    - Attack (b) blocked: a card from B's deck can't be the `{flashcard}` because line 142 requires `$flashcard->deck_id === $deck->id` and line 141 requires `$deck` be A's.
    - Minor note: line 152 writes the raw `$validated['target_deck_id']` rather than `$targetDeck->id`, but they are provably equal here (`findOrFail` on that exact id), so no bypass.
  - `bulkMove` (line 300-322):
    ```php
    abort_unless($deck->user_id === $request->user()->id, 403);           // source deck owned
    ... 'target_deck_id' => ['required','integer','exists:flashcard_decks,id'] ...
    $targetDeck = FlashcardDeck::findOrFail($validated['target_deck_id']);
    abort_unless($targetDeck->user_id === $request->user()->id, 403);     // TARGET deck owned
    $ownedIds = $deck->flashcards()->whereIn('id', $validated['ids'])->pluck('id');  // deck-scoped filter
    $moved = $deck->flashcards()->whereIn('id', $ownedIds)->update(['deck_id' => $targetDeck->id]);
    ```
    - Attack (a) blocked: same target-deck check at line 312.
    - Attack (b) blocked: `$ids` is filtered through `$deck->flashcards()->whereIn('id', ...)` (line 314), so any id belonging to another user's deck is silently dropped from `$ownedIds` before the update. The update writes `$targetDeck->id` (owner-verified), not raw input.
- **Assessment:** No gap. Both the single and bulk move paths perform the source-deck, card-membership, AND target-deck ownership checks; bulk additionally re-scopes the id list to the source deck before writing. The IDOR finder's claim that the target-deck re-check blocks cross-user moves is accurate for BOTH `move` (line 150) and `bulkMove` (line 312). Cross-user exploit could not be constructed.

---

## Overall verdict

Finders were substantially accurate: Claims 1, 3, 5, 6 CONFIRMED, Claim 4 resolved in favor of the "TWO routes" finder (the "only stripe/webhook" finder UNDER-stated the route count). The one finder over-statement is **Claim 2 (C-L1)**: `password.confirm.store` genuinely lacks a throttle (map-contents CONFIRMED), but framing it as an "unthrottled online password-guessing oracle" over-states the risk — the route sits behind `Authenticate:web`, so it re-confirms the caller's OWN password and yields no cross-session privilege; LOW is the correct severity but the wording oversells it. No HIGH/MEDIUM surfaced; the IDOR-zero claim survives the escalation attempt on the highest-value target (flashcard move/bulkMove).
