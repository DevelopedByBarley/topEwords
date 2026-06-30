---
name: Chrome extension paywall plan
description: The Chrome extension will be a paid/premium feature in the future
type: project
originSessionId: 51d2deee-7a4d-4113-8170-9d556311a407
---
The Chrome extension will be placed behind a paywall (paid feature) at some point.

**Why:** Business decision to monetize the extension.
**How to apply:** When working on extension features, keep in mind they may need subscription gating via Cashier. Don't assume the extension is freely available to all users forever.

**Current state (2026-06-16):** The first premium-gated extension feature is the YouTube transcript sidebar — its endpoint (`extension/youtube-transcript` → `ExtensionController::youtubeTranscript`) checks `hasActiveAccess()` and returns `{error:'premium'}` (403). The rest of the extension (lookup/statuses/highlighting/caption bar) is still free. User said the transcript gating is tentative ("egyelőre … még ez változhat"), so the free/paid split may shift.
