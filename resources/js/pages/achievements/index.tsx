import { Head, Link } from '@inertiajs/react';
import { Check, Lock, Medal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { index as achievementsIndex } from '@/routes/achievements';
import { index as wordsIndex } from '@/routes/words';

interface AchievementItem {
    key: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlocked_at: string | null;
}

interface AchievementGroup {
    key: string;
    label: string;
    items: AchievementItem[];
}

interface Props {
    grouped: AchievementGroup[];
    totalUnlocked: number;
    totalAchievements: number;
}

type Filter = 'all' | 'unlocked' | 'locked';

function ProgressBar({
    percent,
    label,
    trackClassName,
    barClassName,
}: {
    percent: number;
    label: string;
    trackClassName: string;
    barClassName: string;
}) {
    return (
        <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
            className={cn(
                'w-full overflow-hidden rounded-full',
                trackClassName,
            )}
        >
            <div
                className={cn(
                    'h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none',
                    barClassName,
                )}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

function AchievementCard({ item }: { item: AchievementItem }) {
    return (
        <div
            className={cn(
                'flex h-full items-start gap-3.5 rounded-2xl border p-4',
                item.unlocked
                    ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
                    : 'border-dashed border-neutral-300 bg-muted/30 dark:border-neutral-700 dark:bg-transparent',
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl',
                    item.unlocked
                        ? 'bg-amber-100 dark:bg-amber-900/40'
                        : 'bg-muted',
                )}
            >
                {item.unlocked ? (
                    item.icon
                ) : (
                    <Lock className="size-4.5 text-muted-foreground" />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                    {!item.unlocked && (
                        <span className="sr-only">Még nincs feloldva – </span>
                    )}
                    {item.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {item.description}
                </p>
                {item.unlocked && item.unlocked_at && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                        <Check className="size-3" aria-hidden="true" />
                        Feloldva: {item.unlocked_at}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function Achievements({
    grouped,
    totalUnlocked,
    totalAchievements,
}: Props) {
    const [filter, setFilter] = useState<Filter>('all');

    const progress =
        totalAchievements > 0
            ? Math.round((totalUnlocked / totalAchievements) * 100)
            : 0;
    const remaining = totalAchievements - totalUnlocked;

    /**
     * A szűrő csak a megjelenítést szűkíti. Az üresre fogyó csoportokat
     * elrejtjük, hogy ne maradjanak tartalom nélküli fejlécek a listában.
     */
    const visibleGroups = useMemo(
        () =>
            grouped
                .map((group) => ({
                    ...group,
                    unlockedCount: group.items.filter((item) => item.unlocked)
                        .length,
                    visibleItems: group.items.filter(
                        (item) =>
                            filter === 'all' ||
                            (filter === 'unlocked') === item.unlocked,
                    ),
                }))
                .filter((group) => group.visibleItems.length > 0),
        [grouped, filter],
    );

    const filters: { key: Filter; label: string; count: number }[] = [
        { key: 'all', label: 'Mind', count: totalAchievements },
        { key: 'unlocked', label: 'Feloldva', count: totalUnlocked },
        { key: 'locked', label: 'Hátralévő', count: remaining },
    ];

    return (
        <>
            <Head title="Teljesítmények" />

            <div className="mx-auto flex h-full w-full max-w-[2000px] flex-1 flex-col gap-6 p-4 md:p-6 xl:px-10 2xl:px-16">
                {/* Hero */}
                <div
                    className="relative overflow-hidden rounded-3xl p-6 md:p-8"
                    style={{
                        background: 'linear-gradient(135deg,#4338CA,#4F8EEC)',
                    }}
                >
                    <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
                    <div className="pointer-events-none absolute right-28 -bottom-24 size-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-xl">
                            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                                Teljesítmények
                            </h1>
                            <p className="mt-1.5 text-sm text-white/85 md:text-base">
                                {remaining === 0
                                    ? 'Minden jelvényt begyűjtöttél – szép munka! Tartsd meg a lendületet.'
                                    : 'Tanulás közben automatikusan gyűjtöd a jelvényeket. Itt látod, mit szereztél már meg, és mi vár még rád.'}
                            </p>
                        </div>
                        <div className="flex w-full shrink-0 flex-col gap-2 rounded-2xl bg-white/15 px-5 py-4 ring-1 ring-white/20 sm:w-64">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-4xl font-bold text-white tabular-nums">
                                    {totalUnlocked}
                                    <span className="text-lg font-semibold text-white/70">
                                        /{totalAchievements}
                                    </span>
                                </span>
                                <span className="text-sm font-bold text-white/85 tabular-nums">
                                    {progress}%
                                </span>
                            </div>
                            <ProgressBar
                                percent={progress}
                                label={`Összesített haladás: ${progress}%`}
                                trackClassName="h-2 bg-white/25"
                                barClassName="h-2 bg-white"
                            />
                            <span className="text-xs text-white/75">
                                {remaining === 0
                                    ? 'Minden teljesítmény feloldva 🎉'
                                    : `Még ${remaining} teljesítmény vár rád`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Szűrő */}
                <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Teljesítmények szűrése"
                >
                    {filters.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => setFilter(option.key)}
                            aria-pressed={filter === option.key}
                            className={cn(
                                'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                filter === option.key
                                    ? 'bg-linear-to-br from-indigo-600 to-indigo-800 text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            {option.label}
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-xs font-bold tabular-nums',
                                    filter === option.key
                                        ? 'bg-white/20'
                                        : 'bg-background/70',
                                )}
                            >
                                {option.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Csoportok */}
                {visibleGroups.map((group) => {
                    const groupPercent =
                        group.items.length > 0
                            ? Math.round(
                                  (group.unlockedCount / group.items.length) *
                                      100,
                              )
                            : 0;
                    const groupComplete =
                        group.items.length > 0 &&
                        group.unlockedCount === group.items.length;

                    return (
                        <section
                            key={group.key}
                            aria-labelledby={`group-${group.key}`}
                            className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-card"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <h2
                                        id={`group-${group.key}`}
                                        className="font-semibold"
                                    >
                                        {group.label}
                                    </h2>
                                    {groupComplete && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                            <Check
                                                className="size-3"
                                                aria-hidden="true"
                                            />
                                            Teljesítve
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-bold text-muted-foreground tabular-nums">
                                    {group.unlockedCount} / {group.items.length}
                                </span>
                            </div>

                            <ProgressBar
                                percent={groupPercent}
                                label={`${group.label}: ${groupPercent}%`}
                                trackClassName="mt-3 h-1.5 bg-secondary"
                                barClassName="h-1.5 bg-amber-400 dark:bg-amber-500"
                            />

                            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {group.visibleItems.map((item) => (
                                    <li key={item.key}>
                                        <AchievementCard item={item} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}

                {visibleGroups.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
                        <Medal
                            className="size-8 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <p className="font-semibold">
                            {filter === 'unlocked'
                                ? 'Még nincs feloldott teljesítményed'
                                : 'Minden teljesítményt feloldottál'}
                        </p>
                        <p className="max-w-sm text-sm text-muted-foreground">
                            {filter === 'unlocked'
                                ? 'Jelöld meg a szólistában, mely szavakat ismered már – az első jelvények pár perc alatt megvannak.'
                                : 'Nincs több begyűjthető jelvény. Gratulálunk!'}
                        </p>
                        {filter === 'unlocked' && (
                            <Link
                                href={wordsIndex()}
                                className="mt-1 inline-flex items-center gap-2 rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-3 text-sm font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                            >
                                Irány a szólista
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

Achievements.layout = {
    breadcrumbs: [{ title: 'Teljesítmények', href: achievementsIndex() }],
};
