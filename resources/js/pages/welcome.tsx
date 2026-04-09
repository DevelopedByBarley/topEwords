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
    MonitorSmartphone,
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
import { dashboard, login, register, terms, privacy, pricing } from '@/routes';
import { index as wordsIndex } from '@/routes/words';

export default function Welcome({ canRegister = true }: { canRegister?: boolean }) {
    const { auth } = usePage().props;

    const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

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
                <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                                <AppLogoIcon className="size-4.5 text-primary-foreground" />
                            </div>
                            <div className="grid text-sm">
                                <span className="font-semibold tracking-tight leading-tight">TopWords</span>
                                <a href="https://codebarley.hu" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
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
                        Tanuld az angolt{' '}
                        <span className="text-primary">okosan és rendszeresen</span>
                    </h1>
                    <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
                        Szólista nyomon követéssel, flashcard SRS rendszerrel és kvíz móddal — minden, ami kell a hatékony szókincsfejlesztéshez. Ingyenes.
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
                    <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x md:grid-cols-4 px-6 py-8">
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

                {/* Three pillars */}
                <section className="mx-auto max-w-5xl px-6 py-20">
                    <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Háromféle tanulási mód egy helyen</h2>
                    <p className="mb-12 text-center text-muted-foreground">Válassz a számodra legjobb módszer szerint — vagy használd mindegyiket egyszerre</p>
                    <div className="grid gap-6 md:grid-cols-3">
                        {[
                            {
                                icon: CheckCheck,
                                color: 'bg-[#00ADB5]/15 dark:bg-[#00ADB5]/20',
                                iconColor: 'text-[#00ADB5]',
                                title: 'Szólista & nyomon követés',
                                desc: 'Böngészd a 10 000 leggyakoribb angol szót, jelöld meg a tudásodat és szervezd mappákba.',
                            },
                            {
                                icon: Brain,
                                color: 'bg-violet-100 dark:bg-violet-950/40',
                                iconColor: 'text-violet-600 dark:text-violet-400',
                                title: 'Flashcard SRS',
                                desc: 'Saját kártyacsomag, intelligens ismétlési algoritmussal — pontosan akkor mutatja a kártyát, amikor el akarnád felejteni.',
                            },
                            {
                                icon: Swords,
                                color: 'bg-orange-100 dark:bg-orange-950/40',
                                iconColor: 'text-orange-600 dark:text-orange-400',
                                title: 'Kvíz mód',
                                desc: 'Teszteld magad 4 válaszlehetőséges kvízzel — szűrhető nehézségi szint és státusz szerint.',
                            },
                        ].map(({ icon: Icon, color, iconColor, title, desc }) => (
                            <div key={title} className="rounded-xl border bg-card p-6">
                                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
                                    <Icon className={`size-5 ${iconColor}`} />
                                </div>
                                <h3 className="mb-2 font-semibold">{title}</h3>
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
                                <Link href={pricing()}>
                                    <Button className="w-full">Előfizetek</Button>
                                </Link>
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
                                <Link href={pricing()}>
                                    <Button variant="outline" className="w-full">Megveszem</Button>
                                </Link>
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
                                        { icon: CheckCheck, color: 'text-[#00ADB5]', text: 'Tudom — jelöld meg a biztosan ismert szavakat' },
                                        { icon: Clock, color: 'text-blue-500', text: 'Tanulom — aktívan tanult szavak gyors elérése' },
                                        { icon: BookMarked, color: 'text-orange-500', text: 'Később — szavak elmentése visszatéréshez' },
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
                                {/* Word list mockup */}
                                <div className="rounded-xl border bg-card overflow-hidden">
                                    <div className="border-b px-4 py-3 flex items-center justify-between">
                                        <span className="text-sm font-medium">Szólista</span>
                                        <div className="flex gap-1.5">
                                            {['Összes', 'Tanulom', 'Tudom'].map((f) => (
                                                <span key={f} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${f === 'Összes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground border'}`}>{f}</span>
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
                                        <div key={word} className="flex items-center justify-between border-b last:border-0 px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground w-8">#{rank}</span>
                                                <span className="font-medium text-sm">{word}</span>
                                            </div>
                                            {status === 'tudom' && <span className="text-xs font-medium text-[#00ADB5] bg-[#00ADB5]/10 px-2 py-0.5 rounded-full">Tudom</span>}
                                            {status === 'tanulom' && <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">Tanulom</span>}
                                            {status === 'később' && <span className="text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40 px-2 py-0.5 rounded-full">Később</span>}
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
                                            <FolderOpen className="size-4 text-primary shrink-0" />
                                            <span className="text-xs font-medium truncate">{folder.name}</span>
                                            <span className="ml-auto text-xs text-muted-foreground">{folder.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Flashcard SRS section */}
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="mb-3 flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                <Brain className="size-3" />
                                Flashcard SRS
                            </div>
                        </div>
                        <h2 className="mb-3 text-center text-2xl font-bold tracking-tight">Intelligens ismétlési rendszer — mint az Anki</h2>
                        <p className="mb-12 text-center text-muted-foreground max-w-2xl mx-auto">
                            Az SRS (Spaced Repetition System) algoritmus pontosan kiszámolja, mikor kell ismételned egy kártyát — így nem pazarolsz időt arra, amit már tudsz.
                        </p>

                        {/* Study card mockup */}
                        <div className="mb-16 mx-auto max-w-sm">
                            <div className="rounded-2xl border bg-card shadow-lg overflow-hidden">
                                <div className="px-6 pt-6 pb-4 text-center border-b">
                                    <p className="text-xs text-muted-foreground mb-1">Deck: Angol alapszavak · 12/40</p>
                                    <p className="text-3xl font-bold tracking-tight mt-4 mb-2">between</p>
                                    <p className="text-sm text-muted-foreground">/bɪˈtwiːn/</p>
                                    <div className="mt-4 pt-4 border-t">
                                        <p className="text-lg font-medium">között, -ek között</p>
                                        <p className="text-xs text-muted-foreground mt-1 italic">"between you and me"</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 divide-x">
                                    {[
                                        { label: 'Újra', sub: '1 perc', color: 'text-red-600 dark:text-red-400' },
                                        { label: 'Nehéz', sub: '6 nap', color: 'text-orange-600 dark:text-orange-400' },
                                        { label: 'Jó', sub: '10 nap', color: 'text-blue-600 dark:text-blue-400' },
                                        { label: 'Könnyű', sub: '15 nap', color: 'text-green-600 dark:text-green-400' },
                                    ].map(({ label, sub, color }) => (
                                        <div key={label} className={`py-3 text-center cursor-pointer hover:bg-muted/50 transition-colors ${color}`}>
                                            <div className="text-xs font-semibold">{label}</div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Feature grid */}
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                {
                                    icon: Layers,
                                    title: 'Saját deck-ek',
                                    desc: 'Hozz létre tetszőleges számú kártyacsomagot különböző témákhoz. Mappákkal is szervezheted őket.',
                                },
                                {
                                    icon: Repeat2,
                                    title: 'Kétirányú kártyák',
                                    desc: 'Minden kártya mehet előlap→hátlap, hátlap→előlap irányban, vagy mindkét irányban — külön-külön értékeli az algoritmus.',
                                },
                                {
                                    icon: Volume2,
                                    title: 'Hangos felolvasás',
                                    desc: 'Az előlap és hátlap szövege felolvasható — tanuld a helyes kiejtést is egyszerre.',
                                },
                                {
                                    icon: Shuffle,
                                    title: 'Kártyák keverése',
                                    desc: 'Bekapcsolható keverés — így kétoldalú kártyáknál az előlap és hátlap nem kerül egymás mellé.',
                                },
                                {
                                    icon: Upload,
                                    title: 'Import a szólistáról',
                                    desc: 'A TopWords szólistájából egy kattintással importálhatsz kártyát a meglévő definíciókkal és példamondatokkal.',
                                },
                                {
                                    icon: Download,
                                    title: 'CSV import / export',
                                    desc: 'Importálj kártyákat CSV fájlból, vagy exportáld a deckjed — kompatibilis más alkalmazásokkal is.',
                                },
                                {
                                    icon: Settings2,
                                    title: 'Deckenként testreszabható',
                                    desc: 'Minden decknek saját beállítása lehet — napi korlát, tanulási lépések, ease faktorok, keverés.',
                                },
                                {
                                    icon: TrendingUp,
                                    title: 'Haladás nyomon követése',
                                    desc: 'Minden kártya státusza látható: Új · Tanulás · Ismétlés · Újratanulás — és mikor esedékes.',
                                },
                                {
                                    icon: RefreshCw,
                                    title: 'Leech detektálás',
                                    desc: 'A sokat tévesztett kártyákat a rendszer automatikusan jelöli, hogy tudd, hol érdemes más módszert alkalmazni.',
                                },
                            ].map(({ icon: Icon, title, desc }) => (
                                <div key={title} className="flex gap-4 rounded-xl border bg-card p-5">
                                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
                                        <Icon className="size-4 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <h3 className="mb-1 text-sm font-semibold">{title}</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* SRS explanation */}
                        <div className="mt-12 rounded-2xl border bg-muted/40 p-8">
                            <h3 className="mb-2 font-semibold text-center">Hogyan működik az SRS algoritmus?</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mb-8">
                                Az algoritmus minden értékelés után kiszámolja, mikor kellene visszamutatnia a kártyát — ha könnyen ment, tovább vár; ha nehéz volt, hamarabb visszahozza.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-4 text-center">
                                {[
                                    { label: 'Újra', color: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30', textColor: 'text-red-700 dark:text-red-400', sub: 'Visszakerül a tanulási lépések elejére' },
                                    { label: 'Nehéz', color: 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/30', textColor: 'text-orange-700 dark:text-orange-400', sub: 'Kisebb intervallum, csökkenő ease' },
                                    { label: 'Jó', color: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30', textColor: 'text-blue-700 dark:text-blue-400', sub: 'Intervallum nő az ease faktor alapján' },
                                    { label: 'Könnyű', color: 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30', textColor: 'text-green-700 dark:text-green-400', sub: 'Tovább vár, ease faktor nő' },
                                ].map(({ label, color, textColor, sub }) => (
                                    <div key={label} className={`rounded-xl border p-4 ${color}`}>
                                        <div className={`text-base font-bold mb-1 ${textColor}`}>{label}</div>
                                        <p className="text-xs text-muted-foreground">{sub}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quiz section */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid items-center gap-12 md:grid-cols-2">
                            {/* Visual */}
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
                <section className="border-t">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid items-center gap-12 md:grid-cols-2">
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <ScanText className="size-3" />
                                    Szövegelemzés
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">Elemezz bármilyen angol szöveget</h2>
                                <p className="mb-6 text-muted-foreground">
                                    Illeszd be a szöveget, adj meg egy webcímet — vagy egy YouTube videót — és az alkalmazás azonnal megmutatja, mennyit értesz belőle a jelenlegi szókincseddel.
                                </p>
                                <ul className="flex flex-col gap-3 text-sm">
                                    {[
                                        { icon: CheckCheck, color: 'text-[#00ADB5]', text: 'Érthetőség % — látod, hány szót ismersz a szövegben' },
                                        { icon: ScanText, color: 'text-primary', text: 'Kiemelés — zölddel, kékkel, pirossal jelöli a szavakat státusz szerint' },
                                        { icon: Youtube, color: 'text-red-500', text: 'YouTube felirat — bármely videó angol felirata elemezhető' },
                                        { icon: PencilLine, color: 'text-violet-500', text: 'Szóra kattintva — megjelentés, státusz változtatás, saját szóként mentés' },
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
                            <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                                <div className="border-b bg-muted/40 px-4 py-3 flex items-center justify-between">
                                    <span className="text-sm font-medium">Szövegelemzés</span>
                                    <span className="text-2xl font-bold text-green-600">87%</span>
                                </div>
                                <div className="px-4 py-3 border-b">
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary mb-1">
                                        <div className="h-2 rounded-full bg-green-500" style={{ width: '87%' }} />
                                    </div>
                                    <p className="text-xs text-muted-foreground">312 ismert szó / 358 szó összesen</p>
                                </div>
                                <div className="px-4 py-4 text-sm leading-7">
                                    <p className="whitespace-pre-wrap text-sm">
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
                                        {' '}
                                        <span>dog.</span>
                                    </p>
                                </div>
                                <div className="border-t px-4 py-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-green-400" /> Tudom</span>
                                    <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-blue-400" /> Tanulom</span>
                                    <span className="flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-red-400" /> Top 10k, ismeretlen</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Custom Words + Achievements */}
                <section className="border-t bg-muted/40">
                    <div className="mx-auto max-w-5xl px-6 py-20">
                        <div className="grid gap-12 md:grid-cols-2">
                            {/* Custom Words */}
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <PencilLine className="size-3" />
                                    Saját szavak
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">Add hozzá a saját szavaidat</h2>
                                <p className="mb-5 text-muted-foreground text-sm">
                                    Ha olyan szóval találkozol, ami nincs a top 10 000-ben, saját szóként felveheted — ugyanúgy viselkedik, mint a lista többi tagja.
                                </p>
                                <ul className="flex flex-col gap-2.5 text-sm">
                                    {[
                                        'Magyar jelentés, szófaj és példamondat tárolható',
                                        'Státuszok: Tudom, Tanulom, Később, Kiejtés',
                                        'Megjelenik a szólistában és az elemzésben is',
                                        'Flashcard paklikba importálható',
                                        'Szövegelemzésből egyetlen kattintással hozzáadható',
                                    ].map((text) => (
                                        <li key={text} className="flex items-start gap-2.5">
                                            <CheckCheck className="mt-0.5 size-4 shrink-0 text-[#00ADB5]" />
                                            <span className="text-muted-foreground">{text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Achievements */}
                            <div>
                                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                                    <Medal className="size-3" />
                                    Teljesítmények
                                </div>
                                <h2 className="mb-4 text-2xl font-bold tracking-tight">29 teljesítmény vár rád</h2>
                                <p className="mb-5 text-muted-foreground text-sm">
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
                <section className="border-t">
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

                        {/* Chrome Extension */}
                        <div className="mt-8 rounded-2xl border bg-muted/40 p-8">
                            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
                                <div className="flex-1">
                                    <div className="mb-3 flex items-center gap-2">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/40">
                                            <Puzzle className="size-5 text-violet-600 dark:text-violet-400" />
                                        </div>
                                        <h3 className="font-semibold">Chrome Extension — egy kattintásos elemzés</h3>
                                    </div>
                                    <p className="mb-4 text-sm text-muted-foreground">
                                        Telepítsd a Chrome bővítményt, és bármely weboldalon vagy YouTube videónál egyetlen kattintással megnyílik a szövegelemző — URL másolás nélkül.
                                    </p>
                                </div>
                                <div className="md:w-80 shrink-0">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Telepítés lépései</p>
                                    <ol className="flex flex-col gap-2 text-sm">
                                        {[
                                            { n: 1, text: 'Nyisd meg: chrome://extensions' },
                                            { n: 2, text: 'Kapcsold be a Fejlesztői módot (jobb felső sarok)' },
                                            { n: 3, text: 'Kattints: Kicsomagolt bővítmény betöltése' },
                                            { n: 4, text: 'Válaszd ki a topEwords/chrome-extension mappát' },
                                        ].map(({ n, text }) => (
                                            <li key={n} className="flex gap-3">
                                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-400">{n}</span>
                                                <span className="text-muted-foreground text-xs leading-5">{text}</span>
                                            </li>
                                        ))}
                                    </ol>
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Ha az alkalmazás éles szerverre kerül, a bővítmény a Chrome Web Store-ban is elérhető lesz.
                                    </p>
                                </div>
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
                    </div>
                </section>

                {/* CTA */}
                {!auth.user && (
                    <section className="border-t">
                        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
                            <h2 className="mb-4 text-2xl font-bold tracking-tight">Készen állsz elkezdeni?</h2>
                            <p className="mb-8 text-muted-foreground max-w-xl mx-auto">
                                Regisztrálj ingyen — szólista, flashcard SRS és kvíz mód azonnal elérhető, fizetős funkció nincs.
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
                                            Vedd fel velem a kapcsolatot a weboldalamon vagy írj emailben.
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
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                                <AppLogoIcon className="size-3.5 text-primary-foreground" />
                            </div>
                            <span>TopWords</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href={terms()} className="hover:text-foreground transition-colors">ÁSZF</Link>
                            <span>·</span>
                            <Link href={privacy()} className="hover:text-foreground transition-colors">Adatkezelés</Link>
                            <span>·</span>
                            <a href="https://codebarley.hu" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                                Készítette: codebarley.hu
                            </a>
                        </div>
                    </div>
                </footer>

            </div>
        </>
    );
}
