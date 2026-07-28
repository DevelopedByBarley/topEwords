# D3 — `public/` debug/dev-fájlok és `.env`/kulcs-szivárgás

**PLAN-pont:** „`public/`-ban maradt debug/dev-fájlok (`oc.php`, `.DS_Store` a `downloads/`-ban), `.env`/kulcs-szivárgás."

**Verdikt: 0 HIGH · 0 MEDIUM · 3 LOW · 1 INFO.**

---

## Deploy-feltevés (minden alábbi súlyosság teherhordó premisszája)

A deploy **`git pull`** a `/home/ploi/topwords.eu`-ba (Ploi → GitHub `main`), a
`project_vps_deployment` memória szerint. Tehát: **git-trackelt = jelen van a prod fájlrendszeren**;
untracked/gitignore-olt = soha nem kerül ki. Az nginx docroot a `<site>/public`, így a `public/`
fölötti fájlok docroot-elrontás nélkül nem web-elérhetők.

---

## A PLAN két konkrét állítása — MINDKETTŐ MEGDŐLT

| PLAN-állítás (2026-07-17) | Valóság 2026-07-28 | Verdikt |
|---|---|---|
| `public/oc.php` létezik | `ls: public/oc.php: No such file or directory` | **PLAN-FELTEVÉS MEGDŐLT** |
| `public/downloads/` `.DS_Store` + kicsomagolt extension-forrás | `ls: public/downloads: No such file or directory` | **PLAN-FELTEVÉS MEGDŐLT** |

Az `oc.php` **soha nem volt git-trackelve** (`git ls-files public/` = 13 fájl, nincs köztük).
A memóriában szereplő „⚠️ deploykor `rm public/oc.php`" teendő ezzel **elavult**.
A letöltések auth-gate-elt route-ra kerültek, a docroot-on kívüli `storage/app/private/downloads`-ból
olvasva ([DownloadController.php:28-30](../../app/Http/Controllers/DownloadController.php#L28-L30)).

---

## Leletek

### D3-1 · `backup/` — 4629 git-trackelt fájl (147 MB) megy ki minden deployjal · LOW

- **fájl:** [.gitignore:40](../../.gitignore#L40) (a `backup` bejegyzés) · a tartalom: `backup/before billing/**`
- **súlyosság:** LOW
- **forgatókönyv:** A `backup/` szerepel a `.gitignore`-ban, **de** a `9065088 "first test billing"`
  commitban már be volt commitolva — a gitignore nem untrackel. Mérve:
  `git ls-files backup | wc -l` = **4629**, `du -ch` = **147 MB**, ebből 207 db `.php`,
  köztük egy teljes `backup/before billing/public/index.php` és `backup/before billing/config/*.php`.
  Minden `git pull` deploy kiviszi a prod szerverre az alkalmazás teljes, billing előtti pillanatképét.
  **Támadási forgatókönyv:** aki *bármilyen* fájlolvasási primitívhez jut (LFI, elrontott alias,
  egy jövőbeli `Options +Indexes`), egy második, **javítatlan** másolatot olvashat az app forrásából —
  benne a billing előtti kontroller-logikával, amelynek sebezhetőségeit az `app/`-ban azóta javították.
  Ez ingyenes forráskód-feltárás és patch-diff orákulum. Ha a docroot valaha a projekt gyökerére
  kerülne a `public/` helyett, a `GET /backup/before%20billing/public/index.php` egy **második
  Laravel front controllert** bootolna az élő `.env`-vel.
  **Miért LOW és nem több:** **nincs benne titok** — a teljes trackelt backup-fán a
  `sk_live`/`sk_test_*`/`whsec_*`/`APP_KEY=base64` grep **0 találatot** ad (magam is
  visszaellenőriztem); a backup configok csak `env()` hívásokat tartalmaznak. Helyes docroot mellett
  nem elérhető. A hatás forrás-feltárás + 147 MB deploy/repo-püffedés, nem hitelesítőadat-vesztés.
  A `backup/before-jobs` (73 MB) untracked, **nem** deployolódik.
- **verdikt:** CONFIRMED (a trackelés és a méret mérve), a hatás LOW.

### D3-2 · `public/hot` · LOW

- **fájl:** [public/hot](../../public/hot) (tartalom: `http://[::1]:5173`)
- **súlyosság:** LOW
- **forgatókönyv:** Helyesen gitignore-olt ([.gitignore:5](../../.gitignore#L5)) és untracked,
  tehát `git pull` deploynál **nem** jut ki. Lokálisan csak azért létezik, mert egy `npm run dev`
  session nem állt le tisztán. A támadási út deploy-módszer-váltást igényel (a working tree
  rsync/SFTP másolása): a fájl jelenlétében a Laravel `@vite` direktívája minden prod oldalra
  `<script src="http://[::1]:5173/…">`-t ír ki, ami az összes JS-t eltöri, és fejlesztői gépen,
  közös hálózaton támadó-vezérelhető dev-portra irányítja az asset-betöltést.
  A jelenlegi git-pull deploy mellett INFO; azért LOW, mert a memória szerint az SFTP/Cyberduck
  hozzáférés a `/home/ploi/topwords.eu`-hoz bevett munkafolyamat, tehát a soron kívüli fájlmásolás
  reális út.
- **verdikt:** CONFIRMED (a fájl létezik), a deploy-úton nem materializálódik.

### D3-3 · `public/.DS_Store` (6148 bájt) · LOW

- **fájl:** `public/.DS_Store` (untracked)
- **súlyosság:** LOW
- **forgatókönyv:** Untracked és gitignore-olt ([.gitignore:22](../../.gitignore#L22)), tehát nem
  deployolódik. Ha valaha kikerülne, a `GET /.DS_Store` **autentikálatlanul** visszaadná a `public/`
  teljes könyvtárbejegyzés-listáját, benne bármely jövőbeli staging/backup fájlnévvel — a `.htaccess`
  `Options -Indexes`-t állít, de dotfile-deny szabályt **nem** tartalmaz, az nginx (a prod szerver)
  pedig ekvivalens szabályt egyáltalán nem. Ugyanaz a LOW-indoklás, mint a D3-2-nél: csak nem-git
  fájlmásolással érhető el.
- **verdikt:** CONFIRMED (a fájl létezik), a deploy-úton nem materializálódik.

### D3-4 · Gyökérszintű trackelt audit-dokumentumok · INFO

- **fájl:** `PAYMENT_AUDIT.md`, `PAY_WEBHOOK_PLAYER_AUDIT_2026-07-16.md`,
  `FIZETES_PRODUCTION_TEENDOK.md`, `last_audit/**`, `claude-memory/**` (11 fájl)
- **forgatókönyv:** Git-trackeltek, tehát kimennek a VPS-re. A docroot **fölött** vannak, nem
  web-elérhetők. Csak azért jelölve, mert részletes leltárt adnak a múltbeli sebezhetőségekről,
  a VPS IP-jéről, a site-útvonalról és az SSH-userről — értékes térkép annak, aki fájlolvasáshoz jut.
  A `SEC_AUDIT.md` (69 KB) helyesen gitignore-olt és untracked.

---

## Tiszta eredmények (nem lelet)

- **Nincs kósza PHP a `public/`-ban** — `find public/ -name "*.php"` pontosan `public/index.php`-t ad.
- **Nincs source map, backup vagy archívum** — `*.map`/`*.bak`/`*~`/`*.orig`/`*.zip`/`*.tar*`/`.env*`
  keresés a `public/` alatt üres. A Vite `sourcemap` nélkül buildel (magam is ellenőriztem).
- **Nincs titok a `public/build/`-ban** — a `sk_live|sk_test|whsec_|api_key|password` grep csak a
  jelszó-reset **oldalak** Vite-chunk-neveire illeszkedett; 0 db `pk_*` token, 0 db `VITE_*` string.
- **`VITE_*` leltár** — pontosan egy létezik: `VITE_APP_NAME="${APP_NAME}"`. Konstrukció szerint
  nem érzékeny; más nem kerül a kliens-bundle-be.
- **A `.env` gitignore-olt ÉS untracked** — `git check-ignore -v .env` → `.gitignore:14`;
  `git ls-files --error-unmatch .env` → nincs találat. Csak a `.env.example` trackelt.
- **A git-történet tiszta a titkoktól** — `git log --all --diff-filter=A --name-only -- '.env' '*.pem' '*.key' '.env.*'`
  egyetlen találatot ad: `.env.example` a kezdeti commitban. Soha, egyetlen ágon sem lett
  `.env`, privát kulcs vagy tanúsítvány commitolva.
- **Nincs hardcode-olt titok a kódban** — az `AppServiceProvider.php:128-133` `sk_test_` találatai
  a **boot-guard** részei (kontroll, nem szivárgás). A `BILLINGO_*` hivatkozások `env()` olvasások.
- **`public/storage` symlink nem létezik**, és a `Storage::disk('public')`-nak **0 hívóhelye** van
  az `app/`, `config/`, `routes/` alatt. User-privát adat nem kerülhet publikus diszkre.
- **`public/sw.js`** szándékos öngyilkos tombstone: törli a cache-eket, kiregisztrálja magát,
  újratölti a nyitott füleket. **Nincs fetch-handlere és cache-scope-ja**, tehát autentikált HTML-t
  nem cache-elhet — pont a régi PWA worker kitakarítására létezik. Helyes minta.
- **`public/robots.txt`** csak autentikált útvonalakat tilt; a `/dashboard`, `/settings` stb.
  kitalálható Laravel/Fortify defaultok, a JS-bundle route-térképében amúgy is láthatók.
- **`public/.htaccess`** `Options -MultiViews -Indexes`-t állít; **megjegyzés:** ez Apache-only,
  a prod szerver **nginx**, tehát a directory-listing elnyomás ott az nginx defaultján
  (`autoindex off`) múlik — ami biztonságos.

---

## Nettó értékelés

A dimenziót motiváló két konkrét PLAN-állítás **mindkettő halott**. Az egyetlen érdemi lelet a
**D3-1**: 147 MB és 4629 fájlnyi elavult alkalmazás-forrás git-trackelt egy `.gitignore`-bejegyzés
ellenére, és minden pullal kimegy a prodra. Hitelesítőadatot nem tartalmaz és helyes docroot mellett
nem web-elérhető, ami LOW-n tartja — de a `git rm -r --cached backup` fölöslegessé tenne egy
forrás-feltárási felületet, és érdemben csökkentené a deploy súlyát.
