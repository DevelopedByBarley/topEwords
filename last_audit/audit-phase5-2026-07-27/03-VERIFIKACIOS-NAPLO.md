# Verifikációs napló — ONB-1 súly-vita

> Fázis 5 · 2026-07-27 · az egyetlen érdemi súlyosság-vita ebben a körben

A finder-körből **egyetlen** HIGH/MEDIUM-gyanús lelet jött ki (ONB-1), ezért a
parancs előírása szerint **3 független, cáfolásra promptolt verifikátort** kapott,
egyenként **eltérő lencsével**. A többi lelet LOW/INFO volt → egykörös verifikáció.

## A vitatott lelet

**ONB-1 (finder-súly: MEDIUM)** — `POST /onboarding` throttle nélkül, `max:` korlát nélküli
tömbökkel, korlátlanul ismételhetően → erőforrás-kimerítés / DoS.

## A verifikációs út

| Lépés | Verdikt | Súly |
|---|---|---|
| Finder B (Dim. B) | CONFIRMED | **MEDIUM** |
| V1 — kihasználhatóság | PLAUSIBLE (részlegesen megdöntve) | **LOW** |
| V2 — valós blast radius | REFUTED (a MEDIUM ellen) | **LOW** |
| V3 — meglévő védelmek a láncban | CONFIRMED | **MEDIUM** |
| **Döntőbíró (saját mérés)** | **PLAUSIBLE** | **→ LOW (végleges)** |

**Szavazat: 2 LOW vs 1 MEDIUM.** A többségi szavazat LOW, és — ami fontosabb — a MEDIUM-ot
tartó V3 **egyetlen indoklása egy tényszerűen hamis premisszán állt** (lásd lent).

---

## A döntő ténykérdés: „az app egyetlen throttle-mentes írási végpontja"?

Ez volt a MEDIUM **kizárólagos** indoklása mind a finderben, mind V3-nál — a súlyt nem a kár
nagysága hordozta, hanem az, hogy a végpont *kirívóan* kilóg a projekt saját normájából.
V1 ezt vitatta. **Saját méréssel döntöttem el, forráskódból:**

```
routes/flashcards.php:  26 mutáló route,  ebből throttle-lal:  0
routes/words.php:       13 mutáló route,  ebből throttle-lal:  1
```

A `php artisan route:list` teljes elemzése ~50 throttle-mentes mutáló route-ot mutat, köztük
az egész `flashcards/*` fát (7 db `bulk-*` művelettel), a `folders/*`, `custom-words/*`,
`api/player/*` és `admin/*` köröket.

**A premissza HAMIS.** A `POST /onboarding` nem kivétel, hanem **a projekt többségi mintája**.
Throttle-t épp a drága vagy érzékeny utak kaptak célzottan (AI-elemzés, extension-írás,
checkout, player-párosítás, letöltés, profil-módosítás) — ez tudatos, szelektív tervezés,
nem véletlen kihagyás. Ezzel a MEDIUM indoklása összeomlik.

## Amit a verifikáció NEM tudott megdönteni (a lelet valós magja)

Három állítás minden lencse alatt kitartott, és **saját méréssel is megerősítettem**:

**1. Az `exists` szabály tényleg elemenkénti query, és nem bail-el.** Élő mérés:
```
200 elem validálása:  72.7 ms,  query-k: 201
2000 elem validálása: 524 ms   → 10 000 elem ≈ 2,6 s tiszta DB-idő
```
A wildcard (`known_word_ids.*`) ág elemenként hívja a `DatabasePresenceVerifier`-t.
V1 mérése szerint 500 érvénytelen ID is 500 queryt fut, mielőtt 422-t adna — **a validációs
hiba tehát nem védelem**, a költség előtte keletkezik. A drágaság súlypontja itt van,
nem az upsertben.

**2. A `max_input_vars` nem véd.** A kliens (`onboarding/index.tsx:505-509`) Inertia
`router.visit`-tel JSON-t küld; a `max_input_vars` csak form-encoded/multipart bemenetre
vonatkozik. `post_max_size=120M` mellett a 10 000 elem elfér.

**3. Nincs globális throttle és nincs session-sorosítás.** A session-driver `database`
(saját ellenőrzés: `SESSION_DRIVER=database`), ami — a fájl-driverrel ellentétben — nem tart
írás-zárat a kérés életciklusára, és a route-on nincs `->block()`. Egy sessionből tehát
párhuzamosan is lőhető. Ez V3 érdemi hozzájárulása.

## Amit a döntőbírói mérés a lelet ELLEN talált

**A `max_allowed_packet` mint fék: nem lép be, de közel van.** Saját mérés:
```
SQL bytes/sor:        84
10 000 sor:           ~0,8 MB
max_allowed_packet:   1 048 576 byte (1,00 MB)
```
A támadás **nem hal el magától** (a lelet javára), de a mozgástér szűk.

**A kár plafonos, és nincs tárhely-növekedés — ez a legerősebb ellenérv.**
A `user_word` tábla elsődleges kulcsa `primary(['user_id','word_id'])`
(`2026_03_25_185414_create_user_word_table.php:17`), és az upsert **pontosan erre a kulcsra**
megy. Az ismétlés tehát `UPDATE`-re konvertálódik, nem `INSERT`-re:
**max. 10 000 sor/user, örökre, akárhányszor is fut le.** Korlátlan ismétlés = nulla
tárhely-növekedés. Ez a „korlátlanul generál" megfogalmazás magját semmisíti meg.

**Az adat kicsi és indexelt.** Élő mérés: `words` = **pontosan 10 000 sor**
(1000/1000/2000/1999/2006/1995 szintenként), és `SHOW INDEX FROM words` szerint a
`rank` és a `level` is indexelt → a `where('level')->orderBy('rank')->take()` indexelt
range-scan (mérve: 2000 sor = 61,9 ms).

**Van olcsóbb vektor ugyanazon a fiókon.** A `GET /onboarding` szintén throttle-mentes, és
szintenként `inRandomOrder()`-t (`ORDER BY RAND()` + filesort) futtat — MySQL-en ez
drágább, mint az indexelt PK-lookupok, miközben a támadónak **nulla payloadba kerül**
(üres GET vs. több MB-os JSON feltöltése). ONB-1 tehát nem ad új képességet a támadónak.

**Relatív súly.** A `text-analysis/analyze` `throttle:30,1`-gyel **valódi pénzbe kerülő**
AI-hívást indít. Ehhez képest az onboarding pár másodperces, nulla marginális költségű,
plafonos DB-munkája jelentéktelen.

## Végső indoklás — miért LOW, és miért nem INFO vagy MEDIUM

**Nem MEDIUM**, mert a súlyt hordozó „egyetlen kilógó végpont" premissza tényszerűen hamis
(~50 társa van), a kár plafonos, tárhely-növekedés nincs, cross-user hatás nincs,
privilégium-emelés nincs, és létezik olcsóbb vektor ugyanott.

**Nem INFO**, mert a mechanizmus valós és mért: a throttle-hiány + korlátlan ismételhetőség +
a `max:` hiánya + az elemenkénti `exists` N+1 együtt egy hitelesített usernek ~2,6 s DB-időt
enged kérésenként kiváltani ~1 KB JSON-nal. Ez valós, kedvezőtlen csereárfolyam.

**A lelet redukált, pontos magja:** ez az **egyetlen hely a kódbázisban, ahol wildcard
`exists:` szabály szerepel** — vagyis N+1 validációs query ott, ahol egyetlen `whereIn` elég
lenne. Ráadásul a validációs `exists` funkcionálisan **redundáns**: a controller a `:65` sorban
`Word::whereIn(...)`-nel amúgy is újra lekérdezi, és a nem létező ID-k onnan egyszerűen kiesnek.
Ez tehát **kód-minőségi hiba mérhető teljesítmény-következménnyel**, nem biztonsági rés.

> Fix nem készült — audit-no-fixes szabály. A javítás iránya dokumentálva a 02-es leletfájlban.
