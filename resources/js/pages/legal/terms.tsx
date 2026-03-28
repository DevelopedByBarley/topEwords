import { Head, Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';

export default function Terms() {
    return (
        <>
            <Head title="Általános Szerződési Feltételek – TopWords">
                <meta head-key="description" name="description" content="A TopWords szókincsfejlesztő alkalmazás általános szerződési feltételei." />
                <meta head-key="robots" name="robots" content="noindex, follow" />
            </Head>

            <div className="min-h-screen bg-background text-foreground">
                {/* Nav */}
                <header className="border-b">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <Link href={home()} className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                                <AppLogoIcon className="size-4.5 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-semibold tracking-tight">TopWords</span>
                        </Link>
                        <Link href={home()} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            ← Vissza a főoldalra
                        </Link>
                    </div>
                </header>

                {/* Content */}
                <main className="mx-auto max-w-3xl px-6 py-16">
                    <h1 className="mb-2 text-3xl font-bold tracking-tight">Általános Szerződési Feltételek</h1>
                    <p className="mb-10 text-sm text-muted-foreground">Hatályos: 2026. március 28-tól</p>

                    <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground">

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">1. A szolgáltatásról</h2>
                            <p className="text-muted-foreground">
                                A <strong className="text-foreground">TopWords</strong> (a továbbiakban: „Szolgáltatás") egy ingyenes,
                                webalapú szókincsfejlesztő alkalmazás, amelyet a <strong className="text-foreground">CodeBarley</strong>{' '}
                                (codebarley.hu, a továbbiakban: „Szolgáltató") fejlesztett és üzemeltet. A Szolgáltatás a 10 000
                                leggyakoribb angol szó böngészését, jelölését és tanulásának nyomon követését teszi lehetővé.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">2. A feltételek elfogadása</h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatás használatával, illetve regisztrációval a Felhasználó elfogadja a jelen Általános
                                Szerződési Feltételeket (a továbbiakban: „ÁSZF"). Amennyiben a Felhasználó nem ért egyet a feltételekkel,
                                a Szolgáltatást nem jogosult igénybe venni.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">3. Regisztráció és fiók</h2>
                            <p className="mb-2 text-muted-foreground">
                                A Szolgáltatás egyes funkcióinak használatához regisztráció szükséges. A regisztráció során a
                                Felhasználó érvényes e-mail-címet és jelszót köteles megadni.
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>A Felhasználó felelős fiókjának biztonságáért és jelszavának titkosságáért.</li>
                                <li>Egy személy csak egy fiókot hozhat létre.</li>
                                <li>A fiók nem ruházható át harmadik személyre.</li>
                                <li>A Felhasználó köteles valós adatokat megadni; hamis adatokkal történő regisztráció tilos.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">4. A szolgáltatás ingyenessége</h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatás jelenleg teljes egészében ingyenes. A Szolgáltató fenntartja a jogot arra, hogy
                                a jövőben fizetős funkciókat vezessen be, erről azonban a Felhasználókat előzetesen értesíti.
                                Az esetleges díjak bevezetése nem érinti a korábban ingyenesen igénybe vett funkciókat visszamenőlegesen.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">5. Tiltott tevékenységek</h2>
                            <p className="mb-2 text-muted-foreground">A Felhasználó nem jogosult:</p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>a Szolgáltatás automatizált eszközzel (bot, scraper stb.) történő igénybevételére;</li>
                                <li>a Szolgáltatás, illetve az azt üzemeltető rendszerek megzavarására, feltörésére;</li>
                                <li>más Felhasználók adataihoz való jogosulatlan hozzáférésre;</li>
                                <li>a Szolgáltatáson keresztül jogellenes tartalom terjesztésére.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">6. Szellemi tulajdon</h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatás megjelenése, kódja, logója és egyéb elemei a Szolgáltató szellemi tulajdonát képezik,
                                és szerzői jogi védelem alatt állnak. A Felhasználó a Szolgáltatást kizárólag személyes, nem
                                kereskedelmi célra használhatja. A tartalmak másolása, terjesztése vagy kereskedelmi hasznosítása
                                a Szolgáltató előzetes írásbeli engedélye nélkül tilos.
                            </p>
                            <p className="mt-2 text-muted-foreground">
                                A szólista a BNC és COCA korpuszadatokon, illetve Paul Nation kutatásain alapul, amelyek nyilvánosan
                                hozzáférhető tudományos forrásokat képeznek.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">7. Felelősség korlátozása</h2>
                            <p className="mb-2 text-muted-foreground">
                                A Szolgáltató a Szolgáltatást „ahogy van" alapon biztosítja, és nem vállal felelősséget:
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>a Szolgáltatás folyamatos elérhetőségéért vagy hibamentességéért;</li>
                                <li>a szólista esetleges pontatlanságaiért;</li>
                                <li>a Felhasználó által elveszített adatokért (pl. technikai hiba esetén);</li>
                                <li>a Felhasználó tanulási eredményeiért.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">8. A Szolgáltatás módosítása és megszüntetése</h2>
                            <p className="text-muted-foreground">
                                A Szolgáltató jogosult a Szolgáltatást bármikor módosítani, szüneteltetni vagy megszüntetni,
                                erről lehetőség szerint előzetesen tájékoztatva a Felhasználókat. A Szolgáltató szintén jogosult
                                a jelen ÁSZF-et egyoldalúan módosítani; a módosítás hatályba lépéséről a Felhasználókat
                                a weboldalon keresztül értesíti.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">9. Irányadó jog és jogviták</h2>
                            <p className="text-muted-foreground">
                                A jelen ÁSZF-re a magyar jog az irányadó. Jogvita esetén a felek elsősorban tárgyalásos
                                úton törekednek megállapodásra. Amennyiben ez nem vezet eredményre, a hatáskörrel és
                                illetékességgel rendelkező magyar bíróság jár el.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">10. Kapcsolat</h2>
                            <p className="text-muted-foreground">
                                A Szolgáltatással kapcsolatos kérdésekkel, észrevételekkel a Szolgáltató a{' '}
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
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                                <AppLogoIcon className="size-3.5 text-primary-foreground" />
                            </div>
                            <span>TopWords</span>
                        </div>
                        <a
                            href="https://codebarley.hu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors"
                        >
                            Készítette: codebarley.hu
                        </a>
                    </div>
                </footer>
            </div>
        </>
    );
}
