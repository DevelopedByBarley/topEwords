# Finder F — IDOR Sweep + Policy Coverage + ReviewController

Independent re-audit (DIMENSION F). Documentation only, no code modified. Prior
`last_audit/` reports were NOT read.

Scope: every route with a route-model binding or id/slug/token parameter, swept
for cross-user read/mutate/delete (IDOR). Plus policy-coverage mapping and the
ReviewController existence question.

---

## SUMMARY

- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0

**Result: NO IDOR found.** Every `{param}` route either (a) loads the record
through a user-scoped relationship, (b) `abort_unless($model->user_id === $request->user()->id, 403/404)`,
(c) `Gate::authorize()` against a correct policy, (d) targets a globally-shared
table (`words`, top-10000 dictionary) that has no per-user ownership, or (e) is
an admin-only route acting on an admin-global resource. Nested bindings
(deck→card, folder→deck) check BOTH levels and parent-child membership. Move/bulk-move
target decks are re-verified for ownership. No model carries a global user scope;
no custom route bindings exist — so the ownership enforcement is entirely in the
controllers/policies mapped below, and it is complete.

**ReviewController status: REMOVED / DOES NOT EXIST.** Confirmed by:
- `app/Http/Controllers/ReviewController.php` — no such file.
- `grep -rln "ReviewController" app/ routes/` → no references.
- `grep -rn "review" routes/` → no `review` index route, no `review/complete` route.
This matches the memory note that the daily-repeat "review" feature was fully
removed (route + controller + page + test deleted; only the `user_word.reviewed_at`
column was intentionally kept for onboarding/migration). There is therefore **no**
review IDOR / streak-race / MAX_PER_SESSION / INTERVALS surface to audit — the
feature is gone.

---

## MASTER IDOR TABLE — every `{param}` route

Legend for "Authz mechanism":
- `rel-scope` = record loaded via `$request->user()->relation()->find/first/get` (owner-scoped by construction)
- `abort_unless` = explicit `abort_unless($m->user_id === $request->user()->id, …)`
- `policy` = `Gate::authorize()` against a policy that checks `user_id` equality
- `global-table` = target is the shared `words` dictionary (no per-user owner; write goes to per-user pivot)
- `admin-gate` = route in `can:admin` group; resource is admin-global
- `user-token-scope` = loaded via `$request->user()->tokens()->whereKey()`

| Entity | Route | Method | How loaded | Authz mechanism | IDOR? |
|---|---|---|---|---|---|
| Word (dictionary) | `words/{word}` | WordController@update | implicit bind `Word` | `Gate::authorize('admin')` (line 521) + `can:admin` route mw | N — admin-only, global table |
| Word pivot | `words/{word}/status` | WordController@status | implicit `Word`; pivot via `$request->user()->knownWords()` (552,556,568) | global-table + rel-scope pivot | N |
| Word pivot | `words/{word}/importance` | WordController@importance | implicit `Word`; pivot via `$request->user()->knownWords()` (594,597,607) | global-table + rel-scope pivot | N |
| UserCustomWord | `custom-words/{customWord}` | UserCustomWordController@update | implicit bind | `Gate::authorize('update', $customWord)` (57) | N |
| UserCustomWord | `custom-words/{customWord}` | @destroy | implicit bind | `Gate::authorize('delete', $customWord)` (117) | N |
| UserCustomWord | `custom-words/{customWord}/status` | @status | implicit bind | `Gate::authorize('update', $customWord)` (66) | N |
| UserCustomWord | `custom-words/{customWord}/importance` | @importance | implicit bind | `Gate::authorize('update', $customWord)` (106) | N |
| Folder | `folders/{folder}` | FolderController@update | implicit bind | `Gate::authorize('update', $folder)` (43) | N |
| Folder | `folders/{folder}` | @destroy | implicit bind | `Gate::authorize('delete', $folder)` (61) | N |
| Folder + Word | `folders/{folder}/words/{word}` | FolderWordController@update | implicit binds | `Gate::authorize('update', $folder)` (15); word is global-table | N |
| FlashcardDeck | `flashcards/{deck}` | FlashcardDeckController@show | implicit bind | `abort_unless` (114) | N |
| FlashcardDeck | `flashcards/{deck}` | @update | implicit bind | `abort_unless` (197) | N |
| FlashcardDeck | `flashcards/{deck}` | @destroy | implicit bind | `abort_unless` (227) | N |
| FlashcardDeck | `flashcards/{deck}/settings` (PUT/DELETE) | @updateSettings/@destroySettings | implicit bind | `abort_unless` (206,218) | N |
| FlashcardDeck | `flashcards/{deck}/cards` | FlashcardCardController@store | implicit bind | `abort_unless` (47) | N |
| FlashcardDeck | `flashcards/{deck}/cards/import` | @importFromWord | implicit bind | `abort_unless` (66); custom-word via `->where('user_id',…)->firstOrFail` (74–76); word global | N |
| Deck + Flashcard | `flashcards/{deck}/cards/{flashcard}` (PATCH/DELETE) | @update/@destroy | implicit binds | `abort_unless` deck (116/193) + `abort_unless flashcard->deck_id===deck->id` (117/194) | N |
| Deck + Flashcard | `.../cards/{flashcard}/reset` | @resetProgress | implicit binds | `abort_unless` both levels (126,127) | N |
| Deck + Flashcard | `.../cards/{flashcard}/move` | @move | implicit binds | `abort_unless` both (141,142) + **target deck re-checked** `abort_unless($targetDeck->user_id===…)` (150) | N |
| Deck + Flashcard | `.../cards/{flashcard}/duplicate` | @duplicate | implicit binds | `abort_unless` both (163,164) | N |
| FlashcardDeck | `.../cards/bulk-delete` | @bulkDelete | implicit bind | `abort_unless` (203); ids scoped by `$deck->flashcards()->whereIn` (210) | N |
| FlashcardDeck | `.../cards/bulk-reset` | @bulkReset | implicit bind | `abort_unless` (217); `$deck->flashcards()->whereIn` (224) | N |
| FlashcardDeck | `.../cards/bulk-reverse` | @bulkReverse | implicit bind | `abort_unless` (234); `$deck->flashcards()->whereIn` (241) | N |
| FlashcardDeck | `.../cards/bulk-direction` | @bulkDirection | implicit bind | `abort_unless` (277); `$deck->flashcards()->whereIn` (285) | N |
| FlashcardDeck | `.../cards/bulk-move` | @bulkMove | implicit bind | `abort_unless` (302); **target deck re-checked** (312); source ids `$deck->flashcards()->whereIn` (314) | N |
| FlashcardDeck | `flashcards/{deck}/csv-import` | FlashcardCsvController@import | implicit bind | `abort_unless` (25) | N |
| FlashcardDeck | `flashcards/{deck}/csv-export` | @export | implicit bind | `abort_unless` (128) | N |
| FlashcardDeck | `flashcards/{deck}/calibrate` (GET) | FlashcardCalibrationController@show | implicit bind | `abort_unless` (20) | N |
| FlashcardDeck | `flashcards/{deck}/calibrate` (POST) | @rate | implicit bind | `abort_unless` (86); card via `$deck->flashcards()->findOrFail` (117) | N |
| FlashcardDeck | `flashcards/{deck}/calibrate/skip` | @skip | implicit bind | `abort_unless` (171) | N |
| FlashcardDeck | `flashcards/{deck}/study` (GET) | FlashcardStudyController@show | implicit bind | `abort_unless` (23) | N |
| FlashcardDeck | `flashcards/{deck}/study` (POST) | @submit | implicit bind | `abort_unless` (80); card via `Flashcard::where('id',…)->where('deck_id',$deck->id)->firstOrFail` (82) | N |
| FlashcardDeck | `flashcards/{deck}/study/undo` | @undo | implicit bind | `abort_unless` (106); card `where deck_id` (113); review `where flashcard_id` (117) | N |
| FlashcardFolder | `flashcards/folders/{flashcardFolder}` (PATCH/DELETE) | FlashcardFolderController@update/@destroy | implicit bind | `Gate::authorize('update'/'delete', $flashcardFolder)` (23,34) | N |
| FlashcardFolder + Deck | `flashcards/folders/{flashcardFolder}/decks/{flashcardDeck}` | FlashcardFolderDeckController@update | implicit binds | `Gate::authorize('update', $flashcardFolder)` (15) + `abort_unless($flashcardDeck->user_id===…)` (16) | N |
| YoutubeTranscript | `text-analysis/youtube/{transcript}/page` | TextAnalysisController@getYoutubePage | implicit bind | `abort_unless` (1627) | N |
| YoutubeTranscript | `.../youtube/{transcript}/overview` | @youtubeOverview | implicit bind | `abort_unless` (1642); cache key includes `u{user->id}` (1645) | N |
| YoutubeTranscript | `.../youtube/{transcript}` (DELETE) | @deleteYoutube | implicit bind | `abort_unless` (1655) | N |
| UserBook | `text-analysis/books/{book}/page` | @getBookPage | implicit bind | `abort_unless` (1746) | N |
| UserBook | `.../books/{book}/overview` | @bookOverview | implicit bind | `abort_unless` (1759); cache key includes `u{user->id}` (1762) | N |
| UserBook | `.../books/{book}` (DELETE) | @deleteBook | implicit bind | `abort_unless` (1827) | N |
| Invite | `admin/invites/{invite}` (DELETE) | AdminController@destroyInvite | implicit bind | admin-gate (`can:admin` route group) — Invite is admin-global | N |
| Sanctum token (player device) | `settings/security/player-devices/{tokenId}` | SecurityController@revokePlayerDevice | `$request->user()->tokens()->whereKey($tokenId)` (90) + `isPlayerToken` filter | user-token-scope | N |
| BillingoInvoice | `settings/subscription/invoices/{invoice}` | SubscriptionController@downloadInvoice | implicit bind | `abort_unless($invoice->user_id===…, 404)` (96) + `isIssued()` (97) | N |
| (plan string) | `pricing/checkout/{plan}` | PricingController@checkout | string param, NOT a model | `abort_unless($plan==='premium',404)` (49); subscription built on `$user->newSubscription()` | N — no entity |

### Request-body-id routes (no `{param}`, but reference ids) — also swept
| Entity ids in body | Route | Ownership of referenced ids | IDOR? |
|---|---|---|---|
| custom_X / regular word ids | `words/quiz`, `words/cloze` (GET `?ids=`) | custom via `UserCustomWord::where('user_id',$user->id)->whereIn('id',…)`; regular = global words | N |
| perfect flag only | `words/quiz/complete`, `words/cloze/complete` | no ids; streak/achievements on `$request->user()` only | N |
| target folder/deck ids | folder/deck bulk-move (above) | re-checked to caller (see table) | N |
| deck_id | `extension/create-flashcard`, `player/create-flashcard` | `$request->user()->flashcardDecks()->find($deck_id)`; 404 if not owned (ExtensionController:262–266) | N |
| custom word id | `extension/update-status`, `player/update-status` (+importance) | `$request->user()->customWords()->find($id)` (337,424); word pivot via `$request->user()->knownWords()` | N |
| word id | `extension/add-word`, `player/add-word` | writes to `$request->user()->customWords()` / knownWords pivot only | N |
| user_code / poll_secret | `player/pair`, `player/pair/exchange`, `player/connect` (approve) | codes hashed/compared; approve binds pairing to `$request->user()->id`; exchange atomically claims own row | N |

---

## Notes on why there are no findings

1. **`words/{word}` is not user-owned.** The `words` table is the shared top-10000
   dictionary. `PATCH words/{word}` is admin-only. `status`/`importance` never
   mutate the `Word` row — they write the per-user `user_word` pivot exclusively
   through `$request->user()->knownWords()`, so user A can only ever mark words in
   A's own pivot. There is no cross-user surface even though the bound model is
   unscoped. `WordController.php:552,568` (status), `:594,607` (importance).

2. **Policies are correct and fail-closed.** All three policies
   (`FolderPolicy`, `FlashcardFolderPolicy`, `UserCustomWordPolicy`) use strict
   `$user->id === $model->user_id`. Policy auto-discovery is in effect (no custom
   `guessPolicyNamesUsing`, namespaces align `App\Models` ↔ `App\Policies`), and
   `Gate::authorize` throws (denies) if a policy method is absent — so entities
   relying on policies cannot silently open.

3. **Entities with NO policy are covered by inline `abort_unless`.** FlashcardDeck,
   Flashcard, FlashcardReview, UserBook, YoutubeTranscript, BillingoInvoice, and
   the player-device token are each guarded by an explicit owner check (or a
   user-scoped relationship load) at the top of every mutating/reading method.
   This is the answer to "where is authz enforced for the 12 policy-less
   entities" — it is enforced in the controller, consistently, on every method.

4. **Nested bindings verify parent-child membership.** Deck→card routes check both
   `deck->user_id===user` and `flashcard->deck_id===deck->id`, so a valid card id
   from another of the attacker's own decks (or any deck) cannot be smuggled under
   a deck the attacker controls. Folder→deck likewise checks both.

5. **Move/bulk-move target decks are re-authorized.** A classic IDOR (moving your
   card INTO or reading FROM someone else's deck via `target_deck_id`) is blocked:
   `FlashcardCardController.php:150` and `:312` re-run `abort_unless` on the target
   deck's owner.

6. **Invoice enumeration is masked.** `downloadInvoice` returns 404 (not 403) for a
   foreign or unissued invoice, so ID guessing cannot distinguish "exists but not
   yours" from "does not exist". `SubscriptionController.php:96–97`.

7. **`admin/invites/{invite}` is intentionally admin-global.** The route lives in
   the `['auth','verified','can:admin']` group (`web.php:45–51`). Invites are not
   user-owned resources; any admin managing any invite is the intended model. Not
   an IDOR.

8. **No global user scopes, no custom route bindings.** `grep` for
   `addGlobalScope`, `Route::model`, `Route::bind`, `resolveRouteBinding`,
   `guessPolicyNamesUsing` all returned nothing (except `Word::booted()`, which
   only derives the `level` column — no ownership scoping). This confirms the
   audit surface is exactly the controller/policy checks enumerated above, and
   that implicit bindings are plain `findOrFail` with no hidden owner filter — so
   the explicit checks above are load-bearing and were verified present on every
   route.

9. **Existing tests exercise cross-user denial** for the key entities
   (`FolderTest`, `FlashcardTest`, `UserCustomWordTest`, `BookUploadTest`,
   `TextAnalysisTest`, `ExtensionTest`, `PlayerPairingTest`, `InviteTest`, etc.),
   corroborating that the authorization paths are wired and enforced, not dead.
