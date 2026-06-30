---
name: project-entity-cleanup
description: Ongoing entity-by-entity maintainability cleanup of the topEwords app (backend+frontend per entity)
metadata: 
  node_type: memory
  type: project
  originSessionId: 00fe677e-fae5-41c2-b31d-410b90d60e98
---

The user (solo dev, vibe-coded app, limited code overview) decided on 2026-06-11 to go through every entity one by one, fixing bugs backend + frontend, prioritizing long-term maintainability. Deploy is manual file copy to shared hosting (rackhost, topwords.eu) — always give SQL for schema changes and a list of changed files.

**Done — Words entity (2026-06-11):**
- words/index.tsx split: shared pieces live in `resources/js/components/words/` (types.ts with STATUS_CONFIG, word-form-fields, status-buttons, importance-stars, practice-modal, word-insight-panel)
- AI fixes: Gemini key via config() only, key in `x-goog-api-key` header, `throttle:30,1` on AI routes, callGemini retries on invalid JSON
- Test suite repaired (was fully broken): FolderTest trait collision, UserFactory now sets onboarding_completed_at (+ withoutOnboarding state), Folder got HasFactory, stale tests updated (meaning→meaning_hu, difficulty→level, dashboard 6 levels, auth redirects to /words and /onboarding), migrations made SQLite-safe (MEDIUMBLOB driver check, duplicate onboarding migration deleted, importance migration idempotent). All 119 tests pass.

**Done — Flashcards entity (2026-06-11):**
- Backend: deck-ownership check in FlashcardFolderDeckController; calibration validation max:255 + min/max swap guard (FlashcardSetting $attributes now single source of defaults); study undo no longer deletes history on double-undo (409 no-op); free 20-card limit centralized in User::canAddFlashcardsTo() and enforced in store/importFromWord/duplicate/bulkReverse/CSV import; CSV import chunked insert in transaction + 5000-row cap + fgetcsv escape fix + formula-injection guard on export; study GET no longer writes reviews (FlashcardSrsService::newReviewFor); direction validated in submit; Flashcard::scopeUncalibrated dedups query logic; bulk ops report real affected counts.
- Frontend: show.tsx split 1970→~720 lines, pieces in components/flashcards/ (types, deck-settings-dialog, card-stats-dialog, card-row, card-preview-dialog, card-form, import-tools); all 4 TS errors fixed (project at 0 TS errors); calibrate.tsx stale-intervals useCallback dep fixed; pages re-styled to lavender pattern (heroes, rounded-3xl, pill CTAs); card rows + study buttons mobile-friendly.
- Note: headless Chrome clamps window width to 500 min — "mobile" screenshots below 500px are cropped, not true viewport; no real horizontal overflow existed (measured docW=485).

**Done — Text analysis entity (2026-06-11):**
- Backend (TextAnalysisController): analyze() validates before consuming the daily free limit; fetchSource gets url:http,https + SSRF guard (assertPublicHost blocks private/reserved IPs) + no exception-message leaking + throttle:30,1; uploadBook wraps PDF/EPUB extraction in try/catch (422 instead of 500) + throttle:10,1; book limit deduped into bookLimitFor() + BOOK_STORAGE_LIMIT const; tokenize() unicode-quote literals fixed ('\u{...}' single-quoted was dead code).
- Frontend: index.tsx split 1393→~520 lines, pieces in components/text-analysis/ (types.ts, highlighted-text, history-panel, book-panel with BookList/BookReader/BookPager, analysis-result, word-lookup-dialog which owns all lookup logic); hardcoded fetch paths replaced with wayfinder routes; book delete got confirm(); lookup fetch got error handling (no more stuck spinner); top-unknown words are now clickable (open lookup); upgrade_url rendered on free-limit error.

**Done — Chrome extension content.js split (2026-06-24):** the 4333-line `chrome-extension/content.js` was split into 8 focused modules under `chrome-extension/src/` (shared, tokenizer, lookup-popup, search-modal, flashcard-modal, page-highlight, youtube, netflix). Key technique: MV3 content scripts listed in `manifest.json` content_scripts.js run in ONE shared global scope (NOT ES modules) — so splitting = pure byte-faithful cutting + correct load ORDER (shared/helpers first, features after; runtime cross-calls are order-independent). No bundler. Verified by: declaration-inventory diff (159 top-level decls, 0 lost/dupes), `node --check` per file + combined, eslint, prettier. `build-zip.sh` FILES updated to package src/ modules; eslint.config.js got a `chrome-extension/src/**` block disabling no-undef + no-unused-vars (false positives from shared scope) while keeping background.js/popup.js fully linted. Distribution: `./build-zip.sh` rebuilds topwords-extension-{version}.zip AND copies to public/downloads/topwords-extension.zip; the unzipped public/downloads/topwords-extension/ folder is git-tracked too — re-sync it by unzipping the fresh zip. CAN'T browser-test here; user reloads unpacked extension to verify.

**Broader goal (2026-06-24):** user wants to structure/clean the WHOLE project (feels it's "spaghetti"), starting with the extension. Proposed (NOT yet adopted) 3 guardrails to stop files regrowing — words/index.tsx had been split once yet grew back to 2420 lines: (1) thin controller → Service/Action layer (TextAnalysisController is 1744 lines of logic); (2) ESLint max-lines rule + page-convention (pages/*.tsx = layout+data only, logic in components/<entity>/ + hooks); (3) single source of truth for shared config (STATUS_LABELS/COLORS were duplicated in content.js + components/words/types.ts). Note: resources/js/actions/** and routes/** are Wayfinder-GENERATED — never refactor those. handbook.tsx/welcome.tsx are big but just static content (low priority).

**Remaining entities (rough order):** Quiz/Cloze, Folders, Irregular verbs, Review, Achievements, Settings/Subscription.

**Design (2026-06-11, v2 — Duolingo):** lavender was rejected ("szörnyen néz ki"); current approved theme is playful Duolingo-style: green primary oklch(0.72 0.2 135) with --primary-shade for 3D pressed buttons (shadow-[0_4px_0_0_var(--color-primary-shade)] + active:translate-y-0.75), solid vibrant hero cards per entity — green (words, dashboard), sky-500 (flashcards), violet-500 (text analysis) — white pill CTAs with colored text, rounded-3xl shadow-sm cards, colored stat tiles (bg-green-50 etc. with big bold numbers). Match per-entity hero colors on remaining entities.

**Visual check workflow (no browser plugin installed):** temporarily append a local-only `/dev-login` route to routes/web.php (loginUsingId(User::first()), local env check), `php artisan serve --port=8765` in background, then headless Chrome: launch with `--headless --user-data-dir=/tmp/ccp --screenshot=...` in background and poll for the file (Chrome doesn't exit on macOS — kill it after). Helper pattern saved as /tmp/snap.sh that session. Remove the route after.

**Why:** user doesn't trust the codebase, considered a rewrite; agreed path is incremental cleanup with tests as the safety net. Design iteration must be screenshot-driven — blind token changes produced a result the user called terrible.
**How to apply:** when an entity is being worked on, follow the Words pattern: extract duplicated JSX into components/<entity>/, fix backend issues, update stale tests, run `php artisan test --compact`, pint, npm run build.
