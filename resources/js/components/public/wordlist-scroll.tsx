import {
    AlarmClock,
    ArrowRight,
    Bookmark,
    Check,
    Edit,
    List,
    Mic,
    Sparkles,
    Star,
    Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from '@/lib/scroll-trigger';

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

/** A mobil demó automatikus szó-váltásának üteme. */
const WORD_AUTOPLAY_MS = 4000;

const DETAIL_BUTTONS: Status[] = [
    'Tudom',
    'Tanulom',
    'Később',
    'Kiejtés',
    'Gyakorlásra',
];

/** A pinnelt desktop-jelenet lépései — a szekció szövegének négy ígérete. */
const SCENES = [
    'Válaszd ki a szót',
    'Jelöld a státuszát',
    'Állítsd be a fontosságát',
    'Kérj AI-segítséget',
];

/** A jelenet ezt a szót mutatja végig. */
const SCENE_INDEX = 0;
const SCENE_STATUS: Status = 'Tudom';
const SCENE_IMPORTANCE = 4;

/**
 * Szólista-szekció a landing oldalon.
 *
 * Mobilon (és `prefers-reduced-motion` mellett) az interaktív demó automata
 * szó-váltással; `lg`-től felfelé egy pinnelt, scroll-vezérelt jelenet, ahol
 * a görgetés lépteti végig a szekció négy ígéretét ugyanazon a szón.
 */
export function WordlistScrollSection() {
    const [filter, setFilter] = useState<'Összes' | 'Tanulom' | 'Tudom'>(
        'Összes',
    );
    const [selWord, setSelWord] = useState(0);
    const [wordAutoplay, setWordAutoplay] = useState(true);
    const [words, setWords] = useState<WordEntry[]>(INITIAL_WORDS);
    const [scene, setScene] = useState(0);
    const rootRef = useRef<HTMLElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!wordAutoplay) {
            return;
        }

        const id = setInterval(() => {
            setSelWord((i) => (i + 1) % INITIAL_WORDS.length);
        }, WORD_AUTOPLAY_MS);

        return () => clearInterval(id);
    }, [wordAutoplay]);

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

                /*
                 * A két oszlop kissé eltérő sebességgel sodródik a pin alatt —
                 * ez adja a mélységet. A lépések látványát a `scene` state
                 * vezérli CSS-átmenetekkel, nem a timeline.
                 */
                gsap.to(q('[data-layer="list"]'), {
                    yPercent: -6,
                    ease: 'none',
                    scrollTrigger: scrub,
                });
                gsap.to(q('[data-layer="detail"]'), {
                    yPercent: 5,
                    ease: 'none',
                    scrollTrigger: scrub,
                });
                gsap.to(q('[data-layer="heading"]'), {
                    yPercent: -14,
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
                        0.18,
                    )
                    .from(
                        q('[data-layer="list"]'),
                        { x: -60, opacity: 0, duration: 0.8 },
                        0.4,
                    )
                    .from(
                        q('[data-layer="detail"]'),
                        { x: 60, opacity: 0, duration: 0.8 },
                        0.55,
                    )
                    .from(
                        q('[data-layer="steps"]'),
                        { y: 26, opacity: 0, duration: 0.6 },
                        0.85,
                    )
                    /* Kitöltő idő, hogy a belépő ne nyúljon a teljes görgetésre. */
                    .to({}, { duration: 3.1 }, 1.45);

                return () => {
                    tl.kill();
                };
            },
        );

        requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => mm.revert();
    }, []);

    const selectWord = (i: number) => {
        setWordAutoplay(false);
        setSelWord(i);
    };

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

    /* A jelenet állapotai: a lépés dönti el, mi van már beállítva. */
    const sceneWord = INITIAL_WORDS[SCENE_INDEX];
    const sceneStatus = scene >= 1 ? SCENE_STATUS : null;
    const sceneMeta = sceneStatus ? STATUS_META[sceneStatus] : null;
    const sceneImportance = scene >= 2 ? SCENE_IMPORTANCE : 0;

    return (
        <section
            id="szolista"
            ref={rootRef}
            style={{
                background:
                    'linear-gradient(180deg,#f7f4ff 0%,#f5f3ff 50%,#eef2ff 100%)',
            }}
        >
            <div
                className="px-5 pt-24 pb-12 lg:hidden lg:motion-reduce:block"
                style={{
                    background:
                        'linear-gradient(180deg,#f7f4ff 0%,#f5f3ff 50%,#eef2ff 100%)',
                }}
            >
                <div className="mx-auto mb-12 max-w-[680px] text-center">
                    <h2 className="text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                        Kövesd nyomon a szókincsed fejlődését
                    </h2>
                    <p className="mx-auto mt-4 text-[17px] leading-[1.6] text-[#737373]">
                        Bármelyik szót választod is, a rendszer segít
                        megtanulni: jelöld a státuszát, állítsd be a
                        fontosságát, nézd meg az infóit, és kérj AI-segítséget,
                        ha valamit nem értesz.
                    </p>
                </div>

                <div className="mx-auto grid max-w-[1080px] grid-cols-[1.1fr_1fr] items-start gap-6 max-lg:grid-cols-1">
                    {/* list */}
                    <div className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,.06)]">
                        <div className="flex items-center justify-between px-5 pt-4.5 pb-3.5">
                            <div className="flex items-center gap-2 font-semibold text-[#171717]">
                                <List size={20} className="text-indigo-700" />
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
                                    onClick={() => setFilter(t.label)}
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
                                        onClick={() => selectWord(w.i)}
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
                                                          background: th.color,
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
                                        {selected && wordAutoplay ? (
                                            <svg
                                                width="18"
                                                height="18"
                                                viewBox="0 0 18 18"
                                                className="flex-none -rotate-90"
                                            >
                                                <circle
                                                    cx="9"
                                                    cy="9"
                                                    r="7"
                                                    fill="none"
                                                    stroke="#e0e7ff"
                                                    strokeWidth="2"
                                                />
                                                <circle
                                                    cx="9"
                                                    cy="9"
                                                    r="7"
                                                    fill="none"
                                                    stroke="#4338ca"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeDasharray={44}
                                                    style={{
                                                        animation: `ring-countdown ${WORD_AUTOPLAY_MS}ms linear forwards`,
                                                    }}
                                                />
                                            </svg>
                                        ) : (
                                            <ArrowRight
                                                size={18}
                                                className="text-neutral-300"
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* detail */}
                    <div className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,.06)]">
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
                                {DETAIL_BUTTONS.map((key) => {
                                    const m = STATUS_META[key];
                                    const active = sel.status === key;
                                    const full = key === 'Gyakorlásra';

                                    return (
                                        <button
                                            key={key}
                                            onClick={() =>
                                                setWord(selWord, key)
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
                    </div>
                </div>
            </div>

            {/* Desktop: pinnelt, scroll-vezérelt jelenet */}
            <div className="hidden lg:block lg:motion-reduce:hidden">
                <div
                    ref={stageRef}
                    className="relative flex h-screen flex-col items-center justify-center gap-8 overflow-hidden px-5"
                >
                    <div
                        data-layer="heading"
                        className="relative mx-auto max-w-[680px] text-center"
                    >
                        <h2
                            data-layer="title"
                            className="text-[clamp(28px,3.6vw,42px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]"
                        >
                            Kövesd nyomon a szókincsed fejlődését
                        </h2>
                        <p
                            data-layer="lead"
                            className="mx-auto mt-3.5 text-[16px] leading-[1.6] text-[#737373]"
                        >
                            Bármelyik szót választod is, a rendszer segít
                            megtanulni: jelöld a státuszát, állítsd be a
                            fontosságát, nézd meg az infóit, és kérj
                            AI-segítséget, ha valamit nem értesz.
                        </p>
                    </div>

                    <div className="grid w-full max-w-[1040px] grid-cols-[1.1fr_1fr] items-start gap-6">
                        <div
                            data-layer="list"
                            className="min-w-0 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,.06)]"
                        >
                            <div className="flex items-center justify-between px-5 pt-4.5 pb-3.5">
                                <div className="flex items-center gap-2 font-semibold text-[#171717]">
                                    <List
                                        size={20}
                                        className="text-indigo-700"
                                    />
                                    Szólista
                                </div>
                                <span className="rounded-full bg-green-50 px-3 py-1.25 text-[13px] font-semibold text-green-700 transition-all duration-500">
                                    {scene >= 1 ? 1 : 0} /{' '}
                                    {INITIAL_WORDS.length} tudom
                                </span>
                            </div>
                            <div className="flex gap-2 border-b border-neutral-100 px-5 pb-3.5">
                                {(['Összes', 'Tanulom', 'Tudom'] as const).map(
                                    (label) => (
                                        <span
                                            key={label}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.75 font-sans text-[13px] font-semibold text-[#525252]"
                                            style={
                                                label === 'Összes'
                                                    ? {
                                                          borderColor:
                                                              '#4338ca',
                                                          background: '#4338ca',
                                                          color: '#fff',
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {label}
                                            <span className="opacity-70">
                                                {label === 'Összes'
                                                    ? INITIAL_WORDS.length
                                                    : label === 'Tudom' &&
                                                        scene >= 1
                                                      ? 1
                                                      : 0}
                                            </span>
                                        </span>
                                    ),
                                )}
                            </div>
                            <div className="max-h-[38vh] overflow-hidden">
                                {INITIAL_WORDS.slice(0, 6).map((w, i) => {
                                    const active = i === SCENE_INDEX;
                                    const th = active ? sceneMeta : null;

                                    return (
                                        <div
                                            key={w.word}
                                            className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 transition-colors duration-500"
                                            style={{
                                                borderLeft: `3px solid ${active ? (th ? th.color : '#4338ca') : 'transparent'}`,
                                                background: active
                                                    ? th
                                                        ? th.tint
                                                        : '#eef2ff'
                                                    : '#fff',
                                            }}
                                        >
                                            <span
                                                className="size-2.25 flex-none rounded-full transition-colors duration-500"
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
                                                className="text-base font-semibold transition-colors duration-500"
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
                        </div>

                        <div
                            data-layer="detail"
                            className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,.06)]"
                        >
                            <div className="border-b border-neutral-100 bg-[#f7f7fb] p-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-xs font-bold text-[#a1a1a1]">
                                            #{sceneWord.num}
                                        </span>
                                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.75 text-[11px] font-semibold text-indigo-700">
                                            {sceneWord.pos}
                                        </span>
                                    </div>
                                    <span className="grid size-8.5 place-items-center rounded-full border-[1.5px] border-indigo-700 text-indigo-700">
                                        <Volume2 size={19} />
                                    </span>
                                </div>
                                <div className="mt-2 text-[26px] font-bold tracking-[-.4px] text-[#171717]">
                                    {sceneWord.word}
                                </div>
                            </div>
                            <div className="flex flex-col gap-4 p-5">
                                <div>
                                    <div className="text-[11px] font-bold tracking-[.8px] text-[#a1a1a1]">
                                        MAGYAR JELENTÉS
                                    </div>
                                    <div className="mt-2 rounded-xl border border-neutral-200 px-4 py-3 text-[19px] font-semibold text-[#171717]">
                                        {sceneWord.hu}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {DETAIL_BUTTONS.map((key) => {
                                        const m = STATUS_META[key];
                                        const active = sceneStatus === key;
                                        const full = key === 'Gyakorlásra';

                                        return (
                                            <span
                                                key={key}
                                                className="flex items-center justify-center gap-1.5 rounded-[11px] px-2.5 py-2.75 font-sans text-[13px] font-semibold transition-all duration-500"
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
                                                    transform: active
                                                        ? 'scale(1.04)'
                                                        : 'scale(1)',
                                                }}
                                            >
                                                <m.icon size={17} />
                                                {key}
                                            </span>
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
                                                    n <= sceneImportance
                                                        ? 'fill-amber-500 text-amber-500 transition-all duration-500'
                                                        : 'text-neutral-200 transition-all duration-500'
                                                }
                                                style={{
                                                    transform:
                                                        n <= sceneImportance
                                                            ? 'scale(1)'
                                                            : 'scale(.88)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] py-3 font-sans text-sm font-semibold transition-all duration-500"
                                    style={{
                                        borderColor:
                                            scene >= 3 ? '#7e22ce' : '#c7d2fe',
                                        background:
                                            scene >= 3 ? '#faf5ff' : '#fff',
                                        color:
                                            scene >= 3 ? '#7e22ce' : '#4338ca',
                                        transform:
                                            scene >= 3
                                                ? 'scale(1.03)'
                                                : 'scale(1)',
                                    }}
                                >
                                    <Sparkles size={18} />
                                    Szó infók (AI)
                                </div>
                                <div
                                    className="overflow-hidden rounded-xl bg-[#f7f7fb] transition-all duration-500"
                                    style={{
                                        borderLeft: `3px solid ${sceneMeta ? sceneMeta.color : '#4338ca'}`,
                                        maxHeight: scene >= 3 ? 160 : 0,
                                        opacity: scene >= 3 ? 1 : 0,
                                    }}
                                >
                                    <div className="p-4">
                                        <div className="text-[11px] font-bold tracking-[.8px] text-[#a1a1a1]">
                                            PÉLDAMONDAT
                                        </div>
                                        <div className="mt-2 text-[15px] font-medium text-[#171717] italic">
                                            „{sceneWord.ex.en}”
                                        </div>
                                        <div className="mt-1.5 text-sm text-[#737373]">
                                            {sceneWord.ex.hu}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        data-layer="steps"
                        className="relative flex items-center gap-2.5"
                    >
                        {SCENES.map((label, i) => (
                            <div
                                key={label}
                                className="flex items-center gap-2 rounded-full px-4 py-2.5 transition-all duration-300"
                                style={{
                                    background:
                                        i === scene ? '#4338ca' : '#ffffffcc',
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
        </section>
    );
}
