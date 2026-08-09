import {
    Download,
    Layers,
    LayoutGrid,
    MousePointerClick,
    Route,
    Shuffle,
    SlidersHorizontal,
    Table,
    Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ScrollReveal } from '@/components/public/scroll-reveal';
import { gsap, ScrollTrigger } from '@/lib/scroll-trigger';

/**
 * Az SRS négy értékelési fokozata — a címke, a szín, a következő ismétlés
 * távolsága és az algoritmus viselkedése egy helyen. A leírások szándékosan
 * zsargon nélküliek: a látogató nem tudja, mi az az ease faktor.
 */
const SRS_STEPS = [
    {
        label: 'Újra',
        color: '#ef4444',
        time: '1 perc',
        desc: 'Nem jutott eszedbe — pár percen belül újra előkerül.',
    },
    {
        label: 'Nehéz',
        color: '#f59e0b',
        time: '6 nap',
        desc: 'Épphogy megvolt — a szokásosnál hamarabb kérdez vissza.',
    },
    {
        label: 'Jó',
        color: '#22c55e',
        time: '10 nap',
        desc: 'Sikerült — a következő ismétlésig hosszabb szünet telik el.',
    },
    {
        label: 'Könnyű',
        color: '#3b82f6',
        time: '15 nap',
        desc: 'Azonnal tudtad — jó sokáig nem kerül elő újra.',
    },
];

/**
 * A hero-mockup ugyanezeket a fokozatokat mutatja, ezért innen veszi őket —
 * így az árak/intervallumok egyetlen helyen élnek.
 */
export const RATE_DEFS = SRS_STEPS.map(({ label, time, color }) => ({
    label,
    time,
    c: color,
}));

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
];

/** A pinnelt desktop-jelenet lépései. */
const SCENES = [
    'Jön a következő kártya',
    'Fordítsd meg',
    'Értékeld, hogy ment',
    'Az algoritmus ütemez',
];

const SCENE_CARD = DEMO_DECK[0];

/**
 * Flashcard SRS-szekció a landing oldalon.
 *
 * Ugyanaz a kétágú felépítés, mint a szövegelemzés-szekciónál: mobilon (és
 * `prefers-reduced-motion` mellett) az interaktív, statikus demó, `lg`-től
 * felfelé egy pinnelt, scroll-vezérelt GSAP-jelenet.
 */
export function FlashcardScrollSection() {
    const [flipped, setFlipped] = useState(false);
    const [deckIndex, setDeckIndex] = useState(0);
    const [scene, setScene] = useState(0);
    const rootRef = useRef<HTMLElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);

    const demoCard = DEMO_DECK[deckIndex];

    const rateCard = () => {
        setFlipped(false);
        setDeckIndex((i) => (i + 1) % DEMO_DECK.length);
    };

    useEffect(() => {
        const mm = gsap.matchMedia();

        mm.add(
            '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
            () => {
                const q = gsap.utils.selector(stageRef);
                const scrub = {
                    trigger: rootRef.current,
                    start: 'top top',
                    end: '+=3000',
                    scrub: 1,
                };

                const tl = gsap.timeline({
                    defaults: { ease: 'power2.out' },
                    scrollTrigger: {
                        ...scrub,
                        pin: stageRef.current,
                        anticipatePin: 1,
                        onUpdate: (self) => {
                            setScene(
                                Math.min(
                                    SCENES.length - 1,
                                    Math.floor(self.progress * SCENES.length),
                                ),
                            );
                        },
                    },
                });

                /** A háttér-foltok eltérő sebessége adja a mélységet. */
                gsap.to(q('[data-layer="glow-a"]'), {
                    yPercent: -32,
                    ease: 'none',
                    scrollTrigger: scrub,
                });
                gsap.to(q('[data-layer="glow-b"]'), {
                    yPercent: 24,
                    ease: 'none',
                    scrollTrigger: scrub,
                });
                /* A cím lassabban sodródik, mint a jelenet — ez adja a mélységet. */
                gsap.to(q('[data-layer="heading"]'), {
                    yPercent: -16,
                    ease: 'none',
                    scrollTrigger: scrub,
                });

                tl.from(q('[data-layer="title"]'), {
                    y: 44,
                    opacity: 0,
                    duration: 0.7,
                })
                    .from(
                        q('[data-layer="lead"]'),
                        { y: 32, opacity: 0, duration: 0.7 },
                        '-=0.5',
                    )
                    .from(
                        q('[data-layer="steps"]'),
                        { y: 26, opacity: 0, duration: 0.6 },
                        '-=0.45',
                    )
                    .from(q('[data-layer="card-wrap"]'), {
                        yPercent: 14,
                        scale: 0.9,
                        opacity: 0,
                        duration: 1,
                    })
                    .from(
                        q('[data-layer="deck-head"]'),
                        { opacity: 0, y: -12, duration: 0.5 },
                        '-=0.5',
                    )

                    /* 2. jelenet: a kártya megfordul */
                    .to(q('[data-layer="card-inner"]'), {
                        rotationY: 180,
                        duration: 1.1,
                        ease: 'power2.inOut',
                    })

                    /* 3. jelenet: értékelés — a „Jó” gomb kiemelkedik */
                    .from(q('[data-layer="rate"]'), {
                        opacity: 0,
                        y: 18,
                        stagger: 0.08,
                        duration: 0.45,
                    })
                    .to(q('[data-rate="Jó"]'), {
                        scale: 1.1,
                        boxShadow: '0 14px 30px rgba(34,197,94,.42)',
                        duration: 0.35,
                    })
                    .to(q('[data-rate="Jó"]'), { scale: 1, duration: 0.3 })

                    /* 4. jelenet: az ütemezés magyarázata veszi át a helyet */
                    .to(q('[data-layer="card-wrap"]'), {
                        opacity: 0,
                        scale: 0.92,
                        yPercent: -10,
                        duration: 0.7,
                    })
                    .fromTo(
                        q('[data-layer="srs-panel"]'),
                        { opacity: 0, y: 70, scale: 0.96 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.8 },
                        '-=0.45',
                    )
                    .from(
                        q('[data-layer="srs-row"]'),
                        { opacity: 0, x: -24, stagger: 0.1, duration: 0.45 },
                        '-=0.4',
                    );

                return () => {
                    tl.kill();
                };
            },
        );

        requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => mm.revert();
    }, []);

    return (
        <section id="flashcard" ref={rootRef} className="bg-white">
            {/* Mobil: interaktív, statikus demó */}
            <div className="px-5 pt-24 pb-12 lg:hidden lg:motion-reduce:block">
                <div className="mx-auto mb-14 max-w-[760px] text-center">
                    <h2 className="text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                        Intelligens ismétlési rendszer
                    </h2>
                    <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-[1.6] text-[#737373]">
                        A kártyák akkor jönnek vissza, amikor épp kezdenéd
                        elfelejteni őket: amit könnyen felidézel, azt egyre
                        ritkábban látod — amivel küzdesz, az sűrűn visszatér.
                    </p>
                </div>

                <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-start gap-10">
                    <div className="rounded-3xl border border-neutral-200 p-6 shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.25 font-semibold text-[#171717]">
                                <Layers size={20} className="text-indigo-700" />
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
                            onClick={() => setFlipped((v) => !v)}
                            className="mt-4.5 h-59 w-full cursor-pointer"
                            style={{ perspective: 1200 }}
                        >
                            <div
                                className="relative size-full transition-transform duration-600 ease-[cubic-bezier(.4,.2,.2,1)]"
                                style={{
                                    transformStyle: 'preserve-3d',
                                    transform: flipped
                                        ? 'rotateY(180deg)'
                                        : 'rotateY(0deg)',
                                }}
                            >
                                <div
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[18px] border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100"
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                                        {demoCard.rank}
                                    </span>
                                    <span className="text-[46px] font-bold tracking-tight text-[#171717]">
                                        {demoCard.word}
                                    </span>
                                    <span className="inline-flex items-center gap-1.25 text-xs text-indigo-500">
                                        <MousePointerClick size={15} />
                                        Kattints a megfordításhoz
                                    </span>
                                </div>
                                <div
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 rounded-[18px] bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
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
                            {flipped
                                ? 'Hogy ment? Értékeld — az algoritmus ütemezi a következő ismétlést.'
                                : 'Fordítsd meg a kártyát, majd értékeld, mennyire ment könnyen.'}
                        </div>
                        <div className="mt-3 grid grid-cols-4 gap-2.5">
                            {SRS_STEPS.map((r) => (
                                <button
                                    key={r.label}
                                    onClick={rateCard}
                                    disabled={!flipped}
                                    className="flex flex-col items-center gap-0.5 rounded-xl py-3 transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40"
                                    style={{
                                        border: `1px solid ${r.color}3d`,
                                        background: `${r.color}14`,
                                        color: r.color,
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
                    </div>
                    <div className="flex flex-col gap-3.5">
                        {SRS_STEPS.map((e) => (
                            <div
                                key={e.label}
                                className="flex items-start gap-3.5 rounded-[14px] border border-neutral-200 bg-[#fafafa] p-4"
                            >
                                <span
                                    className="inline-flex min-w-9 flex-none items-center justify-center rounded-[9px] px-2.25 py-2 text-xs font-semibold whitespace-nowrap text-white"
                                    style={{ background: e.color }}
                                >
                                    {e.label}
                                </span>
                                <p className="text-sm leading-[1.55] text-[#404040]">
                                    {e.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop: pinnelt, scroll-vezérelt jelenet */}
            <div className="hidden lg:block lg:motion-reduce:hidden">
                <div
                    ref={stageRef}
                    className="relative flex h-screen flex-col items-center justify-center gap-9 overflow-hidden px-5"
                >
                    <div
                        data-layer="glow-a"
                        className="pointer-events-none absolute top-[10%] -left-[10%] -z-1 size-[500px] rounded-full blur-[90px]"
                        style={{
                            background:
                                'radial-gradient(circle,rgba(99,102,241,.2),transparent 68%)',
                        }}
                    />
                    <div
                        data-layer="glow-b"
                        className="pointer-events-none absolute right-[-8%] bottom-[8%] -z-1 size-[440px] rounded-full blur-[80px]"
                        style={{
                            background:
                                'radial-gradient(circle,rgba(56,189,248,.16),transparent 68%)',
                        }}
                    />

                    <div
                        data-layer="heading"
                        className="relative mx-auto max-w-[640px] text-center"
                    >
                        <h2
                            data-layer="title"
                            className="text-[clamp(28px,3.6vw,42px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]"
                        >
                            Intelligens ismétlési rendszer
                        </h2>
                        <p
                            data-layer="lead"
                            className="mx-auto mt-3.5 text-[16px] leading-[1.6] text-[#737373]"
                        >
                            A kártyák akkor jönnek vissza, amikor épp kezdenéd
                            elfelejteni őket: amit könnyen felidézel, azt egyre
                            ritkábban látod — amivel küzdesz, az sűrűn
                            visszatér.
                        </p>
                    </div>

                    <div className="relative w-full max-w-[720px]">
                        <div data-layer="card-wrap">
                            <div className="mx-auto w-full max-w-[460px]">
                                <div
                                    data-layer="deck-head"
                                    className="flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2.25 font-semibold text-[#171717]">
                                        <Layers
                                            size={20}
                                            className="text-indigo-700"
                                        />
                                        Angol alapszavak
                                    </div>
                                    <span className="rounded-full bg-indigo-50 px-3 py-1.25 text-[13px] font-semibold text-indigo-700">
                                        1 / {DEMO_DECK.length}
                                    </span>
                                </div>
                                <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-indigo-50">
                                    <div className="h-full w-1/4 rounded-full bg-linear-to-r from-indigo-600 to-indigo-800" />
                                </div>

                                <div
                                    className="mt-4.5 h-[clamp(210px,30vh,260px)] w-full"
                                    style={{ perspective: 1200 }}
                                >
                                    <div
                                        data-layer="card-inner"
                                        className="relative size-full"
                                        style={{
                                            transformStyle: 'preserve-3d',
                                        }}
                                    >
                                        <div
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[18px] border border-indigo-200 bg-linear-to-br from-indigo-50 to-indigo-100"
                                            style={{
                                                backfaceVisibility: 'hidden',
                                            }}
                                        >
                                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700">
                                                {SCENE_CARD.rank}
                                            </span>
                                            <span className="text-[46px] font-bold tracking-tight text-[#171717]">
                                                {SCENE_CARD.word}
                                            </span>
                                        </div>
                                        <div
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 rounded-[18px] bg-linear-to-br from-indigo-600 to-indigo-800 p-6 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]"
                                            style={{
                                                backfaceVisibility: 'hidden',
                                                transform: 'rotateY(180deg)',
                                            }}
                                        >
                                            <span className="text-[42px] font-bold tracking-tight text-white">
                                                {SCENE_CARD.translation}
                                            </span>
                                            <span className="text-sm leading-[1.55] text-indigo-100">
                                                „{SCENE_CARD.example}”
                                            </span>
                                            <span className="text-sm text-indigo-200">
                                                {SCENE_CARD.exampleHu}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-4 gap-2.5">
                                    {SRS_STEPS.map((r) => (
                                        <div
                                            key={r.label}
                                            data-layer="rate"
                                            data-rate={r.label}
                                            className="flex flex-col items-center gap-0.5 rounded-xl py-3"
                                            style={{
                                                border: `1px solid ${r.color}3d`,
                                                background: `${r.color}14`,
                                                color: r.color,
                                            }}
                                        >
                                            <span className="text-sm font-bold">
                                                {r.label}
                                            </span>
                                            <span className="text-[11px] opacity-80">
                                                {r.time}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                            <div
                                data-layer="srs-panel"
                                className="rounded-3xl border border-neutral-200 bg-white p-7 opacity-0 shadow-[0_24px_60px_rgba(0,0,0,.12)]"
                            >
                                <div className="mb-4 text-center text-sm font-semibold text-[#737373]">
                                    Az értékelésed dönti el, mikor látod viszont
                                    a kártyát
                                </div>
                                <div className="flex flex-col gap-3">
                                    {SRS_STEPS.map((e) => (
                                        <div
                                            key={e.label}
                                            data-layer="srs-row"
                                            className="flex items-center gap-3.5 rounded-[14px] border border-neutral-200 bg-[#fafafa] p-4"
                                        >
                                            <span
                                                className="inline-flex min-w-16 flex-none items-center justify-center rounded-[9px] px-2.25 py-2 text-xs font-semibold whitespace-nowrap text-white"
                                                style={{ background: e.color }}
                                            >
                                                {e.label}
                                            </span>
                                            <span
                                                className="min-w-14 flex-none text-sm font-bold"
                                                style={{ color: e.color }}
                                            >
                                                {e.time}
                                            </span>
                                            <p className="text-sm leading-[1.55] text-[#404040]">
                                                {e.desc}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        data-layer="steps"
                        className="relative -mt-3 flex items-center gap-2.5"
                    >
                        {SCENES.map((label, i) => (
                            <div
                                key={label}
                                className="flex items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-300"
                                style={{
                                    background:
                                        i === scene ? '#4338ca' : '#f5f5f5',
                                    boxShadow:
                                        i === scene
                                            ? '0 10px 26px rgba(67,56,202,.35)'
                                            : 'none',
                                }}
                            >
                                <span
                                    className="grid size-5 place-items-center rounded-full text-[11px] font-bold transition-colors duration-300"
                                    style={{
                                        background:
                                            i === scene
                                                ? 'rgba(255,255,255,.22)'
                                                : i < scene
                                                  ? '#4338ca'
                                                  : '#d4d4d4',
                                        color: i <= scene ? '#fff' : '#737373',
                                    }}
                                >
                                    {i + 1}
                                </span>
                                <span
                                    className="text-[14px] font-semibold transition-colors duration-300"
                                    style={{
                                        color: i === scene ? '#fff' : '#525252',
                                    }}
                                >
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Közös: a flashcard-képességek rácsa */}
            <div className="px-5 pb-24">
                <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
                    {FLASH_CAPS.map((c, i) => (
                        <ScrollReveal
                            key={c.title}
                            delay={i * 0.06}
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
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
