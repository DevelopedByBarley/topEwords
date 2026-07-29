import {
    ChevronDown,
    FolderOpen,
    Plus,
    Search,
    SlidersHorizontal,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FilterChip, FilterGroup } from '@/components/words/filter-chip';
import { LEVELS, STATUS_CONFIG } from '@/components/words/types';

export interface WordFilterValues {
    search: string;
    letter: string;
    level: number | null;
    status: string;
    importance: number | null;
    folder: number | null;
    source: string;
    per_page: number;
}

/** Csak azokat a kulcsokat lehet módosítani, amelyeket a szülő navigate-je ismer. */
export type WordFilterPatch = Partial<WordFilterValues> & { page?: number };

interface Folder {
    id: number;
    name: string;
    words_count: number;
}

interface WordFiltersProps {
    filters: WordFilterValues;
    /** A kereső beírt (debounce előtti) értéke — a szülő birtokolja. */
    search: string;
    onSearchChange: (value: string) => void;
    onChange: (patch: WordFilterPatch) => void;
    /** Minden szűrő alaphelyzetbe — a szülő a kereső-debounce-t is eldobja. */
    onReset: () => void;
    folders: Folder[];
    markedLetters: string[];
    /** A saját szavak száma — a „Forrás” csoport csak akkor jelenik meg, ha van. */
    customTotal: number;
    perPageOptions: readonly number[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const PANEL_STORAGE_KEY = 'words_filters_open';

/**
 * A szólista keresője és szűrői. A ritkábban használt csoportok (szint,
 * fontosság, mappa, forrás, betű) egy összecsukható panelben laknak, hogy a
 * szólista ne csússzon két képernyővel lejjebb; ami épp aktív, az mindig
 * látszik egy törölhető chipként.
 */
export default function WordFilters({
    filters,
    search,
    onSearchChange,
    onChange,
    onReset,
    folders,
    markedLetters,
    customTotal,
    perPageOptions,
}: WordFiltersProps) {
    const [open, setOpen] = useState(
        () => localStorage.getItem(PANEL_STORAGE_KEY) === '1',
    );

    function togglePanel() {
        setOpen((prev) => {
            localStorage.setItem(PANEL_STORAGE_KEY, prev ? '0' : '1');

            return !prev;
        });
    }

    const letterActive =
        filters.letter !== '' && filters.letter !== 'ALL'
            ? filters.letter
            : null;

    /** Az aktív szűrők törölhető chipjei — a keresőmező külön sorban van. */
    const activeChips: { key: string; label: string; clear: () => void }[] = [];

    if (filters.level !== null) {
        activeChips.push({
            key: 'level',
            label: `${filters.level}. szint`,
            clear: () => onChange({ level: null, page: 1 }),
        });
    }

    if (filters.status !== '') {
        const status = STATUS_CONFIG.find((s) => s.value === filters.status);

        activeChips.push({
            key: 'status',
            label: status?.label ?? filters.status,
            clear: () => onChange({ status: '', page: 1 }),
        });
    }

    if (filters.importance !== null) {
        activeChips.push({
            key: 'importance',
            label: '★'.repeat(filters.importance),
            clear: () => onChange({ importance: null, page: 1 }),
        });
    }

    if (filters.folder !== null) {
        const folder = folders.find((f) => f.id === filters.folder);

        activeChips.push({
            key: 'folder',
            label: folder?.name ?? 'Mappa',
            clear: () => onChange({ folder: null, page: 1 }),
        });
    }

    if (filters.source === 'custom') {
        activeChips.push({
            key: 'source',
            label: 'Csak saját szavak',
            clear: () => onChange({ source: '', page: 1 }),
        });
    }

    if (letterActive) {
        activeChips.push({
            key: 'letter',
            label: `${letterActive} betű`,
            clear: () => onChange({ letter: 'ALL', page: 1 }),
        });
    }

    const activeCount = activeChips.length + (search !== '' ? 1 : 0);

    return (
        <section className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5 dark:border-neutral-700 dark:bg-card">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Keresés a szavak között..."
                        className="rounded-full border-0 bg-muted pr-9 pl-10"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {search && (
                        <button
                            type="button"
                            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => onSearchChange('')}
                            aria-label="Keresés törlése"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
                <Select
                    value={String(filters.per_page)}
                    onValueChange={(v) =>
                        onChange({ per_page: Number(v), page: 1 })
                    }
                >
                    <SelectTrigger className="w-28 rounded-full border-0 bg-muted text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {perPageOptions.map((n) => (
                            <SelectItem key={n} value={String(n)}>
                                {n} / oldal
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={togglePanel}
                    aria-expanded={open}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    <SlidersHorizontal className="size-3.5" />
                    Szűrők
                    {activeCount > 0 && (
                        <span className="rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white tabular-nums">
                            {activeCount}
                        </span>
                    )}
                    <ChevronDown
                        className={`size-3.5 transition-transform ${open ? '' : '-rotate-90'}`}
                    />
                </button>

                {activeChips.map(({ key, label, clear }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={clear}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-800 transition-colors hover:bg-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
                    >
                        {label}
                        <X className="size-3" />
                    </button>
                ))}

                {activeCount > 0 && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        Összes törlése
                    </button>
                )}
            </div>

            {open && (
                <div className="flex flex-col gap-4 border-t pt-4">
                    {!search && (
                        <FilterGroup label="Szint">
                            <FilterChip
                                active={filters.level === null}
                                onClick={() =>
                                    onChange({
                                        search: '',
                                        level: null,
                                        letter: 'ALL',
                                        page: 1,
                                    })
                                }
                            >
                                Mind
                            </FilterChip>
                            {LEVELS.map((l) => (
                                <FilterChip
                                    key={l.value}
                                    active={filters.level === l.value}
                                    onClick={() =>
                                        onChange({
                                            search: '',
                                            level: l.value,
                                            letter: 'ALL',
                                            page: 1,
                                        })
                                    }
                                >
                                    {l.value}. {l.label}
                                </FilterChip>
                            ))}
                        </FilterGroup>
                    )}

                    <FilterGroup label="Fontosság">
                        <FilterChip
                            active={filters.importance === null}
                            onClick={() =>
                                onChange({ importance: null, page: 1 })
                            }
                        >
                            Mind
                        </FilterChip>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <FilterChip
                                key={n}
                                active={filters.importance === n}
                                activeClass="bg-amber-400 text-amber-950 shadow-sm"
                                onClick={() =>
                                    onChange({ importance: n, page: 1 })
                                }
                                title={`${n} csillag`}
                            >
                                {'★'.repeat(n)}
                            </FilterChip>
                        ))}
                    </FilterGroup>

                    {folders.length > 0 && (
                        <FilterGroup label="Mappa">
                            <FilterChip
                                active={filters.folder === null}
                                onClick={() =>
                                    onChange({ folder: null, page: 1 })
                                }
                            >
                                Mind
                            </FilterChip>
                            {folders.map((f) => (
                                <FilterChip
                                    key={f.id}
                                    active={filters.folder === f.id}
                                    onClick={() =>
                                        onChange({ folder: f.id, page: 1 })
                                    }
                                >
                                    <FolderOpen className="size-3.5" />
                                    {f.name}
                                    <span className="font-normal opacity-75">
                                        {f.words_count}
                                    </span>
                                </FilterChip>
                            ))}
                        </FilterGroup>
                    )}

                    {customTotal > 0 && (
                        <FilterGroup label="Forrás">
                            <FilterChip
                                active={filters.source !== 'custom'}
                                onClick={() =>
                                    onChange({ source: '', page: 1 })
                                }
                            >
                                Minden szó
                            </FilterChip>
                            <FilterChip
                                active={filters.source === 'custom'}
                                onClick={() =>
                                    onChange({ source: 'custom', page: 1 })
                                }
                            >
                                <Plus className="size-3.5" />
                                Saját szavak
                                <span className="font-normal opacity-75">
                                    {customTotal}
                                </span>
                            </FilterChip>
                        </FilterGroup>
                    )}

                    {!search && (
                        <FilterGroup label="Betű">
                            <FilterChip
                                active={letterActive === null}
                                onClick={() =>
                                    onChange({
                                        search: '',
                                        letter: 'ALL',
                                        page: 1,
                                    })
                                }
                            >
                                Összes
                            </FilterChip>
                            {LETTERS.map((letter) => {
                                const hasMarks = markedLetters.includes(letter);
                                const isActive = letterActive === letter;

                                return (
                                    <FilterChip
                                        key={letter}
                                        active={isActive}
                                        onClick={() =>
                                            onChange({
                                                search: '',
                                                letter,
                                                page: 1,
                                            })
                                        }
                                    >
                                        {letter}
                                        {hasMarks && !isActive && (
                                            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-indigo-500 opacity-80" />
                                        )}
                                    </FilterChip>
                                );
                            })}
                        </FilterGroup>
                    )}
                </div>
            )}
        </section>
    );
}
