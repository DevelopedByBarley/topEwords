# topEwords - Project Overview

<!-- blueprint:source-hash c7a4413fee313e19c5f296dd911aff36691a1a03e7680faa9ebf1f67bdd4635d -->

> English vocabulary app for Hungarian speakers (https://topwords.eu): the ~10k
> most frequent words with status tracking, SRS flashcards, comprehension analysis
> of real texts, and Gemini AI helpers. Freemium with a Stripe Pro plan.

## Problem

Hungarian learners of English don't know which words matter most or whether they
can actually understand the texts and videos they care about. topEwords ranks the
~10,000 most frequent words, tracks what the learner knows, turns unknown words
into spaced-repetition flashcards, and measures comprehension of pasted text,
articles, YouTube transcripts, books and streaming subtitles against the learner's
own vocabulary.

## Users

- **Hungarian-speaking learners of English** - entire UI in Hungarian; meanings
  and AI explanations target Hungarian speakers.
- **Access tiers:** guest (public pages only) -> Free (capped by `config/plans.php`)
  -> Pro (Stripe, invite Pro days, admin free month, `plan_override`, or
  `lifetime_access`).
- **Admin** - admin panel, requires 2FA.
- Registration is invite-only (invite codes, optionally granting Pro days).

> TODO (confirm): level range and typical motivation (school, exam, work,
> watching series).

## Usage model

- Internet-facing with real paying users, card payments and personal data: the
  money flow, NAV/VAT invoicing and GDPR handling are real constraints.
- Solo developer: maintainability and readability beat cleverness.
- Scale target discussed: 600-1500 users.
- Gemini calls run synchronously in the request; cost and latency are bounded by
  the shared word cache, per-user monthly AI budgets and throttles.

## Features

Items 1-17 are shipped (checked in `build-plan.md`); 18+ is the roadmap.

1. **Word list** - ranked ~10k words in 6 levels (Top 1000 ... 8001-10000), statuses, importance stars, search.
2. **Custom words and folders** - user-added words and word folders.
3. **Onboarding placement test** - level-based placement, behind `ONBOARDING_ENABLED`.
4. **Dashboard** - per-level progress, custom-word stats, streak, due flashcards.
5. **Flashcard decks** - decks, deck folders, card CRUD, bulk actions, import from words, CSV import/export.
6. **SRS study and calibration** - Anki-style study with undo, new-card calibration, global and per-deck settings.
7. **Text analysis** (headline) - pasted text and SSRF-guarded article URL comprehension %, unknown-word and multi-word phrase highlighting.
8. **YouTube transcripts and books** - stored transcripts and EPUB uploads with paged reader and overview.
9. **Gemini AI helpers** - word lookup, word insight, AI flashcard, sentence check; per-user budget, shared word cache.
10. **Achievements and streaks** - achievement groups, toasts, streak celebration.
11. **Pro subscription** - Cashier checkout, portal, cancel/resume, invoices, webhook with duplicate cleanup, daily reconcile, plan limits.
12. **Billingo invoicing** - NAV invoices from Stripe payments via a queued job.
13. **Invites and admin panel** - invite-only registration, access overrides, free month, reports, AI fill for word data, action log, admin 2FA.
14. **User reports and settings** - word-data error reports emailed to admin; profile, password/2FA, player device revocation, appearance, SRS, billing, subscription.
15. **Chrome extension** - MV3 lookup, statuses, highlighting, flashcards on web pages and YouTube/Netflix subtitles.
16. **Desktop player pairing** - device-code pairing, Sanctum `player` token, player API, auth-gated downloads.
17. **Public pages** - welcome, pricing, guide, handbook, terms, privacy, sitemap.
18. **Go-live operations** - verify production `schedule:run` cron, live test alert to admin, scheduler dead man's switch (audit T-1, T-2, T-15). **Next.**
19. **Player under version control** - track `topwords-player/` (own repo or tracked subfolder) before distribution (T-26).
20. **Player hardening** - IPC sender checks, media path validation, open serialization, drop mpv-bridge from build, Electron fuses, supported Electron, pinned libmpv hash (T-27, T-47..T-49).
21. **Player distribution** - signed release build and download/update path.
22. **Gemini client service** - move `callGemini`, schemas, pricing and prompt fencing out of `TextAnalysisController`.
23. **Thin text-analysis controllers** - split `TextAnalysisController` by area (analysis, sources, books, YouTube, AI) behind services.
24. **Entity cleanup round** - finish the maintainability pass for achievements and settings/subscription.

**Retired 2026-07-26 ("kivezetett"):** quiz, cloze, practice page, irregular
verbs. Code kept but not routed; pages in `resources/js/_pages-disabled/`, tests
in the excluded `kivezetett` phpunit group. No plan to remove or restore.

## Data model

Taken from the existing MySQL schema. All tables have `id` + timestamps unless
noted. These shapes are locked: shipped features and live user data depend on them.

### User (`users`)

- `name`, `email`, `password`, `email_verified_at`, `terms_accepted_at`
- 2FA: `two_factor_secret`, `two_factor_recovery_codes`, `two_factor_confirmed_at`
- `invite_id` -> Invite
- Billing: `billing_type`, `billing_name`, `billing_tax_number`,
  `billing_company_registration_number`, `billing_country`, `billing_zip`,
  `billing_city`, `billing_address`, `billing_phone`, `billingo_partner_id`
- Cashier: `stripe_id`, `pm_type`, `pm_last_four`, `trial_ends_at`
- Access: `plan_override` (string), `lifetime_access` (bool), `ai_access` (bool)
- AI budget: `ai_credits_used`, `ai_credit_limit`, `ai_credits_reset_at`
- Activity: `streak`, `last_activity_date`, `text_analyses`, `quiz_completions`
  (retired feature), `onboarding_completed_at`
- has many: decks, flashcard folders, word folders, custom words, books,
  transcripts, achievements, reports, Billingo invoices, subscriptions, player pairings, tokens

### Word (`words`) - global master list

- `word`, `rank` (int), `level` (1-6), `meaning_hu`, `extra_meanings` (text),
  `synonyms`, `part_of_speech`, `example_en`, `example_hu`
- Forms: `form_base`, `verb_past`, `verb_past_participle`,
  `verb_present_participle`, `verb_third_person`, `is_irregular`, `noun_plural`,
  `adj_comparative`, `adj_superlative`, `extra_forms`, `forms_checked_at`
- `derived_from_word_id` -> Word (self)

### UserWord (`user_word`, pivot, no id)

- `user_id`, `word_id`, `status` (known / learning / saved / pronunciation /
  practice), `importance` (tinyint stars), `reviewed_at` (date)

### UserCustomWord (`user_custom_words`)

- `user_id`, `word`, plus the same meaning/example/form columns as Word,
  `status`, `importance`, `reviewed_at`

### Folder (`folders`) + `folder_word` pivot

- `user_id`, `name`; many-to-many with Word

### FlashcardDeck / FlashcardFolder / Flashcard

- `flashcard_decks`: `user_id`, `name`, `description`
- `flashcard_folders`: `user_id`, `name`; `flashcard_deck_folder` pivot to decks
- `flashcards`: `deck_id`, `word_id` (nullable), `front`, `front_notes`,
  `front_speak`, `back`, `back_notes`, `back_speak`, `direction`
  (`front_to_back` / `back_to_front` / `both`), `color` (hex), `is_imported`

### FlashcardReview (`flashcard_reviews`) - one per card direction

- `flashcard_id`, `direction`, `state` (new / learning / review / relearning),
  `due_at`, `interval`, `ease_factor`, `repetitions`, `lapses`, `learning_step`,
  `is_leech`, `previous_state` (JSON, for undo), `introduced_on`, `reviewed_on`

### FlashcardSetting (per user) / FlashcardDeckSetting (per deck override)

- Shared SRS fields: `new_cards_per_day`, `max_reviews_per_day`, `learning_steps`
  (JSON), `graduating_interval`, `easy_interval`, `starting_ease`, `easy_bonus`,
  `hard_interval_modifier`, `interval_modifier`, `max_interval`,
  `lapse_new_interval`, `leech_threshold`, `shuffle_cards`
- User-level only: calibration ranges `calib_{somewhat,know,well}_{min,max}`

### UserBook / YoutubeTranscript

- `user_books`: `user_id`, `title`, `file_type`, `compressed_text` (blob),
  `total_pages`, `text_size`
- `youtube_transcripts`: `user_id`, `video_id`, `title`, `compressed_segments`
  (blob), `total_pages`, `text_size`

### AiWordCache (`ai_word_cache`) - shared across users

- `cache_key`, `task`, `word`, `language`, `prompt_version`, `model`, `response`

### Other

- `user_achievements`: `user_id`, `achievement_key`, `unlocked_at`
- `invites`: `code`, `label`, `max_uses`, `uses`, `expires_at`
- `player_pairings`: `user_code`, `poll_secret_hash`, `device_name`, `user_id`,
  `approved_at`, `expires_at`; tokens in Sanctum `personal_access_tokens`
- `reports`: `user_id`, `word_id`, `category`, `description`, `status`
- `billingo_invoices`: `user_id`, `stripe_invoice_id`, `billingo_document_id`,
  `invoice_number`, `issuing_started_at`, `emailed_at`
- `stripe_webhook_events`: `event_id`, `type` (dedupe)
- Cashier `subscriptions` / `subscription_items`; framework `jobs`, `cache`, `sessions`
- `irregular_verbs`: retired feature data, kept

## Tech stack

- **Laravel 13** (PHP ^8.3, 8.4 in dev) - backend; Fortify (auth/2FA), Sanctum
  (player token), Cashier (Stripe), Wayfinder (typed routes)
- **Inertia v3 + React 19 + TypeScript**, Vite 8, Tailwind v4, shadcn/ui (Radix),
  lucide, Tiptap, driver.js tours, GSAP - frontend
- **MySQL** (XAMPP locally), database queue and cache; SQLite in-memory for tests
- **Google Gemini REST** (2.5-flash / 2.5-flash-lite) - AI features
- **Billingo v3 API** - Hungarian NAV invoices
- **Pest 4, Pint, ESLint, Prettier** - tests and linting
- **Chrome extension** - plain JS MV3 content scripts, no bundler
- **Player** - Electron 33 + libmpv via koffi, electron-builder (Windows NSIS)

## Monetization

Freemium, one Pro plan at **1 490 Ft / month** via Stripe. Free tier caps live in
`config/plans.php`: flashcards, decks, daily analyses, books, YouTube
transcripts, extension writes, monthly AI budget. Pro can also come from invite
Pro days, admin free month, `plan_override` or `lifetime_access`.

> TODO (confirm): Chrome extension planned to move behind Pro (today only the
> YouTube transcript sidebar is gated); not on the roadmap.

## UI/UX

Playful, Duolingo-like: green primary with 3D pressed buttons; solid hero cards
per area (green = words/dashboard, sky = flashcards, violet = text analysis);
`rounded-3xl` cards, pill CTAs, colored stat tiles. Light and dark mode.
Mobile-friendly with a bottom nav for the three main areas. Design changes are
judged from screenshots, not token tweaks.

- `/` welcome, `/pricing`, guide, handbook, terms, privacy, `/sitemap.xml` - public
- `/onboarding` - placement test
- `/dashboard` - progress overview
- `/words` - ranked list and search
- `/flashcards`, `/flashcards/{deck}`, `.../study`, `.../calibrate`, `.../csv-export`
- `/text-analysis`, `/text-analysis/books/{book}/page|overview`,
  `/text-analysis/youtube/{transcript}/page|overview`
- `/achievements`
- `/settings/{profile,security,flashcards,billing,subscription}`
- `/admin` - admin panel (2FA)
- `/player/connect`, `/downloads/{file}` - player pairing and auth-gated downloads
- `/extension/*` - Chrome extension API

## Deployment

- **Host:** Rackhost VPS managed with Ploi; domain `topwords.eu`.
- **State:** live in test mode since 2026-06-30, `APP_ENV=staging`.
- **Repo is pulled onto the server** - never commit secrets or dump-like files.
- **Workers:** scheduler (`schedule:run` cron) and a queue worker (Billingo
  invoice job, notifications).
- **Downloads:** player builds and extension zip served from the auth-gated
  downloads route.
- External services: Stripe (webhook), Billingo, Gemini, mail.

> TODO (confirm): go-live blockers from `audit-2026-09/ALLAPOT.md` still open
> (T-1 production cron check, T-2 live test alert, T-15 scheduler dead man's
> switch) - covered by build-plan item 18.

## Open questions

> Resolve in the plans, then re-run /overview.

- Order of roadmap items 18-24 is unconfirmed.
- Item 21 "Player distribution" scope: code signing, auto-update, macOS build?
- Items 19-21 depend on `topwords-player/`, which the plans place outside the
  tracked app; item 19 must land before 20-21.
- Items 22-24 are refactors without user-facing behavior; the plans don't state
  acceptance criteria beyond structure.
- User level range and motivation (section 2) and extension-behind-Pro (section
  6) are unconfirmed.
- Roadmap items reference `audit-2026-09/` (T-numbers), which is currently
  untracked in Git.
