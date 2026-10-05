# Project Plan

> Seeded by `/adopt` from the existing codebase (2026-10-05) and a short interview.
> Sections 3 and 5 describe what already exists. Lines marked `> TODO (confirm)`
> are inferences to verify. When it reads right, run `/overview`.

## 1. Problem - What problem are we solving?

Hungarian speakers learning English need to know which words matter most and
whether they can actually understand the real texts and videos they care about.
topEwords ranks the ~10,000 most frequent English words, tracks what the learner
already knows, and turns unknown words into spaced-repetition flashcards. It
also measures comprehension of pasted text, articles, YouTube transcripts, books
and streaming subtitles against the learner's own vocabulary.

## 2. Users - Who is this for?

Hungarian-speaking learners of English. The whole UI is in Hungarian, and word
meanings and AI explanations target Hungarian speakers.

> TODO (confirm): level range and typical motivation (school, exam, work,
> watching series) are not stated in code.

## 3. Features - What does the MVP need?

Already shipped:

- Ranked word list (6 levels, Top 1000 to 8001-10000) with status
  (known / learning / saved / pronunciation / practice), importance stars, custom
  words and word folders
- Onboarding placement test by level (feature-flagged with `ONBOARDING_ENABLED`)
- Dashboard: per-level progress, custom-word stats, streak, due flashcards
- Flashcards: decks, deck folders, card CRUD and bulk actions, import from words,
  CSV import/export, Anki-style SRS study with undo, calibration of new cards,
  global and per-deck SRS settings
- Text analysis: pasted text, article URL fetch (SSRF-guarded), YouTube
  transcripts, EPUB book upload with paged reader; comprehension % and unknown
  word highlighting incl. multi-word phrases
- Gemini AI: word lookup, word insight, AI flashcard generation, sentence check,
  with a monthly per-user AI budget and a shared word-level response cache
- Achievements and streaks
- Pro subscription via Stripe Cashier (checkout, portal, cancel/resume, invoices,
  webhook with duplicate cleanup, daily reconcile) and Billingo NAV invoicing
- Invite-only registration with invite codes that can grant Pro days
- Admin panel: overview, access overrides, free month, invites, reports, AI fill
  for word data, action log; admin requires 2FA
- User error reports on word data, emailed to the admin
- Settings: profile, password and 2FA (Fortify), player device revocation,
  appearance, flashcard SRS defaults, billing details, subscription
- Chrome extension (MV3): word lookup, statuses, highlighting and flashcard
  creation on web pages and YouTube/Netflix subtitles
- Desktop "topwords Player" (Electron spike) with device-code pairing and a
  Sanctum `player` token
- Public pages: welcome, pricing, guide, handbook, terms, privacy, sitemap

Retired on 2026-07-26 ("kivezetett"), kept in code but not routed: quiz, cloze,
practice page, irregular verbs. Pages live in `resources/js/_pages-disabled/`,
tests are excluded via the `kivezetett` phpunit group. No plan to remove or
restore them.

## 4. Data - What are we storing?

- Users: auth, 2FA, billing details, Stripe customer, plan override, lifetime
  access, trial end, streak, AI usage
- Words (global master list: rank, level, Hungarian meaning, inflected forms) and
  per-user word statuses, importance and folders
- User custom words
- Flashcard decks, folders, cards, per-direction SRS reviews, global and per-deck
  SRS settings
- User books (compressed EPUB text) and YouTube transcripts (compressed segments)
- AI word cache, achievements, invites, player pairings and API tokens, reports,
  Billingo invoice records, Stripe subscriptions (Cashier)

## 5. Tech - What stack are we using?

- Laravel 13 (PHP ^8.3, 8.4 in dev), Fortify, Sanctum, Cashier (Stripe), Wayfinder
- Inertia v3 + React 19 + TypeScript, Vite 8, Tailwind CSS v4, shadcn/ui
  (Radix), lucide icons, Tiptap editor, driver.js tours, GSAP
- MySQL (XAMPP locally), database queue and cache; SQLite in-memory for tests
- Google Gemini REST API (2.5-flash / 2.5-flash-lite) for AI features
- Billingo v3 API for Hungarian NAV invoices
- Pest 4 tests, Pint, ESLint, Prettier
- Chrome extension: plain JS MV3 content scripts, no bundler
- Player: Electron 33 + libmpv via koffi, electron-builder (Windows NSIS)

## 6. Monetize - How will this make money?

Freemium. One Pro plan at 1 490 Ft / month via Stripe. Free tier is capped in
`config/plans.php` (flashcards, decks, daily analyses, books, YouTube
transcripts, extension writes, monthly AI budget). Pro also comes from invite
Pro days, admin free month, plan override or lifetime access.

> TODO (confirm): the Chrome extension is planned to move behind Pro (today only
> the YouTube transcript sidebar is gated). Not on the current roadmap.

## 7. UI/UX - How should this look and feel?

Playful, Duolingo-like: green primary with 3D pressed buttons, solid colored hero
cards per area (green for words and dashboard, sky for flashcards, violet for
text analysis), rounded-3xl cards, pill CTAs, colored stat tiles. Light and dark
mode. Mobile-friendly with a bottom navigation bar for the three main areas.
Design changes are judged from screenshots, not token tweaks.

## 8. Deployment - Where and how will this ship?

Rackhost VPS managed with Ploi, domain topwords.eu. Live in test mode since
2026-06-30 with `APP_ENV=staging`. The repo is pulled onto the server, so
nothing secret or dump-like may be committed. Needs the scheduler (`schedule:run`
cron) and a queue worker (Billingo invoice job, notifications). Player builds and
the extension zip are served from an auth-gated downloads route.

> TODO (confirm): go-live blockers from `audit-2026-09/ALLAPOT.md` are still open
> (T-1 production cron check, T-2 live test alert, T-15 scheduler dead man's
> switch).

## 9. Usage model and constraints (optional)

- Internet-facing, real paying users with card payments and personal data, so
  the money flow, invoicing (NAV/VAT) and GDPR handling are real constraints.
- Solo developer; maintainability and readability beat cleverness.
- Earlier scaling target discussed: 600-1500 users. AI calls run synchronously in
  the request, so Gemini cost and latency are bounded by caching, budgets and
  throttles.
