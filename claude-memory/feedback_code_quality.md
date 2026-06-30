---
name: feedback-code-quality
description: "User values maintainable, readable, clean code above cleverness"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 460a4c0f-ef48-43c6-8e8d-19e6520b1da8
---

When implementing features (esp. the AI cache work in [[project-ai-scaling-plan]]), the user explicitly wants code that is **easy to maintain, easy to read, and clean/elegant** — not clever or dense.

**Why:** The user is a developer, not a sysadmin, and will be the one maintaining this app long-term; readability and low maintenance burden matter more than micro-optimizations.

**How to apply:** Prefer a single central abstraction over scattered duplication (e.g. one `AiCacheService` wrapping `callGemini`, not cache logic copied into 5 call sites). Clear names, small focused methods, follow existing project conventions, PHPDoc over inline comments (per CLAUDE.md). Avoid premature cleverness.
