import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    ChevronRight,
    RotateCcw,
    Search,
    Trophy,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { csrfHeaders } from '@/lib/csrf';
import { pricing } from '@/routes';
import { quiz as quizRoute, index as wordsIndex } from '@/routes/words';
import { complete as quizComplete } from '@/routes/words/quiz';

interface QuizWord {
    id: number;
    word: string;
    meaning_hu: string;
    part_of_speech: string | null;
    form_base: string | null;
    verb_past: string | null;
    verb_past_participle: string | null;
    verb_present_participle: string | null;
    verb_third_person: string | null;
    is_irregular: number | null;
    noun_plural: string | null;
    adj_comparative: string | null;
    adj_superlative: string | null;
    example_en: string | null;
    example_hu: string | null;
    synonyms: string | null;
    rank: number | null;
    status: string | null;
    options: string[];
}

interface SelectableWord {
    id: number | string;
    word: string;
    meaning_hu: string | null;
    rank: number | null;
    status: string | null;
    is_custom: boolean;
}

interface Folder {
    id: number;
    name: string;
    words_count: number;
}

interface Filters {
    status: string;
    level: number | null;
    folder: number | null;
    count: number;
    ids: string;
}

interface Props {
    words: QuizWord[];
    available: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
    freeQuizLimit: number | null;
}

const STATUS_LABELS: Record<string, string> = {
    learning: 'Tanulom',
    saved: 'Később',
    known: 'Tudom',
    pronunciation: 'Kiejtés',
    practice: 'Gyakorlásra',
    marked: 'Minden jelölt',
    '': 'Összes szó',
};

const LEVEL_LABELS: Array<{ value: number | null; label: string }> = [
    { value: null, label: 'Minden szint' },
    { value: 1, label: 'Top 1 000' },
    { value: 2, label: '1 001 – 2 000' },
    { value: 3, label: '2 001 – 4 000' },
    { value: 4, label: '4 001 – 6 000' },
    { value: 5, label: '6 001 – 8 000' },
    { value: 6, label: '8 001 – 10 000' },
];

const FILTER_OPTION_CLASS = (active: boolean) =>
    `rounded-xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
        active
            ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
            : 'border-border bg-background hover:bg-muted'
    }`;

type AnswerState = 'unanswered' | 'correct' | 'wrong';

export default function Quiz({
    words,
    available,
    folders,
    filters,
    selectableWords,
    freeQuizLimit,
}: Props) {
    const [current, setCurrent] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
    const [score, setScore] = useState(0);
    const [wrongAnswers, setWrongAnswers] = useState<QuizWord[]>([]);
    const [finished, setFinished] = useState(false);

    // Új kvíz (új words prop) érkezésekor visszaállítjuk az állapotot — különben
    // az Inertia újrahasználja a komponenst, és a régi current/answerState/finished
    // beragadna.
    useEffect(() => {
        setCurrent(0);
        setSelected(null);
        setAnswerState('unanswered');
        setScore(0);
        setWrongAnswers([]);
        setFinished(false);
    }, [words]);

    const isSetup =
        words.length === 0 && filters.count === 0 && filters.ids === '';
    const isEmpty =
        words.length === 0 && (filters.count > 0 || filters.ids !== '');

    const card = words[current] ?? null;
    const answered = current + (answerState !== 'unanswered' ? 1 : 0);
    const progress = words.length > 0 ? (answered / words.length) * 100 : 0;

    function startQuiz(
        status: string,
        level: number | null,
        folder: number | null,
        count: number,
    ) {
        router.get(
            quizRoute(),
            {
                status,
                ...(level ? { level } : {}),
                ...(folder ? { folder } : {}),
                count,
            },
            { preserveScroll: false },
        );
    }

    function startQuizWithIds(ids: string) {
        router.get(
            quizRoute(),
            {
                status: filters.status,
                ...(filters.level ? { level: filters.level } : {}),
                ...(filters.folder ? { folder: filters.folder } : {}),
                ids,
            },
            { preserveScroll: false },
        );
    }

    function handleAnswer(option: string) {
        if (answerState !== 'unanswered' || !card) {
            return;
        }

        setSelected(option);
        const correct = option === card.meaning_hu;
        setAnswerState(correct ? 'correct' : 'wrong');

        if (correct) {
            setScore((s) => s + 1);
        } else {
            setWrongAnswers((w) => [...w, card]);
        }
    }

    async function submitQuizComplete(perfect: boolean) {
        const res = await fetch(quizComplete().url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...csrfHeaders(),
            },
            body: JSON.stringify({ perfect }),
        }).catch(() => null);

        if (res) {
            const data = await res.json().catch(() => ({}));

            if (
                Array.isArray(data.achievements) &&
                data.achievements.length > 0
            ) {
                window.dispatchEvent(
                    new CustomEvent('achievements-unlocked', {
                        detail: data.achievements,
                    }),
                );
            }
        }
    }

    function handleNext() {
        if (current + 1 >= words.length) {
            submitQuizComplete(
                wrongAnswers.length === 0 && answerState === 'correct',
            );
            setFinished(true);
        } else {
            setCurrent((c) => c + 1);
            setSelected(null);
            setAnswerState('unanswered');
        }
    }

    function restart() {
        setCurrent(0);
        setSelected(null);
        setAnswerState('unanswered');
        setScore(0);
        setWrongAnswers([]);
        setFinished(false);

        if (filters.ids !== '') {
            startQuizWithIds(filters.ids);
        } else {
            startQuiz(
                filters.status,
                filters.level,
                filters.folder,
                filters.count,
            );
        }
    }

    // ── Empty screen ─────────────────────────────────────────────────────────
    if (isEmpty) {
        return (
            <>
                <Head title="Kvíz" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                        <Search className="size-7 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">
                        Nincs elérhető szó ezzel a szűrővel.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Jelölj meg szavakat a listában, majd próbáld újra.
                    </p>
                    <div className="mt-2 flex gap-3">
                        <Button variant="outline" asChild>
                            <Link href={quizRoute()}>Más szűrő</Link>
                        </Button>
                        <Button asChild>
                            <Link href={wordsIndex()}>Szavak listája</Link>
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // ── Setup screen ─────────────────────────────────────────────────────────
    if (isSetup) {
        return (
            <QuizSetup
                available={available}
                folders={folders}
                filters={filters}
                selectableWords={selectableWords}
                freeQuizLimit={freeQuizLimit}
                onStart={startQuiz}
                onStartWithIds={startQuizWithIds}
            />
        );
    }

    // ── Finished screen ───────────────────────────────────────────────────────
    if (finished) {
        const percent = Math.round((score / words.length) * 100);

        return (
            <>
                <Head title="Kvíz – eredmény" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
                    <div
                        className={`mb-6 flex size-20 items-center justify-center rounded-full ${
                            percent >= 80
                                ? 'bg-amber-100 dark:bg-amber-950/30'
                                : 'bg-muted'
                        }`}
                    >
                        <Trophy
                            className={`size-10 ${percent >= 80 ? 'text-amber-500' : 'text-muted-foreground'}`}
                        />
                    </div>
                    <div className="mb-4 text-6xl font-bold tabular-nums">
                        {score}
                        <span className="text-2xl text-muted-foreground">
                            /{words.length}
                        </span>
                    </div>
                    <div className="mb-2 text-2xl font-bold">
                        {percent >= 80
                            ? 'Kiváló!'
                            : percent >= 50
                              ? 'Jó munka!'
                              : 'Gyakorolj tovább!'}
                    </div>
                    <p className="mb-10 text-muted-foreground">
                        {percent}% helyes válasz
                    </p>

                    {wrongAnswers.length > 0 && (
                        <div className="mb-10 w-full max-w-md text-left">
                            <p className="mb-3 text-sm font-semibold text-muted-foreground">
                                Hibás válaszok:
                            </p>
                            <div className="flex flex-col gap-2">
                                {wrongAnswers.map((w) => (
                                    <div
                                        key={w.id}
                                        className="flex items-baseline gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm"
                                    >
                                        <span className="font-semibold">
                                            {w.word}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            — {w.meaning_hu}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button onClick={restart}>
                            <RotateCcw className="size-4" />
                            Újra
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href={quizRoute()}>Új kvíz beállítása</Link>
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href={wordsIndex()}>
                                <ArrowLeft className="size-4" />
                                Vissza a szavakhoz
                            </Link>
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // Vissza-navigációnál az Inertia a régi state-tel rendereli újra a komponenst:
    // rövidebb words listánál a beragadt current index kifuthat a tartományból,
    // mielőtt a fenti reset-effect lefutna. Ilyenkor nincs kártya — egy üres
    // képkocka a fehér képernyős TypeError helyett; a reset-effect helyreállít.
    if (!card) {
        return null;
    }

    const OPTION_LABELS = ['A', 'B', 'C', 'D'];

    // ── Quiz screen ───────────────────────────────────────────────────────────
    return (
        <>
            <Head title={`Kvíz – ${current + 1}/${words.length}`} />

            <div className="flex min-h-dvh flex-col">
                {/* Violet header with word */}
                <div className="relative overflow-hidden bg-amber-400 px-4 pt-5 pb-10">
                    <div className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-white/10" />

                    {/* Header row */}
                    <div className="relative mx-auto flex max-w-xl items-center justify-between">
                        <Link
                            href={quizRoute()}
                            className="flex items-center gap-1 text-sm font-medium text-white/80 transition-colors hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            Kilépés
                        </Link>
                        <span className="text-sm font-medium text-white/80 tabular-nums">
                            {current + 1} / {words.length}
                        </span>
                        <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white tabular-nums">
                            {score} pont
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative mx-auto mt-4 max-w-xl">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/25">
                            <div
                                className="h-full rounded-full bg-white transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Word */}
                    <div className="relative mx-auto mt-8 max-w-xl pb-4 text-center">
                        {card.rank !== null && (
                            <span className="mb-3 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white/90">
                                #{card.rank}
                            </span>
                        )}
                        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                            {card.word}
                        </h2>
                        <p className="mt-3 text-sm text-white/75">
                            Mi a magyar jelentése?
                        </p>
                    </div>
                </div>

                {/* Content area */}
                <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
                    {/* Options */}
                    <div className="grid grid-cols-1 gap-3">
                        {card.options.map((option, i) => {
                            const isCorrect = option === card.meaning_hu;
                            const isSelected = option === selected;

                            return (
                                <button
                                    key={i}
                                    onClick={() => handleAnswer(option)}
                                    disabled={answerState !== 'unanswered'}
                                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${
                                        answerState === 'unanswered'
                                            ? 'cursor-pointer border-border bg-card shadow-[0_3px_0_0_var(--color-secondary-shade)] hover:border-amber-400 hover:bg-amber-50/60 active:translate-y-0.5 active:shadow-[0_1px_0_0_var(--color-secondary-shade)] dark:hover:bg-amber-950/20'
                                            : isCorrect
                                              ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                                              : isSelected
                                                ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                                                : 'border-border bg-card opacity-40'
                                    }`}
                                >
                                    <span
                                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                                            answerState === 'unanswered'
                                                ? 'bg-muted text-muted-foreground'
                                                : isCorrect
                                                  ? 'bg-green-500 text-white'
                                                  : isSelected
                                                    ? 'bg-red-500 text-white'
                                                    : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        {answerState !== 'unanswered' &&
                                        isCorrect ? (
                                            <Check className="size-3.5" />
                                        ) : answerState !== 'unanswered' &&
                                          isSelected ? (
                                            <X className="size-3.5" />
                                        ) : (
                                            OPTION_LABELS[i]
                                        )}
                                    </span>
                                    <span
                                        className={`text-sm font-semibold ${
                                            answerState !== 'unanswered' &&
                                            isCorrect
                                                ? 'text-green-800 dark:text-green-300'
                                                : answerState !==
                                                        'unanswered' &&
                                                    isSelected
                                                  ? 'text-red-800 dark:text-red-300'
                                                  : ''
                                        }`}
                                    >
                                        {option}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Extra info after answer */}
                    {answerState !== 'unanswered' && (
                        <div className="animate-in space-y-3 rounded-3xl bg-accent/60 p-5 text-sm duration-200 fade-in slide-in-from-bottom-2">
                            {/* Igealakok */}
                            {card.part_of_speech === 'verb' &&
                                card.verb_past && (
                                    <div>
                                        <div className="mb-1.5 flex items-center gap-2">
                                            <span className="font-semibold">
                                                Igealakok
                                            </span>
                                            {card.is_irregular === 1 && (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    rendhagyó
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                            <span className="text-muted-foreground">
                                                Alap
                                            </span>
                                            <span className="font-medium">
                                                {card.form_base}
                                            </span>
                                            <span className="text-muted-foreground">
                                                Múlt idő
                                            </span>
                                            <span className="font-medium">
                                                {card.verb_past}
                                            </span>
                                            <span className="text-muted-foreground">
                                                Befejezett igenév
                                            </span>
                                            <span className="font-medium">
                                                {card.verb_past_participle}
                                            </span>
                                            <span className="text-muted-foreground">
                                                Folyamatos (-ing)
                                            </span>
                                            <span className="font-medium">
                                                {card.verb_present_participle}
                                            </span>
                                            <span className="text-muted-foreground">
                                                E/3 jelen
                                            </span>
                                            <span className="font-medium">
                                                {card.verb_third_person}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            {/* Többes szám */}
                            {card.part_of_speech === 'noun' &&
                                card.noun_plural && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                            Többes szám:
                                        </span>
                                        <span className="font-medium">
                                            {card.noun_plural}
                                        </span>
                                    </div>
                                )}
                            {/* Fokozás */}
                            {card.part_of_speech === 'adj' &&
                                card.adj_comparative && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <span className="text-muted-foreground">
                                            Középfok
                                        </span>
                                        <span className="font-medium">
                                            {card.adj_comparative}
                                        </span>
                                        <span className="text-muted-foreground">
                                            Felsőfok
                                        </span>
                                        <span className="font-medium">
                                            {card.adj_superlative}
                                        </span>
                                    </div>
                                )}
                            {/* Szinonimák */}
                            {card.synonyms && (
                                <p className="text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                        Szinonimák:
                                    </span>{' '}
                                    {card.synonyms}
                                </p>
                            )}
                            {/* Példamondat */}
                            {card.example_en && (
                                <div>
                                    <p className="italic">
                                        "{card.example_en}"
                                    </p>
                                    {card.example_hu && (
                                        <p className="text-muted-foreground">
                                            "{card.example_hu}"
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Next button */}
                    {answerState !== 'unanswered' && (
                        <div className="sticky bottom-4 mt-auto pt-2">
                            <Button
                                size="lg"
                                onClick={handleNext}
                                className="w-full"
                            >
                                {current + 1 >= words.length
                                    ? 'Eredmény megtekintése'
                                    : 'Következő'}
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// ── Setup component ───────────────────────────────────────────────────────────
function QuizSetup({
    available,
    folders,
    filters,
    selectableWords,
    freeQuizLimit,
    onStart,
    onStartWithIds,
}: {
    available: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
    freeQuizLimit: number | null;
    onStart: (
        status: string,
        level: number | null,
        folder: number | null,
        count: number,
    ) => void;
    onStartWithIds: (ids: string) => void;
}) {
    const [count, setCount] = useState(10);
    const [search, setSearch] = useState('');
    const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());

    function updateFilter(params: Partial<Omit<Filters, 'count'>>) {
        const next = { ...filters, ...params };
        setPickedIds(new Set());
        setSearch('');
        router.get(
            quizRoute(),
            {
                status: next.status,
                ...(next.level ? { level: next.level } : {}),
                ...(next.folder ? { folder: next.folder } : {}),
                count: 0,
            },
            {
                only: ['available', 'filters', 'selectableWords'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    }

    const status = filters.status;
    const level = filters.level;
    const folder = filters.folder;

    const q = search.toLowerCase();
    const filteredWords = selectableWords.filter(
        (w) =>
            q === '' ||
            w.word.toLowerCase().includes(q) ||
            (w.meaning_hu ?? '').toLowerCase().includes(q),
    );

    const allFilteredPicked =
        filteredWords.length > 0 &&
        filteredWords.every((w) => pickedIds.has(String(w.id)));

    function toggleWord(id: string) {
        setPickedIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }

    function toggleAll() {
        setPickedIds((prev) => {
            const next = new Set(prev);

            if (allFilteredPicked) {
                filteredWords.forEach((w) => next.delete(String(w.id)));
            } else {
                filteredWords.forEach((w) => next.add(String(w.id)));
            }

            return next;
        });
    }

    return (
        <>
            <Head title="Kvíz beállítása" />

            <div className="space-y-6 px-4 py-6">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-amber-400 p-6 md:p-8">
                    <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-32 -bottom-20 size-40 rounded-full bg-white/10" />
                    <div className="relative max-w-xl">
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            Kvíz
                        </h1>
                        <p className="mt-1.5 text-sm text-white/85 md:text-base">
                            Teszteld a szókincsedet! Válaszd ki, melyik
                            szavakból és hányból kvízzeljünk.
                        </p>
                    </div>
                </div>

                <div
                    className={`grid gap-6 ${folders.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
                >
                    {/* Folder filter */}
                    {folders.length > 0 && (
                        <div className="rounded-3xl bg-card p-5 shadow-sm">
                            <p className="mb-3 text-sm font-semibold">Mappa</p>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() =>
                                        updateFilter({ folder: null })
                                    }
                                    className={FILTER_OPTION_CLASS(
                                        folder === null,
                                    )}
                                >
                                    Összes mappa
                                </button>
                                {folders.map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() =>
                                            updateFilter({ folder: f.id })
                                        }
                                        className={`flex items-center justify-between ${FILTER_OPTION_CLASS(folder === f.id)}`}
                                    >
                                        <span className="truncate">
                                            {f.name}
                                        </span>
                                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                            {f.words_count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status filter */}
                    <div className="rounded-3xl bg-card p-5 shadow-sm">
                        <p className="mb-3 text-sm font-semibold">
                            Melyik szavakból?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(STATUS_LABELS).map(
                                ([value, label]) => (
                                    <button
                                        key={value}
                                        onClick={() =>
                                            updateFilter({ status: value })
                                        }
                                        className={FILTER_OPTION_CLASS(
                                            status === value,
                                        )}
                                    >
                                        {label}
                                    </button>
                                ),
                            )}
                        </div>
                    </div>

                    {/* Level filter */}
                    <div className="rounded-3xl bg-card p-5 shadow-sm">
                        <p className="mb-3 text-sm font-semibold">Szint</p>
                        <div className="grid grid-cols-2 gap-2">
                            {LEVEL_LABELS.map(({ value, label }) => (
                                <button
                                    key={value ?? 'all'}
                                    onClick={() =>
                                        updateFilter({ level: value })
                                    }
                                    className={`${value === null ? 'col-span-2' : ''} ${FILTER_OPTION_CLASS(level === value)}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Count + Start */}
                    <div className="rounded-3xl bg-card p-5 shadow-sm">
                        <p className="mb-3 text-sm font-semibold">
                            Hány szó?{' '}
                            <span className="font-normal text-muted-foreground">
                                ({available} elérhető)
                            </span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[10, 20, 50].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setCount(n)}
                                    disabled={
                                        available < n ||
                                        (freeQuizLimit !== null &&
                                            n > freeQuizLimit)
                                    }
                                    className={`text-center disabled:cursor-not-allowed disabled:opacity-40 ${FILTER_OPTION_CLASS(count === n)}`}
                                >
                                    {n}
                                </button>
                            ))}
                            {available <= 500 && (
                                <button
                                    onClick={() => setCount(500)}
                                    disabled={
                                        freeQuizLimit !== null &&
                                        available > freeQuizLimit
                                    }
                                    className={`col-span-2 text-center disabled:cursor-not-allowed disabled:opacity-40 ${FILTER_OPTION_CLASS(count === 500)}`}
                                >
                                    Összes ({available})
                                </button>
                            )}
                        </div>

                        {freeQuizLimit !== null && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Alap csomaggal legfeljebb {freeQuizLimit} szavas
                                kvíz indítható.{' '}
                                <Link
                                    href={pricing()}
                                    className="font-medium text-primary underline underline-offset-2"
                                >
                                    Váltás prémiumra
                                </Link>
                            </p>
                        )}

                        <Button
                            size="lg"
                            className="mt-4 w-full"
                            disabled={pickedIds.size > 0}
                            onClick={() =>
                                onStart(status, level, folder, count)
                            }
                        >
                            Kvíz indítása
                        </Button>
                    </div>
                </div>

                {/* Selectable word list */}
                {selectableWords.length > 0 && (
                    <div className="rounded-3xl bg-card p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold">
                                    Szavak kiválasztása (opcionális)
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Ha kiválasztasz szavakat, a kvíz csak
                                    azokból fog dolgozni.
                                </p>
                            </div>
                            {pickedIds.size > 0 && (
                                <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                    {pickedIds.size} kiválasztva
                                </span>
                            )}
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Keresés..."
                                    className="pl-9"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleAll}
                            >
                                {allFilteredPicked ? 'Mind ki' : 'Mind be'}
                            </Button>
                        </div>

                        <div className="max-h-72 divide-y overflow-y-auto rounded-xl border">
                            {filteredWords.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    Nincs találat
                                </p>
                            ) : (
                                filteredWords.map((w) => {
                                    const id = String(w.id);
                                    const picked = pickedIds.has(id);

                                    return (
                                        <button
                                            key={id}
                                            onClick={() => toggleWord(id)}
                                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                                picked
                                                    ? 'bg-primary/5'
                                                    : 'hover:bg-muted'
                                            }`}
                                        >
                                            <span
                                                className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${picked ? 'border-primary bg-primary' : 'border-input bg-background'}`}
                                            >
                                                {picked && (
                                                    <Check className="size-3 text-primary-foreground" />
                                                )}
                                            </span>
                                            <span className="flex-1 font-medium">
                                                {w.word}
                                            </span>
                                            {w.meaning_hu && (
                                                <span className="max-w-48 truncate text-xs text-muted-foreground">
                                                    {w.meaning_hu}
                                                </span>
                                            )}
                                            {w.rank && (
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    #{w.rank}
                                                </span>
                                            )}
                                            {w.is_custom && (
                                                <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                                    saját
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {pickedIds.size > 0 && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPickedIds(new Set())}
                                >
                                    Kijelölés törlése
                                </Button>
                                <div className="flex flex-col items-end gap-1.5">
                                    {freeQuizLimit !== null &&
                                        pickedIds.size > freeQuizLimit && (
                                            <p className="text-xs text-muted-foreground">
                                                Alap csomaggal legfeljebb{' '}
                                                {freeQuizLimit} szót
                                                választhatsz ki.
                                            </p>
                                        )}
                                    <Button
                                        size="lg"
                                        disabled={
                                            freeQuizLimit !== null &&
                                            pickedIds.size > freeQuizLimit
                                        }
                                        onClick={() =>
                                            onStartWithIds(
                                                Array.from(pickedIds).join(','),
                                            )
                                        }
                                    >
                                        Kvíz indítása ({pickedIds.size} szóval)
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

Quiz.layout = {
    breadcrumbs: [
        { title: 'Top 10 000 szó', href: wordsIndex() },
        { title: 'Kvíz', href: quizRoute() },
    ],
};
