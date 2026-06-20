import { Head, router } from '@inertiajs/react';
import {
    BookMarked,
    BookOpen,
    Brain,
    CheckCheck,
    CheckCircle2,
    ChevronRight,
    Circle,
    Clock,
    Flame,
    Layers,
    Mic,
    Monitor,
    Moon,
    Puzzle,
    ScanText,
    Sparkles,
    Sun,
    Trophy,
} from 'lucide-react';
import { useState } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
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
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-950/30',
        border: 'border-purple-200 dark:border-purple-800',
    },
    6: {
        label: '8 001 – 10 000',
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-800',
    },
};

type Step = 'ask-test' | 'test' | 'result' | 'features' | 'theme' | 'done';

const APP_FEATURES = [
    {
        Icon: BookOpen,
        title: 'Top 10 000 szó',
        desc: 'Gyakoriság szerint rendezett szólista szintekkel, szűrőkkel és mappákkal.',
    },
    {
        Icon: Layers,
        title: 'Flashcard (SRS)',
        desc: 'Intelligens ismétlés: a kártyák akkor jönnek elő, amikor épp felejtenéd őket.',
    },
    {
        Icon: Brain,
        title: 'Kvíz és mondatkiegészítés',
        desc: 'Teszteld magad feleletválasztóssal, vagy egészítsd ki a példamondatokat.',
    },
    {
        Icon: ScanText,
        title: 'Szövegelemzés',
        desc: 'Illessz be angol szöveget vagy könyvet, és lásd, mennyit értesz belőle.',
    },
    {
        Icon: Puzzle,
        title: 'Chrome bővítmény',
        desc: 'Szókeresés és kiemelés bármely weboldalon, YouTube felirat-támogatással.',
    },
    {
        Icon: Flame,
        title: 'Streak és teljesítmények',
        desc: 'Napi ismétlés, sorozatok és jelvények tartják fenn a motivációt.',
    },
];

const STATUS_INFO = [
    {
        Icon: CheckCheck,
        label: 'Tudom',
        desc: 'ezt már nem kell gyakorolnod',
        cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    },
    {
        Icon: Clock,
        label: 'Tanulom',
        desc: 'ezekből épülnek a gyakorlások',
        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    },
    {
        Icon: BookMarked,
        label: 'Később',
        desc: 'félreteszed, majd visszatérsz rá',
        cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    },
    {
        Icon: Mic,
        label: 'Kiejtés',
        desc: 'a jelentést tudod, a kiejtést gyakorlod',
        cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
    },
];

export default function Onboarding({ wordsByLevel, levelTotals }: Props) {
    const { appearance, updateAppearance } = useAppearance();
    const levels = Object.keys(wordsByLevel)
        .map(Number)
        .sort((a, b) => a - b);
    const allWords = levels.flatMap((l) => wordsByLevel[l]);

    const [step, setStep] = useState<Step>('ask-test');
    const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
    const [knownIds, setKnownIds] = useState<Set<number>>(new Set());
    const [applyResults, setApplyResults] = useState(true);
    const [submitting, setSubmitting] = useState(false);

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
                                épül: szólista, flashcard ismétlés, kvízek és
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
                                    className="w-full rounded-xl border-2 border-primary bg-primary px-6 py-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
                                        className="h-1.5 rounded-full bg-primary transition-all"
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
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90"
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
                                    className="w-full rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
                    {step === 'features' && (
                        <div>
                            <div className="mb-6 text-center">
                                <div className="mb-4 flex justify-center">
                                    <div className="rounded-2xl bg-primary/10 p-5">
                                        <Sparkles className="size-10 text-primary" />
                                    </div>
                                </div>
                                <h2 className="mb-1 text-2xl font-bold">
                                    Ez vár rád
                                </h2>
                                <p className="text-muted-foreground">
                                    Rövid áttekintés a fő eszközökről — mindet a
                                    menüből éred majd el.
                                </p>
                            </div>

                            <div className="mb-6 grid gap-2 sm:grid-cols-2">
                                {APP_FEATURES.map(({ Icon, title, desc }) => (
                                    <div
                                        key={title}
                                        className="rounded-xl border bg-card p-4"
                                    >
                                        <div className="mb-2 flex items-center gap-2">
                                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                                <Icon className="size-4 text-primary" />
                                            </div>
                                            <p className="text-sm font-semibold">
                                                {title}
                                            </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {desc}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mb-6 rounded-xl border bg-card p-4">
                                <p className="mb-3 text-sm font-semibold">
                                    A szavaidat négy státusszal követed
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {STATUS_INFO.map(
                                        ({ Icon, label, desc, cls }) => (
                                            <div
                                                key={label}
                                                className="flex items-center gap-2.5"
                                            >
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}
                                                >
                                                    <Icon className="size-3.5" />
                                                    {label}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {desc}
                                                </span>
                                            </div>
                                        ),
                                    )}
                                </div>
                                <p className="mt-3 text-xs text-muted-foreground">
                                    A kvíz, a mondatkiegészítés, a flashcardok
                                    és a napi ismétlés is ezekre a státuszokra
                                    épül — ezért érdemes jelölgetni.
                                </p>
                            </div>

                            <button
                                onClick={() => setStep('theme')}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                            >
                                Tovább
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                    )}

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
                                className="w-full rounded-xl bg-primary px-6 py-4 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
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
