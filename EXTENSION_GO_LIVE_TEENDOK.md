# Bővítmény go-live teendők (Chrome Web Store)

**Készült:** 2026-07-28 · **Frissítve:** 2026-07-29 · **Bővítmény verzió:** 1.28 · **Commit:** `db7b6a2`
(pusholva a `main`-re)

A kód- és jogi oldali javítások megtörténtek (AI-tájékoztatás, felelősség-kizárás, ÁSZF/Adatvédelem,
manifest-korlát, `isTrusted`-guard). Ez a lista **csak azt tartalmazza, ami még hátravan** — abban a
sorrendben, ahogy érdemes haladni.

**1.25 óta:** 1.26 — az oldal-kiemelés SPA-navigáció után is megmarad (MutationObserver);
1.27 — a kiemelés YouTube/Netflix alatt betöltéskor inaktív marad; 1.28 — popup-arculat az app
lila témájához igazítva + kétnyelvű (HU/EN) súgó-modál a szétszórt tippek helyett.

---

## 0. Élesítés (most azonnal)

- [ ] **Ploi → Deploy** megnyomása a topwords.eu site-on. A Quick Deploy ki van kapcsolva, ezért a
      push önmagában nem élesít. Ezzel megy ki: a frissített ÁSZF, Adatkezelési tájékoztató és a
      letöltési oldalról szolgált **1.28-as zip**.
- [ ] Deploy után ellenőrizd élesben: `https://topwords.eu/terms` (7. és 8. pont látszik),
      `https://topwords.eu/privacy` (6. pont: AI), és a Letöltések oldalon a zip letöltése
      (**a Letöltések 2026-07-29 óta admin-only** — az admin fiókoddal nézd).

---

## 1. Blokkolók — enélkül a store elutasít vagy jogilag sérülékeny vagy

- [ ] **Teszt-fiók a review-nak.** A bővítmény bejelentkezés nélkül üres felületet ad, a Google
      reviewere pedig nem regisztrál. A Developer Dashboard **„Account is required / test
      credentials"** mezőjébe adj meg egy **megerősített e-mailű** teszt-fiókot (e-mail + jelszó),
      és írd le 2–3 mondatban a próbafolyamatot:
      *„Sign in at https://topwords.eu/login with the credentials above, open any English article,
      then double-click a word or press Alt+W."*
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

Ezek bemásolhatók. (Feltöltendő csomag: `chrome-extension/topwords-extension-1.28.zip`)

### Single purpose
> TopWords helps Hungarian learners of English build vocabulary: it looks up English words on any
> web page and in YouTube/Netflix subtitles, and syncs the user's learning status with their
> topwords.eu account.

### Permission justifications
| Engedély | Indoklás (angolul, bemásolható) |
|---|---|
| `activeTab` | Used only when the user opens the toolbar popup, to compute word statistics for the page the user is currently viewing and to toggle highlighting on it. |
| `contextMenus` | Adds two right-click entries: look up the selected English word, and open the current page in the text analyser. |
| `storage` | Stores the user's own local settings (highlighting on/off, subtitle features on/off) and a short-lived cache of the user's word-status map, so it is not re-downloaded on every page. |
| `https://topwords.eu/*` (host) | The extension's only backend. Word lookups, status updates and flashcards are sent to the user's own topwords.eu account over HTTPS. |
| `<all_urls>` content script | Word lookup and highlighting must work on any page the user reads. Page text is processed locally in the browser and is never transmitted. |
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
- [ ] Képernyőképek (1280×800 vagy 640×400), legalább 1 db, ideálisan 3–5: szó-popup egy cikken,
      YouTube-felirat sáv, kereső (Alt+W), AI-flashcard.
- [ ] Kategória, rövid leírás, promo-szöveg.
- [ ] A fejlesztői fiók **egyszeri 5 USD díja** befizetve, és a **publisher kapcsolattartó e-mail
      megerősítve** (enélkül nem publikálható).
- [ ] Első beküldésnél a review általában néhány nap; a `<all_urls>` miatt lehet hosszabb.

---

## 4. Publikálás után

- [ ] **Store-link kivezetése a felhasználói felületekre.** 2026-07-29 óta a letöltés
      `can:admin` mögött van, a felhasználói felületek pedig „hamarosan a Chrome Web
      Store-ban" szöveget mutatnak. Publikálás után ezeket kell store-linkre cserélni:
      a landing bővítmény-blokkja ([welcome.tsx](resources/js/pages/welcome.tsx)), a kézikönyv
      `#extension` → „Telepítés" szekciója ([handbook.tsx](resources/js/pages/handbook.tsx)),
      az onboarding extension-diája ([onboarding/index.tsx](resources/js/pages/onboarding/index.tsx))
      és az onboarding-tour bővítmény-lépése
      ([onboarding-tour.tsx](resources/js/components/onboarding-tour.tsx)).
      A dashboard `<ExtensionBanner />`-e is ki van kommentelve
      ([dashboard.tsx](resources/js/pages/dashboard.tsx)) — a store-linkkel élesíthető újra.
- [ ] A [downloads.tsx](resources/js/pages/downloads.tsx) admin-only oldal maradhat így: ez a
      friss buildek egyetlen helye (a zip tartaléknak is jó).
- [ ] A store-verzió és a repóbeli `manifest.json` verzió szinkronban tartása minden kiadásnál
      (a `build-zip.sh` a manifestből veszi a zip nevét).

---

## 5. Tudatosan vállalt kockázatok (nem teendő, csak legyen kimondva)

- **YouTube-felirat szerveroldali letöltése** és **Netflix-felirat olvasása**: a review ezt jellemzően
  átengedi (több hasonló bővítmény fut a store-ban), de a platformok saját felhasználási feltételei
  alapján panasz-alapú levétel kockázata megmarad. Az ÁSZF 8. pontja emiatt mondja ki, hogy a
  Szolgáltató nem áll kapcsolatban ezekkel a szolgáltatókkal, és hogy a felhasználó felel az adott
  oldal feltételeinek betartásáért.
- **A store bármikor kérhet további indoklást** a `<all_urls>` content scriptre. A védekezés kész:
  az oldalak szövege soha nem hagyja el a böngészőt, csak a keresett szó megy a szerverre.

---

## 6. Policy-megfelelés — bizonyítékok a dashboard mezőihez

A 2026-07-28-i ellenőrzés eredménye, **2026-07-29-én újrafuttatva az 1.27-es csomagon — minden
sor változatlanul áll** (a 3 opt-in alapérték, a nulla külső hoszt és a nulla invazív engedély is).
A parancsok újrafuttathatók a `chrome-extension/` könyvtárból, ha a csomag változik.

### Összefoglaló

| Store-szabály | Állapot | Bizonyíték |
|---|---|---|
| Távoli kód futtatása tilos (MV3) | ✅ tiszta | Nincs `eval`, `new Function`, dinamikus `import()`, `document.write`, `.src=` értékadás, külső `<script>`. A csomagon kívüli hoszt-hivatkozás nulla (a két `google.com` találat sima `<a href>` link: `src/lookup-popup.js:430`, `src/search-modal.js:314`). |
| Obfuszkáció tilos | ✅ tiszta | Nulla minifikálás, nulla bundler — a 17 fájl forrásként megy fel, kommentekkel. |
| Leírás = valós működés | ✅ tiszta | A 129 karakteres leírás mind a négy állítása implementált (oldalankénti keresés, YouTube/Netflix felirat, opcionális AI, haladáskövetés). |
| Kulcsszó-halmozás tilos | ✅ tiszta | Egy mondat, ismételt kulcsszó nélkül. |
| Böngésző-beállítás módosítása | ✅ tiszta | A manifestben nincs `chrome_settings_overrides`, `chrome_url_overrides`, `webRequest`, `declarativeNetRequest`, `cookies`, `history`, `tabs`, `scripting`. Minden látható funkció **alapból kikapcsolva** indul (`hlEnabled`, `ytLyricsEnabled`, `ytTranscriptEnabled`, `nfxLyricsEnabled` → `false`). |
| Széles hozzáférés (`<all_urls>`) | ⚠️ **manuális felülvizsgálat** | Lásd lent. |
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
grep -nE "chrome_settings_overrides|chrome_url_overrides|declarativeNetRequest|webRequest|\"cookies\"|\"history\"|\"tabs\"|\"scripting\"" manifest.json

# 3. Opt-in alapértékek (elvárt: mind `false`)
grep -rn "hlEnabled: false\|ytLyricsEnabled: false\|nfxLyricsEnabled: false\|ytTranscriptEnabled: false" src/
```

### `<all_urls>` — ez az egyetlen valós kockázat

A széles hozzáférés miatt a Google manuális felülvizsgálat alá vonja a bővítményt, ami az első
közzétételt **hetekkel is késleltetheti**. Fontos pontosítás: nálunk ez **csak
`content_scripts.matches`, nem `host_permissions`** — a `host_permissions` szigorúan
`https://topwords.eu/*`. A telepítési figyelmeztetést ez is kiváltja, de a védekezés erős:

- a service worker **kizárólag a topwords.eu-t hívhatja** (egyetlen host permission);
- nincs `scripting` permission → máshova nem tud injektálni;
- nincs `web_accessible_resources` és `externally_connectable` → az oldalak nem is látják a bővítményt;
- az oldalak szövege **helyben marad**, csak a keresett szó megy a szerverre.

**Justification a dashboardra (bemásolható):**
> The extension's core function is looking up English words while the user reads, so the content
> script must run on the page the user is currently reading — the user cannot know in advance which
> sites those will be. Page text is parsed locally in the browser and is never transmitted: only the
> individual word the user explicitly looks up is sent, and only to the extension's own backend
> (`https://topwords.eu`, the single declared host permission). The extension declares no
> `scripting`, `tabs`, `webRequest`, `cookies` or `history` permission, no
> `web_accessible_resources` and no `externally_connectable`, and all page-modifying features
> (highlighting, subtitle overlays) are off by default and switched on by the user.

**Alternatíva, ha a review elhúzódik:** `activeTab` + `optional_host_permissions`, és a content
script dinamikus regisztrálása (`chrome.scripting.registerContentScripts`) a felhasználó engedélye
után. Gyorsabb review, viszont elveszik az „automatikusan mindenhol működik" élmény, és érdemi
átépítés. **Alapesetben nem javasolt** — inkább vállaljuk a hosszabb első reviewt.
