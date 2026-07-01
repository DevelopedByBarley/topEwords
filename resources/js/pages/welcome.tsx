import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    ArrowRight,
    BarChart3,
    Bookmark,
    BookOpen,
    Check,
    CheckCircle2,
    Download,
    FileText,
    Filter,
    Flame,
    Folder,
    GraduationCap,
    Highlighter,
    HelpCircle,
    History,
    Keyboard,
    Layers,
    List,
    Lock,
    LogIn,
    Menu,
    Moon,
    MousePointerClick,
    Percent,
    Play,
    PlayCircle,
    PlusCircle,
    Puzzle,
    RefreshCw,
    Shuffle,
    SlidersHorizontal,
    Sparkles,
    Sun,
    Tag,
    TrendingUp,
    Upload,
    Volume2,
    X,
    XCircle,
    Zap,
    type LucideProps,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import BetaBanner from '@/components/beta-banner';
import ChromeExtensionsLink from '@/components/chrome-extensions-link';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import {
    dashboard,
    guide,
    login,
    pricing,
    privacy,
    register,
    terms,
} from '@/routes';
import { index as wordsIndex } from '@/routes/words';

type Status = 'tudom' | 'tanulom' | 'later' | null;
type WordTab = 'all' | 'tanulom' | 'tudom';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
    ads_click: MousePointerClick,
    add_circle: PlusCircle,
    arrow_forward: ArrowRight,
    article: FileText,
    auto_awesome: Sparkles,
    bolt: Zap,
    bookmark: Bookmark,
    cancel: XCircle,
    check: Check,
    check_circle: CheckCircle2,
    close: X,
    download: Download,
    extension: Puzzle,
    filter_alt: Filter,
    folder: Folder,
    format_color_text: Highlighter,
    format_list_bulleted: List,
    history: History,
    keyboard: Keyboard,
    layers: Layers,
    local_fire_department: Flame,
    lock: Lock,
    login: LogIn,
    menu_book: BookOpen,
    percent: Percent,
    play_arrow: Play,
    play_circle: PlayCircle,
    quiz: HelpCircle,
    refresh: RefreshCw,
    right_click: MousePointerClick,
    school: GraduationCap,
    shuffle: Shuffle,
    stairs: BarChart3,
    style: Layers,
    subtitles: FileText,
    sync_alt: ArrowLeftRight,
    tag: Tag,
    touch_app: MousePointerClick,
    trending_up: TrendingUp,
    tune: SlidersHorizontal,
    upload: Upload,
    volume_up: Volume2,
};

function MI({
    n,
    s = 22,
    style,
    className,
}: {
    n: string;
    f?: boolean;
    s?: number;
    style?: React.CSSProperties;
    className?: string;
}) {
    const Icon = ICON_MAP[n];
    if (!Icon) return null;
    return <Icon size={s} style={style} className={className} />;
}

const DEMO_WORDS = [
    { rank: 42, word: 'between' },
    { rank: 187, word: 'important' },
    { rank: 234, word: 'different' },
    { rank: 312, word: 'government' },
    { rank: 418, word: 'experience' },
    { rank: 521, word: 'world' },
    { rank: 634, word: 'because' },
    { rank: 742, word: 'think' },
];

const FLASHCARDS = [
    {
        word: 'between',
        ipa: '/bɪˈtwiːn/',
        meaning: 'között, -ek között',
        ex: '"between you and me"',
        rank: 42,
    },
    {
        word: 'important',
        ipa: '/ɪmˈpɔːrtənt/',
        meaning: 'fontos, jelentős',
        ex: '"it is important to try"',
        rank: 187,
    },
    {
        word: 'experience',
        ipa: '/ɪkˈspɪəriəns/',
        meaning: 'tapasztalat, élmény',
        ex: '"years of experience"',
        rank: 418,
    },
];

const QUIZ_QUESTION = {
    rank: 42,
    tier: 'Top 1 000',
    word: 'between',
    options: ['között', 'felett', 'mellett', 'mögött'],
    correct: 0,
};

const FC_FEATURES = [
    {
        icon: 'layers',
        title: 'Saját deck-ek',
        desc: 'Tetszőleges számú kártyacsomagot hozhatsz létre különböző témákhoz.',
    },
    {
        icon: 'sync_alt',
        title: 'Kétirányú kártyák',
        desc: 'Előlap→hátlap, hátlap→előlap — az algoritmus külön értékeli.',
    },
    {
        icon: 'volume_up',
        title: 'Hangos felolvasás',
        desc: 'Az előlap és hátlap szövege felolvasható a kiejtés tanulásához.',
    },
    {
        icon: 'shuffle',
        title: 'Kártyák keverése',
        desc: 'Bekapcsolható keverés, hogy kétoldalú kártyáknál ne kerüljenek egymás mellé.',
    },
    {
        icon: 'upload',
        title: 'Import a szólistáról',
        desc: 'A TopWords szólistájából egy kattintással importálhatsz kártyát.',
    },
    {
        icon: 'download',
        title: 'CSV import / export',
        desc: 'Importálj CSV fájlból, vagy exportáld a deckjed más alkalmazásokba.',
    },
    {
        icon: 'tune',
        title: 'Deckenként testreszabható',
        desc: 'Napi korlát, tanulási lépések, ease faktorok, keverés — deckenkénti beállítással.',
    },
    {
        icon: 'trending_up',
        title: 'Haladás nyomon követése',
        desc: 'Minden kártya státusza látható: Új · Tanulás · Ismétlés — és mikor esedékes.',
    },
    {
        icon: 'refresh',
        title: 'Leech detektálás',
        desc: 'A sokat tévesztett kártyákat automatikusan jelöli, hogy tudd, hol kell más módszer.',
    },
];

const EXT_METHODS = [
    {
        icon: 'ads_click',
        title: 'Dupla kattintás + tartás',
        desc: 'Bármely weboldalon dupla kattints egy szóra, tartsd fél másodpercig — megjelenik a szó jelentése.',
    },
    {
        icon: 'keyboard',
        title: 'Option+W gyorsbillentyű',
        desc: 'Option+W (Mac) vagy Alt+W (Windows) — megnyílik a keresőmező, gépeld be a szót.',
    },
    {
        icon: 'right_click',
        title: 'Jobb kattintás menü',
        desc: 'Jelölj ki egy szót, kattints jobb gombbal → "Szó keresése" a TopWords szólistáján.',
    },
    {
        icon: 'extension',
        title: 'Extension ikon → szövegelemzés',
        desc: 'Az extension ikonjára kattintva az aktuális oldal szövege megnyílik a szövegelemzőben.',
    },
];

export default function Welcome({
    canRegister = true,
}: {
    canRegister?: boolean;
}) {
    const { auth, billingEnabled } = usePage().props;
    const { appearance, updateAppearance } = useAppearance();

    const cycleTheme = () => {
        if (appearance === 'dark') {
            updateAppearance('light');
        } else {
            updateAppearance('dark');
        }
    };

    const ThemeIcon = appearance === 'dark' ? Moon : Sun;

    const [mobileOpen, setMobileOpen] = useState(false);
    const [wordTab, setWordTab] = useState<WordTab>('all');
    const [statuses, setStatuses] = useState<Record<string, Status>>({
        between: 'tudom',
        important: 'tanulom',
        different: null,
        government: 'tudom',
        experience: 'later',
        world: null,
        because: null,
        think: null,
    });

    const [cardFlipped, setCardFlipped] = useState(false);
    const [cardIdx, setCardIdx] = useState(0);
    const [quizAnswer, setQuizAnswer] = useState<number | null>(null);

    const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
    const [isInstalled, setIsInstalled] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(display-mode: standalone)').matches,
    );
    const isIOS =
        typeof navigator !== 'undefined' &&
        /iPad|iPhone|iPod/.test(navigator.userAgent);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;
        (installPrompt as any).prompt();
        const { outcome } = await (installPrompt as any).userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
            setInstallPrompt(null);
        }
    };

    const knownCount = Object.values(statuses).filter(
        (s) => s === 'tudom',
    ).length;
    const knownPct = Math.round((knownCount / DEMO_WORDS.length) * 100);

    const filteredWords = DEMO_WORDS.filter((w) => {
        if (wordTab === 'all') return true;
        if (wordTab === 'tanulom') return statuses[w.word] === 'tanulom';
        if (wordTab === 'tudom') return statuses[w.word] === 'tudom';
        return true;
    });

    const toggleStatus = (word: string, s: Status) => {
        setStatuses((prev) => ({
            ...prev,
            [word]: prev[word] === s ? null : s,
        }));
    };

    const card = FLASHCARDS[cardIdx % FLASHCARDS.length];

    const nextCard = () => {
        setCardFlipped(false);
        setTimeout(() => setCardIdx((i) => i + 1), 80);
    };

    return (
        <>
            <Head title="Top 10 000 angol szó – Tanuld meg a legfontosabb szavakat">
                <meta
                    head-key="description"
                    name="description"
                    content="Tanuld meg a 10 000 leggyakoribb angol szót. Szólista, flashcard SRS rendszer, kvíz mód és Chrome bővítmény – egy helyen, magyarul."
                />
                <meta
                    head-key="og:title"
                    property="og:title"
                    content="TopWords – Top 10 000 angol szó"
                />
                <meta
                    head-key="og:description"
                    property="og:description"
                    content="Tanuld meg a 10 000 leggyakoribb angol szót. Jelöld meg amit tudsz, amit tanulsz, és kövesd a haladásodat."
                />
                <meta
                    head-key="og:url"
                    property="og:url"
                    content="https://topwords.eu/"
                />
            </Head>

            <div
                className="min-h-screen overflow-x-hidden bg-neutral-50 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                style={{
                    fontFamily:
                        '"Roboto", system-ui, -apple-system, sans-serif',
                }}
            >
                <BetaBanner />

                {/* ===================== NAV ===================== */}
                <header className="sticky top-0 z-50 border-b border-neutral-200 bg-neutral-50/80 backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/80">
                    <div className="mx-auto flex max-w-[1200px] items-center gap-5 px-6 py-3">
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 text-[20px] leading-none font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100"
                        >
                            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 text-white">
                                <MI n="menu_book" s={22} />
                            </span>
                            TopWords
                        </Link>

                        <nav className="ml-2 hidden items-center gap-1 lg:flex">
                            {[
                                ['Funkciók', '#features'],
                                ['Szólista', '#wordlist'],
                                ['Flashcard', '#flashcard'],
                                ['Kvíz', '#quiz'],
                                ['Bővítmény', '#extension'],
                            ].map(([label, href]) => (
                                <a
                                    key={label}
                                    href={href}
                                    className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                                >
                                    {label}
                                </a>
                            ))}
                            <Link
                                href={guide()}
                                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                            >
                                Tananyag
                            </Link>
                        </nav>

                        <div className="ml-auto flex items-center gap-2">
                            {billingEnabled && (
                                <Button
                                    variant="ghost"
                                    asChild
                                    className="hidden sm:inline-flex"
                                >
                                    <Link href={pricing()}>Árak</Link>
                                </Button>
                            )}
                            {auth.user ? (
                                <Button
                                    asChild
                                    className="bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                >
                                    <Link href={dashboard()}>
                                        Irány az alkalmazás
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="ghost"
                                        asChild
                                        className="hidden sm:inline-flex"
                                    >
                                        <Link href={login()}>
                                            Bejelentkezés
                                        </Link>
                                    </Button>
                                    {canRegister && (
                                        <Button
                                            asChild
                                            className="hidden bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700 sm:inline-flex"
                                        >
                                            <Link href={register()}>
                                                Regisztrálás
                                            </Link>
                                        </Button>
                                    )}
                                </>
                            )}
                            <button
                                onClick={cycleTheme}
                                className="flex size-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                aria-label="Téma váltás"
                                title={
                                    appearance === 'dark'
                                        ? 'Sötét téma'
                                        : 'Világos téma'
                                }
                            >
                                <ThemeIcon className="size-5" />
                            </button>
                            <button
                                onClick={() => setMobileOpen((v) => !v)}
                                className="flex size-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 sm:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
                                aria-label="Menü"
                            >
                                {mobileOpen ? (
                                    <X className="size-5" />
                                ) : (
                                    <Menu className="size-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Mobile dropdown */}
                    {mobileOpen && (
                        <div className="border-t border-neutral-200 bg-neutral-50/95 px-4 pt-2 pb-4 sm:hidden dark:border-neutral-700 dark:bg-neutral-900/95">
                            <nav className="flex flex-col gap-0.5">
                                {[
                                    ['Funkciók', '#features'],
                                    ['Szólista', '#wordlist'],
                                    ['Flashcard', '#flashcard'],
                                    ['Kvíz', '#quiz'],
                                    ['Bővítmény', '#extension'],
                                ].map(([label, href]) => (
                                    <a
                                        key={label}
                                        href={href}
                                        onClick={() => setMobileOpen(false)}
                                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                                    >
                                        {label}
                                    </a>
                                ))}
                                <Link
                                    href={guide()}
                                    onClick={() => setMobileOpen(false)}
                                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-violet-600 transition-colors hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20"
                                >
                                    Tananyag
                                </Link>
                            </nav>
                            <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-700">
                                {billingEnabled && (
                                    <Button
                                        variant="outline"
                                        asChild
                                        className="w-full"
                                    >
                                        <Link
                                            href={pricing()}
                                            onClick={() => setMobileOpen(false)}
                                        >
                                            Árak
                                        </Link>
                                    </Button>
                                )}
                                {auth.user ? (
                                    <Button
                                        asChild
                                        className="w-full bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                    >
                                        <Link href={dashboard()}>
                                            Irány az alkalmazás
                                        </Link>
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            variant="outline"
                                            asChild
                                            className="w-full"
                                        >
                                            <Link
                                                href={login()}
                                                onClick={() =>
                                                    setMobileOpen(false)
                                                }
                                            >
                                                Bejelentkezés
                                            </Link>
                                        </Button>
                                        {canRegister && (
                                            <Button
                                                asChild
                                                className="w-full bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                            >
                                                <Link
                                                    href={register()}
                                                    onClick={() =>
                                                        setMobileOpen(false)
                                                    }
                                                >
                                                    Regisztrálás
                                                </Link>
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </header>

                {/* ===================== HERO ===================== */}
                <section
                    id="top"
                    className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 md:py-24"
                >
                    <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                        {/* left */}
                        <div className="animate-hero-rise">
                            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-bold tracking-widest text-violet-700 uppercase dark:bg-violet-900/40 dark:text-violet-300">
                                <MI n="bolt" f s={16} />
                                MAGYAR NYELVŰ · SZÓKINCS FEJLESZTÉS
                            </div>
                            <h1 className="mt-2 text-[clamp(38px,5.6vw,68px)] leading-[1.04] font-extrabold tracking-tight text-balance">
                                A{' '}
                                <span className="text-violet-600 dark:text-violet-400">
                                    10 000
                                </span>{' '}
                                leggyakoribb angol szó
                            </h1>
                            <p className="mt-5 max-w-[540px] text-lg leading-relaxed text-neutral-500 dark:text-neutral-400">
                                Tanuld az angolt okosan. Szólista nyomon
                                követéssel, flashcard SRS-rendszerrel, kvíz
                                móddal, szövegelemzéssel és Chrome-bővítménnyel
                                — minden egy helyen, magyarul.
                            </p>
                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                {auth.user ? (
                                    <Button
                                        size="lg"
                                        asChild
                                        className="bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                    >
                                        <Link
                                            href={wordsIndex()}
                                            className="flex items-center gap-2"
                                        >
                                            Szavak böngészése{' '}
                                            <MI n="arrow_forward" s={20} />
                                        </Link>
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            size="lg"
                                            asChild
                                            className="bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                        >
                                            <Link
                                                href={login()}
                                                className="flex items-center gap-2"
                                            >
                                                Belépés{' '}
                                                <MI n="arrow_forward" s={20} />
                                            </Link>
                                        </Button>
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            asChild
                                        >
                                            <Link
                                                href="#flashcard"
                                                className="flex items-center gap-2"
                                            >
                                                <MI n="style" s={20} /> Próbáld
                                                a flashcardot
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-neutral-500 dark:text-neutral-400">
                                {[
                                    'Nincs hirdetés',
                                    'Ingyenes regisztráció',
                                    'Gyors tanulás',
                                ].map((item) => (
                                    <span
                                        key={item}
                                        className="flex items-center gap-1.5"
                                    >
                                        <MI
                                            n="check_circle"
                                            f
                                            s={16}
                                            style={
                                                {
                                                    color: '#22c55e',
                                                } as React.CSSProperties
                                            }
                                        />
                                        {item}
                                    </span>
                                ))}
                            </div>
                            <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-6">
                                {[
                                    { value: '10 000', label: 'Angol szó' },
                                    {
                                        value: 'SRS',
                                        label: 'Flashcard rendszer',
                                    },
                                    { value: '29', label: 'Teljesítmény' },
                                    { value: '100%', label: 'Magyar' },
                                ].map((stat) => (
                                    <div key={stat.label}>
                                        <div className="text-3xl font-extrabold tracking-tight text-neutral-800 dark:text-neutral-100">
                                            {stat.value}
                                        </div>
                                        <div className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* right — progress card */}
                        <div
                            className="animate-hero-rise"
                            style={{ animationDelay: '0.12s' }}
                        >
                            <div className="rounded-[22px] border border-neutral-200 bg-white p-6 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[15px] font-bold">
                                        <MI
                                            n="trending_up"
                                            f
                                            s={20}
                                            style={
                                                {
                                                    color: '#7c3aed',
                                                } as React.CSSProperties
                                            }
                                        />
                                        Haladás
                                    </div>
                                    <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                        <MI
                                            n="local_fire_department"
                                            f
                                            s={17}
                                        />
                                        7 napos sorozat
                                    </div>
                                </div>
                                <div className="mt-5 flex items-end justify-between">
                                    <div className="text-2xl font-extrabold tracking-tight">
                                        4 187{' '}
                                        <span className="text-lg font-semibold text-neutral-400 dark:text-neutral-500">
                                            / 10 000 szó
                                        </span>
                                    </div>
                                    <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
                                        41%
                                    </div>
                                </div>
                                <div className="mt-2.5 h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
                                    <div
                                        className="relative h-full overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-violet-400"
                                        style={{ width: '41%' }}
                                    >
                                        <div className="absolute inset-0 w-2/5 animate-[shimmer_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-col gap-2">
                                    {[
                                        {
                                            rank: '#42',
                                            word: 'between',
                                            status: 'tudom' as const,
                                        },
                                        {
                                            rank: '#187',
                                            word: 'important',
                                            status: 'tanulom' as const,
                                        },
                                        {
                                            rank: '#418',
                                            word: 'experience',
                                            status: 'later' as const,
                                        },
                                    ].map(({ rank, word, status }) => (
                                        <div
                                            key={word}
                                            className="flex items-center gap-3 rounded-xl bg-neutral-100 px-3 py-2.5 dark:bg-neutral-700"
                                        >
                                            <span className="w-10 text-xs font-bold text-neutral-500 tabular-nums dark:text-neutral-400">
                                                {rank}
                                            </span>
                                            <span className="flex-1 text-sm font-semibold">
                                                {word}
                                            </span>
                                            {status === 'tudom' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                    <MI
                                                        n="check_circle"
                                                        f
                                                        s={14}
                                                    />{' '}
                                                    Tudom
                                                </span>
                                            )}
                                            {status === 'tanulom' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                    <MI n="school" f s={14} />{' '}
                                                    Tanulom
                                                </span>
                                            )}
                                            {status === 'later' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-500">
                                                    <MI n="bookmark" f s={14} />{' '}
                                                    Később
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== FEATURES ===================== */}
                <section
                    id="features"
                    className="relative overflow-hidden bg-gradient-to-r from-violet-400 to-violet-600"
                >
                    <div className="pointer-events-none absolute -top-24 -left-24 size-[420px] rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-0 -bottom-20 size-[360px] rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute top-1/2 left-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07]" />
                    <div className="relative mx-auto max-w-[1200px] px-4 py-16 sm:px-6 md:py-24">
                        <div className="mx-auto max-w-[680px] text-center">
                            <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-200 uppercase">
                                FUNKCIÓK
                            </div>
                            <h2 className="text-[clamp(26px,3.6vw,44px)] leading-tight font-extrabold tracking-tight text-white">
                                Minden, ami kell a hatékony tanuláshoz
                            </h2>
                            <p className="mt-4 text-lg text-violet-200">
                                Válaszd a számodra legjobb módszert — vagy
                                használd mindegyiket egyszerre.
                            </p>
                        </div>
                        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                {
                                    icon: 'format_list_bulleted',
                                    title: 'Szólista & nyomon követés',
                                    desc: 'Böngészd a 10 000 leggyakoribb szót, jelöld a tudásodat és szervezd mappákba.',
                                },
                                {
                                    icon: 'style',
                                    title: 'Flashcard SRS',
                                    desc: 'Saját kártyacsomag intelligens ismétlési algoritmussal — pontosan akkor mutatja, amikor el akarnád felejteni.',
                                },
                                {
                                    icon: 'quiz',
                                    title: 'Kvíz mód',
                                    desc: '4 válaszlehetőséges kvíz — szűrhető nehézség és státusz szerint.',
                                },
                                {
                                    icon: 'article',
                                    title: 'Szövegelemzés',
                                    desc: 'Elemezz bármilyen szöveget, webcímet vagy YouTube videót — látod hány szót ismersz belőle.',
                                },
                                {
                                    icon: 'extension',
                                    title: 'Chrome Extension',
                                    desc: 'Bármely weboldalon dupla kattintással vagy Option+W-vel azonnal keresés — popupban megjelenik a jelentés.',
                                },
                                {
                                    icon: 'add_circle',
                                    title: 'Saját szavak',
                                    desc: 'Ha a top 10k-ban nem szerepel a szó, add hozzá saját szóként — ugyanúgy viselkedik, mint a lista többi tagja.',
                                },
                            ].map(({ icon, title, desc }) => (
                                <div
                                    key={title}
                                    className="group rounded-2xl border border-violet-500 bg-violet-700/40 p-6 transition-all hover:-translate-y-1 hover:border-violet-300 hover:bg-violet-700/60 hover:shadow-md"
                                >
                                    <div className="mb-4 flex size-12 items-center justify-center rounded-[13px] bg-white/20 text-white">
                                        <MI n={icon} s={26} />
                                    </div>
                                    <h3 className="mb-2 text-[17px] font-bold text-white">
                                        {title}
                                    </h3>
                                    <p className="text-sm leading-relaxed text-violet-200">
                                        {desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ===================== WORD LIST ===================== */}
                <section
                    id="wordlist"
                    className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24"
                >
                    <div className="grid items-center gap-12 md:grid-cols-[0.85fr_1.15fr]">
                        {/* left */}
                        <div>
                            <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-600 uppercase dark:text-violet-400">
                                SZÓLISTA
                            </div>
                            <h2 className="text-[clamp(24px,3.2vw,40px)] leading-tight font-extrabold tracking-tight">
                                Kövesd nyomon a szókincsed fejlődését
                            </h2>
                            <p className="mt-4 text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
                                Minden szóhoz jelölheted, hol tartasz — a
                                rendszer összeszámolja, és látod a valódi
                                haladásodat.{' '}
                                <strong className="text-neutral-800 dark:text-neutral-200">
                                    Próbáld ki: kattints a státuszokra.
                                </strong>
                            </p>
                            <div className="mt-6 flex flex-col gap-3">
                                {[
                                    {
                                        icon: 'check_circle',
                                        color: 'text-green-500',
                                        text: 'Tudom — jelöld meg a biztosan ismert szavakat',
                                    },
                                    {
                                        icon: 'school',
                                        color: 'text-blue-500',
                                        text: 'Tanulom — aktívan tanult szavak gyors elérése',
                                    },
                                    {
                                        icon: 'bookmark',
                                        color: 'text-amber-500',
                                        text: 'Később — szavak elmentése visszatéréshez',
                                    },
                                    {
                                        icon: 'folder',
                                        color: 'text-violet-600',
                                        text: 'Mappák & szűrők — rendezd témák szerint, szűrj nehézség szerint',
                                    },
                                ].map(({ icon, color, text }) => (
                                    <div
                                        key={text}
                                        className="flex items-start gap-3"
                                    >
                                        <MI
                                            n={icon}
                                            f
                                            s={20}
                                            style={
                                                {
                                                    marginTop: 1,
                                                } as React.CSSProperties
                                            }
                                            className={color}
                                        />
                                        <span className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                                            {text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* right — interactive word list */}
                        <div className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                            {/* header */}
                            <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-base font-bold">
                                        Szólista
                                    </span>
                                    <div className="flex gap-1 rounded-[10px] bg-neutral-100 p-1 dark:bg-neutral-700">
                                        {(
                                            [
                                                'all',
                                                'tanulom',
                                                'tudom',
                                            ] as WordTab[]
                                        ).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setWordTab(tab)}
                                                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                                                    wordTab === tab
                                                        ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-600 dark:text-neutral-100'
                                                        : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400'
                                                }`}
                                            >
                                                {tab === 'all'
                                                    ? 'Összes'
                                                    : tab === 'tanulom'
                                                      ? 'Tanulom'
                                                      : 'Tudom'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-3">
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
                                        <div
                                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                                            style={{ width: `${knownPct}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                                        <span className="text-green-500">
                                            {knownCount}
                                        </span>{' '}
                                        / {DEMO_WORDS.length} tudom
                                    </span>
                                </div>
                            </div>
                            {/* word rows */}
                            <div className="max-h-[320px] overflow-y-auto">
                                {filteredWords.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
                                        Nincs szó ebben a szűrőben
                                    </div>
                                ) : (
                                    filteredWords.map(({ rank, word }) => (
                                        <div
                                            key={word}
                                            className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3 last:border-0 dark:border-neutral-700"
                                        >
                                            <span className="w-12 text-xs font-bold text-neutral-400 tabular-nums dark:text-neutral-500">
                                                #{rank}
                                            </span>
                                            <span className="flex-1 text-base font-semibold">
                                                {word}
                                            </span>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        toggleStatus(
                                                            word,
                                                            'tudom',
                                                        )
                                                    }
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                                                        statuses[word] ===
                                                        'tudom'
                                                            ? 'bg-green-500 text-white'
                                                            : 'bg-neutral-100 text-neutral-500 hover:bg-green-100 hover:text-green-700 dark:bg-neutral-700 dark:text-neutral-400'
                                                    }`}
                                                >
                                                    Tudom
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        toggleStatus(
                                                            word,
                                                            'tanulom',
                                                        )
                                                    }
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                                                        statuses[word] ===
                                                        'tanulom'
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-neutral-100 text-neutral-500 hover:bg-blue-100 hover:text-blue-700 dark:bg-neutral-700 dark:text-neutral-400'
                                                    }`}
                                                >
                                                    Tanulom
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        toggleStatus(
                                                            word,
                                                            'later',
                                                        )
                                                    }
                                                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
                                                        statuses[word] ===
                                                        'later'
                                                            ? 'bg-amber-500 text-white'
                                                            : 'bg-neutral-100 text-neutral-500 hover:bg-amber-100 hover:text-amber-700 dark:bg-neutral-700 dark:text-neutral-400'
                                                    }`}
                                                >
                                                    Később
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {/* folders */}
                            <div className="flex gap-2 bg-neutral-50 px-5 py-3 dark:bg-neutral-900">
                                {[
                                    { name: 'Utazás', count: 42 },
                                    { name: 'Munka', count: 78 },
                                    { name: 'Vizsga', count: 115 },
                                ].map((f) => (
                                    <div
                                        key={f.name}
                                        className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800"
                                    >
                                        <MI
                                            n="folder"
                                            s={15}
                                            style={
                                                {
                                                    color: '#7c3aed',
                                                } as React.CSSProperties
                                            }
                                        />
                                        {f.name}{' '}
                                        <span className="text-neutral-400 dark:text-neutral-500">
                                            {f.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== FLASHCARD SRS ===================== */}
                <section
                    id="flashcard"
                    className="border-y border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                >
                    <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24">
                        <div className="mx-auto max-w-[680px] text-center">
                            <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-600 uppercase dark:text-violet-400">
                                FLASHCARD SRS
                            </div>
                            <h2 className="text-[clamp(26px,3.6vw,44px)] leading-tight font-extrabold tracking-tight">
                                Intelligens ismétlési rendszer — mint az Anki
                            </h2>
                            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
                                Kattints a kártyára a megfordításhoz. Az
                                algoritmus kiszámolja, mikor kell ismételned.
                            </p>
                        </div>

                        <div className="mt-12 grid items-center gap-12 md:grid-cols-2">
                            {/* card demo */}
                            <div className="flex flex-col items-center">
                                <div className="mb-3 text-sm font-medium text-neutral-400 dark:text-neutral-500">
                                    Deck: Angol alapszavak · {cardIdx + 1}/40
                                </div>
                                <button
                                    onClick={() => setCardFlipped(!cardFlipped)}
                                    className="w-full max-w-[420px] cursor-pointer rounded-[20px] border border-neutral-200 bg-neutral-50 shadow-xl transition-all select-none hover:shadow-2xl dark:border-neutral-600 dark:bg-neutral-700"
                                    style={{ minHeight: 280 }}
                                >
                                    <div
                                        className="flex flex-col items-center justify-center p-8 text-center"
                                        style={{ minHeight: 280 }}
                                    >
                                        {cardFlipped ? (
                                            <>
                                                <div className="mb-3 text-xs font-bold tracking-widest text-neutral-400 uppercase dark:text-neutral-500">
                                                    HÁTLAP
                                                </div>
                                                <div className="text-3xl font-extrabold tracking-tight text-violet-600 dark:text-violet-400">
                                                    {card.meaning}
                                                </div>
                                                <div className="mt-3 text-base text-neutral-400 italic dark:text-neutral-500">
                                                    {card.ex}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-[48px] leading-tight font-extrabold tracking-tight">
                                                    {card.word}
                                                </div>
                                                <div className="mt-2 text-lg text-neutral-400 dark:text-neutral-500">
                                                    {card.ipa}
                                                </div>
                                                <div className="mt-5 flex items-center gap-2 text-sm text-neutral-400 dark:text-neutral-500">
                                                    <MI n="touch_app" s={18} />
                                                    Kattints a megfordításhoz
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </button>
                                <div className="mt-4 grid w-full max-w-[420px] grid-cols-4 gap-2">
                                    {[
                                        {
                                            label: 'Újra',
                                            sub: '1 perc',
                                            color: 'hover:border-red-400 hover:text-red-500',
                                        },
                                        {
                                            label: 'Nehéz',
                                            sub: '6 nap',
                                            color: 'hover:border-amber-400 hover:text-amber-600',
                                        },
                                        {
                                            label: 'Jó',
                                            sub: '10 nap',
                                            color: 'hover:border-blue-400 hover:text-blue-500',
                                        },
                                        {
                                            label: 'Könnyű',
                                            sub: '15 nap',
                                            color: 'hover:border-green-400 hover:text-green-500',
                                        },
                                    ].map(({ label, sub, color }) => (
                                        <button
                                            key={label}
                                            onClick={nextCard}
                                            className={`flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white py-2.5 transition-all dark:border-neutral-600 dark:bg-neutral-700 ${color}`}
                                        >
                                            <span className="text-sm font-bold">
                                                {label}
                                            </span>
                                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                                                {sub}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* SRS explanation */}
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">
                                    Hogyan működik az SRS algoritmus?
                                </h3>
                                <p className="mt-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                                    Minden értékelés után kiszámolja, mikor
                                    kellene visszamutatnia a kártyát — ha
                                    könnyen ment, tovább vár; ha nehéz volt,
                                    hamarabb visszahozza.
                                </p>
                                <div className="mt-5 flex flex-col gap-3">
                                    {[
                                        {
                                            color: 'bg-red-500',
                                            label: 'Újra',
                                            desc: 'Visszakerül a tanulási lépések elejére.',
                                        },
                                        {
                                            color: 'bg-amber-500',
                                            label: 'Nehéz',
                                            desc: 'Kisebb intervallum, csökkenő ease faktor.',
                                        },
                                        {
                                            color: 'bg-blue-500',
                                            label: 'Jó',
                                            desc: 'Az intervallum nő az ease faktor alapján.',
                                        },
                                        {
                                            color: 'bg-green-500',
                                            label: 'Könnyű',
                                            desc: 'Tovább vár, az ease faktor nő.',
                                        },
                                    ].map(({ color, label, desc }) => (
                                        <div
                                            key={label}
                                            className="flex gap-3.5 rounded-[13px] border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900"
                                        >
                                            <span
                                                className={`mt-1 w-2 flex-none self-stretch rounded-full ${color}`}
                                            />
                                            <div>
                                                <div className="font-bold">
                                                    {label}
                                                </div>
                                                <div className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">
                                                    {desc}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 9 sub-features */}
                        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {FC_FEATURES.map((f) => (
                                <div
                                    key={f.title}
                                    className="flex gap-3 rounded-[14px] border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900"
                                >
                                    <MI
                                        n={f.icon}
                                        s={22}
                                        style={
                                            {
                                                color: '#7c3aed',
                                                flexShrink: 0,
                                            } as React.CSSProperties
                                        }
                                    />
                                    <div>
                                        <div className="text-sm font-bold">
                                            {f.title}
                                        </div>
                                        <div className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                                            {f.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ===================== QUIZ ===================== */}
                <section
                    id="quiz"
                    className="relative overflow-hidden bg-gradient-to-r from-violet-600 to-violet-400"
                >
                    <div className="pointer-events-none absolute -top-16 right-10 size-95 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute bottom-0 -left-16 size-80 rounded-full bg-white/10" />
                    <div className="relative mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24">
                        <div className="grid items-center gap-12 md:grid-cols-[0.85fr_1.15fr]">
                            {/* left */}
                            <div>
                                <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-200 uppercase">
                                    KVÍZ MÓD
                                </div>
                                <h2 className="text-[clamp(24px,3.2vw,40px)] leading-tight font-extrabold tracking-tight text-white">
                                    Teszteld magad kvíz módban
                                </h2>
                                <p className="mt-4 text-base leading-relaxed text-violet-200">
                                    Válaszd ki melyik szavakból és hányból
                                    kvízzeljünk — a rendszer automatikusan
                                    generálja a kérdéseket és a
                                    válaszlehetőségeket.{' '}
                                    <strong className="text-white">
                                        Próbáld ki: válassz egy választ.
                                    </strong>
                                </p>
                                <div className="mt-6 flex flex-col gap-3">
                                    {[
                                        {
                                            icon: 'filter_alt',
                                            text: 'Szűrj státusz szerint — tanulom, elmentettem, tudom',
                                        },
                                        {
                                            icon: 'stairs',
                                            text: 'Válassz nehézségi szintet — kezdőtől haladóig',
                                        },
                                        {
                                            icon: 'tag',
                                            text: '10, 20, 50 kérdés — vagy az összes elérhető szó egyszerre',
                                        },
                                        {
                                            icon: 'folder',
                                            text: 'Mappa szerint — csak egy adott témából kvízzelhetsz',
                                        },
                                    ].map(({ icon, text }) => (
                                        <div
                                            key={text}
                                            className="flex items-start gap-3"
                                        >
                                            <MI
                                                n={icon}
                                                s={20}
                                                style={
                                                    {
                                                        color: '#c4b5fd',
                                                        marginTop: 1,
                                                    } as React.CSSProperties
                                                }
                                            />
                                            <span className="text-sm leading-relaxed text-violet-100">
                                                {text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* right — quiz demo */}
                            <div className="rounded-[18px] border border-neutral-200 bg-white p-7 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 tabular-nums dark:text-neutral-500">
                                        #{QUIZ_QUESTION.rank}
                                        <span className="size-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                                        {QUIZ_QUESTION.tier}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {[0, 1, 2].map((i) => (
                                            <span
                                                key={i}
                                                className={`size-2 rounded-full ${i === 0 ? 'bg-green-500' : i === 1 ? 'bg-violet-500' : 'bg-neutral-200 dark:bg-neutral-600'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-5 text-sm text-neutral-400 dark:text-neutral-500">
                                    Mi a magyar jelentése?
                                </div>
                                <div className="mt-1 text-[38px] leading-tight font-extrabold tracking-tight">
                                    {QUIZ_QUESTION.word}
                                </div>
                                <div className="mt-5 flex flex-col gap-2.5">
                                    {QUIZ_QUESTION.options.map((opt, idx) => (
                                        <button
                                            key={opt}
                                            onClick={() => setQuizAnswer(idx)}
                                            disabled={quizAnswer !== null}
                                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-base font-semibold transition-all ${
                                                quizAnswer === null
                                                    ? 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-violet-300 hover:bg-violet-50 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200'
                                                    : quizAnswer === idx &&
                                                        idx ===
                                                            QUIZ_QUESTION.correct
                                                      ? 'border-green-400 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                      : quizAnswer === idx &&
                                                          idx !==
                                                              QUIZ_QUESTION.correct
                                                        ? 'border-red-400 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                                        : idx ===
                                                                QUIZ_QUESTION.correct &&
                                                            quizAnswer !== null
                                                          ? 'border-green-400 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                          : 'border-neutral-100 bg-neutral-50/50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800/50'
                                            }`}
                                        >
                                            <span>{opt}</span>
                                            {quizAnswer !== null &&
                                                idx ===
                                                    QUIZ_QUESTION.correct && (
                                                    <MI
                                                        n="check_circle"
                                                        f
                                                        s={21}
                                                        style={
                                                            {
                                                                color: '#22c55e',
                                                            } as React.CSSProperties
                                                        }
                                                    />
                                                )}
                                            {quizAnswer !== null &&
                                                quizAnswer === idx &&
                                                idx !==
                                                    QUIZ_QUESTION.correct && (
                                                    <MI
                                                        n="cancel"
                                                        f
                                                        s={21}
                                                        style={
                                                            {
                                                                color: '#ef4444',
                                                            } as React.CSSProperties
                                                        }
                                                    />
                                                )}
                                        </button>
                                    ))}
                                </div>
                                {quizAnswer !== null && (
                                    <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-700">
                                        <div
                                            className={`flex items-center gap-2 text-base font-bold ${quizAnswer === QUIZ_QUESTION.correct ? 'text-green-500' : 'text-red-500'}`}
                                        >
                                            <MI
                                                n={
                                                    quizAnswer ===
                                                    QUIZ_QUESTION.correct
                                                        ? 'check_circle'
                                                        : 'cancel'
                                                }
                                                f
                                                s={20}
                                            />
                                            {quizAnswer ===
                                            QUIZ_QUESTION.correct
                                                ? 'Helyes!'
                                                : 'Sajnos nem'}
                                        </div>
                                        <button
                                            onClick={() => setQuizAnswer(null)}
                                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-700"
                                        >
                                            Következő{' '}
                                            <MI n="arrow_forward" s={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== TEXT ANALYSIS ===================== */}
                <section id="analyze">
                    <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24">
                        <div className="grid items-center gap-12 md:grid-cols-[1.15fr_0.85fr]">
                            {/* left — mock UI */}
                            <div>
                                <div className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                                    <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-3xl font-extrabold text-green-500">
                                                87%
                                            </span>
                                            <div className="text-[13px] leading-tight text-neutral-400 dark:text-neutral-500">
                                                érthetőség
                                                <br />
                                                312 / 358 szó
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {['link', 'smart_display'].map(
                                                (icon) => (
                                                    <div
                                                        key={icon}
                                                        className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold dark:bg-neutral-800"
                                                    >
                                                        <MI
                                                            n={icon}
                                                            s={16}
                                                            style={
                                                                {
                                                                    color: '#7c3aed',
                                                                } as React.CSSProperties
                                                            }
                                                        />
                                                        {icon === 'link'
                                                            ? 'URL'
                                                            : 'YouTube'}
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-5 py-6 text-lg leading-[2.2] font-normal">
                                        {[
                                            { word: 'The', status: 'tudom' },
                                            { word: 'space', status: 'tudom' },
                                            {
                                                word: 'between',
                                                status: 'tanulom',
                                            },
                                            { word: 'two', status: 'tudom' },
                                            { word: 'cities', status: 'tudom' },
                                            { word: 'lies', status: null },
                                            { word: 'a', status: 'tudom' },
                                            {
                                                word: 'valley',
                                                status: 'tanulom',
                                            },
                                            { word: 'known', status: 'tudom' },
                                            { word: 'for', status: 'tudom' },
                                            { word: 'its', status: 'tudom' },
                                            {
                                                word: 'remarkable',
                                                status: null,
                                            },
                                            {
                                                word: 'landscape.',
                                                status: 'tudom',
                                            },
                                        ].map(({ word, status }, i) => (
                                            <span key={i}>
                                                <span
                                                    className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-75 ${
                                                        status === 'tudom'
                                                            ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-300'
                                                            : status ===
                                                                'tanulom'
                                                              ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300'
                                                              : status === null
                                                                ? 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300'
                                                                : ''
                                                    }`}
                                                >
                                                    {word}
                                                </span>{' '}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 border-t border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2.5 rounded-sm bg-green-400" />{' '}
                                            Tudom
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2.5 rounded-sm bg-blue-400" />{' '}
                                            Tanulom
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2.5 rounded-sm bg-red-400" />{' '}
                                            Ismeretlen
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2.5 text-center text-xs text-neutral-400 dark:text-neutral-500">
                                    Kattints a szavakra a státusz váltásához
                                </div>
                            </div>

                            {/* right */}
                            <div>
                                <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-600 uppercase dark:text-violet-400">
                                    SZÖVEGELEMZÉS
                                </div>
                                <h2 className="text-[clamp(24px,3.2vw,40px)] leading-tight font-extrabold tracking-tight text-neutral-900 dark:text-white">
                                    Elemezz bármilyen angol szöveget
                                </h2>
                                <p className="mt-4 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
                                    Illeszd be a szöveget, adj meg egy webcímet
                                    — vagy egy YouTube videót — és az alkalmazás
                                    azonnal megmutatja, mennyit értesz belőle.
                                </p>
                                <div className="mt-6 flex flex-col gap-3">
                                    {[
                                        {
                                            icon: 'percent',
                                            text: 'Érthetőség % — látod, hány szót ismersz a szövegben',
                                        },
                                        {
                                            icon: 'format_color_text',
                                            text: 'Kiemelés — zölddel, kékkel, pirossal jelöli a szavakat státusz szerint',
                                        },
                                        {
                                            icon: 'subtitles',
                                            text: 'YouTube felirat — bármely videó angol felirata elemezhető',
                                        },
                                        {
                                            icon: 'history',
                                            text: 'Előzmények — az utolsó 10 elemzés automatikusan mentve',
                                        },
                                    ].map(({ icon, text }) => (
                                        <div
                                            key={text}
                                            className="flex items-start gap-3"
                                        >
                                            <MI
                                                n={icon}
                                                s={20}
                                                style={
                                                    {
                                                        color: '#7c3aed',
                                                        marginTop: 1,
                                                    } as React.CSSProperties
                                                }
                                            />
                                            <span className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                                                {text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== TANANYAG ===================== */}
                <section
                    id="tananyag"
                    className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24"
                >
                    <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-violet-50 dark:border-neutral-700 dark:bg-violet-950/20">
                        <div className="grid items-center gap-10 p-10 md:p-12 lg:grid-cols-[1.05fr_0.95fr]">
                            <div>
                                <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-700 uppercase dark:text-violet-400">
                                    TANANYAG
                                </div>
                                <h2 className="text-[clamp(26px,3.4vw,42px)] leading-tight font-extrabold tracking-tight">
                                    Videós útmutatók a használathoz
                                </h2>
                                <p className="mt-4 max-w-[480px] text-lg leading-relaxed text-neutral-500 dark:text-neutral-400">
                                    Nézd meg lépésről lépésre, hogyan használd a
                                    szólistát, a flashcardokat, a kvízt és a
                                    bővítményt — rövid videós tutorialokban.
                                </p>
                                <Button
                                    asChild
                                    className="mt-7 bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                >
                                    <Link
                                        href={guide()}
                                        className="flex items-center gap-2"
                                    >
                                        <MI n="play_circle" s={21} /> Útmutatók
                                        megnyitása
                                    </Link>
                                </Button>
                            </div>
                            <div className="flex flex-col gap-3">
                                {[
                                    {
                                        title: 'Első lépések a TopWordsban',
                                        sub: 'Kezdő lépések · 3:20',
                                    },
                                    {
                                        title: 'Flashcard deck létrehozása',
                                        sub: 'Flashcard · 6:30',
                                    },
                                    {
                                        title: 'A Chrome bővítmény telepítése',
                                        sub: 'Extension · 4:18',
                                    },
                                ].map((v) => (
                                    <Link
                                        key={v.title}
                                        href={guide()}
                                        className="flex items-center gap-3.5 rounded-[14px] border border-neutral-200 bg-white px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                                    >
                                        <span className="flex size-11 flex-none items-center justify-center rounded-[11px] bg-neutral-900 dark:bg-neutral-700">
                                            <MI
                                                n="play_arrow"
                                                f
                                                s={24}
                                                style={
                                                    {
                                                        color: '#fff',
                                                    } as React.CSSProperties
                                                }
                                            />
                                        </span>
                                        <div>
                                            <div className="text-sm font-bold">
                                                {v.title}
                                            </div>
                                            <div className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                                                {v.sub}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== CHROME EXTENSION ===================== */}
                <section
                    id="extension"
                    className="border-y border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                >
                    <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24">
                        <div className="max-w-[680px]">
                            <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-600 uppercase dark:text-violet-400">
                                CHROME EXTENSION
                            </div>
                            <h2 className="text-[clamp(26px,3.6vw,44px)] leading-tight font-extrabold tracking-tight">
                                Tanuld a szavakat ott, ahol találkozol velük
                            </h2>
                            <p className="mt-4 text-lg leading-relaxed text-neutral-500 dark:text-neutral-400">
                                Híroldalon, YouTube-on, Redditen — keress rá az
                                ismeretlen szavakra anélkül, hogy elhagynád az
                                oldalt. A popupban azonnal ott a jelentés és a
                                státusz.
                            </p>
                        </div>

                        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                            {/* browser mockup */}
                            <div className="overflow-hidden rounded-[18px] border border-neutral-200 bg-neutral-50 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
                                {/* browser chrome bar */}
                                <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
                                    <span className="size-2.5 rounded-full bg-red-400 opacity-70" />
                                    <span className="size-2.5 rounded-full bg-amber-400 opacity-70" />
                                    <span className="size-2.5 rounded-full bg-green-400 opacity-70" />
                                    <div className="ml-2 flex flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-400 dark:border-neutral-600 dark:bg-neutral-700">
                                        <MI n="lock" s={14} />
                                        en.wikipedia.org
                                    </div>
                                    <div className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-400">
                                        <MI
                                            n="menu_book"
                                            s={15}
                                            style={
                                                {
                                                    color: '#fff',
                                                } as React.CSSProperties
                                            }
                                        />
                                    </div>
                                </div>
                                {/* page content */}
                                <div className="relative min-h-[400px] p-7">
                                    <p className="text-lg leading-[1.9] text-neutral-700 dark:text-neutral-300">
                                        The space{' '}
                                        <span className="rounded-md bg-blue-100 px-1 py-0.5 text-blue-900 shadow-[0_0_0_2px_rgba(59,130,246,0.3)] dark:bg-blue-900/30 dark:text-blue-300">
                                            between
                                        </span>{' '}
                                        two cities lies a valley known for its
                                        remarkable landscape and resilient
                                        wildlife.
                                    </p>

                                    {/* popup */}
                                    <div className="absolute top-28 left-7 w-[300px] overflow-hidden rounded-[16px] border border-neutral-200 bg-white shadow-xl dark:border-neutral-600 dark:bg-neutral-800">
                                        <div className="flex items-center justify-between border-b border-neutral-100 px-3.5 py-3 dark:border-neutral-700">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-500">
                                                <MI n="check_circle" f s={15} />{' '}
                                                Ismert szó
                                            </span>
                                            <MI
                                                n="close"
                                                s={18}
                                                style={
                                                    {
                                                        color: '#a1a1a1',
                                                        cursor: 'pointer',
                                                    } as React.CSSProperties
                                                }
                                            />
                                        </div>
                                        <div className="p-3.5">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[22px] font-extrabold tracking-tight">
                                                    between
                                                </span>
                                                <span className="text-xs text-neutral-400 italic">
                                                    prep
                                                </span>
                                                <span className="ml-auto text-xs font-bold text-violet-600 tabular-nums">
                                                    #42
                                                </span>
                                            </div>
                                            <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
                                                között, -ek között
                                            </div>
                                            <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                                                in the middle of
                                            </div>
                                            <div className="mt-3.5 grid grid-cols-2 gap-1.5">
                                                {[
                                                    {
                                                        label: 'Tanulom',
                                                        active: false,
                                                    },
                                                    {
                                                        label: 'Mentett',
                                                        active: false,
                                                    },
                                                    {
                                                        label: 'Tudom',
                                                        active: true,
                                                    },
                                                    {
                                                        label: 'Kiejtés',
                                                        active: false,
                                                    },
                                                ].map(({ label, active }) => (
                                                    <button
                                                        key={label}
                                                        className={`rounded-full py-1 text-[11px] font-semibold transition-all ${
                                                            active
                                                                ? 'bg-green-500 text-white'
                                                                : 'border border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400'
                                                        }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-3 flex cursor-pointer items-center justify-end gap-1 text-xs font-bold text-violet-600">
                                                Megnyitás{' '}
                                                <MI n="arrow_forward" s={16} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* methods */}
                            <div className="flex flex-col gap-3">
                                {EXT_METHODS.map((m) => (
                                    <div
                                        key={m.title}
                                        className="flex gap-4 rounded-[14px] border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900"
                                    >
                                        <span className="flex size-10 flex-none items-center justify-center rounded-[11px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                                            <MI n={m.icon} s={22} />
                                        </span>
                                        <div>
                                            <div className="text-[15px] font-bold">
                                                {m.title}
                                            </div>
                                            <div className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                                                {m.desc}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* install section */}
                        <div className="mt-8 grid items-center gap-8 rounded-[20px] border border-neutral-200 bg-neutral-50 p-8 md:grid-cols-[0.8fr_1.2fr] dark:border-neutral-700 dark:bg-neutral-900">
                            <div>
                                <h3 className="text-xl font-extrabold tracking-tight">
                                    Hogyan telepítsd?
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                                    A tesztidőszak alatt fejlesztői módban
                                    telepíthető. Hamarosan a Chrome Web
                                    Store-ban is.
                                </p>
                                {auth.user ? (
                                    <a
                                        href="/downloads/topwords-extension.zip"
                                        download
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-violet-700"
                                    >
                                        <MI n="download" s={20} /> Bővítmény
                                        letöltése (.zip)
                                    </a>
                                ) : (
                                    <Link
                                        href={login()}
                                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-violet-500 to-violet-400 px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-violet-700"
                                    >
                                        <MI n="login" s={20} /> Jelentkezz be a
                                        letöltéshez
                                    </Link>
                                )}
                                <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                                    Chrome / Edge / Brave böngészőkben működik.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    {
                                        n: 1,
                                        text: 'Töltsd le a .zip-et, és csomagold ki egy mappába',
                                    },
                                    {
                                        n: 2,
                                        text: (
                                            <>
                                                Nyisd meg:{' '}
                                                <ChromeExtensionsLink />
                                            </>
                                        ),
                                    },
                                    {
                                        n: 3,
                                        text: 'Kapcsold be a Fejlesztői módot (jobb felső sarok)',
                                    },
                                    {
                                        n: 4,
                                        text: 'Kattints: Kicsomagolt bővítmény betöltése',
                                    },
                                    {
                                        n: 5,
                                        text: 'Válaszd ki a kicsomagolt mappát',
                                    },
                                ].map(({ n, text }) => (
                                    <div
                                        key={n}
                                        className="flex items-center gap-3"
                                    >
                                        <span className="flex size-7 flex-none items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">
                                            {n}
                                        </span>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                            {text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== PRICING ===================== */}
                {billingEnabled && (
                    <section
                        id="pricing"
                        className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-24"
                    >
                        <div className="mx-auto max-w-[680px] text-center">
                            <div className="mb-3 text-xs font-bold tracking-[1.6px] text-violet-600 uppercase dark:text-violet-400">
                                ÁRAZÁS
                            </div>
                            <h2 className="text-[clamp(26px,3.6vw,44px)] leading-tight font-extrabold tracking-tight">
                                Válaszd ki a hozzád illő csomagot
                            </h2>
                            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
                                Kezdd ingyen, és bármikor válts előfizetésre — a
                                Prémiummal az AI-funkciók is elérhetők.
                            </p>
                        </div>

                        <div className="mx-auto mt-12 grid max-w-[860px] gap-5 sm:grid-cols-3">
                            {[
                                {
                                    name: 'Ingyenes',
                                    icon: null,
                                    price: '0 Ft',
                                    period: 'örökké',
                                    tagline:
                                        'Szólista, flashcard, kvíz és a Chrome-bővítmény alapjai.',
                                    featured: false,
                                },
                                {
                                    name: 'Standard',
                                    icon: 'bolt',
                                    price: '1 490 Ft',
                                    period: '/ hó · ~4 €',
                                    tagline:
                                        'Nagyobb limitek és mentés közvetlenül a bővítményből.',
                                    featured: true,
                                },
                                {
                                    name: 'Prémium',
                                    icon: 'auto_awesome',
                                    price: '2 490 Ft',
                                    period: '/ hó · ~6 €',
                                    tagline:
                                        'Korlátlan használat és a teljes AI-eszköztár.',
                                    featured: false,
                                },
                            ].map((plan) => (
                                <div
                                    key={plan.name}
                                    className={`relative flex flex-col rounded-[20px] border bg-white p-6 text-left transition-all hover:-translate-y-1 hover:shadow-lg dark:bg-neutral-800 ${
                                        plan.featured
                                            ? 'border-2 border-violet-400 shadow-md dark:border-violet-500'
                                            : 'border-neutral-200 dark:border-neutral-700'
                                    }`}
                                >
                                    {plan.featured && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="rounded-full bg-gradient-to-br from-violet-500 to-violet-400 px-3 py-1 text-[11px] font-bold whitespace-nowrap text-white">
                                                Legnépszerűbb
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold text-neutral-500 dark:text-neutral-400">
                                            {plan.name}
                                        </span>
                                        {plan.icon && (
                                            <MI
                                                n={plan.icon}
                                                f
                                                s={16}
                                                style={
                                                    {
                                                        color: '#8b5cf6',
                                                    } as React.CSSProperties
                                                }
                                            />
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-[28px] leading-none font-extrabold tracking-tight">
                                            {plan.price}
                                        </span>
                                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                            {plan.period}
                                        </span>
                                    </div>
                                    <p className="mt-4 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                                        {plan.tagline}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-10 flex flex-col items-center gap-3">
                            <Link href={pricing()}>
                                <Button
                                    size="lg"
                                    className="gap-2 bg-gradient-to-br from-violet-500 to-violet-400 text-white hover:bg-violet-700"
                                >
                                    Csomagok összehasonlítása
                                    <MI n="arrow_forward" s={20} />
                                </Button>
                            </Link>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500">
                                Az előfizetés bármikor lemondható.
                            </p>
                        </div>
                    </section>
                )}

                {/* ===================== CTA ===================== */}
                {!auth.user && (
                    <section className="relative overflow-hidden bg-gradient-to-br from-violet-600 to-violet-400">
                        <div className="pointer-events-none absolute -top-20 left-1/4 size-96 rounded-full bg-white/15" />
                        <div className="pointer-events-none absolute right-1/4 -bottom-16 size-80 rounded-full bg-white/10" />
                        <div className="relative mx-auto max-w-[1200px] px-4 py-16 text-center sm:px-6 md:py-24">
                            <h2 className="text-3xl font-extrabold tracking-tight text-white">
                                Készen állsz elkezdeni?
                            </h2>
                            <p className="mx-auto mt-4 max-w-xl text-violet-200">
                                Szólista, flashcard SRS, kvíz mód és Chrome
                                extension — egy helyen, magyarul.
                            </p>
                            <div className="mt-8 flex flex-wrap justify-center gap-3">
                                {canRegister && (
                                    <Button
                                        size="lg"
                                        asChild
                                        className="bg-white text-violet-700 hover:bg-violet-50"
                                    >
                                        <Link
                                            href={register()}
                                            className="flex items-center gap-2"
                                        >
                                            Regisztrálás{' '}
                                            <MI n="arrow_forward" s={20} />
                                        </Link>
                                    </Button>
                                )}
                                <Button
                                    size="lg"
                                    variant="outline"
                                    asChild
                                    className="border-white/40 text-white hover:bg-white/10 hover:text-white"
                                >
                                    <Link href={login()}>Már van fiókom</Link>
                                </Button>
                            </div>
                        </div>
                    </section>
                )}

                {/* ===================== FOOTER ===================== */}
                <footer className="border-t border-neutral-200 dark:border-neutral-700">
                    <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-neutral-400 sm:px-6 dark:text-neutral-500">
                        <div className="flex items-center gap-2 font-bold text-neutral-700 dark:text-neutral-300">
                            <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-violet-400">
                                <MI
                                    n="menu_book"
                                    s={15}
                                    style={
                                        { color: '#fff' } as React.CSSProperties
                                    }
                                />
                            </span>
                            TopWords
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <Link
                                href={terms()}
                                className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                ÁSZF
                            </Link>
                            <span>·</span>
                            <Link
                                href={privacy()}
                                className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                            >
                                Adatkezelés
                            </Link>
                            <span>·</span>
                            <a
                                href="https://codebarley.hu"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
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
