# Verifikációs napló — Fázis 8, 2026-07-28

A workflow szabálya: minden **HIGH/MEDIUM-gyanús** leletre 2-3 független verifikátor,
**kifejezetten cáfolásra promptolva**, eltérő lencsével. Bizonytalanság esetén a default
`refuted=true`. **Többségi szavazat dönt.**

Ebben a körben **2 MEDIUM-gyanú** keletkezett. Mindkettő **2/2 arányban REFUTED** lett.
LOW-leletekre egykörös verifikáció futott, súlyosság-vita nélkül.

---

## Vita 1 — D5-1: `queue:monitor` queue-név drift

**Finder-súlyosság: MEDIUM.** Indoklás: „pénz-kritikus korai figyelmeztetés elvesztése, mért
reprodukcióval; a mai egyezés véletlen — két független forrás (egy env-default és egy kód-literál)
ugyanarra a stringre esik, közös igazságforrás, boot-guard és teszt nélkül."

| Verifikátor | Lencse | Verdikt | Döntő érv |
|---|---|---|---|
| **V1** | Triggerelhetőség / a premissza realitása | **REFUTED → LOW** | A `WorkCommand::getQueue()` ugyanazt a config-kulcsot olvassa, mint a dispatch → `DB_QUEUE` állítása a workert és a dispatchert **együtt** mozgatja, tehát torlódás nem keletkezik. A `DB_QUEUE` a repóban sehol nem dokumentált; nincs `--queue=` sehol. |
| **V2** | Valós blast-radius / defense-in-depth | **REFUTED → LOW** | Ugyanaz a vendor-tény, függetlenül megtalálva. Plusz: a veszélyes világhoz **két** koordinált hibás beállítás kell; a tényleges veszteséget detektáló csatornák queue-név-agnosztikusak; a kár `queue:retry`-jal teljesen helyreállítható; és a 2026-07-22-i egyetlen valós eset épp **ezen a csatornán** derült ki ~10 perc alatt. |

**Szavazat: 2 REFUTED / 0 CONFIRMED → végleges súlyosság: LOW.**

**A súlyosság-változás indoklása:** a finder impakt-állítása („dead worker + growing backlog +
no alert") **a saját premisszájából nem következik**. A premissza (`DB_QUEUE` beállítása) önmagában
egy *önkonzisztens* állapotot hoz létre, amelyben nincs torlódás. A finder implicit módon feltette,
hogy a worker egy *harmadik*, független forrásból veszi a queue-nevet — ezt egyik korábbi kör
(BILL-3 / P7B-1) sem ellenőrizte. A `WorkCommand.php:355-360` visszaellenőrzésével ez a feltevés
megdőlt.

**Amit a vita hozzáadott a korábbi körökhöz:** a BILL-3 és P7B-1 is LOW-ra jutott, de a
2026-07-22-i driftet a connection/worker rétegnek tulajdonították anélkül, hogy megállapították
volna: a `WorkCommand::getQueue()` osztozik a dispatch config-kulcsán. **Ez a vendor-sor az, ami
a `DB_QUEUE`-only forgatókönyvet bizonyíthatóan ártalmatlanná teszi**, és a leletet a korábban
dokumentáltnál szűkebbre húzza.

---

## Vita 2 — D4 MEDIUM-1: üres `ADMIN_EMAIL` → néma riasztás-elmaradás

**Finder-súlyosság: MEDIUM.** Indoklás: „a bad state a szállított default (`.env.example:78`),
nem elgépelés; totális observability-blackout a pénz-úton, nulla jelzéssel."

| Verifikátor | Lencse | Verdikt | Döntő érv |
|---|---|---|---|
| **V3** | A bad state jelenléte / a „néma" állítás igazsága | **REFUTED → LOW** | (1) Az éles `.env:67` **ki van töltve**. (2) A `.env.example:76-77` nagybetűs figyelmeztetést tartalmaz a kulcs **felett** — a finder a 78. sort idézte, a fölötte lévő kettőt kihagyva. (3) A `MonitorFailedJobs` 10 percenként `FAILURE`-t ad, amit a `ScheduleRunCommand` `error`-szinten logol → **10 percenként önjelentő** a hiba. (4) **Duplikátum**: P7D-3-ként LOW-ként már iktatva a tegnapi körben. |
| **V4** | Defense-in-depth / reziduális detekció | **REFUTED → LOW** | A `Logger::writeLog` (vendor, 181-193.) **előbb ír lemezre**, és csak utána dobja a `MessageLogged`-et → a listener szigorúan a perzisztálás után fut, tehát **nulla adatvesztés**; a push-értesítés degradál, nem a rögzítés. Plusz 5 túlélő csatorna: `laravel.log`, `failed_jobs` (határozatlan ideig), Stripe dashboard, Billingo dashboard, az ügyfél saját számlaoldala. |

**Szavazat: 2 REFUTED / 0 CONFIRMED → végleges súlyosság: LOW.**

**A súlyosság-változás indoklása:** a finder három teherhordó állítása bizonyult hamisnak:
„nincs jelzés" (van, 10 percenként, és a `.env.example`-ban írásban), „adatvesztés" (nincs,
a log-írás megelőzi az eseményt), és „totális blackout" (5 csatorna túléli). Emellett a lelet
séma-szempontból sem MEDIUM: **nincs benne támadó** — nincs támadó-vezérelt bemenet, nincs
jogosultság-nyereség, nincs adat-expozíció. Ops/megbízhatósági előfeltétel, amely az operátor
saját, írásban dokumentált utasítás elleni félrekonfigurálását igényli.

**Ami a leletből áll:** az `AppServiceProvider` négy env-kulcsra ad fail-closed guardot,
`ADMIN_EMAIL`-re nem. Ez valós minta-aszimmetria és olcsó go-live keményítés — de LOW.

---

## Saját visszaellenőrzések (a verifikátoroktól függetlenül)

A két vitában szereplő teherhordó tényeket a fő auditor is közvetlenül ellenőrizte, nem a
subagent-jelentésekre hagyatkozva:

| Állítás | Ellenőrzés | Eredmény |
|---|---|---|
| `WorkCommand::getQueue()` a dispatch config-kulcsát olvassa | `vendor/.../WorkCommand.php:355-360` beolvasva | **Igazolt** |
| A log-írás megelőzi az esemény-dobást | `vendor/.../Log/Logger.php:181-193` beolvasva | **Igazolt** |
| `.env.example` figyelmeztet az `ADMIN_EMAIL`-re | `.env.example:74-79` beolvasva | **Igazolt** (76-77. sor) |
| Az éles `.env`-ben van `ADMIN_EMAIL` | grep a `.env`-en | **Igazolt** (67. sor) |
| A `SANCTUM_TOKEN_PREFIX` hiányzik az éles `.env`-ből | ugyanaz a grep | **Igazolt** (nincs találat) |
| A `backup/` git-trackelt | `git ls-files backup \| wc -l` | **4629 fájl** |
| A trackelt backup titkot tartalmaz-e | `git ls-files backup -z \| xargs -0 grep -lE "sk_live\|sk_test_…"` | **0 találat** |
| A trackelt backup mérete | `git ls-files backup -z \| xargs -0 du -ch` | **147 MB** |
| Az extension route-ok a `web` csoportban vannak | `grep -n "extension" routes/web.php` | **Igazolt** (90. sor) |
| A `GenerateBillingoInvoice` nem deklarál queue-t | a fájl 16-36. sora beolvasva | **Igazolt** |
| A flashcard-mezők validációja sanitizálatlan | `ExtensionController.php:254-265` beolvasva | **Igazolt** |
| P7D-3 duplikátum-állítás | `grep "ALERT-1\|P7D-3" audit-phase7-…/00-OSSZESITO.md` | **Igazolt** (46. sor, LOW) |

---

## Módszertani tanulság a következő körre

A D1 finder első nekifutásra **téves negatívra** jutott: `php artisan route:list --json`-ból azt
állapította meg, hogy minden route megkapja a `SecurityHeaders`-t. A `route:list` a csoport *nevét*
(`web`/`api`) írja ki, nem a kibontott middleware-osztályokat, így a `SecurityHeaders` string soha
nem jelenik meg, és a szűrő némán 0 találatot ad — ami „minden rendben"-nek olvasható.
**A middleware-lefedettséget a futásidejű kernelből (`middlewareGroups`) kell ellenőrizni,
nem a `route:list`-ből.** A finder ezt maga vette észre és korrigálta.
