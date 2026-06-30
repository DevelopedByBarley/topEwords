---
name: project_security_audit
description: Ongoing step-by-step security audit; findings tracked in SECURITY_AUDIT.md
metadata: 
  node_type: memory
  type: project
  originSessionId: f5ad6665-d9c6-43d5-b0c7-baab73fb06a8
---

Folyamatban lévő, egységenkénti (entity/section-by-section) biztonsági audit a webappon.
A találatok és teendők a repo gyökerében: `SECURITY_AUDIT.md` (checklist + fájl:sor + javítás).

Megközelítés: egységenként egy fókuszált audit-ügynököt küldünk rá (Agent tool, general-purpose),
nem egy nagy workflow-t — mert egy korábbi 6-dimenziós workflow elérte az org havi költségkeretét
("monthly spend limit") és a verify ügynökök elbuktak.

Audit kész (mind az 5 egység). Javítások is megvannak: #A1 (email-verif feature levéve),
#E1 (SSRF redirect/DNS-rebind fix), #B1 (Stripe webhook-secret boot-assert), #A2 (invite atomi),
#E2 (AI-budget atomi reserve/settle/refund a callGemini-ben), #A4 (User fillable szűkítés),
#D1 (Inertia shared user whitelist), #A5 (register/forgot-password throttle), #E3 (geminiListModels
admin-only), #E4 (extension 401), #A6 (dev-login törölve), #D2 (prod APP_DEBUG=false — prodban).

#A3 (trial-abuse) is rendezve, üzleti döntéssel: ÚJ trial-modell — a regisztráció NEM ad trialt,
mindenki free-ről indul; tesztelőknek az admin ad csomagot (plan_override); próbaidő CSAK
előfizetéskor indul (Stripe trial, config registration.subscription_trial_days, default 30 nap,
PricingController::checkout ->trialDays). A régi registration.trial_days config megszűnt.
Stripe-trial manuálisan ellenőrizendő teszt-kártyával (még nincs rá automata teszt).

Az összes audit-találat rendezve. Kapcsolódik: [[project_extension_paywall]].
