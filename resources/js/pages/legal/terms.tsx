import { Head, Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home, pricing, privacy } from '@/routes';

export default function Terms() {
    return (
        <>
            <Head title="Általános Szerződési Feltételek – TopWords">
                <meta
                    head-key="description"
                    name="description"
                    content="A TopWords szókincsfejlesztő alkalmazás általános szerződési feltételei."
                />
                <meta
                    head-key="robots"
                    name="robots"
                    content="noindex, follow"
                />
            </Head>

            <div className="min-h-screen bg-background text-foreground">
                {/* Nav */}
                <header className="border-b">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <Link
                            href={home()}
                            className="flex items-center gap-2.5"
                        >
                            <AppLogoIcon className="size-11 rounded-lg" />
                            <span className="text-sm font-semibold tracking-tight">
                                TopWords
                            </span>
                        </Link>
                        <Link
                            href={home()}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            ← Vissza a főoldalra
                        </Link>
                    </div>
                </header>

                {/* Content */}
                <main className="mx-auto max-w-3xl px-6 py-16">
                    <h1 className="mb-2 text-3xl font-bold tracking-tight">
                        Általános Szerződési Feltételek
                    </h1>
                    <p className="mb-10 text-sm text-muted-foreground">
                        Hatályos: 2026. július 28-tól
                    </p>

                    <div className="prose max-w-none space-y-8 text-sm leading-relaxed text-foreground prose-neutral dark:prose-invert">
                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                1. A Szolgáltató és a Szolgáltatás
                            </h2>
                            <p className="mb-3 text-muted-foreground">
                                A{' '}
                                <strong className="text-foreground">
                                    TopWords
                                </strong>{' '}
                                (a továbbiakban: „Szolgáltatás") egy webalapú
                                szókincsfejlesztő alkalmazás, amelyet a{' '}
                                <strong className="text-foreground">
                                    CodeBarley
                                </strong>{' '}
                                (a továbbiakban: „Szolgáltató") fejleszt és
                                üzemeltet. A Szolgáltatás a 10 000 leggyakoribb
                                angol szó böngészését, jelölését és tanulásának
                                nyomon követését teszi lehetővé, továbbá
                                flashcard-tanulást, szövegelemzést, valamint
                                választható{' '}
                                <strong className="text-foreground">
                                    mesterséges intelligenciára (AI) épülő
                                    funkciókat
                                </strong>{' '}
                                kínál (lásd 7. pont).
                            </p>
                            <p className="mb-3 text-muted-foreground">
                                A Szolgáltatás részét képezi a{' '}
                                <strong className="text-foreground">
                                    TopWords böngészőbővítmény
                                </strong>{' '}
                                is, amelyre a jelen ÁSZF ugyanúgy irányadó (lásd
                                8. pont).
                            </p>
                            <div className="rounded-xl border bg-card p-4 text-muted-foreground">
                                <p>
                                    <strong className="text-foreground">
                                        Szolgáltató neve:
                                    </strong>{' '}
                                    Szaniszló Árpád egyéni vállalkozó
                                    (CodeBarley)
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
                                        Weboldal:
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
                                        href="mailto:info@codebarley.hu"
                                        className="text-foreground underline underline-offset-4 hover:no-underline"
                                    >
                                        info@codebarley.hu
                                    </a>{' '}
                                    ·{' '}
                                    <a
                                        href="mailto:info@topwords.eu"
                                        className="text-foreground underline underline-offset-4 hover:no-underline"
                                    >
                                        info@topwords.eu
                                    </a>
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                2. A feltételek elfogadása
                            </h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatás használatával, illetve
                                regisztrációval a Felhasználó elfogadja a jelen
                                Általános Szerződési Feltételeket (a
                                továbbiakban: „ÁSZF"). Amennyiben a Felhasználó
                                nem ért egyet a feltételekkel, a Szolgáltatást
                                nem jogosult igénybe venni.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                3. Regisztráció és fiók
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                A Szolgáltatás egyes funkcióinak használatához
                                regisztráció szükséges. A regisztráció során a
                                Felhasználó érvényes e-mail-címet és jelszót
                                köteles megadni.
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>
                                    A Felhasználó felelős fiókjának
                                    biztonságáért és jelszavának titkosságáért.
                                </li>
                                <li>
                                    Egy személy csak egy fiókot hozhat létre.
                                </li>
                                <li>
                                    A fiók nem ruházható át harmadik személyre.
                                </li>
                                <li>
                                    A Felhasználó köteles valós adatokat
                                    megadni; hamis adatokkal történő
                                    regisztráció tilos.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                4. Csomagok, díjak, előfizetés
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                A Szolgáltatás{' '}
                                <strong className="text-foreground">
                                    ingyenes (Free)
                                </strong>{' '}
                                csomagban is használható, korlátozott napi és
                                havi keretekkel. A korlátozások feloldásához{' '}
                                <strong className="text-foreground">
                                    fizetős (Pro) előfizetés
                                </strong>{' '}
                                választható.
                            </p>
                            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                                <li>
                                    A mindenkori árak, a csomagok tartalma és a
                                    keretek a{' '}
                                    <Link
                                        href={pricing()}
                                        className="text-foreground underline underline-offset-4 hover:no-underline"
                                    >
                                        díjszabás oldalon
                                    </Link>{' '}
                                    érhetők el. Az árak forintban, bruttó (áfát
                                    tartalmazó) értékben értendők.
                                </li>
                                <li>
                                    A fizetést a{' '}
                                    <strong className="text-foreground">
                                        Stripe
                                    </strong>{' '}
                                    mint fizetési szolgáltató dolgozza fel; a
                                    Szolgáltató bankkártyaadatot nem lát és nem
                                    tárol.
                                </li>
                                <li>
                                    Az előfizetés a kiválasztott számlázási
                                    időszak végén{' '}
                                    <strong className="text-foreground">
                                        automatikusan megújul
                                    </strong>
                                    , amíg a Felhasználó azt le nem mondja.
                                </li>
                                <li>
                                    Az előfizetés{' '}
                                    <strong className="text-foreground">
                                        bármikor lemondható
                                    </strong>{' '}
                                    a fiók beállításaiban. A lemondás a már
                                    kifizetett időszak végén lép hatályba; addig
                                    a Pro funkciók elérhetők maradnak.
                                    Időarányos visszatérítésre a Szolgáltató – a
                                    9. pontban írt elállási jog kivételével –
                                    nem köteles.
                                </li>
                                <li>
                                    A díjról a Szolgáltató elektronikus számlát
                                    állít ki, amelyet a Felhasználó megadott
                                    e-mail-címére küld meg.
                                </li>
                                <li>
                                    Sikertelen fizetés esetén a Szolgáltató a
                                    Pro funkciókhoz való hozzáférést
                                    felfüggesztheti.
                                </li>
                                <li>
                                    A Szolgáltató jogosult az árakat módosítani;
                                    a módosításról a Felhasználót előzetesen,
                                    e-mailben vagy a weboldalon értesíti. A
                                    módosítás a már kifizetett időszakot nem
                                    érinti.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                5. Tiltott tevékenységek
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                A Felhasználó nem jogosult:
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>
                                    a Szolgáltatás automatizált eszközzel (bot,
                                    scraper stb.) történő igénybevételére;
                                </li>
                                <li>
                                    a Szolgáltatás, illetve az azt üzemeltető
                                    rendszerek megzavarására, feltörésére;
                                </li>
                                <li>
                                    más Felhasználók adataihoz való jogosulatlan
                                    hozzáférésre;
                                </li>
                                <li>
                                    a Szolgáltatáson keresztül jogellenes
                                    tartalom terjesztésére;
                                </li>
                                <li>
                                    az AI-funkciók rendeltetésellenes
                                    használatára (pl. tömeges tartalomgenerálás,
                                    a szolgáltatás továbbértékesítése, más célú
                                    AI-hozzáférésként való felhasználása).
                                </li>
                            </ul>
                            <p className="mt-3 text-muted-foreground">
                                A jelen pont megsértése esetén a Szolgáltató a
                                fiókot korlátozhatja vagy megszüntetheti.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                6. Szellemi tulajdon
                            </h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatás megjelenése, kódja, logója és
                                egyéb elemei a Szolgáltató szellemi tulajdonát
                                képezik, és szerzői jogi védelem alatt állnak. A
                                Felhasználó a Szolgáltatást kizárólag személyes,
                                nem kereskedelmi célra használhatja. A tartalmak
                                másolása, terjesztése vagy kereskedelmi
                                hasznosítása a Szolgáltató előzetes írásbeli
                                engedélye nélkül tilos.
                            </p>
                            <p className="mt-2 text-muted-foreground">
                                A szólista a BNC és COCA korpuszadatokon,
                                illetve Paul Nation kutatásain alapul, amelyek
                                nyilvánosan hozzáférhető tudományos forrásokat
                                képeznek.
                            </p>
                            <p className="mt-2 text-muted-foreground">
                                Az AI által generált tartalom (szómagyarázat,
                                példamondat, flashcard) tekintetében a
                                Szolgáltató nem szavatolja, hogy az egyedi,
                                illetve hogy harmadik személy jogát nem sérti. A
                                Felhasználó az ilyen tartalmat saját tanulási
                                céljára használhatja, annak nyilvános
                                közzétételéért vagy hasznosításáért maga felel.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                7. AI-funkciók és a felelősség kizárása
                            </h2>
                            <div className="rounded-xl border bg-card p-4 text-muted-foreground">
                                <p className="text-foreground">
                                    <strong>
                                        A Szolgáltatás mesterséges
                                        intelligenciát (AI) használ.
                                    </strong>{' '}
                                    Az AI-val generált tartalom hibás, hiányos
                                    vagy félrevezető lehet — mindig ellenőrizd,
                                    mielőtt megtanulod vagy felhasználod.
                                </p>
                            </div>
                            <p className="mt-3 mb-2 text-muted-foreground">
                                Az alábbi funkciók működnek AI-val, mind a
                                weboldalon, mind a böngészőbővítményben: AI
                                szó-kitöltés (jelentés, szinonimák,
                                példamondatok, szóalakok), AI-flashcard
                                generálás, AI-alapú szómagyarázat és a
                                szövegelemző AI-funkciói.
                            </p>
                            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                                <li>
                                    <strong className="text-foreground">
                                        Külső szolgáltató.
                                    </strong>{' '}
                                    Az AI-válaszokat harmadik fél, a{' '}
                                    <strong className="text-foreground">
                                        Google (Gemini API)
                                    </strong>{' '}
                                    generálja. A funkció használatakor a
                                    vizsgált szó, illetve a megadott
                                    szövegrészlet a Szolgáltató szerverén
                                    keresztül a Google felé továbbításra kerül
                                    (részletek az{' '}
                                    <Link
                                        href={privacy()}
                                        className="text-foreground underline underline-offset-4 hover:no-underline"
                                    >
                                        Adatkezelési tájékoztatóban
                                    </Link>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        A kimenet nem ellenőrzött.
                                    </strong>{' '}
                                    A generatív AI valószínűségi alapon állít
                                    elő szöveget, ezért tévedhet, valótlan
                                    adatot is „megalkothat" (hallucináció). A
                                    Szolgáltató az AI kimenetét nem ellenőrzi
                                    tételesen, és annak helyességéért,
                                    pontosságáért, teljességéért vagy
                                    naprakészségéért{' '}
                                    <strong className="text-foreground">
                                        felelősséget nem vállal
                                    </strong>
                                    .
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Nem szakmai tanácsadás.
                                    </strong>{' '}
                                    Az AI-tartalom kizárólag nyelvtanulási
                                    segédanyag; nem minősül nyelvi, oktatási,
                                    jogi, orvosi, pénzügyi vagy egyéb szakmai
                                    tanácsadásnak, és nem helyettesíti a tanári
                                    vagy szakértői konzultációt.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        A külső szolgáltatóért való felelősség
                                        kizárása.
                                    </strong>{' '}
                                    A Szolgáltató nem felel a külső
                                    AI-szolgáltató szolgáltatásának
                                    elérhetőségéért, minőségéért, hibáiért,
                                    díjszabásának vagy feltételeinek
                                    megváltozásáért, illetve megszűnéséért,
                                    továbbá az ezekből eredő közvetett vagy
                                    következményes károkért.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Ellenőrzési kötelezettség.
                                    </strong>{' '}
                                    A Felhasználó tudomásul veszi, hogy az AI
                                    által generált tartalom felhasználása a
                                    saját döntése és kockázata; a tartalom
                                    helyességét felhasználás előtt ellenőriznie
                                    kell.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Adatbeviteli korlát.
                                    </strong>{' '}
                                    A Felhasználó az AI-funkciókba nem vihet be
                                    személyes, érzékeny vagy bizalmas adatot,
                                    sem harmadik személy jogát sértő tartalmat.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Keretek és változtatás joga.
                                    </strong>{' '}
                                    Az AI-funkciók használati kerethez kötöttek.
                                    A Szolgáltató jogosult a kereteket, a
                                    felhasznált AI-modellt vagy AI-szolgáltatót
                                    megváltoztatni, illetve az AI-funkciókat
                                    szüneteltetni vagy megszüntetni; ez a
                                    Szolgáltatás nem AI-alapú funkcióit nem
                                    érinti.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                8. Böngészőbővítmény
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                A TopWords böngészőbővítmény a Szolgáltatás
                                része, használatára a jelen ÁSZF irányadó. A
                                bővítmény telepítésére és terjesztésére emellett
                                a böngésző-áruház (pl. Chrome Web Store)
                                üzemeltetőjének feltételei is alkalmazandók.
                            </p>
                            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                                <li>
                                    A bővítmény a meglátogatott oldalak szövegét{' '}
                                    <strong className="text-foreground">
                                        helyben, a Felhasználó böngészőjében
                                    </strong>{' '}
                                    dolgozza fel; az oldalak teljes tartalmát
                                    nem küldi el és nem tárolja.
                                </li>
                                <li>
                                    A bővítmény harmadik felek weboldalain (pl.
                                    YouTube, Netflix) is működik. A Szolgáltató
                                    ezekkel a szolgáltatókkal{' '}
                                    <strong className="text-foreground">
                                        nem áll kapcsolatban
                                    </strong>
                                    , velük együttműködésben nem áll, és azok a
                                    bővítményt nem támogatják, nem hagyják jóvá.
                                    Az érintett nevek és védjegyek a
                                    jogosultjaik tulajdonát képezik.
                                </li>
                                <li>
                                    A Felhasználó felelős azért, hogy a
                                    bővítmény használata megfeleljen az általa
                                    látogatott oldalak saját felhasználási
                                    feltételeinek és a hatályos jogszabályoknak.
                                </li>
                                <li>
                                    A Szolgáltató nem szavatolja a bővítmény
                                    hibátlan működését olyan oldalakon, amelyek
                                    felépítése a Szolgáltató érdekkörén kívül
                                    megváltozik.
                                </li>
                                <li>
                                    A bővítmény AI-funkcióira a 7. pont
                                    rendelkezései változatlanul irányadók.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                9. Elállási és felmondási jog (fogyasztók)
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                A fogyasztónak minősülő Felhasználót a fogyasztó
                                és a vállalkozás közötti szerződések részletes
                                szabályairól szóló 45/2014. (II. 26.) Korm.
                                rendelet alapján a szerződéskötéstől számított{' '}
                                <strong className="text-foreground">
                                    14 napon belül indokolás nélküli elállási
                                    jog
                                </strong>{' '}
                                illeti meg a fizetős előfizetés vonatkozásában.
                            </p>
                            <p className="mb-2 text-muted-foreground">
                                Ha a Felhasználó kifejezetten kéri a
                                szolgáltatás nyújtásának a 14 napos határidő
                                lejárta előtti megkezdését, és ezt a
                                Szolgáltatás megrendelésekor tudomásul veszi, a
                                szolgáltatás teljes egészében történő
                                teljesítését követően az elállási jogát
                                elveszíti; a határidőn belüli felmondás esetén a
                                már teljesített szolgáltatás arányos díjának
                                megfizetésére köteles.
                            </p>
                            <p className="text-muted-foreground">
                                Az elállási/felmondási nyilatkozat elküldhető az{' '}
                                <a
                                    href="mailto:info@topwords.eu"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    info@topwords.eu
                                </a>{' '}
                                címre. A Szolgáltató a visszajáró összeget
                                haladéktalanul, de legkésőbb 14 napon belül
                                visszatéríti, az eredeti fizetési móddal egyező
                                módon.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                10. Felelősség korlátozása
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                A Szolgáltató a Szolgáltatást „ahogy van" alapon
                                biztosítja, és – a jogszabály által megengedett
                                körben – nem vállal felelősséget:
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>
                                    a Szolgáltatás folyamatos elérhetőségéért
                                    vagy hibamentességéért;
                                </li>
                                <li>a szólista esetleges pontatlanságaiért;</li>
                                <li>
                                    az AI által generált tartalom helyességéért,
                                    sem a külső AI-szolgáltató (Google Gemini)
                                    működéséért, hibájáért vagy kieséséért (lásd
                                    7. pont);
                                </li>
                                <li>
                                    harmadik felek szolgáltatásaiért (pl.
                                    fizetési szolgáltató, tárhelyszolgáltató,
                                    böngésző-áruház, videómegosztó oldalak) és
                                    azok változásaiért;
                                </li>
                                <li>
                                    a Felhasználó által elveszített adatokért
                                    (pl. technikai hiba esetén);
                                </li>
                                <li>a Felhasználó tanulási eredményeiért.</li>
                            </ul>
                            <p className="mt-3 text-muted-foreground">
                                A jelen pont nem korlátozza a Szolgáltató
                                felelősségét a szándékosan okozott, továbbá
                                emberi életet, testi épséget vagy egészséget
                                megkárosító szerződésszegésért, valamint azon
                                esetekben, amelyekben a felelősség kizárását
                                jogszabály tiltja.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                11. A Szolgáltatás módosítása és megszüntetése
                            </h2>
                            <p className="text-muted-foreground">
                                A Szolgáltató jogosult a Szolgáltatást bármikor
                                módosítani, szüneteltetni vagy megszüntetni,
                                erről lehetőség szerint előzetesen tájékoztatva
                                a Felhasználókat. A Szolgáltató szintén jogosult
                                a jelen ÁSZF-et egyoldalúan módosítani; a
                                módosítás hatályba lépéséről a Felhasználókat a
                                weboldalon keresztül értesíti. Fizetős
                                előfizetés esetén a Felhasználó terhére történő
                                lényeges módosításról a Szolgáltató előzetesen
                                értesítést küld, és a Felhasználó az előfizetést
                                a hatályba lépésig lemondhatja.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                12. Panaszkezelés, fogyasztói jogviták
                            </h2>
                            <p className="mb-2 text-muted-foreground">
                                Panaszát a Felhasználó az{' '}
                                <a
                                    href="mailto:info@topwords.eu"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    info@topwords.eu
                                </a>{' '}
                                címen terjesztheti elő; a Szolgáltató azt 30
                                napon belül megválaszolja.
                            </p>
                            <p className="text-muted-foreground">
                                Fogyasztói jogvita esetén a Felhasználó a
                                lakóhelye szerint illetékes{' '}
                                <strong className="text-foreground">
                                    békéltető testülethez
                                </strong>
                                , illetve a területileg illetékes{' '}
                                <strong className="text-foreground">
                                    fogyasztóvédelmi hatósághoz
                                </strong>{' '}
                                fordulhat. Online vásárláshoz kapcsolódó jogvita
                                esetén az Európai Bizottság online vitarendezési
                                platformja is igénybe vehető:{' '}
                                <a
                                    href="https://ec.europa.eu/consumers/odr"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    ec.europa.eu/consumers/odr
                                </a>
                                .
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                13. Irányadó jog és jogviták
                            </h2>
                            <p className="text-muted-foreground">
                                A jelen ÁSZF-re a magyar jog az irányadó.
                                Jogvita esetén a felek elsősorban tárgyalásos
                                úton törekednek megállapodásra. Amennyiben ez
                                nem vezet eredményre, a hatáskörrel és
                                illetékességgel rendelkező magyar bíróság jár
                                el.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">
                                14. Kapcsolat
                            </h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatással kapcsolatos kérdésekkel,
                                észrevételekkel a Szolgáltató az{' '}
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
                                weboldalon keresztül érhető el.
                            </p>
                        </section>
                    </div>
                </main>

                {/* Footer */}
                <footer className="border-t">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <AppLogoIcon className="size-8 rounded-md" />
                            <span>TopWords</span>
                        </div>
                        <a
                            href="https://codebarley.hu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="transition-colors hover:text-foreground"
                        >
                            Készítette: codebarley.hu
                        </a>
                    </div>
                </footer>
            </div>
        </>
    );
}
