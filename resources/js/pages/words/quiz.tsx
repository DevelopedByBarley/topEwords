import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronRight, RotateCcw, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    rank: number;
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
    difficulty: string;
    folder: number | null;
    count: number;
}

interface Props {
    words: QuizWord[];
    available: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
}

const STATUS_LABELS: Record<string, string> = {
    learning: 'Tanulom',
    saved: 'Elmentettem',
    known: 'Tudom',
    pronunciation: 'Kiejtés',
    marked: 'Minden jelölt',
    '': 'Összes szó',
};

const DIFFICULTY_LABELS: Record<string, string> = {
    '': 'Minden szint',
    beginner: 'Kezdő (1–2 000)',
    intermediate: 'Középhaladó (2 001–6 000)',
    advanced: 'Haladó (6 001–10 000)',
};

type AnswerState = 'unanswered' | 'correct' | 'wrong';

export default function Quiz({ words, available, folders, filters, selectableWords }: Props) {
    const [current, setCurrent] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
    const [score, setScore] = useState(0);
    const [wrongAnswers, setWrongAnswers] = useState<QuizWord[]>([]);
    const [finished, setFinished] = useState(false);

    const isSetup = words.length === 0 && filters.count === 0;
    const isEmpty = words.length === 0 && filters.count > 0;

    const card = words[current] ?? null;
    const progress = words.length > 0 ? ((current) / words.length) * 100 : 0;

    function startQuiz(status: string, difficulty: string, folder: number | null, count: number) {
        router.get(quizRoute(), { status, difficulty, ...(folder ? { folder } : {}), count }, { preserveScroll: false });
    }

    function startQuizWithIds(ids: string) {
        router.get(quizRoute(), {
            status: filters.status,
            difficulty: filters.difficulty,
            ...(filters.folder ? { folder: filters.folder } : {}),
            ids,
        }, { preserveScroll: false });
    }

    function handleAnswer(option: string) {
        if (answerState !== 'unanswered') return;
        setSelected(option);
        const correct = option === card!.meaning_hu;
        setAnswerState(correct ? 'correct' : 'wrong');
        if (correct) {
            setScore((s) => s + 1);
        } else {
            setWrongAnswers((w) => [...w, card!]);
        }
    }

    async function submitQuizComplete(perfect: boolean) {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const res = await fetch(quizComplete().url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify({ perfect }),
        }).catch(() => null);
        if (res) {
            const data = await res.json().catch(() => ({}));
            if (Array.isArray(data.achievements) && data.achievements.length > 0) {
                window.dispatchEvent(new CustomEvent('achievements-unlocked', { detail: data.achievements }));
            }
        }
    }

    function handleNext() {
        if (current + 1 >= words.length) {
            submitQuizComplete(wrongAnswers.length === 0 && answerState === 'correct');
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
        startQuiz(filters.status, filters.difficulty, filters.folder, filters.count);
    }

    // ── Empty screen ─────────────────────────────────────────────────────────
    if (isEmpty) {
        return (
            <>
                <Head title="Kvíz" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
                    <p className="text-lg font-medium">Nincs elérhető szó ezzel a szűrővel.</p>
                    <p className="text-sm text-muted-foreground">Jelölj meg szavakat a listában, majd próbáld újra.</p>
                    <div className="flex gap-3 mt-2">
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
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-6 text-6xl font-bold tabular-nums">
                        {score}<span className="text-2xl text-muted-foreground">/{words.length}</span>
                    </div>
                    <div className="mb-2 text-2xl font-semibold">
                        {percent >= 80 ? 'Kiváló!' : percent >= 50 ? 'Jó munka!' : 'Gyakorolj tovább!'}
                    </div>
                    <p className="mb-10 text-muted-foreground">
                        {percent}% helyes válasz
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

    // ── Quiz screen ───────────────────────────────────────────────────────────
    return (
        <>
            <Head title={`Kvíz – ${current + 1}/${words.length}`} />

            <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={quizRoute()}>
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
                    <p className="mb-1 text-xs text-muted-foreground">#{card.rank}</p>
                    <h2 className="text-4xl font-bold tracking-tight">{card.word}</h2>
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
                        {/* Igealakok */}
                        {card.part_of_speech === 'verb' && card.verb_past && (
                            <div>
                                <div className="mb-1.5 flex items-center gap-2">
                                    <span className="font-medium">Igealakok</span>
                                    {card.is_irregular === 1 && (
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
                        {/* Többes szám */}
                        {card.part_of_speech === 'noun' && card.noun_plural && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Többes szám:</span>
                                <span className="font-medium">{card.noun_plural}</span>
                            </div>
                        )}
                        {/* Fokozás */}
                        {card.part_of_speech === 'adj' && card.adj_comparative && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                <span className="text-muted-foreground">Középfok</span>
                                <span className="font-medium">{card.adj_comparative}</span>
                                <span className="text-muted-foreground">Felsőfok</span>
                                <span className="font-medium">{card.adj_superlative}</span>
                            </div>
                        )}
                        {/* Szinonimák */}
                        {card.synonyms && (
                            <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">Szinonimák:</span> {card.synonyms}
                            </p>
                        )}
                        {/* Példamondat */}
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
                        {current + 1 >= words.length ? 'Eredmény megtekintése' : 'Következő'}
                        <ChevronRight className="size-4" />
                    </Button>
                )}
            </div>
        </>
    );
}

// ── Setup component ───────────────────────────────────────────────────────────
function QuizSetup({ available, folders, filters, selectableWords, onStart, onStartWithIds }: {
    available: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
    onStart: (status: string, difficulty: string, folder: number | null, count: number) => void;
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
            { status: next.status, difficulty: next.difficulty, ...(next.folder ? { folder: next.folder } : {}), count: 0 },
            { only: ['available', 'filters', 'selectableWords'], preserveState: true, preserveScroll: true, replace: true },
        );
    }

    const status = filters.status;
    const difficulty = filters.difficulty;
    const folder = filters.folder;

    const q = search.toLowerCase();
    const filteredWords = selectableWords.filter(
        (w) => q === '' || w.word.toLowerCase().includes(q) || (w.meaning_hu ?? '').toLowerCase().includes(q),
    );

    const allFilteredPicked = filteredWords.length > 0 && filteredWords.every((w) => pickedIds.has(String(w.id)));

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

            <div className="px-6 py-10">
                <div className="mb-8">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
                        <Link href={wordsIndex()}>
                            <ArrowLeft className="size-4" />
                            Vissza
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">Kvíz beállítása</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Válaszd ki melyik szavakból és hányból kvízzeljünk.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-4">
                    {/* Folder filter */}
                    {folders.length > 0 && (
                        <div className="rounded-xl border bg-card p-5">
                            <p className="mb-3 text-sm font-semibold">Mappa</p>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => updateFilter({ folder: null })}
                                    className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                        folder === null
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    Összes mappa
                                </button>
                                {folders.map((f) => (
                                    <button
                                        key={f.id}
                                        onClick={() => updateFilter({ folder: f.id })}
                                        className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                            folder === f.id
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'bg-background hover:bg-muted'
                                        }`}
                                    >
                                        <span className="truncate">{f.name}</span>
                                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">{f.words_count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status filter */}
                    <div className="rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">Melyik szavakból?</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => updateFilter({ status: value })}
                                    className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                        status === value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Difficulty filter */}
                    <div className="rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">Nehézségi szint</p>
                        <div className="flex flex-col gap-2">
                            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => updateFilter({ difficulty: value })}
                                    className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                                        difficulty === value
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Count + Start */}
                    <div className="rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">
                            Hány szó? <span className="font-normal text-muted-foreground">({available} elérhető)</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[10, 20, 50].map((n) => (
                                <button
                                    key={n}
                                    onClick={() => setCount(n)}
                                    disabled={available < n}
                                    className={`rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        count === n
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                            {available <= 100 && (
                                <button
                                    onClick={() => setCount(500)}
                                    className={`col-span-2 rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                                        count === 500
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'bg-background hover:bg-muted'
                                    }`}
                                >
                                    Összes ({available})
                                </button>
                            )}
                        </div>

                        <Button
                            size="lg"
                            className="mt-4 w-full"
                            disabled={pickedIds.size > 0}
                            onClick={() => onStart(status, difficulty, folder, count)}
                        >
                            Kvíz indítása
                        </Button>
                    </div>
                </div>

                {/* Selectable word list */}
                {selectableWords.length > 0 && (
                    <div className="mt-6 rounded-xl border bg-card p-5">
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold">Szavak kiválasztása (opcionális)</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Ha kiválasztasz szavakat, a kvíz csak azokból fog dolgozni.
                                </p>
                            </div>
                            {pickedIds.size > 0 && (
                                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                    {pickedIds.size} kiválasztva
                                </span>
                            )}
                        </div>

                        <div className="mb-3 flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Keresés..."
                                    className="pl-9 text-sm"
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={toggleAll}>
                                {allFilteredPicked ? 'Mind ki' : 'Mind be'}
                            </Button>
                        </div>

                        <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
                            {filteredWords.length === 0 ? (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nincs találat</p>
                            ) : (
                                filteredWords.map((w) => {
                                    const id = String(w.id);
                                    const picked = pickedIds.has(id);
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => toggleWord(id)}
                                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                                picked ? 'bg-primary/5' : 'hover:bg-muted'
                                            }`}
                                        >
                                            <span className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${picked ? 'border-primary bg-primary' : 'border-input bg-background'}`}>
                                                {picked && <Check className="size-3 text-primary-foreground" />}
                                            </span>
                                            <span className="flex-1 font-medium">{w.word}</span>
                                            {w.meaning_hu && (
                                                <span className="max-w-48 truncate text-xs text-muted-foreground">{w.meaning_hu}</span>
                                            )}
                                            {w.rank && (
                                                <span className="shrink-0 text-xs text-muted-foreground">#{w.rank}</span>
                                            )}
                                            {w.is_custom && (
                                                <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">saját</span>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {pickedIds.size > 0 && (
                            <div className="mt-4 flex items-center justify-between gap-3">
                                <Button variant="ghost" size="sm" onClick={() => setPickedIds(new Set())}>
                                    Kijelölés törlése
                                </Button>
                                <Button size="lg" onClick={() => onStartWithIds(Array.from(pickedIds).join(','))}>
                                    Kvíz indítása ({pickedIds.size} szóval)
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
