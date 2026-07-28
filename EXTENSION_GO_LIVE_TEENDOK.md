# Bővítmény go-live teendők (Chrome Web Store)

**Készült:** 2026-07-28 · **Bővítmény verzió:** 1.25 · **Commit:** `02e6b6e` (pusholva a `main`-re)

A kód- és jogi oldali javítások megtörténtek (AI-tájékoztatás, felelősség-kizárás, ÁSZF/Adatvédelem,
manifest-korlát, `isTrusted`-guard). Ez a lista **csak azt tartalmazza, ami még hátravan** — abban a
sorrendben, ahogy érdemes haladni.

---

## 0. Élesítés (most azonnal)

- [ ] **Ploi → Deploy** megnyomása a topwords.eu site-on. A Quick Deploy ki van kapcsolva, ezért a
      push önmagában nem élesít. Ezzel megy ki: a frissített ÁSZF, Adatkezelési tájékoztató és a
      letöltési oldalról szolgált **1.25-ös zip**.
- [ ] Deploy után ellenőrizd élesben: `https://topwords.eu/terms` (7. és 8. pont látszik),
      `https://topwords.eu/privacy` (6. pont: AI), és a Letöltések oldalon a zip letöltése.

---

## 1. Blokkolók — enélkül a store elutasít vagy jogilag sérülékeny vagy

- [ ] **Teszt-fiók a review-nak.** A bővítmény bejelentkezés nélkül üres felületet ad, a Google
      reviewere pedig nem regisztrál. A Developer Dashboard **„Account is required / test
      credentials"** mezőjébe adj meg egy **megerősített e-mailű** teszt-fiókot (e-mail + jelszó),
      és írd le 2–3 mondatban a próbafolyamatot:
      *„Sign in at https://topwords.eu/login with the credentials above, open any English article,
      then double-click a word or press Alt+W."*
      Ez a leggyakoribb elutasítási ok bejelentkezést igénylő bővítményeknél.

- [ ] **Szolgáltatói cégadatok az ÁSZF-be.** Jelenleg csak név (CodeBarley) + `info@topwords.eu`
      szerepel. Az Ekertv. alapján kötelező a **székhely, adószám, nyilvántartási/cégjegyzékszám**
      (egyéni vállalkozónál: nyilvántartási szám). Ezeket írd meg, és beteszem az ÁSZF 1. pontjába.

- [ ] **Fizetős előfizetés → 14 napos elállás.** Az ÁSZF 9. pontja tartalmazza a szabályt, de a
      kivétel (azonnali teljesítés kérése) csak akkor érvényesíthető, ha a **checkoutban van egy
      kifejezett jelölőnégyzet**: *„Kérem a szolgáltatás azonnali megkezdését, és tudomásul veszem,
      hogy a teljesítés megkezdése után elállási jogomat elveszítem."* Ezt még be kell építeni a
      fizetési folyamatba.

---

## 2. Jogi / adatvédelmi pontosítások

- [ ] **Tárhelyszolgáltató.** Az Adatkezelési tájékoztatóba „Rackhost Zrt. (Magyarország)" került —
      ellenőrizd a pontos cégnevet és székhelyet, és pótold.
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

Ezek bemásolhatók. (Feltöltendő csomag: `chrome-extension/topwords-extension-1.25.zip`)

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
- [ ] Képernyőképek (1280×800 vagy 640×400), legalább 1 db, ideálisan 3–5: szó-popup egy cikken,
      YouTube-felirat sáv, kereső (Alt+W), AI-flashcard.
- [ ] Kategória, rövid leírás, promo-szöveg.
- [ ] A fejlesztői fiók **egyszeri 5 USD díja** befizetve, és a **publisher kapcsolattartó e-mail
      megerősítve** (enélkül nem publikálható).
- [ ] Első beküldésnél a review általában néhány nap; a `<all_urls>` miatt lehet hosszabb.

---

## 4. Publikálás után

- [ ] **Letöltések oldal átállítása.** A [downloads.tsx](resources/js/pages/downloads.tsx) jelenleg
      „béta / fejlesztői módban telepíthető" zip-letöltést kínál. Publikálás után cseréld a
      Chrome Web Store linkre (a zip maradhat tartaléknak).
- [ ] Ugyanez a kézikönyv `#extension` szekciójában és a landing page bővítmény-blokkjában.
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
