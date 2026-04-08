import { Head } from '@inertiajs/react';
import { CheckCircle2, ChevronRight, List, RotateCcw, Shuffle, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
    if (normalizedInput === normalizedCorrect) return true;
    return normalizedCorrect.split('/').map((s) => s.trim()).includes(normalizedInput);
}

// ── Setup screen ──────────────────────────────────────────────────────────────

function SetupScreen({ verbs, onStart }: { verbs: IrregularVerb[]; onStart: (selected: IrregularVerb[]) => void }) {
    const [mode, setMode] = useState<SetupMode>('random');
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const counts = [10, 20, 30, 50, verbs.length];
    const uniqueCounts = [...new Set(counts.filter((c) => c <= verbs.length))];

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return verbs;
        return verbs.filter(
            (v) =>
                v.infinitive.toLowerCase().includes(q) ||
                v.past_simple.toLowerCase().includes(q) ||
                v.past_participle.toLowerCase().includes(q) ||
                (v.meaning_hu ?? '').toLowerCase().includes(q),
        );
    }, [verbs, search]);

    function toggleAll() {
        if (selectedIds.size === filtered.length) {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                filtered.forEach((v) => next.delete(v.id));
                return next;
            });
        } else {
            setSelectedIds((prev) => {
                const next = new Set(prev);
                filtered.forEach((v) => next.add(v.id));
                return next;
            });
        }
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
        const shuffled = [...verbs].sort(() => Math.random() - 0.5).slice(0, count);
        onStart(shuffled);
    }

    function startSelected() {
        const selected = verbs.filter((v) => selectedIds.has(v.id)).sort(() => Math.random() - 0.5);
        onStart(selected);
    }

    const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));

    return (
        <>
            <Head title="Rendhagyó igék" />
            <div className="mx-auto max-w-2xl px-6 py-10">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold tracking-tight">Rendhagyó igék</h1>
                    <p className="mt-2 text-muted-foreground">
                        Gépeld be a <span className="font-medium">Past Simple</span> és <span className="font-medium">Past Participle</span> alakokat.
                    </p>
                </div>

                {/* Mode tabs */}
                <div className="mb-6 flex gap-2 rounded-xl border bg-muted/40 p-1">
                    <button
                        onClick={() => setMode('random')}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${mode === 'random' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <Shuffle className="size-4" />
                        Véletlenszerű
                    </button>
                    <button
                        onClick={() => setMode('select')}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-all ${mode === 'select' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        <List className="size-4" />
                        Kiválasztom
                        {selectedIds.size > 0 && (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {selectedIds.size}
                            </span>
                        )}
                    </button>
                </div>

                {/* Random mode */}
                {mode === 'random' && (
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-muted-foreground">{verbs.length} ige áll rendelkezésre</p>
                        <div className="flex flex-wrap justify-center gap-3">
                            {uniqueCounts.map((c) => (
                                <Button key={c} variant="outline" className="min-w-20" onClick={() => startRandom(c)}>
                                    {c === verbs.length ? 'Mind' : c}
                                </Button>
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
                                onChange={(e) => setSearch(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleAll}
                                className="shrink-0"
                            >
                                {allFilteredSelected ? 'Mind ki' : 'Mind be'}
                            </Button>
                        </div>

                        <div className="max-h-100 overflow-y-auto rounded-xl border divide-y">
                            {filtered.map((verb) => (
                                <button
                                    key={verb.id}
                                    onClick={() => toggle(verb.id)}
                                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${selectedIds.has(verb.id) ? 'bg-primary/5' : ''}`}
                                >
                                    <div className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${selectedIds.has(verb.id) ? 'border-primary bg-primary' : 'border-input'}`}>
                                        {selectedIds.has(verb.id) && (
                                            <svg className="size-2.5 text-primary-foreground" viewBox="0 0 10 8" fill="none">
                                                <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className="w-28 font-semibold">{verb.infinitive}</span>
                                    <span className="w-24 text-sm text-muted-foreground">{verb.past_simple}</span>
                                    <span className="w-24 text-sm text-muted-foreground">{verb.past_participle}</span>
                                    {verb.meaning_hu && (
                                        <span className="truncate text-xs text-muted-foreground/70">{verb.meaning_hu}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <Button
                            onClick={startSelected}
                            disabled={selectedIds.size === 0}
                            className="w-full"
                        >
                            Kvíz indítása ({selectedIds.size} igével)
                        </Button>
                    </div>
                )}
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

    const card = quizVerbs?.[current] ?? null;
    const progress = quizVerbs && quizVerbs.length > 0 ? (current / quizVerbs.length) * 100 : 0;

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
        if (answerState !== 'unanswered' || !card) return;

        const pastCorrect = isCorrectAnswer(pastInput, card.past_simple);
        const participleCorrect = isCorrectAnswer(participleInput, card.past_participle);
        const allCorrect = pastCorrect && participleCorrect;

        setAnswerState(allCorrect ? 'correct' : 'wrong');
        if (allCorrect) {
            setScore((s) => s + 1);
        } else {
            setWrongVerbs((w) => [...w, card]);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, field: 'past' | 'participle') {
        if (e.key === 'Enter') {
            if (field === 'past' && answerState === 'unanswered') {
                participleRef.current?.focus();
            } else if (field === 'participle' && answerState === 'unanswered') {
                handleCheck();
            }
        }
    }

    function handleNext() {
        if (!quizVerbs) return;
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
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-6 text-6xl font-bold tabular-nums">
                        {score}
                        <span className="text-2xl text-muted-foreground">/{quizVerbs.length}</span>
                    </div>
                    <div className="mb-2 text-2xl font-semibold">
                        {percent >= 80 ? 'Kiváló!' : percent >= 50 ? 'Jó munka!' : 'Gyakorolj tovább!'}
                    </div>
                    <p className="mb-10 text-muted-foreground">{percent}% helyes válasz</p>

                    {wrongVerbs.length > 0 && (
                        <div className="mb-10 w-full max-w-lg text-left">
                            <p className="mb-3 text-sm font-medium text-muted-foreground">Hibás igék:</p>
                            <div className="flex flex-col gap-2">
                                {wrongVerbs.map((v) => (
                                    <div key={v.id} className="rounded-lg border bg-card px-4 py-3">
                                        <span className="font-semibold">{v.infinitive}</span>
                                        <span className="mx-2 text-muted-foreground">→</span>
                                        <span className="text-sm">
                                            <span className="font-medium">{v.past_simple}</span>
                                            <span className="mx-1 text-muted-foreground">/</span>
                                            <span className="font-medium">{v.past_participle}</span>
                                        </span>
                                        {v.meaning_hu && (
                                            <span className="ml-2 text-sm text-muted-foreground">— {v.meaning_hu}</span>
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
                        <Button variant="outline" onClick={backToSetup}>
                            Új beállítás
                        </Button>
                        {wrongVerbs.length > 0 && (
                            <Button variant="outline" onClick={() => startQuiz(wrongVerbs)}>
                                Csak a hibásak
                            </Button>
                        )}
                    </div>
                </div>
            </>
        );
    }

    // ── Quiz ──────────────────────────────────────────────────────────────────
    const pastCorrect = answerState !== 'unanswered' && isCorrectAnswer(pastInput, card!.past_simple);
    const pastWrong = answerState !== 'unanswered' && !pastCorrect;
    const participleCorrect = answerState !== 'unanswered' && isCorrectAnswer(participleInput, card!.past_participle);
    const participleWrong = answerState !== 'unanswered' && !participleCorrect;

    return (
        <>
            <Head title={`Rendhagyó igék – ${current + 1}/${quizVerbs.length}`} />

            <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={backToSetup}>
                        Kilépés
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {current + 1} / {quizVerbs.length}
                    </span>
                    <span className="text-sm font-medium text-primary tabular-nums">{score} pont</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                        className="h-1.5 rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Card */}
                <div className="rounded-2xl border bg-card px-8 py-10 text-center shadow-sm">
                    <h2 className="text-4xl font-bold tracking-tight">to {card!.infinitive}</h2>
                    {card!.meaning_hu && (
                        <p className="mt-3 text-sm text-muted-foreground">{card!.meaning_hu}</p>
                    )}
                </div>

                {/* Inputs */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Past Simple</label>
                        <div className="relative">
                            <Input
                                ref={pastRef}
                                value={pastInput}
                                onChange={(e) => setPastInput(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, 'past')}
                                disabled={answerState !== 'unanswered'}
                                placeholder="pl. went"
                                className={
                                    answerState !== 'unanswered'
                                        ? pastCorrect
                                            ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                            : 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                        : ''
                                }
                            />
                            {answerState !== 'unanswered' && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {pastCorrect ? (
                                        <CheckCircle2 className="size-4 text-green-600" />
                                    ) : (
                                        <XCircle className="size-4 text-red-600" />
                                    )}
                                </span>
                            )}
                        </div>
                        {pastWrong && (
                            <p className="text-sm text-green-700 dark:text-green-400">
                                Helyes: <span className="font-semibold">{card!.past_simple}</span>
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-muted-foreground">Past Participle</label>
                        <div className="relative">
                            <Input
                                ref={participleRef}
                                value={participleInput}
                                onChange={(e) => setParticipleInput(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, 'participle')}
                                disabled={answerState !== 'unanswered'}
                                placeholder="pl. gone"
                                className={
                                    answerState !== 'unanswered'
                                        ? participleCorrect
                                            ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                            : 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                        : ''
                                }
                            />
                            {answerState !== 'unanswered' && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {participleCorrect ? (
                                        <CheckCircle2 className="size-4 text-green-600" />
                                    ) : (
                                        <XCircle className="size-4 text-red-600" />
                                    )}
                                </span>
                            )}
                        </div>
                        {participleWrong && (
                            <p className="text-sm text-green-700 dark:text-green-400">
                                Helyes: <span className="font-semibold">{card!.past_participle}</span>
                            </p>
                        )}
                    </div>
                </div>

                {answerState !== 'unanswered' && card!.example_en && (
                    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground italic">
                        "{card!.example_en}"
                    </div>
                )}

                <div className="flex justify-end">
                    {answerState === 'unanswered' ? (
                        <Button onClick={handleCheck} disabled={!pastInput.trim() || !participleInput.trim()}>
                            Ellenőrzés
                        </Button>
                    ) : (
                        <Button onClick={handleNext}>
                            {current + 1 >= quizVerbs.length ? 'Befejezés' : 'Következő'}
                            <ChevronRight className="size-4" />
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
