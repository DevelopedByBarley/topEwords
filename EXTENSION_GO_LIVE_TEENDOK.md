# Bővítmény go-live teendők (Chrome Web Store)

**Készült:** 2026-07-28 · **Frissítve:** 2026-08-08 · **Bővítmény verzió:** 1.31 · **Commit:** `21ce3e3`
(pusholva a `main`-re)

A kód- és jogi oldali javítások megtörténtek (AI-tájékoztatás, felelősség-kizárás, ÁSZF/Adatvédelem,
manifest-korlát, `isTrusted`-guard). Ez a lista **csak azt tartalmazza, ami még hátravan** — abban a
sorrendben, ahogy érdemes haladni.

**1.25 óta:** 1.26 — az oldal-kiemelés SPA-navigáció után is megmarad (MutationObserver);
1.27 — a kiemelés YouTube/Netflix alatt betöltéskor inaktív marad; 1.28 — popup-arculat az app
lila témájához igazítva + kétnyelvű (HU/EN) súgó-modál a szétszórt tippek helyett;
**1.29 — az `<all_urls>` content script kivezetése** (`4d7dd2a`); 1.30 — kinyitható
találat-részletező a popup keresőben; 1.31 — szóalakok a részletezőben.

> ⚠️ **A legfontosabb változás az 1.29.** A content script már **csak
> `https://www.youtube.com/*` és `https://www.netflix.com/*`** alatt fut, és vele együtt kivezettük
> az oldal-kiemelést is (`src/page-highlight.js` a repóban marad, de **nincs a csomagban** — a
> visszahozás egy manifest-bejegyzés; a teljes 1.28-as állapot: `ext-1.28-all-urls` tag).
> Az általános oldalakon már **csak a jobb gombos menü és a popup-kereső** működik. Ez a dokumentum
> ehhez az állapothoz van igazítva — a store-mezőket **ne** az 1.28-as szövegekkel töltsd ki, mert
> a leírás és a valós működés eltérése önmagában policy-ütközés.

---

## 0. Élesítés (most azonnal)

- [ ] **Ploi → Deploy** megnyomása a topwords.eu site-on. A Quick Deploy ki van kapcsolva, ezért a
      push önmagában nem élesít. Ezzel megy ki: a frissített ÁSZF, Adatkezelési tájékoztató és a
      letöltési oldalról szolgált **1.31-es zip**.
- [ ] Deploy után ellenőrizd élesben: `https://topwords.eu/terms` (7. és 8. pont látszik),
      `https://topwords.eu/privacy` (6. pont: AI), és a Letöltések oldalon a zip letöltése
      (**a Letöltések 2026-07-29 óta admin-only** — a sidebarban „Letöltések (dev)" néven,
      az admin fiókoddal nézd).

---

## 1. Blokkolók — enélkül a store elutasít vagy jogilag sérülékeny vagy

- [ ] **Teszt-fiók a review-nak.** A bővítmény bejelentkezés nélkül csak a „Nem vagy bejelentkezve"
      sávot adja (`popup.html`), a Google reviewere pedig nem regisztrál. A Developer Dashboard
      **„Account is required / test credentials"** mezőjébe adj meg egy **megerősített e-mailű**
      teszt-fiókot (e-mail + jelszó), és írd le 2–3 mondatban a próbafolyamatot.
      ⚠️ **Az 1.29 óta érvényes folyamat** (a régi „open any English article, then double-click a
      word" utasítás már nem működne — általános oldalon nincs content script):
      > Sign in at https://topwords.eu/login with the credentials above. Then either (a) click the
      > TopWords toolbar icon and type an English word into the search box — this works on any tab —
      > or (b) open a YouTube video that has English subtitles, click the **TW** button in the
      > player's control bar, and click any word in the subtitle line that appears.

      Ez a leggyakoribb elutasítási ok bejelentkezést igénylő bővítményeknél.
      **A fiók kapjon Pro/korlátlan hozzáférést:** Free fiókon napi 20 írás után a bővítmény a
      „válts Prora →" hintet mutatja, ami a pricing oldalra visz, ahol viszont — amíg a Stripe nincs
      élesítve — az „Az előfizetés hamarosan elérhető" kártya fogadja. Nem elutasítási ok, csak
      félkésznek látszik.

- [x] ~~**Szolgáltatói cégadatok az ÁSZF-be.**~~ **KÉSZ** (2026-07-29): Szaniszló Árpád egyéni
      vállalkozó (CodeBarley), 3881 Abaújszántó, Aranyosi út 3., nyilvántartási szám 58300488,
      adószám 45715428-1-25, `info@codebarley.hu`. Bekerült az **ÁSZF 1. pontjába** és — a GDPR
      adatkezelő-azonosítási követelménye miatt — az **Adatkezelési tájékoztató 1. pontjába** is.
      Őrszem-teszt védi mindkettőt (`LegalAndExtensionDisclosureTest` → *„a jogi oldalak megnevezik
      a szolgáltatót…"*).

- [x] ~~**Fizetős előfizetés → 14 napos elállás.**~~ **KÉSZ** (2026-07-29-i ellenőrzés). A tétel
      elavult volt: a nyilatkozat már a `989ffba` commit óta benne van a checkout jelölőnégyzetében
      (`resources/js/pages/pricing.tsx`): *„…kifejezetten hozzájárulok a teljesítés azonnali
      megkezdéséhez, és tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogomat."*
      A szerveroldali kikényszerítést a `PricingCheckoutGatekeeperTest` fedi; a szöveg véletlen
      törlése ellen új őrszem-teszt véd (`LegalAndExtensionDisclosureTest` → *„a checkout kifejezett
      nyilatkozatot kér a teljesítés azonnali megkezdéséről"*).

---

## 2. Jogi / adatvédelmi pontosítások

- [x] ~~**Tárhelyszolgáltató.**~~ **PÓTOLVA** (2026-07-29): az Adatkezelési tájékoztatóban most
      „Rackhost Informatikai Zrt. (székhely: 6722 Szeged, Tisza Lajos körút 41., Magyarország)".
      Forrás: Nemzeti Cégtár / Céginfo (adószám 25333572-2-06, cégjegyzékszám 06-10-000489).
      ⚠️ **Vesd össze a rackhost.hu impresszumával**, mielőtt élesbe megy — cégadat változhat.
- [ ] **Ploi mint sub-processzor.** A Ploi (ploi.io, Hollandia) adminisztratív hozzáféréssel bír a
      szerverhez. Döntsd el, felvesszük-e adatfeldolgozóként (jogilag védhetőbb, ha igen).
- [ ] **Naplómegőrzés.** A tájékoztató legfeljebb 12 hónapot ígér, de a `.env`-ben `LOG_STACK=single`
      → a `laravel.log` sosem forog. Élesben állítsd:
      `LOG_STACK=daily` és `LOG_DAILY_DAYS=365`, majd `php artisan config:cache`.
- [ ] **Ügyvédi átnézés.** A szövegek tartalmilag rendben vannak és a valós működést írják le, de a
      végleges kiadás előtt érdemes jogásszal átfuttatni (különösen az elállás és a felelősség-
      korlátozás fejezeteket).

---

## 3. Chrome Web Store Developer Dashboard — kitöltendő mezők

Ezek bemásolhatók. (Feltöltendő csomag: `chrome-extension/topwords-extension-1.31.zip`)

### Single purpose
> TopWords helps Hungarian learners of English build vocabulary: it looks up English words in
> YouTube and Netflix subtitles and from the extension's own search box, and syncs the user's
> learning status with their topwords.eu account.

*(Szó szerint ezt teszi a csomag; egyezik a `manifest.json` `description` mezőjével.)*

### Permission justifications
| Engedély | Indoklás (angolul, bemásolható) |
|---|---|
| `activeTab` | Used only when the user opens the toolbar popup or the right-click menu, to read the current tab's URL for the optional "analyse page text" action, which opens that URL in the user's own topwords.eu text analyser. |
| `contextMenus` | Adds two right-click entries: look up the selected English word, and open the current page in the text analyser. Both open a topwords.eu tab; neither reads the page. |
| `storage` | Stores the user's own local settings (subtitle features on/off) and a short-lived cache of the user's word-status map, so it is not re-downloaded on every video. |
| `https://topwords.eu/*` (host) | The extension's only backend, and its only host permission. Word lookups, status updates and flashcards are sent to the user's own topwords.eu account over HTTPS. |
| Content scripts (`https://www.youtube.com/*`, `https://www.netflix.com/*`) | The subtitle lookup feature has to read the subtitle line inside the player, so it runs only on these two sites. Subtitle text is parsed locally in the browser and is never transmitted — only the single word the user clicks is sent. Both features are off by default and switched on by the user with the **TW** button in the player. |
| Remote code | **No** — all code ships inside the package (MV3, no `eval`, no remote scripts). |

### Privacy practices → Data collection
- [ ] Jelöld be: **Website content**. Indoklás:
> Only the individual English words the user looks up; the page URL only when the user explicitly
> starts the "analyse this page" action; the YouTube video ID when the subtitle feature is enabled.
> Page text is processed locally and never transmitted.
- [ ] A többi kategória (personally identifiable info, health, financial, authentication,
      personal communications, location, user activity) **nincs bejelölve**.
- [ ] Mindhárom certification pipálása: nem adjuk el / nem továbbítjuk harmadik félnek jóváhagyott
      eseteken kívül, nem használjuk a bővítmény fő funkciójától eltérő célra, nem használjuk
      hitelképesség-vizsgálatra vagy hitelezésre.
- [ ] **Privacy policy URL:** `https://topwords.eu/privacy`

### Listing
- [ ] **Nyelv:** a bővítmény felülete magyar, a manifest-leírás angol. Állítsd a listing default
      nyelvét **magyarra** (vagy adj hozzá magyar lokalizált listinget), különben a store-ban
      angolul hirdetett, magyarul működő terméket látnak a felhasználók.
      Az 1.28 óta a popup súgó-modálja **HU/EN kapcsolóval** kétnyelvű, tehát a reviewer a
      bővítményen belül is angolul olvashat mindent — a listing nyelvi döntése ettől független.
- [ ] Képernyőképek (1280×800 vagy 640×400), legalább 1 db, ideálisan 3–5. **Csak létező funkciót
      mutass** — nem létező funkciót bemutató kép elutasítási ok, és az 1.29 óta ezek NEM
      készíthetők: „szó-popup egy cikken", oldal-kiemelés, ikon-badge számláló. Használható jelenetek:
      1. YouTube-felirat sáv szóval és nyitott fordítás-popuppal;
      2. Netflix-felirat sáv;
      3. popup-kereső találattal és kinyitott részletezővel (1.30/1.31);
      4. AI-flashcard modál;
      5. `Alt+W` kereső **videó fölött** (YouTube/Netflix — máshol nem él).
- [ ] Kategória, rövid leírás, promo-szöveg.
- [ ] A fejlesztői fiók **egyszeri 5 USD díja** befizetve, és a **publisher kapcsolattartó e-mail
      megerősítve** (enélkül nem publikálható).
- [ ] Első beküldésnél a review általában néhány nap. Az 1.29 óta **nincs széles hozzáférés**, ezért
      a korábban várt, hetekre nyúló manuális felülvizsgálat okafogyott.

---

## 4. Publikálás után

- [ ] **`CHROME_WEB_STORE_URL` beállítása a prod `.env`-ben — ez az EGYETLEN teendő.**
      A store-link 2026-07-29 óta egy env-kulcsból jön ([config/extension.php](config/extension.php)),
      és Inertia shared propként (`extensionStoreUrl`) jut el minden felületre: a dashboard
      bővítmény-bannerére, a sidebar „Chrome bővítmény" menüpontjára, a landing
      bővítmény-blokkjára és a kézikönyv „Telepítés" szekciójára. Amíg üres, mindegyik
      „hamarosan" állapotot mutat; beállítva mindegyik a store-listingre visz. Kód-módosítás
      nem kell hozzá, csak `php artisan config:cache` a deploy után.
- [ ] A [downloads.tsx](resources/js/pages/downloads.tsx) admin-only oldal maradhat így: ez a
      fejlesztői .zip és a Player-buildek egyetlen helye (tartaléknak is jó).
- [ ] A store-verzió és a repóbeli `manifest.json` verzió szinkronban tartása minden kiadásnál
      (a `build-zip.sh` a manifestből veszi a zip nevét).

---

## 5. Tudatosan vállalt kockázatok (nem teendő, csak legyen kimondva)

- **YouTube-felirat szerveroldali letöltése** és **Netflix-felirat olvasása**: a review ezt jellemzően
  átengedi (több hasonló bővítmény fut a store-ban), de a platformok saját felhasználási feltételei
  alapján panasz-alapú levétel kockázata megmarad. Az ÁSZF 8. pontja emiatt mondja ki, hogy a
  Szolgáltató nem áll kapcsolatban ezekkel a szolgáltatókkal, és hogy a felhasználó felel az adott
  oldal feltételeinek betartásáért.
- **A YouTube/Netflix a leírás explicit magja lett.** Az 1.29-cel a széles hozzáférés elesett, de a
  felirat-funkció így a bejelentett fő cél — a fenti platform-kockázat tehát nem csökkent.
- **A funkciókör szűkült az 1.28-hoz képest.** Általános oldalon már nincs kiemelés és nincs
  dupla-kattintásos keresés, csak jobb gombos menü és popup-kereső. Ha ez a store-listingben túl
  kevésnek bizonyul, a visszaút készen áll (`ext-1.28-all-urls` tag), de azzal visszatér a
  manuális felülvizsgálat kockázata is.

---

## 6. Policy-megfelelés — bizonyítékok a dashboard mezőihez

A 2026-07-28-i ellenőrzés eredménye, **2026-08-08-án újrafuttatva az 1.31-es csomagon**. Minden sor
áll; egyetlen tétel változott érdemben: a `<all_urls>` sor **megszűnt** (1.29). Az `1.31`-es zip
tartalma **hash-szinten egyezik** a repóbeli forrással (mind a 13 szöveges fájl), és 16 fájlt
tartalmaz. A parancsok újrafuttathatók a `chrome-extension/` könyvtárból, ha a csomag változik.

### Összefoglaló

| Store-szabály | Állapot | Bizonyíték |
|---|---|---|
| Távoli kód futtatása tilos (MV3) | ✅ tiszta | Nincs `eval`, `new Function`, dinamikus `import()`, `document.write`, `.src=` értékadás, külső `<script>`. A csomagon kívüli hoszt-hivatkozás nulla (a két `google.com` találat sima `<a href>` link: `src/lookup-popup.js:430`, `src/search-modal.js:314`). |
| Obfuszkáció tilos | ✅ tiszta | Nulla minifikálás, nulla bundler — a 16 fájl forrásként megy fel, kommentekkel. |
| Leírás = valós működés | ✅ tiszta | Az 1.29-cel a `description` is szűkült: „English word lookup in YouTube and Netflix subtitles, with optional AI explanations and vocabulary progress tracking." Mind a három állítása implementált, és a leírás **nem** ígér oldalankénti keresést. |
| Kulcsszó-halmozás tilos | ✅ tiszta | Egy mondat, ismételt kulcsszó nélkül. |
| Böngésző-beállítás módosítása | ✅ tiszta | A manifestben nincs `chrome_settings_overrides`, `chrome_url_overrides`, `webRequest`, `declarativeNetRequest`, `cookies`, `history`, `tabs`, `scripting`, `web_accessible_resources`, `externally_connectable`. Minden oldalt módosító funkció **alapból kikapcsolva** indul (`ytLyricsEnabled`, `ytTranscriptEnabled`, `nfxLyricsEnabled` → `false`). |
| Széles hozzáférés | ✅ **megszűnt** (1.29) | A content script már csak `https://www.youtube.com/*` és `https://www.netflix.com/*` alatt fut; a `host_permissions` egyetlen sor: `https://topwords.eu/*`. Lásd lent. |
| Működő fizetés | ✅ nem feltétel | A store nem követeli meg; a saját fizetés (Stripe a topwords.eu-n) amúgy is kívül van a bővítményen, a store saját fizetési API-ja megszűnt. Fizetés nélkül is teljes értékű a bővítmény. |

### Az újrafuttatható ellenőrzések

```bash
cd chrome-extension

# 1. Távoli kód / külső hoszt
#    Elvárt kimenet: az első parancsból EGYETLEN sor, a popup saját, csomagon belüli
#    scriptje (popup.html: <script src="popup.js">); a másodikból csak a két google.com
#    találat, amelyek <a href> linkek — semmi más külső hoszt.
grep -rnE "\beval\(|new Function|import\(|document\.write|\.src\s*=|<script" --include="*.js" --include="*.html" src/ background.js popup.js popup.html
grep -rnoE "https?://[a-zA-Z0-9.-]+" --include="*.js" --include="*.html" src/ background.js popup.js popup.html | grep -v topwords.eu | sort -u

# 2. Beállítás-felülírás és invazív engedélyek (elvárt: exit 1, nincs találat)
grep -nE "chrome_settings_overrides|chrome_url_overrides|declarativeNetRequest|webRequest|\"cookies\"|\"history\"|\"tabs\"|\"scripting\"|web_accessible_resources|externally_connectable|all_urls" manifest.json

# 3. Opt-in alapértékek (elvárt: mind `false`)
#    A `hlEnabled` SZÁNDÉKOSAN nincs a listán: az oldal-kiemelés az 1.29-cel kivezetve, a
#    src/page-highlight.js nem kerül a csomagba (a build-zip.sh FILES tömbje a hiteles lista).
grep -rn "ytLyricsEnabled: false\|nfxLyricsEnabled: false\|ytTranscriptEnabled: false" src/

# 4. A feltöltendő zip = a repóbeli forrás (elvárt: csak a "zip-diff kész" sor)
for f in manifest.json background.js popup.js popup.html popup.css src/*.js; do
    [[ "$f" == "src/page-highlight.js" ]] && continue
    a=$(shasum -a 256 "$f" | cut -d' ' -f1)
    b=$(unzip -p topwords-extension-1.31.zip "$f" | shasum -a 256 | cut -d' ' -f1)
    [[ "$a" != "$b" ]] && echo "ELTÉR: $f"
done; echo "zip-diff kész"
```

### Hozzáférés-terjedelem — a korábbi fő kockázat megszűnt

Az 1.28-ig a csomag `<all_urls>` content scriptet tartalmazott, ami miatt a Google manuális
felülvizsgálat alá vonta volna a bővítményt (az első közzétételt hetekkel késleltetve). **Az 1.29
(`4d7dd2a`) ezt kivezette.** A mai állapot:

- a content script **két konkrét hoszt** alatt fut: `https://www.youtube.com/*`, `https://www.netflix.com/*`;
- a `host_permissions` **egyetlen** sor: `https://topwords.eu/*` — a service worker máshová nem hívhat;
- nincs `scripting` permission → futásidőben sem tud máshová injektálni;
- nincs `web_accessible_resources` és `externally_connectable` → az oldalak nem is látják a bővítményt;
- a felirat szövege **helyben marad**, csak a felhasználó által kikeresett szó megy a szerverre;
- általános oldalon a bővítmény **egyáltalán nem fut** — ott csak a jobb gombos menü és a
  popup-kereső él, mindkettő felhasználói gesztussal, `activeTab` alatt.

**Justification a dashboardra (bemásolható):**
> The extension's subtitle lookup has to read the subtitle line rendered inside the video player, so
> its content script is declared for exactly two sites — youtube.com and netflix.com — and for
> nothing else. Subtitle text is parsed locally in the browser and is never transmitted: only the
> individual word the user clicks is sent, and only to the extension's own backend
> (`https://topwords.eu`, the single declared host permission). On all other sites the extension
> does not run at all; the user can still look a word up through the toolbar popup's search box or
> the right-click menu, both of which require an explicit user gesture. The extension declares no
> `scripting`, `tabs`, `webRequest`, `cookies` or `history` permission, no `web_accessible_resources`
> and no `externally_connectable`, and both subtitle features are off by default and switched on by
> the user with the **TW** button in the player.

**Ha a szűkítés miatt a funkciókör kevésnek bizonyul:** a teljes 1.28-as, `<all_urls>`-ös állapot az
`ext-1.28-all-urls` tagon van, a visszahozás egy manifest-bejegyzés (`src/page-highlight.js` a
repóban maradt). A második lépcső — `optional_host_permissions` + a content script dinamikus
regisztrálása (`chrome.scripting.registerContentScripts`) a felhasználó engedélye után — most
**nem szükséges**, mert nincs mit szűkíteni.
