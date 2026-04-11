import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BookMarked,
    Brain,
    Check,
    CheckCheck,
    Clock,
    Code2,
    Download,
    ExternalLink,
    Filter,
    FlaskConical,
    FolderOpen,
    FolderPlus,
    Infinity,
    Layers,
    Lightbulb,
    Mail,
    Medal,
    Mic,
    MonitorSmartphone,
    MousePointer2,
    PencilLine,
    Puzzle,
    RefreshCw,
    Repeat2,
    ScanText,
    Settings2,
    Shuffle,
    Smartphone,
    Star,
    Swords,
    TrendingUp,
    Upload,
    Volume2,
    Youtube,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Button } from '@/components/ui/button';
import { dashboard, login, register, terms, privacy } from '@/routes';
import { index as wordsIndex } from '@/routes/words';

export default function Welcome({ canRegister = true }: { canRegister?: boolean }) {
    const { auth } = usePage().props;

    const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }
        const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (installPrompt as any).prompt();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { outcome } = await (installPrompt as any).userChoice;
        if (outcome === 'accepted') { setIsInstalled(true); setInstallPrompt(null); }
    };

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    const extensionSteps = [
        {
            title: 'Dupla kattintás + tartás',
            desc: 'Bármely weboldalon dupla kattints egy szóra, és tartsd nyomva fél másodpercig. Azonnal megjelenik a szó jelentése és a státusz gombok.',
            visual: (
                <div className="relative flex items-center justify-center rounded-xl border bg-card p-6 h-40">
                    <p className="text-base leading-8 text-center max-w-xs text-muted-foreground">
                        The <span className="relative cursor-pointer font-bold text-foreground underline decoration-dotted underline-offset-2">
                            between
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-primary animate-ping" />
                        </span> two cities lies a valley known for its{' '}
                        <span className="text-foreground/40">remarkable</span> landscape.
                    </p>
                </div>
            ),
        },
        {
            title: 'Option+W gyorsbillentyű',
            desc: 'Nyomd le az Option+W (Mac) vagy Alt+W (Windows) billentyűkombinációt, és megnyílik a keresőmező — gépeld be a szót és azonnal megkapod a jelentést.',
            visual: (
                <div className="flex items-center justify-center rounded-xl border bg-card p-6 h-40">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2">
                            <kbd className="rounded-md border border-b-2 bg-muted px-3 py-1.5 text-sm font-semibold shadow-sm">Option</kbd>
                            <span className="text-muted-foreground font-bold">+</span>
                            <kbd className="rounded-md border border-b-2 bg-muted px-3 py-1.5 text-sm font-semibold shadow-sm">W</kbd>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-2 shadow-md w-56">
                            <span className="text-muted-foreground text-sm">🔍</span>
                            <span className="text-sm text-muted-foreground">Keress egy szót…</span>
                            <span className="ml-auto text-xs text-muted-foreground/50">Esc</span>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Jobb kattintás menü',
            desc: 'Jelölj ki egy szót, kattints jobb gombbal, és válaszd a "Szó keresése" opciót — megnyílik a TopWords szólistája az adott szóra szűrve.',
            visual: (
                <div className="flex items-center justify-center rounded-xl border bg-card p-6 h-40">
                    <div className="flex flex-col gap-0 rounded-lg border bg-background shadow-xl overflow-hidden text-sm w-52">
                        <div className="px-3 py-2 text-muted-foreground/60 text-xs font-semibold uppercase tracking-wider bg-muted/40 border-b">Jobb kattintás menü</div>
                        <div className="px-3 py-2 flex items-center gap-2 bg-primary/10 text-primary font-medium border-b">
                            <CheckCheck className="size-3.5" />
                            Szó keresése: "between"
                        </div>
                        <div className="px-3 py-2 flex items-center gap-2 text-muted-foreground hover:bg-muted/40 border-b">
                            <ScanText className="size-3.5" />
                            Oldal szövegelemzése
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: 'Extension ikon → szövegelemzés',
            desc: 'Kattints az extension ikonjára a böngésző eszköztárában, és az aktuális oldal szövege automatikusan megnyílik a TopWords szövegelemzőjében.',
            visual: (
                <div className="flex items-center justify-center rounded-xl border bg-card p-6 h-40">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border bg-muted px-4 py-2 shadow-sm">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                                <AppLogoIcon className="size-3.5 text-primary-foreground" />
                            </div>
                            <span className="text-sm font-medium">TopWords</span>
                            <MousePointer2 className="size-4 text-primary ml-1" />
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground" />
                        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm shadow">
                            <ScanText className="size-3.5 text-primary" />
                            <span className="text-muted-foreground">Szövegelemzés megnyílik</span>
                        </div>
                    </div>
                </div>
            ),
        },
    ];

    return (
        <>
            <Head title="Top 10 000 angol szó – Tanuld meg a legfontosabb szavakat">
                <meta head-key="description" name="description" content="Tanuld meg a 10 000 leggyakoribb angol szót ingyen. Szólista, flashcard SRS rendszer és kvíz mód – egy helyen." />
                <meta head-key="og:title" property="og:title" content="TopWords – Top 10 000 angol szó ingyen" />
                <meta head-key="og:description" property="og:description" content="Tanuld meg a 10 000 leggyakoribb angol szót ingyen. Jelöld meg amit tudsz, amit tanulsz, és kövesd a haladásodat." />
                <meta head-key="og:url" property="og:url" content="https://topwords.eu/" />
                <meta head-key="twitter:title" name="twitter:title" content="TopWords – Top 10 000 angol szó ingyen" />
                <meta head-key="twitter:description" name="twitter:description" content="Tanuld meg a 10 000 leggyakoribb angol szót ingyen. Jelöld meg amit tudsz, amit tanulsz, és kövesd a haladásodat." />
            </Head>

            <div className="min-h-screen bg-background text-foreground">

                {/* Nav */}
                <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                                <AppLogoIcon className="size-4.5 text-primary-foreground" />
                            </div>
                            <div className="grid text-sm">
                                <span className="font-semibold leading-tight tracking-tight">TopWords</span>
                                <a href="https://codebarley.hu" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
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
                        <Star className="size-3 text-primary" />
                        A 10 000 leggyakoribb angol szó egy helyen — ingyen
                    </div>
                    <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                        Tanuld az angolt{' '}
                        <span className="text-primary">okosan és rendszeresen</span>
                    </h1>
                    <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
                        Szólista nyomon követéssel, flashcard SRS rendszerrel, kvíz móddal és Chrome extensionnel — minden, ami kell a hatékony szókincsfejlesztéshez.
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
                                        <Link href={register()}>
                                            Kezdés — ingyenes
                                            <ArrowRight className="size-4" />
                                        </Link>
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
                    <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x px-6 py-8 md:grid-cols-4">
                        {[
                            { value: '10 000', label: 'Angol szó' },
                            { value: 'SRS', label: 'Flashcard rendszer' },
                            { value: '29', label: 'Teljesítmény' },
                            { value: '100%', label: 'Ingyenes' },
                        ].map((stat) => (
                            <div key={stat.label} className="px-6 py-2 text-center first:pl-0 last:pr-0">
                                <div className="text-2xl font-bold tracking-tight md:text-3xl">{stat.value}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Feature overview */}
                <section className="mx-auto max-w-5xl px-6 py-20">
                    <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Minden, ami kell a hatékony tanuláshoz</h2>
                    <p className="mb-12 text-center text-muted-foreground">Válaszd a számodra legjobb módszert — vagy használd mindegyiket egyszerre</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            {
                                icon: CheckCheck,
                                color: 'bg-primary/10',
                                iconColor: 'text-primary',
                                title: 'Szólista & nyomon követés',
                                desc: 'Böngészd a 10 000 leggyakoribb szót, jelöld a tudásodat és szervezd mappákba.',
                            },
                            {
                                icon: Brain,
                                color: 'bg-violet-100 dark:bg-violet-950/40',
                                iconColor: 'text-violet-600 dark:text-violet-400',
                                title: 'Flashcard SRS',
                                desc: 'Saját kártyacsomag intelligens ismétlési algoritmussal — pontosan akkor mutatja, amikor el akarnád felejteni.',
                            },
                            {
                                icon: Swords,
                                color: 'bg-orange-100 dark:bg-orange-950/40',
                                iconColor: 'text-orange-600 dark:text-orange-400',
                                title: 'Kvíz mód',
                                desc: '4 válaszlehetőséges kvíz — szűrhető nehézség és státusz szerint.',
                            },
                            {
                                icon: ScanText,
                                color: 'bg-blue-100 dark:bg-blue-950/40',
                                iconColor: 'text-blue-600 dark:text-blue-400',
                                title: 'Szövegelemzés',
                                desc: 'Elemezz bármilyen szöveget, webcímet vagy YouTube videót — látod hány szót ismersz belőle.',
                            },
                            {
                                icon: Puzzle,
                                color: 'bg-rose-100 dark:bg-rose-950/40',
                                iconColor: 'text-rose-600 dark:text-rose-400',
                                title: 'Chrome Extension',
                                desc: 'Bármely weboldalon dupla kattintással vagy Option+W-vel azonnal keresés — popup-ban megjelenik a jelentés.',
                            },
                            {
                                icon: PencilLine,
                                color: 'bg-amber-100 dark:bg-amber-950/40',
                                iconColor: 'text-amber-600 dark:text-amber-400',
                                title: 'Saját szavak',
                                desc: 'Ha a top 10k-ban nem szerepel a szó, add hozzá saját szóként — ugyanúgy viselkedik, mint a lista többi tagja.',
                            },
                        ].map(({ icon: Icon, color, iconColor, title, desc }) => (
                            <div key={title} className="rounded-xl border bg-card p-5">
                                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                                    <Icon className={`size-5 ${iconColor}`} />
                                </div>
                                <h3 className="mb-1.5 font-semibold">{title}</h3>
                                <p className="text-sm text-muted-foreground">{desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Pricing — temporarily disabled
                <section className="border-t py-20">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="mb-12 text-center">
                            <h2 className="mb-3 text-3xl font-bold tracking-tight">Egyszerű árazás</h2>
                            <p className="text-muted-foreground">5 nap ingyenes próbaidőszak, utána döntsd el melyik csomag illik hozzád.</p>
                        </div>

                        <div className="grid gap-6 md:grid-cols-3">
                            <div className="rounded-2xl border bg-card p-6">
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-muted-foreground">Ingyenes</p>
                                    <p className="mt-1 text-3xl font-bold">0 Ft</p>
                                    <p className="mt-1 text-xs text-muted-foreground">örökké</p>
                                </div>
                                <ul className="mb-6 space-y-2.5">
                                    {['50 szó mentése', '10 saját szó', '1 flashcard pakli (max 20 kártya)', 'Napi 10 quiz kérdés', 'Napi 5 cloze feladat', 'Napi 2 szövegelemzés', 'Review & Achievements'].map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                                            <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link href={canRegister ? register() : login()}>
                                    <Button variant="outline" className="w-full">Regisztrálok ingyen</Button>
                                </Link>
                            </div>

                            <div className="relative rounded-2xl border-2 border-primary bg-card p-6">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Legnépszerűbb</span>
                                </div>
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-muted-foreground">Havi</p>
                                    <p className="mt-1 text-3xl font-bold">1 500 Ft</p>
                                    <p className="mt-1 text-xs text-muted-foreground">/ hónap · ~4 €</p>
                                </div>
                                <ul className="mb-6 space-y-2.5">
                                    {['Korlátlan szómentés', 'Korlátlan saját szó', 'Korlátlan flashcard pakli & kártya', 'Korlátlan quiz & cloze', 'Korlátlan szövegelemzés', 'Chrome extension státusz mentés', 'Minden jövőbeli funkció'].map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm">
                                            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Button className="w-full">Előfizetek</Button>
                            </div>

                            <div className="rounded-2xl border bg-card p-6">
                                <div className="mb-4">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-sm font-medium text-muted-foreground">Lifetime</p>
                                        <Star className="size-3.5 text-amber-500" />
                                    </div>
                                    <p className="mt-1 text-3xl font-bold">16 500 Ft</p>
                                    <p className="mt-1 text-xs text-muted-foreground">egyszeri fizetés · ~45 €</p>
                                </div>
                                <ul className="mb-6 space-y-2.5">
                                    {['Korlátlan szómentés', 'Korlátlan saját szó', 'Korlátlan flashcard pakli & kártya', 'Korlátlan quiz & cloze', 'Korlátlan szövegelemzés', 'Chrome extension státusz mentés', 'Minden jövőbeli funkció'].map((f) => (
                                        <li key={f} className="flex items-start gap-2 text-sm">
                                            <Check className="mt-0.5 size-4 shrink-0 text-amber-500" />
                                            {f}
                                        </li>
                                    ))}
                                    <li className="flex items-start gap-2 text-sm font-medium">
                                        <Infinity className="mt-0.5 size-4 shrink-0 text-amber-500" />
                                        Örökös hozzáférés
                                    </li>
                                </ul>
                                <Button variant="outline" className="w-full">Megveszem</Button>
                            </div>
                        </div>
                    </div>
                </section>
                */}

                {/* Word list section */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid items-center gap-12 md:grid-cols-2">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <CheckCheck className="size-3" />
                                    Szólista
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">Kövesd nyomon a szókincsed fejlődését</h2>
                                <p className="mb-6 text-muted-foreground">
                                    Minden szóhoz jelölheted, hol tartasz — a rendszer összeszámolja, és látod a valódi haladásodat.
                                </p>
                                <ul className="flex flex-col gap-3 text-sm">
                                    {[
                                        { icon: CheckCheck, color: 'text-primary', text: 'Tudom — jelöld meg a biztosan ismert szavakat' },
                                        { icon: Clock, color: 'text-blue-500', text: 'Tanulom — aktívan tanult szavak gyors elérése' },
                                        { icon: BookMarked, color: 'text-orange-500', text: 'Később — szavak elmentése visszatéréshez' },
                                        { icon: Mic, color: 'text-violet-500', text: 'Kiejtés — jelöld ha a kiejtés okoz gondot' },
                                        { icon: FolderPlus, color: 'text-primary', text: 'Mappák — rendezd témák szerint (pl. Utazás, Munka)' },
                                        { icon: Filter, color: 'text-primary', text: 'Szűrők — nehézség, státusz és mappa szerint' },
                                    ].map(({ icon: Icon, color, text }) => (
                                        <li key={text} className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                                <Icon className={`size-3 ${color}`} />
                                            </div>
                                            <span className="text-muted-foreground">{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="overflow-hidden rounded-xl border bg-card">
                                    <div className="flex items-center justify-between border-b px-4 py-3">
                                        <span className="text-sm font-medium">Szólista</span>
                                        <div className="flex gap-1.5">
                                            {['Összes', 'Tanulom', 'Tudom'].map((f) => (
                                                <span key={f} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${f === 'Összes' ? 'bg-primary text-primary-foreground' : 'border text-muted-foreground'}`}>{f}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {[
                                        { word: 'between', rank: 42, status: 'tudom' },
                                        { word: 'important', rank: 187, status: 'tanulom' },
                                        { word: 'different', rank: 234, status: null },
                                        { word: 'government', rank: 312, status: 'tudom' },
                                        { word: 'experience', rank: 418, status: 'később' },
                                    ].map(({ word, rank, status }) => (
                                        <div key={word} className="flex items-center justify-between border-b px-4 py-3 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 text-xs text-muted-foreground">#{rank}</span>
                                                <span className="text-sm font-medium">{word}</span>
                                            </div>
                                            {status === 'tudom' && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Tudom</span>}
                                            {status === 'tanulom' && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">Tanulom</span>}
                                            {status === 'később' && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">Később</span>}
                                            {!status && <span className="text-xs text-muted-foreground/50">—</span>}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    {[
                                        { name: 'Utazás', count: 42 },
                                        { name: 'Munka', count: 78 },
                                        { name: 'Vizsga', count: 115 },
                                    ].map((folder) => (
                                        <div key={folder.name} className="flex flex-1 items-center gap-2 rounded-lg border bg-card p-3">
                                            <FolderOpen className="size-4 shrink-0 text-primary" />
                                            <span className="truncate text-xs font-medium">{folder.name}</span>
                                            <span className="ml-auto text-xs text-muted-foreground">{folder.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Chrome Extension tutorial */}
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="mb-3 flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                <Puzzle className="size-3" />
                                Chrome Extension
                            </div>
                        </div>
                        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Tanuld a szavakat ott, ahol találkozol velük</h2>
                        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
                            A Chrome extension segítségével bármely weboldalon — híroldalon, YouTube-on, Redditen — azonnal megkeresheted az ismeretlen szavakat anélkül, hogy elhagynád az oldalt.
                        </p>

                        {/* Interactive step tutorial */}
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                {extensionSteps.map((step, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveStep(i)}
                                        className={`rounded-xl border p-4 text-left transition-all ${activeStep === i ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/40'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${activeStep === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                {i + 1}
                                            </span>
                                            <div>
                                                <p className={`text-sm font-semibold ${activeStep === i ? 'text-foreground' : 'text-muted-foreground'}`}>{step.title}</p>
                                                {activeStep === i && (
                                                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div>
                                {extensionSteps[activeStep].visual}
                                <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                                    <p className="mb-0.5 text-xs font-semibold text-foreground">{extensionSteps[activeStep].title}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{extensionSteps[activeStep].desc}</p>
                                </div>
                            </div>
                        </div>

                        {/* Popup preview */}
                        <div className="mt-12 rounded-2xl border bg-muted/40 p-8">
                            <h3 className="mb-2 text-center font-semibold">Így néz ki a popup</h3>
                            <p className="mb-8 text-center text-sm text-muted-foreground">Dupla kattintás + tartás, vagy keresőből megnyitva — kompakt popup jelenik meg a szó felett</p>
                            <div className="flex flex-wrap items-start justify-center gap-6">
                                {/* Found popup */}
                                <div className="w-64">
                                    <p className="mb-2 text-center text-xs font-medium text-muted-foreground">Ismert szó</p>
                                    <div className="overflow-hidden rounded-xl border bg-white shadow-xl dark:bg-zinc-900">
                                        <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
                                            <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">between</span>
                                            <span className="text-xs italic text-zinc-400">prep</span>
                                            <span className="ml-auto text-xs text-zinc-300">#42</span>
                                            <button className="ml-1 flex size-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">×</button>
                                        </div>
                                        <div className="px-3.5 py-3">
                                            <p className="mb-1.5 text-sm text-zinc-600 dark:text-zinc-300">között, -ek között</p>
                                            <p className="mb-2.5 text-xs text-zinc-400">in the middle of</p>
                                            <div className="mb-2.5 flex flex-wrap gap-1.5">
                                                {[
                                                    { label: 'Tanulom', color: '#3b82f6' },
                                                    { label: 'Mentett', color: '#f97316' },
                                                    { label: 'Tudom', color: '#22c55e', active: true },
                                                    { label: 'Kiejtés', color: '#8b5cf6' },
                                                ].map(({ label, color, active }) => (
                                                    <button
                                                        key={label}
                                                        style={active ? { background: color, borderColor: color, color: '#fff' } : {}}
                                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${active ? '' : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="border-t pt-2">
                                                <span className="text-xs text-indigo-500 underline underline-offset-2 cursor-pointer">Megnyitás →</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Search modal preview */}
                                <div className="w-72">
                                    <p className="mb-2 text-center text-xs font-medium text-muted-foreground">Option+W keresőmodal</p>
                                    <div className="overflow-hidden rounded-xl border bg-white shadow-xl dark:bg-zinc-900">
                                        <div className="flex items-center gap-2 border-b px-3.5 py-3">
                                            <span className="text-zinc-400">🔍</span>
                                            <span className="flex-1 text-sm text-zinc-400">important</span>
                                            <span className="text-xs text-zinc-300">Alt+W</span>
                                        </div>
                                        {[
                                            { word: 'important', meaning: 'fontos', rank: 187, status: 'tanulom', color: '#3b82f6' },
                                            { word: 'importance', meaning: 'fontosság', rank: 892, status: null, color: null },
                                            { word: 'importantly', meaning: 'fontosan', rank: 1240, status: null, color: null },
                                        ].map(({ word, meaning, rank, status, color }) => (
                                            <div key={word} className="flex items-center gap-3 border-b px-3.5 py-2.5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{word}</p>
                                                    <p className="text-xs text-zinc-500 truncate">{meaning}</p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="text-[10px] text-zinc-300">#{rank}</span>
                                                    {status && color && (
                                                        <span style={{ background: color }} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white">
                                                            {status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Not found popup */}
                                <div className="w-64">
                                    <p className="mb-2 text-center text-xs font-medium text-muted-foreground">Ismeretlen szó — hozzáadás</p>
                                    <div className="overflow-hidden rounded-xl border bg-white shadow-xl dark:bg-zinc-900">
                                        <div className="flex items-center justify-between border-b px-3.5 py-2.5">
                                            <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">serendipity</span>
                                            <a href="#" className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-500">
                                                🔍 Google AI
                                            </a>
                                        </div>
                                        <div className="px-3.5 py-3 flex flex-col gap-2">
                                            <select className="w-full rounded-lg border px-2 py-1.5 text-xs text-zinc-500 bg-white dark:bg-zinc-900 dark:border-zinc-700">
                                                <option>Szófaj (opcionális)</option>
                                            </select>
                                            <input className="w-full rounded-lg border px-2 py-1.5 text-xs placeholder-zinc-400 dark:bg-zinc-900 dark:border-zinc-700" placeholder="Magyar jelentés" />
                                            <input className="w-full rounded-lg border px-2 py-1.5 text-xs placeholder-zinc-400 dark:bg-zinc-900 dark:border-zinc-700" placeholder="Példamondat (angol)" />
                                            <button className="mt-1 w-full rounded-lg bg-indigo-500 py-1.5 text-xs font-semibold text-white">Hozzáadás</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Install extension */}
                        <div className="mt-8 rounded-2xl border bg-muted/40 p-8">
                            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
                                <div className="flex-1">
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/40">
                                            <Puzzle className="size-5 text-rose-600 dark:text-rose-400" />
                                        </div>
                                        <h3 className="font-semibold">Hogyan telepítsd az extensiont?</h3>
                                    </div>
                                    <p className="mb-4 text-sm text-muted-foreground">
                                        Az extension egyelőre fejlesztői módban érhető el. Hamarosan felkerül a Chrome Web Store-ba is.
                                    </p>
                                </div>
                                <div className="shrink-0 md:w-80">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telepítés lépései</p>
                                    <ol className="flex flex-col gap-2 text-sm">
                                        {[
                                            { n: 1, text: 'Nyisd meg: chrome://extensions' },
                                            { n: 2, text: 'Kapcsold be a Fejlesztői módot (jobb felső sarok)' },
                                            { n: 3, text: 'Kattints: Kicsomagolt bővítmény betöltése' },
                                            { n: 4, text: 'Válaszd ki a letöltött chrome-extension mappát' },
                                        ].map(({ n, text }) => (
                                            <li key={n} className="flex gap-3">
                                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">{n}</span>
                                                <span className="text-xs leading-5 text-muted-foreground">{text}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Flashcard SRS section */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="mb-3 flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                <Brain className="size-3" />
                                Flashcard SRS
                            </div>
                        </div>
                        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Intelligens ismétlési rendszer — mint az Anki</h2>
                        <p className="mb-12 mx-auto max-w-2xl text-center text-muted-foreground">
                            Az SRS algoritmus pontosan kiszámolja, mikor kell ismételned — így nem pazarolsz időt arra, amit már tudsz.
                        </p>

                        <div className="mb-12 mx-auto max-w-sm">
                            <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
                                <div className="border-b px-6 pb-4 pt-6 text-center">
                                    <p className="mb-1 text-xs text-muted-foreground">Deck: Angol alapszavak · 12/40</p>
                                    <p className="mb-2 mt-4 text-3xl font-bold tracking-tight">between</p>
                                    <p className="text-sm text-muted-foreground">/bɪˈtwiːn/</p>
                                    <div className="mt-4 border-t pt-4">
                                        <p className="text-lg font-medium">között, -ek között</p>
                                        <p className="mt-1 text-xs italic text-muted-foreground">"between you and me"</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 divide-x">
                                    {[
                                        { label: 'Újra', sub: '1 perc', color: 'text-red-600 dark:text-red-400' },
                                        { label: 'Nehéz', sub: '6 nap', color: 'text-orange-600 dark:text-orange-400' },
                                        { label: 'Jó', sub: '10 nap', color: 'text-blue-600 dark:text-blue-400' },
                                        { label: 'Könnyű', sub: '15 nap', color: 'text-green-600 dark:text-green-400' },
                                    ].map(({ label, sub, color }) => (
                                        <div key={label} className={`cursor-pointer py-3 text-center transition-colors hover:bg-muted/50 ${color}`}>
                                            <div className="text-xs font-semibold">{label}</div>
                                            <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                { icon: Layers, title: 'Saját deck-ek', desc: 'Tetszőleges számú kártyacsomagot hozhatsz létre különböző témákhoz. Mappákkal is szervezheted.' },
                                { icon: Repeat2, title: 'Kétirányú kártyák', desc: 'Előlap→hátlap, hátlap→előlap, vagy mindkét irány — külön-külön értékeli az algoritmus.' },
                                { icon: Volume2, title: 'Hangos felolvasás', desc: 'Az előlap és hátlap szövege felolvasható — tanuld a helyes kiejtést is egyszerre.' },
                                { icon: Shuffle, title: 'Kártyák keverése', desc: 'Bekapcsolható keverés — így kétoldalú kártyáknál az előlap és hátlap nem kerül egymás mellé.' },
                                { icon: Upload, title: 'Import a szólistáról', desc: 'A TopWords szólistájából egy kattintással importálhatsz kártyát a meglévő definíciókkal.' },
                                { icon: Download, title: 'CSV import / export', desc: 'Importálj kártyákat CSV fájlból, vagy exportáld a deckjed — kompatibilis más alkalmazásokkal.' },
                                { icon: Settings2, title: 'Deckenként testreszabható', desc: 'Minden decknek saját beállítása: napi korlát, tanulási lépések, ease faktorok, keverés.' },
                                { icon: TrendingUp, title: 'Haladás nyomon követése', desc: 'Minden kártya státusza látható: Új · Tanulás · Ismétlés · Újratanulás — és mikor esedékes.' },
                                { icon: RefreshCw, title: 'Leech detektálás', desc: 'A sokat tévesztett kártyákat automatikusan jelöli, hogy tudd, hol érdemes más módszert alkalmazni.' },
                            ].map(({ icon: Icon, title, desc }) => (
                                <div key={title} className="flex gap-4 rounded-xl border bg-card p-5">
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
                                        <Icon className="size-4 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 text-sm font-semibold">{title}</h3>
                                        <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-12 rounded-2xl border bg-muted/40 p-8">
                            <h3 className="mb-2 text-center font-semibold">Hogyan működik az SRS algoritmus?</h3>
                            <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-muted-foreground">
                                Minden értékelés után kiszámolja, mikor kellene visszamutatnia a kártyát — ha könnyen ment, tovább vár; ha nehéz volt, hamarabb visszahozza.
                            </p>
                            <div className="grid gap-4 text-center sm:grid-cols-4">
                                {[
                                    { label: 'Újra', color: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30', textColor: 'text-red-700 dark:text-red-400', sub: 'Visszakerül a tanulási lépések elejére' },
                                    { label: 'Nehéz', color: 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30', textColor: 'text-orange-700 dark:text-orange-400', sub: 'Kisebb intervallum, csökkenő ease' },
                                    { label: 'Jó', color: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30', textColor: 'text-blue-700 dark:text-blue-400', sub: 'Intervallum nő az ease faktor alapján' },
                                    { label: 'Könnyű', color: 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30', textColor: 'text-green-700 dark:text-green-400', sub: 'Tovább vár, ease faktor nő' },
                                ].map(({ label, color, textColor, sub }) => (
                                    <div key={label} className={`rounded-xl border p-4 ${color}`}>
                                        <div className={`mb-1 text-base font-bold ${textColor}`}>{label}</div>
                                        <p className="text-xs text-muted-foreground">{sub}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quiz section */}
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid items-center gap-12 md:grid-cols-2">
                            <div className="flex flex-col gap-3">
                                <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
                                    <p className="mb-1 text-xs text-muted-foreground">#42 · Kezdő szint</p>
                                    <p className="text-3xl font-bold tracking-tight">between</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Mi a magyar jelentése?</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'között', correct: true },
                                        { label: 'felett', correct: false },
                                        { label: 'mellett', correct: false },
                                        { label: 'mögött', correct: false },
                                    ].map((opt) => (
                                        <div
                                            key={opt.label}
                                            className={`rounded-lg border px-4 py-2.5 text-center text-sm font-medium ${
                                                opt.correct
                                                    ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                                    : 'bg-background text-muted-foreground opacity-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <Swords className="size-3" />
                                    Kvíz mód
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">Teszteld magad kvíz módban</h2>
                                <p className="mb-6 text-muted-foreground">
                                    Válaszd ki melyik szavakból és hányból kvízzeljünk — a rendszer automatikusan generálja a kérdéseket és a válaszlehetőségeket.
                                </p>
                                <ul className="flex flex-col gap-3 text-sm">
                                    {[
                                        { icon: CheckCheck, text: 'Szűrj státusz szerint – tanulom, elmentettem, tudom' },
                                        { icon: TrendingUp, text: 'Válassz nehézségi szintet – kezdőtől haladóig' },
                                        { icon: Zap, text: '10, 20, 50 kérdés – vagy az összes elérhető szó egyszerre' },
                                        { icon: FolderOpen, text: 'Mappa szerint – csak egy adott témából kvízzelhetsz' },
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
                        </div>
                    </div>
                </section>

                {/* Text Analysis */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid items-center gap-12 md:grid-cols-2">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <ScanText className="size-3" />
                                    Szövegelemzés
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">Elemezz bármilyen angol szöveget</h2>
                                <p className="mb-6 text-muted-foreground">
                                    Illeszd be a szöveget, adj meg egy webcímet — vagy egy YouTube videót — és az alkalmazás azonnal megmutatja, mennyit értesz belőle.
                                </p>
                                <ul className="flex flex-col gap-3 text-sm">
                                    {[
                                        { icon: CheckCheck, color: 'text-primary', text: 'Érthetőség % — látod, hány szót ismersz a szövegben' },
                                        { icon: ScanText, color: 'text-primary', text: 'Kiemelés — zölddel, kékkel, pirossal jelöli a szavakat státusz szerint' },
                                        { icon: Youtube, color: 'text-red-500', text: 'YouTube felirat — bármely videó angol felirata elemezhető' },
                                        { icon: PencilLine, color: 'text-violet-500', text: 'Szóra kattintva — megjelenítés, státusz változtatás, saját szóként mentés' },
                                        { icon: Clock, color: 'text-blue-500', text: 'Előzmények — az utolsó 10 elemzés automatikusan mentve' },
                                    ].map(({ icon: Icon, color, text }) => (
                                        <li key={text} className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                                <Icon className={`size-3 ${color}`} />
                                            </div>
                                            <span className="text-muted-foreground">{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                                    <span className="text-sm font-medium">Szövegelemzés</span>
                                    <span className="text-2xl font-bold text-green-600">87%</span>
                                </div>
                                <div className="border-b px-4 py-3">
                                    <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
                                        <div className="h-2 rounded-full bg-green-500" style={{ width: '87%' }} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">312 ismert szó / 358 szó összesen</p>
                                </div>
                                <div className="px-4 py-4 text-sm leading-7">
                                    <p className="text-sm">
                                        <span className="rounded bg-green-100 px-0.5 text-green-900 dark:bg-green-900/40 dark:text-green-300">The</span>
                                        {' '}
                                        <span className="rounded bg-green-100 px-0.5 text-green-900 dark:bg-green-900/40 dark:text-green-300">quick</span>
                                        {' '}
                                        <span className="rounded bg-blue-100 px-0.5 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300">brown</span>
                                        {' '}
                                        <span className="rounded bg-red-100 px-0.5 text-red-900 dark:bg-red-900/40 dark:text-red-300">fox</span>
                                        {' '}
                                        <span className="rounded bg-green-100 px-0.5 text-green-900 dark:bg-green-900/40 dark:text-green-300">jumps</span>
                                        {' over the '}
                                        <span className="rounded bg-green-100 px-0.5 text-green-900 dark:bg-green-900/40 dark:text-green-300">lazy</span>
                                        {' dog.'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-green-400" /> Tudom</span>
                                    <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-blue-400" /> Tanulom</span>
                                    <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-red-400" /> Top 10k, ismeretlen</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Custom Words + Achievements */}
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid gap-12 md:grid-cols-2">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <PencilLine className="size-3" />
                                    Saját szavak
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">Add hozzá a saját szavaidat</h2>
                                <p className="mb-5 text-sm text-muted-foreground">
                                    Ha olyan szóval találkozol, ami nincs a top 10 000-ben, saját szóként felveheted — ugyanúgy viselkedik, mint a lista többi tagja.
                                </p>
                                <ul className="flex flex-col gap-2.5 text-sm">
                                    {[
                                        'Magyar jelentés, szófaj, szinonimák és példamondat tárolható',
                                        'Igealakok, főnév többes szám, melléknév fokozás',
                                        'Státuszok: Tudom, Tanulom, Később, Kiejtés',
                                        'Megjelenik a szólistában és az elemzésben is',
                                        'Flashcard paklikba importálható',
                                        'Extension-ből egyenesen hozzáadható Google AI segítségével',
                                    ].map((text) => (
                                        <li key={text} className="flex items-start gap-2.5">
                                            <CheckCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                                            <span className="text-muted-foreground">{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <Medal className="size-3" />
                                    Teljesítmények
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">29 teljesítmény vár rád</h2>
                                <p className="mb-5 text-sm text-muted-foreground">
                                    Minden fontos mérföldkőhöz jár egy achievement — sorozat, szókincs, flashcard, kvíz és szövegelemzés kategóriákban.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { icon: '🔥', title: '7 napos sorozat', desc: '7 egymást követő nap' },
                                        { icon: '✅', title: '100 szót tudom', desc: '100 ismert szó' },
                                        { icon: '🃏', title: '100 flashcard', desc: '100 kártya tanulva' },
                                        { icon: '⭐', title: 'Tökéletes kvíz', desc: 'Minden válasz helyes' },
                                        { icon: '📄', title: 'Folyékony olvasó', desc: '90%+ érthetőség' },
                                        { icon: '✏️', title: '10 saját szó', desc: '10 egyéni szó' },
                                    ].map((a) => (
                                        <div key={a.title} className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5">
                                            <span className="text-xl">{a.icon}</span>
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold">{a.title}</p>
                                                <p className="truncate text-[10px] text-muted-foreground">{a.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Install as app */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="mb-3 flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                <MonitorSmartphone className="size-3" />
                                Telepítés
                            </div>
                        </div>
                        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Használd alkalmazásként</h2>
                        <p className="mx-auto mb-12 max-w-xl text-center text-muted-foreground">
                            Nincs App Store, nincs Play Store — telepítsd közvetlenül a böngészőből, és úgy néz ki mint egy natív alkalmazás.
                        </p>

                        <div className="grid gap-6 md:grid-cols-3">
                            {/* Chrome / Edge */}
                            <div className="rounded-xl border bg-card p-6">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40">
                                    <MonitorSmartphone className="size-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="mb-1 font-semibold">Chrome / Edge (asztali)</h3>
                                <p className="mb-4 text-xs text-muted-foreground">A böngésző azonnal felajánlja a telepítést.</p>
                                <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                    <li className="flex gap-2"><span className="font-bold text-foreground">1.</span> Nyisd meg az oldalt Chrome-ban vagy Edge-ben</li>
                                    <li className="flex gap-2"><span className="font-bold text-foreground">2.</span> Kattints a <strong className="text-foreground">Telepítés</strong> ikonra a böngésző címsorában (⊕)</li>
                                    <li className="flex gap-2"><span className="font-bold text-foreground">3.</span> Erősítsd meg — az alkalmazás megjelenik az asztalon</li>
                                </ol>
                                {isInstalled ? (
                                    <div className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-400">
                                        ✓ Az alkalmazás már telepítve van
                                    </div>
                                ) : installPrompt ? (
                                    <button
                                        onClick={handleInstall}
                                        className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                    >
                                        Telepítés most
                                    </button>
                                ) : null}
                            </div>

                            {/* Android */}
                            <div className="rounded-xl border bg-card p-6">
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-950/40">
                                    <Smartphone className="size-5 text-green-600 dark:text-green-400" />
                                </div>
                                <h3 className="mb-1 font-semibold">Android (Chrome)</h3>
                                <p className="mb-4 text-xs text-muted-foreground">Chrome automatikusan felajánlja a telepítést.</p>
                                <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                    <li className="flex gap-2"><span className="font-bold text-foreground">1.</span> Nyisd meg az oldalt Chrome-ban</li>
                                    <li className="flex gap-2"><span className="font-bold text-foreground">2.</span> Koppints a <strong className="text-foreground">Hozzáadás a kezdőképernyőhöz</strong> értesítésre</li>
                                    <li className="flex gap-2"><span className="font-bold text-foreground">3.</span> Vagy: ⋮ menü → <strong className="text-foreground">Alkalmazás telepítése</strong></li>
                                </ol>
                            </div>

                            {/* iOS */}
                            <div className={`rounded-xl border bg-card p-6 ${isIOS ? 'ring-2 ring-primary' : ''}`}>
                                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                                    <Smartphone className="size-5 text-gray-600 dark:text-gray-400" />
                                </div>
                                <h3 className="mb-1 font-semibold">iPhone / iPad (Safari)</h3>
                                <p className="mb-4 text-xs text-muted-foreground">iOS-on Safari-t kell használni a telepítéshez.</p>
                                <ol className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                                    <li className="flex gap-2"><span className="font-bold text-foreground">1.</span> Nyisd meg az oldalt <strong className="text-foreground">Safari</strong>-ban</li>
                                    <li className="flex gap-2"><span className="font-bold text-foreground">2.</span> Koppints a <strong className="text-foreground">Megosztás</strong> ikonra (⎙)</li>
                                    <li className="flex gap-2"><span className="font-bold text-foreground">3.</span> Válaszd: <strong className="text-foreground">Hozzáadás a kezdőképernyőhöz</strong></li>
                                </ol>
                                {isIOS && (
                                    <div className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                                        Safari-t használsz — kövesd a fenti lépéseket!
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Why frequency */}
                <section className="border-t">
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
                            <div className="flex flex-col gap-3">
                                {[
                                    { label: 'Kezdő', range: '1–2 000', color: 'bg-primary/40', width: '20%', desc: 'Alapvető szavak, amelyek nélkül nem boldogulsz' },
                                    { label: 'Középhaladó', range: '2 001–6 000', color: 'bg-primary/70', width: '50%', desc: 'A hétköznapi kommunikáció szókincse' },
                                    { label: 'Haladó', range: '6 001–10 000', color: 'bg-primary', width: '100%', desc: 'Ritkább, de hasznos szavak' },
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
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="mb-10 text-center">
                            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                <FlaskConical className="size-3" />
                                Tudományosan megalapozott
                            </div>
                            <h2 className="mb-3 text-2xl font-bold tracking-tight">Honnan származik a szólista?</h2>
                            <p className="mx-auto max-w-2xl text-muted-foreground">
                                A 10 000 leggyakoribb angol szó nem véletlenszerűen összeválogatott lista — korpusznyelvészeti
                                kutatások eredménye, amelyet évtizedek óta használnak nyelvoktatásban és kutatásban.
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
                                    <strong className="text-foreground">headword</strong> formában tárolva, ami azt jelenti,
                                    hogy pl. a <em>run</em> egyetlen bejegyzés, nem pedig külön a <em>runs</em>, <em>ran</em>,{' '}
                                    <em>running</em>.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                {!auth.user && (
                    <section className="border-t">
                        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
                            <h2 className="mb-4 text-2xl font-bold tracking-tight">Készen állsz elkezdeni?</h2>
                            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                                Regisztrálj ingyen — szólista, flashcard SRS, kvíz mód és Chrome extension azonnal elérhető, fizetős funkció nincs.
                            </p>
                            <div className="flex flex-wrap justify-center gap-3">
                                {canRegister && (
                                    <Button size="lg" asChild>
                                        <Link href={register()} className="gap-2">
                                            Ingyenes regisztráció
                                            <ArrowRight className="size-4" />
                                        </Link>
                                    </Button>
                                )}
                                <Button size="lg" variant="outline" asChild>
                                    <Link href={login()}>Már van fiókom</Link>
                                </Button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Feedback */}
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-16">
                        <div className="rounded-2xl border bg-muted/40 px-8 py-10">
                            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Lightbulb className="size-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 font-semibold">Fejlesztési ötleted van, vagy hibát találtál?</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Szívesen fogadom a visszajelzéseket — legyen az új funkció ötlete, apró hiba vagy bármi más.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                                    <a href="https://codebarley.hu" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
                                        <ExternalLink className="size-4" />
                                        codebarley.hu
                                    </a>
                                    <a href="mailto:info@codebarley.hu" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                                        <Mail className="size-4" />
                                        info@codebarley.hu
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Made by */}
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
                                        <div className="text-xs font-medium uppercase tracking-widest text-white/50">Fejlesztő</div>
                                        <div className="text-xl font-bold tracking-tight">codebarley.hu</div>
                                        <div className="mt-0.5 text-sm text-white/60">Webes megoldások, modern technológiákkal</div>
                                    </div>
                                </div>
                                <a href="https://codebarley.hu" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-opacity hover:opacity-90">
                                    Megnézem
                                    <ExternalLink className="size-4 transition-transform group-hover:translate-x-0.5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="border-t">
                    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                                <AppLogoIcon className="size-3.5 text-primary-foreground" />
                            </div>
                            <span>TopWords</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <Link href={terms()} className="transition-colors hover:text-foreground">ÁSZF</Link>
                            <span>·</span>
                            <Link href={privacy()} className="transition-colors hover:text-foreground">Adatkezelés</Link>
                            <span>·</span>
                            <a href="https://codebarley.hu" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                                Készítette: codebarley.hu
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
