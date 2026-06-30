# Memory Index

- [Chrome extension paywall plan](project_extension_paywall.md) — Extension will be a paid/premium feature in the future
- [Entity-by-entity cleanup](project_entity_cleanup.md) — Ongoing maintainability refactor; Words done, Flashcards next; manual deploy needs SQL + file list
- [Security audit](project_security_audit.md) — Step-by-step audit; findings in SECURITY_AUDIT.md; Auth + Extension/AI done
- [Phrase highlighting](project_phrase_highlighting.md) — DONE: multi-word phrases highlighted in text analysis via n-gram match
- [AI scaling plan](project_ai_scaling_plan.md) — TODO: cache AI by word + retry-tuning + client dedup to scale Gemini without a VPS
- [AI scaling decision](project_ai_scaling_decision.md) — Why caching beats the queue/Redis/Reverb stack for the no-VPS goal
- [Hosting decision](project_hosting_decision.md) — Target scaling path: Rackhost VPS + Ploi (custom server); test→prod steps + cost
- [VPS deployment](project_vps_deployment.md) — App LIVE on VPS (test mode 2026-06-30); bugs fixed (JSON default, fastcgi buffer, driver.js), deploy cmds, .env, remaining tests/go-live
- [Billingo invoicing](project_billingo_invoicing.md) — NAV invoices via Billingo v3 on Stripe webhook; test-profile gotcha (new profile/key for prod)
- [Code quality](feedback_code_quality.md) — User wants maintainable, readable, clean code over cleverness
