import { NotebookPen, Plus } from 'lucide-react';
import { STATUS_CONFIG } from '@/components/words/types';

export interface WordStats {
    total: number;
    known: number;
    learning: number;
    saved: number;
    pronunciation: number;
    practice: number;
}

interface WordProgressCardProps {
    stats: WordStats;
    customStats: WordStats;
    /** Az épp aktív státusz-szűrő ('' = nincs). */
    activeStatus: string;
    onStatusFilter: (status: string) => void;
    /** Igaz, ha a lista épp csak a saját szavakra van szűrve. */
    customOnly: boolean;
    onCustomOnlyToggle: () => void;
    onAddCustomWord: () => void;
}

/**
 * Kerekítés helyett „<1%”, amíg van már ismert szó: 10 000-es nevezőnél az
 * első több tucat megjelölés különben 0%-nak látszana.
 */
function formatPercent(percent: number, known: number): string {
    if (percent === 0 && known > 0) {
        return '<1%';
    }

    return `${percent}%`;
}

/**
 * A szólista haladás-kártyája: összesített sáv + státuszonkénti csempék. A
 * csempék egyben a státusz-szűrő gombjai is (az aktívra kattintva kikapcsol),
 * így a szám és a rá szűrés ugyanaz a felület — nincs külön szűrő-chipsor.
 */
export default function WordProgressCard({
    stats,
    customStats,
    activeStatus,
    onStatusFilter,
    customOnly,
    onCustomOnlyToggle,
    onAddCustomWord,
}: WordProgressCardProps) {
    const percent =
        stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
    const customMarked = STATUS_CONFIG.filter((s) => customStats[s.value] > 0);

    return (
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-card">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h2 className="font-semibold">Haladás</h2>
                    <p className="text-xs text-muted-foreground">
                        Kattints egy csempére, hogy csak azokat a szavakat lásd.
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <span className="block text-2xl font-bold tabular-nums">
                        {formatPercent(percent, stats.known)}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {stats.known.toLocaleString()} /{' '}
                        {stats.total.toLocaleString()}
                    </span>
                </div>
            </div>

            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Összesített haladás: ${percent}%`}
                className="mb-5 h-3 w-full overflow-hidden rounded-full bg-indigo-50 dark:bg-neutral-800"
            >
                <div
                    className="h-3 rounded-full bg-linear-to-r from-indigo-600 to-indigo-800 transition-all duration-500"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {STATUS_CONFIG.map(
                    ({ value, label, icon: Icon, pillActive, tileRing }) => {
                        const isActive = activeStatus === value;

                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() =>
                                    onStatusFilter(isActive ? '' : value)
                                }
                                className={`flex cursor-pointer flex-col gap-1 rounded-2xl p-3 text-left transition-all ${pillActive} ${
                                    isActive
                                        ? `ring-2 ${tileRing}`
                                        : 'ring-1 ring-transparent ring-inset hover:ring-black/10 dark:hover:ring-white/15'
                                }`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <Icon className="size-3.5" />
                                    <span className="text-xs font-medium">
                                        {label}
                                    </span>
                                </span>
                                <span className="text-2xl font-bold tabular-nums">
                                    {stats[value].toLocaleString()}
                                </span>
                            </button>
                        );
                    },
                )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex items-center gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/40">
                        <NotebookPen className="size-4 text-indigo-700 dark:text-indigo-400" />
                    </span>
                    <div>
                        <span className="text-sm font-semibold">
                            Saját szavak
                        </span>
                        {customStats.total === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Vedd fel a szavakat, amiket külön szeretnél
                                követni.
                            </p>
                        ) : (
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground tabular-nums">
                                    {customStats.total.toLocaleString()} szó
                                </span>
                                {customMarked.map(
                                    ({ value, label, icon: Icon }) => (
                                        <span
                                            key={value}
                                            className="flex items-center gap-1"
                                        >
                                            <Icon className="size-3" />
                                            {label}:{' '}
                                            <span className="tabular-nums">
                                                {customStats[
                                                    value
                                                ].toLocaleString()}
                                            </span>
                                        </span>
                                    ),
                                )}
                            </p>
                        )}
                    </div>
                </div>
                {/* Ha már van saját szó, a szűrő a hasznos akció — a felvitel
                    CTA-ja ilyenkor a fejléc gombja marad, nem duplázzuk. */}
                {customStats.total > 0 ? (
                    <button
                        type="button"
                        aria-pressed={customOnly}
                        onClick={onCustomOnlyToggle}
                        className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            customOnly
                                ? 'bg-indigo-600 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                    >
                        {customOnly ? 'Csak a sajátjaim ✓' : 'Csak a sajátjaim'}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onAddCustomWord}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-linear-to-br from-green-400 to-green-500 px-3.5 py-1.5 text-xs font-bold text-green-950 transition-all hover:brightness-105"
                    >
                        <Plus className="size-3.5" />
                        Új szó
                    </button>
                )}
            </div>
        </section>
    );
}
