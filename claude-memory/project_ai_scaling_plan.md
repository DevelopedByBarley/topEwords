---
name: project-ai-scaling-plan
description: TODO — code-level optimizations to scale Gemini AI usage and avoid needing a VPS for now
metadata: 
  node_type: memory
  type: project
  originSessionId: 460a4c0f-ef48-43c6-8e8d-19e6520b1da8
---

Plan to keep the app stable under high traffic (goal discussed: 600–1500 users) **without needing a VPS yet**. AI = Google Gemini (`gemini-2.5-flash` / `flash-lite`), called **synchronously** inside the request in [TextAnalysisController.php](app/Http/Controllers/TextAnalysisController.php) via `callGemini()` (line ~1576). Each AI call blocks one PHP process for its whole duration → on shared Rackhost (~20 concurrent PHP processes) a burst of AI calls can choke the whole site.

**Strategy:** call Gemini as rarely as possible, and when called, hold the process for as short as possible. Caching (reduce calls) beats queues (defer calls) for the no-VPS goal — see [[project-ai-scaling-decision]].

## TODO — priority order

1. **✅ DONE (2026-06-24) — AI response cache by word (BIGGEST WIN).** Implemented:
   - New `ai_word_cache` table (migration `2026_06_24_143554`), `App\Models\AiWordCache`, `App\Services\AiCacheService::remember(task, word, promptVersion, model, generator)`.
   - Wired into `geminiFlashcard`, `wordInsight`, and `geminiWordLookup` (lookup cached ONLY when no context — context lookups are sentence-unique via `context_explanation`, so they stay live).
   - Cache HIT skips `callGemini` entirely → zero Gemini cost, **zero AI-budget charge** (`aiLimitGuard` still runs first, so over-budget users stay gated). MISS charges normally.
   - Quality gate: only `ok && is_array(data)` is stored; `updateOrCreate` keyed on `cache_key` (race-safe). Key = `task:word(lowercased):en:vN`.
   - Versions in `TextAnalysisController::AI_CACHE_VERSION` (lookup/flashcard/insight = 1). Bump on prompt change.
   - `php artisan ai:cache:clear [--task=] [--word=]` invalidates rows (bad answer / version bump).
   - Tests: `tests/Feature/AiCacheTest.php` (7 tests, all green). NOT cacheable (unchanged): `sentenceCheck`, `practiceCheck`.
   - ⚠️ Deploy: the new migration must run on prod. Dev DB had a pre-existing drift — the `migrations` LOG had been reset while the schema stayed current, so 7 already-applied, guard-less migrations (add_ai_access, add_text_size, add_plan_override_and_indexes, create_youtube_transcripts, add_ai_usage, create_invites, add_terms_accepted_at) showed "Pending" and `migrate` failed on duplicate column/table. **Fixed (2026-06-24) by backfilling those 7 into the `migrations` table at a new batch (no schema change), then `migrate` ran the 3 genuinely-missing ones (add_importance [idempotent], align_billing_tax_number_length [change()], create_ai_word_cache).** Prod likely has the SAME log drift — before deploying, check `migrate:status`; if those same migrations show Pending while their columns/tables exist, backfill the log rows there too, then migrate.

2. **Retry/timeout tuning in `callGemini`** (~L1600-1605). Currently 3 attempts × up to ~25s worst case → one Gemini stall holds a worker 25s → cascade. Under load: 1 retry + ~10s timeout.

3. **Client-side dedup/abort/debounce.** `AbortController` + debounce on word lookup so double-clicks/hover don't fire duplicate AI calls. Frontend callers: word-lookup-dialog.tsx, flashcards/card-form.tsx.

4. **Partial cache for local text analysis.** `buildAnalysis` is user-specific, but the global `Word` form→word map (~L314-352) is identical for all users → cache it to cut CPU/DB on big books.

## ✅ DONE (2026-06-24) — Prompt prevention (defense line #1)
Implemented for all 3 cached tasks alongside the cache:
- **Structured output**: `callGemini()` now takes an optional `?array $responseSchema`; when set it adds `responseMimeType: application/json` + `responseSchema` to `generationConfig` (Gemini v1beta, UPPERCASE types, `propertyOrdering`, `nullable`). Replaces brittle ```json regex parsing.
- Per-task schemas in `TextAnalysisController`: `lookupSchema()` (part_of_speech enum-constrained), `flashcardSchema()` (nested cloze/collocations/word_forms, nullable forms), `insightSchema()`. Required fields force consistent structure; non-applicable fields are empty strings (lookup) or null (flashcard forms).
- **Temperature lowered to 0.2** for flashcard + insight (was 0.3); lookup already 0.2.
- lookup prompt: added explicit "empty string, never invent a non-existent form, part_of_speech = primary role" constraints. flashcard prompt already had rich inline few-shot examples.
- **AI_CACHE_VERSION bumped 1→2** (prompt change) → old v1 cache rows become unreachable; run `ai:cache:clear` to prune. Test added asserting the lookup payload carries the schema.
- Heavy few-shot blocks NOT added to lookup/insight (schema + field docs suffice; avoids per-miss token cost) — revisit only if quality issues appear.

## ✅ DONE (2026-06-24) — Non-existent word guard (anti cache-poisoning)
Risk: `geminiWordLookup` runs for any `not_found` word (incl. gibberish / common misspellings), so a hallucinated answer for a fake word would be cached and served to everyone. Fix:
- `lookupSchema` gained a required `is_real_word` BOOLEAN; prompt instructs the model to set it false for gibberish/typos/foreign words, but TRUE for rare/technical/proper-noun real English words (judge the word, not "is it in our dictionary").
- `AiCacheService::remember()` now takes an optional `?callable $isCacheable` predicate (applied to the data before storing); lookup passes `fn($d) => ($d['is_real_word'] ?? true) === true` → fake words are NEVER cached (no poisoning). Negative verdicts are intentionally NOT cached either (avoid caching a wrong "fake" verdict on a real word; fakes are rare + bounded by throttle+budget).
- Controller returns `{is_real_word:false, message}` for fakes (no fabricated dictionary fields). Frontend handles it: `word-lookup-dialog.tsx` shows an amber notice; `words/index.tsx` sets a `word`-field error. Lookup version bumped 2→3 (lookup only; flashcard/insight stay 2). Tests: 18 total in AiCacheTest+AiUsageTest, all green.

## Cache data-quality / wrong-answer strategy (decided in planning)
Risk: a wrong AI answer gets cached and then served to everyone until corrected. Mitigation, in defence-in-depth order:
1. **Prevention via prompt (most important).** Enforce strict JSON via Gemini `responseSchema` + `responseMimeType: application/json`; add 1–2 few-shot examples; explicit constraints ("only Hungarian translation", "don't invent non-existent words", "flag uncertainty"); low `temperature` (~0–0.3) for deterministic lexical tasks. Per-task model choice: `flash` where quality matters, `flash-lite` where cheap/fast is fine.
2. **Quality gate before caching.** Only persist if the response is well-formed (non-empty, valid JSON shape, required fields present). Truncated/malformed responses are NOT cached.
3. **Versioning.** Store `prompt_version` + `model_version` on each `ai_word_cache` row. When the prompt is improved or the model changes, bump the version → an artisan command invalidates rows made with the old version → they regenerate with the better prompt on next lookup (cache self-improves gradually).
4. **Manual/user correction.** An artisan command (or admin "Regenerate" action) deletes a single bad row → next lookup re-fetches. Optional user "report" button flags a row for review. Deterministic per-word data rarely changes, so wrong answers are individually correctable without invalidating the whole cache.
→ Therefore design `ai_word_cache` from the start with `prompt_version` + `model_version` + `cached_at` columns and a delete/regenerate artisan command. Prompt improvement is the FIRST defence line, not an alternative to cache correction.

## Cache architecture (decided in planning)
Key fact verified in code: ALL Gemini calls funnel through ONE private method `callGemini()` ([TextAnalysisController.php](app/Http/Controllers/TextAnalysisController.php) ~L1576). Callers: `geminiFlashcard` (~L598/642), `practiceCheck` (~L725/785), `sentenceCheck` (~L810/854), `wordInsight` (~L876/916), `geminiWordLookup` (~L946/996). So caching is added in ONE central layer, not per-call-site.
- **`AiCacheService` (new, recommended)** wraps the call: `remember(task, word, language, fn() => callGemini(...))` → build key → DB hit returns instantly (0 Gemini cost) → miss runs the closure, persists, returns.
- **Key schema includes task type** so features don't collide: `lookup:dog:en:v3`, `flashcard:dog:en:v3`, `insight:dog:en:v3` (task + word + language + prompt_version). Same word → separate row per task, each reused across users.
- **Goes through cache:** `geminiFlashcard`, `geminiWordLookup`, `wordInsight`. **Stays direct (NOT cached):** `sentenceCheck`, `practiceCheck` (evaluate the user's unique sentence).
- **Extension needs nothing here:** `ExtensionController::lookup` ([ExtensionController.php](app/Http/Controllers/ExtensionController.php) ~L27) reads directly from `Word`/`UserCustomWord` tables, never calls Gemini — already serves precomputed data.

## Deferred to the VPS phase (do NOT build on shared hosting)
Queues + Redis + Reverb/Pusher + Horizon + polling — all require persistent worker processes / Redis that cheap shared hosting lacks. The cache layer above survives into this phase and keeps helping. Possible early exception: flashcard generation (longest call, 800 tokens) could use a start→poll pattern even with a sync backend — revisit after caching, may not be needed.

## Hosting context
- Now: Rackhost shared "mini" (~20 concurrent PHP processes, ~1GB, no Redis). Fine for dev/launch / a few dozen concurrent.
- Planned VPS when justified: 2 cores / 4GB / 60GB (~5715 Ft/mo). Sized for a few hundred concurrent active users IF: `QUEUE`/`CACHE`/`SESSION` → Redis, `pm.max_children≈30`, retry-tuning. Literal 1500 simultaneous AI clicks needs async AI + bigger.
- Rate limiting already in place: `throttle:30,1` on AI routes ([routes/text-analysis.php](routes/text-analysis.php)).
