import {
    ArrowRight,
    CheckCircle2,
    FileSearch,
    Film,
    LayoutGrid,
    List,
    Menu,
    MousePointerClick,
    Play,
    Sparkles,
    Volume2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ScrollReveal } from '@/components/public/scroll-reveal';
import { gsap, ScrollTrigger } from '@/lib/scroll-trigger';

/**
 * A jelenet lépései — a pinnelt desktop-változat alatt futó jelző címkéi.
 */
const SCENES = [
    'Nézz YouTube-ot vagy Netflixet',
    'Kattints egy ismeretlen szóra',
    'Vagy jelölj ki egy kifejezést',
    'Lásd, hány százalékát érted',
];

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

/**
 * Szövegelemzés-szekció a landing oldalon.
 *
 * Két, egymást kizáró elrendezés: mobilon a klasszikus, statikus lista
 * (a pinnelt jelenet kis kijelzőn szétesne), `lg`-től felfelé pedig egy
 * teljes képernyős, scroll-vezérelt GSAP-jelenet parallax-rétegekkel.
 */
export function TextAnalysisScrollSection() {
    const [popupMode, setPopupMode] = useState<'word' | 'phrase'>('word');
    const [scene, setScene] = useState(0);
    const rootRef = useRef<HTMLElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const mobileBarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = mobileBarRef.current;

        if (!el) {
            return;
        }

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

        io.observe(el);

        return () => io.disconnect();
    }, []);

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

                /** A két háttér-folt eltérő sebessége adja a mélységet. */
                gsap.to(q('[data-layer="glow-a"]'), {
                    yPercent: -38,
                    ease: 'none',
                    scrollTrigger: scrub,
                });
                gsap.to(q('[data-layer="glow-b"]'), {
                    yPercent: 26,
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
                    .from(q('[data-layer="mockup"]'), {
                        scale: 0.82,
                        yPercent: 12,
                        opacity: 0,
                        duration: 1,
                    })
                    .from(
                        q('[data-layer="subtitle"]'),
                        { opacity: 0, y: 24, duration: 0.6 },
                        '-=0.35',
                    )

                    .to(q('[data-word="able"]'), {
                        backgroundColor: 'rgba(249,115,22,.18)',
                        boxShadow: '0 0 0 2px #f97316',
                        duration: 0.35,
                    })
                    .from(
                        q('[data-layer="word-pop"]'),
                        { opacity: 0, y: 26, scale: 0.94, duration: 0.7 },
                        '-=0.1',
                    )

                    .to(q('[data-layer="word-pop"]'), {
                        opacity: 0,
                        y: -14,
                        scale: 0.96,
                        duration: 0.45,
                    })
                    .to(
                        q(
                            '[data-word="able"],[data-word="not"],[data-word="be"]',
                        ),
                        {
                            backgroundColor: 'rgba(74,222,128,.16)',
                            boxShadow: '0 0 0 2px #4ade80',
                            color: '#4ade80',
                            duration: 0.35,
                        },
                        '<',
                    )
                    .from(q('[data-layer="phrase-pop"]'), {
                        opacity: 0,
                        y: 26,
                        scale: 0.94,
                        duration: 0.7,
                    })

                    .to(q('[data-layer="mockup-wrap"]'), {
                        scale: 0.9,
                        yPercent: -8,
                        opacity: 0,
                        duration: 0.7,
                    })
                    /* A kártya alapból `opacity-0` — így nem villan fel a pin előtt. */
                    .fromTo(
                        q('[data-layer="analysis"]'),
                        { opacity: 0, y: 70, scale: 0.96 },
                        { opacity: 1, y: 0, scale: 1, duration: 0.8 },
                        '-=0.45',
                    )
                    .from(
                        q('[data-layer="analysis-word"]'),
                        { opacity: 0, y: 12, duration: 0.35, stagger: 0.08 },
                        '-=0.35',
                    )
                    .from(
                        q('[data-layer="bar-fill"]'),
                        { scaleX: 0, duration: 0.9, ease: 'power1.inOut' },
                        '-=0.15',
                    )
                    .from(
                        q('[data-layer="legend"]'),
                        { opacity: 0, y: 10, duration: 0.4 },
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
        <section id="szovegelemzes" ref={rootRef} className="bg-white">
            {/* Mobil: klasszikus, statikus elrendezés */}
            <div className="px-5 pt-24 pb-12 lg:hidden lg:motion-reduce:block">
                <div className="mx-auto max-w-[1000px]">
                    <div className="mx-auto max-w-[640px] text-center">
                        <h2 className="text-[clamp(30px,4vw,46px)] leading-[1.1] font-bold tracking-[-1px] text-[#171717]">
                            Elemezz bármilyen angol szöveget
                        </h2>
                        <p className="mx-auto mt-4 text-[17px] leading-[1.6] text-[#737373]">
                            Illeszd be a szöveget, adj meg egy webcímet vagy
                            könyvet — vagy elemezd egyenesen a{' '}
                            <b className="text-[#404040]">YouTube</b> és{' '}
                            <b className="text-[#404040]">Netflix</b>{' '}
                            feliratait. Minden elemzés megmutatja, a szöveg hány
                            százalékát érted.
                        </p>
                    </div>

                    <div
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
                                        onClick={() => setPopupMode('word')}
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
                                        onClick={() => setPopupMode('phrase')}
                                        className="inline-flex items-center gap-1.25 rounded-full px-3.5 py-2 font-sans text-[13px] font-bold whitespace-nowrap transition-all sm:gap-1.75 sm:px-5 sm:py-2.75 sm:text-[15px]"
                                        style={{
                                            background:
                                                popupMode === 'phrase'
                                                    ? '#4338ca'
                                                    : '#eef2ff',
                                            color:
                                                popupMode === 'phrase'
                                                    ? '#fff'
                                                    : '#4338ca',
                                            boxShadow:
                                                popupMode === 'phrase'
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

                                    <div className="absolute inset-x-0 bottom-0 z-2 bg-linear-to-t from-black/78 px-4 py-3.5">
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
                                            képes, tud valamit megtenni
                                        </div>
                                        <div className="mt-0.75 text-xs text-[#737373]">
                                            ≈ capable, competent
                                        </div>
                                        <div className="mt-2.5 border-l-2 border-indigo-200 pl-2.25">
                                            <div className="text-xs text-[#404040] italic">
                                                „She is able to speak three
                                                languages.”
                                            </div>
                                            <div className="text-xs text-[#a1a1a1]">
                                                „Három nyelven tud beszélni.”
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
                                                <ArrowRight size={15} />
                                            </span>
                                            <div className="flex gap-1.5 text-[#a1a1a1]">
                                                <Volume2 size={17} />
                                                <Sparkles size={17} />
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
                                            <MousePointerClick size={14} />3 szó
                                            kijelölve · shift + kattintás
                                        </div>
                                        <div className="mt-2.5 text-[13px] leading-[1.5] text-[#737373]">
                                            A kifejezés még nincs az
                                            adatbázisban — vedd fel egészben.
                                        </div>
                                        <div className="mt-3 flex flex-col gap-2.25 border-t border-neutral-100 pt-3">
                                            <span className="inline-flex items-center gap-1.25 text-[13px] font-semibold text-indigo-700">
                                                Saját kifejezésként hozzáadom
                                                <ArrowRight size={15} />
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-700">
                                                <Sparkles size={16} />
                                                AI-kitöltés — közvetlen a
                                                webappba
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
                                    Elemezd a feliratokat, és lásd élőben, hány
                                    szót értesz. Az ismeretlen szavak egy
                                    kattintással a tanulólistádba kerülnek.
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
                    </div>

                    <div className="mt-10 rounded-3xl bg-[#171717] p-7.5 shadow-[0_24px_60px_rgba(0,0,0,.24)]">
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
                                        ref={mobileBarRef}
                                        className="h-full w-[87%] origin-left [transform:scaleX(0)] rounded-full bg-linear-to-r from-green-400 to-green-500"
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
                        className="pointer-events-none absolute top-[8%] -left-[12%] -z-1 size-[520px] rounded-full blur-[90px]"
                        style={{
                            background:
                                'radial-gradient(circle,rgba(99,102,241,.22),transparent 68%)',
                        }}
                    />
                    <div
                        data-layer="glow-b"
                        className="pointer-events-none absolute right-[-10%] bottom-[6%] -z-1 size-[460px] rounded-full blur-[80px]"
                        style={{
                            background:
                                'radial-gradient(circle,rgba(168,85,247,.18),transparent 68%)',
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
                            Elemezz bármilyen angol szöveget
                        </h2>
                        <p
                            data-layer="lead"
                            className="mx-auto mt-3.5 text-[16px] leading-[1.6] text-[#737373]"
                        >
                            Illeszd be a szöveget, adj meg egy webcímet vagy
                            könyvet — vagy elemezd egyenesen a{' '}
                            <b className="text-[#404040]">YouTube</b> és{' '}
                            <b className="text-[#404040]">Netflix</b>{' '}
                            feliratait.
                        </p>
                    </div>

                    {/*
                     * A jelenet szélessége a rendelkezésre álló magasságból
                     * jön, hogy a 16:9-es mockup és a lépés-jelző alacsonyabb
                     * laptop-kijelzőn se fusson egymásra.
                     */}
                    <div
                        className="relative w-full"
                        style={{
                            width: 'min(880px, calc((100vh - 260px) * 16 / 9))',
                        }}
                    >
                        <div data-layer="mockup-wrap">
                            <div className="relative">
                                <div
                                    data-layer="mockup"
                                    className="relative aspect-video overflow-hidden rounded-[18px] bg-[#0b0b12] shadow-[0_30px_70px_rgba(0,0,0,.36)]"
                                >
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
                                    <div
                                        className="absolute inset-0"
                                        style={{
                                            background:
                                                'radial-gradient(circle at 40% 40%,rgba(79,70,229,.34),rgba(11,11,18,.12))',
                                        }}
                                    />

                                    <div
                                        data-layer="subtitle"
                                        className="absolute inset-x-0 bottom-16 z-2 px-5.5 text-center"
                                    >
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
                                            <span
                                                data-word="not"
                                                className="rounded-[3px] px-0.5 text-green-400"
                                            >
                                                not
                                            </span>{' '}
                                            <span
                                                data-word="be"
                                                className="rounded-[3px] px-0.5 text-green-400"
                                            >
                                                be
                                            </span>{' '}
                                            <span
                                                data-word="able"
                                                className="rounded-[3px] px-0.5 text-orange-500"
                                            >
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

                                    <div className="absolute inset-x-0 bottom-0 z-2 bg-linear-to-t from-black/78 px-4 py-3.5">
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

                                <div
                                    data-layer="word-pop"
                                    className="ts-wordpop absolute bottom-30 left-[58%] z-6 w-59 -translate-x-1/2 rounded-[14px] border border-neutral-200 bg-white p-4 shadow-[0_20px_46px_rgba(0,0,0,.28)]"
                                >
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
                                        képes, tud valamit megtenni
                                    </div>
                                    <div className="mt-0.75 text-xs text-[#737373]">
                                        ≈ capable, competent
                                    </div>
                                    <div className="mt-2.5 border-l-2 border-indigo-200 pl-2.25">
                                        <div className="text-xs text-[#404040] italic">
                                            „She is able to speak three
                                            languages.”
                                        </div>
                                        <div className="text-xs text-[#a1a1a1]">
                                            „Három nyelven tud beszélni.”
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
                                    </div>
                                    <div className="mt-3 flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700">
                                            Megnyitás
                                            <ArrowRight size={15} />
                                        </span>
                                        <div className="flex gap-1.5 text-[#a1a1a1]">
                                            <Volume2 size={17} />
                                            <Sparkles size={17} />
                                        </div>
                                    </div>
                                </div>

                                <div
                                    data-layer="phrase-pop"
                                    className="ts-wordpop absolute bottom-30 left-[46%] z-7 w-60 -translate-x-1/2 rounded-[14px] border border-neutral-200 bg-white p-4 shadow-[0_20px_46px_rgba(0,0,0,.28)]"
                                >
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
                                        <MousePointerClick size={14} />3 szó
                                        kijelölve · shift + kattintás
                                    </div>
                                    <div className="mt-2.5 text-[13px] leading-[1.5] text-[#737373]">
                                        A kifejezés még nincs az adatbázisban —
                                        vedd fel egészben.
                                    </div>
                                    <div className="mt-3 flex flex-col gap-2.25 border-t border-neutral-100 pt-3">
                                        <span className="inline-flex items-center gap-1.25 text-[13px] font-semibold text-indigo-700">
                                            Saját kifejezésként hozzáadom
                                            <ArrowRight size={15} />
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-700">
                                            <Sparkles size={16} />
                                            AI-kitöltés — közvetlen a webappba
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
                            <div
                                data-layer="analysis"
                                className="rounded-3xl bg-[#171717] p-7.5 opacity-0 shadow-[0_24px_60px_rgba(0,0,0,.24)]"
                            >
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
                                    <span
                                        data-layer="analysis-word"
                                        className="inline-block rounded bg-green-500 px-1 py-0.25 text-green-950"
                                    >
                                        between
                                    </span>{' '}
                                    two{' '}
                                    <span
                                        data-layer="analysis-word"
                                        className="inline-block rounded bg-blue-500 px-1 py-0.25 text-white"
                                    >
                                        cities
                                    </span>{' '}
                                    lies a{' '}
                                    <span
                                        data-layer="analysis-word"
                                        className="inline-block rounded bg-red-500 px-1 py-0.25 text-white"
                                    >
                                        valley
                                    </span>{' '}
                                    known for its{' '}
                                    <span
                                        data-layer="analysis-word"
                                        className="inline-block rounded bg-green-500 px-1 py-0.25 text-green-950"
                                    >
                                        remarkable
                                    </span>{' '}
                                    landscape and{' '}
                                    <span
                                        data-layer="analysis-word"
                                        className="inline-block rounded bg-blue-500 px-1 py-0.25 text-white"
                                    >
                                        resilient
                                    </span>{' '}
                                    wildlife.
                                </p>
                                <div className="mt-5 border-t border-neutral-800 pt-4.5">
                                    <div className="mb-2 flex justify-between text-[13px] text-neutral-400">
                                        <span>Érthetőség</span>
                                        <span className="font-semibold text-green-400">
                                            87%
                                        </span>
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-neutral-800">
                                        <div
                                            data-layer="bar-fill"
                                            className="h-full w-[87%] origin-left rounded-full bg-linear-to-r from-green-400 to-green-500"
                                        />
                                    </div>
                                </div>
                                <div
                                    data-layer="legend"
                                    className="mt-4 flex gap-4 text-xs text-neutral-400"
                                >
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
                                        color:
                                            i === scene || i < scene
                                                ? '#fff'
                                                : '#737373',
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

            {/*
             * Közös lezárás mindkét változat alá: desktopon ez a statikus sáv
             * választja el a pinnelt jelenetet a következő szekció jelenetétől.
             */}
            <div className="px-5 pb-24">
                <div className="mx-auto grid max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                    {ANALYZE_BULLETS.map((b, i) => (
                        <ScrollReveal
                            key={b.title}
                            delay={i * 0.08}
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
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
