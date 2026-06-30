---
name: project-ai-scaling-decision
description: Why we chose AI-caching over the queue/Redis/Reverb/Horizon stack for scaling (no-VPS goal)
metadata: 
  node_type: memory
  type: project
  originSessionId: 460a4c0f-ef48-43c6-8e8d-19e6520b1da8
---

Decision: for the current "avoid needing a VPS" goal, scale Gemini AI via **caching + retry-tuning + client dedup**, NOT via queues/Redis/Reverb/Horizon. See the TODO in [[project-ai-scaling-plan]].

**Why:** A second AI (ChatGPT/Gemini) advised the textbook scaling stack — Laravel Queues + Redis, Reverb/Pusher WebSockets, Horizon, polling. That advice is technically correct but presupposes the very VPS/cloud infrastructure the user wants to avoid: Redis, persistent `queue:work` daemons, and Reverb servers can't run properly on cheap shared hosting (Rackhost). On shared hosting a queue worker only runs via cron `--stop-when-empty` (up to ~60s latency) and a single serial worker caps AI at ~20 jobs/min — protects the web tier from crashing but makes AI unusably slow under load.

**Key insight the queue advice missed:** queues *defer* load, they don't *reduce* it — same number of Gemini calls. In a vocabulary app the same words are looked up by thousands of users, so caching *eliminates* 80–95% of calls. Caching is what lets you avoid a VPS; queues are what you add *after* you have one. Caching also survives into the VPS phase.

**How to apply:** Implement the cache layer first (TODO #1). Keep fast interactive lookups synchronous (queue+poll feels slower for a 2s call). Only revisit queues/Reverb/Horizon once on a VPS, and even then likely only for the heaviest calls (flashcard generation).
