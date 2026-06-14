import { Head } from '@inertiajs/react';
import { Lock } from 'lucide-react';
import { index as achievementsIndex } from '@/routes/achievements';

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

export default function Achievements({ grouped, totalUnlocked, totalAchievements }: Props) {
    const progress = Math.round((totalUnlocked / totalAchievements) * 100);

    return (
        <>
            <Head title="Teljesítmények" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Teljesítmények</h1>
                    <p className="text-sm text-muted-foreground">
                        {totalUnlocked} / {totalAchievements} teljesítmény feloldva
                    </p>
                </div>

                {/* Progress bar */}
                <div className="rounded-xl border bg-card p-5">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Összesített haladás</span>
                        <span className="font-bold text-primary">{progress}%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-3 rounded-full bg-yellow-400 transition-all duration-700 dark:bg-yellow-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Még {totalAchievements - totalUnlocked} teljesítmény vár rád
                    </p>
                </div>

                {/* Groups */}
                {grouped.map((group) => {
                    const groupUnlocked = group.items.filter((i) => i.unlocked).length;
                    return (
                        <div key={group.key} className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                    {group.label}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {groupUnlocked} / {group.items.length}
                                </span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {group.items.map((item) => (
                                    <div
                                        key={item.key}
                                        className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                                            item.unlocked
                                                ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/40 dark:bg-yellow-950/20'
                                                : 'bg-card opacity-50'
                                        }`}
                                    >
                                        <div
                                            className={`flex size-12 shrink-0 items-center justify-center rounded-full text-2xl ${
                                                item.unlocked
                                                    ? 'bg-yellow-100 dark:bg-yellow-900/40'
                                                    : 'bg-muted'
                                            }`}
                                        >
                                            {item.unlocked ? item.icon : <Lock className="size-5 text-muted-foreground" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-semibold">{item.title}</p>
                                            <p className="text-xs text-muted-foreground leading-snug">{item.description}</p>
                                            {item.unlocked && item.unlocked_at && (
                                                <p className="mt-1 text-[10px] font-medium text-yellow-600 dark:text-yellow-400">
                                                    Feloldva: {item.unlocked_at}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

Achievements.layout = {
    breadcrumbs: [{ title: 'Teljesítmények', href: achievementsIndex() }],
};
