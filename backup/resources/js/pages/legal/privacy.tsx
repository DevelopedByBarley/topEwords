import { Head, Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { home } from '@/routes';

export default function Privacy() {
    return (
        <>
            <Head title="Adatkezelési Tájékoztató – TopWords">
                <meta head-key="description" name="description" content="A TopWords szókincsfejlesztő alkalmazás adatkezelési tájékoztatója – GDPR-kompatibilis adatvédelmi szabályzat." />
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
                    <h1 className="mb-2 text-3xl font-bold tracking-tight">Adatkezelési Tájékoztató</h1>
                    <p className="mb-10 text-sm text-muted-foreground">Hatályos: 2026. március 28-tól</p>

                    <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground">

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">1. Adatkezelő</h2>
                            <div className="rounded-xl border bg-card p-4 text-muted-foreground">
                                <p><strong className="text-foreground">Neve:</strong> CodeBarley</p>
                                <p><strong className="text-foreground">Weboldala:</strong>{' '}
                                    <a
                                        href="https://codebarley.hu"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-foreground underline underline-offset-4 hover:no-underline"
                                    >
                                        codebarley.hu
                                    </a>
                                </p>
                                <p className="mt-2 text-xs">
                                    A jelen tájékoztató a <strong className="text-foreground">TopWords</strong> alkalmazás
                                    (topwords.hu) felhasználóinak személyes adatai kezelésére vonatkozik, összhangban az Európai
                                    Unió Általános Adatvédelmi Rendeletével (GDPR – 2016/679/EU rendelet) és a hatályos magyar
                                    adatvédelmi jogszabályokkal.
                                </p>
                            </div>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">2. Kezelt adatok és céljaik</h2>
                            <div className="overflow-hidden rounded-xl border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">Adat</th>
                                            <th className="px-4 py-3 text-left font-medium">Cél</th>
                                            <th className="px-4 py-3 text-left font-medium">Jogalap</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y text-muted-foreground">
                                        <tr>
                                            <td className="px-4 py-3">E-mail-cím</td>
                                            <td className="px-4 py-3">Regisztráció, bejelentkezés, értesítések</td>
                                            <td className="px-4 py-3">Szerződés teljesítése</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3">Jelszó (titkosítva)</td>
                                            <td className="px-4 py-3">Hitelesítés</td>
                                            <td className="px-4 py-3">Szerződés teljesítése</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3">Szótanulási adatok</td>
                                            <td className="px-4 py-3">Haladás nyomon követése (tudom / tanulom / később)</td>
                                            <td className="px-4 py-3">Szerződés teljesítése</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3">Napi aktivitás (streak)</td>
                                            <td className="px-4 py-3">Tanulási sorozat megjelenítése</td>
                                            <td className="px-4 py-3">Jogos érdek</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3">Mappa adatok</td>
                                            <td className="px-4 py-3">Szavak rendszerezése mappákba</td>
                                            <td className="px-4 py-3">Szerződés teljesítése</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-3 text-muted-foreground">
                                Az Adatkezelő nem gyűjt különleges kategóriájú (érzékeny) személyes adatot, és nem végez
                                automatizált döntéshozatalt vagy profilalkotást.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">3. Adatmegőrzési idő</h2>
                            <p className="text-muted-foreground">
                                Az adatokat addig kezeljük, amíg a Felhasználó fiókja aktív, illetve amíg a Felhasználó törlési
                                kérést nem nyújt be. Fiók törlése esetén az összes személyes adat véglegesen és visszavonhatatlanul
                                törlésre kerül a rendszerből, a jogszabályi kötelezettségek alapján kötelezően megőrizendő adatok
                                kivételével.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">4. Adatbiztonság</h2>
                            <p className="mb-2 text-muted-foreground">Az Adatkezelő az adatok védelme érdekében:</p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                                <li>titkosított jelszótárolást (bcrypt) alkalmaz;</li>
                                <li>HTTPS protokollon keresztül kommunikál;</li>
                                <li>csak a szükséges mértékben és ideig tárolja az adatokat;</li>
                                <li>az adatbázishoz csak az arra feljogosított személyek férnek hozzá.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">5. Adattovábbítás, harmadik felek</h2>
                            <p className="text-muted-foreground">
                                Az Adatkezelő a Felhasználók személyes adatait harmadik félnek nem adja el és nem adja át,
                                kivéve ha ezt jogszabály kötelezővé teszi (pl. hatósági megkeresés esetén). Az alkalmazás nem
                                tartalmaz hirdetési vagy nyomkövető technológiát (pl. Facebook Pixel, Google Analytics).
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">6. Sütik (cookie-k)</h2>
                            <p className="mb-2 text-muted-foreground">
                                Az alkalmazás kizárólag a működéshez szükséges munkamenet-sütit (session cookie) használ,
                                amely a bejelentkezési állapot fenntartásához szükséges. Ez a süti a böngésző bezárásakor
                                automatikusan törlődik.
                            </p>
                            <p className="text-muted-foreground">
                                Harmadik féltől származó sütit az alkalmazás nem alkalmaz.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">7. A Felhasználó jogai (GDPR)</h2>
                            <p className="mb-2 text-muted-foreground">A Felhasználót az alábbi jogok illetik meg:</p>
                            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
                                <li>
                                    <strong className="text-foreground">Hozzáférési jog:</strong> tájékoztatást kérhet a kezelt adatairól.
                                </li>
                                <li>
                                    <strong className="text-foreground">Helyesbítési jog:</strong> kérheti a pontatlan adatok korrigálását
                                    (a profilbeállításokban önállóan is elvégezhető).
                                </li>
                                <li>
                                    <strong className="text-foreground">Törlési jog („elfeledtetéshez való jog"):</strong> kérheti
                                    valamennyi adata törlését, beleértve a fiók megszüntetését.
                                </li>
                                <li>
                                    <strong className="text-foreground">Az adatkezelés korlátozásához való jog:</strong> bizonyos
                                    esetekben kérheti az adatkezelés felfüggesztését.
                                </li>
                                <li>
                                    <strong className="text-foreground">Adathordozhatóság joga:</strong> kérheti adatait géppel
                                    olvasható formátumban.
                                </li>
                                <li>
                                    <strong className="text-foreground">Tiltakozás joga:</strong> jogos érdeken alapuló adatkezelés
                                    ellen tiltakozhat.
                                </li>
                            </ul>
                            <p className="mt-3 text-muted-foreground">
                                Jogait az alábbi kapcsolati ponton érvényesítheti. Panasz esetén fordulhat a{' '}
                                <strong className="text-foreground">Nemzeti Adatvédelmi és Információszabadság Hatósághoz</strong>{' '}
                                (NAIH) is:{' '}
                                <a
                                    href="https://naih.hu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    naih.hu
                                </a>.
                            </p>
                        </section>

                        <section>
                            <h2 className="mb-3 text-lg font-semibold">8. Kapcsolat</h2>
                            <p className="text-muted-foreground">
                                Adatkezeléssel kapcsolatos kérdéseivel, kérelmeivel forduljon az Adatkezelőhöz a{' '}
                                <a
                                    href="https://codebarley.hu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground underline underline-offset-4 hover:no-underline"
                                >
                                    codebarley.hu
                                </a>{' '}
                                weboldalon elérhető elérhetőségeken. Az Adatkezelő a beérkező kérelmeket 30 napon belül megválaszolja.
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
