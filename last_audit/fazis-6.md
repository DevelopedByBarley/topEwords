# Fázis 6 — Input/output biztonság — audit

> Készült: 2026-07-19 · a go-live előtti utolsó, teljes lefedettségű audit input/output-biztonsági köre.
> Fókusz: mass-assignment (`$fillable`/`$guarded` mind a 18 modellen), minden mutáló route validáció-lefedettsége (csak 8 FormRequest létezik), XSS / render-injection (React `dangerouslySetInnerHTML` + extension DOM-írás), CSV/fájl import-export edge-ek (encoding, méret, sortörés, formula-injection).
> Módszer: **multi-agent workflow** — 4 dimenzió-finder párhuzamosan (cáfolásra promptolva), majd minden HIGH/MEDIUM-gyanús leletre **3 független, cáfolásra promptolt adverzariális verifikátor** külön nézőpontból (reprodukció / korrektség-kontrollfolyam / súlyosság-blast-radius), LOW/INFO-ra egykörös. Séma-kényszerített leletformátum (fájl, sor, súlyosság, forgatókönyv, kód-bizonyíték, verifikációs verdikt). **Csak dokumentálás — kód nem módosult (audit-no-fixes).**
> Futás: 16 agent (4 finder + 11 verifikátor + 1 szintézis), 0 hiba, ~830k token. A kulcs-tények (fillable mind a 18 modellen, nincs `$request->all()` tömeges-assign, bulk-`ids` `max:` nélkül, sanitizer allow-list) fő-agent által **külön grep-pel is verifikálva**.

## Lefedett dimenziók (4)

1. **mass-assignment** — mind a 18 model `$fillable`/`$guarded` állapota, `Model::shouldBeStrict`/`unguard`, és MINDEN `::create()`/`->update()`/`->fill()`/`forceFill()`/`firstOrCreate()`/`updateOrCreate()`/`upsert()` hívóhely: felhasználó-kontrollált tömb megy-e mass-assign metódusba (idegen `user_id`/`deck_id`/`status`/entitlement felülírás).
2. **validáció-lefedettség** — minden mutáló route (POST/PUT/PATCH/DELETE) szerver-oldali validációja; hiányzó vagy túl-tág szabályok (array-méret-sapka, enum-korlát, FK-lefedettség), a mass-assignmenttel közös metszet.
3. **xss-web** — `dangerouslySetInnerHTML` összes előfordulása (`resources/js/`), a `sanitize-html.ts` allow-list megkerülhetősége, AI-generált és user-tartalom render-útjai, `href`/`style` attribútum-injekció.
4. **xss-extension-csv** — a chrome-extension nyers `innerHTML` template-literáljai az `esc()`/`replaceChildren` védelem ellenében (oldal-kontrollált felirat/kijelölés a shadow-DOM-ban); CSV import/export (`FlashcardCsvController`, `FlashcardCardController` import, `TextAnalysisController` feltöltés): MIME/méret/encoding/sortörés + formula-injection (`= + - @`).

---

## Összegzés

| Súlyosság | Db | Valós (CONFIRMED/PARTIAL) leletek |
|---|---|---|
| **HIGH** | **0** | — |
| **MEDIUM** | **0** | — |
| **LOW** | **4** | VAL-1 · VAL-2 · VAL-3 · CSV-1 |
| **INFO / CLEAN** | **2** | MA-INFO-3 (forceFill) · XSS-1 (RichTextContent sanitizer) |
| **REFUTED / premissza-cáfolat** | **5** | MA-INFO-1 · MA-INFO-2 (mass-assignment premissza megdőlt) · XSS-2 (QR SVG) · XSS-3 (color hex) · EXT-1 (extension DOM) |

**Go-live blokkoló: NINCS. Nulla HIGH, nulla MEDIUM.**

A verifikátorok minden HIGH/MEDIUM-gyanút elutasítottak vagy self-only LOW-ra húztak. A négy fennmaradt LOW **kivétel nélkül méret-/darabszám-sapka hiánya** (array-max, mappa-plafon, CSV-karakterhalmaz) — egyik sem típus- vagy FK-lefedettségi rés, ezért **egyik sem lép trust-boundaryt**: a payload FK-t nem tud felülírni (a scoped reláció mindig felülírja), és minden hatás a hívó saját fiókjára korlátozott.

### A három legfontosabb megállapítás

1. **A Fázis 6 központi mass-assignment-premisszája tényszerűen megdőlt.** A tervben (és a finder-promptban) rögzített feltevés — hogy 12 model nem deklarál semmit, így default `$guarded=[]` mellett minden oszlop tömegesen kitölthető — **hamis**. Fő-agent grep-je: mind a 18 model deklarál whitelist-et (13 `#[Fillable(...)]` PHP-attribútum, 5 `protected $fillable`), egyik sem hagyatkozik default `$guarded=[]`-re. Nincs `Model::shouldBeStrict`/`unguard` sem, és **sehol nincs `create($request->all())` / `update($request->input())` típusú nyers tömeges-assign** (grep üres). A mass-assignment felület strukturálisan zárt.

2. **A mass-assignment × validáció metszet — a legveszélyesebb kombináció — tiszta.** A FK-kat (`user_id`, `deck_id`) mindenhol a scoped reláció kényszeríti (`$user->…()->create()`, `$deck->flashcards()->create($request->validated())`), nem a payload; a 8 FormRequest egyike sem enged át `user_id`/`deck_id`/`flashcard_id`/entitlement mezőt, így a `validated()` sosem hordozhat érzékeny FK-t. A `forceFill` hívások mind literál kulcs + szerver-derived érték (a `PlayerPairing::approve` `user_id`-je is a bejelentkezett hívó saját id-je). A User `#[Fillable]` szándékos entitlement-kihagyása (`lifetime_access`, `ai_access`, `plan_override`, `stripe_*`, `ai_credit*`) helytálló, és a `forceFill` sem nyit rést rajta.

3. **Az egyetlen raw-HTML user-sink (RichTextContent → `dangerouslySetInnerHTML`) robusztus allow-list sanitizer mögött van, és a render self-only.** A `sanitize-html.ts`: teljes-részfa-törlés a veszélyes tagekre (`script/style/iframe/object/embed/svg/math/…`), minden `on*`-kezdetű és nem-allowlistelt attribútum törlése, `href` csak `^(https?:|mailto:|tel:|#|/)` (a `javascript:` ÉS `data:` kizárva), `style`-ból `expression()/javascript:/url()` törölve. Nincs megbízható bypass, és nincs public/shared/community-pakli vagy admin cross-user render — a flashcard read/write minden pontja `abort_unless($deck->user_id === $request->user()->id, 403)` mögött, így egy hipotetikus reziduális payload is csak a saját böngészőben sülne el.

---

## Összegző tábla (CONFIRMED / PARTIAL leletek)

| id | súlyosság | cím | fájl:sor | verdikt (szavazat) |
|---|---|---|---|---|
| VAL-1 | **LOW** | 5 bulk-flashcard művelet `ids` tömbjén nincs `max:` sapka; JSON-body megkerüli a `max_input_vars`-t | [FlashcardCardController.php:206](../app/Http/Controllers/FlashcardCardController.php#L206) | CONFIRMED · self-only |
| VAL-2 | **LOW** | Onboarding `known_word_ids`/`shown_word_ids` tömbön nincs `max:`; per-elem `exists:words,id` → N-query | [OnboardingController.php:51](../app/Http/Controllers/OnboardingController.php#L51) | CONFIRMED · self-only (Fázis 5 ONB-2-vel egyező) |
| VAL-3 | **LOW** | `FlashcardFolderController::store` nem korlátozza a per-user mappa-számot (a testvér `FolderController` igen) | [FlashcardFolderController.php:16](../app/Http/Controllers/FlashcardFolderController.php#L16) | CONFIRMED · self-only |
| CSV-1 | **LOW** | CSV formula-injection escape csak az első karaktert nézi (`= + - @`), a vezető tab/CR/LF-et nem | [FlashcardCsvController.php:186](../app/Http/Controllers/FlashcardCsvController.php#L186) | PARTIAL · self-only (a `trim()` semlegesíti a vektort) |

### INFO / CLEAN kategóriák (rögzítés teljesség kedvéért)

| id | kategória | eredmény | fájl:sor |
|---|---|---|---|
| MA-INFO-1 | mass-assignment premissza | **REFUTED** — mind a 18 model deklarál whitelist-et; nincs default `$guarded=[]` rés, nincs `$request->all()` tömeges-assign | [Flashcard.php:11](../app/Models/Flashcard.php#L11) |
| MA-INFO-2 | scoped FK-írás | **REFUTED** — a fillable tartalmaz `user_id`/`deck_id`-t, DE minden hívóhely scoped relációval tölt; a FormRequest whitelist nem enged érzékeny FK-t | [FlashcardCardController.php:51](../app/Http/Controllers/FlashcardCardController.php#L51) |
| MA-INFO-3 | forceFill | **CLEAN** — mind az 5 `forceFill` literál kulcs + szerver-derived érték (nincs user-tömb, nincs entitlement-oszlop) | [PlayerPairingController.php:103](../app/Http/Controllers/PlayerPairingController.php#L103) |
| XSS-1 | raw-HTML user-sink | **CLEAN** — `RichTextContent` sanitizer allow-listje robusztus + a render tulajdonos-scoped (self-only) | [rich-text-editor.tsx:320](../resources/js/components/ui/rich-text-editor.tsx#L320) |
| XSS-2 | QR SVG | **REFUTED** — a `dangerouslySetInnerHTML` szerver-generált Fortify QR-SVG, nincs benne user-input | [two-factor-setup-modal.tsx:82](../resources/js/components/two-factor-setup-modal.tsx#L82) |
| XSS-3 | inline color style | **REFUTED** — `card.color` szigorú `^#[0-9a-fA-F]{6}$` regex-validált; nincs CSS-injektálás | [card-preview-dialog.tsx:87](../resources/js/components/flashcards/card-preview-dialog.tsx#L87) |
| EXT-1 | extension DOM-injection | **REFUTED** — minden oldal-/szerver-eredetű `innerHTML`-interpoláció `esc()`/`replaceChildren` mögött; `esc()` (shared.js:38) mind az 5 karaktert fedi | [shared.js:38](../chrome-extension/src/shared.js#L38) |

---

## Leletenkénti részletezés

### VAL-1 — LOW — Bulk-flashcard `ids` tömbön nincs `max:` sapka (JSON-body megkerüli a `max_input_vars`-t)
**Fájl:** [FlashcardCardController.php:203-314](../app/Http/Controllers/FlashcardCardController.php#L203) · **Verdikt:** CONFIRMED, súly **LOW** (blast-radius: self-only)

**Forgatókönyv:** Bejelentkezett user a **saját** deckjére POST-ol egy hatalmas JSON `ids` tömböt (pl. 500 000 egész) a `bulk-delete` / `bulk-reset` / `bulk-reverse` / `bulk-direction` / `bulk-move` végpontra. A validáció mind az öt helyen csak `['required','array']` + `ids.* => integer`, **méret-sapka nélkül** (grep: 206/220/237/280/305). Az Inertia/Wayfinder JSON-payloadként küldi (`router.post`), ezért a PHP `max_input_vars=1000` form-limit **nem véd** (az csak form-encoded/multipart kulcsokat számol). A nagy tömb egyetlen óriási `whereIn('id', $ids)`-be megy → memória- és query-planner-terhelés.

**Miért csak LOW (a self-only besorolás):**
- Mind az 5 út `abort_unless($deck->user_id === $request->user()->id, 403)` mögött van (203/217/234/277/302), és a `whereIn` a saját deck `flashcards()` relációjára szűkített (a `bulk-move` a cél-deck tulajdonjogát is ellenőrzi, :312) → **kizárólag a hívó saját kártyáit** érinti; idegen adat / pénz / jogosultság nem.
- A hatás session+verified auth mögötti self-only erőforrás-terhelés, reverzibilis, az intended bulk-select UX közeli határeset.
- **Kiegészítés (verifikátor):** a `bulkReverse` a `reserveFlashcardSlots` plan-kereten át csak az INSERT-et plafonozza, de a `$ids->get()` betöltés a rezerválás ELŐTT fut, így a nagy-tömb memória-terhelése ott sincs teljesen elfojtva — a self-only besorolást ez nem módosítja.

**Olcsó megelőzés (nem blokkoló):** egységes `max:` (pl. `max:1000`) az `ids` szabályon mind az 5 metódusban.

---

### VAL-2 — LOW — Onboarding `known_word_ids`/`shown_word_ids` tömbön nincs `max:`, per-elem `exists` → N-query
**Fájl:** [OnboardingController.php:51-56](../app/Http/Controllers/OnboardingController.php#L51) · **Verdikt:** CONFIRMED, súly **LOW** (self-only)

**Forgatókönyv:** A `POST /onboarding` validációja `known_word_ids => ['array']` + `.* => ['integer','exists:words,id']`, méret-sapka nélkül. A per-elem `exists:words,id` szabály elemenként külön `SELECT … LIMIT 1`-et futtat → nagy payloadnál N pont-lekérdezés + payload-terhelés.

**Miért csak LOW:** a végpont session+verified mögötti; az `upsert` (`:101`) fixen `$user->id`-vel ír → cross-user írás kizárt; a self-grant (~10k `known` szó) **nem ad leaderboardot / entitlementet / pénzt**. Ez a lelet a **Fázis 5 ONB-2** ismételt megerősítése egy másik dimenzióból (validáció-lefedettség) — ugyanaz a self-only gyökér. A `max:` sapka + throttle egyszerre zárná ezt és az ONB-2 JSON-body-residualt.

---

### VAL-3 — LOW — `FlashcardFolderController::store` nem korlátozza a per-user mappa-számot
**Fájl:** [FlashcardFolderController.php:12-19](../app/Http/Controllers/FlashcardFolderController.php#L12) · **Verdikt:** CONFIRMED, súly **LOW** (self-only)

**Forgatókönyv:** Bejelentkezett user ismételten POST-ol a `flashcards/folders`-re; minden hívás új flashcard-mappát hoz létre, mert **nincs darabszám-plafon**. A testvér `FolderController::store` ugyanezt a mintát `MAX_FOLDERS_PER_USER = 100` plafonnal + `count()`-guarddal fogja (`FolderController.php:17,32`) — az aszimmetria valós.

**Miért csak LOW:** a `create` a `$request->user()->flashcardFolders()` relációra megy (a `user_id` fixen a hívóé), a `name` `max:50`, a model `#[Fillable(['name'])]` → érzékeny/idegen oszlop nem írható. A hatás pusztán a saját fiók feltöltése sok apró sorral (self-inflicted DB/render-terhelés, session-auth mögött). **Nem hiányzó validáció, hanem hiányzó üzleti plafon** — a `FolderController` mintájára triviálisan egységesíthető.

---

### CSV-1 — LOW — CSV formula-injection escape nem fedi a vezető tab/CR/LF karaktereket
**Fájl:** [FlashcardCsvController.php:186](../app/Http/Controllers/FlashcardCsvController.php#L186) · **Verdikt:** PARTIAL, súly **LOW** (self-only)

**Forgatókönyv:** A `csvRow()` a formula-injection ellen csak a cella **első** karakterét (`$field[0]`) vizsgálja a `= + - @` ellen. Az OWASP-ajánlott bővebb halmaz (vezető tab/CR/LF) hiányzik — elvben egy `\t=HYPERLINK(...)` cella whitespace-prefixe miatt elmaradna az aposztróf-prefix, és egyes táblázatkezelők a whitespace levágása után mégis képletként értékelnék a MÁSIK gépén megnyíló exportált CSV-t.

**Miért PARTIAL/LOW (kihasználhatóság ~nulla):**
- **A javasolt vektor a tényleges kódúton nem realizálható:** minden exportált mező a `stripHtml()`-en megy át, ami `trim()`-el; a PHP `trim()` levágja a vezető `\t \n \r \0 \x0B` és space karaktereket. Így `\t=HYPERLINK` → `=HYPERLINK`, aminek az első karaktere `=` → a `:186` check elkapja és aposztróf-prefixet tesz. Az import-oldal is `trim()`+`htmlspecialchars`, tehát a DB-ben sem áll elő whitespace-vezérelt tárolt képlet.
- **Blast-radius self-only:** az export a saját pakli (`abort_unless` ownership, `:128`), a letöltő a tulajdonos, a fájl a saját gépén nyílik; más user cellája nem juttatható az exportba. CSV-struktúra-törés kizárt (idézőjelezés + `"` duplázás, `:190`).
- A hiányzó karakterhalmaz **igaz megfigyelés** (ezért nem REFUTED), de a `trim()` véletlenül semlegesíti — ez nem szándékos védelem, ezért egy jövőbeli refaktor csendben újranyithatja (lásd latens kockázatok). Ajánlott az OWASP-halmazt explicitté tenni a `csvRow()`-ban.

---

### REFUTED / CLEAN leletek (rögzítés)

- **MA-INFO-1 (REFUTED)** — a Fázis 6 mass-assignment premisszája megdőlt. Mind a 18 model deklarál whitelist-et (13× `#[Fillable]`, 5× `$fillable`), nincs `$request->all()` tömeges-assign, nincs `shouldBeStrict`/`unguard`. Fő-agent grep-pel függetlenül megerősítve.
- **MA-INFO-2 (REFUTED)** — a fillable listák tartalmaznak `user_id`/`deck_id`-t, de minden hívóhely scoped relációval tölt (`$deck->flashcards()->create($request->validated())`), és egyik FormRequest sem enged át érzékeny FK-t → a `validated()` sosem hordoz idegen `user_id`/`deck_id`-t. Az explicit `move`/`bulkMove` a cél-deck tulajdonjogát is ellenőrzi.
- **MA-INFO-3 (CLEAN)** — az 5 `forceFill` (`PlayerPairing::approve` user_id=saját, `SecurityController` password + `Str::random` remember_token, `CreateNewUser` invite_id, `PricingController` terms_accepted_at, Billingo partner_id API-válaszból) mind literál kulcs + szerver-derived érték; egyik sem fogad user-tömböt vagy ír entitlement-oszlopot.
- **XSS-1 (CLEAN)** — `RichTextContent` az egyetlen raw-HTML user-sink (flashcard front/back/notes); a `sanitize-html.ts` allow-listje robusztus (nincs bypass), a render minden pályája tulajdonos-scoped (nincs shared/public/admin cross-user render) → self-only.
- **XSS-2 (REFUTED)** — a 2FA-modal QR-SVG-je szerver-generált Fortify-válasz (a user saját 2FA-titkából), nincs benne felhasználói input.
- **XSS-3 (REFUTED)** — a `card.color` inline style szigorú `^#[0-9a-fA-F]{6}$` regexre validált (`Store/UpdateFlashcardRequest`), CSS-injektálás kizárt.
- **EXT-1 (REFUTED)** — az extension minden `innerHTML`-template `${…}` interpolációja visszakövetve a forrásig `esc()`/`replaceChildren` mögött; a hardkódolt üzenet-sinkek statikus stringek; az oldal-kontrollált felirat/kijelölés `esc()`-elt `data-*` attribútumon át megy, nincs dupla-dekódolásos kitörés; MV3 default `script-src 'self'`, az `innerHTML` nem futtat `<script>`-et. Az `esc()` (shared.js:38) mind az 5 karaktert (`& < > " '`) fedi, attribútum-kontextusban is.

---

## Latens kockázatok (ma LOW/INFO, jövőbeli feature mellett eszkalálódna)

- **XSS-1 (RichTextContent) → HIGH lenne**, ha valaha **megosztott/publikus/community pakli vagy admin cross-user render** kerül be. Ma pontosan az ownership-scoping (`abort_unless` minden read/write ponton) tartja self-only-ban; egy shared-deck feature megszüntetné ezt a védőfalat, és a sanitizer lenne az egyetlen réteg. **Ilyen feature előtt szerver-oldali sanitizálás bevezetése kötelező** (a rich-text ma nyersen tárolódik, csak a kliens tisztít renderkor).
- **VAL-1 / VAL-2 array-max hiánya → eszkalálódna**, ha a bulk/onboarding végpontok valaha **service-account/API-token vagy anonim** hozzáférést kapnak (megszűnik a self-only korlát), vagy ha a szó-adatokra **leaderboard/entitlement/pénz** épül (a self-grant értékessé válna). Olcsó megelőzés: egységes `max:` sapka már most.
- **CSV-1 → eszkalálódna**, ha valaha **más felhasználó cellája is bekerülhet egy exportba** (megosztott/csapat-export), mert akkor a self-only feltevés megdől. A `trim()` ma véletlenül semlegesíti a vektort — ez nem szándékos védelem; érdemes az OWASP karakterhalmazt explicitté tenni.
- **VAL-3 mappa-plafon hiánya** — ma kozmetikai self-only, de ha a mappák valaha megosztás/kvóta/billing dimenzióba kerülnek, plafon nélkül visszaélhetővé válik. A `FolderController` mintájára egységesíteni.

---

## Fázis 6 lezárva

| Terv-pont (PLAN.md) | Eredmény |
|---|---|
| Mass-assignment / `$fillable` sweep mind a 18 modellen (érzékeny `is_admin`/`stripe_id`/`ai_*` átírható-e) | ✅ **Tiszta** — mind a 18 whitelist-elt; nincs `$request->all()` tömeges-assign; User entitlement-kihagyás + `forceFill` mind szerver-derived (MA-INFO-1/2/3) |
| Minden mutáló route-nak van-e validációja (csak 8 FormRequest) | ✅ Auditálva — **3 LOW** (VAL-1/2/3), mind **méret-/darabszám-sapka hiánya**, nem FK-/típus-lefedettségi rés; a validáció×mass-assignment metszet tiszta |
| XSS / render-injection (React `dangerouslySetInnerHTML` + extension DOM) | ✅ Auditálva — **0 valós XSS**; az egyetlen user-sink robusztus sanitizer + self-only (XSS-1), a többi szerver-generált/regex-zárt (XSS-2/3), extension tiszta (EXT-1) |
| CSV / fájl import-export edge-ek (encoding, méret, sortörés) | ✅ Auditálva — **1 LOW** (CSV-1, PARTIAL: `trim()` semlegesíti a vektort, self-only export) |

**Go-live blokkoló: NINCS. Nulla HIGH, nulla MEDIUM.**

**Fázis 7–8 nem indult** — jóváhagyásra vár.
