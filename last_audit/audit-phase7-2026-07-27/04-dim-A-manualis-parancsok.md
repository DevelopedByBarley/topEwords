# Fázis 7 — A-dimenzió: a manuális Console-parancsok destruktivitása és guardjai

**Tárgy:** `EndTrialNow`, `FixWordLevels`, `ImportWords`, `ClearAiCache` (+ a PLAN-ban nem
szereplő `ReconcileStripeSubscriptions`) — destruktivitás, guard-lefedettség, véletlen
tömeges mutáció éles környezetben.
**Módszer:** 3 párhuzamos finder (A1 words-mutálók, A2 cache/trial, A3 teljes
parancs-felület), majd adverzariális verifikáció minden MEDIUM-gyanúra 3 független
lencsével (kihasználhatóság / blast-radius / meglévő védelem), `default refuted=true`.
**CSAK DOKUMENTÁLÁS — kód nem módosult.**

## Verdikt

**0 HIGH · 0 MEDIUM · 4 LOW · 4 INFO.** Mindhárom finder-MEDIUM megdőlt a verifikációban
(összesen **11/12 refuted szavazat**). Go-live blokkoló: 0.

| id | finder súly | verifikált súly | szavazat | cím | fájl:sor |
|---|---|---|---|---|---|
| A-1 | MEDIUM | **LOW** | 6/6 refuted | `ClearAiCache`: üres/falsy `--task`/`--word` → szűrő nélküli teljes wipe | [ClearAiCache.php:31](../../app/Console/Commands/ClearAiCache.php#L31) |
| A-2 | MEDIUM | **LOW** | 2/3 refuted | A cache-wipe költsége a **felhasználók** AI-keretére terhelődik | [AiCacheService.php:32](../../app/Services/AiCacheService.php#L32) |
| A-3 | MEDIUM | **LOW** | 3/3 refuted | `DB::prohibitDestructiveCommands` csak 5 parancsot véd: `cache:clear` és `queue:flush` prodban fék nélkül fut | [AppServiceProvider.php:145](../../app/Providers/AppServiceProvider.php#L145) |
| A-4 | MEDIUM | **LOW** | 6/6 refuted | `ImportWords` mutábilis `master` branchből számol rankot → néma átszintezés | [ImportWords.php:64](../../app/Console/Commands/ImportWords.php#L64) |
| A-5 | LOW | LOW | — | `ClearAiCache` confirm-guard csak `APP_ENV==='production'` alatt aktív | [ClearAiCache.php:25](../../app/Console/Commands/ClearAiCache.php#L25) |
| A-6 | LOW | INFO | — | `db:seed` prodban ismert-jelszavú `test@example.com`-ot hozhat létre (nem admin) | [DatabaseSeeder.php:18](../../database/seeders/DatabaseSeeder.php#L18) |
| A-7 | LOW | INFO | — | Nincs `withoutOverlapping`/`onOneServer` egyik ütemezett feladaton (≈P7B-2) | [routes/console.php:47](../../routes/console.php#L47) |
| A-8 | LOW | INFO | — | `EndTrialNow` ma halott kód (`SUBSCRIPTION_TRIAL_DAYS=0`), a kockázat feltételes | [EndTrialNow.php:53](../../app/Console/Commands/EndTrialNow.php#L53) |
| A-9 | INFO | INFO | — | `ai_word_cache`-nek nincs TTL-je; a wipe mérete futtatás előtt ismeretlen | [AiWordCache.php:11](../../app/Models/AiWordCache.php#L11) |
| A-10 | INFO | INFO | — | `ReconcileStripeSubscriptions` a legnagyobb üzleti mutáló felület — kettős védelemmel | [ReconcileStripeSubscriptions.php:37](../../app/Console/Commands/ReconcileStripeSubscriptions.php#L37) |

## A-1 — `ClearAiCache` falsy-opció → teljes wipe (MEDIUM → LOW, 6/6 refuted)

**A mechanizmus IGAZ és mérve van.** A `ClearAiCache.php:31` szó szerint
`if ($task = $this->option('task'))` — truthiness-teszt, nem `!== null`. Mért
opció-truthiness tábla: `NULL` → szűrő nem alkalmazva, `''` → nem, `'0'` → nem,
`'lookup'` → igen, `'%'` → igen. A generált SQL üres `--task` esetén
`select * from ai_word_cache` **where nélkül**, majd a `:39` `$query->delete()` szűrő
nélkül fut.

**Amiért mégis LOW — három hamis premissza:**

1. **„Néma"** — hamis. A `ClearAiCache.php:41` kiírja a törölt sorok számát
   (`"{$deleted} AI cache sor törölve."`), tehát az operátor a művelet helyén, azonnal
   látja, hogy a várt néhány sor helyett a teljes tábla ment el.
2. **„Visszafordíthatatlan"** — félrevezető. Az `AiCacheService.php:32-59` egy
   **read-through cache**: minden miss automatikusan újragenerálja a tartalmat. A jel nem
   vész el, csak újra kell fizetni érte.
3. **A feltételezett automatizált futtatási út nem létezik.** Grep
   `Artisan::call|Artisan::queue|exec(|shell_exec|system(|proc_open|passthru` az egész
   `app/` + `routes/` fán → **nulla találat**. Nincs olyan script, ahol egy beállítatlan
   shell-változó `--force`-szal találkozhatna; a vektor kizárólag kézi shell olyan
   szereplőtől, akinek **már SSH-ja van** a prod VPS-en.

**TISZTA melléklelet:** SQL-injekció **nincs**. 6 hosztil opció-értékre mérve a generált
SQL mindig paraméterezett (`where \`task\` = ?`); a `lookup' OR 1=1 --` bindingként megy át.
Wildcard-értelmezés nincs (egyenlőség, nem LIKE) — a `%` literálisan keres, 0 sort érint.
**Az elgépelt `--task` tehát teljesen ártalmatlan (0 sor); a veszélyes eset az ÜRES érték —
a feltételezett hibamód pontosan fordítva igaz.**

## A-2 — a wipe költsége a userek keretére terhelődik (MEDIUM → LOW, 2/3 refuted)

**Az irány IGAZ:** cache-hit esetén az `AiCacheService.php:32-34` korán visszatér, a
generátor le sem fut → **0 kvóta-terhelés**. Cache-miss esetén a `:36` `$generator()`
lefut, ami mindhárom hívási helyen `callGemini()` closure, és a `reserve()` a callGemini
**törzsében** van (`TextAnalysisController.php:2298`) → a hívó **user** havi keretéből von.
Az admin, aki a wipe-ot indítja, korlátlan kerettel rendelkezik, tehát épp ő nem érzékeli
a következményt.

**Amiért LOW:** a finder a **felső-korlát becslést** vette tényleges kárnak. A
`TextAnalysisController.php:2466-2474` `settle()`-je a **valós** token-fogyásra korrigál
(`usageMetadata.promptTokenCount`), tehát a „~22 lookup / havi Free keret" szám a
`maxTokens`-alapú foglalásból jön, nem a ténylegesen levont összegből — mérve 8000 micros
≈ 37-50 valós lookup. Emellett a `ClearAiCache` doc-commentje (`:13-15`) **expliciten
figyelmeztet** a költségre.

**Megdőlt:** *„a cache-wipe a RENDSZER Gemini-költségét okozza"* — ezt maga a parancs
doc-commentje állítja, és **ténybelileg félrevezető**: a költség a user keretére megy.
A kód saját dokumentációja ebben a pontban pontatlan.

## A-3 — a prohibit-guard szűk hatóköre (MEDIUM → LOW, 3/3 refuted)

**A legérdekesebb mérés a körben, és a mechanizmus teljesen igaz.** Mért
prohibition-mátrix `APP_ENV=production APP_DEBUG=false` alatt:

| parancs | eredmény |
|---|---|
| `migrate:rollback`, `db:wipe`, `migrate:fresh` | „WARN prohibited" ✅ |
| `db:seed`, `queue:clear` | „APPLICATION IN PRODUCTION" megerősítés ✅ |
| **`queue:flush`** | **nincs fék** → `delete from failed_jobs` ❌ |
| **`cache:clear`** | **nincs fék** → `delete from cache` ❌ |

A `vendor/.../Facades/DB.php:132-139` pontosan **5** `::prohibit()` hívást tesz, miközben a
Laravel **13 fájlba** építette be a `Prohibitable` traitet — 7 parancs traitelt, de
**semmi nem kapcsolja be**. A trait puszta jelenléte nulla védelmet jelent.

**Amiért mégis LOW — a súlyt adó blast-radius premissza hamis:** *„a `failed_jobs` a
Billingo/NAV elbukott jobok EGYETLEN nyoma, a törlés véglegesen elveszíti a kimaradt
számlák listáját"*. Ez **nem áll**: a `GenerateBillingoInvoice::failed()`
(`app/Jobs/GenerateBillingoInvoice.php:78-85`) a bukás pillanatában `report()`-tal
ERROR-szinten naplóz, ami az `AlertAdminOfLoggedError`-on keresztül **azonnal admin-e-mailt**
küld — a `failed_jobs` sor csak másodlagos nyom. A `cache:clear` sem léptet ki senkit:
`session.driver=database` **külön** `sessions` táblát használ, a mért SQL `delete from cache`.

**A rés valós marad, csak kisebb:** a védelem neve félrevezető — nem „destruktív parancsok
tiltása", hanem „migrate/db-wipe tiltása". Aki prodban `cache:clear`-t futtat, throttle-t
nulláz és AI-cache-t éget (→ A-2), fék és kérdés nélkül.

## A-4 — `ImportWords` mutábilis upstream (MEDIUM → LOW, 6/6 refuted)

**A kód-premisszák IGAZAK:** a rank **pozícióból** származtatott
(`ImportWords.php:53 $rank = $offset + $i + 1`), a `:64`
`Word::upsert($data, ['word'], ['rank','level','updated_at'])` a meglévő sorok rank/level
oszlopát **felülírja**, és a `:31` URL egy `master` branchre mutat, nem pinned commitra.

**Amiért LOW — a trigger-premissza méréssel hamis.** A lelet egésze arra épült, hogy „a
lista demonstrálhatóan mozog". GitHub API-val mérve: a
`google-10000-english-no-swears.txt`-t érintő **utolsó commit 2019-07-19** — a fájl
**7 éve változatlan**. A finder saját „bizonyítéka" (a lista ma 9894 tokent ad, nem
10 000-et) nem mozgást bizonyít, hanem azt, hogy a fájl **mindig is** ennyi volt.

**További megdőlt feltevések (mind mérve):**

- *„HTML hibaoldal beimportálódik"* → **fail-closed**. Élő mérés 404-es útvonalon:
  `@file_get_contents(...)` → `bool(false)` (az `ignore_errors` default 0), a `:37-41`
  guard FAILURE-rel kilép, mutáció nélkül.
- *„óriási / részlegesen letöltött payload"* → a valós payload **75 KB**, leghosszabb
  token 18 karakter. Nem memória-kockázat.
- *„az `upsert` törölhet sorokat"* → **nem töröl**: `INSERT ... ON DUPLICATE KEY UPDATE`
  szemantika; a listáról lekerült szavak sorai maradnak, a pivotok sértetlenek.
- *„felülírhat user- vagy AI-generált tartalmat"* → **nem**: az update-oszlop-lista
  taxatív (`rank`, `level`, `updated_at`).

**TISZTA melléklelet — a feladat 1. kérdésének premisszája megdőlt:** a `FixWordLevels`
raw-SQL küszöbei és a `Word::levelForRank()` között **nincs drift**. Byte-szinten azonos
sávok (`<=1000→1 … <=8000→5 else 6`), és a további két fogyasztó
(`DashboardController::LEVELS`, `AchievementService::ACHIEVEMENTS`) is ugyanezt kódolja.
Mind a 4 hely egyezik. A duplikáció kód-higiéniai szag, **de működési drift nem áll fenn**;
a hibás szintet kapó szavak száma **nulla**.

## A-5 — a confirm-guard szigorú `=== 'production'` egyenlősége (LOW)

A `ConfirmableTrait::getDefaultConfirmCallback()` szigorú egyenlőséget vizsgál, így
`APP_ENV=staging` vagy `APP_ENV=prod` esetén a `confirmToProceed()` azonnal `true`-t ad, és
a törlés megerősítés **nélkül** fut.

**Élesben a kockázat mérten nem áll fenn**, és nem is állhat: az
`assertKnownEnvironment` boot-guard **fail-closed** — minden nem-whitelistelt `APP_ENV`
megállítja a bootot. Mérve: `APP_ENV=prod php artisan migrate:status` → RuntimeException az
`AppServiceProvider.php:59`-nél, a parancs kimenete **soha nem jelent meg**. Ez egyben az
A-3 hatókör-szűkítője is: **nincs olyan állapot, ahol a prohibit-guard csendben lekapcsol
ÉS a destruktív parancs mégis lefut** — a rés nem env-drift, hanem a facade szűk listája.

## TISZTA (mérve, nem következtetve)

- **HTTP-ból indítható Artisan-parancs: NINCS** — ez volt a legsúlyosabb keresett
  lelet-típus. Grep `Artisan::call|Artisan::queue|\Artisan` az `app/`, `routes/`,
  `resources/`, `config/`, `database/` fákon → **egyetlen** találat: `routes/console.php:4`
  egy `use` import. Nulla controller, nulla route hívja.
- **Shell-kiszökés a kódból: NINCS** — `exec|shell_exec|system|passthru|proc_open|popen`
  → 0 találat az `app/` és `routes/` fákon; `eval(` → 0.
- **Történetileg sem volt HTTP-artisan út** — `git log --all -S "Artisan::call" -- app/ routes/`
  → **0 commit**. Nem kivezetett felület: soha nem létezett.
- **`model:prune` / Prunable: nulla kitettség** — `php artisan model:prune --pretend` →
  „No prunable models found." Az egyetlen `Prunable` említés egy komment
  (`AiWordCache.php:15`), ami dokumentálja, hogy az alternatívát tudatosan elvetették.
- **A boot-guardok console-futtatásnál is lefutnak, a `handle()` ELŐTT dobnak** (mérve,
  két külön parancson) — a védelem nem HTTP-specifikus.
- **`EndTrialNow` rossz-user-találat: KIZÁRVA** — a `users.email` `unique()` indexelt, a
  keresés exact egyenlőség (nincs LIKE, nincs wildcard), így a `first()` nem választhat
  több találat közül. Négy egymásra épülő guard előzi meg a mutációt.
- **Ütemezett felület teljes leltára = 4 bejegyzés**, egyik sem destruktív adatra:
  `queue:alert-failed` (olvas+mailt küld), `queue:monitor` (olvas), `sanctum:prune-expired`,
  `cashier:reconcile-subscriptions` (kör-fékkel). Sem a `words:import`, sem a
  `words:fix-levels` **nincs ütemezve**.
- **`FixWordLevels` idempotens és adat-vesztés-mentes** — a `level` teljes egészében a
  `rank`-ból származtatott, és a parancs a `rank`-hoz **nem nyúl**; újrafuttatás
  helyreállítja, amit egy hibás futás elrontott.
