import { Head, router } from '@inertiajs/react';
import {
    ArrowLeftRight,
    BookMarked,
    CheckCheck,
    Clock,
    Info,
    Mic,
    Search,
    Volume2,
    X,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { index, status } from '@/routes/words';

type WordStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | null;

interface Word {
    id: number;
    word: string;
    rank: number;
    meaning: string | null;
    status: WordStatus;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedWords {
    data: Word[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface Props {
    words: PaginatedWords;
    filters: {
        search: string;
        letter: string;
        difficulty: string;
        status: string;
        per_page: number;
    };
    stats: {
        total: number;
        known: number;
        learning: number;
        saved: number;
        pronunciation: number;
    };
    markedPages: number[];
    markedLetters: string[];
}

const DIFFICULTIES = [
    { value: 'beginner', label: 'Kezdő', description: '1–2 000' },
    { value: 'intermediate', label: 'Középhaladó', description: '2 001–6 000' },
    { value: 'advanced', label: 'Haladó', description: '6 001–10 000' },
] as const;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function WordsIndex({
    words,
    filters,
    stats,
    markedPages,
    markedLetters,
}: Props) {
    const [search, setSearch] = useState(filters.search);
    const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
    const [flipMode, setFlipMode] = useState(false);
    const selectedWord =
        selectedWordId !== null
            ? (words.data.find((w) => w.id === selectedWordId) ?? null)
            : null;
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressPercent =
        stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;

    const navigate = useCallback(
        (params: {
            search?: string;
            letter?: string;
            difficulty?: string;
            status?: string;
            page?: number;
            per_page?: number;
        }) => {
            router.get(
                index(),
                {
                    search: params.search ?? filters.search,
                    letter:
                        params.letter !== undefined
                            ? params.letter
                            : filters.letter,
                    difficulty:
                        params.difficulty !== undefined
                            ? params.difficulty
                            : filters.difficulty,
                    status:
                        params.status !== undefined
                            ? params.status
                            : filters.status,
                    per_page:
                        params.per_page !== undefined
                            ? params.per_page
                            : filters.per_page,
                    page: params.page ?? 1,
                },
                { preserveScroll: false, preserveState: true, replace: true },
            );
        },
        [filters],
    );

    function handleSearchChange(value: string) {
        setSearch(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            navigate({ search: value, letter: filters.letter, page: 1 });
        }, 350);
    }

    function handleLetterClick(letter: string) {
        setSearch('');
        navigate({ search: '', letter, page: 1 });
    }

    function handleDifficultyClick(difficulty: string) {
        setSearch('');
        navigate({ search: '', difficulty, letter: 'ALL', page: 1 });
    }

    function handleStatusFilter(statusValue: string) {
        navigate({ status: statusValue, page: 1 });
    }

    function speak(word: string) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    function handleStatus(word: Word, newStatus: WordStatus) {
        const nextStatus = word.status === newStatus ? null : newStatus;

        router.post(
            status(word.id),
            { status: newStatus },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['words', 'stats'],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                optimistic: (props: any) => {
                    const prev = word.status;
                    return {
                        words: {
                            ...props.words,
                            data: props.words.data.map((w: Word) =>
                                w.id === word.id
                                    ? { ...w, status: nextStatus }
                                    : w,
                            ),
                        },
                        stats: {
                            ...props.stats,
                            known:
                                props.stats.known +
                                (nextStatus === 'known'
                                    ? 1
                                    : prev === 'known'
                                      ? -1
                                      : 0),
                            learning:
                                props.stats.learning +
                                (nextStatus === 'learning'
                                    ? 1
                                    : prev === 'learning'
                                      ? -1
                                      : 0),
                            saved:
                                props.stats.saved +
                                (nextStatus === 'saved'
                                    ? 1
                                    : prev === 'saved'
                                      ? -1
                                      : 0),
                            pronunciation:
                                props.stats.pronunciation +
                                (nextStatus === 'pronunciation'
                                    ? 1
                                    : prev === 'pronunciation'
                                      ? -1
                                      : 0),
                        },
                    };
                },
            },
        );
    }

    return (
        <>
            <Head title="Top 10 000 angol szó" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4 pb-20 sm:pb-6 md:p-6">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        Top 10 000 angol szó
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Jelöld meg a szavakat, amelyeket már ismersz.
                    </p>
                </div>

                {/* Progress */}
                <div className="rounded-xl border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Haladás</span>
                        <span className="text-muted-foreground">
                            {stats.known.toLocaleString()} /{' '}
                            {stats.total.toLocaleString()} ({progressPercent}%)
                        </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-2.5 rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <CheckCheck className="size-3 text-green-500" />{' '}
                            Tudom: {stats.known.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="size-3 text-blue-500" />{' '}
                            Folyamatban: {stats.learning.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                            <BookMarked className="size-3 text-orange-500" />{' '}
                            Később: {stats.saved.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                            <Mic className="size-3 text-violet-500" /> Kiejtés:{' '}
                            {stats.pronunciation.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Keresés..."
                        className="pr-9 pl-9"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => handleSearchChange('')}
                            aria-label="Törlés"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                {/* Per page */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        Oldalanként:
                    </span>
                    {[20, 50, 100, 200, 300, 400, 500, 1000].map((n) => (
                        <Button
                            key={n}
                            size="sm"
                            variant={
                                filters.per_page === n ? 'default' : 'outline'
                            }
                            onClick={() => navigate({ per_page: n, page: 1 })}
                        >
                            {n}
                        </Button>
                    ))}
                </div>

                {/* Difficulty filter */}
                {!search && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={
                                !filters.difficulty ? 'default' : 'outline'
                            }
                            onClick={() => handleDifficultyClick('')}
                        >
                            Minden szint
                        </Button>
                        {DIFFICULTIES.map((d) => (
                            <Button
                                key={d.value}
                                size="sm"
                                variant={
                                    filters.difficulty === d.value
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => handleDifficultyClick(d.value)}
                                title={`Rank ${d.description}`}
                            >
                                {d.label}
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    {d.description}
                                </span>
                            </Button>
                        ))}
                    </div>
                )}

                {/* Status filter */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant={!filters.status ? 'default' : 'outline'}
                        onClick={() => handleStatusFilter('')}
                    >
                        Minden státusz
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            filters.status === 'known' ? 'default' : 'outline'
                        }
                        className={
                            filters.status === 'known'
                                ? 'bg-green-600 hover:bg-green-700'
                                : 'hover:border-green-500 hover:text-green-700'
                        }
                        onClick={() => handleStatusFilter('known')}
                    >
                        <CheckCheck className="size-3.5" />
                        Tudom
                        <span className="text-xs font-normal opacity-75">
                            {stats.known.toLocaleString()}
                        </span>
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            filters.status === 'learning'
                                ? 'default'
                                : 'outline'
                        }
                        className={
                            filters.status === 'learning'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : 'hover:border-blue-500 hover:text-blue-700'
                        }
                        onClick={() => handleStatusFilter('learning')}
                    >
                        <Clock className="size-3.5" />
                        Tanulom
                        <span className="text-xs font-normal opacity-75">
                            {stats.learning.toLocaleString()}
                        </span>
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            filters.status === 'saved' ? 'default' : 'outline'
                        }
                        className={
                            filters.status === 'saved'
                                ? 'bg-orange-500 hover:bg-orange-600'
                                : 'hover:border-orange-500 hover:text-orange-700'
                        }
                        onClick={() => handleStatusFilter('saved')}
                    >
                        <BookMarked className="size-3.5" />
                        Később
                        <span className="text-xs font-normal opacity-75">
                            {stats.saved.toLocaleString()}
                        </span>
                    </Button>
                    <Button
                        size="sm"
                        variant={
                            filters.status === 'pronunciation'
                                ? 'default'
                                : 'outline'
                        }
                        className={
                            filters.status === 'pronunciation'
                                ? 'bg-violet-600 hover:bg-violet-700'
                                : 'hover:border-violet-500 hover:text-violet-700'
                        }
                        onClick={() => handleStatusFilter('pronunciation')}
                    >
                        <Mic className="size-3.5" />
                        Kiejtés
                        <span className="text-xs font-normal opacity-75">
                            {stats.pronunciation.toLocaleString()}
                        </span>
                    </Button>
                </div>

                {/* Letter navigation */}
                {!search && (
                    <div className="flex flex-wrap gap-1">
                        <Button
                            size="sm"
                            variant={
                                !filters.letter || filters.letter === 'ALL'
                                    ? 'default'
                                    : 'outline'
                            }
                            onClick={() => handleLetterClick('ALL')}
                        >
                            Összes
                        </Button>
                        {LETTERS.map((letter) => {
                            const hasMarks = markedLetters.includes(letter);
                            const isActive = filters.letter === letter;
                            return (
                                <Button
                                    key={letter}
                                    size="sm"
                                    variant={isActive ? 'default' : 'outline'}
                                    onClick={() => handleLetterClick(letter)}
                                    className="relative"
                                >
                                    {letter}
                                    {hasMarks && !isActive && (
                                        <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center">
                                            <span className="size-1.5 rounded-full bg-primary opacity-70" />
                                        </span>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                )}

                {/* Word count */}
                <p className="text-sm text-muted-foreground">
                    {words.total.toLocaleString()} szó
                    {words.last_page > 1 && (
                        <span>
                            {' '}
                            &mdash; {words.current_page}. / {words.last_page}.
                            oldal
                        </span>
                    )}
                </p>

                {/* Hint banner */}
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                    <Info className="size-5 shrink-0" />
                    <p className="text-sm font-medium">
                        {flipMode
                            ? 'Fordított mód: a magyar jelentés látszik — kattints a szóra az angol megjelenítéséhez!'
                            : 'Kattints bármelyik szóra a magyar jelentés megtekintéséhez!'}
                    </p>
                </div>

                {/* Word list */}
                {words.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <Search className="mb-3 size-10 opacity-30" />
                        <p className="font-medium">Nincs találat</p>
                        <p className="text-sm">
                            Próbálj más keresési feltételt.
                        </p>
                    </div>
                ) : (
                    <div className="rounded-xl border">
                        <ul className="divide-y">
                            {words.data.map((word) => (
                                <li
                                    key={word.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                                        word.status === 'known'
                                            ? 'bg-green-50 dark:bg-green-950/20'
                                            : word.status === 'learning'
                                              ? 'bg-blue-50 dark:bg-blue-950/20'
                                              : word.status === 'saved'
                                                ? 'bg-orange-50 dark:bg-orange-950/20'
                                                : word.status ===
                                                    'pronunciation'
                                                  ? 'bg-violet-50 dark:bg-violet-950/20'
                                                  : ''
                                    }`}
                                >
                                    <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground/60 tabular-nums">
                                        {word.rank}
                                    </span>
                                    <button
                                        onClick={() =>
                                            setSelectedWordId(word.id)
                                        }
                                        className={`flex-1 text-left underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70 ${
                                            flipMode
                                                ? 'text-sm font-normal'
                                                : 'font-medium'
                                        } ${
                                            word.status === 'known'
                                                ? 'text-green-700 decoration-green-400 dark:text-green-400'
                                                : word.status === 'learning'
                                                  ? 'text-blue-700 decoration-blue-400 dark:text-blue-400'
                                                  : word.status === 'saved'
                                                    ? 'text-orange-700 decoration-orange-400 dark:text-orange-400'
                                                    : word.status ===
                                                        'pronunciation'
                                                      ? 'text-violet-700 decoration-violet-400 dark:text-violet-400'
                                                      : 'decoration-muted-foreground/40'
                                        }`}
                                    >
                                        {flipMode
                                            ? (word.meaning ?? (
                                                  <span className="text-muted-foreground italic">
                                                      (nincs fordítás)
                                                  </span>
                                              ))
                                            : word.word}
                                        <Info className="mb-0.5 ml-1 inline size-3 opacity-40" />
                                    </button>
                                    <button
                                        onClick={() => speak(word.word)}
                                        title="Felolvasás"
                                        className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <Volume2 className="size-3.5" />
                                    </button>
                                    <div className="flex shrink-0 gap-1">
                                        <button
                                            onClick={() =>
                                                handleStatus(word, 'known')
                                            }
                                            title="Tudom"
                                            className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                                                word.status === 'known'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-green-100 hover:text-green-700'
                                            }`}
                                        >
                                            <CheckCheck className="size-3" />
                                            <span className="hidden sm:inline">
                                                Tudom
                                            </span>
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleStatus(word, 'learning')
                                            }
                                            title="Folyamatban"
                                            className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                                                word.status === 'learning'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-blue-100 hover:text-blue-700'
                                            }`}
                                        >
                                            <Clock className="size-3" />
                                            <span className="hidden sm:inline">
                                                Tanulom
                                            </span>
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleStatus(word, 'saved')
                                            }
                                            title="Mentés későbbre"
                                            className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                                                word.status === 'saved'
                                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-orange-100 hover:text-orange-700'
                                            }`}
                                        >
                                            <BookMarked className="size-3" />
                                            <span className="hidden sm:inline">
                                                Később
                                            </span>
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleStatus(
                                                    word,
                                                    'pronunciation',
                                                )
                                            }
                                            title="Kiejtési nehézség"
                                            className={`flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                                                word.status === 'pronunciation'
                                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-violet-100 hover:text-violet-700'
                                            }`}
                                        >
                                            <Mic className="size-3" />
                                            <span className="hidden sm:inline">
                                                Kiejtés
                                            </span>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Pagination */}
                {words.last_page > 1 && (
                    <div className="flex flex-wrap justify-center gap-1">
                        {words.links.map((link, i) => {
                            const pageNum = link.url
                                ? Number(
                                      new URL(link.url).searchParams.get(
                                          'page',
                                      ) ?? 1,
                                  )
                                : null;
                            const hasMarks =
                                pageNum !== null &&
                                !link.active &&
                                markedPages.includes(pageNum);

                            return (
                                <button
                                    key={i}
                                    disabled={!link.url}
                                    onClick={() => {
                                        if (link.url && pageNum)
                                            navigate({ page: pageNum });
                                    }}
                                    className={`relative rounded-md px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        link.active
                                            ? 'bg-primary font-medium text-primary-foreground'
                                            : hasMarks
                                              ? 'border border-green-400 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-700 dark:bg-green-950/30 dark:text-green-300'
                                              : 'border hover:bg-accent'
                                    }`}
                                    dangerouslySetInnerHTML={{
                                        __html: link.label,
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Flip mode FAB */}
            <button
                onClick={() => setFlipMode((v) => !v)}
                title={
                    flipMode
                        ? 'Vissza az alap módra'
                        : 'Fordított mód: magyar → angol'
                }
                className={`fixed right-6 bottom-6 z-50 flex cursor-pointer items-center gap-2.5 rounded-full px-5 py-3.5 shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95 ${
                    flipMode
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                        : 'border-2 border-primary/40 bg-card text-foreground hover:border-primary'
                }`}
            >
                <ArrowLeftRight className="size-5 shrink-0" />
                <span className="hidden text-sm font-semibold sm:inline">
                    {flipMode ? 'Magyar → Angol' : 'Fordított mód'}
                </span>
            </button>

            {/* Word detail modal */}
            <Dialog
                open={selectedWord !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedWordId(null);
                }}
            >
                <DialogContent className="sm:max-w-sm">
                    {selectedWord && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl">
                                    {flipMode ? (
                                        (selectedWord.meaning ?? (
                                            <span className="text-lg text-muted-foreground italic">
                                                nincs fordítás
                                            </span>
                                        ))
                                    ) : (
                                        <>
                                            {selectedWord.word}
                                            <button
                                                onClick={() =>
                                                    speak(selectedWord.word)
                                                }
                                                title="Felolvasás"
                                                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                            >
                                                <Volume2 className="size-4" />
                                            </button>
                                        </>
                                    )}
                                </DialogTitle>
                                <p className="text-xs text-muted-foreground">
                                    #{selectedWord.rank}
                                </p>
                            </DialogHeader>

                            <div className="rounded-lg border px-4 py-3">
                                {flipMode ? (
                                    <p className="flex items-center gap-2 text-base font-medium">
                                        {selectedWord.word}
                                        <button
                                            onClick={() =>
                                                speak(selectedWord.word)
                                            }
                                            title="Felolvasás"
                                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                        >
                                            <Volume2 className="size-4" />
                                        </button>
                                    </p>
                                ) : selectedWord.meaning ? (
                                    <p className="text-base">
                                        {selectedWord.meaning}
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                        Nincs fordítás megadva
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() =>
                                        handleStatus(selectedWord, 'known')
                                    }
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                                        selectedWord.status === 'known'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                                            : 'bg-secondary text-muted-foreground hover:bg-green-100 hover:text-green-700'
                                    }`}
                                >
                                    <CheckCheck className="size-4" /> Tudom
                                </button>
                                <button
                                    onClick={() =>
                                        handleStatus(selectedWord, 'learning')
                                    }
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                                        selectedWord.status === 'learning'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                            : 'bg-secondary text-muted-foreground hover:bg-blue-100 hover:text-blue-700'
                                    }`}
                                >
                                    <Clock className="size-4" /> Tanulom
                                </button>
                                <button
                                    onClick={() =>
                                        handleStatus(selectedWord, 'saved')
                                    }
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                                        selectedWord.status === 'saved'
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                            : 'bg-secondary text-muted-foreground hover:bg-orange-100 hover:text-orange-700'
                                    }`}
                                >
                                    <BookMarked className="size-4" /> Később
                                </button>
                                <button
                                    onClick={() =>
                                        handleStatus(
                                            selectedWord,
                                            'pronunciation',
                                        )
                                    }
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                                        selectedWord.status === 'pronunciation'
                                            ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400'
                                            : 'bg-secondary text-muted-foreground hover:bg-violet-100 hover:text-violet-700'
                                    }`}
                                >
                                    <Mic className="size-4" /> Kiejtés
                                </button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

WordsIndex.layout = {
    breadcrumbs: [{ title: 'Top 10 000 szó', href: index() }],
};
