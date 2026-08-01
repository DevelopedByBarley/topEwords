import { Head, router } from '@inertiajs/react';
// A kivezetett diákhoz/pontokhoz tartozó ikonok kikommentelve (2026-07-29):
// Brain (Kvíz), CalendarCheck (Napi ismétlés), Repeat (Rendhagyó igék),
// Download / Link2 / MonitorPlay / Play (Player-dia).
import type { LucideIcon } from 'lucide-react';
import {
    ArrowLeftRight,
    BookOpen,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Circle,
    Highlighter,
    Keyboard,
    Layers,
    Lightbulb,
    Monitor,
    Moon,
    MousePointerClick,
    Plus,
    RotateCw,
    ScanText,
    SlidersHorizontal,
    Sparkles,
    Sun,
    TextSelect,
    Trophy,
    Tv,
    Wand2,
    Youtube,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { STATUS_CONFIG } from '@/components/words/types';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
// import { show as showDownload } from '@/routes/downloads';
import { complete as onboardingComplete } from '@/routes/onboarding';

interface Word {
    id: number;
    word: string;
    meaning_hu: string;
    level: number;
}

interface Props {
    wordsByLevel: Record<number, Word[]>;
    levelTotals: Record<number, number>;
    testEnabled?: boolean;
}

const LEVEL_LABELS: Record<
    number,
    { label: string; color: string; bg: string; border: string }
> = {
    1: {
        label: 'Top 1 000',
        color: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-950/30',
        border: 'border-green-200 dark:border-green-800',
    },
    2: {
        label: '1 001 – 2 000',
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
    },
    3: {
        label: '2 001 – 4 000',
        color: 'text-yellow-700 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-950/30',
        border: 'border-yellow-200 dark:border-yellow-800',
    },
    4: {
        label: '4 001 – 6 000',
        color: 'text-orange-700 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-950/30',
        border: 'border-orange-200 dark:border-orange-800',
    },
    5: {
        label: '6 001 – 8 000',
        color: 'text-indigo-700 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-950/30',
        border: 'border-indigo-200 dark:border-indigo-800',
    },
    6: {
        label: '8 001 – 10 000',
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
    },
};

type Step = 'ask-test' | 'test' | 'result' | 'features' | 'theme' | 'done';

const statusEntry = (value: string) =>
    STATUS_CONFIG.find((s) => s.value === value) ?? STATUS_CONFIG[0];

const STATUS_DEMO_WORDS = [
    { word: 'achieve', meaning: 'elér, megvalósít', value: 'known' },
    { word: 'consider', meaning: 'fontolóra vesz', value: 'learning' },
    { word: 'reluctant', meaning: 'vonakodó', value: 'saved' },
    { word: 'thorough', meaning: 'alapos', value: 'pronunciation' },
    { word: 'gather', meaning: 'összegyűjt', value: 'practice' },
] as const;

function WordListVisual() {
    return (
        <div className="space-y-1.5 rounded-2xl border bg-muted/30 p-3">
            {STATUS_DEMO_WORDS.map(({ word, meaning, value }) => {
                const s = statusEntry(value);
                const StatusIcon = s.icon;

                return (
                    <div
                        key={word}
                        className="flex items-center justify-between rounded-xl border bg-card px-3 py-2"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                                {word}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {meaning}
                            </p>
                        </div>
                        <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.pillActive}`}
                        >
                            <StatusIcon className="size-3" />
                            {s.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function PracticeVisual() {
    // Az SRS négy értékelő gombja — a kvíz-mockup helyett, mert a kvíz nem
    // része az induló feature-körnek.
    const ratings = [
        { t: 'Újra', tone: 'text-red-600 dark:text-red-400' },
        { t: 'Nehéz', tone: 'text-orange-600 dark:text-orange-400' },
        { t: 'Jó', tone: 'text-green-600 dark:text-green-400' },
        { t: 'Könnyű', tone: 'text-blue-600 dark:text-blue-400' },
    ];

    return (
        <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="mx-auto mb-3 flex aspect-[5/3] max-w-[16rem] flex-col items-center justify-center rounded-2xl border bg-card shadow-sm">
                <p className="text-2xl font-bold">improve</p>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <RotateCw className="size-3" />
                    kattints a megfordításhoz
                </p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
                {ratings.map(({ t, tone }) => (
                    <div
                        key={t}
                        className={`rounded-lg border bg-card px-2 py-2 text-center text-xs font-semibold ${tone}`}
                    >
                        {t}
                    </div>
                ))}
            </div>
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
                Az értékelésed dönti el, mikor jön elő újra a kártya
            </p>
        </div>
    );
}

function AnalysisVisual() {
    const sentence: { t: string; status?: string }[] = [
        { t: 'The' },
        { t: 'scientists', status: 'learning' },
        { t: 'gathered', status: 'practice' },
        { t: 'enough' },
        { t: 'evidence', status: 'saved' },
        { t: 'to' },
        { t: 'confirm', status: 'known' },
        { t: 'the' },
        { t: 'theory', status: 'pronunciation' },
        { t: 'almost' },
        { t: 'immediately.' },
    ];

    return (
        <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-center gap-3">
                <div className="flex size-16 items-center justify-center rounded-full border-4 border-green-500/40">
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        88%
                    </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    ennyit értenél
                    <br />
                    ebből a szövegből
                </p>
            </div>
            <p className="text-sm leading-7">
                {sentence.map((w, i) => (
                    <span key={i}>
                        {w.status ? (
                            <span
                                className={`rounded px-1 font-medium ${statusEntry(w.status).pillActive}`}
                            >
                                {w.t}
                            </span>
                        ) : (
                            w.t
                        )}{' '}
                    </span>
                ))}
            </p>
        </div>
    );
}

function ExtensionVisual() {
    const popupStatuses = ['known', 'learning', 'saved'];

    return (
        <div className="rounded-2xl border bg-muted/30 p-4">
            <div className="rounded-xl border bg-card p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                    …you are reading an article and hit an{' '}
                    <span className="rounded bg-primary/15 px-1 font-medium text-foreground underline decoration-dotted underline-offset-2">
                        unfamiliar
                    </span>{' '}
                    word.
                </p>
                <div className="mt-3 w-52 rounded-xl border bg-background p-3 shadow-lg">
                    <p className="text-sm font-bold">unfamiliar</p>
                    <p className="mb-2 text-xs text-muted-foreground">
                        ismeretlen, idegen
                    </p>
                    <div className="flex gap-1.5">
                        {popupStatuses.map((v) => {
                            const e = statusEntry(v);
                            const Icon = e.icon;

                            return (
                                <span
                                    key={v}
                                    className={`inline-flex items-center justify-center rounded-full p-1.5 ${e.pillActive}`}
                                >
                                    <Icon className="size-3.5" />
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
                <Youtube className="size-4 text-red-500" />
                YouTube
                <span className="text-muted-foreground/40">·</span>
                <Tv className="size-4 text-red-600" />
                Netflix felirat
            </div>
        </div>
    );
}

/*
 * A Player-dia kivezetve (2026-07-29) — a topwords Player letöltése
 * `can:admin` mögé került, így nem hirdetjük az onboardingban. A mockup
 * itt marad, hogy visszakapcsoláskor ne kelljen újraírni.
 *
 * function PlayerVisual() {
 *     const subtitleWords = [
 *         { t: 'The' },
 *         { t: 'crew' },
 *         { t: 'finally', status: 'learning' },
 *         { t: 'reached' },
 *         { t: 'the' },
 *         { t: 'summit.', status: 'saved' },
 *     ];
 *
 *     return (
 *         <div className="rounded-2xl border bg-muted/30 p-4">
 *             <div className="relative mx-auto mb-3 flex aspect-video max-w-sm items-center justify-center overflow-hidden rounded-2xl border bg-slate-900">
 *                 <div className="flex size-12 items-center justify-center rounded-full bg-white/15">
 *                     <Play className="ml-0.5 size-5 fill-white text-white" />
 *                 </div>
 *                 <div className="absolute bottom-2 left-0 right-0 px-2 text-center text-xs font-medium text-white">
 *                     {subtitleWords.map((w, i) => (
 *                         <span key={i}>
 *                             {w.status ? (
 *                                 <span
 *                                     className={`rounded px-1 ${statusEntry(w.status).pillActive}`}
 *                                 >
 *                                     {w.t}
 *                                 </span>
 *                             ) : (
 *                                 w.t
 *                             )}{' '}
 *                         </span>
 *                     ))}
 *                 </div>
 *             </div>
 *             <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
 *                 <MonitorPlay className="size-4 text-primary" />
 *                 Mac & Windows asztali app
 *             </div>
 *         </div>
 *     );
 * }
 */

/*
 * Az induló feature-körhöz igazítva (2026-07-29). Kikerült innen:
 *   – „Rendhagyó igék", „Kvíz", „Mondatkiegészítés", „Napi ismétlés": a
 *     route-jaik ki vannak kommentelve (routes/words.php), nem elérhetők.
 *   – a teljes „player" dia: a topwords Player letöltése `can:admin` mögé
 *     került, így a felhasználó nem tudná beszerezni az appot.
 * Visszahozáskor a kivett dia/pont ide kerül vissza (a PlayerVisual és a
 * hozzá tartozó ikon-importok szándékosan bent maradtak).
 */
/**
 * Egy funkció-kártya az onboarding dián. Az `ai: true` jelölteket AI-jelvény és
 * indigó kiemelés különbözteti meg — ugyanaz a vizuális nyelv, mint a
 * kézikönyv AiBadge-én.
 */
type SlideFeature = {
    Icon: LucideIcon;
    title: string;
    desc: string;
    ai?: boolean;
};

type FeatureSlide = {
    id: string;
    title: string;
    subtitle: string;
    Visual: ComponentType;
    features: SlideFeature[];
};

const FEATURE_SLIDES: FeatureSlide[] = [
    {
        id: 'vocab',
        title: 'A szókincsed, egy helyen',
        subtitle: '10 000 angol szó, öt státusszal követve.',
        Visual: WordListVisual,
        features: [
            {
                Icon: BookOpen,
                title: '10 000 szó',
                desc: 'Hat szintre bontott szólista a Top 1 000-től, szűrőkkel és saját mappákkal — a szavakat öt státusszal jelölöd.',
            },
            {
                Icon: Plus,
                title: 'Saját szavak',
                desc: 'Vedd fel a 10 000-en kívüli szavaidat is, és tanuld őket ugyanúgy, mint a többit.',
            },
            {
                Icon: Sparkles,
                title: 'AI-kitöltés',
                ai: true,
                desc: 'Saját szó felvételekor az AI kitölti a magyar jelentést, a szinonimákat, a ragozott alakokat és egy példamondatot — a végső szó a tiéd.',
            },
            {
                Icon: Lightbulb,
                title: 'Szó infók',
                ai: true,
                desc: 'Egy kattintásra megmutatja, milyen helyzetekben használják a szót, mennyire hivatalos, és példamondatokat is ad hozzá.',
            },
        ],
    },
    {
        id: 'practice',
        title: 'Gyakorolj okos ismétléssel',
        subtitle: 'A flashcard-paklik a te státuszaidra és tempódra épülnek.',
        Visual: PracticeVisual,
        features: [
            {
                Icon: Layers,
                title: 'Flashcard (SRS)',
                desc: 'Intelligens ismétlés: a kártyák akkor jönnek elő, amikor épp felejtenéd őket. Importálhatsz a szólistából vagy CSV-ből is.',
            },
            {
                Icon: ArrowLeftRight,
                title: 'Kétirányú kártyák',
                desc: 'Ugyanazt a kártyát tanulhatod angolról magyarra és vissza — a két irány külön ütemezést kap, így a felismerés és az előhívás külön erősödik.',
            },
            {
                Icon: Wand2,
                title: 'Kártya-kitöltés',
                ai: true,
                desc: 'Írd be a szót, és az AI megcsinálja a kártya mindkét oldalát — jelentéssel és példamondattal, hogy ne kelljen gépelned.',
            },
            {
                Icon: SlidersHorizontal,
                title: 'Saját tempó',
                desc: 'Paklinként állítható, hány új kártya és ismétlés jöjjön naponta, és milyen gyorsan nyúljanak az intervallumok — vagy hagyd az alapértelmezetten.',
            },
        ],
    },
    {
        id: 'analysis',
        title: 'Lásd, mennyit értesz',
        subtitle:
            'Szöveg, weboldal, könyv vagy YouTube-felirat — azonnali érthetőségi százalék.',
        Visual: AnalysisVisual,
        features: [
            {
                Icon: ScanText,
                title: 'Négyféle forrás',
                desc: 'Illessz be angol szöveget, adj meg egy weboldalt, tölts fel egy könyvet vagy elemezd egy YouTube-videó feliratát — a szavak a státuszod szerint színeződnek.',
            },
            {
                Icon: Trophy,
                title: 'Streak és teljesítmények',
                desc: 'Napi sorozatok és jelvények tartják fenn a motivációt, ahogy nő a szókincsed.',
            },
        ],
    },
    {
        id: 'extension',
        title: 'Tanulj bárhol a neten',
        subtitle:
            'A Chrome bővítmény bármely oldalon, YouTube-on és Netflixen is működik.',
        Visual: ExtensionVisual,
        features: [
            {
                Icon: MousePointerClick,
                title: 'Dupla kattintás + tartás',
                desc: 'Bármely oldalon dupla kattints egy szóra és tartsd nyomva: jön a jelentés, a kiejtés és a státusz gombok — és egy kattintással tanulókártyát is készíthetsz belőle.',
            },
            {
                Icon: Keyboard,
                title: 'Gyorsbillentyűs kereső',
                desc: 'Option+W (Mac) / Alt+W vagy Ctrl+Shift+F: bárhol felugrik a kereső — gépeld be a szót, és ott a jelentése.',
            },
            {
                Icon: TextSelect,
                title: 'Kifejezések Shift-tel',
                desc: 'Shift + kattintás több szóra egész kifejezést jelöl ki, a Shift elengedésekor pedig megjelenik a fordítása.',
            },
            {
                Icon: Highlighter,
                title: 'Kiemelés az oldalon',
                desc: 'Bekapcsolva a bővítmény olvasás közben kiemeli a szavaidat — a linkeket, gombokat és beviteli mezőket szándékosan kihagyja.',
            },
            {
                Icon: ScanText,
                title: 'Oldal elemzése és statisztikája',
                desc: 'A bővítmény ikonjára kattintva egy gombbal átküldheted az oldalt a szövegelemzőbe, vagy helyben megnézheted, hány szót ismersz belőle. Jobb klikkel is megy.',
            },
            {
                Icon: Youtube,
                title: 'YouTube és Netflix feliratok',
                desc: 'A felirat szavai kattinthatóvá válnak nézés közben: jelentés és státusz egy koppintásra. YouTube-on a teljes átiratot is átfuthatod.',
            },
        ],
    },
];

export default function Onboarding({
    wordsByLevel,
    levelTotals,
    testEnabled = true,
}: Props) {
    const { appearance, updateAppearance } = useAppearance();
    const levels = Object.keys(wordsByLevel)
        .map(Number)
        .sort((a, b) => a - b);
    const allWords = levels.flatMap((l) => wordsByLevel[l]);

    const [step, setStep] = useState<Step>(
        testEnabled ? 'ask-test' : 'features',
    );
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [knownIds, setKnownIds] = useState<Set<number>>(new Set());
    const [applyResults, setApplyResults] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [featureSlide, setFeatureSlide] = useState(0);

    const currentLevel = levels[currentLevelIndex];
    const currentWords = currentLevel ? wordsByLevel[currentLevel] : [];
    const isLastLevel = currentLevelIndex === levels.length - 1;

    const toggleWord = (id: number) => {
        setKnownIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    const knownByLevel = (level: number) =>
        (wordsByLevel[level] ?? []).filter((w) => knownIds.has(w.id)).length;

    const totalKnown = knownIds.size;
    const totalWords = allWords.length;

    // Find the first level where you know < 80% → that's where to start
    const recommendedLevel = (() => {
        for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const total = wordsByLevel[lvl]?.length ?? 0;

            if (total === 0) {
                continue;
            }

            const ratio = knownByLevel(lvl) / total;

            if (ratio < 0.8) {
                return lvl;
            }
        }

        return Math.min((levels[levels.length - 1] ?? 1) + 1, 6);
    })();

    const allShownIds = levels.flatMap((l) =>
        (wordsByLevel[l] ?? []).map((w) => w.id),
    );

    const doSubmit = (known: number[], shown: number[]) => {
        setSubmitting(true);
        router.visit(onboardingComplete().url, {
            method: 'post',
            data: { known_word_ids: known, shown_word_ids: shown },
            onFinish: () => setSubmitting(false),
        });
    };

    const submit = () =>
        doSubmit(
            applyResults ? Array.from(knownIds) : [],
            applyResults ? allShownIds : [],
        );

    return (
        <>
            <Head title="Beállítás" />

            <div className="flex min-h-screen items-center justify-center bg-background p-4">
                <div className="w-full max-w-2xl">
                    {/* STEP: ask-test */}
                    {step === 'ask-test' && (
                        <div className="text-center">
                            <div className="mb-6 flex justify-center">
                                <div className="rounded-2xl bg-primary/10 p-5">
                                    <BookOpen className="size-10 text-primary" />
                                </div>
                            </div>
                            <h1 className="mb-2 text-3xl font-bold tracking-tight">
                                Üdvözlünk a TopWords-ben!
                            </h1>
                            <p className="mb-3 text-muted-foreground">
                                Az app a 10 000 leggyakoribb angol szó köré
                                épül: szólista, flashcard ismétlés és
                                szövegelemzés segít, hogy a passzív tudásodból
                                aktív szókincs legyen.
                            </p>
                            <p className="mb-8 text-muted-foreground">
                                Kezdésnek csinálunk egy{' '}
                                <span className="font-medium text-foreground">
                                    gyors szintfelmérőt
                                </span>{' '}
                                (kb. 2 perc): szintenként mutatunk szavakat, te
                                megjelölöd, amelyeket ismersz — az app pedig
                                ehhez igazítja magát, így nem az „a", „the",
                                „and" szavaknál kell kezdened.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setStep('test')}
                                    className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-4 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                                >
                                    Igen, csináljuk meg
                                </button>
                                <button
                                    onClick={() => {
                                        setApplyResults(false);
                                        setStep('features');
                                    }}
                                    className="w-full rounded-xl border px-6 py-4 font-medium text-muted-foreground transition-colors hover:bg-accent"
                                >
                                    Kihagyom, kezdem az elejéről
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: test */}
                    {step === 'test' && (
                        <div>
                            <div className="mb-6">
                                <div className="mb-1 flex items-center justify-between">
                                    <span
                                        className={`text-sm font-semibold ${LEVEL_LABELS[currentLevel]?.color}`}
                                    >
                                        {currentLevelIndex + 1}. szint –{' '}
                                        {LEVEL_LABELS[currentLevel]?.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {currentLevelIndex + 1} /{' '}
                                        {levels.length}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-secondary">
                                    <div
                                        className="h-1.5 rounded-full bg-green-500 transition-all"
                                        style={{
                                            width: `${(currentLevelIndex / levels.length) * 100}%`,
                                        }}
                                    />
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Jelöld meg azokat a szavakat, amelyeket
                                    ismersz.
                                </p>
                            </div>

                            <div className="mb-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                {currentWords.map((word) => {
                                    const isKnown = knownIds.has(word.id);

                                    return (
                                        <button
                                            key={word.id}
                                            type="button"
                                            onClick={() => toggleWord(word.id)}
                                            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                                                isKnown
                                                    ? 'border-green-400 bg-green-50 dark:border-green-700 dark:bg-green-950/30'
                                                    : 'border-border bg-card hover:border-muted-foreground/40'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">
                                                    {word.word}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {word.meaning_hu}
                                                </p>
                                            </div>
                                            {isKnown ? (
                                                <CheckCircle2 className="ml-2 size-4 shrink-0 text-green-500" />
                                            ) : (
                                                <Circle className="ml-2 size-4 shrink-0 text-muted-foreground/30" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="sticky bottom-4">
                                <button
                                    onClick={() => {
                                        if (isLastLevel) {
                                            setStep('result');
                                        } else {
                                            setCurrentLevelIndex((i) => i + 1);
                                            window.scrollTo({
                                                top: 0,
                                                behavior: 'smooth',
                                            });
                                        }
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-3.5 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                                >
                                    {isLastLevel
                                        ? 'Eredmény megtekintése'
                                        : 'Következő szint'}
                                    <ChevronRight className="size-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: result */}
                    {step === 'result' && (
                        <div>
                            <div className="mb-6 text-center">
                                <div className="mb-4 flex justify-center">
                                    <div className="rounded-2xl bg-yellow-50 p-5 dark:bg-yellow-950/30">
                                        <Trophy className="size-10 text-yellow-500" />
                                    </div>
                                </div>
                                <h2 className="mb-1 text-2xl font-bold">
                                    Az eredményed
                                </h2>
                                <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                        {totalKnown}
                                    </span>{' '}
                                    szót ismertél a {totalWords}-ből
                                </p>
                            </div>

                            <div className="mb-6 grid gap-2">
                                {levels.map((lvl) => {
                                    const info = LEVEL_LABELS[lvl];
                                    const tested =
                                        wordsByLevel[lvl]?.length ?? 0;
                                    const known = knownByLevel(lvl);
                                    const ratio =
                                        tested > 0 ? known / tested : 0;
                                    const totalInLevel = levelTotals[lvl] ?? 0;
                                    const estimated = Math.round(
                                        ratio * totalInLevel,
                                    );

                                    return (
                                        <div
                                            key={lvl}
                                            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${info.bg} ${info.border}`}
                                        >
                                            <div>
                                                <span
                                                    className={`font-medium ${info.color}`}
                                                >
                                                    {info.label}
                                                </span>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {known} / {tested} tesztszó
                                                    → ~
                                                    {estimated.toLocaleString()}{' '}
                                                    szó kerül bejelölésre
                                                </p>
                                            </div>
                                            <span
                                                className={`text-sm font-semibold ${info.color}`}
                                            >
                                                {Math.round(ratio * 100)}%
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div
                                className={`mb-6 rounded-xl border p-4 ${LEVEL_LABELS[recommendedLevel]?.bg ?? ''} ${LEVEL_LABELS[recommendedLevel]?.border ?? ''}`}
                            >
                                <div className="mb-1 flex items-center gap-2">
                                    <Sparkles className="size-4 text-yellow-500" />
                                    <span className="font-semibold">
                                        Javasolt szint
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Az eredményed alapján a{' '}
                                    <span
                                        className={`font-semibold ${LEVEL_LABELS[recommendedLevel]?.color}`}
                                    >
                                        {LEVEL_LABELS[recommendedLevel]?.label}
                                    </span>{' '}
                                    szint ajánlott a folytatáshoz.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setApplyResults(true);
                                        setStep('features');
                                    }}
                                    className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-4 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                                >
                                    Érvényesítem – az ismert szavak bejelölve
                                    lesznek
                                </button>
                                <button
                                    onClick={() => {
                                        setApplyResults(false);
                                        setStep('features');
                                    }}
                                    className="w-full rounded-xl border px-6 py-4 font-medium text-muted-foreground transition-colors hover:bg-accent"
                                >
                                    Kezdem az elejéről – inkább mindent nulláról
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP: features */}
                    {step === 'features' &&
                        (() => {
                            const slide = FEATURE_SLIDES[featureSlide];
                            const SlideVisual = slide.Visual;
                            const isLastSlide =
                                featureSlide === FEATURE_SLIDES.length - 1;

                            return (
                                <div>
                                    {/* Progress dots */}
                                    <div className="mb-5 flex items-center justify-center gap-2">
                                        {FEATURE_SLIDES.map((s, i) => (
                                            <span
                                                key={s.id}
                                                className={`h-1.5 rounded-full transition-all ${
                                                    i === featureSlide
                                                        ? 'w-6 bg-green-500'
                                                        : i < featureSlide
                                                          ? 'w-1.5 bg-green-500/50'
                                                          : 'w-1.5 bg-secondary'
                                                }`}
                                            />
                                        ))}
                                    </div>

                                    {/* Visual mockup */}
                                    <div className="mb-5">
                                        <SlideVisual />
                                    </div>

                                    <div className="mb-4 text-center">
                                        <h2 className="mb-1 text-2xl font-bold">
                                            {slide.title}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {slide.subtitle}
                                        </p>
                                    </div>

                                    {/* Egyetlen funkciónál ne maradjon üres féloszlop. */}
                                    <div
                                        className={`mb-6 grid gap-3 ${slide.features.length > 1 ? 'sm:grid-cols-2' : ''}`}
                                    >
                                        {slide.features.map(
                                            ({ Icon, title, desc, ai }) => (
                                                <div
                                                    key={title}
                                                    className="relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                                                >
                                                    {/* Halvány sarok-fény az onboarding zöld akcentusából. */}
                                                    <div
                                                        aria-hidden="true"
                                                        className="pointer-events-none absolute -top-10 -right-10 size-24 rounded-full bg-green-500/15 blur-2xl"
                                                    />
                                                    <div className="relative mb-2 flex items-center gap-2.5">
                                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary/20 to-primary/5 ring-1 ring-primary/15">
                                                            <Icon className="size-4.5 text-primary" />
                                                        </div>
                                                        <p className="text-sm font-semibold">
                                                            {title}
                                                        </p>
                                                        {ai && (
                                                            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-indigo-700 uppercase dark:bg-indigo-950/50 dark:text-indigo-300">
                                                                <Sparkles className="size-2.5" />
                                                                AI
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="relative text-xs leading-relaxed text-muted-foreground">
                                                        {desc}
                                                    </p>
                                                </div>
                                            ),
                                        )}
                                    </div>

                                    {/*
                                     * A „player" dia letöltő gombjai kivezetve (2026-07-29)
                                     * a diával együtt — a letöltés `can:admin` mögé került.
                                     * Visszahozáskor a FEATURE_SLIDES player-diájával együtt
                                     * élesítendő (showDownload + Download import is kell).
                                     */}

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFeatureSlide((i) => i - 1);
                                                window.scrollTo({
                                                    top: 0,
                                                    behavior: 'smooth',
                                                });
                                            }}
                                            disabled={featureSlide === 0}
                                            className="flex items-center justify-center gap-1.5 rounded-xl border px-5 py-3.5 font-medium text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                                        >
                                            <ChevronLeft className="size-4" />
                                            Vissza
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isLastSlide) {
                                                    setStep('theme');
                                                } else {
                                                    setFeatureSlide(
                                                        (i) => i + 1,
                                                    );
                                                }

                                                window.scrollTo({
                                                    top: 0,
                                                    behavior: 'smooth',
                                                });
                                            }}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-3.5 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                                        >
                                            {isLastSlide
                                                ? 'Tovább a témához'
                                                : 'Következő'}
                                            <ChevronRight className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}

                    {/* STEP: theme */}
                    {step === 'theme' && (
                        <div className="text-center">
                            <div className="mb-6 flex justify-center">
                                <div className="rounded-2xl bg-primary/10 p-5">
                                    <Sun className="size-10 text-primary" />
                                </div>
                            </div>
                            <h2 className="mb-2 text-2xl font-bold">
                                Szín téma
                            </h2>
                            <p className="mb-8 text-muted-foreground">
                                Milyen megjelenést szeretnél?
                            </p>

                            <div className="mb-8 grid grid-cols-3 gap-3">
                                {(
                                    [
                                        {
                                            value: 'light' as Appearance,
                                            icon: Sun,
                                            label: 'Világos',
                                        },
                                        {
                                            value: 'dark' as Appearance,
                                            icon: Moon,
                                            label: 'Sötét',
                                        },
                                        {
                                            value: 'system' as Appearance,
                                            icon: Monitor,
                                            label: 'Rendszer',
                                        },
                                    ] as const
                                ).map(({ value, icon: Icon, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => updateAppearance(value)}
                                        className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${
                                            appearance === value
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-muted-foreground/40'
                                        }`}
                                    >
                                        <Icon
                                            className={`size-6 ${appearance === value ? 'text-primary' : 'text-muted-foreground'}`}
                                        />
                                        <span
                                            className={`text-sm font-medium ${appearance === value ? 'text-primary' : 'text-muted-foreground'}`}
                                        >
                                            {label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={submit}
                                disabled={submitting}
                                className="w-full rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-4 font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75 disabled:opacity-50"
                            >
                                {submitting ? 'Mentés...' : 'Kezdjük el →'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
