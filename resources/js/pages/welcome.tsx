import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlarmClock,
    ArrowRight,
    Bookmark,
    Bug,
    Check,
    CheckCircle2,
    Chrome,
    Download,
    Edit,
    FileSearch,
    Film,
    Flame,
    Keyboard,
    Languages,
    Layers,
    LayoutGrid,
    List,
    Menu,
    Mic,
    MousePointerClick,
    NotebookPen,
    Play,
    Puzzle,
    Route,
    Shuffle,
    SlidersHorizontal,
    Sparkles,
    Star,
    Table,
    Volume2,
    Wand2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BetaBanner from '@/components/beta-banner';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';
// A letöltő blokkal együtt kivezetve (2026-07-29):
// import ChromeExtensionsLink from '@/components/chrome-extensions-link';
import { dashboard, login, pricing as pricingRoute, register } from '@/routes';
// import { show as showDownload } from '@/routes/downloads';
import { index as wordsIndex } from '@/routes/words';

type Status = 'Tudom' | 'Tanulom' | 'Később' | 'Kiejtés' | 'Gyakorlásra';

type WordEntry = {
    num: number;
    word: string;
    pos: string;
    hu: string;
    syn: string[];
    ex: { en: string; hu: string };
    imp: number;
    status: Status | null;
};

const INITIAL_WORDS: WordEntry[] = [
    {
        num: 178,
        word: 'between',
        pos: 'elöljáró',
        hu: 'között',
        syn: ['among', 'amid'],
        ex: {
            en: 'The space between two cities lies a valley.',
            hu: 'A két város közötti térben egy völgy fekszik.',
        },
        imp: 4,
        status: 'Tudom',
    },
    {
        num: 288,
        word: 'important',
        pos: 'melléknév',
        hu: 'fontos',
        syn: ['significant', 'crucial'],
        ex: {
            en: 'This is a very important decision.',
            hu: 'Ez egy nagyon fontos döntés.',
        },
        imp: 5,
        status: 'Tanulom',
    },
    {
        num: 215,
        word: 'different',
        pos: 'melléknév',
        hu: 'különböző',
        syn: ['distinct', 'various'],
        ex: {
            en: 'They have completely different opinions.',
            hu: 'Teljesen különböző véleményük van.',
        },
        imp: 3,
        status: 'Később',
    },
    {
        num: 305,
        word: 'government',
        pos: 'főnév',
        hu: 'kormány',
        syn: ['administration', 'state'],
        ex: {
            en: 'The government passed a new law.',
            hu: 'A kormány új törvényt fogadott el.',
        },
        imp: 3,
        status: 'Kiejtés',
    },
    {
        num: 468,
        word: 'experience',
        pos: 'főnév',
        hu: 'tapasztalat',
        syn: ['expertise', 'knowledge'],
        ex: {
            en: 'She has years of experience.',
            hu: 'Több éves tapasztalata van.',
        },
        imp: 4,
        status: 'Gyakorlásra',
    },
    {
        num: 160,
        word: 'world',
        pos: 'főnév',
        hu: 'világ',
        syn: ['earth', 'globe'],
        ex: {
            en: 'He traveled around the world.',
            hu: 'Körbeutazta a világot.',
        },
        imp: 4,
        status: 'Tudom',
    },
    {
        num: 92,
        word: 'because',
        pos: 'kötőszó',
        hu: 'mert',
        syn: ['since', 'as'],
        ex: {
            en: 'I stayed because it was raining.',
            hu: 'Maradtam, mert esett az eső.',
        },
        imp: 2,
        status: null,
    },
    {
        num: 125,
        word: 'think',
        pos: 'ige',
        hu: 'gondol',
        syn: ['believe', 'consider'],
        ex: {
            en: 'I think you are right.',
            hu: 'Szerintem igazad van.',
        },
        imp: 3,
        status: null,
    },
];

const STATUS_META: Record<
    Status,
    {
        icon: React.ComponentType<{ size?: number; className?: string }>;
        color: string;
        bg: string;
        tint: string;
    }
> = {
    Tudom: { icon: Check, color: '#16a34a', bg: '#dcfce7', tint: '#f4fcf6' },
    Tanulom: {
        icon: AlarmClock,
        color: '#2563eb',
        bg: '#dbeafe',
        tint: '#f3f8ff',
    },
    Később: {
        icon: Bookmark,
        color: '#ea580c',
        bg: '#ffedd5',
        tint: '#fff9f3',
    },
    Kiejtés: { icon: Mic, color: '#9333ea', bg: '#f3e8ff', tint: '#fbf7ff' },
    Gyakorlásra: {
        icon: Edit,
        color: '#dc2626',
        bg: '#fee2e2',
        tint: '#fff5f5',
    },
};

const RATE_DEFS = [
    { label: 'Újra', time: '1 perc', c: '#ef4444' },
    { label: 'Nehéz', time: '6 nap', c: '#f59e0b' },
    { label: 'Jó', time: '10 nap', c: '#22c55e' },
    { label: 'Könnyű', time: '15 nap', c: '#3b82f6' },
];

const SRS_EXPLAIN = [
    {
        label: 'Újra',
        bg: '#ef4444',
        desc: 'Visszakerül a tanulási lépések elejére.',
    },
    {
        label: 'Nehéz',
        bg: '#f59e0b',
        desc: 'Kisebb intervallum, csökkenő ease faktor.',
    },
    {
        label: 'Jó',
        bg: '#22c55e',
        desc: 'Az intervallum nő az ease faktor alapján.',
    },
    { label: 'Könnyű', bg: '#3b82f6', desc: 'Tovább vár, az ease faktor nő.' },
];

const DEMO_DECK = [
    {
        rank: '#288 · Top 1 000 · melléknév',
        word: 'important',
        translation: 'fontos',
        example: 'This is a very important decision.',
        exampleHu: 'Ez egy nagyon fontos döntés.',
    },
    {
        rank: '#178 · Top 1 000 · elöljáró',
        word: 'between',
        translation: 'között',
        example: 'The space between two cities lies a valley.',
        exampleHu: 'A két város közötti térben egy völgy fekszik.',
    },
    {
        rank: '#215 · Top 1 000 · melléknév',
        word: 'different',
        translation: 'különböző',
        example: 'They have completely different opinions.',
        exampleHu: 'Teljesen különböző véleményük van.',
    },
    {
        rank: '#305 · Top 1 000 · főnév',
        word: 'government',
        translation: 'kormány',
        example: 'The government passed a new law.',
        exampleHu: 'A kormány új törvényt fogadott el.',
    },
];

const FLASH_CAPS = [
    {
        icon: Layers,
        title: 'Saját deck-ek',
        desc: 'Tetszőleges számú kártyacsomag különböző témákhoz.',
    },
    {
        icon: Route,
        title: 'Kétirányú kártyák',
        desc: 'Előlap→hátlap és vissza — külön értékelve.',
    },
    {
        icon: Volume2,
        title: 'Hangos felolvasás',
        desc: 'Az elő- és hátlap szövege felolvasható.',
    },
    {
        icon: Shuffle,
        title: 'Kártyák keverése',
        desc: 'Bekapcsolható keverés a kétoldalú kártyáknál.',
    },
    {
        icon: Download,
        title: 'Import a szólistáról',
        desc: 'Egy kattintással importálhatsz kártyát.',
    },
    {
        icon: Table,
        title: 'CSV import / export',
        desc: 'Importálj CSV-ből vagy exportáld a decked.',
    },
    {
        icon: SlidersHorizontal,
        title: 'Deckenként testreszabható',
        desc: 'Napi korlát, lépések, ease faktorok, keverés.',
    },
    {
        icon: LayoutGrid,
        title: 'Haladás nyomon követése',
        desc: 'Új · Tanulás · Ismétlés — és mikor esedékes.',
    },
    {
        icon: Bug,
        title: 'Leech detektálás',
        desc: 'A sokat tévesztett kártyákat automatikusan jelöli.',
    },
];

/*
 * KIVEZETVE (2026-07-28) — a "Gyakorlási módok" szekcióval együtt.
 * Mind a négy mód (kvíz, cloze, szabad írás, rendhagyó igék) route-ja ki van
 * kommentelve a routes/words.php-ban, tehát a landing nem hirdetheti őket.
 * A funkciók visszahozásakor ez a tömb és a hozzá tartozó szekció együtt
 * kapcsolható vissza.
 *
 * const PRACTICE_MODES = [
 *     { icon: HelpCircle, title: 'Kvíz', desc: '4 válaszos teszt, szűrhető státusz, nehézség és mappa szerint.' },
 *     { icon: Edit, title: 'Mondatkiegészítés', desc: 'írd be a hiányzó szót a példamondatba (cloze).' },
 *     { icon: PenTool, title: 'Szabad írás', desc: 'írj a célszavakkal, az AI ellenőrzi a szóhasználatot és a grammatikát.' },
 *     { icon: Route, title: 'Rendhagyó igék', desc: 'gyakorold a Past Simple és Past Participle alakokat.' },
 * ];
 */

const ANALYZE_BULLETS = [
    {
        icon: LayoutGrid,
        title: 'Érthetőség %',
        desc: 'látod, hány szót ismersz a szövegben',
    },
    {
        icon: MousePointerClick,
        title: 'Shift + kattintás',
        desc: 'jelölj ki több szót, és vidd fel egész kifejezésként',
    },
    {
        icon: Sparkles,
        title: 'Közvetlen AI-kitöltés',
        desc: 'a bővítményből egyenesen a webappba',
    },
    {
        icon: FileSearch,
        title: 'YouTube & Netflix',
        desc: 'elemezd a feliratokat, és lásd, hány szót értesz belőlük',
    },
];

const AI_CARDS = [
    {
        icon: Wand2,
        title: 'AI szó-kitöltés',
        desc: 'Egy kattintással kitölti egy szó magyar jelentését, szófaját és példamondatait — nálad marad a végső szó.',
    },
    {
        icon: Check,
        title: 'Mondat-ellenőrzés',
        desc: 'Írj egy mondatot a szóval, és az AI visszajelez a szóhasználatról és a grammatikáról.',
    },
    {
        icon: NotebookPen,
        title: 'AI flashcard',
        desc: 'A szövegelemzőben talált ismeretlen szóból az AI azonnal kész, kétoldalas kártyát gyárt.',
    },
];

/*
 * A tananyag-videók listája NEM itt él, hanem a `/guide` oldalon
 * (`pages/guide.tsx`). Korábban a főoldal egy `page === 'videos'` state-tel
 * saját, párhuzamos Tananyag-oldalt rajzolt egy MÁSIK videólistából — annak
 * nem volt URL-je, a Vissza gomb kilépett az oldalról, és a két lista már el
 * is csúszott egymástól. A főoldal fejléce most a `/guide`-ra mutat.
 */

const EXT_USAGE = [
    {
        icon: MousePointerClick,
        title: 'Dupla kattintás + tartás',
        desc: 'Dupla kattints egy szóra, tartsd fél másodpercig — megjelenik a jelentés.',
    },
    {
        icon: Keyboard,
        title: 'Option+W gyorsbillentyű',
        desc: 'Option+W (Mac) vagy Alt+W (Windows) — megnyílik a keresőmező.',
    },
    {
        icon: MousePointerClick,
        title: 'Jobb kattintás menü',
        desc: 'Jelölj ki egy szót → „Szó keresése” a TopWords szólistáján.',
    },
    {
        icon: FileSearch,
        title: 'Puzzle → szövegelemzés',
        desc: 'Az ikonra kattintva az oldal szövege megnyílik a szövegelemzőben.',
    },
];

// A fejlesztői módú telepítés lépései kivezetve (2026-07-29) — a bővítmény a
// Chrome Web Store-ból fog települni, lásd a bővítmény-szekció kommentjét.
// const INSTALL_STEPS = [
//     { n: 1, text: 'Töltsd le a .zip-et, és csomagold ki egy mappába' },
//     { n: 2, text: 'Nyisd meg: chrome://extensions' },
//     { n: 3, text: 'Kapcsold be a Fejlesztői módot (jobb felső sarok)' },
//     { n: 4, text: 'Kattints: Kicsomagolt bővítmény betöltése' },
//     { n: 5, text: 'Válaszd ki a kicsomagolt mappát' },
// ];

const FREE_PLAN = [
    '10 000 szavas szólista',
    'Flashcard SRS, saját deck-ek',
    'Chrome-bővítmény, napi kerettel',
    'AI-kóstoló havi kerettel',
];

const PRO_PLAN = [
    'Minden az Ingyenesből',
    'Korlátlan AI szó-kitöltés',
    'AI mondat-ellenőrzés',
    'Könyv- és YouTube-elemzés',
    'Legnagyobb keretek, prioritás',
];

const SIDE_NAV_DEFS = [
    { id: 'funkciok', label: 'Funkciók', icon: LayoutGrid },
    { id: 'szovegelemzes', label: 'Szövegelemzés', icon: FileSearch },
    { id: 'szolista', label: 'Szólista', icon: List },
    { id: 'flashcard', label: 'Flashcard', icon: Layers },
    // Kivezetve a "Gyakorlási módok" szekcióval együtt (2026-07-28):
    // { id: 'gyakorlas', label: 'Gyakorlás', icon: HelpCircle },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'bovitmeny', label: 'Bővítmény', icon: Puzzle },
    { id: 'arazas', label: 'Árazás', icon: SlidersHorizontal },
];

function fmt(n: number) {
    return Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function useCountUp(target: number, suffix = '') {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        const io = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) {
                        return;
                    }

                    obs.unobserve(el);
                    const dur = 1500;
                    const start = performance.now();

                    const step = (t: number) => {
                        const p = Math.min(1, (t - start) / dur);
                        const e = 1 - Math.pow(1 - p, 3);
                        el.textContent = fmt(target * e) + suffix;

                        if (p < 1) {
                            requestAnimationFrame(step);
                        }
                    };

                    requestAnimationFrame(step);
                });
            },
            { threshold: 0.6 },
        );

        io.observe(el);

        return () => io.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target]);

    return ref;
}

function Reveal({
    as: Tag = 'div',
    className,
    style,
    onMouseEnter,
    children,
}: {
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    onMouseEnter?: () => void;
    children: React.ReactNode;
}) {
    return (
        <Tag
            data-reveal
            className={className}
            style={style}
            onMouseEnter={onMouseEnter}
        >
            {children}
        </Tag>
    );
}

export default function Welcome({
    canRegister = true,
}: {
    canRegister?: boolean;
}) {
    const { auth, billingEnabled, extensionStoreUrl } = usePage().props;

    const [flipped, setFlipped] = useState(false);
    const [flipped2, setFlipped2] = useState(false);
    const [deckIndex, setDeckIndex] = useState(0);
    const demoCard = DEMO_DECK[deckIndex];
    const rateCard = () => {
        setFlipped2(false);
        setDeckIndex((i) => (i + 1) % DEMO_DECK.length);
    };
    // Kivezetve a "Gyakorlási módok" szekcióval (2026-07-28):
    // const [quizPick, setQuizPick] = useState<string | null>(null);
    const [filter, setFilter] = useState<'Összes' | 'Tanulom' | 'Tudom'>(
        'Összes',
    );
    const [activeSection, setActiveSection] = useState('funkciok');
    const [showSideNav, setShowSideNav] = useState(false);
    const [selWord, setSelWord] = useState(0);
    const [popupMode, setPopupMode] = useState<'word' | 'phrase'>('word');
    const [words, setWords] = useState<WordEntry[]>(INITIAL_WORDS);
    const [hoveredFeature, setHoveredFeature] = useState(0);

    const goToSection = (id: string) => {
        const el = document.getElementById(id);

        if (el) {
            window.scrollTo({
                top: el.getBoundingClientRect().top + window.scrollY - 90,
                behavior: 'smooth',
            });
        }
    };

    useEffect(() => {
        const ids = [
            'funkciok',
            'szovegelemzes',
            'szolista',
            'flashcard',
            // 'gyakorlas' — kivezetve (2026-07-28), a szekció nincs a DOM-ban
            'ai',
            'bovitmeny',
            'arazas',
        ];
        let raf: number | null = null;

        const onScroll = () => {
            if (raf) {
                return;
            }

            raf = requestAnimationFrame(() => {
                raf = null;
                const show = window.scrollY > 520;
                let active = activeSection;
                let closestDist = Infinity;
                let closest: string | null = null;

                ids.forEach((id) => {
                    const el = document.getElementById(id);

                    if (!el) {
                        return;
                    }

                    const rect = el.getBoundingClientRect();

                    if (rect.top < window.innerHeight * 0.6) {
                        const dist = Math.abs(rect.top - 120);

                        if (dist < closestDist) {
                            closestDist = dist;
                            closest = id;
                        }
                    }
                });

                if (closest) {
                    active = closest;
                }

                setShowSideNav(show);
                setActiveSection(active);
            });
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        return () => window.removeEventListener('scroll', onScroll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setWord = (i: number, st: Status) => {
        setWords((prev) => {
            const next = prev.slice();
            next[i] = { ...next[i], status: next[i].status === st ? null : st };

            return next;
        });
    };

    const knownCount = words.filter((w) => w.status === 'Tudom').length;
    const filterTabs = (['Összes', 'Tanulom', 'Tudom'] as const).map(
        (label) => ({
            label,
            count:
                label === 'Összes'
                    ? words.length
                    : words.filter((w) => w.status === label).length,
        }),
    );
    const visibleWords = words
        .map((w, i) => ({ ...w, i }))
        .filter((w) => filter === 'Összes' || w.status === filter);

    const sel = words[selWord] ?? words[0];
    const selMeta = sel.status ? STATUS_META[sel.status] : null;
    const detailButtons: Status[] = [
        'Tudom',
        'Tanulom',
        'Később',
        'Kiejtés',
        'Gyakorlásra',
    ];

    /*
     * Kivezetve a "Gyakorlási módok" szekcióval (2026-07-28):
     * const answered = quizPick != null;
     * const quizOptions = [
     *     { l: 'között', correct: true },
     *     { l: 'felett', correct: false },
     *     { l: 'mellett', correct: false },
     *     { l: 'mögött', correct: false },
     * ];
     * const correct = quizPick === 'között';
     */

    const progressRef = useCountUp(41, '%');
    const wordCountRef = useCountUp(4187);
    const analyzePctRef = useCountUp(87, '%');
    const analyzeCountRef = useCountUp(312);
    const barRef = useRef<HTMLDivElement>(null);
    const bar2Ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const io = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-bar-grow');
                        obs.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.4 },
        );

        [barRef.current, bar2Ref.current].forEach((el) => el && io.observe(el));

        return () => io.disconnect();
    }, []);

    return (
        <>
            <Head title="Top 10 000 angol szó – Tanuld meg a legfontosabb szavakat">
                <meta
                    head-key="description"
                    name="description"
                    content="Tanuld meg a 10 000 leggyakoribb angol szót. Szólista, flashcard SRS, szövegelemző és Chrome-bővítmény, AI-segítséggel – egy helyen, magyarul."
                />
                <meta
                    head-key="og:title"
                    property="og:title"
                    content="TopWords – Top 10 000 angol szó"
                />
                <meta
                    head-key="og:description"
                    property="og:description"
                    content="Tanuld a 10 000 leggyakoribb angol szót flashcard SRS-sel és szövegelemzővel. Jelöld amit tudsz, és kövesd a haladásodat."
                />
                <meta
                    head-key="og:url"
                    property="og:url"
                    content="https://topwords.eu/"
                />
            </Head>

            <div className="overflow-x-hidden bg-[#fafafa] font-['Manrope',system-ui,sans-serif] text-[#262626] antialiased">
                <BetaBanner />

                <a
                    href="#main"
                    className="sr-only rounded-b-lg bg-white px-4 py-2 text-sm font-medium text-indigo-900 underline focus:not-sr-only focus:absolute focus:top-0 focus:left-4 focus:z-100"
                >
                    Ugrás a tartalomra
                </a>

                {/*
                 * Szekció-navigáció. Korábban `<div onClick>` volt: egérrel
                 * működött, billentyűzettel elérhetetlen volt. Most gomb, és
                 * a rejtett állapotban `inert`, hogy a tabolás se akadjon el
                 * a láthatatlan ikonokon.
                 */}
                <nav
                    aria-label="Szekciók"
                    inert={!showSideNav}
                    className="fixed top-1/2 right-[22px] z-50 hidden -translate-y-1/2 flex-col gap-1.5 rounded-full border border-[#ececf2] bg-white/90 p-2 shadow-[0_18px_44px_rgba(0,0,0,.12)] backdrop-blur-[10px] transition-opacity duration-300 lg:flex"
                    style={{ opacity: showSideNav ? 1 : 0 }}
                >
                    {SIDE_NAV_DEFS.map((n) => {
                        const active = activeSection === n.id;
                        const Icon = n.icon;

                        return (
                            <button
                                key={n.id}
                                type="button"
                                onClick={() => goToSection(n.id)}
                                aria-label={n.label}
                                aria-current={active ? 'true' : undefined}
                                title={n.label}
                                className="flex cursor-pointer p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
                            >
                                <span
                                    className="grid size-10 flex-none place-items-center rounded-full transition-all duration-250"
                                    style={{
                                        background: active
                                            ? '#4338ca'
                                            : 'transparent',
                                        color: active ? '#fff' : '#6b6b78',
                                        boxShadow: active
                                            ? '0 8px 18px rgba(67,56,202,.35)'
                                            : 'none',
                                    }}
                                >
                                    <Icon size={22} />
                                </span>
                            </button>
                        );
                    })}
                </nav>

                <div className="relative">
                    {/*
                     * A fejléc a gradiens-hero fölött lebeg, de a DOM-ban a
                     * `main` előtt áll — így a landmark-sorrend helyes marad,
                     * és az ugrólink a tartalomra visz, nem a navigációra.
                     */}
                    <div className="absolute inset-x-0 top-0 z-20">
                        <PublicHeader variant="transparent" />
                    </div>

                    <main id="main">
                        <section
                            className="relative overflow-hidden px-5 pt-22 pb-[200px]"
                            style={{
                                background:
                                    'linear-gradient(180deg,#20276B 0%,#3a3688 14%,#6548AC 30%,#5566c4 44%,#4F8EEC 66%,#4F8EEC 100%)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute -top-35 left-1/2 size-[900px] -translate-x-1/2 rounded-full blur-[30px]"
                                style={{
                                    background:
                                        'radial-gradient(circle,rgba(79,70,229,.45),transparent 62%)',
                                }}
                            />
                            <div
                                className="pointer-events-none absolute top-[340px] -left-30 size-[420px] rounded-full blur-[20px]"
                                style={{
                                    background:
                                        'radial-gradient(circle,rgba(79,70,229,.28),transparent 65%)',
                                }}
                            />

                            {/* hero copy */}
                            <div className="relative z-4 mx-auto mt-14 max-w-[840px] text-center">
                                <h1 className="text-[clamp(42px,6.6vw,80px)] leading-[1.02] font-extrabold tracking-[-1.5px] text-white">
                                    Angol szavak tanulása
                                    <br />
                                    hatékonyan
                                </h1>
                                <p className="mx-auto mt-5.5 max-w-[600px] text-[17px] leading-[1.65] text-white/78">
                                    <b className="text-white">Tanuld</b> és{' '}
                                    <b className="text-white">kövesd nyomon</b>{' '}
                                    az angol szavakat a{' '}
                                    <b className="text-white">
                                        leghatékonyabb módon
                                    </b>
                                    : indulj egy{' '}
                                    <b className="text-white">
                                        10 000 szavas kezdő szótárral
                                    </b>
                                    , amit{' '}
                                    <b className="text-white">
                                        magad bővíthetsz
                                    </b>
                                    , és használd cikkekben,{' '}
                                    <span className="inline-flex -translate-y-px items-center gap-1 rounded-full bg-[#ff0033] px-2 py-0.5 align-middle text-[13px] font-bold text-white">
                                        <Play size={11} />
                                        YouTube
                                    </span>{' '}
                                    és{' '}
                                    <span className="inline-flex -translate-y-px items-center gap-1 rounded-full bg-[#e50914] px-2 py-0.5 align-middle text-[13px] font-bold text-white">
                                        <Film size={11} />
                                        Netflix
                                    </span>{' '}
                                    videóiban, vagy{' '}
                                    <span className="inline-flex -translate-y-px items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 align-middle text-[13px] font-bold text-white">
                                        <Layers size={11} />
                                        flashcard
                                    </span>
                                    okban is — az{' '}
                                    <span className="inline-flex -translate-y-px items-center gap-1 rounded-full bg-linear-to-r from-indigo-500 to-violet-500 px-2 py-0.5 align-middle text-[13px] font-bold text-white">
                                        <Sparkles size={11} />
                                        AI
                                    </span>
                                    -nak köszönhetően mindez{' '}
                                    <b className="text-white">villámgyorsan</b>.
                                </p>
                                <div className="mt-8.5 flex flex-wrap justify-center gap-3.5">
                                    {auth.user ? (
                                        <Link
                                            href={wordsIndex()}
                                            className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-br from-green-400 to-green-500 px-7 py-3.75 font-sans text-[15px] font-bold text-green-950 shadow-[0_8px_22px_rgba(34,197,94,.3)] transition-transform hover:-translate-y-0.5"
                                        >
                                            Szavak böngészése
                                            <ArrowRight size={20} />
                                        </Link>
                                    ) : (
                                        <Link
                                            href={register()}
                                            className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-br from-green-400 to-green-500 px-7 py-3.75 font-sans text-[15px] font-bold text-green-950 shadow-[0_8px_22px_rgba(34,197,94,.3)] transition-transform hover:-translate-y-0.5"
                                        >
                                            Regisztrálás ingyen
                                            <ArrowRight size={20} />
                                        </Link>
                                    )}
                                    <a
                                        href="#flashcard"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            goToSection('flashcard');
                                        }}
                                        className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.22] bg-white/[0.08] px-6.5 py-3.75 font-sans text-[15px] font-medium text-white backdrop-blur-md transition-colors hover:bg-white/[0.18]"
                                    >
                                        <Layers size={20} />
                                        Próbáld a flashcardot
                                    </a>
                                </div>
                            </div>

                            {/* floating mockup cluster */}
                            <div className="relative z-3 mx-auto mt-16 flex max-w-[1060px] flex-wrap items-center justify-center gap-6">
                                <div
                                    className="pointer-events-none absolute top-[46%] bottom-[-320px] left-1/2 -z-10 w-screen -translate-x-1/2"
                                    style={{
                                        background:
                                            'linear-gradient(to bottom,rgba(255,255,255,0) 0,#ffffff 90px)',
                                    }}
                                />
                                {/*
                                 * A három fényfolt marad, mert funkciója van: kiemeli a mockup-kártyákat
                                 * a sötét háttérből. Az opacitásuk viszont .5/.46/.4-ről lejjebb ment —
                                 * azon a szinten már önálló "lebegő gradiens-labdának" látszottak,
                                 * ami a generált heroök tipikus dísze. Így halo marad, nem dekoráció.
                                 */}
                                <div
                                    className="pointer-events-none absolute top-6 -left-[4%] -z-10 size-[420px] animate-hero-float-slow-a rounded-full blur-[80px]"
                                    style={{
                                        background:
                                            'radial-gradient(circle,rgba(255,255,255,.28),transparent 70%)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute -top-9 -right-[5%] -z-10 size-[400px] animate-hero-float-slow-b rounded-full blur-[74px]"
                                    style={{
                                        background:
                                            'radial-gradient(circle,rgba(255,255,255,.24),transparent 70%)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute top-63 right-[4%] -z-10 size-[260px] animate-hero-float-c rounded-full blur-[60px]"
                                    style={{
                                        background:
                                            'radial-gradient(circle,rgba(255,255,255,.2),transparent 72%)',
                                    }}
                                />

                                {/* progress card */}
                                <div className="animate-hero-float-a">
                                    <div className="w-[280px] rounded-[22px] bg-white p-5.5 shadow-[0_26px_60px_rgba(0,0,0,.28)]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] font-semibold text-[#737373]">
                                                Haladásod
                                            </span>
                                            <span className="inline-flex items-center gap-1.25 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                                <Flame size={15} />7 nap
                                            </span>
                                        </div>
                                        <div className="mt-3.5 flex items-baseline gap-2">
                                            <span
                                                ref={progressRef}
                                                className="text-[42px] font-bold tracking-tight text-[#171717]"
                                            >
                                                41%
                                            </span>
                                            <span className="text-[13px] text-[#a1a1a1]">
                                                teljesítve
                                            </span>
                                        </div>
                                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-indigo-100">
                                            <div
                                                ref={barRef}
                                                className="h-full origin-left [transform:scaleX(0)] rounded-full bg-gradient-to-r from-indigo-600 to-indigo-800"
                                                style={{ width: '41%' }}
                                            />
                                        </div>
                                        <div className="mt-3 text-[13px] text-[#737373]">
                                            <span ref={wordCountRef}>
                                                4 187
                                            </span>{' '}
                                            / 10 000 szó megtanulva
                                        </div>
                                    </div>
                                </div>

                                {/* flashcard */}
                                <div className="animate-hero-float-b">
                                    <div className="w-[320px] rounded-[26px] bg-white p-5 shadow-[0_40px_70px_-20px_rgba(49,46,129,.35)]">
                                        <div className="flex items-center justify-center">
                                            <span className="rounded-full bg-[#f5f5f5] px-3.5 py-1.5 text-xs font-semibold text-[#525252]">
                                                Deck: Angol alapszavak · 1/40
                                            </span>
                                        </div>
                                        <button
                                            onClick={() =>
                                                setFlipped((v) => !v)
                                            }
                                            className="mt-4 h-[186px] w-full cursor-pointer"
                                            style={{ perspective: 1200 }}
                                        >
                                            <div
                                                className="relative size-full transition-transform duration-600 ease-[cubic-bezier(.4,.2,.2,1)]"
                                                style={{
                                                    transformStyle:
                                                        'preserve-3d',
                                                    transform: flipped
                                                        ? 'rotateY(180deg)'
                                                        : 'rotateY(0deg)',
                                                }}
                                            >
                                                <div
                                                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[18px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100"
                                                    style={{
                                                        backfaceVisibility:
                                                            'hidden',
                                                    }}
                                                >
                                                    <span className="text-xs font-semibold tracking-wide text-indigo-600">
                                                        #178 · Top 1 000 · prep
                                                    </span>
                                                    <span className="text-[38px] font-bold tracking-tight text-[#171717]">
                                                        between
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.25 text-xs text-[#a1a1a1]">
                                                        <MousePointerClick
                                                            size={15}
                                                        />
                                                        Kattints a
                                                        megfordításhoz
                                                    </span>
                                                </div>
                                                <div
                                                    className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[18px] bg-gradient-to-br from-indigo-700 to-indigo-800 p-4 text-center"
                                                    style={{
                                                        backfaceVisibility:
                                                            'hidden',
                                                        transform:
                                                            'rotateY(180deg)',
                                                    }}
                                                >
                                                    <span className="text-[34px] font-bold tracking-tight text-white">
                                                        között
                                                    </span>
                                                    <span className="text-[13px] leading-relaxed text-indigo-200">
                                                        „The space{' '}
                                                        <b className="text-white">
                                                            between
                                                        </b>{' '}
                                                        two cities lies a
                                                        valley.”
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                        <div className="mt-4 grid grid-cols-4 gap-2">
                                            {RATE_DEFS.map((r) => (
                                                <button
                                                    key={r.label}
                                                    onClick={() =>
                                                        setFlipped(false)
                                                    }
                                                    className="flex flex-col items-center gap-0.25 rounded-[10px] py-2 transition-transform hover:-translate-y-0.5"
                                                    style={{
                                                        border: `1px solid ${r.c}33`,
                                                        background: `${r.c}14`,
                                                        color: r.c,
                                                    }}
                                                >
                                                    <span className="text-xs font-semibold">
                                                        {r.label}
                                                    </span>
                                                    <span className="text-[10px] opacity-70">
                                                        {r.time}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* analyzer preview */}
                                <div className="animate-hero-float-c">
                                    <div className="w-[250px] rounded-[22px] border border-white/[0.28] bg-indigo-800/55 p-5.5 shadow-[0_26px_60px_rgba(49,46,129,.35)] backdrop-blur-[14px]">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-300/20 px-3 py-1.25 text-xs font-semibold text-green-200">
                                            <FileSearch size={15} />
                                            Szövegelemzés
                                        </span>
                                        <div className="mt-4 flex items-center gap-3.5">
                                            <div className="relative size-16">
                                                <div
                                                    className="absolute inset-0 rounded-full"
                                                    style={{
                                                        background:
                                                            'conic-gradient(#4ade80 0 87%,rgba(255,255,255,.15) 87%)',
                                                    }}
                                                />
                                                <div className="absolute inset-[7px] grid place-items-center rounded-full bg-indigo-950 text-[15px] font-bold text-white">
                                                    <span ref={analyzePctRef}>
                                                        87%
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-white">
                                                    érthetőség
                                                </div>
                                                <div className="text-xs text-white/60">
                                                    <span ref={analyzeCountRef}>
                                                        312
                                                    </span>{' '}
                                                    / 358 szó
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 text-xs leading-[1.7] text-white/80">
                                            The space{' '}
                                            <span className="rounded-[3px] bg-green-500 px-[3px] text-green-950">
                                                between
                                            </span>{' '}
                                            two{' '}
                                            <span className="rounded-[3px] bg-blue-500 px-[3px] text-white">
                                                cities
                                            </span>{' '}
                                            lies a{' '}
                                            <span className="rounded-[3px] bg-red-500 px-[3px] text-white">
                                                valley
                                            </span>
                                            .
                                        </div>
                                    </div>
                                </div>

                                <div className="ts-hero-badge pointer-events-none absolute -top-3.5 right-[6%] -rotate-[8deg] animate-hero-float-slow-a rounded-full bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-[0_10px_26px_rgba(0,0,0,.2)]">
                                    10 000 SZÓ
                                </div>
                                <div className="ts-hero-badge pointer-events-none absolute bottom-2 left-[4%] rotate-[-7deg] animate-hero-pulse rounded-full bg-[#171717] px-4 py-2 text-xs font-bold text-white shadow-[0_10px_26px_rgba(0,0,0,.28)]">
                                    SRS ISMÉTLÉS
                                </div>
                            </div>
                        </section>

                        {/* FEATURES */}
                        <section
                            id="funkciok"
                            className="relative -mt-35 bg-white px-5 pt-24 pb-25"
                        >
                            {/*
                             * A szekció-cím korábban "Minden, ami kell a hatékony tanuláshoz" volt:
                             * olyan mondat, ami bármelyik konkurens oldalán is állna. Helyette a
                             * tényleges munkamenetet írja le, mert az különbözteti meg a terméket.
                             */}
                            <Reveal className="mx-auto mb-15 max-w-[780px] text-center">
                                <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                    FUNKCIÓK
                                </span>
                                <h2 className="mt-5 text-[clamp(32px,4.4vw,50px)] leading-[1.08] font-bold tracking-[-1.2px] text-[#171717]">
                                    Egy szótár,
                                    <br />
                                    minden funkcióval összekötve
                                </h2>
                                <p className="mx-auto mt-4.5 max-w-[560px] text-[17px] leading-[1.6] text-[#737373]">
                                    Használd ki a rendszer előnyeit, kövesd a
                                    szótáradat, és gyakorold bármelyik funkción
                                    keresztül.
                                </p>
                            </Reveal>
                            {/*
                             * Nyolc kártya volt itt `auto-fit` ráccsal, ami a sor végén árva
                             * kártyákat hagyott. Most hat, fix 3x2 rácsban: nincs csonka sor,
                             * és nem kell mesterséges kiemelés sem a hierarchiához.
                             *
                             * A "Gyakorlási módok" kártya KIKERÜLT: kvízt, mondatkiegészítést és
                             * szabad írást hirdetett, amik kivezetett funkciók (routes/words.php
                             * ki van kommentelve) — nem hirdethetünk el nem érhető funkciót.
                             */}
                            <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                {[
                                    {
                                        icon: List,
                                        title: 'Szólista',
                                        desc: '10 000 szavas induló szótár: könnyen áttekinthető, szavanként jelölheted a tudásszinted, AI segíti a tanulást, és minden funkció erre a listára épül.',
                                    },
                                    {
                                        icon: Bookmark,
                                        title: 'Saját szavak',
                                        desc: 'Bővítsd a szótáradat tetszés szerint: vegyél fel új szavakat bárhonnan — akár film vagy YouTube-videó nézése közben is —, az AI segítségével, egy kattintással.',
                                    },
                                    {
                                        icon: Layers,
                                        title: 'Flashcard SRS',
                                        desc: 'A leghatékonyabb tanulási módszer: bízd az algoritmusra az ismétlést, és tanulj tehermentesen. Film vagy YouTube-videó nézése közben az AI egy kattintással kártyát is készít belőle.',
                                    },
                                    {
                                        icon: FileSearch,
                                        title: 'Szövegelemzés',
                                        desc: 'Találd meg a szintednek megfelelő tartalmat: nézd meg, mennyit értesz belőle, mielőtt nekiállnál — weboldal, könyv vagy YouTube-videó egyaránt.',
                                    },
                                    {
                                        icon: Puzzle,
                                        title: 'Chrome-bővítmény',
                                        desc: 'Telepítsd egy kattintással, és nézz YouTube- vagy Netflix-tartalmat, vagy böngéssz a saját szavaid kiemelésével — kezeld a szavaidat, és készíts flashcardot akár AI-val is.',
                                    },
                                    {
                                        icon: Languages,
                                        title: 'Végig magyarul',
                                        desc: 'Magyar jelentés, magyar példamondat, magyar felület — nem tükörfordított angol app.',
                                    },
                                ].map((f, i) => {
                                    const active = hoveredFeature === i;

                                    return (
                                        <Reveal
                                            key={f.title}
                                            className="relative overflow-hidden rounded-[18px] border border-neutral-200 bg-white p-6.5 transition-all duration-500 ease-out hover:-translate-y-1.5"
                                            style={
                                                active
                                                    ? {
                                                          boxShadow:
                                                              '0 20px 50px rgba(32,39,107,.3)',
                                                      }
                                                    : undefined
                                            }
                                            onMouseEnter={() =>
                                                setHoveredFeature(i)
                                            }
                                        >
                                            <div
                                                className="absolute inset-0 transition-opacity duration-500 ease-out"
                                                style={{
                                                    background:
                                                        'linear-gradient(160deg,#20276B,#3a3688)',
                                                    opacity: active ? 1 : 0,
                                                }}
                                            />
                                            <div className="relative">
                                                <div
                                                    className="grid size-13 place-items-center rounded-[14px] transition-all duration-500 ease-out"
                                                    style={
                                                        active
                                                            ? {
                                                                  background:
                                                                      'rgba(255,255,255,.14)',
                                                                  color: '#4ade80',
                                                              }
                                                            : {
                                                                  background:
                                                                      '#e0e7ff',
                                                                  color: '#4338ca',
                                                              }
                                                    }
                                                >
                                                    <f.icon size={26} />
                                                </div>
                                                <h3
                                                    className="mt-4.5 text-[19px] font-semibold tracking-[-.3px] transition-colors duration-500 ease-out"
                                                    style={{
                                                        color: active
                                                            ? '#fff'
                                                            : '#171717',
                                                    }}
                                                >
                                                    {f.title}
                                                </h3>
                                                <p
                                                    className="mt-2.5 text-sm leading-[1.6] transition-colors duration-500 ease-out"
                                                    style={{
                                                        color: active
                                                            ? 'rgba(255,255,255,.82)'
                                                            : '#737373',
                                                    }}
                                                >
                                                    {f.desc}
                                                </p>
                                            </div>
                                        </Reveal>
                                    );
                                })}
                            </div>
                        </section>

                        {/* SZÖVEGELEMZÉS */}
                        <section
                            id="szovegelemzes"
                            className="bg-white px-5 py-24"
                        >
                            <div className="mx-auto max-w-[1000px]">
                                <Reveal className="mx-auto max-w-[640px] text-center">
                                    <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                        SZÖVEGELEMZÉS
                                    </span>
                                    <h2 className="mt-4.5 text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                        Elemezz bármilyen angol szöveget
                                    </h2>
                                    <p className="mx-auto mt-4 text-[17px] leading-[1.6] text-[#737373]">
                                        Illeszd be a szöveget, adj meg egy
                                        webcímet vagy könyvet — vagy elemezd
                                        egyenesen a{' '}
                                        <b className="text-[#404040]">
                                            YouTube
                                        </b>{' '}
                                        és{' '}
                                        <b className="text-[#404040]">
                                            Netflix
                                        </b>{' '}
                                        feliratait. Minden elemzés megmutatja, a
                                        szöveg hány százalékát érted.
                                    </p>
                                </Reveal>

                                <Reveal
                                    className="mt-10 rounded-3xl border border-indigo-100 p-5 sm:p-8"
                                    style={{
                                        background:
                                            'linear-gradient(155deg,#f5f3ff,#eef2ff)',
                                    }}
                                >
                                    <div>
                                        <div className="mb-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                                            <span className="text-sm font-semibold text-[#525252]">
                                                Próbáld ki:
                                            </span>
                                            <div className="inline-flex gap-1.5 rounded-full border-[1.5px] border-indigo-200 bg-white p-1.5 shadow-[0_10px_26px_rgba(49,46,129,.14)]">
                                                <button
                                                    onClick={() =>
                                                        setPopupMode('word')
                                                    }
                                                    className="inline-flex items-center gap-1.25 rounded-full px-3.5 py-2 font-sans text-[13px] font-bold whitespace-nowrap transition-all sm:gap-1.75 sm:px-5 sm:py-2.75 sm:text-[15px]"
                                                    style={{
                                                        background:
                                                            popupMode === 'word'
                                                                ? '#4338ca'
                                                                : '#eef2ff',
                                                        color:
                                                            popupMode === 'word'
                                                                ? '#fff'
                                                                : '#4338ca',
                                                        boxShadow:
                                                            popupMode === 'word'
                                                                ? '0 8px 20px rgba(67,56,202,.4)'
                                                                : 'none',
                                                    }}
                                                >
                                                    <List
                                                        size={17}
                                                        className="shrink-0 sm:hidden"
                                                    />
                                                    <List
                                                        size={19}
                                                        className="hidden shrink-0 sm:block"
                                                    />
                                                    Egy szó
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setPopupMode('phrase')
                                                    }
                                                    className="inline-flex items-center gap-1.25 rounded-full px-3.5 py-2 font-sans text-[13px] font-bold whitespace-nowrap transition-all sm:gap-1.75 sm:px-5 sm:py-2.75 sm:text-[15px]"
                                                    style={{
                                                        background:
                                                            popupMode ===
                                                            'phrase'
                                                                ? '#4338ca'
                                                                : '#eef2ff',
                                                        color:
                                                            popupMode ===
                                                            'phrase'
                                                                ? '#fff'
                                                                : '#4338ca',
                                                        boxShadow:
                                                            popupMode ===
                                                            'phrase'
                                                                ? '0 8px 20px rgba(67,56,202,.4)'
                                                                : 'none',
                                                    }}
                                                >
                                                    <MousePointerClick
                                                        size={17}
                                                        className="shrink-0 sm:hidden"
                                                    />
                                                    <MousePointerClick
                                                        size={19}
                                                        className="hidden shrink-0 sm:block"
                                                    />
                                                    <span className="sm:hidden">
                                                        Kifejezés
                                                    </span>
                                                    <span className="hidden sm:inline">
                                                        Kifejezés · shift+click
                                                    </span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="relative mx-auto max-w-[900px]">
                                            <div className="relative aspect-[3/6] overflow-hidden rounded-[18px] bg-[#0b0b12] shadow-[0_30px_70px_rgba(0,0,0,.36)] sm:aspect-video">
                                                <div className="absolute top-3.5 left-3.5 z-3 flex gap-2">
                                                    <span className="inline-flex items-center gap-1.25 rounded-lg bg-[#e50914] px-2.75 py-1.25 text-xs font-bold text-white">
                                                        <Film size={15} />
                                                        Netflix
                                                    </span>
                                                    <span className="inline-flex items-center gap-1.25 rounded-lg bg-[#ff0033] px-2.75 py-1.25 text-xs font-bold text-white">
                                                        <Play size={15} />
                                                        YouTube
                                                    </span>
                                                </div>
                                                {/*
                                                 * Offline lejátszó kivezetve a főoldalról (2026-07-28):
                                                 * <span className="absolute top-3.5 right-3.5 z-3 inline-flex items-center gap-1.25 rounded-full bg-green-500/92 px-2.75 py-1.25 text-xs font-bold text-white">
                                                 *     <Download size={15} />
                                                 *     Offline
                                                 * </span>
                                                 */}
                                                <div
                                                    className="absolute inset-0"
                                                    style={{
                                                        background:
                                                            'radial-gradient(circle at 40% 40%,rgba(79,70,229,.34),rgba(11,11,18,.12))',
                                                    }}
                                                />

                                                {popupMode === 'word' && (
                                                    <div className="absolute inset-x-0 bottom-16 z-2 px-5.5 text-center">
                                                        <span className="ts-subtitle rounded-md bg-black/50 box-decoration-clone px-2.75 py-1.5 text-xl leading-[2] font-bold">
                                                            <span className="text-orange-500">
                                                                Something
                                                            </span>{' '}
                                                            <span className="text-green-400">
                                                                we
                                                            </span>{' '}
                                                            <span className="text-blue-400">
                                                                may
                                                            </span>{' '}
                                                            <span className="text-green-400">
                                                                not
                                                            </span>{' '}
                                                            <span className="text-green-400">
                                                                be
                                                            </span>{' '}
                                                            <span className="rounded-[3px] bg-orange-500/[0.18] px-0.5 text-orange-500 outline outline-offset-2 outline-orange-500">
                                                                able
                                                            </span>{' '}
                                                            <span className="text-blue-400">
                                                                to
                                                            </span>{' '}
                                                            <span className="text-white">
                                                                deter
                                                            </span>
                                                            .{' '}
                                                            <span className="text-red-400">
                                                                Before
                                                            </span>
                                                            …
                                                        </span>
                                                    </div>
                                                )}
                                                {popupMode === 'phrase' && (
                                                    <div className="absolute inset-x-0 bottom-16 z-2 px-5.5 text-center">
                                                        <span className="ts-subtitle rounded-md bg-black/50 box-decoration-clone px-2.75 py-1.5 text-xl leading-[2] font-bold">
                                                            <span className="text-orange-500">
                                                                Something
                                                            </span>{' '}
                                                            <span className="text-green-400">
                                                                we
                                                            </span>{' '}
                                                            <span className="text-blue-400">
                                                                may
                                                            </span>{' '}
                                                            <span className="rounded-[3px] bg-green-400/[0.16] px-0.5 text-green-400 outline outline-offset-2 outline-green-400">
                                                                not
                                                            </span>{' '}
                                                            <span className="rounded-[3px] bg-green-400/[0.16] px-0.5 text-green-400 outline outline-offset-2 outline-green-400">
                                                                be
                                                            </span>{' '}
                                                            <span className="rounded-[3px] bg-green-400/[0.16] px-0.5 text-orange-500 outline outline-offset-2 outline-green-400">
                                                                able
                                                            </span>{' '}
                                                            <span className="text-blue-400">
                                                                to
                                                            </span>{' '}
                                                            <span className="text-white">
                                                                deter
                                                            </span>
                                                            .{' '}
                                                            <span className="text-red-400">
                                                                Before
                                                            </span>
                                                            …
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="absolute inset-x-0 bottom-0 z-2 bg-gradient-to-t from-black/78 px-4 py-3.5">
                                                    <div className="flex items-center gap-2.5 text-white">
                                                        <Menu
                                                            size={20}
                                                            className="rotate-90"
                                                        />
                                                        <div className="h-1 flex-1 rounded-full bg-white/28">
                                                            <div className="h-full w-[38%] rounded-full bg-red-500" />
                                                        </div>
                                                        <span className="text-[11px] text-white/75">
                                                            12:04
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {popupMode === 'word' && (
                                                <div className="ts-wordpop absolute bottom-38 left-[57%] z-6 w-59 -translate-x-1/2 rounded-[14px] border border-neutral-200 bg-white p-4 shadow-[0_20px_46px_rgba(0,0,0,.28)] sm:bottom-30">
                                                    <div className="ts-wordpop-tail absolute -bottom-1.75 left-1/2 -ml-1.75 size-3.5 rotate-45 border-r border-b border-neutral-200 bg-white" />
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-baseline gap-1.75">
                                                            <span className="text-[17px] font-bold text-[#171717]">
                                                                able
                                                            </span>
                                                            <span className="text-[11px] text-[#a1a1a1] italic">
                                                                adj
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-semibold text-[#a1a1a1]">
                                                                #241
                                                            </span>
                                                            <X
                                                                size={16}
                                                                className="text-[#a1a1a1]"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-sm font-semibold text-[#171717]">
                                                        képes, tud valamit
                                                        megtenni
                                                    </div>
                                                    <div className="mt-0.75 text-xs text-[#737373]">
                                                        ≈ capable, competent
                                                    </div>
                                                    <div className="mt-2.5 border-l-2 border-indigo-200 pl-2.25">
                                                        <div className="text-xs text-[#404040] italic">
                                                            „She is able to
                                                            speak three
                                                            languages.”
                                                        </div>
                                                        <div className="text-xs text-[#a1a1a1]">
                                                            „Három nyelven tud
                                                            beszélni.”
                                                        </div>
                                                    </div>
                                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                        <span className="rounded-full bg-neutral-100 px-2.5 py-1.25 text-xs font-semibold text-neutral-600">
                                                            Tanulom
                                                        </span>
                                                        <span className="rounded-full bg-orange-100 px-2.5 py-1.25 text-xs font-bold text-orange-600">
                                                            Mentett
                                                        </span>
                                                        <span className="rounded-full bg-neutral-100 px-2.5 py-1.25 text-xs font-semibold text-neutral-600">
                                                            Tudom
                                                        </span>
                                                        <span className="rounded-full bg-neutral-100 px-2.5 py-1.25 text-xs font-semibold text-neutral-600">
                                                            Kiejtés
                                                        </span>
                                                        <span className="rounded-full bg-neutral-100 px-2.5 py-1.25 text-xs font-semibold text-neutral-600">
                                                            Gyakorlásra
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between">
                                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                                                            Megnyitás
                                                            <ArrowRight
                                                                size={15}
                                                            />
                                                        </span>
                                                        <div className="flex gap-1.5 text-[#a1a1a1]">
                                                            <Volume2
                                                                size={17}
                                                            />
                                                            <Sparkles
                                                                size={17}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {popupMode === 'phrase' && (
                                                <div className="ts-wordpop absolute bottom-38 left-[47%] z-7 w-60 -translate-x-1/2 rounded-[14px] border border-neutral-200 bg-white p-4 shadow-[0_20px_46px_rgba(0,0,0,.28)] sm:bottom-30">
                                                    <div className="ts-wordpop-tail absolute -bottom-1.75 left-1/2 -ml-1.75 size-3.5 rotate-45 border-r border-b border-neutral-200 bg-white" />
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-base font-bold text-[#171717]">
                                                            not be able
                                                        </span>
                                                        <X
                                                            size={16}
                                                            className="text-[#a1a1a1]"
                                                        />
                                                    </div>
                                                    <div className="mt-1.25 inline-flex items-center gap-1.25 rounded-full bg-green-50 px-2.25 py-0.75 text-[11px] font-semibold text-green-700">
                                                        <MousePointerClick
                                                            size={14}
                                                        />
                                                        3 szó kijelölve · shift
                                                        + kattintás
                                                    </div>
                                                    <div className="mt-2.5 text-[13px] leading-[1.5] text-[#737373]">
                                                        A kifejezés még nincs az
                                                        adatbázisban — vedd fel
                                                        egészben.
                                                    </div>
                                                    <div className="mt-3 flex flex-col gap-2.25 border-t border-neutral-100 pt-3">
                                                        <span className="inline-flex items-center gap-1.25 text-[13px] font-semibold text-indigo-700">
                                                            Saját kifejezésként
                                                            hozzáadom
                                                            <ArrowRight
                                                                size={15}
                                                            />
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-700">
                                                            <Sparkles
                                                                size={16}
                                                            />
                                                            AI-kitöltés —
                                                            közvetlen a webappba
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/*
                                         * Offline lejátszó kivezetve a főoldalról (2026-07-28):
                                         * <div className="mt-4 flex items-center justify-center gap-2">
                                         *     <LayoutGrid size={18} className="text-indigo-700" />
                                         *     <span className="text-[13px] font-medium text-[#525252]">
                                         *         Saját TopWords lejátszó — macOS &amp; Windows
                                         *     </span>
                                         * </div>
                                         */}
                                    </div>

                                    <div className="ts-textrow mt-7.5 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
                                        <div>
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white px-3 py-1.25 text-xs font-bold tracking-[.6px] text-indigo-700">
                                                FELIRATELEMZÉS
                                            </span>
                                            <h3 className="mt-3.5 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold tracking-[-.5px] text-[#171717]">
                                                Nézz YouTube-ot és Netflixet —{' '}
                                                <span className="text-indigo-700">
                                                    tanulj közben
                                                </span>
                                            </h3>
                                            <p className="mt-3 text-base leading-[1.65] text-[#525252]">
                                                Elemezd a feliratokat, és lásd
                                                élőben, hány szót értesz. Az
                                                ismeretlen szavak egy
                                                kattintással a tanulólistádba
                                                kerülnek.
                                            </p>
                                            <div className="mt-4.5 flex flex-wrap gap-2.5">
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-[#171717]">
                                                    <Play
                                                        size={17}
                                                        className="text-[#ff0033]"
                                                    />
                                                    YouTube
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-[#171717]">
                                                    <Film
                                                        size={17}
                                                        className="text-[#e50914]"
                                                    />
                                                    Netflix
                                                </span>
                                                {/*
                                                 * Offline lejátszó kivezetve a főoldalról (2026-07-28):
                                                 * <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3.5 py-2 text-[13px] font-semibold text-green-700">
                                                 *     <Download size={17} />
                                                 *     Offline lejátszó
                                                 * </span>
                                                 */}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2.75">
                                            {[
                                                'YouTube- és Netflix-feliratok elemzése egy kattintással',
                                                'Szavak kiemelése lejátszás közben — Tudom · Tanulom · Ismeretlen',
                                                'Az ismeretlen szavak egy kattintással a listádba kerülnek',
                                            ].map((t) => (
                                                <div
                                                    key={t}
                                                    className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-[#404040]"
                                                >
                                                    <CheckCircle2
                                                        size={20}
                                                        className="flex-none text-green-500"
                                                    />
                                                    {t}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Reveal>

                                <div className="mt-11 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                                    {ANALYZE_BULLETS.map((b) => (
                                        <Reveal
                                            key={b.title}
                                            className="rounded-[14px] border border-neutral-200 bg-[#fafafa] p-5 transition-all duration-250 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(0,0,0,.12)]"
                                        >
                                            <span className="grid size-10.5 place-items-center rounded-[11px] bg-indigo-100 text-indigo-700">
                                                <b.icon size={23} />
                                            </span>
                                            <div className="mt-3 text-[15px] font-semibold text-[#171717]">
                                                {b.title}
                                            </div>
                                            <div className="mt-1.25 text-[13px] leading-[1.5] text-[#737373]">
                                                {b.desc}
                                            </div>
                                        </Reveal>
                                    ))}
                                </div>

                                <Reveal className="mt-6 rounded-3xl bg-[#171717] p-7.5 shadow-[0_24px_60px_rgba(0,0,0,.24)]">
                                    <div className="flex flex-wrap gap-2">
                                        <span className="rounded-lg bg-indigo-700 px-3.5 py-1.75 text-xs font-semibold text-white">
                                            Szöveg
                                        </span>
                                        <span className="rounded-lg bg-neutral-800 px-3.5 py-1.75 text-xs font-semibold text-neutral-400">
                                            URL
                                        </span>
                                        <span className="inline-flex items-center gap-1.25 rounded-lg bg-[#ff0033] px-3.5 py-1.75 text-xs font-bold text-white">
                                            <Play size={15} />
                                            YouTube
                                        </span>
                                        <span className="inline-flex items-center gap-1.25 rounded-lg bg-[#e50914] px-3.5 py-1.75 text-xs font-bold text-white">
                                            <Film size={15} />
                                            Netflix
                                        </span>
                                        <span className="rounded-lg bg-neutral-800 px-3.5 py-1.75 text-xs font-semibold text-neutral-400">
                                            Könyv
                                        </span>
                                    </div>
                                    <p className="mt-4.5 text-base leading-[1.85] text-neutral-300">
                                        The space{' '}
                                        <span className="rounded bg-green-500 px-1 py-0.25 text-green-950">
                                            between
                                        </span>{' '}
                                        two{' '}
                                        <span className="rounded bg-blue-500 px-1 py-0.25 text-white">
                                            cities
                                        </span>{' '}
                                        lies a{' '}
                                        <span className="rounded bg-red-500 px-1 py-0.25 text-white">
                                            valley
                                        </span>{' '}
                                        known for its{' '}
                                        <span className="rounded bg-green-500 px-1 py-0.25 text-green-950">
                                            remarkable
                                        </span>{' '}
                                        landscape and{' '}
                                        <span className="rounded bg-blue-500 px-1 py-0.25 text-white">
                                            resilient
                                        </span>{' '}
                                        wildlife.
                                    </p>
                                    <div className="mt-5 flex items-center gap-4.5 border-t border-neutral-800 pt-4.5">
                                        <div className="flex-1">
                                            <div className="mb-2 flex justify-between text-[13px] text-neutral-400">
                                                <span>Érthetőség</span>
                                                <span className="font-semibold text-green-400">
                                                    87%
                                                </span>
                                            </div>
                                            <div className="h-2.5 overflow-hidden rounded-full bg-neutral-800">
                                                <div
                                                    ref={bar2Ref}
                                                    className="h-full w-[87%] origin-left [transform:scaleX(0)] rounded-full bg-gradient-to-r from-green-400 to-green-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex gap-4 text-xs text-neutral-400">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="size-2.5 rounded-[3px] bg-green-500" />
                                            Tudom
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="size-2.5 rounded-[3px] bg-blue-500" />
                                            Tanulom
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="size-2.5 rounded-[3px] bg-red-500" />
                                            Ismeretlen
                                        </span>
                                    </div>
                                </Reveal>
                            </div>
                        </section>

                        {/* SZÓLISTA */}
                        <section
                            id="szolista"
                            className="px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#f7f4ff 0%,#f5f3ff 50%,#eef2ff 100%)',
                            }}
                        >
                            <Reveal className="mx-auto mb-12 max-w-[680px] text-center">
                                <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                    SZÓLISTA
                                </span>
                                <h2 className="mt-4.5 text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                    Kövesd nyomon a szókincsed fejlődését
                                </h2>
                                <p className="mx-auto mt-4 text-[17px] leading-[1.6] text-[#737373]">
                                    Minden szóhoz jelölheted, hol tartasz — a
                                    rendszer összeszámolja a haladásodat.
                                    Próbáld ki: kattints egy szóra, majd állítsd
                                    a státuszát.
                                </p>
                            </Reveal>

                            <div className="mx-auto grid max-w-[1080px] grid-cols-[1.1fr_1fr] items-start gap-6 max-lg:grid-cols-1">
                                {/* list */}
                                <Reveal className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                                    <div className="flex items-center justify-between px-5 pt-4.5 pb-3.5">
                                        <div className="flex items-center gap-2 font-semibold text-[#171717]">
                                            <List
                                                size={20}
                                                className="text-indigo-700"
                                            />
                                            Szólista
                                        </div>
                                        <span className="rounded-full bg-green-50 px-3 py-1.25 text-[13px] font-semibold text-green-700">
                                            {knownCount} / {words.length} tudom
                                        </span>
                                    </div>
                                    <div className="flex gap-2 border-b border-neutral-100 px-5 pb-3.5">
                                        {filterTabs.map((t) => (
                                            <button
                                                key={t.label}
                                                onClick={() =>
                                                    setFilter(t.label)
                                                }
                                                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.75 font-sans text-[13px] font-semibold transition-all"
                                                style={{
                                                    border: `1px solid ${filter === t.label ? '#4338ca' : '#e5e5e5'}`,
                                                    background:
                                                        filter === t.label
                                                            ? '#4338ca'
                                                            : '#fff',
                                                    color:
                                                        filter === t.label
                                                            ? '#fff'
                                                            : '#525252',
                                                }}
                                            >
                                                {t.label}
                                                <span className="opacity-70">
                                                    {t.count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-[420px] overflow-auto">
                                        {visibleWords.map((w) => {
                                            const th = w.status
                                                ? STATUS_META[w.status]
                                                : null;
                                            const selected = selWord === w.i;

                                            return (
                                                <div
                                                    key={w.word}
                                                    onClick={() =>
                                                        setSelWord(w.i)
                                                    }
                                                    className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 transition-colors"
                                                    style={{
                                                        borderLeft: `3px solid ${selected ? '#4338ca' : th ? th.color : 'transparent'}`,
                                                        background: selected
                                                            ? '#eef2ff'
                                                            : th
                                                              ? th.tint
                                                              : '#fff',
                                                    }}
                                                >
                                                    <span
                                                        className="size-2.25 flex-none rounded-full"
                                                        style={
                                                            th
                                                                ? {
                                                                      background:
                                                                          th.color,
                                                                  }
                                                                : {
                                                                      border: '1.5px solid #d4d4d4',
                                                                  }
                                                        }
                                                    />
                                                    <span
                                                        className="text-base font-semibold transition-colors"
                                                        style={{
                                                            color: th
                                                                ? th.color
                                                                : '#171717',
                                                        }}
                                                    >
                                                        {w.word}
                                                    </span>
                                                    <span className="text-[11px] text-[#a1a1a1] italic">
                                                        {w.pos}
                                                    </span>
                                                    <span className="flex-1" />
                                                    <span className="text-[13px] text-[#a1a1a1]">
                                                        {w.hu}
                                                    </span>
                                                    <ArrowRight
                                                        size={18}
                                                        className="text-neutral-300"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Reveal>

                                {/* detail */}
                                <Reveal className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                                    <div className="border-b border-neutral-100 bg-[#f7f7fb] p-5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xs font-bold text-[#a1a1a1]">
                                                    #{sel.num}
                                                </span>
                                                <span className="rounded-full bg-indigo-100 px-2.5 py-0.75 text-[11px] font-semibold text-indigo-700">
                                                    {sel.pos}
                                                </span>
                                            </div>
                                            <span className="grid size-8.5 place-items-center rounded-full border-[1.5px] border-indigo-700 text-indigo-700">
                                                <Volume2 size={19} />
                                            </span>
                                        </div>
                                        <div className="mt-2 text-[26px] font-bold tracking-[-.4px] text-[#171717]">
                                            {sel.word}
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-4.5 p-5">
                                        <div>
                                            <div className="text-[11px] font-bold tracking-[.8px] text-[#a1a1a1]">
                                                MAGYAR JELENTÉS
                                            </div>
                                            <div className="mt-2 rounded-xl border border-neutral-200 px-4 py-3.5 text-[19px] font-semibold text-[#171717]">
                                                {sel.hu}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold tracking-[.8px] text-[#a1a1a1]">
                                                SZINONIMÁK
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {sel.syn.map((s) => (
                                                    <span
                                                        key={s}
                                                        className="rounded-full border border-neutral-200 bg-[#fafafa] px-3.5 py-1.75 text-[13px] text-[#404040]"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div
                                            className="rounded-xl bg-[#f7f7fb] p-4"
                                            style={{
                                                borderLeft: `3px solid ${selMeta ? selMeta.color : '#4338ca'}`,
                                            }}
                                        >
                                            <div className="text-[11px] font-bold tracking-[.8px] text-[#a1a1a1]">
                                                PÉLDAMONDAT
                                            </div>
                                            <div className="mt-2 text-[15px] font-medium text-[#171717] italic">
                                                „{sel.ex.en}”
                                            </div>
                                            <div className="mt-1.5 text-sm text-[#737373]">
                                                {sel.ex.hu}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {detailButtons.map((key) => {
                                                const m = STATUS_META[key];
                                                const active =
                                                    sel.status === key;
                                                const full =
                                                    key === 'Gyakorlásra';

                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() =>
                                                            setWord(
                                                                selWord,
                                                                key,
                                                            )
                                                        }
                                                        className="flex items-center justify-center gap-1.5 rounded-[11px] px-2.5 py-2.75 font-sans text-[13px] font-semibold transition-all"
                                                        style={{
                                                            flex: full
                                                                ? '1 1 100%'
                                                                : '1 1 40%',
                                                            background: active
                                                                ? m.bg
                                                                : '#f4f4f5',
                                                            color: active
                                                                ? m.color
                                                                : '#71717a',
                                                            border: `1px solid ${active ? `${m.color}55` : 'transparent'}`,
                                                        }}
                                                    >
                                                        <m.icon size={17} />
                                                        {key}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold tracking-[.8px] text-[#a1a1a1]">
                                                FONTOSSÁG
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                {[1, 2, 3, 4, 5].map((n) => (
                                                    <Star
                                                        key={n}
                                                        size={26}
                                                        className={
                                                            n <= sel.imp
                                                                ? 'fill-amber-500 text-amber-500'
                                                                : 'text-neutral-200'
                                                        }
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <button className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-indigo-200 py-3.25 font-sans text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50">
                                            <Sparkles size={18} />
                                            Szó infók (AI)
                                        </button>
                                    </div>
                                </Reveal>
                            </div>
                        </section>

                        {/* FLASHCARD SRS */}
                        <section id="flashcard" className="bg-white px-5 py-24">
                            <Reveal className="mx-auto mb-14 max-w-[760px] text-center">
                                <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                    FLASHCARD SRS
                                </span>
                                <h2 className="mt-4.5 text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                    Intelligens ismétlési rendszer
                                </h2>
                                <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.6] text-[#737373]">
                                    Minden értékelés után kiszámolja, mikor kell
                                    visszamutatnia a kártyát — ha könnyen ment,
                                    tovább vár; ha nehéz volt, hamarabb
                                    visszahozza.
                                </p>
                            </Reveal>

                            <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-10">
                                <Reveal className="rounded-3xl border border-neutral-200 p-6 shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.25 font-semibold text-[#171717]">
                                            <Layers
                                                size={20}
                                                className="text-indigo-700"
                                            />
                                            Angol alapszavak
                                        </div>
                                        <span className="rounded-full bg-indigo-50 px-3 py-1.25 text-[13px] font-semibold text-indigo-700">
                                            {deckIndex + 1} / {DEMO_DECK.length}
                                        </span>
                                    </div>
                                    <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-indigo-50">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-800 transition-all duration-500"
                                            style={{
                                                width: `${((deckIndex + 1) / DEMO_DECK.length) * 100}%`,
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setFlipped2((v) => !v)}
                                        className="mt-4.5 h-59 w-full cursor-pointer"
                                        style={{ perspective: 1200 }}
                                    >
                                        <div
                                            className="relative size-full transition-transform duration-600 ease-[cubic-bezier(.4,.2,.2,1)]"
                                            style={{
                                                transformStyle: 'preserve-3d',
                                                transform: flipped2
                                                    ? 'rotateY(180deg)'
                                                    : 'rotateY(0deg)',
                                            }}
                                        >
                                            <div
                                                className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[18px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100"
                                                style={{
                                                    backfaceVisibility:
                                                        'hidden',
                                                }}
                                            >
                                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                                                    {demoCard.rank}
                                                </span>
                                                <span className="text-[46px] font-bold tracking-tight text-[#171717]">
                                                    {demoCard.word}
                                                </span>
                                                <span className="inline-flex items-center gap-1.25 text-xs text-indigo-500">
                                                    <MousePointerClick
                                                        size={15}
                                                    />
                                                    Kattints a megfordításhoz
                                                </span>
                                            </div>
                                            <div
                                                className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 rounded-[18px] bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]"
                                                style={{
                                                    backfaceVisibility:
                                                        'hidden',
                                                    transform:
                                                        'rotateY(180deg)',
                                                }}
                                            >
                                                <span className="text-[42px] font-bold tracking-tight text-white">
                                                    {demoCard.translation}
                                                </span>
                                                <span className="text-sm leading-[1.55] text-indigo-100">
                                                    „{demoCard.example}”
                                                </span>
                                                <span className="text-sm text-indigo-200">
                                                    {demoCard.exampleHu}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                    <div className="mt-3 text-center text-xs text-[#a1a1a1]">
                                        {flipped2
                                            ? 'Hogy ment? Értékeld — az algoritmus ütemezi a következő ismétlést.'
                                            : 'Fordítsd meg a kártyát, majd értékeld, mennyire ment könnyen.'}
                                    </div>
                                    <div className="mt-3 grid grid-cols-4 gap-2.5">
                                        {RATE_DEFS.map((r) => (
                                            <button
                                                key={r.label}
                                                onClick={rateCard}
                                                disabled={!flipped2}
                                                className="flex flex-col items-center gap-0.5 rounded-xl py-3 transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
                                                style={{
                                                    border: `1px solid ${r.c}3d`,
                                                    background: `${r.c}14`,
                                                    color: r.c,
                                                }}
                                            >
                                                <span className="text-sm font-bold">
                                                    {r.label}
                                                </span>
                                                <span className="text-[11px] opacity-80">
                                                    {r.time}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </Reveal>
                                <Reveal className="flex flex-col gap-3.5">
                                    {SRS_EXPLAIN.map((e) => (
                                        <div
                                            key={e.label}
                                            className="flex items-start gap-3.5 rounded-[14px] border border-neutral-200 bg-[#fafafa] p-4"
                                        >
                                            <span
                                                className="inline-flex min-w-9 flex-none items-center justify-center rounded-[9px] px-2.25 py-2 text-xs font-semibold whitespace-nowrap text-white"
                                                style={{ background: e.bg }}
                                            >
                                                {e.label}
                                            </span>
                                            <p className="text-sm leading-[1.55] text-[#404040]">
                                                {e.desc}
                                            </p>
                                        </div>
                                    ))}
                                </Reveal>
                            </div>

                            <div className="mx-auto mt-10 grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
                                {FLASH_CAPS.map((c) => (
                                    <Reveal
                                        key={c.title}
                                        className="flex items-start gap-2.75 rounded-xl border border-indigo-100 bg-indigo-50 p-4"
                                    >
                                        <c.icon
                                            size={20}
                                            className="flex-none text-indigo-600"
                                        />
                                        <div>
                                            <div className="text-sm font-semibold text-[#171717]">
                                                {c.title}
                                            </div>
                                            <div className="mt-0.75 text-xs leading-[1.5] text-[#737373]">
                                                {c.desc}
                                            </div>
                                        </div>
                                    </Reveal>
                                ))}
                            </div>
                        </section>

                        {/*
                         * GYAKORLÁSI MÓDOK — KIVEZETVE (2026-07-28)
                         *
                         * A szekció kvízt, mondatkiegészítést (cloze), AI-alapú szabad írást és
                         * rendhagyó igéket hirdetett — mind a négy funkció ki van vezetve, a
                         * route-jaik a routes/words.php-ban ki vannak kommentelve. A landing
                         * tehát olyat kínált, ami a regisztráció után nem érhető el.
                         *
                         * Kikommentelve és nem törölve, mert a funkciók visszahozása tervben van;
                         * a szekció akkor a route-okkal együtt visszakapcsolható. A hozzá tartozó
                         * PRACTICE_MODES tömb és a 'gyakorlas' nav-bejegyzés ugyanígy kikommentelve.
                         */}
                        {/*
                        <section
                            id="gyakorlas"
                            className="px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#eef2ff 0%,#e9e5ff 50%,#f5f3ff 100%)',
                            }}
                        >
                            <div className="mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-center gap-12">
                                <Reveal>
                                    <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                        GYAKORLÁSI MÓDOK
                                    </span>
                                    <h2 className="mt-4.5 text-[clamp(28px,3.6vw,42px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                        Több módszer ugyanahhoz
                                        <br />a szókincshez
                                    </h2>
                                    <p className="mt-4 mb-5.5 text-base leading-[1.65] text-[#737373]">
                                        Ugyanazokat a szavakat többféleképp
                                        gyakorolhatod — a rendszer a
                                        szólistádból automatikusan generálja a
                                        feladatokat. Próbáld ki a kvízt jobbra.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {PRACTICE_MODES.map((m) => (
                                            <Reveal
                                                key={m.title}
                                                className="rounded-[14px] border border-neutral-200 bg-white p-4.5 shadow-[0_6px_18px_rgba(0,0,0,.04)] transition-all duration-250 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(0,0,0,.12)]"
                                            >
                                                <span className="grid size-10.5 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
                                                    <m.icon size={23} />
                                                </span>
                                                <div className="mt-3 text-[15px] font-semibold text-[#171717]">
                                                    {m.title}
                                                </div>
                                                <div className="mt-1.25 text-xs leading-[1.5] text-[#737373]">
                                                    {m.desc}
                                                </div>
                                            </Reveal>
                                        ))}
                                    </div>
                                </Reveal>
                                <Reveal className="flex flex-col gap-4.5">
                                    <div className="rounded-[20px] border border-neutral-200 bg-white p-6.5 shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                                        <div className="flex items-center justify-between">
                                            <span className="rounded-full bg-indigo-100 px-2.75 py-1.25 text-xs font-semibold text-indigo-700">
                                                Kvíz · #178 · Top 1 000
                                            </span>
                                            <span className="text-[13px] text-[#a1a1a1]">
                                                Próbáld ki
                                            </span>
                                        </div>
                                        <h3 className="mt-4.5 mb-1 text-base font-medium text-[#737373]">
                                            Mi a magyar jelentése ennek:{' '}
                                            <b className="text-[#171717]">
                                                between
                                            </b>
                                            ?
                                        </h3>
                                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                                            {quizOptions.map((o) => {
                                                const picked = quizPick === o.l;
                                                let bg = '#fff';
                                                let bd = '#e5e5e5';
                                                let col = '#404040';
                                                let Mark: React.ComponentType<{
                                                    size?: number;
                                                }> | null = null;

                                                if (answered) {
                                                    if (o.correct) {
                                                        bg = '#f0fdf4';
                                                        bd = '#86efac';
                                                        col = '#15803d';
                                                        Mark = Check;
                                                    } else if (picked) {
                                                        bg = '#fef2f2';
                                                        bd = '#fca5a5';
                                                        col = '#b91c1c';
                                                        Mark = X;
                                                    }
                                                }

                                                return (
                                                    <button
                                                        key={o.l}
                                                        onClick={() =>
                                                            setQuizPick(o.l)
                                                        }
                                                        className="flex items-center justify-between rounded-xl px-4 py-3.25 font-sans text-[15px] font-semibold transition-all"
                                                        style={{
                                                            background: bg,
                                                            border: `1px solid ${bd}`,
                                                            color: col,
                                                        }}
                                                    >
                                                        <span>{o.l}</span>
                                                        {Mark && (
                                                            <Mark size={18} />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div
                                            className="mt-3.5 min-h-5 text-sm font-semibold"
                                            style={{
                                                color: !answered
                                                    ? 'transparent'
                                                    : correct
                                                      ? '#15803d'
                                                      : '#b91c1c',
                                            }}
                                        >
                                            {answered
                                                ? correct
                                                    ? 'Helyes! A „between” jelentése: között.'
                                                    : 'Nem talált — a helyes válasz: között.'
                                                : ''}
                                        </div>
                                    </div>
                                    <div className="rounded-[20px] border border-neutral-200 bg-white p-6.5 shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                                        <span className="inline-block rounded-full bg-indigo-100 px-2.75 py-1.25 text-xs font-semibold text-indigo-700">
                                            Mondatkiegészítés
                                        </span>
                                        <p className="mt-4 text-base leading-[1.8] text-[#404040]">
                                            The space{' '}
                                            <span className="inline-block min-w-24 border-b-2 border-dashed border-indigo-600 text-center font-semibold text-indigo-600">
                                                between
                                            </span>{' '}
                                            two cities lies a valley known for
                                            its remarkable landscape.
                                        </p>
                                        <div className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] text-[#a1a1a1]">
                                            <CheckCircle2
                                                size={17}
                                                className="text-green-500"
                                            />
                                            Írd be a hiányzó szót (cloze).
                                        </div>
                                    </div>
                                </Reveal>
                            </div>
                        </section>
                        */}

                        {/* AI */}
                        <section
                            id="ai"
                            className="px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#f9f5ff 0%,#f5f3ff 50%,#ede9fe 100%)',
                            }}
                        >
                            <Reveal className="mx-auto mb-14 max-w-[760px] text-center">
                                <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                    AI-SEGÍTSÉG
                                </span>
                                <h2 className="mt-4.5 text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                    Az AI végzi a nehezét helyetted
                                </h2>
                                <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.6] text-[#737373]">
                                    Nem kell szótárazni és példamondatokat
                                    keresgélni — beépített AI segít a tanulás
                                    minden lépésénél.
                                </p>
                            </Reveal>
                            <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
                                {AI_CARDS.map((a) => (
                                    <Reveal
                                        key={a.title}
                                        className="rounded-[18px] border border-neutral-200 bg-white p-6.5 shadow-[0_12px_34px_rgba(0,0,0,.05)] transition-all duration-250 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_rgba(0,0,0,.12)]"
                                    >
                                        <div className="grid size-13 place-items-center rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
                                            <a.icon size={26} />
                                        </div>
                                        <h3 className="mt-4.5 text-[19px] font-semibold tracking-[-.3px] text-[#171717]">
                                            {a.title}
                                        </h3>
                                        <p className="mt-2.5 text-sm leading-[1.6] text-[#737373]">
                                            {a.desc}
                                        </p>
                                    </Reveal>
                                ))}
                            </div>
                            <Reveal
                                as="p"
                                className="mx-auto mt-8 text-center text-sm text-[#a1a1a1]"
                            >
                                Az ingyenes csomagban is kipróbálható; a teljes
                                AI-eszköztár Pro-val korlátlan.
                            </Reveal>
                        </section>

                        {/* CHROME EXTENSION */}
                        <section
                            id="bovitmeny"
                            className="relative overflow-hidden px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#20276B 0%,#3a3688 22%,#6548AC 46%,#5566c4 66%,#4F8EEC 90%,#4F8EEC 100%)',
                            }}
                        >
                            <div
                                className="pointer-events-none absolute -top-25 -right-20 size-[420px] rounded-full blur-[20px]"
                                style={{
                                    background:
                                        'radial-gradient(circle,rgba(79,70,229,.4),transparent 65%)',
                                }}
                            />
                            <div className="relative mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-center gap-14">
                                <Reveal>
                                    <span className="inline-block rounded-full bg-white/10 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-200">
                                        CHROME EXTENSION
                                    </span>
                                    <h2 className="mt-4.5 text-[clamp(28px,3.6vw,42px)] leading-[1.1] font-bold tracking-[-1px] text-white">
                                        Tanuld a szavakat ott,
                                        <br />
                                        ahol találkozol velük
                                    </h2>
                                    <p className="mt-4 text-base leading-[1.65] text-white/70">
                                        Híroldalon, YouTube-on, Redditen —
                                        keress rá az ismeretlen szavakra
                                        anélkül, hogy elhagynád az oldalt. A
                                        popupban azonnal ott a jelentés és a
                                        státusz.
                                    </p>
                                    <div className="mt-6 grid gap-3">
                                        {EXT_USAGE.map((u) => (
                                            <div
                                                key={u.title}
                                                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3.5"
                                            >
                                                <span className="grid size-8.5 flex-none place-items-center rounded-[9px] bg-indigo-500/30 text-indigo-200">
                                                    <u.icon size={19} />
                                                </span>
                                                <div>
                                                    <div className="text-sm font-semibold text-white">
                                                        {u.title}
                                                    </div>
                                                    <div className="mt-0.5 text-[13px] leading-[1.5] text-white/62">
                                                        {u.desc}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Reveal>
                                <Reveal>
                                    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_70px_rgba(0,0,0,.4)]">
                                        <div className="flex items-center gap-2.5 border-b border-neutral-200 bg-[#f5f5f5] px-3.5 py-3">
                                            <span className="size-2.75 rounded-full bg-red-500" />
                                            <span className="size-2.75 rounded-full bg-amber-500" />
                                            <span className="size-2.75 rounded-full bg-green-500" />
                                            <span className="ml-2 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.25 text-xs text-[#737373]">
                                                en.wikipedia.org
                                            </span>
                                        </div>
                                        <div className="relative p-5.5">
                                            <p className="text-[15px] leading-[1.8] text-[#404040]">
                                                The space{' '}
                                                <span className="rounded-[3px] border-b-2 border-indigo-600 bg-indigo-100 px-0.5 py-0.25 font-semibold text-indigo-700">
                                                    between
                                                </span>{' '}
                                                two cities lies a valley known
                                                for its remarkable landscape and
                                                resilient wildlife.
                                            </p>
                                            <div className="mt-4 w-62.5 overflow-hidden rounded-[14px] border border-neutral-200 bg-white shadow-[0_16px_40px_rgba(0,0,0,.16)]">
                                                <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50 px-4 py-3.5">
                                                    <div>
                                                        <div className="text-[18px] font-bold text-[#171717]">
                                                            between
                                                        </div>
                                                        <div className="text-xs text-indigo-600">
                                                            prep · #178
                                                        </div>
                                                    </div>
                                                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                                        Tanulom
                                                    </span>
                                                </div>
                                                <div className="p-4">
                                                    <div className="text-[15px] font-semibold text-[#171717]">
                                                        között, -ek között
                                                    </div>
                                                    <div className="mt-1 text-[13px] text-[#737373]">
                                                        in the middle of
                                                    </div>
                                                    <div className="mt-3.5 flex gap-2">
                                                        <button className="flex-1 rounded-[9px] bg-indigo-700 py-2.25 font-sans text-[13px] font-semibold text-white">
                                                            Tudom
                                                        </button>
                                                        <button className="flex flex-1 items-center justify-center gap-1.25 rounded-[9px] border border-neutral-200 bg-white py-2.25 font-sans text-[13px] font-semibold text-[#404040]">
                                                            <Volume2
                                                                size={16}
                                                            />
                                                            Kiejtés
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {/*
                                     * A LETÖLTŐ BLOKK KIVEZETVE (2026-07-29). Korábban a
                                     * fejlesztői módú telepítés 5 lépését és a .zip letöltő
                                     * gombját mutatta (bejelentkezve), illetve egy „Jelentkezz
                                     * be a letöltéshez" linket vendégként. A letöltés azóta
                                     * `can:admin` mögött van (routes/web.php), mert a bővítmény
                                     * a Chrome Web Store-ból fog települni — a helyére a lenti
                                     * „hamarosan" doboz került. Visszakapcsoláskor az
                                     * INSTALL_STEPS konstans és a Download / login import is kell.
                                     */}
                                    <div className="mt-5.5 rounded-2xl border border-white/10 bg-white/[0.06] p-5.5">
                                        <div className="mb-2 text-sm font-semibold text-white">
                                            Hogyan telepítsd?
                                        </div>
                                        {extensionStoreUrl ? (
                                            <>
                                                <p className="text-sm leading-[1.6] text-white/70">
                                                    A Chrome Web Store-ból
                                                    egyetlen kattintással
                                                    telepíthető, és
                                                    automatikusan frissül.
                                                </p>
                                                <a
                                                    href={extensionStoreUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4.5 py-2.75 text-sm font-bold text-indigo-800 shadow-md transition-all hover:-translate-y-0.5"
                                                >
                                                    <Chrome size={20} />
                                                    Telepítés a Chrome Web
                                                    Store-ból
                                                </a>
                                            </>
                                        ) : (
                                            <p className="text-sm leading-[1.6] text-white/70">
                                                A bővítmény hamarosan elérhető
                                                lesz a Chrome Web Store-ban —
                                                onnan egyetlen kattintással
                                                telepíthető, és automatikusan
                                                frissül. A megjelenésig az app
                                                többi funkciója bővítmény nélkül
                                                is teljes értékű.
                                            </p>
                                        )}
                                    </div>
                                </Reveal>
                            </div>
                        </section>

                        {/* ÁRAZÁS */}
                        <section
                            id="arazas"
                            className="px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#eef2ff 0%,#e9dff6 50%,#f5f3ff 100%)',
                            }}
                        >
                            <Reveal className="mx-auto mb-14 max-w-[760px] text-center">
                                <span className="inline-block rounded-full bg-indigo-100 px-3.75 py-1.5 text-xs font-bold tracking-[1.2px] text-indigo-700">
                                    ÁRAZÁS
                                </span>
                                <h2 className="mt-4.5 text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                    Válaszd ki a hozzád illő csomagot
                                </h2>
                                <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.6] text-[#737373]">
                                    Kezdd ingyen — kóstolj bele mindenbe, az
                                    AI-ba is —, és ha megtetszett, válts Próra a
                                    korlátlan használatért.
                                </p>
                            </Reveal>
                            <div className="mx-auto grid max-w-[820px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-stretch gap-6">
                                <Reveal className="flex flex-col rounded-[22px] border border-neutral-200 bg-white p-8 shadow-[0_18px_44px_rgba(49,46,129,.12)]">
                                    <span className="text-sm font-semibold text-[#737373]">
                                        Ingyenes
                                    </span>
                                    <div className="mt-3.5 mb-1 flex items-baseline gap-1.5">
                                        <span className="text-[44px] font-bold tracking-tight text-[#171717]">
                                            0 Ft
                                        </span>
                                        <span className="text-sm text-[#a1a1a1]">
                                            örökké
                                        </span>
                                    </div>
                                    <p className="mb-5 text-sm leading-[1.6] text-[#737373]">
                                        Szólista, flashcard, szövegelemző, a
                                        Chrome-bővítmény és egy kis AI-kóstoló.
                                    </p>
                                    <div className="flex flex-1 flex-col gap-2.75">
                                        {FREE_PLAN.map((t) => (
                                            <div
                                                key={t}
                                                className="flex items-center gap-2.5 text-sm text-[#404040]"
                                            >
                                                <Check
                                                    size={19}
                                                    className="text-green-500"
                                                />
                                                {t}
                                            </div>
                                        ))}
                                    </div>
                                    {canRegister && !auth.user && (
                                        <Link
                                            href={register()}
                                            className="mt-6 w-full rounded-xl border border-neutral-300 py-3.5 text-center font-sans text-[15px] font-semibold text-[#171717] transition-colors hover:bg-indigo-50"
                                        >
                                            Kezdés ingyen
                                        </Link>
                                    )}
                                </Reveal>
                                <Reveal
                                    className="relative flex flex-col rounded-[22px] p-8 shadow-[0_26px_60px_rgba(32,39,107,.4)]"
                                    style={{
                                        background:
                                            'linear-gradient(160deg,#20276B,#3a3688)',
                                    }}
                                >
                                    <span className="text-sm font-semibold text-indigo-200">
                                        Pro
                                    </span>
                                    <div className="mt-3.5 mb-1 flex items-baseline gap-1.5">
                                        <span className="text-[44px] font-bold tracking-tight text-white">
                                            1 990 Ft
                                        </span>
                                        <span className="text-sm text-white/60">
                                            / hó
                                        </span>
                                    </div>
                                    <p className="mb-5 text-sm leading-[1.6] text-white/72">
                                        Korlátlan használat, a teljes
                                        AI-eszköztár és a legnagyobb keretek.
                                    </p>
                                    <div className="flex flex-1 flex-col gap-2.75">
                                        {PRO_PLAN.map((t) => (
                                            <div
                                                key={t}
                                                className="flex items-center gap-2.5 text-sm text-indigo-100"
                                            >
                                                <Check
                                                    size={19}
                                                    className="text-indigo-300"
                                                />
                                                {t}
                                            </div>
                                        ))}
                                    </div>
                                    {billingEnabled && (
                                        <Link
                                            href={pricingRoute()}
                                            className="mt-6 w-full rounded-xl bg-gradient-to-br from-green-400 to-green-500 py-3.5 text-center font-sans text-[15px] font-bold text-green-950 shadow-[0_8px_22px_rgba(34,197,94,.28)] transition-transform hover:-translate-y-0.5"
                                        >
                                            Váltás Pro-ra
                                        </Link>
                                    )}
                                </Reveal>
                            </div>
                            <p className="mx-auto mt-6 text-center text-[13px] text-[#6b6b76]">
                                Az előfizetés bármikor lemondható.
                            </p>
                        </section>

                        {/* CTA */}
                        <section className="bg-white px-5 pt-10 pb-25">
                            <Reveal
                                className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[32px] px-10 py-18 text-center"
                                style={{
                                    background:
                                        'linear-gradient(135deg,#20276B,#3a3688)',
                                }}
                            >
                                <div
                                    className="pointer-events-none absolute -top-30 -left-15 size-90 rounded-full blur-[10px]"
                                    style={{
                                        background:
                                            'radial-gradient(circle,rgba(79,70,229,.4),transparent 65%)',
                                    }}
                                />
                                <div
                                    className="pointer-events-none absolute -right-10 -bottom-35 size-90 rounded-full blur-[10px]"
                                    style={{
                                        background:
                                            'radial-gradient(circle,rgba(79,70,229,.35),transparent 65%)',
                                    }}
                                />
                                <h2 className="relative text-[clamp(30px,4.4vw,48px)] leading-[1.08] font-bold tracking-[-1px] text-white">
                                    Készen állsz elkezdeni?
                                </h2>
                                <p className="relative mx-auto mt-4.5 max-w-[560px] text-[17px] leading-[1.6] text-white/78">
                                    Szólista, flashcard SRS, gyakorlási módok,
                                    AI-segítség, szövegelemző és
                                    Chrome-bővítmény — egy helyen, magyarul.
                                </p>
                                <div className="relative mt-8 flex flex-wrap justify-center gap-3.5">
                                    {auth.user ? (
                                        <Link
                                            href={dashboard()}
                                            className="inline-flex items-center gap-2.5 rounded-full bg-white px-7.5 py-3.75 font-sans text-[15px] font-bold text-indigo-950 shadow-[0_12px_30px_rgba(0,0,0,.25)] transition-transform hover:-translate-y-0.5"
                                        >
                                            Irány az alkalmazás
                                            <ArrowRight size={20} />
                                        </Link>
                                    ) : (
                                        <>
                                            {canRegister && (
                                                <Link
                                                    href={register()}
                                                    className="inline-flex items-center gap-2.5 rounded-full bg-white px-7.5 py-3.75 font-sans text-[15px] font-bold text-indigo-950 shadow-[0_12px_30px_rgba(0,0,0,.25)] transition-transform hover:-translate-y-0.5"
                                                >
                                                    Regisztrálás
                                                    <ArrowRight size={20} />
                                                </Link>
                                            )}
                                            <Link
                                                href={login()}
                                                className="rounded-full border border-white/25 bg-white/10 px-7 py-3.75 font-sans text-[15px] font-medium text-white transition-colors hover:bg-white/[0.18]"
                                            >
                                                Már van fiókom
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </Reveal>
                        </section>
                    </main>
                </div>

                <PublicFooter />
            </div>
        </>
    );
}
