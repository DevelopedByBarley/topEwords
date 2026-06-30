---
name: project_phrase_highlighting
description: DONE — multi-word phrase highlighting in text analysis (n-gram match)
metadata: 
  node_type: memory
  type: project
  originSessionId: f5ad6665-d9c6-43d5-b0c7-baab73fb06a8
---

KÉSZ (2026-06-19). A többszavas custom kifejezések (pl. "cut through", "take place") egyetlen
kiemelt egységként jelennek meg a szövegelemzésben és a YouTube-feliratban.

Megoldás: a backend (TextAnalysisController::buildAnalysis) ad egy `phraseStatuses` térképet
(normalizált kifejezés → státusz, csak a szövegben ténylegesen szereplő kifejezésekre), az analyze
válaszban. A frontend közös util (resources/js/components/text-analysis/tokenize-render.ts) mohó,
leghosszabb-először (trigram→bigram) n-gram illesztéssel emeli ki őket; csak szóközzel szomszédos
szavak egyesülnek. Komponensek: highlighted-text.tsx, lyrics-view.tsx (mindkettő a utilra épül).

Előzmény: korábbi bug — a kifejezések egyszavas alak-oszlopai (verb_past='cut' a "cut through"-nál)
ráültek a sima szóra; ezt előbb a single-token illesztésből kizártuk (str_contains ' ' skip), majd
ez a feature a rendes megoldás.

Korlátok (v1): csak soron/bekezdésen belül (YouTube felirat-sor határán átnyúló kifejezés nem
egyesül); csak státusszal rendelkező custom kifejezés emelődik ki. Kapcsolódik:
[[project_entity_cleanup]].
