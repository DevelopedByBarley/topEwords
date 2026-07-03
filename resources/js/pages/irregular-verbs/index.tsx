import { Head } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronRight,
    List,
    RotateCcw,
    Shuffle,
    Trophy,
    XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index as irregularVerbsRoute } from '@/routes/irregular-verbs';

interface IrregularVerb {
    id: number;
    infinitive: string;
    past_simple: string;
    past_participle: string;
    meaning_hu: string | null;
    example_en: string | null;
}

interface Props {
    verbs: IrregularVerb[];
}

type SetupMode = 'random' | 'select';
type AnswerState = 'unanswered' | 'correct' | 'wrong';

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function isCorrectAnswer(input: string, correct: string): boolean {
    const normalizedInput = normalize(input);
    const normalizedCorrect = normalize(correct);

    if (normalizedInput === normalizedCorrect) {
        return true;
    }

    return normalizedCorrect
        .split('/')
        .map((s) => s.trim())
        .includes(normalizedInput);
}

// ── Setup screen ──────────────────────────────────────────────────────────────

function SetupScreen({
    verbs,
    onStart,
}: {
    verbs: IrregularVerb[];
    onStart: (selected: IrregularVerb[]) => void;
}) {
    const [mode, setMode] = useState<SetupMode>('random');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const counts = [10, 20, 30, 50, verbs.length];
    const uniqueCounts = [...new Set(counts.filter((c) => c <= verbs.length))];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        if (!q) {
            return verbs;
        }

        return verbs.filter(
            (v) =>
                v.infinitive.toLowerCase().includes(q) ||
                v.past_simple.toLowerCase().includes(q) ||
                v.past_participle.toLowerCase().includes(q) ||
                (v.meaning_hu ?? '').toLowerCase().includes(q),
        );
    }, [verbs, search]);

    function toggleAll() {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (allFilteredSelected) {
                filtered.forEach((v) => next.delete(v.id));
            } else {
                filtered.forEach((v) => next.add(v.id));
            }

            return next;
        });
    }

    function toggle(id: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }

    function startRandom(count: number) {
        const shuffled = [...verbs]
            .sort(() => Math.random() - 0.5)
            .slice(0, count);
        onStart(shuffled);
    }

    function startSelected() {
        const selected = verbs
            .filter((v) => selectedIds.has(v.id))
            .sort(() => Math.random() - 0.5);
        onStart(selected);
    }

    const allFilteredSelected =
        filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));

    return (
        <>
            <Head title="Rendhagyó igék" />

            <div className="space-y-6 px-4 py-6">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-rose-500 p-6 md:p-8">
                    <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-32 -bottom-20 size-40 rounded-full bg-white/10" />
                    <div className="relative max-w-xl">
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            Rendhagyó igék
                        </h1>
                        <p className="mt-1.5 text-sm text-white/85 md:text-base">
                            Gépeld be a Past Simple és Past Participle alakokat
                            – {verbs.length} ige áll rendelkezésre.
                        </p>
                    </div>
                </div>

                <div className="mx-auto max-w-2xl">
                    <div className="rounded-3xl bg-card p-5 shadow-sm">
                        {verbs.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                Jelenleg nincs elérhető rendhagyó ige — nézz
                                vissza később!
                            </p>
                        ) : (
                            <>
                                {/* Mode tabs */}
                                <div className="mb-5 flex gap-2 rounded-xl bg-muted/60 p-1">
                                    <button
                                        onClick={() => setMode('random')}
                                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
                                            mode === 'random'
                                                ? 'bg-background shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <Shuffle className="size-4" />
                                        Véletlenszerű
                                    </button>
                                    <button
                                        onClick={() => setMode('select')}
                                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
                                            mode === 'select'
                                                ? 'bg-background shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <List className="size-4" />
                                        Kiválasztom
                                        {selectedIds.size > 0 && (
                                            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                                {selectedIds.size}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* Random mode */}
                                {mode === 'random' && (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-sm font-semibold">
                                            Hány igével gyakorolsz?
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {uniqueCounts.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() =>
                                                        startRandom(c)
                                                    }
                                                    className="rounded-xl border-2 border-border bg-background px-4 py-3 text-center text-sm font-semibold transition-colors hover:border-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/20"
                                                >
                                                    {c === verbs.length
                                                        ? `Mind (${c})`
                                                        : c}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Select mode */}
                                {mode === 'select' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Keresés..."
                                                value={search}
                                                onChange={(e) =>
                                                    setSearch(e.target.value)
                                                }
                                                className="flex-1"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={toggleAll}
                                                className="shrink-0"
                                            >
                                                {allFilteredSelected
                                                    ? 'Mind ki'
                                                    : 'Mind be'}
                                            </Button>
                                        </div>

                                        <div className="max-h-100 divide-y overflow-y-auto rounded-xl border">
                                            {filtered.length === 0 ? (
                                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                    Nincs találat
                                                </p>
                                            ) : (
                                                filtered.map((verb) => {
                                                    const picked =
                                                        selectedIds.has(
                                                            verb.id,
                                                        );

                                                    return (
                                                        <button
                                                            key={verb.id}
                                                            onClick={() =>
                                                                toggle(verb.id)
                                                            }
                                                            className={`flex w-full items-center gap-2 px-4 py-3 text-left transition-colors sm:gap-3 ${
                                                                picked
                                                                    ? 'bg-rose-50/60 dark:bg-rose-950/20'
                                                                    : 'hover:bg-muted'
                                                            }`}
                                                        >
                                                            <span
                                                                className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                                                    picked
                                                                        ? 'border-rose-500 bg-rose-500'
                                                                        : 'border-input bg-background'
                                                                }`}
                                                            >
                                                                {picked && (
                                                                    <Check className="size-3 text-white" />
                                                                )}
                                                            </span>
                                                            <span className="w-20 text-sm font-semibold sm:w-28 sm:text-base">
                                                                {
                                                                    verb.infinitive
                                                                }
                                                            </span>
                                                            <span className="w-16 text-sm text-muted-foreground sm:w-24">
                                                                {
                                                                    verb.past_simple
                                                                }
                                                            </span>
                                                            <span className="w-16 text-sm text-muted-foreground sm:w-24">
                                                                {
                                                                    verb.past_participle
                                                                }
                                                            </span>
                                                            {verb.meaning_hu && (
                                                                <span className="hidden truncate text-xs text-muted-foreground/70 sm:inline">
                                                                    {
                                                                        verb.meaning_hu
                                                                    }
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>

                                        <Button
                                            size="lg"
                                            onClick={startSelected}
                                            disabled={selectedIds.size === 0}
                                            className="w-full"
                                        >
                                            Indítás ({selectedIds.size} igével)
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IrregularVerbsIndex({ verbs }: Props) {
    const [quizVerbs, setQuizVerbs] = useState<IrregularVerb[] | null>(null);
    const [current, setCurrent] = useState(0);
    const [pastInput, setPastInput] = useState('');
    const [participleInput, setParticipleInput] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
    const [score, setScore] = useState(0);
    const [wrongVerbs, setWrongVerbs] = useState<IrregularVerb[]>([]);
    const [finished, setFinished] = useState(false);

    const pastRef = useRef<HTMLInputElement>(null);
    const participleRef = useRef<HTMLInputElement>(null);

    // Friss látogatáskor (új verbs prop) visszaállunk a beállítás-képernyőre —
    // különben az Inertia újrahasználja a komponenst, és a befejezett/félbehagyott
    // kvíz állapota (a szó) beragadna újranyitáskor.
    useEffect(() => {
        setQuizVerbs(null);
        setCurrent(0);
        setPastInput('');
        setParticipleInput('');
        setAnswerState('unanswered');
        setScore(0);
        setWrongVerbs([]);
        setFinished(false);
    }, [verbs]);

    const card = quizVerbs?.[current] ?? null;
    const answered = current + (answerState !== 'unanswered' ? 1 : 0);
    const progress =
        quizVerbs && quizVerbs.length > 0
            ? (answered / quizVerbs.length) * 100
            : 0;

    useEffect(() => {
        if (answerState === 'unanswered' && pastRef.current) {
            pastRef.current.focus();
        }
    }, [current, answerState]);

    function startQuiz(selected: IrregularVerb[]) {
        setQuizVerbs(selected);
        setCurrent(0);
        setPastInput('');
        setParticipleInput('');
        setAnswerState('unanswered');
        setScore(0);
        setWrongVerbs([]);
        setFinished(false);
    }

    function backToSetup() {
        setQuizVerbs(null);
        setFinished(false);
    }

    function handleCheck() {
        if (answerState !== 'unanswered' || !card) {
            return;
        }

        const pastCorrect = isCorrectAnswer(pastInput, card.past_simple);
        const participleCorrect = isCorrectAnswer(
            participleInput,
            card.past_participle,
        );
        const allCorrect = pastCorrect && participleCorrect;

        setAnswerState(allCorrect ? 'correct' : 'wrong');

        if (allCorrect) {
            setScore((s) => s + 1);
        } else {
            setWrongVerbs((w) => [...w, card]);
        }
    }

    function handleKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>,
        field: 'past' | 'participle',
    ) {
        if (e.key !== 'Enter') {
            return;
        }

        if (answerState !== 'unanswered') {
            handleNext();

            return;
        }

        if (field === 'past') {
            participleRef.current?.focus();
        } else {
            handleCheck();
        }
    }

    function handleNext() {
        if (!quizVerbs) {
            return;
        }

        if (current + 1 >= quizVerbs.length) {
            setFinished(true);
        } else {
            setCurrent((c) => c + 1);
            setPastInput('');
            setParticipleInput('');
            setAnswerState('unanswered');
        }
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    if (!quizVerbs) {
        return <SetupScreen verbs={verbs} onStart={startQuiz} />;
    }

    // ── Finished ──────────────────────────────────────────────────────────────
    if (finished) {
        const percent = Math.round((score / quizVerbs.length) * 100);

        return (
            <>
                <Head title="Rendhagyó igék – eredmény" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
                    <div
                        className={`mb-6 flex size-20 items-center justify-center rounded-full ${
                            percent >= 80
                                ? 'bg-rose-100 dark:bg-rose-950/30'
                                : 'bg-muted'
                        }`}
                    >
                        <Trophy
                            className={`size-10 ${percent >= 80 ? 'text-rose-500' : 'text-muted-foreground'}`}
                        />
                    </div>
                    <div className="mb-4 text-6xl font-bold tabular-nums">
                        {score}
                        <span className="text-2xl text-muted-foreground">
                            /{quizVerbs.length}
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

                    {wrongVerbs.length > 0 && (
                        <div className="mb-10 w-full max-w-lg text-left">
                            <p className="mb-3 text-sm font-semibold text-muted-foreground">
                                Hibás igék:
                            </p>
                            <div className="flex flex-col gap-2">
                                {wrongVerbs.map((v) => (
                                    <div
                                        key={v.id}
                                        className="rounded-2xl bg-card px-4 py-3 shadow-sm"
                                    >
                                        <span className="font-semibold">
                                            {v.infinitive}
                                        </span>
                                        <span className="mx-2 text-muted-foreground">
                                            →
                                        </span>
                                        <span className="text-sm">
                                            <span className="font-medium">
                                                {v.past_simple}
                                            </span>
                                            <span className="mx-1 text-muted-foreground">
                                                /
                                            </span>
                                            <span className="font-medium">
                                                {v.past_participle}
                                            </span>
                                        </span>
                                        {v.meaning_hu && (
                                            <span className="ml-2 text-sm text-muted-foreground">
                                                — {v.meaning_hu}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button onClick={() => startQuiz(quizVerbs)}>
                            <RotateCcw className="size-4" />
                            Újra ugyanezekkel
                        </Button>
                        {wrongVerbs.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => startQuiz(wrongVerbs)}
                            >
                                Csak a hibásak
                            </Button>
                        )}
                        <Button variant="ghost" onClick={backToSetup}>
                            <ArrowLeft className="size-4" />
                            Új beállítás
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // ── Quiz ──────────────────────────────────────────────────────────────────
    // Üres kvízlista vagy tartományon kívüli index esetén nincs kártya —
    // vissza a beállítás-képernyőre a fehér képernyő helyett.
    if (!card) {
        return <SetupScreen verbs={verbs} onStart={startQuiz} />;
    }

    const pastCorrect =
        answerState !== 'unanswered' &&
        isCorrectAnswer(pastInput, card.past_simple);
    const pastWrong = answerState !== 'unanswered' && !pastCorrect;
    const participleCorrect =
        answerState !== 'unanswered' &&
        isCorrectAnswer(participleInput, card.past_participle);
    const participleWrong = answerState !== 'unanswered' && !participleCorrect;

    const inputStateClass = (correct: boolean) =>
        answerState !== 'unanswered'
            ? correct
                ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                : 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
            : '';

    return (
        <>
            <Head
                title={`Rendhagyó igék – ${current + 1}/${quizVerbs.length}`}
            />

            <div className="flex min-h-dvh flex-col">
                {/* Rose header */}
                <div className="relative overflow-hidden bg-rose-500 px-4 pt-5 pb-10">
                    <div className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-white/10" />

                    {/* Header row */}
                    <div className="relative mx-auto flex max-w-xl items-center justify-between">
                        <button
                            onClick={backToSetup}
                            className="flex items-center gap-1 text-sm font-medium text-white/80 transition-colors hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            Kilépés
                        </button>
                        <span className="text-sm font-medium text-white/80 tabular-nums">
                            {current + 1} / {quizVerbs.length}
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

                    {/* Verb */}
                    <div className="relative mx-auto mt-8 max-w-xl pb-4 text-center">
                        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                            to {card.infinitive}
                        </h2>
                        <p className="mt-3 text-sm text-white/75">
                            {card.meaning_hu ??
                                'Írd be a két rendhagyó alakot!'}
                        </p>
                    </div>
                </div>

                {/* Content area */}
                <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
                    {/* Inputs */}
                    <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm md:p-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-muted-foreground">
                                Past Simple
                            </label>
                            <div className="relative">
                                <Input
                                    ref={pastRef}
                                    value={pastInput}
                                    onChange={(e) =>
                                        setPastInput(e.target.value)
                                    }
                                    onKeyDown={(e) => handleKeyDown(e, 'past')}
                                    readOnly={answerState !== 'unanswered'}
                                    placeholder="pl. went"
                                    className={`h-12 rounded-xl pr-10 text-base ${inputStateClass(pastCorrect)}`}
                                />
                                {answerState !== 'unanswered' && (
                                    <span className="absolute top-1/2 right-3 -translate-y-1/2">
                                        {pastCorrect ? (
                                            <CheckCircle2 className="size-5 text-green-600" />
                                        ) : (
                                            <XCircle className="size-5 text-red-600" />
                                        )}
                                    </span>
                                )}
                            </div>
                            {pastWrong && (
                                <p className="text-sm text-green-700 dark:text-green-400">
                                    Helyes:{' '}
                                    <span className="font-bold">
                                        {card.past_simple}
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-muted-foreground">
                                Past Participle
                            </label>
                            <div className="relative">
                                <Input
                                    ref={participleRef}
                                    value={participleInput}
                                    onChange={(e) =>
                                        setParticipleInput(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        handleKeyDown(e, 'participle')
                                    }
                                    readOnly={answerState !== 'unanswered'}
                                    placeholder="pl. gone"
                                    className={`h-12 rounded-xl pr-10 text-base ${inputStateClass(participleCorrect)}`}
                                />
                                {answerState !== 'unanswered' && (
                                    <span className="absolute top-1/2 right-3 -translate-y-1/2">
                                        {participleCorrect ? (
                                            <CheckCircle2 className="size-5 text-green-600" />
                                        ) : (
                                            <XCircle className="size-5 text-red-600" />
                                        )}
                                    </span>
                                )}
                            </div>
                            {participleWrong && (
                                <p className="text-sm text-green-700 dark:text-green-400">
                                    Helyes:{' '}
                                    <span className="font-bold">
                                        {card.past_participle}
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Example sentence after answer */}
                    {answerState !== 'unanswered' && card.example_en && (
                        <div className="animate-in rounded-2xl bg-accent/60 px-4 py-3 text-sm text-muted-foreground italic duration-200 fade-in slide-in-from-bottom-2">
                            "{card.example_en}"
                        </div>
                    )}

                    {/* Action */}
                    <div className="sticky bottom-4 mt-auto pt-2">
                        {answerState === 'unanswered' ? (
                            <Button
                                size="lg"
                                className="w-full"
                                onClick={handleCheck}
                                disabled={
                                    !pastInput.trim() || !participleInput.trim()
                                }
                            >
                                Ellenőrzés
                            </Button>
                        ) : (
                            <Button
                                size="lg"
                                className="w-full"
                                onClick={handleNext}
                            >
                                {current + 1 >= quizVerbs.length
                                    ? 'Eredmény megtekintése'
                                    : 'Következő'}
                                <ChevronRight className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

IrregularVerbsIndex.layout = {
    breadcrumbs: [{ title: 'Rendhagyó igék', href: irregularVerbsRoute() }],
};
