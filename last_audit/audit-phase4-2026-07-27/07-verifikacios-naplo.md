# Verifikációs napló — Fázis 4 (2026-07-27)

> Adverzariális verifikáció a HIGH/MEDIUM-gyanús leletekre. A verifikátorok kifejezetten **cáfolásra** voltak promptolva,
> bizonytalanság esetén `refuted=true` defaulttal, **eltérő lencsékkel** (nem azonos szkeptikusok). Többségi szavazat dönt.
>
> **Két érdemi súlyosság-vita volt. Mindkettő lefelé dőlt el — a kör MEDIUM nélkül zárt.**

---

## Áttekintés

| Lelet | Finder-súly | Verifikátorok | Szavazat | Végső súly | Változás |
|---|---|---|---|---|---|
| **EXT-M1** — `shared.js` hiányzó `isTrusted` | MEDIUM | 3 (kihasználhatóság · blast-radius · meglévő védelmek) | **3/3 LOW** | **LOW** | ⬇️ MEDIUM → LOW + **„regresszió" címke törölve** |
| **SSRF-A1** — CGNAT/multicast range-rés | MEDIUM | 2 (deployment-valóság · védelmi-lánc-rétegek) | **2/2 LOW** | **LOW** | ⬇️ MEDIUM → LOW |

A LOW leletekre egykörös finder-verifikáció futott (a workflow szerint), külön verifikátor-kör nélkül.

---

## 1. vita — EXT-M1: `chrome-extension/src/shared.js:247,278`

### A finder állítása (MEDIUM)

A felirat-gyorsgesztus `mousedown` (`:247`) és `dblclick` (`:278`) ága nem ellenőrzi az `event.isTrusted`-et, miközben
a közvetlenül alatta lévő `click`-ág (`:296`) igen. A `mode:'open'` shadow root miatt az oldalon futó idegen JS
szintetikus eseményekkel átírhatja a felhasználó szó-státuszait. A finder ezt **„részleges `isTrusted`-regressziónak"**
nevezte a korábban javított M2-hibához képest.

### V1 — kihasználhatósági lencse

**`refuted: false` a ténymagra · javasolt súly: LOW**

- A guard tényleg hiányzik; feljebb a láncban sincs szűrő (`wordSpanFromEvent` mindkét call-site-on csupasz `closest()`).
- A támadás **könnyebb**, mint a finder leírta: a listener a shadow rooton **belüli** `#bar` elemen ül, tehát a támadónak
  buborékolásra sem kell hagyatkoznia — közvetlenül a `.tw-word` spanre dispatch-elhet. A `mousedown`-ág `mouseup` nélkül
  500 ms múlva **magától** tüzel (a `mouseup` épp törölné a timert).
- **A támadó-modell viszont szűk** — ez húzza le a súlyt:
  - *hirdetés-iframe*: **kiesik**, cross-origin, nincs hozzáférése a szülő DOM-jához;
  - *másik kiterjesztés*: az `isTrusted` ellene **nem érdemi védelem** (annak `dispatchEvent`-je is `isTrusted:false`,
    viszont `chrome.scripting`-gel amúgy is bármit tud) → alacsony marginális érték;
  - *XSS a youtube.com-on*: ha fennáll, a támadó úgyis mindent tud → a lelet érdemtelen;
  - *előre telepített ellenséges user-script (Tampermonkey)*: **ez az egyetlen nem-degenerált vektor** — de már önmagában
    súlyosabb kompromittáltság alesete.
- Előfeltételek halmozódnak: telepített extension + élő session + megjelenített felirat-sáv + a szó **már a szólistán van**
  (`background.js:245` `look.found && look.id` nélkül `ok:false`).

### V2 — blast-radius lencse

**`refuted: false` a ténymagra · javasolt súly: LOW**

Végigkövetett lánc: `shared.js:247/278` → `quickStatus() :227` → `onQuickStatus :244` → `youtube.js:331`/`netflix.js:111`
→ `background.js:241` → `GET /extension/lookup` (innen jön a CSRF-token) → `POST /words/{word}/status`
→ `routes/words.php:25` → `WordController::status() :547` → `user_word` pivot `syncWithoutDetaching` (`:568`) vagy `detach` (`:556`).

- **A finder súlyosbító feltevése MEGDŐLT.** A `user_word` séma (`2026_03_25_185414_create_user_word_table.php`) mindössze
  `status`, `reviewed_at`, `importance`, timestamps — **SRS/ütemezés nincs benne**. A `flashcards.word_id` FK a `words`-höz
  köt `nullOnDelete`-tel, **nem** a pivothoz → a `detach` **nem cascade-el** ütemezési adatra.
- Egyetlen valós, néma veszteség: az **`importance`** (csillagozás), mert a detach a teljes sort viszi, a re-add pedig
  `importance` nélkül jön vissza. Kozmetikai, de kézzel nem rekonstruálható.
- Szigorúan **self-only** (`$request->user()->knownWords()` mindenütt), enum-validált
  (`in:known,learning,saved,pronunciation,practice`, `TogglesWordStatus.php:26`), nincs exfiltráció, nincs jogosultság- vagy
  pénzügyi hatás.
- **Kvóta**: a `reserveExtensionStatusWrite` (`:561`) csak a felvételt terheli; a detach szándékosan ingyenes. Free usernél a
  napi 20-as extension-keret (`config/plans.php:30`) kimeríthető → aznapi DoS a saját mentésre, **éjfélkor lejár**. Pro: korlátlan.
  AI-keret **nem** érintett.
- **Throttle**: `routes/words.php:24` `throttle:60,1,word-writes` — ~60 művelet/perc, és minden szóhoz előbb lookup kell.
- **Észlelhető**: a UI-ban látszik, `flashSpan` villanás jelzi, streak/achievement toast felugorhat. Dedikált audit-log nincs.

### V3 — meglévő-védelmek lencse

**`refuted: false` a ténymagra · javasolt súly: LOW · „regresszió" minősítés: MEGDÖNTVE**

- A content scriptek ISOLATED worldben futnak (`world:"MAIN"` sehol), de ez **nem véd**: a listenerek valódi DOM-elemeken
  ülnek, a DOM közös.
- **A shadow root tényleg `open`** mind a négy releváns helyen (`youtube.js:256,745`, `netflix.js:97,266`). Kontraszt:
  `lookup-popup.js:155,214`, `flashcard-modal.js:375`, `search-modal.js:39` mind **`closed`** → az `open` itt **tudatos
  eltérés**, és pont ezt a felületet nyitja ki. A `shared.js:296` kommentje maga nevezi meg a kockázatot.
- **Nincs közös guard** feljebb: az `attachCaptionWordGestures` (`:209`) **négy külön** `addEventListener`-t regisztrál
  (`:247`, `:275`, `:281`, `:293`), nincs delegáló wrapper, nincs korai közös return. Ellenpélda: `page-highlight.js:247`,
  ahol a guard a `hlSpanFromEvent` helperbe van **centralizálva**, így mind a négy handler örökli.
- **A `sender.id`-guard és a CSRF szerkezetileg tehetetlen** ezzel a vektorral: az üzenet a **saját** content scriptből jön
  (`sender.id` valid), a tokent pedig a background maga szerzi be a lookupból — a támadó nem is látja, nem is kell neki.
- **A „regresszió" állítás tárgyilag TÉVES** (ez a vita legfontosabb hozadéka): a `git log -S` szerint az
  `attachCaptionWordGestures` **és** a benne lévő egyetlen `isTrusted`-sor **ugyanabban a commitban** (`fbf4405`,
  „Extension 1.24") született — `src/shared.js`-be **tiszta +162 soros beszúrás, 0 törlés**. A `shared.js` teljes `--follow`
  történetében soha nem volt más `isTrusted`-előfordulás. A korábbi M2-fix a `lookup-popup.js`/`page-highlight.js`
  felületeit védte, azok **ma is védettek** (`lookup-popup.js:14,73`, `page-highlight.js:247`).
  → **Helyes minősítés: „új felület hiányzó guarddal", nem visszaesés.**
- **Őrszem-teszt nincs**: sem `isTrusted`, sem `QUICK_STATUS`, sem `attachCaptionWordGestures` nem szerepel a `tests/` alatt;
  a content scriptekre nincs JS-teszt-infrastruktúra.

### Döntés

**3/3 LOW.** A technikai ténymag mindhárom lencsében **CONFIRMED** — a guard hiányzik, a shadow root `open`, a szintetikus
esemény triviálisan átmegy, a háttér nem szűr. A **MEDIUM súly REFUTED**: a hatás self-only integritás-zaj, adatszivárgás és
jogosultság-emelés nélkül, throttle alatt, kézzel visszaállítható, és az egyetlen valós vektor egy előre telepített ellenséges
user-script. A **„regresszió" címke REFUTED** git-bizonyítékkal.

**Megjegyzés a fix-értékről:** a LOW besorolás ellenére a javítás ár-érték aránya kiugró — egyetlen
`if (!e.isTrusted) return null;` a `wordSpanFromEvent`-ben (a `page-highlight.js:247` mintája szerint) mind a három ágat
lefedi, és a `:296`-os külön guard is elhagyhatóvá válik. *(Fix nem történt — audit-no-fixes.)*

---

## 2. vita — SSRF-A1: `TextAnalysisController.php:233`

### A finder állítása (MEDIUM)

A `filter_var(NO_PRIV_RANGE|NO_RES_RANGE)` átengedi a CGNAT `100.64.0.0/10`-et, a `198.18.0.0/15`-öt és a `224.0.0.0/4`
multicastot; egy ingyenes verifikált fiókkal `{"url":"http://100.64.0.5/"}` kimegy a szerver forrás-IP-jéről, és a válasz
15 000 karakterig visszatér → **„full-read SSRF"**.

**Külön súlya van ennek a vitának:** a 2026-07-20-i kör ugyanezt a rést (SSRF-1) már megtalálta és **LOW**-nak minősítette.
A mostani finder emelni akarta.

### V1 — deployment-valóság lencse

**`refuted: true` a MEDIUM-emelésre · javasolt súly: LOW**

- A **ténymag pontos** (inline PHP 8.4 reprodukció): átengedi a `100.64.0.5`, `198.18.0.1`, `224.0.0.1`, `239.255.255.250`
  (SSDP), `192.0.0.1`, `192.0.2.1`, `198.51.100.1`, `203.0.113.1` címeket; blokkolja a `169.254.169.254`, `127.0.0.1`,
  RFC1918, `0.0.0.0`, `240/4` címeket. Explicit CIDR-denylist **nincs**.
- **Nincs elérhető cél ezen a deploymenten**: egyetlen Rackhost VPS, Ubuntu 24.04, minden backend `127.0.0.1`-en
  (MySQL, Redis, php-fpm socket). Nincs konténer, orchestrátor, LB.
- **Overlay-hálózat sehol**: nincs Tailscale/WireGuard/ZeroTier/Docker-overlay/Consul nyom sem függőségben, sem
  deploy-konfigban, sem `.env.example`-ben; nincs `Dockerfile`/`docker-compose`. A finder Tailscale-hivatkozása
  **hipotetikus, nem e deployment tulajdonsága**.
- **Multicast empirikusan tárgytalan**: `224.0.0.1` és `239.255.255.250` → `rc=7` **t≈0.001s** alatt. TCP three-way handshake
  multicast célcímre fogalmilag lehetetlen (nincs unicast-válaszadó) → HTTP-válasz és exfiltráció **kizárt**.
- **`198.18.0.0/15` nem reális**: `rc=56` azonnal; benchmark-sáv, éles hálón nem routolt.
- A finder három MEDIUM-érvéből **kettő cáfolt**, a harmadik („hoszting-váltás némán rést nyit") **jövőbeli feltételes
  kockázat** → defense-in-depth ajánlást indokol, nem mai súlyosság-emelést.

### V2 — védelmi-lánc-rétegek lencse

**`refuted: false` a ténymagra · `refuted: true` a „full-read SSRF" minősítésre · javasolt súly: LOW**

- **Port-allowlist — a döntő réteg**: `ALLOWED_FETCH_PORTS = [80,443,8080,8443]` (`:200`), az ellenőrzés az
  `assertPublicHost`-ban ül (`:223`), amit a `safeFetch` **hoponként újrahív** (`:271`) → redirect sem kerüli meg.
  Redis 6379, Postgres 5432, memcached 11211, Docker API 2375, Kubelet 10250 **mind elérhetetlen**.
  Két teszt igazolja: `TextAnalysisTest.php:443` és `:454` (utóbbi explicit `Http::assertNotSent(':6379')`).
- **Séma-korlát kétrétegű**: `url:http,https` validátor (`:165`) — `gopher://`, `file://`, `dict://` REJECTED —, plusz a
  redirect-hopon újra (`:307`). A klasszikus **gopher→Redis→RCE lánc kizárva**.
- **A válasz NEM „full-read"**: `Content-Type`-kapu dob mindenre, ami nem `text/`|`xml` (`:672`), majd `strip_tags` +
  entity-decode + **a 35 karakternél rövidebb sorok eldobása** (`:696`), végül 15 000 karakteres vágás (`:183`).
  Egy bináris vagy soralapú protokoll-válasz gyakorlatilag megsemmisül → **„szöveg-részleges-read"**.
- **Csak GET, fix User-Agent** (`:279`, `:285`), nulla támadó-vezérelt fejléc vagy body → POST-ot vagy egyedi headert igénylő
  belső API-k nem támadhatók.
- **Max 5 redirect** (`:257`), minden hopon teljes port+séma+range check, `CURLOPT_RESOLVE` IP-pinneléssel.
- **Auth + rate limit**: `auth` + `verified` + `EnsureOnboardingComplete` (`routes/text-analysis.php:7`),
  `throttle:30,1,ta-fetch` (`:9`). Célzott SSRF-naplózás nincs (a `Log::` hívások Gemini-specifikusak).
- **Maradék felület**: olyan szolgáltatás, ami egyszerre (a) `100.64/10`, `198.18/15`, `224/4` vagy NAT64 címen ül,
  (b) HTTP-t beszél a 80/443/8080/8443 egyikén, (c) auth nélkül GET-re **hosszú soros szöveges** választ ad.
  Rendkívül szűk halmaz.

### Döntés

**2/2 LOW — a korábbi (2026-07-20-i) LOW verdikt helybenhagyva.** A rés kódszinten valós és empirikusan reprodukált, de a
MEDIUM-hoz **elérhető cél kellene**, és ezen az egygépes VPS-en a három vitatott tartomány egyikében sincs. A legveszélyesebb
célok (loopback, RFC1918, cloud-metadata `169.254.169.254`) mind blokkoltak.

**Defense-in-depth ajánlás (fix nem történt):** explicit CIDR-denylist `100.64.0.0/10`, `198.18.0.0/15`, `224.0.0.0/4`,
`192.0.0.0/24` a `:233` mellé, vagy tisztábban egy pozitív „globálisan routolható unicast" ellenőrzés.
**Újraértékelendő**, ha a tervezett nagyobb VPS-re/új gépre költözés felhő-belső hálózatot vagy overlay-t hoz.

**Teszt-hézag (a vita mellékterméke):** a `TextAnalysisTest.php:389-482` SSRF-blokk fedi a private-IP, redirect-internal,
port és méret eseteket, de **CGNAT-vektorra nincs teszt** — részben ez az, amitől a védelem környezet-függetlennek *látszik*,
miközben nem az.

---

## Módszertani megjegyzés

Mindkét vita **lefelé** dőlt el, és mindkettőben a verifikáció nemcsak a súlyt korrigálta, hanem a lelet **indoklásának egy
tartóoszlopát is kidöntötte** (EXT-M1: a „regresszió" címke és a feltételezett SRS-veszteség; SSRF-A1: a „full-read" minősítés
és a multicast-vektor). Ez a finder-riportokban is átvezetésre került — a dimenzió-fájlok a **végleges** súlyokat mutatják,
a finder eredeti verdiktje pedig a verifikációs úttal együtt olvasható.
