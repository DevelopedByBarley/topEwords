---
name: project-hosting-decision
description: Chosen scaling/hosting path — Rackhost VPS + Ploi (custom server), with test→production steps
metadata:
  node_type: memory
  type: project
  originSessionId: 460a4c0f-ef48-43c6-8e8d-19e6520b1da8
---

Decided 2026-06-24: when the app needs to scale beyond the current Rackhost **shared** hosting, the target is a **Rackhost VPS managed by Ploi** (ploi.io). User explicitly preferred Rackhost over UpCloud (Hungarian provider, familiar panel, HU billing — outweighs UpCloud's native Ploi auto-provisioning). User is a developer, NOT a sysadmin → Ploi is the chosen "managed server" tool so they don't hand-configure the server. Forge and Laravel Cloud were considered and set aside.

**Why:** User wants to learn/rehearse the VPS setup calmly NOW (low stakes, no traffic) rather than panic later in production. Ploi removes the sysadmin burden. Rackhost chosen for comfort/trust over UpCloud's slightly easier integration.

**How to apply (the agreed plan):**
- **Test phase (now):** order a small Rackhost VPS (smallest ~1 GB/1500 Ft works for ~10 first-round testers, but 1 GB is tight for the full stack — provisioning may need a swap file; 2 GB is more comfortable). Fresh **Ubuntu 24.04, NO control panel** (Ploi needs a clean machine). Get public IP + root SSH.
- **Ploi connection:** Rackhost is NOT a Ploi built-in provider, so use Ploi's **"Custom server"** route — paste ONE SSH key command into the VPS as root, enter IP, set OS=Ubuntu 24.04, Cache=**Redis**, PHP=**8.4** (match the app — NOT 8.5), Webserver=NGINX, DB=MySQL. Start with **Ploi Free** (1 server is enough); move to **Ploi Pro (€13/mo)** later for automatic backups + zero-downtime deploy once real/paying users exist.
- Ploi auto-installs: Nginx, PHP 8.4, MySQL, Redis, Composer, Node/npm, Git, Supervisor (queue workers), SSL (Let's Encrypt), firewall. We only set the app side together: git repo, `.env` (DB pw, APP_KEY, **Gemini key**, **Stripe/Cashier keys**, set QUEUE/CACHE/SESSION→Redis), `migrate`, queue worker + scheduler toggles, `npm run build` on deploy.
- **Migrate the `.env` values from the current Rackhost shared install** when wiring the new server.
- **Current shared hosting + domain stay live** throughout. Only repoint the domain's DNS A-record to the VPS once the app runs there → zero downtime.

**Cost picture (≈410 Ft/€):** test ~1 500 Ft/mo; launch (50-200 users) ~6-20k Ft/mo; growing (500-1000) ~25-55k Ft/mo; large (multi-thousand) ~50-120k+ Ft/mo. Two cost types: **server (VPS+Ploi)** grows slowly in cheap steps; **Gemini AI** is the real variable cost that scales with usage → controlled by the AI cache + the already-built per-user credit limit (`AiUsageService`). See [[project-ai-scaling-plan]] and [[project-ai-scaling-decision]].
