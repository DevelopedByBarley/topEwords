import { Head, router } from '@inertiajs/react';
import { CheckCheck, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { index, toggle } from '@/routes/words';

interface Word {
    id: number;
    word: string;
    rank: number;
    is_known: boolean;
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
    filters: { search: string; letter: string };
    stats: { total: number; known: number };
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function WordsIndex({ words, filters, stats }: Props) {
    const [search, setSearch] = useState(filters.search);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressPercent = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;

    useEffect(() => {
        setSearch(filters.search);
    }, [filters.search]);

    const navigate = useCallback(
        (params: { search?: string; letter?: string; page?: number }) => {
            router.get(
                index(),
                {
                    search: params.search ?? filters.search,
                    letter: params.letter !== undefined ? params.letter : filters.letter,
                    page: params.page ?? 1,
                },
                { preserveScroll: false, replace: true },
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

    function handleToggle(word: Word) {
        router
            .optimistic((props: { words: PaginatedWords; stats: { total: number; known: number } }) => ({
                words: {
                    ...props.words,
                    data: props.words.data.map((w) => (w.id === word.id ? { ...w, is_known: !w.is_known } : w)),
                },
                stats: {
                    ...props.stats,
                    known: props.stats.known + (word.is_known ? -1 : 1),
                },
            }))
            .post(toggle(word.id), { preserveScroll: true, only: ['words', 'stats'] });
    }

    return (
        <>
            <Head title="Top 10 000 angol szó" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Top 10 000 angol szó</h1>
                    <p className="text-muted-foreground text-sm">Jelöld meg a szavakat, amelyeket már ismersz.</p>
                </div>

                {/* Progress */}
                <div className="rounded-xl border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Ismert szavak</span>
                        <span className="text-muted-foreground">
                            {stats.known.toLocaleString()} / {stats.total.toLocaleString()} ({progressPercent}%)
                        </span>
                    </div>
                    <div className="bg-secondary h-2.5 w-full overflow-hidden rounded-full">
                        <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        type="search"
                        placeholder="Keresés..."
                        className="pl-9 pr-9"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                            onClick={() => handleSearchChange('')}
                            aria-label="Törlés"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                {/* Letter navigation */}
                {!search && (
                    <div className="flex flex-wrap gap-1">
                        <Button
                            size="sm"
                            variant={!filters.letter || filters.letter === 'ALL' ? 'default' : 'outline'}
                            onClick={() => handleLetterClick('ALL')}
                        >
                            Összes
                        </Button>
                        {LETTERS.map((letter) => (
                            <Button
                                key={letter}
                                size="sm"
                                variant={filters.letter === letter ? 'default' : 'outline'}
                                onClick={() => handleLetterClick(letter)}
                            >
                                {letter}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Word count */}
                <p className="text-muted-foreground text-sm">
                    {words.total.toLocaleString()} szó
                    {words.last_page > 1 && (
                        <span>
                            {' '}
                            &mdash; {words.current_page}. / {words.last_page}. oldal
                        </span>
                    )}
                </p>

                {/* Word list */}
                {words.data.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center justify-center py-16 text-center">
                        <Search className="mb-3 size-10 opacity-30" />
                        <p className="font-medium">Nincs találat</p>
                        <p className="text-sm">Próbálj más keresési feltételt.</p>
                    </div>
                ) : (
                    <div className="rounded-xl border">
                        <ul className="divide-y">
                            {words.data.map((word) => (
                                <li
                                    key={word.id}
                                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${word.is_known ? 'bg-green-50 dark:bg-green-950/20' : ''}`}
                                >
                                    <span className="text-muted-foreground w-12 shrink-0 text-right text-xs tabular-nums">
                                        #{word.rank}
                                    </span>
                                    <span
                                        className={`flex-1 font-medium ${word.is_known ? 'text-green-700 dark:text-green-400' : ''}`}
                                    >
                                        {word.word}
                                    </span>
                                    <button
                                        onClick={() => handleToggle(word)}
                                        className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                            word.is_known
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/60'
                                                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                                        }`}
                                        aria-label={word.is_known ? 'Ismertem törlése' : 'Megjelölés ismertként'}
                                    >
                                        {word.is_known && <CheckCheck className="size-3" />}
                                        {word.is_known ? 'Ismerem' : 'Jelölés'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Pagination */}
                {words.last_page > 1 && (
                    <div className="flex flex-wrap justify-center gap-1">
                        {words.links.map((link, i) => (
                            <button
                                key={i}
                                disabled={!link.url}
                                onClick={() => {
                                    if (link.url) {
                                        const url = new URL(link.url);
                                        navigate({ page: Number(url.searchParams.get('page') ?? 1) });
                                    }
                                }}
                                className={`rounded-md px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                    link.active ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-accent border'
                                }`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

WordsIndex.layout = {
    breadcrumbs: [{ title: 'Top 10 000 szó', href: index() }],
};
