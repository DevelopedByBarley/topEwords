# Induláskor kivezetett oldalak

Ezek a page-komponensek **nem részei az induló feature-körnek** (2026-07-26 döntés).
A kód nem törölt, csak elérhetetlen — sem route, sem sidebar-link nem vezet hozzájuk.

Azért kerültek ki a `resources/js/pages/` alól, mert a Vite **minden** fájlt lefordít
a `pages/` glob alatt, függetlenül attól, hogy vezet-e hozzá route. Miután a
`routes/words.php`-ban kikommentelt route-ok miatt a hozzájuk tartozó Wayfinder-akciók
(`@/routes/words/quiz`, `@/routes/words/cloze`, `@/routes/words/practice`,
`@/routes/irregular-verbs`) már nem generálódnak, a build `UNLOADABLE_DEPENDENCY`
hibával elhasalt. Az áthelyezés ezt oldja meg, a fájlok elvesztése nélkül.

| Fájl | Szerver-oldali render-hely |
|---|---|
| `words/quiz.tsx` | `WordController::quiz` (`Inertia::render('words/quiz')`) |
| `words/cloze.tsx` | `ClozeController::index` (`Inertia::render('words/cloze')`) |
| `words/practice.tsx` | `WordController::practice` (`Inertia::render('words/practice')`) |
| `irregular-verbs/index.tsx` | `IrregularVerbController::index` |

## Visszahozás

1. `git mv resources/js/_pages-disabled/<fájl> resources/js/pages/<eredeti hely>`
2. A `routes/words.php`-ban a megfelelő route-ok visszakommentelése.
3. `npm run build` — a Wayfinder-akciók a route-okból újragenerálódnak.
4. A `resources/js/components/app-sidebar.tsx`-ben a „Gyakorlás" blokk és a hozzá
   tartozó importok élesítése.

## Figyelem — ami NEM ide tartozik

A `POST /words/practice/check` végpont **élő és marad**. Nem csak a
`words/practice.tsx` oldalé volt: a szólista soraiba (`components/words/practice-modal.tsx`,
a `pages/words/index.tsx`-ből) és a flashcard-oldal szabad-írás dobozába
(`pages/flashcards/show.tsx`) is be van építve — mindkettő élő felület.
Ezek hardcode-olt `fetch('/words/practice/check')`-et hívnak, nem Wayfindert,
ezért a route kikommentelése némán 404-et okozott, amit a build nem jelzett.
