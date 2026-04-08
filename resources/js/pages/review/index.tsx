import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeft, BookMarked, CheckCircle2, ChevronRight, Clock, Mic, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { index as reviewIndex } from '@/routes/review';
import { complete as reviewComplete } from '@/routes/review';
import { dashboard } from '@/routes';

interface ReviewWord {
    id: number | string;
    word: string;
    meaning_hu: string;
    part_of_speech: string | null;
    form_base: string | null;
    verb_past: string | null;
    verb_past_participle: string | null;
    verb_present_participle: string | null;
    verb_third_person: string | null;
    is_irregular: number | boolean | null;
    noun_plural: string | null;
    adj_comparative: string | null;
    adj_superlative: string | null;
    example_en: string | null;
    example_hu: string | null;
    synonyms: string | null;
    rank: number | null;
    status: string | null;
    is_custom: boolean;
    options: string[];
}

interface DueCounts {
    learning: number;
    saved: number;
    pronunciation: number;
    known: number;
}

interface Intervals {
    learning: number;
    saved: number;
    pronunciation: number;
    known: number;
}

interface Props {
    words: ReviewWord[];
    dueCount: number;
    dueCounts: DueCounts;
    intervals: Intervals;
}

const STATUS_LABELS: Record<string, string> = {
    learning: 'Tanulom',
    saved: 'Elmentettem',
    pronunciation: 'Kiejtés',
    known: 'Tudom',
};

const STATUS_COLORS: Record<string, string> = {
    learning: 'text-blue-600 dark:text-blue-400',
    saved: 'text-orange-600 dark:text-orange-400',
    pronunciation: 'text-violet-600 dark:text-violet-400',
    known: 'text-green-600 dark:text-green-400',
};

type AnswerState = 'unanswered' | 'correct' | 'wrong';

export default function Review({ words, dueCount, dueCounts, intervals }: Props) {
    const [current, setCurrent] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
    const [score, setScore] = useState(0);
    const [wrongAnswers, setWrongAnswers] = useState<ReviewWord[]>([]);
    const [finished, setFinished] = useState(false);
    const [reviewedIds, setReviewedIds] = useState<string[]>([]);

    const isSetup = words.length === 0;
    const card = words[current] ?? null;
    const progress = words.length > 0 ? (current / words.length) * 100 : 0;

    function startReview() {
        router.get(reviewIndex(), { start: '1' }, { preserveScroll: false });
    }

    function handleAnswer(option: string) {
        if (answerState !== 'unanswered') return;
        setSelected(option);
        const correct = option === card!.meaning_hu;
        setAnswerState(correct ? 'correct' : 'wrong');
        if (correct) {
            setScore((s) => s + 1);
            setReviewedIds((ids) => [...ids, String(card!.id)]);
        } else {
            setWrongAnswers((w) => [...w, card!]);
        }
    }

    async function submitComplete(ids: string[]) {
        if (ids.length === 0) return;
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        await fetch(reviewComplete().url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify({ ids }),
        }).catch(() => null);
    }

    function handleNext() {
        if (current + 1 >= words.length) {
            submitComplete(reviewedIds);
            setFinished(true);
        } else {
            setCurrent((c) => c + 1);
            setSelected(null);
            setAnswerState('unanswered');
        }
    }

    // ── Setup screen ──────────────────────────────────────────────────────────
    if (isSetup) {
        const totalDue = Object.values(dueCounts).reduce((a, b) => a + b, 0);

        return (
            <>
                <Head title="Napi ismétlés" />
                <div className="mx-auto max-w-xl px-6 py-10">
                    <div className="mb-8">
                        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
                            <Link href={dashboard()}>
                                <ArrowLeft className="size-4" />
                                Dashboard
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <RefreshCw className="size-6 text-blue-500" />
                            <h1 className="text-2xl font-bold tracking-tight">Napi ismétlés</h1>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Ismételd át a jelölt szavakat — minden szót az utolsó ismétléstől eltelt idő alapján mutatunk.
                        </p>
                    </div>

                    {/* Interval explanation */}
                    <div className="mb-6 rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">Ismétlési időközök</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            {(Object.entries(intervals) as [string, number][]).map(([status, days]) => (
                                <div key={status} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                                    <span className={`font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                                    <span className="text-muted-foreground">minden {days} napban</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Due counts */}
                    <div className="mb-6 rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">Ma esedékes</p>
                        {totalDue === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-4 text-center">
                                <CheckCircle2 className="size-8 text-green-500" />
                                <p className="font-medium">Minden szót átnéztél mára!</p>
                                <p className="text-sm text-muted-foreground">Gyere vissza holnap az újabb ismétlésekért.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {(Object.entries(dueCounts) as [string, number][]).map(([status, count]) =>
                                    count > 0 ? (
                                        <div key={status} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm">
                                                {status === 'learning' && <Clock className="size-4 text-blue-500" />}
                                                {status === 'saved' && <BookMarked className="size-4 text-orange-500" />}
                                                {status === 'pronunciation' && <Mic className="size-4 text-violet-500" />}
                                                {status === 'known' && <CheckCircle2 className="size-4 text-green-500" />}
                                                <span>{STATUS_LABELS[status]}</span>
                                            </div>
                                            <span className="font-semibold tabular-nums">{count}</span>
                                        </div>
                                    ) : null,
                                )}
                                <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                                    <span>Összesen</span>
                                    <span className="tabular-nums">{totalDue}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {totalDue > 0 && (
                        <Button size="lg" className="w-full" onClick={startReview}>
                            <RefreshCw className="size-4" />
                            Ismétlés indítása ({Math.min(totalDue, 50)} szó)
                        </Button>
                    )}
                </div>
            </>
        );
    }

    // ── Finished screen ───────────────────────────────────────────────────────
    if (finished) {
        const percent = Math.round((score / words.length) * 100);
        return (
            <>
                <Head title="Napi ismétlés – kész" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-4">
                        <CheckCircle2 className="mx-auto size-16 text-green-500" />
                    </div>
                    <div className="mb-6 text-6xl font-bold tabular-nums">
                        {score}<span className="text-2xl text-muted-foreground">/{words.length}</span>
                    </div>
                    <div className="mb-2 text-2xl font-semibold">
                        {percent >= 80 ? 'Kiváló ismétlés!' : percent >= 50 ? 'Jó munka!' : 'Gyakorolj még!'}
                    </div>
                    <p className="mb-2 text-muted-foreground">{percent}% helyes válasz</p>
                    <p className="mb-10 text-sm text-muted-foreground">
                        A helyesen megválaszolt szavak ismétlési időpontja frissült.
                    </p>

                    {wrongAnswers.length > 0 && (
                        <div className="mb-10 w-full max-w-md text-left">
                            <p className="mb-3 text-sm font-medium text-muted-foreground">Hibás válaszok:</p>
                            <div className="flex flex-col gap-2">
                                {wrongAnswers.map((w) => (
                                    <div key={w.id} className="rounded-lg border bg-card px-4 py-3">
                                        <span className="font-medium">{w.word}</span>
                                        <span className="ml-2 text-sm text-muted-foreground">— {w.meaning_hu}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button onClick={() => router.get(reviewIndex(), { start: '1' }, { preserveScroll: false })}>
                            <RotateCcw className="size-4" />
                            Újra
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href={reviewIndex()}>Áttekintő</Link>
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href={dashboard()}>
                                <ArrowLeft className="size-4" />
                                Dashboard
                            </Link>
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // ── Quiz screen ───────────────────────────────────────────────────────────
    return (
        <>
            <Head title={`Ismétlés – ${current + 1}/${words.length}`} />

            <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={reviewIndex()}>
                            <ArrowLeft className="size-4" />
                            Kilépés
                        </Link>
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {current + 1} / {words.length}
                    </span>
                    <span className="text-sm font-medium text-primary tabular-nums">
                        {score} pont
                    </span>
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
                    {card.rank && <p className="mb-1 text-xs text-muted-foreground">#{card.rank}</p>}
                    <h2 className="text-4xl font-bold tracking-tight">{card.word}</h2>
                    {card.status && (
                        <p className={`mt-2 text-xs font-medium ${STATUS_COLORS[card.status] ?? 'text-muted-foreground'}`}>
                            {STATUS_LABELS[card.status] ?? card.status}
                        </p>
                    )}
                    <p className="mt-3 text-sm text-muted-foreground">Mi a magyar jelentése?</p>
                </div>

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
                                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                                    answerState === 'unanswered'
                                        ? 'hover:border-primary hover:bg-muted cursor-pointer'
                                        : 'cursor-default'
                                } ${
                                    answerState !== 'unanswered' && isCorrect
                                        ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                        : answerState !== 'unanswered' && isSelected
                                          ? 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                          : answerState !== 'unanswered'
                                            ? 'border opacity-40'
                                            : 'border bg-background'
                                }`}
                            >
                                {answerState !== 'unanswered' && isCorrect && (
                                    <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                                )}
                                {answerState !== 'unanswered' && isSelected && !isCorrect && (
                                    <XCircle className="size-4 shrink-0 text-red-600" />
                                )}
                                {(answerState === 'unanswered' || (!isCorrect && !isSelected)) && (
                                    <span className="size-4 shrink-0" />
                                )}
                                {option}
                            </button>
                        );
                    })}
                </div>

                {/* Extra info after answer */}
                {answerState !== 'unanswered' && (
                    <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm space-y-3">
                        {card.part_of_speech === 'verb' && card.verb_past && (
                            <div>
                                <div className="mb-1.5 flex items-center gap-2">
                                    <span className="font-medium">Igealakok</span>
                                    {card.is_irregular && (
                                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">rendhagyó</span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <span className="text-muted-foreground">Alap</span>
                                    <span className="font-medium">{card.form_base}</span>
                                    <span className="text-muted-foreground">Múlt idő</span>
                                    <span className="font-medium">{card.verb_past}</span>
                                    <span className="text-muted-foreground">Befejezett igenév</span>
                                    <span className="font-medium">{card.verb_past_participle}</span>
                                    <span className="text-muted-foreground">Folyamatos (-ing)</span>
                                    <span className="font-medium">{card.verb_present_participle}</span>
                                    <span className="text-muted-foreground">E/3 jelen</span>
                                    <span className="font-medium">{card.verb_third_person}</span>
                                </div>
                            </div>
                        )}
                        {card.part_of_speech === 'noun' && card.noun_plural && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Többes szám:</span>
                                <span className="font-medium">{card.noun_plural}</span>
                            </div>
                        )}
                        {card.part_of_speech === 'adj' && card.adj_comparative && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <span className="text-muted-foreground">Középfok</span>
                                <span className="font-medium">{card.adj_comparative}</span>
                                <span className="text-muted-foreground">Felsőfok</span>
                                <span className="font-medium">{card.adj_superlative}</span>
                            </div>
                        )}
                        {card.synonyms && (
                            <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">Szinonimák:</span> {card.synonyms}
                            </p>
                        )}
                        {card.example_en && (
                            <div>
                                <p className="italic">"{card.example_en}"</p>
                                {card.example_hu && (
                                    <p className="text-muted-foreground">"{card.example_hu}"</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Next button */}
                {answerState !== 'unanswered' && (
                    <Button onClick={handleNext} className="w-full">
                        {current + 1 >= words.length ? 'Befejezés' : 'Következő'}
                        <ChevronRight className="size-4" />
                    </Button>
                )}
            </div>
        </>
    );
}

Review.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Napi ismétlés', href: reviewIndex() },
    ],
};
