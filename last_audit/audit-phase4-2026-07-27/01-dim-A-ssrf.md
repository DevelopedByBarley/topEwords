# Dimenzió A — SSRF fetch-source

Audit dátuma: 2026-07-27
Vizsgált felület: `POST /text-analysis/fetch-source`
Elsődleges fájlok:
- `/Applications/XAMPP/xamppfiles/htdocs/topEwords/app/Http/Controllers/TextAnalysisController.php`
- `/Applications/XAMPP/xamppfiles/htdocs/topEwords/app/Services/YouTubeCaptionService.php`
- `/Applications/XAMPP/xamppfiles/htdocs/topEwords/routes/text-analysis.php`
- `/Applications/XAMPP/xamppfiles/htdocs/topEwords/tests/Feature/TextAnalysisTest.php`

Módszer: a védelmi lánc (`fetchSource` → `assertPublicHost` → `safeFetch` → `fetchWebpageText`) valós kódjának olvasása, majd minden bypass-vektor **empirikus** verifikálása a projekt saját PHP 8.4 / curl 8.11.1 / Guzzle runtime-jában (`parse_url`, `filter_var`, `gethostbyname`, `UriResolver::resolve`, `CURLOPT_RESOLVE` viselkedés valós curl-hívással), plusz a tényleges route-middleware kép `php artisan route:list`-tel.

---

## Összesítő

| Súlyosság | Darab |
|---|---|
| HIGH | 0 |
| MEDIUM | 0 |
| LOW | 4 |
| INFO | 6 |

> **⚠️ SÚLYOSSÁG-KORREKCIÓ a verifikációs kör után.** A finder eredetileg **MEDIUM**-ot adott a LELET-A1-re. Két független, eltérő lencséjű adverzariális verifikátor (deployment-valóság · védelmi-lánc-rétegek) **2/2 szavazattal LOW-ra minősítette**. A fenti tábla a **végleges** súlyokat mutatja; a LELET-A1 szövegében a `MEDIUM` felirat a finder eredeti verdiktje, alatta a verifikációs út. Részletek: `07-verifikacios-naplo.md`.

**Nincs olyan verifikált bemenet→hatás út, amellyel a támadó a szerver belső hálózatát (privát tartomány, loopback, link-local, cloud-metadata) elérné.** A védelmi lánc mind a 11 vizsgált vektorra fail-closed. A legsúlyosabb lelet egy nem-privát, de nem-internetes IP-tartomány rése (CGNAT/multicast) — a jelenlegi egygépes VPS-topológián **nincs elérhető cél** egyik érintett tartományban sem.

---

## Bypass-vektor tábla

| # | Vektor | Fájl:sor | Védelem | Verdikt |
|---|---|---|---|---|
| 1 | IPv6 literál (`[::1]`, `[::ffff:127.0.0.1]`, IPv4-mapped) | `TextAnalysisController.php:227–231` | `parse_url` a szögletes zárójelet **benne hagyja** a hostban → `filter_var(FILTER_VALIDATE_IP)` false → `gethostbyname('[::1]')` változatlanul visszaadja → 2. `filter_var` false → dob | **BLOKKOLT** (fail-closed, ld. INFO-A6) |
| 2 | Redirect-lánc: per-hop újravalidálás + relatív resolve | `TextAnalysisController.php:270–312` | `withoutRedirecting()` + kézi hop-ciklus, minden hop elején `assertPublicHost($url)`; `UriResolver::resolve` a relatív/protokoll-relatív Location-re; hop-limit 5 | **BLOKKOLT** |
| 3 | DNS-rebinding / TOCTOU (`CURLOPT_RESOLVE` pinnel-e) | `TextAnalysisController.php:271, 281` | `assertPublicHost` visszaadja a **validált IP-t**, ez kerül a `CURLOPT_RESOLVE`-ba `host:port:ip` alakban; valós curl-teszttel igazolva, hogy a kapcsolat a pinnelt IP-re megy és a DNS-t meg sem kérdezi | **BLOKKOLT** |
| 4 | Séma-whitelist: `file://`, `gopher://`, `dict://`, `ftp://`, `data:`, `//host` | `TextAnalysisController.php:165` és `:307–309` | Belépéskor `url:http,https` validátor; redirect után explicit `in_array(scheme, ['http','https'])` a **feloldott** URL-en | **BLOKKOLT** |
| 5 | Decimális/oktális/hex IP, `0.0.0.0`, `[::]` | `TextAnalysisController.php:227–235` | A nem-dotted alakok nem IP-ként validálódnak → `gethostbyname` normalizálja `127.0.0.1`-re → `NO_PRIV_RANGE\|NO_RES_RANGE` blokkol. `0.0.0.0` és `[::]` szintén blokkolt | **BLOKKOLT** |
| 6 | Link-local / metadata (`169.254.169.254`), privát range, `localhost`, publikus DNS→privát IP (`*.nip.io`) | `TextAnalysisController.php:233–235` | A **feloldott IP-re** fut a range-ellenőrzés, nem a hostnévre → a DNS-alapú trükk (nip.io, localtest.me) hatástalan | **BLOKKOLT** (részleges rés: LELET-A1) |
| 7 | Video-ID ág megkerüli-e a host-ellenőrzést | `TextAnalysisController.php:167–176`; `YouTubeCaptionService.php:43–59, 201–234, 284–292, 319–327` | Az ág **valóban átugorja** az `assertPublicHost`-ot, de a user-inputból **csak a 11 karakteres, `[a-zA-Z0-9_-]` osztályra szűkített videó-ID** kerül át; minden letöltési cél hardcode-olt `https://www.youtube.com/...` | **BLOKKOLT** (ld. INFO-A3) |
| 8 | `MAX_FETCH_BYTES` guard: menet közben szakít vagy utólag vág | `TextAnalysisController.php:260–268, 679–681` | `CURLOPT_PROGRESSFUNCTION` **menet közben** megszakítja (`return 1`), a megszakítás `ConnectionException`-ként jön vissza és `$tooLarge` flaggel értelmezett; mellette utólagos `strlen` védőháló | **VALÓS, menet közbeni** |
| 9 | Credentials-in-URL, unicode/punycode host, whitespace/CRLF | `TextAnalysisController.php:165, 214, 272` | `parse_url` a userinfót leválasztja → a host a valódi cél, a range-check arra fut; CRLF/space a belépő URL-ben a validátoron elhasal; a redirect Location-ben CRLF `%0D%0A`-ra kódolódik, vezető szóköz esetén host=`NULL` → dob | **BLOKKOLT** |
| 10 | Rate limit / auth a végponton | `routes/text-analysis.php:7, 9` | `auth` + `verified` + `EnsureOnboardingComplete` + `throttle:30,1,ta-fetch` (per-user kulcs) | **VÉDETT** (ld. LOW-A2) |
| 11 | Response-visszaszivárgás (blind vs full-read) | `TextAnalysisController.php:183, 660–701` | **Full-read**: a válasz tisztított szövege 15 000 karakterig visszakerül a hívóhoz | **FULL-READ SSRF publikus célokra** (ld. LELET-A1 blast radius) |

---

## Leletek

### LELET-A1 — ~~MEDIUM~~ → **LOW** (verifikáció után) — A range-szűrő átengedi a CGNAT (`100.64.0.0/10`), a benchmark (`198.18.0.0/15`), a multicast (`224.0.0.0/4`) és a TEST-NET tartományokat

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:233`
- **Súlyosság**: **LOW** (finder: MEDIUM → 2 verifikátor 2/2 szavazattal LOW)
- **Verifikációs verdikt**: **PLAUSIBLE-as-LOW** — a ténymag CONFIRMED, a MEDIUM-emelés REFUTED
- **Verifikációs út** (részletesen: `07-verifikacios-naplo.md`):
  - *Deployment-lencse*: `refuted: true` a MEDIUM-ra. Egygépes Rackhost VPS, minden backend `127.0.0.1`-en; **nincs Tailscale/WireGuard/Docker-overlay** sem függőségben, sem deploy-konfigban. A multicast empirikusan `rc=7` **azonnal** (TCP-handshake multicast célcímre fogalmilag lehetetlen), a `198.18/15` `rc=56` — egyik sem exfiltrációs vektor. A finder három MEDIUM-érve közül kettő cáfolt, a harmadik („hoszting-váltás némán rést nyit") **jövőbeli feltételes kockázat** → defense-in-depth ajánlást indokol, nem mai súlyt.
  - *Védelmi-lánc-lencse*: `refuted: true` a „full-read SSRF" minősítésre. A port-allowlist `[80,443,8080,8443]` (`:200`, hoponként újraellenőrizve `:271`) kizárja a Redis/Postgres/memcached/Docker-API/Kubelet célokat; a `Content-Type`-kapu (`:672`) + `strip_tags` + **a 35 karakternél rövidebb sorok eldobása** (`:696`) miatt egy bináris vagy soralapú protokoll-válasz megsemmisül → „szöveg-részleges-read", nem full-read. Csak GET, fix User-Agent, nulla támadó-vezérelt fejléc/body.
- **Miért maradt mégis lelet (nem INFO)**: a rés kódszinten valós és empirikusan reprodukált; a fix triviális. A LOW azt tükrözi, hogy **ma nincs elérhető cél**, nem azt, hogy a hézag nem létezik.
- **Kód**: `filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)`
- **Mért eredmény** (a projekt PHP 8.4 runtime-jában, empirikusan):

  | IP | verdikt |
  |---|---|
  | `10.1.1.1`, `172.16.0.1`, `192.168.0.1` | block |
  | `127.0.0.1`, `0.0.0.0`, `169.254.169.254` | block |
  | `240.0.0.1`, `255.255.255.255`, `0.1.2.3` | block |
  | **`100.64.0.1`** (CGNAT, RFC 6598) | **PASS** |
  | **`198.18.0.1`** (benchmark, RFC 2544) | **PASS** |
  | **`224.0.0.1`** (multicast) | **PASS** |
  | `192.0.0.1`, `192.0.2.1`, `198.51.100.1`, `203.0.113.1` | PASS |

- **Támadási forgatókönyv**: egy hitelesített, e-mail-verifikált felhasználó (ingyenes fiók is elég) POST-ol `{"url":"http://100.64.0.5/"}`-öt a `/text-analysis/fetch-source`-ra. A `NO_PRIV_RANGE|NO_RES_RANGE` páros ezt a tartományt nem ismeri privátként, így a guard átengedi; a `CURLOPT_RESOLVE` pontosan erre az IP-re pinnel, a kérés kimegy, és a **válasz tisztított szövege 15 000 karakterig visszatér a JSON `text` mezőjében** (`TextAnalysisController.php:183`). Ez teljes olvasású (nem vak) SSRF.
- **Hatás mértéke a deploy-topológiától függ**: a jelenlegi Rackhost VPS-en (egyetlen gép, publikus IP) a `100.64.0.0/10` nem vezet sehova, ezért a *jelenlegi* éles környezetben a gyakorlati hatás közel nulla.
- **A finder eredeti MEDIUM-indoklása és annak sorsa a verifikációban**:
  - *(a) „a CGNAT-tartományt számos hoszting- és felhő-szolgáltató valóban használja"* → **REFUTED e deploymentre**: nem ez a szolgáltató; nincs overlay-hálózat nyoma sehol a repóban.
  - *(b) „a `224.0.0.1` all-hosts multicast a szerver saját LAN-szegmensét célozza"* → **REFUTED empirikusan**: `rc=7` t≈0.001s alatt; TCP-kapcsolat multicast célcímre nem jön létre, tehát HTTP-válasz és exfiltráció kizárt.
  - *(c) „a védelem környezet-független invariánsnak látszik, miközben nem az — egy hoszting-váltás némán rést nyit"* → **ELFOGADVA, de jövőbeli feltételes kockázatként.** Ez a leletet életben tartja (LOW), de mai súlyt nem emel. Ez az érv a legértékesebb hozadéka a leletnek.
- **Indoklás**: konkrét bemenet (`http://100.64.0.5/`) → konkrét hatás (a szerver forrás-IP-jéről indított kérés + full-read válasz), tehát nem INFO. Nem HIGH, mert a jelenleg ismert éles topológián nincs elérhető belső cél ezekben a tartományokban, és a legveszélyesebb célok (loopback, RFC1918, link-local metadata) mind blokkoltak.
- **Megjegyzés (csak dokumentálás, fix nem történt)**: az explicit CIDR-denylist (`100.64.0.0/10`, `198.18.0.0/15`, `224.0.0.0/4`, `192.0.0.0/24`) a `filter_var` mellé zárná a rést; alternatívaként egy pozitív „globálisan routolható unicast" ellenőrzés.

---

### LELET-A2 — LOW — Full-read SSRF tetszőleges publikus hostra: a szerver forrás-IP-je mint proxy

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:183` (a 15 000 karakteres visszaadás), `:660–701` (a szövegkinyerés), `:200` (port-allowlist)
- **Súlyosság**: LOW
- **Támadási forgatókönyv**: a felhasználó `{"url":"http://<tetszőleges-publikus-host>:8080/path"}`-t küld. A szerver a **saját IP-jéről** kéri le a tartalmat, és a tisztított szöveget visszaadja. Ezzel (a) IP-alapú allowlistek mögötti, de publikusan routolt szolgáltatások érhetők el, ha azok a topEwords VPS IP-jét bízzák meg; (b) a felhasználó anonimizált letöltő-proxyként használhatja a szervert (a szerver IP-je jelenik meg a célhelyen, nem a felhasználóé); (c) a 4 engedélyezett porton (80/443/8080/8443) időzítés-alapú különbségtétel lehetséges nyitott/zárt port között publikus hostokon.
- **Miért csak LOW**: ez a végpont **rendeltetése** — webes szövegforrás behúzása. A maradék primitívet a port-allowlist (`ALLOWED_FETCH_PORTS`, `:200`), a Content-Type-szűrő (`:672`), a 30/perc throttle és a `auth`+`verified` kapu szűkíti. Nincs olyan belső cél, amit elérne, amit a range-szűrő ne blokkolna (a LELET-A1 tartományain kívül).
- **Indoklás**: konkrét bemenet→hatás út van (proxyzás, IP-alapú bizalom megkerülése), de a hatás a tudatosan vállalt funkcionális felület része és nincs privilégium-emelés.

---

### LELET-A3 — LOW — Az anonim visszajelzés hibaüzenet-orákulumot ad a szerver hálózati környezetéről

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:177–181`, `:664–666`, `:672–674`, `:679–681`, `:286–292`
- **Súlyosság**: LOW
- **Támadási forgatókönyv**: a támadó megkülönböztethető válaszokat kap különböző hálózati állapotokra ugyanazon a 422-es státuszon belül, a `error` mező szövege alapján:
  - `"Ez a cím nem érhető el."` → a guard blokkolt (privát/reserved IP, vagy tiltott port, vagy feloldhatatlan név)
  - `"A weboldal nem érhető el (HTTP <státusz>)."` → a kapcsolat **létrejött**, és a **pontos HTTP státuszkód visszaszivárog** (`:665`)
  - `"A megadott cím nem weboldalra mutat (nem szöveges tartalom)."` → él a host, válaszol 200-zal, bináris tartalommal
  - `"A forrás nem érhető el. Próbáld újra később."` → connection error / timeout

  Ezzel a felhasználó a szerver forrás-IP-jéről publikus hostokon feltérképezheti, hogy egy adott `host:port/path` létezik-e, milyen státuszt ad, és szöveges-e — a 30/perc throttle mellett is használható felderítő primitív. Kombinálva a LELET-A1-gyel, a `100.64.0.0/10` térben ez élő/halott hoszt-felderítéssé válik.
- **Indoklás**: konkrét bemenet→megkülönböztethető kimenet, tehát nem INFO. LOW, mert a blokkolt tartományokra az üzenet **egységes** (`"Ez a cím nem érhető el."` fedi a privát IP-t, a tiltott portot és a DNS-hibát is), így a legérzékenyebb információ — hogy egy belső cím létezik-e — nem szivárog.

---

### LELET-A4 — LOW — A `224.0.0.0/4` multicast átengedése a szerver saját LAN-szegmensét célozza

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:233`
- **Súlyosság**: LOW
- **Támadási forgatókönyv**: `{"url":"http://224.0.0.1/"}` — az all-hosts multicast csoport. A guard átengedi (mérve: PASS), a curl a pinnelt multicast IP-re próbál TCP-t nyitni. TCP-t multicast célcímre a kernel gyakorlatilag nem enged felépíteni, ezért a hatás a jelenlegi stacken kapcsolat-hiba, nem adat-kinyerés.
- **Indoklás**: külön LOW-ként dokumentálva a LELET-A1 mellett, mert más a mechanizmusa (nem unicast belső cél, hanem broadcast-jellegű címzés), de önmagában nincs igazolt adat-kinyerési út — ezért nem emelkedik MEDIUM-ra. A LELET-A1 javítása ezt is fedné.

---

### INFO-A5 — INFO — A video-ID ág szándékosan és biztonságosan kerüli meg a host-ellenőrzést

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:167–176`; `app/Services/YouTubeCaptionService.php:43–59`
- **Megállapítás**: a PLAN aggálya („a video-ID ág megkerüli-e a host-ellenőrzést") **igaz a betű szerint, de ártalmatlan**. A `fetchSource` a `$videoId !== null` ágon valóban nem hívja az `assertPublicHost`-ot (`:170–172`). Ennek oka, hogy ezen az ágon **a user URL-je soha nem kerül letöltésre**:
  - `extractVideoId` négy regex-szel kizárólag a `[a-zA-Z0-9_-]{11}` csoportot nyeri ki (`YouTubeCaptionService.php:45–56`).
  - Minden ezt követő letöltési cél hardcode-olt literál: `https://www.youtube.com/watch?v=` (`:209`, `:327`, `:158`), `https://www.youtube.com/youtubei/v1/player?key=` (`:231`), `https://www.youtube.com/api/timedtext?v=` + `urlencode($videoId)` (`:286`).
  - A videó-ID karakterosztálya nem tartalmaz `/`, `?`, `#`, `@`, `:` karaktert, ezért path-/host-injekció a hardcode-olt URL-be nem lehetséges.
- **Vizsgált él-eset**: a regexek **nem horgonyzottak**, ezért `http://169.254.169.254/youtube.com/watch?v=AAAAAAAAAAA` illeszkedik, és az ág átugorja a guardot. **De**: a támadó hostja ekkor sem kerül sehova — a szerver a `https://www.youtube.com/watch?v=AAAAAAAAAAA` címet kéri le. A nem-horgonyzottság tehát nem SSRF, csak annyi hatása van, hogy egy furcsa URL YouTube-átiratként értelmeződik.
- **A lánc egyetlen nem-literál URL-je**: a `baseUrl` a caption-track objektumból (`YouTubeCaptionService.php:251`, `:585`), amit a **YouTube saját válasza** ad, nem a felhasználó. A `fetchCaptionBody` (`:384–406`) ezt guard nélkül tölti le. Ez a partner-válaszra bízott bizalom (a kód `:16–20` kommentje pontosan és helyesen dokumentálja), nem támadó-vezérelt vektor.
- **INFO, nem MEDIUM**: nincs olyan felhasználói bemenet, amely a letöltés célhosztját befolyásolná.

---

### INFO-A6 — INFO — Az IPv6 fail-closed, de mellékhatásként minden IPv6-cél elérhetetlen

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:227–231`
- **Megállapítás**: mért viselkedés — `parse_url('http://[::1]/', PHP_URL_HOST)` a **szögletes zárójelekkel együtt** adja vissza a hostot (`'[::1]'`). Emiatt:
  1. `filter_var('[::1]', FILTER_VALIDATE_IP)` → false (a zárójel miatt),
  2. a kód `gethostbyname('[::1]')`-et hív, ami IPv6-ot nem kezel és a **bemenetet változatlanul** adja vissza,
  3. a `:229` `filter_var` ezen elhasal → `RuntimeException`.

  Ugyanez `[::ffff:127.0.0.1]`, `[0:0:0:0:0:ffff:7f00:1]`, `[fd00::1]`, `[fe80::1]`, `[::]`, `[64:ff9b::7f00:1]` (NAT64) esetén is — mind blokkolt. A PLAN aggálya (IPv4-mapped IPv6 bypass) tehát **nem áll fenn**.
- **Miért INFO és nem lelet**: a védelem fail-closed, biztonsági rés nincs. A megjegyzés dokumentációs értékű: a blokkolás **véletlen** (a `gethostbyname` IPv6-inkompatibilitásán múlik), nem szándékos, és mellékhatása, hogy legitim IPv6-only publikus forrás sem tölthető le. Ha valaki később a `gethostbyname`-et `dns_get_record`-ra vagy zárójel-trimmelésre cseréli funkcionális okból, a védelem **némán elveszik**. Nincs teszt, ami ezt őrizné.

---

### INFO-A7 — INFO — A redirect-kezelés minden vizsgált torzított `Location`-értékre fail-closed

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:294–311`
- **Mért eredmények** `UriResolver::resolve(base='http://8.8.8.8/a/b?x=1', location)` mellett, majd `assertPublicHost`-on átvezetve:

  | Location | Feloldott | Sors |
  |---|---|---|
  | `/c`, `../d`, `?y=2` | ugyanaz a host | újravalidálva, OK |
  | `//127.0.0.1/e` (protokoll-relatív) | `http://127.0.0.1/e` | `assertPublicHost` **blokkol** |
  | `http://127.0.0.1/f` | `http://127.0.0.1/f` | `assertPublicHost` **blokkol** |
  | `file:///etc/passwd` | `file:///etc/passwd` | séma-check (`:307`) **blokkol** |
  | `gopher://127.0.0.1/`, `javascript:alert(1)` | változatlan | séma-check **blokkol** |
  | két `Location` fejléc | vesszővel összefűzve → host=`a` | feloldhatatlan név → **blokkol** |
  | `Location: " http://127.0.0.1/"` (vezető szóköz) | host=`NULL` | `:216–218` **blokkol** |
  | `Location: "http://127.0.0.1/\r\nX"` | `%0D%0AX` a path-ban | host=`127.0.0.1` → range-check **blokkol** |
  | 3xx `Location` fejléc nélkül | `header('Location') === ''` | `:300–302` visszatér a 3xx válasszal, nem loopol |
- **Verdikt**: a hop-ciklus (`:270`) minden iteráció **elején** hívja az `assertPublicHost`-ot, tehát a per-hop újravalidálás nem opcionális ág, hanem a ciklus invariánsa. Hop-limit 5, utána `RuntimeException`.

---

### INFO-A8 — INFO — A `CURLOPT_RESOLVE` pinnelés valós curl-lel igazolva működik

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:271, 281`
- **Verifikáció**: valós curl 8.11.1 hívás egy **nem létező** DNS-névre (`pinned-test-host.example`) `CURLOPT_RESOLVE => ["pinned-test-host.example:80:127.0.0.1"]` mellett. Eredmény: nem DNS-hiba, hanem *„Failed to connect to pinned-test-host.example port 80"* — azaz curl **átugrotta a DNS-t** és a megadott IP-re próbált csatlakozni. A pinnelés tehát valódi, nem csak „első feloldás".
- **A pinnelés kulcsa konzisztens**: a `host` és a `port` ugyanabból a `parse_url`-ből jön, mint a kérés URL-je (`:272–274`), így nincs kulcs-eltérés. Ellenőrizve nagybetűs hostra (`EXAMPLE.COM`) és trailing dot-ra (`example.com.`) is — mindkettőnél a RESOLVE-kulcs és a curl által használt host egyezik.
- **Transport-ág**: a Guzzle a curl handlert használja (`ext-curl` betöltve); a `Proxy::wrapStreaming` csak `$options['stream']` esetén váltana stream handlerre, amit ez a kód nem állít be. A curl-opciók tehát ténylegesen érvényre jutnak.
- **Maradék elméleti rés (nem lelet)**: a `gethostbyname` csak **egy** A rekordot ad vissza. Ha egy név több A rekordot ad (egy publikus + egy privát), a guard a kapott egyet validálja, és a pinnelés **pont arra** rögzít — a másik rekord soha nem kerül használatba. A round-robin rebinding tehát a pinnelés miatt nem működik.

---

### INFO-A9 — INFO — A `MAX_FETCH_BYTES` guard menet közben szakít, kettős védelemmel

- **Fájl · sor**: `app/Http/Controllers/TextAnalysisController.php:245`, `:260–268`, `:282–283`, `:286–292`, `:679–681`
- **Megállapítás**: a `CURLOPT_PROGRESSFUNCTION` a `Content-Length`-ből ismert **bejelentett** méretet (`$downloadTotal`) **és** a ténylegesen letöltött byte-okat (`$downloaded`) is nézi, és `return 1`-gyel **menet közben** abortálja a transzfert — tehát a hazudott vagy hiányzó `Content-Length` (chunked válasz) sem kerüli meg. A curl a megszakítást `ConnectionException`-ként dobja, amit a `:286–292` a `$tooLarge` flag alapján helyesen fordít le felhasználói hibává, nem nyeli le általános hálózati hibaként. Mellette utólagos `strlen`-védőháló (`:679`) — ez fedi a `Http::fake()` alatti utat is, ahol progress-callback nem fut. A 15 000 karakteres `mb_substr` (`:183`) csak a válaszméretet korlátozza, nem a letöltést.
- **Verdikt**: a PLAN „csak utólag vág" gyanúja **nem áll fenn**.

---

### INFO-A10 — INFO — Auth, throttle és jogosultsági kép

- **Fájl · sor**: `routes/text-analysis.php:7, 9`
- **Mért middleware-lánc** (`php artisan route:list --path=text-analysis/fetch-source -v`):
  `web` → `Illuminate\Auth\Middleware\Authenticate` → `Illuminate\Auth\Middleware\EnsureEmailIsVerified` → `App\Http\Middleware\EnsureOnboardingComplete` → `ThrottleRequests:30,1,ta-fetch`
- **Ki hívhatja**: bármely bejelentkezett, e-mail-verifikált, onboardingot befejezett felhasználó. **Pro-előfizetés NEM feltétel** — ingyenes fiók is eléri. Nincs admin-kapu.
- **Throttle**: 30 kérés/perc, a `ta-fetch` prefix elkülöníti a többi limitertől; a kulcs a `ThrottleRequests::resolveRequestSignature` alapján hitelesített kérésnél a **user azonosítója**, tehát per-felhasználó, nem per-IP. Több fiók regisztrálásával a limit többszörözhető, de a regisztráció maga is throttle-özött (`throttle:register`) és e-mail-verifikációt igényel.
- **Verdikt**: a kapu megfelelő; a 30/perc érdemben lassítja a LELET-A3 szerinti felderítést.

---

## PLAN-feltevés MEGDŐLT

A PLAN Fázis 4a 1. pontja öt konkrét bypass-gyanút nevez meg. Ezekből **négy megdőlt**:

1. **PLAN-feltevés MEGDŐLT — „IPv6 / IPv4-mapped IPv6" bypass**
   A PLAN az IPv4-mapped IPv6-ot (`[::ffff:127.0.0.1]`) potenciális résként kezeli. Mérve: **nem az** — a `parse_url` bracket-megtartása + a `gethostbyname` IPv6-inkompatibilitása miatt minden IPv6 literál fail-closed elutasításra kerül (INFO-A6). A tényleges állapot fordított a PLAN várakozásához képest: nem rés, hanem *túl szigorú* — legitim IPv6-cél sem érhető el, és a védelem járulékos, nem szándékos.

2. **PLAN-feltevés MEGDŐLT — „a video-ID ág megkerüli-e a host-ellenőrzést"**
   A megkerülés **ténylegesen létezik** (`:170–172` feltételesen hívja az `assertPublicHost`-ot), de a PLAN implicit következtetése — hogy ez SSRF-vektor — hamis. Az ágon a felhasználói URL-ből kizárólag egy 11 karakteres, szűk karakterosztályú videó-ID jut tovább, és minden letöltési cél hardcode-olt `youtube.com` literál (INFO-A5). Az „épít-e URL-t user-inputból" kérdésre a válasz: igen, de csak `urlencode($videoId)`-vel egy fix host fix path-ára, ami nem host-befolyásoló.

3. **PLAN-feltevés MEGDŐLT — „`MAX_FETCH_BYTES` guard: csak utólag vág"**
   A guard `CURLOPT_PROGRESSFUNCTION`-nel **menet közben** szakít, és a bejelentett méret mellett a ténylegesen letöltött byte-okat is figyeli, tehát hamis `Content-Length` és chunked válasz sem kerüli meg. Az utólagos `strlen` nem az elsődleges védelem, hanem védőháló a fake-elt HTTP kliens útjára (INFO-A9).

4. **PLAN-feltevés MEGDŐLT — „`CURLOPT_RESOLVE`: csak első feloldás?"**
   Valós curl-hívással igazolva, hogy a `CURLOPT_RESOLVE` a DNS-t teljesen kiiktatja az adott `host:port`-ra, tehát valódi pinnelés. A DNS-rebinding és a többszörös A-rekordos round-robin egyaránt hatástalan (INFO-A8).

**Megerősítve (nem dőlt meg):**
- A redirect-lánc per-hop újravalidálása és a relatív redirect resolve-ja valóban működik, minden torzított `Location`-formára fail-closed (INFO-A7). A PLAN itt jól tippelt, hogy ez a kritikus pont — de a kód helyes.

**A PLAN által NEM lefedett, itt talált rés:**
- A `filter_var` `NO_PRIV_RANGE|NO_RES_RANGE` páros tartomány-lefedettsége hiányos (CGNAT `100.64.0.0/10`, benchmark `198.18.0.0/15`, multicast `224.0.0.0/4`). A PLAN a range-ellenőrzést adottnak veszi és nem kérdőjelezi meg — ez a kör egyetlen MEDIUM lelete (LELET-A1).

---

## Tesztlefedettség (megfigyelés, nem lelet)

A `tests/Feature/TextAnalysisTest.php:389–484` hét SSRF-tesztet tartalmaz: privát IP elutasítás (`Http::assertNothingSent()`-tel), redirect belső címre, sikeres publikus letöltés, nem-szöveges Content-Type, méret-sapka, tiltott port belépéskor, tiltott port redirect után, engedélyezett portok ellenpróbája. Ez erős lefedettség.

Nem őrzi teszt: az IPv6-blokkolást (INFO-A6 — ez a legkockázatosabb hézag, mert a védelem járulékos), a LELET-A1 tartományait, a séma-whitelistet redirect után (`:307`), és a torzított `Location`-formákat (INFO-A7).
