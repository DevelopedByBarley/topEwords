import { Head } from '@inertiajs/react';
import { Activity, CheckCheck, Clock, BookMarked, Mic, Users, TrendingUp, Flame } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';

interface Stats {
    totalUsers: number;
    verifiedUsers: number;
    usersThisWeek: number;
    usersThisMonth: number;
    activeToday: number;
    totalWordStatuses: number;
    known: number;
    learning: number;
    saved: number;
    pronunciation: number;
}

interface User {
    name: string;
    email: string;
    streak: number;
    last_activity_date: string | null;
    created_at?: string;
    email_verified_at?: string | null;
    known_words_count?: number;
}

interface RegistrationDay {
    date: string;
    count: number;
}

interface Props {
    stats: Stats;
    topStreaks: User[];
    recentUsers: User[];
    mostActive: User[];
    registrationsByDay: RegistrationDay[];
}

export default function AdminIndex({ stats, topStreaks, recentUsers, mostActive, registrationsByDay }: Props) {
    const maxDayCount = Math.max(...registrationsByDay.map((d) => d.count), 1);

    return (
        <>
            <Head title="Admin" />

            <div className="min-h-screen bg-zinc-950 text-zinc-100">
                {/* Header */}
                <header className="border-b border-zinc-800 px-6 py-4">
                    <div className="mx-auto flex max-w-7xl items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                            <AppLogoIcon className="size-4.5 text-primary-foreground" />
                        </div>
                        <div>
                            <span className="font-semibold tracking-tight">TopWords</span>
                            <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">admin</span>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl px-6 py-10 space-y-10">

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                        {[
                            { label: 'Összes felhasználó', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
                            { label: 'Hitelesített email', value: stats.verifiedUsers, icon: CheckCheck, color: 'text-green-400' },
                            { label: 'Ez a hónap', value: stats.usersThisMonth, icon: TrendingUp, color: 'text-violet-400' },
                            { label: 'Ez a hét', value: stats.usersThisWeek, icon: Activity, color: 'text-orange-400' },
                            { label: 'Ma aktív', value: stats.activeToday, icon: Flame, color: 'text-red-400' },
                        ].map((s) => (
                            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                                <s.icon className={`mb-3 size-5 ${s.color}`} />
                                <div className="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
                                <div className="mt-0.5 text-xs text-zinc-500">{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Word statuses */}
                    <div>
                        <h2 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">Szóstátuszok összesen</h2>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {[
                                { label: 'Tudom', value: stats.known, icon: CheckCheck, color: 'text-[#00ADB5] bg-[#00ADB5]/10' },
                                { label: 'Tanulom', value: stats.learning, icon: Clock, color: 'text-blue-400 bg-blue-400/10' },
                                { label: 'Később', value: stats.saved, icon: BookMarked, color: 'text-orange-400 bg-orange-400/10' },
                                { label: 'Kiejtés', value: stats.pronunciation, icon: Mic, color: 'text-violet-400 bg-violet-400/10' },
                            ].map((s) => (
                                <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                                        <s.icon className="size-4.5" />
                                    </div>
                                    <div className="text-2xl font-bold tabular-nums">{s.value.toLocaleString()}</div>
                                    <div className="mt-0.5 text-xs text-zinc-500">{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Registrations chart (last 30 days) */}
                    {registrationsByDay.length > 0 && (
                        <div>
                            <h2 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">Regisztrációk – utolsó 30 nap</h2>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                                <div className="flex h-28 items-end gap-1">
                                    {registrationsByDay.map((d) => (
                                        <div key={d.date} className="group relative flex flex-1 flex-col items-center">
                                            <div
                                                className="w-full rounded-sm bg-primary/70 transition-all group-hover:bg-primary"
                                                style={{ height: `${Math.round((d.count / maxDayCount) * 100)}%`, minHeight: '2px' }}
                                            />
                                            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-700 px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100">
                                                {d.date}: {d.count}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-zinc-600">
                                    <span>{registrationsByDay[0]?.date}</span>
                                    <span>{registrationsByDay[registrationsByDay.length - 1]?.date}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-8 lg:grid-cols-2">
                        {/* Recent registrations */}
                        <div>
                            <h2 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">Legutóbbi regisztrációk</h2>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Felhasználó</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Regisztrált</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Streak</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {recentUsers.map((u) => (
                                            <tr key={u.email} className="hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium truncate max-w-[160px]">{u.name}</div>
                                                    <div className="text-xs text-zinc-500 truncate max-w-[160px]">{u.email}</div>
                                                    {!u.email_verified_at && (
                                                        <span className="text-[10px] text-orange-400">nem hitelesített</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                                                    {u.created_at ? new Date(u.created_at).toLocaleDateString('hu-HU') : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {u.streak > 0 ? (
                                                        <span className="inline-flex items-center gap-1 text-orange-400 font-medium">
                                                            <Flame className="size-3" />{u.streak}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-700">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Most active users */}
                        <div>
                            <h2 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">Legaktívabb felhasználók</h2>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Felhasználó</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Szavak</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Streak</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {mostActive.map((u, i) => (
                                            <tr key={u.email} className="hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-4 py-3 text-zinc-600 tabular-nums">{i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium truncate max-w-[160px]">{u.name}</div>
                                                    <div className="text-xs text-zinc-500 truncate max-w-[160px]">{u.email}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium tabular-nums">
                                                    {(u.known_words_count ?? 0).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {u.streak > 0 ? (
                                                        <span className="inline-flex items-center justify-end gap-1 text-orange-400 font-medium">
                                                            <Flame className="size-3" />{u.streak}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-700">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Top streaks */}
                    {topStreaks.length > 0 && (
                        <div>
                            <h2 className="mb-4 text-sm font-medium text-zinc-400 uppercase tracking-wider">Top streaks</h2>
                            <div className="flex flex-wrap gap-3">
                                {topStreaks.map((u, i) => (
                                    <div key={u.email} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                                        <span className="text-sm text-zinc-600 tabular-nums w-4">{i + 1}</span>
                                        <div>
                                            <div className="text-sm font-medium">{u.name}</div>
                                            <div className="text-xs text-zinc-500">{u.email}</div>
                                        </div>
                                        <span className="ml-2 flex items-center gap-1 text-orange-400 font-bold text-lg">
                                            <Flame className="size-4" />{u.streak}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </>
    );
}
