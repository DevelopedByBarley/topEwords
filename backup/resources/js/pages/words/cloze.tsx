import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Check, CheckCircle2, RotateCcw, Search, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cloze as clozeRoute, index as wordsIndex } from '@/routes/words';

interface ClozeItem {
    id: number | string;
    word: string;
    meaning_hu: string | null;
    example_hu: string | null;
    rank: number | null;
    part_of_speech: string | null;
    status: string | null;
    sentence: string;
    answer: string;
    is_custom: boolean;
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
    items: ClozeItem[];
    available: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
}

type AnswerState = 'unanswered' | 'correct' | 'wrong';

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

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

// Highlight the blank in the sentence
function renderSentence(sentence: string, answerState: AnswerState, isCorrect: boolean) {
    const parts = sentence.split('_____');
    if (parts.length < 2) return <span>{sentence}</span>;

    const blankClass =
        answerState === 'unanswered'
            ? 'inline-block min-w-16 border-b-2 border-primary mx-1'
            : isCorrect
              ? 'inline-block mx-1 font-bold text-green-700 dark:text-green-400'
              : 'inline-block mx-1 font-bold text-red-700 dark:text-red-400';

    return (
        <span>
            {parts[0]}
            <span className={blankClass}>
                {answerState === 'unanswered' ? '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' : '___'}
            </span>
            {parts[1]}
        </span>
    );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function ClozeSetup({ available, folders, filters, selectableWords, onStart, onStartWithIds }: {
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
            clozeRoute(),
            { status: next.status, difficulty: next.difficulty, ...(next.folder ? { folder: next.folder } : {}), count: 0 },
            { only: ['available', 'filters', 'selectableWords'], preserveState: true, preserveScroll: true, replace: true },
        );
    }

    const { status, difficulty, folder } = filters;

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
            <Head title="Mondatkiegészítés – beállítás" />
            <div className="px-6 py-10">
                <div className="mb-8">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4">
                        <Link href={wordsIndex()}>
                            <ArrowLeft className="size-4" />
                            Vissza
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold tracking-tight">Mondatkiegészítés</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Egészítsd ki a mondatot a hiányzó szóval – aktiváld a passzív szókincsedet!
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">Melyik szavakból?</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <button key={value} onClick={() => updateFilter({ status: value })} className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${status === value ? 'border-primary bg-primary/5 text-primary' : 'bg-background hover:bg-muted'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">Nehézségi szint</p>
                        <div className="flex flex-col gap-2">
                            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                                <button key={value} onClick={() => updateFilter({ difficulty: value })} className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors ${difficulty === value ? 'border-primary bg-primary/5 text-primary' : 'bg-background hover:bg-muted'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border bg-card p-5">
                        <p className="mb-3 text-sm font-semibold">
                            Hány mondat? <span className="font-normal text-muted-foreground">({available} elérhető)</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {[10, 20, 50].map((n) => (
                                <button key={n} onClick={() => setCount(n)} disabled={available < n} className={`rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${count === n ? 'border-primary bg-primary/5 text-primary' : 'bg-background hover:bg-muted'}`}>
                                    {n}
                                </button>
                            ))}
                            {available <= 100 && (
                                <button onClick={() => setCount(500)} className={`col-span-2 rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors ${count === 500 ? 'border-primary bg-primary/5 text-primary' : 'bg-background hover:bg-muted'}`}>
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
                            Indítás
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
                                    Ha kiválasztasz szavakat, csak azokból fog dolgozni a feladat.
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
                                    Indítás ({pickedIds.size} szóval)
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Cloze({ items, available, folders, filters, selectableWords }: Props) {
    const [current, setCurrent] = useState(0);
    const [input, setInput] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
    const [score, setScore] = useState(0);
    const [wrongItems, setWrongItems] = useState<ClozeItem[]>([]);
    const [finished, setFinished] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    const isSetup = items.length === 0 && filters.count === 0;
    const isEmpty = items.length === 0 && filters.count > 0;
    const card = items[current] ?? null;
    const progress = items.length > 0 ? (current / items.length) * 100 : 0;
    const isCorrect = answerState !== 'unanswered' && (
        normalize(input) === normalize(card?.answer ?? '') ||
        normalize(input) === normalize(card?.word ?? '')
    );
    const usedBaseForm = isCorrect && normalize(input) === normalize(card?.word ?? '') && normalize(card?.word ?? '') !== normalize(card?.answer ?? '');

    useEffect(() => {
        if (answerState === 'unanswered') {
            inputRef.current?.focus();
        }
    }, [current, answerState]);

    function startCloze(status: string, difficulty: string, folder: number | null, count: number) {
        router.get(clozeRoute(), { status, difficulty, ...(folder ? { folder } : {}), count }, { preserveScroll: false });
    }

    function startClozeWithIds(ids: string) {
        router.get(clozeRoute(), {
            status: filters.status,
            difficulty: filters.difficulty,
            ...(filters.folder ? { folder: filters.folder } : {}),
            ids,
        }, { preserveScroll: false });
    }

    function handleCheck() {
        if (answerState !== 'unanswered' || !card || !input.trim()) return;

        const correct = normalize(input) === normalize(card.answer) || normalize(input) === normalize(card.word);
        setAnswerState(correct ? 'correct' : 'wrong');
        if (correct) {
            setScore((s) => s + 1);
        } else {
            setWrongItems((w) => [...w, card]);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            if (answerState === 'unanswered') {
                handleCheck();
            } else {
                handleNext();
            }
        }
    }

    function handleNext() {
        if (current + 1 >= items.length) {
            setFinished(true);
        } else {
            setCurrent((c) => c + 1);
            setInput('');
            setAnswerState('unanswered');
        }
    }

    function restart() {
        startCloze(filters.status, filters.difficulty, filters.folder, filters.count);
    }

    // ── Empty ─────────────────────────────────────────────────────────────────
    if (isEmpty) {
        return (
            <>
                <Head title="Mondatkiegészítés" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
                    <p className="text-lg font-medium">Nincs elérhető szó ezzel a szűrővel.</p>
                    <p className="text-sm text-muted-foreground">A mondatkiegészítéshez példamondattal rendelkező szavak kellenek.</p>
                    <div className="flex gap-3 mt-2">
                        <Button variant="outline" asChild><Link href={clozeRoute()}>Más szűrő</Link></Button>
                        <Button asChild><Link href={wordsIndex()}>Szavak listája</Link></Button>
                    </div>
                </div>
            </>
        );
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    if (isSetup) {
        return (
            <ClozeSetup
                available={available}
                folders={folders}
                filters={filters}
                selectableWords={selectableWords}
                onStart={startCloze}
                onStartWithIds={startClozeWithIds}
            />
        );
    }

    // ── Finished ──────────────────────────────────────────────────────────────
    if (finished) {
        const percent = Math.round((score / items.length) * 100);
        return (
            <>
                <Head title="Mondatkiegészítés – eredmény" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-6 text-6xl font-bold tabular-nums">
                        {score}<span className="text-2xl text-muted-foreground">/{items.length}</span>
                    </div>
                    <div className="mb-2 text-2xl font-semibold">
                        {percent >= 80 ? 'Kiváló!' : percent >= 50 ? 'Jó munka!' : 'Gyakorolj tovább!'}
                    </div>
                    <p className="mb-10 text-muted-foreground">{percent}% helyes válasz</p>

                    {wrongItems.length > 0 && (
                        <div className="mb-10 w-full max-w-lg text-left">
                            <p className="mb-3 text-sm font-medium text-muted-foreground">Hibás válaszok:</p>
                            <div className="flex flex-col gap-2">
                                {wrongItems.map((item) => (
                                    <div key={item.id} className="rounded-lg border bg-card px-4 py-3">
                                        <span className="font-semibold">{item.word}</span>
                                        {item.meaning_hu && <span className="ml-2 text-sm text-muted-foreground">— {item.meaning_hu}</span>}
                                        <p className="mt-1 text-sm text-muted-foreground italic">{item.sentence.replace('_____', `[${item.answer}]`)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button onClick={restart}><RotateCcw className="size-4" />Újra</Button>
                        <Button variant="outline" asChild><Link href={clozeRoute()}>Új beállítás</Link></Button>
                        <Button variant="ghost" asChild><Link href={wordsIndex()}><ArrowLeft className="size-4" />Vissza</Link></Button>
                    </div>
                </div>
            </>
        );
    }

    // ── Quiz ──────────────────────────────────────────────────────────────────
    return (
        <>
            <Head title={`Mondatkiegészítés – ${current + 1}/${items.length}`} />

            <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href={clozeRoute()}><ArrowLeft className="size-4" />Kilépés</Link>
                    </Button>
                    <span className="text-sm text-muted-foreground tabular-nums">{current + 1} / {items.length}</span>
                    <span className="text-sm font-medium text-primary tabular-nums">{score} pont</span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-1.5 rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>

                {/* Sentence card */}
                <div className="rounded-2xl border bg-card px-8 py-10 shadow-sm">
                    {card.rank && <p className="mb-3 text-center text-xs text-muted-foreground">#{card.rank}</p>}
                    <p className="text-center text-xl font-medium leading-relaxed">
                        {renderSentence(card.sentence, answerState, isCorrect)}
                    </p>
                    {card.meaning_hu && (
                        <p className="mt-4 text-center text-sm text-muted-foreground">
                            <span className="font-medium">Magyar jelentés:</span> {card.meaning_hu}
                        </p>
                    )}
                </div>

                {/* Input */}
                <div className="flex flex-col gap-2">
                    <div className="relative">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={answerState !== 'unanswered'}
                            placeholder="Írd be a hiányzó szót..."
                            className={`pr-10 text-base ${
                                answerState !== 'unanswered'
                                    ? isCorrect
                                        ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                        : 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                    : ''
                            }`}
                        />
                        {answerState !== 'unanswered' && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isCorrect
                                    ? <CheckCircle2 className="size-5 text-green-600" />
                                    : <XCircle className="size-5 text-red-600" />
                                }
                            </span>
                        )}
                    </div>

                    {/* Wrong: show correct answer */}
                    {answerState === 'wrong' && (
                        <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                            <span className="text-muted-foreground">Helyes válasz: </span>
                            <span className="font-semibold text-foreground">{card.answer}</span>
                            <span className="ml-3 text-muted-foreground italic">"{card.sentence.replace('_____', card.answer)}"</span>
                        </div>
                    )}

                    {/* Correct but used base form: show the inflected form from the sentence */}
                    {usedBaseForm && (
                        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm dark:border-green-800 dark:bg-green-950/20">
                            <span className="text-green-700 dark:text-green-400">A mondatban: </span>
                            <span className="font-semibold text-green-800 dark:text-green-300">{card.answer}</span>
                            <span className="ml-2 text-green-700 italic dark:text-green-400">"{card.sentence.replace('_____', card.answer)}"</span>
                        </div>
                    )}

                    {/* Hungarian example after answer */}
                    {answerState !== 'unanswered' && card.example_hu && (
                        <p className="text-sm text-muted-foreground italic px-1">
                            🇭🇺 "{card.example_hu}"
                        </p>
                    )}
                </div>

                {/* Action */}
                <div className="flex justify-end">
                    {answerState === 'unanswered' ? (
                        <Button onClick={handleCheck} disabled={!input.trim()}>
                            Ellenőrzés
                        </Button>
                    ) : (
                        <Button onClick={handleNext}>
                            {current + 1 >= items.length ? 'Befejezés' : 'Következő →'}
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}
