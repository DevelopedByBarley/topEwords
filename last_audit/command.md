
Cél: Futtass le egy részletes, multi-agent workflow auditot a last_audit/PLAN.md-ből KIZÁRÓLAG a Fázis {PHASE_NUM}-re (Auth, session, jogosultság — rendszerszintű). A többi fázisra ne lépj tovább: a Fázis {PHASE_NUM} riport elkészülte után állj meg és várd a jóváhagyásomat.

Kizárások — ezeket az auditból hagyd ki teljesen. Induláskor kivezetett feature-k, a route-jaik kikommentelve, sem támadási felület, sem vizsgálati tárgy:

Kvíz (QuizController, WordController::quiz)
Mondatkiegészítés / cloze (ClozeController)
Rendhagyó igék (IrregularVerbController)
Szabad írás (WordController::practice, TextAnalysisController::practiceCheck)
ReviewController — a PLAN Fázis {PHASE_NUM} utolsó pontja: már korábban kivezetve, a PLAN-bejegyzés elavult, ne keress rá
A hozzájuk tartozó frontend oldalak (pages/words/{quiz,cloze,practice}.tsx, pages/irregular-verbs/) és tesztek szintén kívül vannak. Az is_irregular / igealak adat-mezők NEM tartoznak ide — azok élő szó-felviteli funkciók, normál auditálási körben vannak.

Workflow-szerkezet:

Finderek dimenziónként párhuzamosan, a PLAN Fázis {PHASE_NUM} bontását követve: (A) middleware-láncok minden route-csoporton, (B) middleware-en kívüli kézi auth-ellenőrzések (pricing/success hasValidSignature, sitemap.xml closure, Stripe-webhook aláírás), (C) Fortify auth-flow (2FA + recovery-kódok, reset-token élettartam, password.confirm, REGISTRATION_ENABLED, rate-limiterek), (D) session hardening (AuthenticateSession, same_site, SESSION_SECURE_COOKIE, invalidálás jelszó-/e-mail-váltáskor, token-rotálás), (E) player/extension token életciklus + sanctum.expiration tisztázása, (F) IDOR-sweep minden {id}/{slug}/{token} bindingen + policy-lefedettség.
Verifikáció: minden HIGH/MEDIUM-gyanús leletre 2-3 független, cáfolásra promptolt adverzariális verifikátor (default refuted=true bizonytalanság esetén; többségi szavazat dönt). LOW-ra egykörös verifikáció.
Séma-kényszerített leletformátum: fájl, sor, súlyosság, konkrét támadási forgatókönyv (bemenet/állapot → hatás), verifikációs verdikt + a szavazatok indoklása.
Regresszió-fókusz: a 2026-07-25-i Fázis 1 újra-audit 1 HIGH-ot talált (C-1: POST /user/confirm-password throttle nélkül = néma jelszó-orákulum) és egy MEDIUM-ot (D-3: e-mail-váltás nem von vissza player-tokent). Ellenőrizd ezek jelenlegi állapotát — javítva lettek-e, vagy még nyitottak. Ne fogadd el a korábbi verdikteket készpénznek, de vedd figyelembe őket kiindulásként.

Kimenet: riport a last_audit/-ba (a reaudit-phase1/ mellé, új könyvtárba), dimenziónkénti leletfájlok + összesítő.
