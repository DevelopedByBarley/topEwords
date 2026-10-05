import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Bookmark,
    Check,
    ChevronDown,
    Chrome,
    FileSearch,
    Film,
    Flame,
    Keyboard,
    Languages,
    Layers,
    LayoutGrid,
    List,
    MousePointerClick,
    NotebookPen,
    Play,
    Puzzle,
    SlidersHorizontal,
    Sparkles,
    Volume2,
    Wand2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import BetaBanner from '@/components/beta-banner';
import {
    FlashcardScrollSection,
    RATE_DEFS,
} from '@/components/public/flashcard-scroll';
import { PublicFooter } from '@/components/public/public-footer';
import { PublicHeader } from '@/components/public/public-header';
import { ScrollReveal } from '@/components/public/scroll-reveal';
import { TextAnalysisScrollSection } from '@/components/public/text-analysis-scroll';
import { WordlistScrollSection } from '@/components/public/wordlist-scroll';
import { dashboard, login, pricing as pricingRoute, register } from '@/routes';
import { index as wordsIndex } from '@/routes/words';

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

const FREE_PLAN = [
    '10 000 szavas szólista',
    'Flashcard SRS, saját deck-ek',
    'Chrome-bővítmény, napi kerettel',
    'AI-próbahozzáférés havi kerettel',
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
    { id: 'szolista', label: 'Szólista', icon: List },
    { id: 'szovegelemzes', label: 'Szövegelemzés', icon: FileSearch },
    { id: 'flashcard', label: 'Flashcard', icon: Layers },
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

const Reveal = ScrollReveal;

export default function Welcome({
    canRegister = true,
}: {
    canRegister?: boolean;
}) {
    const { auth, billingEnabled, extensionStoreUrl } = usePage().props;

    const [flipped, setFlipped] = useState(false);
    const [activeSection, setActiveSection] = useState('funkciok');
    const [showSideNav, setShowSideNav] = useState(false);
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
            'szolista',
            'szovegelemzes',
            'flashcard',
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

    const progressRef = useCountUp(41, '%');
    const wordCountRef = useCountUp(4187);
    const analyzePctRef = useCountUp(87, '%');
    const analyzeCountRef = useCountUp(312);
    const barRef = useRef<HTMLDivElement>(null);

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

        if (barRef.current) {
            io.observe(barRef.current);
        }

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
                    <div className="absolute inset-x-0 top-0 z-20">
                        <PublicHeader variant="transparent" />
                    </div>

                    <main id="main">
                        <section
                            className="relative overflow-hidden px-5 pt-22 pb-[200px] xl:pt-16 xl:pb-[120px]"
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
                                        href="#funkciok"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            goToSection('funkciok');
                                        }}
                                        className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.22] bg-white/[0.08] px-6.5 py-3.75 font-sans text-[15px] font-medium text-white transition-colors hover:bg-white/[0.18] md:backdrop-blur-md"
                                    >
                                        <ChevronDown size={20} />
                                        Funkciók
                                    </a>
                                </div>
                            </div>

                            <div className="relative z-3 mx-auto mt-16 flex max-w-[1060px] flex-wrap items-center justify-center gap-6">
                                <div
                                    className="pointer-events-none absolute top-[46%] bottom-[-320px] left-1/2 -z-10 w-screen -translate-x-1/2"
                                    style={{
                                        background:
                                            'linear-gradient(to bottom,rgba(255,255,255,0) 0,#ffffff 90px)',
                                    }}
                                />
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

                                <div className="animate-hero-float-c">
                                    <div className="w-[250px] rounded-[22px] border border-white/[0.28] bg-indigo-800/90 p-5.5 shadow-[0_26px_60px_rgba(49,46,129,.35)] md:bg-indigo-800/55 md:backdrop-blur-[14px]">
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

                        <section
                            id="funkciok"
                            className="relative -mt-35 bg-white px-5 pt-24 pb-25"
                        >
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
                                            delay={(i % 3) * 0.09}
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

                        <WordlistScrollSection />

                        <TextAnalysisScrollSection />

                        <FlashcardScrollSection />

                        <section
                            id="ai"
                            className="px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#f9f5ff 0%,#f5f3ff 50%,#ede9fe 100%)',
                            }}
                        >
                            <Reveal className="mx-auto mb-14 max-w-[760px] text-center">
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
                                {AI_CARDS.map((a, i) => (
                                    <Reveal
                                        key={a.title}
                                        delay={i * 0.1}
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

                        <section
                            id="arazas"
                            className="px-5 py-24"
                            style={{
                                background:
                                    'linear-gradient(180deg,#eef2ff 0%,#e9dff6 50%,#f5f3ff 100%)',
                            }}
                        >
                            <Reveal className="mx-auto mb-14 max-w-[760px] text-center">
                                <h2 className="mt-4.5 text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                                    Válaszd ki a hozzád illő csomagot
                                </h2>
                                <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.6] text-[#737373]">
                                    Kezdd ingyen — próbálj ki mindent, az AI-t
                                    is —, és ha megtetszett, válts Próra a
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
                                        Minden fő funkciót kipróbálhatsz — a
                                        flashcardokat is —, napi és havi
                                        korlátokkal.
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
                                            1 490 Ft
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
                                Az előfizetés bármikor lemondható. Az ingyenes
                                csomag korlátait tételesen a{' '}
                                <Link
                                    href={pricingRoute()}
                                    className="font-semibold text-[#4a59b5] underline-offset-2 hover:underline"
                                >
                                    részletes összehasonlításban
                                </Link>{' '}
                                nézheted meg.
                            </p>
                        </section>

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
