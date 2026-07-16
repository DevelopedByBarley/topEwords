import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronRight,
    RotateCcw,
    Search,
    Trophy,
    XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { csrfHeaders } from '@/lib/csrf';
import { pricing } from '@/routes';
import { cloze as clozeRoute, index as wordsIndex } from '@/routes/words';
import { complete as clozeComplete } from '@/routes/words/cloze';

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
    level: number | null;
    folder: number | null;
    count: number;
    ids: string;
}

interface Props {
    items: ClozeItem[];
    available: number;
    missingCount: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
    freeClozeLimit: number | null;
}

type AnswerState = 'unanswered' | 'correct' | 'wrong';

const STATUS_LABELS: Record<string, string> = {
    learning: 'Tanulom',
    saved: 'Elmentettem',
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
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'border-border bg-background hover:bg-muted'
    }`;

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

// Highlight the blank in the sentence; after answering reveal the answer
function renderSentence(
    sentence: string,
    answerState: AnswerState,
    answer: string,
) {
    const parts = sentence.split('_____');

    if (parts.length < 2) {
        return <span>{sentence}</span>;
    }

    return (
        <span>
            {parts[0]}
            {answerState === 'unanswered' ? (
                <span className="mx-1 inline-block min-w-16 border-b-2 border-emerald-500">
                    {' '.repeat(8)}
                </span>
            ) : (
                <span className="mx-1 inline-block font-bold text-green-700 dark:text-green-400">
                    {answer}
                </span>
            )}
            {parts[1]}
        </span>
    );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function ClozeSetup({
    available,
    folders,
    filters,
    selectableWords,
    freeClozeLimit,
    onStart,
    onStartWithIds,
}: {
    available: number;
    folders: Folder[];
    filters: Filters;
    selectableWords: SelectableWord[];
    freeClozeLimit: number | null;
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

    function updateFilter(params: Partial<Omit<Filters, 'count' | 'ids'>>) {
        const next = { ...filters, ...params };
        setPickedIds(new Set());
        setSearch('');
        router.get(
            clozeRoute(),
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

    const { status, level, folder } = filters;

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
            <Head title="Mondatkiegészítés – beállítás" />

            <div className="space-y-6 px-4 py-6">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-emerald-500 p-6 md:p-8">
                    <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/15" />
                    <div className="pointer-events-none absolute right-32 -bottom-20 size-40 rounded-full bg-white/10" />
                    <div className="relative max-w-xl">
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                            Mondatkiegészítés
                        </h1>
                        <p className="mt-1.5 text-sm text-white/85 md:text-base">
                            Egészítsd ki a mondatot a hiányzó szóval – aktiváld
                            a passzív szókincsedet!
                        </p>
                    </div>
                </div>

                <div className={`grid gap-6 ${folders.length > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
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
                            Hány mondat?{' '}
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
                                        (freeClozeLimit !== null &&
                                            n > freeClozeLimit)
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
                                        freeClozeLimit !== null &&
                                        available > freeClozeLimit
                                    }
                                    className={`col-span-2 text-center disabled:cursor-not-allowed disabled:opacity-40 ${FILTER_OPTION_CLASS(count === 500)}`}
                                >
                                    Összes ({available})
                                </button>
                            )}
                        </div>

                        {freeClozeLimit !== null && (
                            <p className="mt-3 text-xs text-muted-foreground">
                                Alap csomaggal legfeljebb {freeClozeLimit}{' '}
                                mondatos gyakorlás indítható.{' '}
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
                            Indítás
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
                                    Ha kiválasztasz szavakat, csak azokból fog
                                    dolgozni a feladat.
                                </p>
                            </div>
                            {pickedIds.size > 0 && (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
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
                                                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                                                    : 'hover:bg-muted'
                                            }`}
                                        >
                                            <span
                                                className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${picked ? 'border-emerald-500 bg-emerald-500' : 'border-input bg-background'}`}
                                            >
                                                {picked && (
                                                    <Check className="size-3 text-white" />
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
                                    {freeClozeLimit !== null &&
                                        pickedIds.size > freeClozeLimit && (
                                            <p className="text-xs text-muted-foreground">
                                                Alap csomaggal legfeljebb{' '}
                                                {freeClozeLimit} szót
                                                választhatsz ki.
                                            </p>
                                        )}
                                    <Button
                                        size="lg"
                                        disabled={
                                            freeClozeLimit !== null &&
                                            pickedIds.size > freeClozeLimit
                                        }
                                        onClick={() =>
                                            onStartWithIds(
                                                Array.from(pickedIds).join(','),
                                            )
                                        }
                                    >
                                        Indítás ({pickedIds.size} szóval)
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Cloze({
    items,
    available,
    missingCount,
    folders,
    filters,
    selectableWords,
    freeClozeLimit,
}: Props) {
    const [current, setCurrent] = useState(0);
    const [input, setInput] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
    const [score, setScore] = useState(0);
    const [wrongItems, setWrongItems] = useState<ClozeItem[]>([]);
    const [finished, setFinished] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    // Új kvíz (új items prop) érkezésekor visszaállítjuk az állapotot — különben
    // az Inertia újrahasználja a komponenst, és a régi current/answerState/finished
    // beragadna (úgy tűnik, nem változik a mondat).
    useEffect(() => {
        setCurrent(0);
        setInput('');
        setAnswerState('unanswered');
        setScore(0);
        setWrongItems([]);
        setFinished(false);
    }, [items]);

    const isSetup =
        items.length === 0 && filters.count === 0 && filters.ids === '';
    const isEmpty =
        items.length === 0 && (filters.count > 0 || filters.ids !== '');
    const card = items[current] ?? null;
    const answered = current + (answerState !== 'unanswered' ? 1 : 0);
    const progress = items.length > 0 ? (answered / items.length) * 100 : 0;
    const isCorrect =
        answerState !== 'unanswered' &&
        (normalize(input) === normalize(card?.answer ?? '') ||
            normalize(input) === normalize(card?.word ?? ''));
    const usedBaseForm =
        isCorrect &&
        normalize(input) === normalize(card?.word ?? '') &&
        normalize(card?.word ?? '') !== normalize(card?.answer ?? '');

    useEffect(() => {
        if (answerState === 'unanswered') {
            inputRef.current?.focus();
        }
    }, [current, answerState]);

    function startCloze(
        status: string,
        level: number | null,
        folder: number | null,
        count: number,
    ) {
        router.get(
            clozeRoute(),
            { status, ...(level ? { level } : {}), ...(folder ? { folder } : {}), count },
            { preserveScroll: false },
        );
    }

    function startClozeWithIds(ids: string) {
        router.get(
            clozeRoute(),
            {
                status: filters.status,
                ...(filters.level ? { level: filters.level } : {}),
                ...(filters.folder ? { folder: filters.folder } : {}),
                ids,
            },
            { preserveScroll: false },
        );
    }

    function handleCheck() {
        if (answerState !== 'unanswered' || !card || !input.trim()) {
            return;
        }

        const correct =
            normalize(input) === normalize(card.answer) ||
            normalize(input) === normalize(card.word);
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

    async function submitClozeComplete() {
        const res = await fetch(clozeComplete().url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...csrfHeaders(),
            },
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
        if (current + 1 >= items.length) {
            submitClozeComplete();
            setFinished(true);
        } else {
            setCurrent((c) => c + 1);
            setInput('');
            setAnswerState('unanswered');
        }
    }

    function restart() {
        setCurrent(0);
        setInput('');
        setAnswerState('unanswered');
        setScore(0);
        setWrongItems([]);
        setFinished(false);

        if (filters.ids !== '') {
            startClozeWithIds(filters.ids);
        } else {
            startCloze(
                filters.status,
                filters.level,
                filters.folder,
                filters.count,
            );
        }
    }

    // ── Empty ─────────────────────────────────────────────────────────────────
    if (isEmpty) {
        return (
            <>
                <Head title="Mondatkiegészítés" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-6 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                        <Search className="size-7 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-semibold">
                        {missingCount > 0
                            ? 'Ezekhez a szavakhoz nem készíthető feladat.'
                            : 'Nincs elérhető szó ezzel a szűrővel.'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {missingCount > 0
                            ? 'A kiválasztott szavak példamondatában nem szerepel maga a szó, így nincs mit kitakarni.'
                            : 'A mondatkiegészítéshez példamondattal rendelkező szavak kellenek.'}
                    </p>
                    <div className="mt-2 flex gap-3">
                        <Button variant="outline" asChild>
                            <Link href={clozeRoute()}>Más szűrő</Link>
                        </Button>
                        <Button asChild>
                            <Link href={wordsIndex()}>Szavak listája</Link>
                        </Button>
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
                freeClozeLimit={freeClozeLimit}
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
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
                    <div
                        className={`mb-6 flex size-20 items-center justify-center rounded-full ${
                            percent >= 80
                                ? 'bg-emerald-100 dark:bg-emerald-950/30'
                                : 'bg-muted'
                        }`}
                    >
                        <Trophy
                            className={`size-10 ${percent >= 80 ? 'text-emerald-500' : 'text-muted-foreground'}`}
                        />
                    </div>
                    <div className="mb-4 text-6xl font-bold tabular-nums">
                        {score}
                        <span className="text-2xl text-muted-foreground">
                            /{items.length}
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

                    {wrongItems.length > 0 && (
                        <div className="mb-10 w-full max-w-lg text-left">
                            <p className="mb-3 text-sm font-semibold text-muted-foreground">
                                Hibás válaszok:
                            </p>
                            <div className="flex flex-col gap-2">
                                {wrongItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl bg-card px-4 py-3 shadow-sm"
                                    >
                                        <span className="font-semibold">
                                            {item.word}
                                        </span>
                                        {item.meaning_hu && (
                                            <span className="ml-2 text-sm text-muted-foreground">
                                                — {item.meaning_hu}
                                            </span>
                                        )}
                                        <p className="mt-1 text-sm text-muted-foreground italic">
                                            {item.sentence.replace(
                                                '_____',
                                                `[${item.answer}]`,
                                            )}
                                        </p>
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
                            <Link href={clozeRoute()}>Új beállítás</Link>
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href={wordsIndex()}>
                                <ArrowLeft className="size-4" />
                                Vissza
                            </Link>
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    // ── Play ──────────────────────────────────────────────────────────────────
    return (
        <>
            <Head
                title={`Mondatkiegészítés – ${current + 1}/${items.length}`}
            />

            <div className="flex min-h-dvh flex-col">
                {/* Emerald header */}
                <div className="relative overflow-hidden bg-emerald-500 px-4 pt-5 pb-10">
                    <div className="pointer-events-none absolute -top-12 -right-12 size-48 rounded-full bg-white/10" />

                    {/* Header row */}
                    <div className="relative mx-auto flex max-w-xl items-center justify-between">
                        <Link
                            href={clozeRoute()}
                            className="flex items-center gap-1 text-sm font-medium text-white/80 transition-colors hover:text-white"
                        >
                            <ArrowLeft className="size-4" />
                            Kilépés
                        </Link>
                        <span className="text-sm font-medium text-white/80 tabular-nums">
                            {current + 1} / {items.length}
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

                    {/* Hint */}
                    <div className="relative mx-auto mt-6 max-w-xl text-center">
                        {card.rank !== null && (
                            <span className="mb-2 inline-block rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white/90">
                                #{card.rank}
                            </span>
                        )}
                        <p className="text-sm text-white/85">
                            Egészítsd ki a mondatot a hiányzó szóval!
                        </p>
                    </div>
                </div>

                {/* Content area */}
                <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-6">
                    {missingCount > 0 && (
                        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                            {missingCount} szóhoz nincs használható
                            példamondat, ezért rövidebb a kör.
                        </p>
                    )}

                    {/* Sentence card */}
                    <div className="rounded-3xl bg-card px-6 py-8 shadow-sm md:px-8">
                        <p className="text-center text-xl leading-relaxed font-medium">
                            {renderSentence(
                                card.sentence,
                                answerState,
                                card.answer,
                            )}
                        </p>
                        {card.meaning_hu && (
                            <p className="mt-4 text-center text-sm text-muted-foreground">
                                <span className="font-semibold">
                                    Magyar jelentés:
                                </span>{' '}
                                {card.meaning_hu}
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
                                readOnly={answerState !== 'unanswered'}
                                placeholder="Írd be a hiányzó szót..."
                                className={`h-12 rounded-xl pr-10 text-base ${
                                    answerState !== 'unanswered'
                                        ? isCorrect
                                            ? 'border-green-500 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                            : 'border-red-500 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                        : ''
                                }`}
                            />
                            {answerState !== 'unanswered' && (
                                <span className="absolute top-1/2 right-3 -translate-y-1/2">
                                    {isCorrect ? (
                                        <CheckCircle2 className="size-5 text-green-600" />
                                    ) : (
                                        <XCircle className="size-5 text-red-600" />
                                    )}
                                </span>
                            )}
                        </div>

                        {/* Wrong: show correct answer */}
                        {answerState === 'wrong' && (
                            <div className="animate-in rounded-2xl bg-red-50 px-4 py-3 text-sm duration-200 fade-in slide-in-from-bottom-2 dark:bg-red-950/20">
                                <span className="text-red-700/80 dark:text-red-400/80">
                                    Helyes válasz:{' '}
                                </span>
                                <span className="font-bold text-red-800 dark:text-red-300">
                                    {card.answer}
                                </span>
                            </div>
                        )}

                        {/* Correct but used base form */}
                        {usedBaseForm && (
                            <div className="animate-in rounded-2xl bg-green-50 px-4 py-3 text-sm duration-200 fade-in slide-in-from-bottom-2 dark:bg-green-950/20">
                                <span className="text-green-700 dark:text-green-400">
                                    A mondatban így szerepel:{' '}
                                </span>
                                <span className="font-bold text-green-800 dark:text-green-300">
                                    {card.answer}
                                </span>
                            </div>
                        )}

                        {/* Hungarian example after answer */}
                        {answerState !== 'unanswered' && card.example_hu && (
                            <div className="animate-in rounded-2xl bg-accent/60 px-4 py-3 text-sm text-muted-foreground italic duration-200 fade-in slide-in-from-bottom-2">
                                🇭🇺 "{card.example_hu}"
                            </div>
                        )}
                    </div>

                    {/* Action */}
                    <div className="sticky bottom-4 mt-auto pt-2">
                        {answerState === 'unanswered' ? (
                            <Button
                                size="lg"
                                className="w-full"
                                onClick={handleCheck}
                                disabled={!input.trim()}
                            >
                                Ellenőrzés
                            </Button>
                        ) : (
                            <Button
                                size="lg"
                                className="w-full"
                                onClick={handleNext}
                            >
                                {current + 1 >= items.length
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

Cloze.layout = {
    breadcrumbs: [
        { title: 'Top 10 000 szó', href: wordsIndex() },
        { title: 'Mondatkiegészítés', href: clozeRoute() },
    ],
};
