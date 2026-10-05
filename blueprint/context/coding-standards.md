# Coding Standards

> Rewritten by `/adopt` (2026-10-05) to match the code that exists. It also keeps
> the Laravel Boost guidelines that lived in `CLAUDE.md` before the Blueprint
> overlay replaced that file.

## Stack and skills

Laravel 13, PHP ^8.3 (8.4 locally), Inertia v3, React 19, TypeScript, Tailwind
v4, Fortify, Sanctum, Cashier 16, Wayfinder, Pest 4, Pint, ESLint 9, Prettier 3.
Stick to these versions; do not add or change dependencies without approval.

Activate the matching skill when working in its area: `laravel-best-practices`
(any backend PHP), `inertia-react-development` (pages, forms, navigation),
`wayfinder-development` (frontend route references), `pest-testing` (any test),
`tailwindcss-development` (styling), `cashier-stripe-development` (billing).
Use Laravel Boost `search-docs` for version-specific docs before code changes,
and `database-schema` / `database-query` instead of raw tinker SQL.

## Project layout

- Routes are split per area in `routes/*.php` and required from `routes/web.php`;
  `routes/api.php` holds the player API (Sanctum `player` ability).
- `app/Http/Controllers` per area; `Settings/` subfolder for settings pages.
- `app/Services` for domain logic (SRS, AI usage, AI cache, achievements,
  YouTube captions, text extractors, `Billingo/`).
- `app/Concerns` for shared validation-rule traits and toggles; `app/Support`
  for small helpers (`Billing`, `HtmlSanitizer`, `PublicIpAddress`).
- `app/Jobs`, `app/Listeners`, `app/Notifications`, `app/Console/Commands` as
  in standard Laravel. No Enums or Events folders yet; don't add base folders
  without approval.
- Plan limits live in `config/plans.php` and are read via `User::planLimit`;
  never hardcode limit numbers in controllers or pages.
- Retired features (quiz, cloze, practice page, irregular verbs) stay in code
  but are unrouted; their pages are in `resources/js/_pages-disabled/`. Don't
  delete or revive them without a build-plan item.

Known debt: `TextAnalysisController` (~2450 lines) holds analysis, sources,
books, YouTube and the Gemini client. New logic goes into a service, not into
that controller.

## PHP

- Curly braces for every control structure.
- Constructor property promotion; no empty zero-argument constructors.
- Explicit return types and parameter types everywhere.
- TitleCase enum keys if enums are introduced.
- Array shape types in PHPDoc where arrays carry structure.
- Use `php artisan make:*` with `--no-interaction` to create classes.
- After editing PHP, run `vendor/bin/pint --dirty --format agent`.

## Laravel

- Validation: prefer a FormRequest for new or reworked endpoints (15 exist);
  inline `$request->validate()` is still common in older controllers. Validate
  array size before element rules (`array|max:` first).
- Authorization: policies via `Gate::authorize` where one exists (Folder,
  FlashcardFolder, UserCustomWord); otherwise scope ownership explicitly
  (`abort_unless($model->user_id === $request->user()->id, 403)`). Never trust a
  client-supplied user id.
- Admin endpoints use `can:admin` plus the `admin.2fa` middleware and log
  through `AdminActionLogger`.
- Every write and every AI or external-fetch route gets a named `throttle:`
  middleware; AI routes also get `ai.budget`.
- JSON endpoints return the existing `ok` / `error_code` envelope. A 429 on an
  Inertia request becomes a Hungarian flash error (`bootstrap/app.php`).
- `AppServiceProvider` refuses to boot on unsafe config; extend that guard when
  adding required production config.
- Use named routes and `route()` for URLs. Read config via `config()`, never
  `env()` outside config files.
- Schema changes need migrations that also run on SQLite (tests). Production
  has had migration-log drift before: check `migrate:status` before deploying.

## AI (Gemini)

- All calls go through `callGemini` with a response schema, low temperature and
  the fallback model; per-task models are in `config/services.php`.
- Charge every call against `AiUsageService` (reserve, settle, refund) and keep
  `GEMINI_PRICING` current.
- Wrap untrusted learner text with `fenceUntrustedText` and sanitize words with
  `sanitizeWordForPrompt`.
- Cacheable word-level tasks go through `AiCacheService`; bump
  `AI_CACHE_VERSION` when a prompt changes.

## Frontend

- Pages in `resources/js/pages`, area components in
  `resources/js/components/<area>/`, shadcn primitives in `components/ui`,
  plus `layouts`, `hooks`, `lib`, `types`. All file names kebab-case.
- Pages hold layout and data; move logic and repeated JSX into area components
  and hooks so pages don't regrow into thousand-line files.
- State is local React state; there is no global store.
- Reference backend routes with Wayfinder (`@/routes`, `@/actions`), never
  hardcoded paths. `resources/js/actions`, `routes` and `wayfinder` are
  generated; never edit them.
- Mutations: Inertia `<Form>`, `useForm` or `router` for page flows; the
  `lib/http.ts` JSON helpers (CSRF headers included) for JSON endpoints.
- Deferred props get a skeleton empty state.
- All user-facing copy is Hungarian and hardcoded (no frontend i18n).
- TypeScript must stay at 0 errors (`npm run types:check`).

## Styling

- Tailwind v4, CSS-first config; shadcn/ui components where they fit.
- Support light and dark mode (`dark:` variants).
- Follow the approved Duolingo-style theme: green primary with
  `--primary-shade` pressed buttons, per-area hero colors (green words and
  dashboard, sky flashcards, violet text analysis), rounded-3xl cards, pill CTAs.
- Judge visual changes by screenshot, desktop and mobile.

## Chrome extension and player

- `chrome-extension/src/*` are MV3 content scripts sharing one global scope (no
  modules, no bundler); load order in `manifest.json` matters. Rebuild the zip
  with `build-zip.sh`.
- `topwords-player/` is a plain-JS Electron app; treat its IPC and native
  bridge as a trust boundary.

## Testing

A runner is configured: Pest 4, about 100 test files in `tests/Feature` and
`tests/Unit`, SQLite in-memory with array cache/session/mail and a sync queue.
The test command is declared in `AGENTS.md`, so **tests are a gate for
logic-bearing steps**.

- Every logic change ships with a new or updated Pest test in the same diff;
  most tests are feature tests. Create them with
  `php artisan make:test --pest {name}` and use model factories and their
  states.
- Run the smallest relevant set during a step
  (`php artisan test --compact --filter=...`), and the full suite before
  `/complete`.
- Tests in the `kivezetett` group are excluded by `phpunit.xml`; don't delete
  tests without approval.
- UI-only steps ride on build plus screenshot evidence.
- Do not write throwaway verification scripts when a test can prove it.

## Browser Verification

No browser test harness is declared. For UI work use the running app and
screenshots (desktop and mobile). Run `/tests browser` to add one deliberately;
never install a runner mid-feature.

## Code Quality

- No commented-out code.
- No unused imports or variables.
- Reuse existing components and services before writing new ones; check sibling
  files for structure and naming.
- Descriptive names (`isRegisteredForDiscounts`, not `discount()`).
- Maintainable and readable over clever.

## Comments

The project rule is stricter than usual: in code, only type docblocks (PHPDoc
types and array shapes) and linter directives. No explanatory prose comments,
no banners, no step narration. Express intent with names and small functions.

## Writing

- No em dashes (U+2014) in generated content: docs, comments, commit messages,
  READMEs, specs.
- Use a hyphen for `term - description` separators; rephrase prose with commas,
  parentheses, or a colon. Avoid en dashes and the ellipsis character too.
- Commit messages are in Hungarian, matching the existing history.
