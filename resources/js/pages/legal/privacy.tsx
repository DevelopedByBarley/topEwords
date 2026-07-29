import { Head, Link } from '@inertiajs/react';
import { LegalPage } from '@/components/public/legal-page';
import type { LegalSection } from '@/components/public/legal-page';
import { terms } from '@/routes';

const SECTIONS: LegalSection[] = [
    { id: 'adatkezelo', title: '1. Adatkezelő' },
    { id: 'kezelt-adatok', title: '2. Kezelt adatok és céljaik' },
    { id: 'megorzes', title: '3. Adatmegőrzési idő' },
    { id: 'adatbiztonsag', title: '4. Adatbiztonság' },
    { id: 'adatfeldolgozok', title: '5. Adattovábbítás, adatfeldolgozók' },
    { id: 'ai', title: '6. Mesterséges intelligencia (AI) használata' },
    { id: 'bovitmeny', title: '7. Böngészőbővítmény (Chrome extension)' },
    { id: 'sutik', title: '8. Sütik (cookie-k)' },
    { id: 'jogok', title: '9. A Felhasználó jogai (GDPR)' },
    { id: 'kapcsolat', title: '10. Kapcsolat' },
];

export default function Privacy() {
    return (
        <>
            <Head title="Adatkezelési Tájékoztató – TopWords">
                <meta
                    head-key="description"
                    name="description"
                    content="A TopWords szókincsfejlesztő alkalmazás adatkezelési tájékoztatója – GDPR-kompatibilis adatvédelmi szabályzat."
                />
                <meta
                    head-key="robots"
                    name="robots"
                    content="noindex, follow"
                />
            </Head>

            <LegalPage
                title="Adatkezelési tájékoztató"
                effectiveFrom="2026. július 28-tól"
                sections={SECTIONS}
            >
                <div className="prose max-w-none space-y-8 text-sm leading-relaxed text-foreground prose-neutral dark:prose-invert">
                    <section id="adatkezelo" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            1. Adatkezelő
                        </h2>
                        <div className="rounded-xl border bg-card p-4 text-muted-foreground">
                            <p>
                                <strong className="text-foreground">
                                    Neve:
                                </strong>{' '}
                                Szaniszló Árpád egyéni vállalkozó (CodeBarley)
                            </p>
                            <p>
                                <strong className="text-foreground">
                                    Székhely:
                                </strong>{' '}
                                3881 Abaújszántó, Aranyosi út 3.
                            </p>
                            <p>
                                <strong className="text-foreground">
                                    Nyilvántartási szám:
                                </strong>{' '}
                                58300488
                            </p>
                            <p>
                                <strong className="text-foreground">
                                    Adószám:
                                </strong>{' '}
                                45715428-1-25
                            </p>
                            <p>
                                <strong className="text-foreground">
                                    Weboldala:
                                </strong>{' '}
                                <a
                                    href="https://codebarley.hu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    codebarley.hu
                                </a>
                            </p>
                            <p>
                                <strong className="text-foreground">
                                    Kapcsolat:
                                </strong>{' '}
                                <a
                                    href="mailto:info@topwords.eu"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    info@topwords.eu
                                </a>
                            </p>
                            <p className="mt-2 text-xs">
                                A jelen tájékoztató a{' '}
                                <strong className="text-foreground">
                                    TopWords
                                </strong>{' '}
                                alkalmazás (topwords.eu) és
                                böngészőbővítményének felhasználói személyes
                                adatai kezelésére vonatkozik, összhangban az
                                Európai Unió Általános Adatvédelmi Rendeletével
                                (GDPR – 2016/679/EU rendelet) és a hatályos
                                magyar adatvédelmi jogszabályokkal.
                            </p>
                        </div>
                    </section>

                    <section id="kezelt-adatok" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            2. Kezelt adatok és céljaik
                        </h2>
                        <div className="overflow-hidden rounded-xl border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">
                                            Adat
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium">
                                            Cél
                                        </th>
                                        <th className="px-4 py-3 text-left font-medium">
                                            Jogalap
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-muted-foreground">
                                    <tr>
                                        <td className="px-4 py-3">
                                            E-mail-cím
                                        </td>
                                        <td className="px-4 py-3">
                                            Regisztráció, bejelentkezés,
                                            értesítések
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés teljesítése
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Jelszó (titkosítva)
                                        </td>
                                        <td className="px-4 py-3">
                                            Hitelesítés
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés teljesítése
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Szótanulási adatok
                                        </td>
                                        <td className="px-4 py-3">
                                            Haladás nyomon követése (tudom /
                                            tanulom / később)
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés teljesítése
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Napi aktivitás (streak)
                                        </td>
                                        <td className="px-4 py-3">
                                            Tanulási sorozat megjelenítése
                                        </td>
                                        <td className="px-4 py-3">
                                            Jogos érdek
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Mappa adatok
                                        </td>
                                        <td className="px-4 py-3">
                                            Szavak rendszerezése mappákba
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés teljesítése
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Saját szavak, flashcardok
                                        </td>
                                        <td className="px-4 py-3">
                                            Egyéni szótár és kártyák tárolása
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés teljesítése
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Szövegelemzés tartalma (beillesztett
                                            szöveg, megadott URL,
                                            YouTube-felirat, feltöltött könyv)
                                        </td>
                                        <td className="px-4 py-3">
                                            Szövegelemzés és AI-funkciók
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés teljesítése
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Előfizetési adatok (név, e-mail,
                                            előfizetési állapot)
                                        </td>
                                        <td className="px-4 py-3">
                                            Előfizetés kezelése, számlázás
                                        </td>
                                        <td className="px-4 py-3">
                                            Szerződés / jogi kötelezettség
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Számlázási adatok (számlázási név,
                                            cím, adószám)
                                        </td>
                                        <td className="px-4 py-3">
                                            Jogszabály szerinti számla
                                            kiállítása és megőrzése
                                        </td>
                                        <td className="px-4 py-3">
                                            Jogi kötelezettség
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3">
                                            Technikai naplóadatok (IP-cím,
                                            időbélyeg, hibanapló)
                                        </td>
                                        <td className="px-4 py-3">
                                            Üzembiztonság, hibakeresés,
                                            visszaélés- és túlterhelés-megelőzés
                                        </td>
                                        <td className="px-4 py-3">
                                            Jogos érdek
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-muted-foreground">
                            Az Adatkezelő nem gyűjt különleges kategóriájú
                            (érzékeny) személyes adatot, és nem végez
                            automatizált döntéshozatalt vagy profilalkotást.
                        </p>
                    </section>

                    <section id="megorzes" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            3. Adatmegőrzési idő
                        </h2>
                        <p className="text-muted-foreground">
                            Az adatokat addig kezeljük, amíg a Felhasználó
                            fiókja aktív, illetve amíg a Felhasználó törlési
                            kérést nem nyújt be. Fiók törlése esetén az összes
                            személyes adat véglegesen és visszavonhatatlanul
                            törlésre kerül a rendszerből, a jogszabályi
                            kötelezettségek alapján kötelezően megőrizendő
                            adatok kivételével.
                        </p>
                        <p className="mt-2 text-muted-foreground">
                            A kiállított számlák adatait a számvitelről szóló
                            2000. évi C. törvény alapján a Szolgáltató a
                            kiállítástól számított 8 évig megőrzi. A technikai
                            naplóadatokat (IP-cím, hibanapló) a hibakereséshez
                            és az üzembiztonsághoz szükséges ideig, legfeljebb
                            12 hónapig kezeljük.
                        </p>
                    </section>

                    <section id="adatbiztonsag" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            4. Adatbiztonság
                        </h2>
                        <p className="mb-2 text-muted-foreground">
                            Az Adatkezelő az adatok védelme érdekében:
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                            <li>
                                titkosított jelszótárolást (bcrypt) alkalmaz;
                            </li>
                            <li>HTTPS protokollon keresztül kommunikál;</li>
                            <li>
                                csak a szükséges mértékben és ideig tárolja az
                                adatokat;
                            </li>
                            <li>
                                az adatbázishoz csak az arra feljogosított
                                személyek férnek hozzá.
                            </li>
                        </ul>
                    </section>

                    <section id="adatfeldolgozok" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            5. Adattovábbítás, adatfeldolgozók
                        </h2>
                        <p className="mb-2 text-muted-foreground">
                            Az Adatkezelő a személyes adatokat{' '}
                            <strong className="text-foreground">
                                nem adja el
                            </strong>
                            , és harmadik félnek kizárólag a szolgáltatás
                            nyújtásához szükséges mértékben, az alábbi
                            adatfeldolgozók részére továbbítja:
                        </p>
                        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                            <li>
                                <strong className="text-foreground">
                                    Stripe
                                </strong>{' '}
                                (fizetés feldolgozása) – Stripe Payments Europe,
                                Ltd. (Írország) / Stripe, Inc. (USA). Előfizetés
                                esetén a neved és e-mail-címed kerül
                                továbbításra; a{' '}
                                <strong className="text-foreground">
                                    kártyaadatokat közvetlenül a Stripe kezeli
                                </strong>
                                , azokat nem tároljuk.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Google (Gemini API)
                                </strong>{' '}
                                (AI-funkciók) – Google Ireland Ltd. / Google LLC
                                (USA). Az AI-alapú szómagyarázat és
                                flashcard-generálás során a vizsgált szót,
                                illetve a megadott szövegrészt feldolgozásra a
                                Google felé továbbítjuk.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Billingo
                                </strong>{' '}
                                (számlázás) – Billingo Technologies Zrt.
                                (Magyarország). Fizetős előfizetés esetén a
                                számla kiállításához szükséges adatok
                                (számlázási név, cím, e-mail-cím, adószám, a
                                szolgáltatás megnevezése és díja) kerülnek
                                továbbításra.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Tárhely- és levelezési szolgáltató
                                </strong>{' '}
                                – Rackhost Informatikai Zrt. (székhely: 6722
                                Szeged, Tisza Lajos körút 41., Magyarország) – a
                                szerver üzemeltetése, az adatok tárolása és a
                                rendszerüzenetek (e-mailek) kiküldése céljából.
                                Az adatok az Európai Unió területén tárolódnak.
                            </li>
                        </ul>
                        <p className="mt-3 text-muted-foreground">
                            Egyes szolgáltatók (pl. Stripe, Google) az Európai
                            Gazdasági Térségen kívül (pl. USA) is kezelhetnek
                            adatot; ilyen továbbítás kizárólag a GDPR szerinti
                            megfelelő garanciákkal (pl. EU–USA adatvédelmi
                            keret, általános szerződési feltételek – SCC)
                            történik.
                        </p>
                        <p className="mt-3 text-muted-foreground">
                            Az alkalmazás{' '}
                            <strong className="text-foreground">nem</strong>{' '}
                            tartalmaz hirdetési vagy nyomkövető technológiát
                            (pl. Facebook Pixel, Google Analytics), és adatot
                            jogszabályi kötelezettségen kívül (pl. hatósági
                            megkeresés) nem ad át.
                        </p>
                    </section>

                    <section id="ai" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            6. Mesterséges intelligencia (AI) használata
                        </h2>
                        <div className="rounded-xl border bg-card p-4 text-muted-foreground">
                            <p className="text-foreground">
                                <strong>
                                    A Szolgáltatás AI-funkciókat kínál
                                </strong>{' '}
                                (AI szó-kitöltés, AI-flashcard, AI-szómagyarázat
                                és a szövegelemző AI-funkciói) – mind a
                                weboldalon, mind a böngészőbővítményben.
                            </p>
                        </div>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
                            <li>
                                <strong className="text-foreground">
                                    Mi kerül továbbításra:
                                </strong>{' '}
                                kizárólag a vizsgált angol szó, illetve a
                                Felhasználó által megadott szövegrészlet – a
                                topwords.eu szerverén keresztül a{' '}
                                <strong className="text-foreground">
                                    Google (Gemini API)
                                </strong>{' '}
                                felé. Fiókazonosítót, e-mail-címet vagy más
                                azonosító adatot az AI-szolgáltató felé nem
                                küldünk.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Gyorsítótár:
                                </strong>{' '}
                                a szó szintű AI-válaszokat felhasználótól
                                függetlenül, a szóhoz rendelve tároljuk, hogy
                                ugyanarra a szóra ne kelljen újra AI-hívást
                                indítani. Ez a gyorsítótár személyes adatot nem
                                tartalmaz.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Az AI-funkciók használata önkéntes:
                                </strong>{' '}
                                csak akkor indul AI-hívás, ha a Felhasználó
                                kifejezetten rákattint az adott AI-gombra.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Automatizált döntéshozatal nincs:
                                </strong>{' '}
                                az AI kizárólag tanulási tartalmat állít elő, a
                                Felhasználóra nézve joghatással járó vagy őt
                                hasonlóan jelentős mértékben érintő automatizált
                                döntést nem hozunk.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Ne adj meg érzékeny adatot!
                                </strong>{' '}
                                Az AI-funkciók szabad szöveges mezőibe
                                személyes, érzékeny vagy bizalmas adatot ne írj
                                be.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Felelősség:
                                </strong>{' '}
                                az AI által generált tartalom hibás vagy
                                félrevezető lehet; a Szolgáltató a külső
                                AI-szolgáltató által generált tartalom
                                helyességéért felelősséget nem vállal (részletek
                                az{' '}
                                <Link
                                    href={terms()}
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    ÁSZF 7. pontjában
                                </Link>
                                ).
                            </li>
                        </ul>
                    </section>

                    <section id="bovitmeny" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            7. Böngészőbővítmény (Chrome extension)
                        </h2>
                        <p className="mb-2 text-muted-foreground">
                            A TopWords Chrome böngészőbővítményt is kínál, amely
                            lehetővé teszi az angol szavak azonnali keresését és
                            a haladás követését bármely weboldalon. A bővítmény{' '}
                            <strong className="text-foreground">
                                nem gyűjt adatot a saját céljaira
                            </strong>
                            , kizárólag a bejelentkezett fiókod és a topwords.eu
                            szerver között közvetít. A bővítmény adatkezelése:
                        </p>
                        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                            <li>
                                <strong className="text-foreground">
                                    Oldalak tartalma:
                                </strong>{' '}
                                a meglátogatott weboldalak szövegét a bővítmény
                                kizárólag a böngésződben, helyben dolgozza fel
                                (az ismert szavak kiemeléséhez és az
                                oldal-statisztikához). Az oldalak teljes
                                tartalmát{' '}
                                <strong className="text-foreground">
                                    nem küldjük el
                                </strong>{' '}
                                és nem tároljuk szervereinken.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Keresett szavak:
                                </strong>{' '}
                                amikor egy szóra rákeresel vagy státuszt
                                állítasz be, kizárólag az adott angol szót és a
                                választott státuszt küldi el a bővítmény a
                                topwords.eu szervernek a jelentés lekéréséhez és
                                a haladásod mentéséhez.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Bejelentkezés:
                                </strong>{' '}
                                a bővítmény a meglévő, bejelentkezett
                                munkamenetedet (session cookie) használja a
                                topwords.eu felé. Külön jelszót vagy hozzáférést
                                nem tárol.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Helyi beállítások:
                                </strong>{' '}
                                a bővítmény a böngésződ helyi tárolójában (
                                <code>chrome.storage.local</code>) kizárólag a
                                saját beállításaidat őrzi (pl. kiemelés be/ki,
                                YouTube-felirat be/ki). Ezek nem hagyják el az
                                eszközödet.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Oldal címe (URL):
                                </strong>{' '}
                                csak akkor küldjük el a szervernek, ha te magad
                                indítod az „Oldal szövegelemzése" műveletet (a
                                bővítmény ablakából vagy a jobb gombos menüből).
                                Ilyenkor a megnyitott oldal URL-je kerül át a
                                topwords.eu szövegelemzőjébe.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    YouTube-feliratok:
                                </strong>{' '}
                                ha bekapcsolod a felirat-funkciót, a videó
                                azonosítója (video ID) kerül a szerverünkhöz,
                                amely lekéri a videó feliratát. Böngészési
                                előzményt nem gyűjtünk, más oldalak
                                megtekintését nem naplózzuk. A
                                Netflix-feliratokat a bővítmény kizárólag
                                helyben, a böngésződben olvassa.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    AI-funkciók:
                                </strong>{' '}
                                ha AI-alapú kitöltést használsz a bővítményben,
                                az adott szót a topwords.eu szerverén keresztül
                                a Google (Gemini) felé továbbítjuk a tartalom
                                legenerálásához (lásd 5. és 6. pont). Az AI
                                generálta tartalom hibázhat – felhasználás előtt
                                ellenőrizd.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Nincs követés:
                                </strong>{' '}
                                a bővítmény nem tartalmaz hirdetést, analitikát
                                vagy nyomkövetőt, és az adatokat nem adja el
                                harmadik félnek.
                            </li>
                        </ul>
                    </section>

                    <section id="sutik" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            8. Sütik (cookie-k)
                        </h2>
                        <p className="mb-2 text-muted-foreground">
                            Az alkalmazás kizárólag a működéshez szükséges
                            sütiket használ: a munkamenet-sütit (session cookie)
                            és a CSRF-védelmi sütit, amelyek a bejelentkezési
                            állapot fenntartásához, illetve a biztonságos
                            űrlapküldéshez szükségesek. Ha a bejelentkezéskor az
                            „Emlékezz rám" lehetőséget választod, a böngésződ
                            egy hosszabb élettartamú, kizárólag erre a célra
                            szolgáló sütit is eltárol. Ezekhez a sütikhez –
                            mivel a szolgáltatás nyújtásához feltétlenül
                            szükségesek – nem kérünk külön hozzájárulást. A
                            sütik a böngésződ beállításaiban bármikor törölhetők
                            (ez kijelentkezést eredményez).
                        </p>
                        <p className="text-muted-foreground">
                            Harmadik féltől származó sütit az alkalmazás nem
                            alkalmaz.
                        </p>
                    </section>

                    <section id="jogok" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            9. A Felhasználó jogai (GDPR)
                        </h2>
                        <p className="mb-2 text-muted-foreground">
                            A Felhasználót az alábbi jogok illetik meg:
                        </p>
                        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                            <li>
                                <strong className="text-foreground">
                                    Hozzáférési jog:
                                </strong>{' '}
                                tájékoztatást kérhet a kezelt adatairól.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Helyesbítési jog:
                                </strong>{' '}
                                kérheti a pontatlan adatok korrigálását (a
                                profilbeállításokban önállóan is elvégezhető).
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Törlési jog („elfeledtetéshez való jog"):
                                </strong>{' '}
                                kérheti valamennyi adata törlését, beleértve a
                                fiók megszüntetését.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Az adatkezelés korlátozásához való jog:
                                </strong>{' '}
                                bizonyos esetekben kérheti az adatkezelés
                                felfüggesztését.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Adathordozhatóság joga:
                                </strong>{' '}
                                kérheti adatait géppel olvasható formátumban.
                            </li>
                            <li>
                                <strong className="text-foreground">
                                    Tiltakozás joga:
                                </strong>{' '}
                                jogos érdeken alapuló adatkezelés ellen
                                tiltakozhat.
                            </li>
                        </ul>
                        <p className="mt-3 text-muted-foreground">
                            Jogait az alábbi kapcsolati ponton érvényesítheti.
                            Panasz esetén fordulhat a{' '}
                            <strong className="text-foreground">
                                Nemzeti Adatvédelmi és Információszabadság
                                Hatósághoz
                            </strong>{' '}
                            (NAIH) is:{' '}
                            <a
                                href="https://naih.hu"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground underline underline-offset-4 hover:no-underline"
                            >
                                naih.hu
                            </a>
                            .
                        </p>
                    </section>

                    <section id="kapcsolat" className="scroll-mt-24">
                        <h2 className="mb-3 text-lg font-semibold">
                            10. Kapcsolat
                        </h2>
                        <p className="text-muted-foreground">
                            Adatkezeléssel kapcsolatos kérdéseivel, kérelmeivel
                            forduljon az Adatkezelőhöz az{' '}
                            <a
                                href="mailto:info@topwords.eu"
                                className="text-foreground underline underline-offset-4 hover:no-underline"
                            >
                                info@topwords.eu
                            </a>{' '}
                            címen, illetve a{' '}
                            <a
                                href="https://codebarley.hu"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground underline underline-offset-4 hover:no-underline"
                            >
                                codebarley.hu
                            </a>{' '}
                            weboldalon elérhető elérhetőségeken. Az Adatkezelő a
                            beérkező kérelmeket 30 napon belül megválaszolja.
                        </p>
                    </section>
                </div>
            </LegalPage>
        </>
    );
}
