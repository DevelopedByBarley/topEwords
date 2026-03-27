import { Head, Link, usePage } from '@inertiajs/react';
import { BookMarked, CheckCheck, Clock, Code2, ExternalLink, FlaskConical, Star, TrendingUp, Zap } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { dashboard, login, register } from '@/routes';
import { index as wordsIndex } from '@/routes/words';

export default function Welcome({ canRegister = true }: { canRegister?: boolean }) {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Top 10 000 angol szó – Tanuld meg a legfontosabb szavakat" />

            <div className="min-h-screen bg-background text-foreground">
                {/* Nav */}
                <header className="border-b">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                                <AppLogoIcon className="size-4.5 text-primary-foreground" />
                            </div>
                            <div className="grid text-sm">
                                <span className="font-semibold tracking-tight leading-tight">TopWords</span>
                                <a
                                    href="https://codebarley.hu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    by CodeBarley
                                </a>
                            </div>
                        </div>

                        <nav className="flex items-center gap-2">
                            {auth.user ? (
                                <Button asChild>
                                    <Link href={dashboard()}>Irány az alkalmazás</Link>
                                </Button>
                            ) : (
                                <>
                                    <Button variant="ghost" asChild>
                                        <Link href={login()}>Bejelentkezés</Link>
                                    </Button>
                                    {canRegister && (
                                        <Button asChild>
                                            <Link href={register()}>Regisztráció</Link>
                                        </Button>
                                    )}
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                {/* Hero */}
                <section className="mx-auto max-w-5xl px-6 py-20 text-center">
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Star className="size-3 text-[#00ADB5]" />
                        A 10 000 leggyakoribb angol szó egy helyen
                    </div>

                    <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                        Tanuld meg az angol szavakat{' '}
                        <span className="text-primary">rendszeresen</span>
                    </h1>

                    <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
                        A leggyakoribb 10 000 angol szó listája, amellyel hatékonyan bővítheted szókincsedet.
                        Jelöld meg amit tudsz, amit tanulsz, és amit még meg kell tanulnod — és kövesd a haladásodat.
                    </p>

                    <div className="flex flex-wrap justify-center gap-3">
                        {auth.user ? (
                            <Button size="lg" asChild>
                                <Link href={wordsIndex()}>Szavak böngészése</Link>
                            </Button>
                        ) : (
                            <>
                                {canRegister && (
                                    <Button size="lg" asChild>
                                        <Link href={register()}>Kezdés — ingyenes</Link>
                                    </Button>
                                )}
                                <Button size="lg" variant="outline" asChild>
                                    <Link href={login()}>Bejelentkezés</Link>
                                </Button>
                            </>
                        )}
                    </div>
                </section>

                {/* Stats */}
                <section className="border-y bg-muted/40">
                    <div className="mx-auto grid max-w-5xl grid-cols-3 divide-x px-6 py-8">
                        {[
                            { value: '10 000', label: 'Angol szó' },
                            { value: '3', label: 'Nehézségi szint' },
                            { value: '100%', label: 'Ingyenes' },
                        ].map((stat) => (
                            <div key={stat.label} className="px-6 text-center first:pl-0 last:pr-0">
                                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Features */}
                <section className="mx-auto max-w-5xl px-6 py-20">
                    <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Hogyan működik?</h2>
                    <p className="mb-12 text-center text-muted-foreground">
                        Egyszerű, de hatékony rendszer a szókincsed fejlesztéséhez
                    </p>

                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="rounded-xl border bg-card p-6">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#00ADB5]/15 dark:bg-[#00ADB5]/20">
                                <CheckCheck className="size-5 text-[#00ADB5]" />
                            </div>
                            <h3 className="mb-2 font-semibold">Tudom</h3>
                            <p className="text-sm text-muted-foreground">
                                Jelöld meg azokat a szavakat, amelyeket már biztosan ismersz. Ezek számítanak a haladásodba.
                            </p>
                        </div>

                        <div className="rounded-xl border bg-card p-6">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
                                <Clock className="size-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="mb-2 font-semibold">Tanulom</h3>
                            <p className="text-sm text-muted-foreground">
                                Tedd ide a szavakat, amelyekkel aktívan foglalkozol, hogy könnyen visszatalálj hozzájuk.
                            </p>
                        </div>

                        <div className="rounded-xl border bg-card p-6">
                            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/40">
                                <BookMarked className="size-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <h3 className="mb-2 font-semibold">Később</h3>
                            <p className="text-sm text-muted-foreground">
                                Mentsd el a szavakat, amelyekre még visszatérsz — ne vesszenek el a listában.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Why section */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid items-center gap-12 md:grid-cols-2">
                            <div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">
                                    Miért érdemes a leggyakoribb szavakkal kezdeni?
                                </h2>
                                <p className="mb-6 text-muted-foreground">
                                    A mindennapi angol szövegek és beszélgetések közel 90%-a csak a legtöbbször
                                    használt 3 000 szóból épül fel. Ha ezeket ismered, a legtöbb helyzetben boldogulni fogsz.
                                </p>
                                <ul className="flex flex-col gap-3 text-sm">
                                    {[
                                        { icon: Zap, text: 'Gyors eredmények — a legfontosabb szavak előre kerülnek' },
                                        { icon: TrendingUp, text: 'Mérhető haladás — látod, mennyi szót ismersz már' },
                                        { icon: Star, text: 'Nehézségi szintek — kezdőtől haladóig' },
                                    ].map(({ icon: Icon, text }) => (
                                        <li key={text} className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                                <Icon className="size-3 text-primary" />
                                            </div>
                                            <span className="text-muted-foreground">{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Difficulty levels visual */}
                            <div className="flex flex-col gap-3">
                                {[
                                    { label: 'Kezdő', range: '1–2 000', color: 'bg-[#00ADB5]/40', width: '20%', desc: 'Alapvető szavak, amelyek nélkül nem boldogulsz' },
                                    { label: 'Középhaladó', range: '2 001–6 000', color: 'bg-[#00ADB5]/70', width: '50%', desc: 'A hétköznapi kommunikáció szókincse' },
                                    { label: 'Haladó', range: '6 001–10 000', color: 'bg-[#00ADB5]', width: '100%', desc: 'Ritkább, de hasznos szavak' },
                                ].map((level) => (
                                    <div key={level.label} className="rounded-xl border bg-card p-4">
                                        <div className="mb-2 flex items-center justify-between text-sm">
                                            <span className="font-medium">{level.label}</span>
                                            <span className="text-muted-foreground">{level.range}</span>
                                        </div>
                                        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                                            <div className={`h-1.5 rounded-full ${level.color}`} style={{ width: level.width }} />
                                        </div>
                                        <p className="text-xs text-muted-foreground">{level.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Scientific basis */}
                <section className="mx-auto max-w-5xl px-6 py-20">
                    <div className="mb-10 text-center">
                        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            <FlaskConical className="size-3" />
                            Tudományosan megalapozott
                        </div>
                        <h2 className="mb-3 text-2xl font-bold tracking-tight">Honnan származik a szólista?</h2>
                        <p className="mx-auto max-w-2xl text-muted-foreground">
                            A 10 000 leggyakoribb angol szó nem véletlenszerűen összeválogatott lista — korpusznyelvészeti
                            kutatások eredménye, amelyet évtizedek óta használnak nyelvoktatásban és kutatásban egyaránt.
                        </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="mb-2 font-semibold">BNC & COCA korpuszok</h3>
                            <p className="text-sm text-muted-foreground">
                                A lista a <strong className="text-foreground">British National Corpus (BNC)</strong> és a{' '}
                                <strong className="text-foreground">Corpus of Contemporary American English (COCA)</strong> adatain
                                alapul — több száz millió szót tartalmazó, gondosan összeállított szöveggyűjteményeken.
                            </p>
                        </div>

                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="mb-2 font-semibold">Paul Nation kutatása</h3>
                            <p className="text-sm text-muted-foreground">
                                A frekvencialisták összeállításában meghatározó szerepet játszott{' '}
                                <strong className="text-foreground">Paul Nation</strong>, a Victoria University of Wellington
                                professzora, akinek munkája a szókincs-fejlesztés tudományos alapjává vált.
                            </p>
                        </div>

                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="mb-2 font-semibold">1 000-es egységek</h3>
                            <p className="text-sm text-muted-foreground">
                                A szavak 10 darab, egyenként 1 000 szavas csoportba vannak rendezve, frekvencia szerint. Az első
                                2 000 szó a mindennapi kommunikáció alapját adja, a 10 000. szóig eljutva professzionális és
                                akadémiai szövegek is érthetővé válnak.
                            </p>
                        </div>

                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="mb-2 font-semibold">Szófaji kategóriák</h3>
                            <p className="text-sm text-muted-foreground">
                                A lista főneveket, igéket, mellékneveket és határozószókat is tartalmaz —{' '}
                                <strong className="text-foreground">headword</strong> (alapalak) formában tárolva, ami azt jelenti,
                                hogy például a <em>run</em> egyetlen bejegyzés, nem pedig külön a <em>runs</em>, <em>ran</em>,{' '}
                                <em>running</em>.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                {!auth.user && (
                    <section className="mx-auto max-w-5xl px-6 py-20 text-center">
                        <h2 className="mb-4 text-2xl font-bold tracking-tight">Készen állsz elkezdeni?</h2>
                        <p className="mb-8 text-muted-foreground">
                            Regisztrálj ingyen és kezdd el nyomon követni a szókincsed fejlődését.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                            {canRegister && (
                                <Button size="lg" asChild>
                                    <Link href={register()}>Ingyenes regisztráció</Link>
                                </Button>
                            )}
                            <Button size="lg" variant="outline" asChild>
                                <Link href={login()}>Már van fiókom</Link>
                            </Button>
                        </div>
                    </section>
                )}

                {/* Made by codebarley */}
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-16">
                        <div className="relative overflow-hidden rounded-2xl bg-zinc-900 px-8 py-12 text-white dark:bg-zinc-800">
                            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/5" />
                            <div className="absolute -bottom-20 -left-10 size-48 rounded-full bg-white/5" />
                            <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                                        <Code2 className="size-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-medium uppercase tracking-widest text-white/50">
                                            Fejlesztő
                                        </div>
                                        <div className="text-xl font-bold tracking-tight">
                                            codebarley.hu
                                        </div>
                                        <div className="mt-0.5 text-sm text-white/60">
                                            Webes megoldások, modern technológiákkal
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href="https://codebarley.hu"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-opacity hover:opacity-90"
                                >
                                    Megnézem
                                    <ExternalLink className="size-4 transition-transform group-hover:translate-x-0.5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                                <AppLogoIcon className="size-3.5 text-primary-foreground" />
                            </div>
                            <span>TopWords</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <span>Top 10 000 angol szó</span>
                            <span>·</span>
                            <a
                                href="https://codebarley.hu"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                            >
                                Készítette: codebarley.hu
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
