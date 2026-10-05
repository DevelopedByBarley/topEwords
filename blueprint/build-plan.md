# Build Plan

Seeded by `/adopt` (2026-10-05). Items 1-17 describe features already shipped;
items 18 onward are the roadmap. Keep completed items checked, append new
features as the project grows, and never renumber completed features.

Run `/feature` to spec the next unchecked item, or `/feature 18` to pick one.

## Your features

- [x] 1. **Word list** - ranked ~10k words in 6 levels with statuses, importance stars and search
- [x] 2. **Custom words and folders** - user-added words and word folders
- [x] 3. **Onboarding placement test** - level-based placement before first use (behind `ONBOARDING_ENABLED`)
- [x] 4. **Dashboard** - per-level progress, custom-word stats, streak, due flashcards
- [x] 5. **Flashcard decks** - decks, deck folders, card CRUD, bulk actions, import from words, CSV import/export
- [x] 6. **SRS study and calibration** - Anki-style study with undo, calibration of new cards, global and per-deck settings
- [x] 7. **Text analysis** - pasted text and article URL comprehension check with unknown-word and phrase highlighting
- [x] 8. **YouTube transcripts and books** - stored transcripts and EPUB uploads with paged reading and overview
- [x] 9. **Gemini AI helpers** - word lookup, insight, AI flashcard, sentence check, with per-user budget and word cache
- [x] 10. **Achievements and streaks** - achievement groups, toasts and streak celebration
- [x] 11. **Pro subscription** - Stripe Cashier checkout, portal, cancel/resume, invoices, webhook, reconcile, plan limits
- [x] 12. **Billingo invoicing** - NAV invoices from Stripe payments via a queued job
- [x] 13. **Invites and admin panel** - invite-only registration, access overrides, free month, reports, AI fill, action log, admin 2FA
- [x] 14. **User reports and settings** - word-data error reports; profile, security/2FA, appearance, SRS, billing, subscription settings
- [x] 15. **Chrome extension** - MV3 lookup, statuses, highlighting and flashcards on web pages and YouTube/Netflix
- [x] 16. **Desktop player pairing** - device-code pairing, Sanctum player token, player API, downloads route
- [x] 17. **Public pages** - welcome, pricing, guide, handbook, terms, privacy, sitemap
- [ ] 18. **Go-live operations** - verify production `schedule:run` cron, run a live test alert to the admin email, add a scheduler dead man's switch (audit T-1, T-2, T-15)
- [ ] 19. **Player under version control** - put `topwords-player/` under real version control (own repo or tracked subfolder) before distribution (audit T-26)
- [ ] 20. **Player hardening** - IPC sender checks and media path validation, open serialization, remove mpv-bridge from build, Electron fuses, supported Electron version, pinned libmpv hash (audit T-27, T-47 to T-49)
- [ ] 21. **Player distribution** - signed release build and download/update path for users
- [ ] 22. **Gemini client service** - move `callGemini`, schemas, pricing and prompt fencing out of TextAnalysisController into a dedicated service
- [ ] 23. **Thin text-analysis controllers** - split TextAnalysisController by area (analysis, sources, books, YouTube, AI) behind services
- [ ] 24. **Entity cleanup round** - finish the per-entity maintainability pass for achievements and settings/subscription

> TODO (confirm): order of 18-24, and what "Player distribution" (21) needs
> (code signing, auto-update, macOS build).
