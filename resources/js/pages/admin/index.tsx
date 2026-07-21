import { Head, router } from '@inertiajs/react';
import {
    Activity,
    CheckCheck,
    Clock,
    BookMarked,
    Gift,
    Mic,
    Trash2,
    Users,
    TrendingUp,
    Flame,
} from 'lucide-react';
import { useState } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Input } from '@/components/ui/input';
import { set as setAccess } from '@/routes/admin/access';
import { grant as grantFreeMonth } from '@/routes/admin/free-month';

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

interface AccessUser {
    id: number;
    name: string;
    email: string;
    plan: 'free' | 'premium';
    plan_override: 'premium' | null;
    subscribed: boolean;
    subscription_plan: 'premium' | null;
    trial_ends_at: string | null;
}

interface Invite {
    id: number;
    code: string;
    label: string | null;
    uses: number;
    max_uses: number;
    expires_at: string | null;
    usable: boolean;
    url: string;
    used_by: string[];
}

interface Props {
    stats: Stats;
    topStreaks: User[];
    recentUsers: User[];
    mostActive: User[];
    registrationsByDay: RegistrationDay[];
    accessUsers: AccessUser[];
    invites: Invite[];
    inviteOnly: boolean;
}

export default function AdminIndex({
    stats,
    topStreaks,
    recentUsers,
    mostActive,
    registrationsByDay,
    accessUsers,
    invites,
    inviteOnly,
}: Props) {
    const [accessSearch, setAccessSearch] = useState('');
    const [inviteLabel, setInviteLabel] = useState('');
    const [inviteMaxUses, setInviteMaxUses] = useState('1');
    const [inviteExpires, setInviteExpires] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    function createInvite() {
        // A datetime-local érték ("2026-07-10T12:00") időzóna nélküli, a szerver app-időzónája
        // viszont UTC — nyersen küldve a lejárat órákkal csúszna. A helyi időpontot abszolút
        // ISO-8601-re (UTC offszettel) konvertáljuk, hogy a szerver pontosan azt kapja, amire
        // az admin a saját idejében gondolt.
        const expiresAtIso = inviteExpires
            ? new Date(inviteExpires).toISOString()
            : null;

        router.post(
            '/admin/invites',
            {
                label: inviteLabel || null,
                max_uses: Number(inviteMaxUses) || 1,
                expires_at: expiresAtIso,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setInviteLabel('');
                    setInviteMaxUses('1');
                    setInviteExpires('');
                },
            },
        );
    }

    function revokeInvite(id: number) {
        if (confirm('Biztosan visszavonod ezt a meghívókódot?')) {
            router.delete(`/admin/invites/${id}`, { preserveScroll: true });
        }
    }

    async function copyInvite(invite: Invite) {
        try {
            if (!navigator.clipboard) {
                throw new Error('clipboard unavailable');
            }

            await navigator.clipboard.writeText(invite.url);
            setCopiedId(invite.id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            // Nem-secure kontextus vagy elutasított írás: ne hazudjunk sikert,
            // hanem adjuk oda a linket, hogy az admin kézzel másolhassa.
            window.prompt('Másold ki a linket:', invite.url);
        }
    }
    const maxDayCount = Math.max(...registrationsByDay.map((d) => d.count), 1);

    const q = accessSearch.trim().toLowerCase();
    const filteredAccessUsers =
        q === ''
            ? accessUsers
            : accessUsers.filter(
                  (u) =>
                      u.name.toLowerCase().includes(q) ||
                      u.email.toLowerCase().includes(q),
              );

    function setUserPlan(email: string, plan: 'premium' | 'none') {
        router.post(setAccess().url, { email, plan }, { preserveScroll: true });
    }

    function giveFreeMonth(email: string) {
        router.post(
            grantFreeMonth().url,
            { email },
            { preserveScroll: true },
        );
    }

    return (
        <>
            <Head title="Admin" />

            <div className="min-h-screen bg-zinc-950 text-zinc-100">
                {/* Teal accent strip */}
                <div className="h-1 bg-linear-to-r from-primary via-primary/80 to-primary/40" />

                {/* Header */}
                <header className="border-b border-zinc-800/60 px-6 py-4">
                    <div className="mx-auto flex max-w-7xl items-center gap-3">
                        <AppLogoIcon className="size-11 rounded-lg shadow-lg shadow-primary/30" />
                        <div className="flex items-center gap-2">
                            <span className="font-semibold tracking-tight">
                                TopWords
                            </span>
                            <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                admin
                            </span>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                        {[
                            {
                                label: 'Összes felhasználó',
                                value: stats.totalUsers,
                                icon: Users,
                                color: 'text-primary',
                            },
                            {
                                label: 'Hitelesített email',
                                value: stats.verifiedUsers,
                                icon: CheckCheck,
                                color: 'text-green-400',
                            },
                            {
                                label: 'Ez a hónap',
                                value: stats.usersThisMonth,
                                icon: TrendingUp,
                                color: 'text-primary',
                            },
                            {
                                label: 'Ez a hét',
                                value: stats.usersThisWeek,
                                icon: Activity,
                                color: 'text-orange-400',
                            },
                            {
                                label: 'Ma aktív',
                                value: stats.activeToday,
                                icon: Flame,
                                color: 'text-red-400',
                            },
                        ].map((s) => (
                            <div
                                key={s.label}
                                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
                            >
                                <s.icon className={`mb-3 size-5 ${s.color}`} />
                                <div className="text-2xl font-bold tabular-nums">
                                    {s.value.toLocaleString()}
                                </div>
                                <div className="mt-0.5 text-xs text-zinc-500">
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Word statuses */}
                    <div>
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                            <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                            Szóstátuszok összesen
                        </h2>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {[
                                {
                                    label: 'Tudom',
                                    value: stats.known,
                                    icon: CheckCheck,
                                    color: 'text-primary bg-primary/10',
                                },
                                {
                                    label: 'Tanulom',
                                    value: stats.learning,
                                    icon: Clock,
                                    color: 'text-blue-400 bg-blue-400/10',
                                },
                                {
                                    label: 'Később',
                                    value: stats.saved,
                                    icon: BookMarked,
                                    color: 'text-orange-400 bg-orange-400/10',
                                },
                                {
                                    label: 'Kiejtés',
                                    value: stats.pronunciation,
                                    icon: Mic,
                                    color: 'text-indigo-400 bg-indigo-400/10',
                                },
                            ].map((s) => (
                                <div
                                    key={s.label}
                                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700"
                                >
                                    <div
                                        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}
                                    >
                                        <s.icon className="size-4.5" />
                                    </div>
                                    <div className="text-2xl font-bold tabular-nums">
                                        {s.value.toLocaleString()}
                                    </div>
                                    <div className="mt-0.5 text-xs text-zinc-500">
                                        {s.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Registrations chart (last 30 days) */}
                    {registrationsByDay.length > 0 && (
                        <div>
                            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                                <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                                Regisztrációk – utolsó 30 nap
                            </h2>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                                <div className="flex h-28 items-end gap-1">
                                    {registrationsByDay.map((d) => (
                                        <div
                                            key={d.date}
                                            className="group relative flex flex-1 flex-col items-center"
                                        >
                                            <div
                                                className="w-full rounded-sm bg-primary/50 transition-all group-hover:bg-primary"
                                                style={{
                                                    height: `${Math.round((d.count / maxDayCount) * 100)}%`,
                                                    minHeight: '2px',
                                                }}
                                            />
                                            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-zinc-700 px-1.5 py-0.5 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100">
                                                {d.date}: {d.count}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 flex justify-between text-xs text-zinc-600">
                                    <span>{registrationsByDay[0]?.date}</span>
                                    <span>
                                        {
                                            registrationsByDay[
                                                registrationsByDay.length - 1
                                            ]?.date
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-8 lg:grid-cols-2">
                        {/* Recent registrations */}
                        <div>
                            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                                <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                                Legutóbbi regisztrációk
                            </h2>
                            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                                Felhasználó
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                                Regisztrált
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                                                Streak
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {recentUsers.map((u) => (
                                            <tr
                                                key={u.email}
                                                className="transition-colors hover:bg-primary/5"
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="max-w-[160px] truncate font-medium">
                                                        {u.name}
                                                    </div>
                                                    <div className="max-w-[160px] truncate text-xs text-zinc-500">
                                                        {u.email}
                                                    </div>
                                                    {!u.email_verified_at && (
                                                        <span className="text-[10px] text-orange-400">
                                                            nem hitelesített
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs whitespace-nowrap text-zinc-400">
                                                    {u.created_at
                                                        ? new Date(
                                                              u.created_at,
                                                          ).toLocaleDateString(
                                                              'hu-HU',
                                                          )
                                                        : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {u.streak > 0 ? (
                                                        <span className="inline-flex items-center gap-1 font-medium text-orange-400">
                                                            <Flame className="size-3" />
                                                            {u.streak}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-700">
                                                            —
                                                        </span>
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
                            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                                <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                                Legaktívabb felhasználók
                            </h2>
                            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                                <table className="w-full text-sm">
                                    <thead className="border-b border-zinc-800">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                                #
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                                Felhasználó
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                                                Szavak
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">
                                                Streak
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {mostActive.map((u, i) => (
                                            <tr
                                                key={u.email}
                                                className="transition-colors hover:bg-primary/5"
                                            >
                                                <td className="px-4 py-3 font-medium text-primary tabular-nums">
                                                    {i + 1}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="max-w-[160px] truncate font-medium">
                                                        {u.name}
                                                    </div>
                                                    <div className="max-w-[160px] truncate text-xs text-zinc-500">
                                                        {u.email}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-primary tabular-nums">
                                                    {(
                                                        u.known_words_count ?? 0
                                                    ).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {u.streak > 0 ? (
                                                        <span className="inline-flex items-center justify-end gap-1 font-medium text-orange-400">
                                                            <Flame className="size-3" />
                                                            {u.streak}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-700">
                                                            —
                                                        </span>
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
                            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                                <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                                Top streaks
                            </h2>
                            <div className="flex flex-wrap gap-3">
                                {topStreaks.map((u, i) => (
                                    <div
                                        key={u.email}
                                        className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors hover:border-primary/30"
                                    >
                                        <span className="w-4 text-sm font-bold text-primary tabular-nums">
                                            {i + 1}
                                        </span>
                                        <div>
                                            <div className="text-sm font-medium">
                                                {u.name}
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                                {u.email}
                                            </div>
                                        </div>
                                        <span className="ml-2 flex items-center gap-1 text-lg font-bold text-orange-400">
                                            <Flame className="size-4" />
                                            {u.streak}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hozzáférés-kezelő */}
                    <div>
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                            <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                            Hozzáférések
                        </h2>
                        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <p className="text-xs text-zinc-500">
                                Free = napi keretek + kis AI-kóstoló · Pro =
                                korlátlan + teljes AI-keret. Az AI minden
                                csomagon elérhető (a havi keret a korlát). A „+1
                                hó" gomb egy hónap ingyen Prót ad — halmozható,
                                lejáratkor magától visszaáll Free-re.
                            </p>
                            <Input
                                type="text"
                                placeholder="Keresés név vagy email alapján..."
                                value={accessSearch}
                                onChange={(e) =>
                                    setAccessSearch(e.target.value)
                                }
                                className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                            />
                            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                                {filteredAccessUsers.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-zinc-600">
                                        Nincs találat
                                    </p>
                                ) : (
                                    filteredAccessUsers.map((u) => (
                                        <div
                                            key={u.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span
                                                    className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold uppercase ${
                                                        u.plan === 'premium'
                                                            ? 'bg-indigo-400/10 text-indigo-400'
                                                            : 'bg-zinc-700/40 text-zinc-400'
                                                    }`}
                                                >
                                                    {u.plan}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">
                                                        {u.name}
                                                        {u.subscribed && (
                                                            <span className="ml-1.5 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400">
                                                                Előfizető
                                                                {u.subscription_plan
                                                                    ? ` · ${u.subscription_plan}`
                                                                    : ''}
                                                            </span>
                                                        )}
                                                        {u.plan_override && (
                                                            <span className="ml-1.5 text-[10px] text-zinc-500">
                                                                (admin
                                                                felülírás)
                                                            </span>
                                                        )}
                                                        {u.trial_ends_at && (
                                                            <span className="ml-1.5 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                                                                Ingyen Pro ·{' '}
                                                                {new Date(
                                                                    u.trial_ends_at,
                                                                ).toLocaleDateString(
                                                                    'hu-HU',
                                                                )}
                                                                -ig
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="truncate text-xs text-zinc-500">
                                                        {u.email}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        setUserPlan(
                                                            u.email,
                                                            'premium',
                                                        )
                                                    }
                                                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                                        u.plan_override ===
                                                        'premium'
                                                            ? 'bg-indigo-500 text-white'
                                                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                                    }`}
                                                >
                                                    Pro
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        giveFreeMonth(u.email)
                                                    }
                                                    title="+1 hónap ingyen Pro (halmozható, lejáratkor magától visszaáll)"
                                                    className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:bg-indigo-500/20 hover:text-indigo-400"
                                                >
                                                    <Gift className="size-3.5" />
                                                    +1 hó
                                                </button>
                                                {u.plan_override && (
                                                    <button
                                                        onClick={() =>
                                                            setUserPlan(
                                                                u.email,
                                                                'none',
                                                            )
                                                        }
                                                        title="Felülírás visszavonása (előfizetés dönt)"
                                                        className="rounded-md px-2 py-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Meghívók */}
                    <div className="mt-8">
                        <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                            <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                            Meghívók
                            {!inviteOnly && (
                                <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-normal text-amber-400 normal-case">
                                    a „csak meghívóval" mód kikapcsolva
                                </span>
                            )}
                        </h2>
                        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex grow flex-col gap-1">
                                    <label className="text-xs text-zinc-500">
                                        Címke (megjegyzés)
                                    </label>
                                    <Input
                                        value={inviteLabel}
                                        onChange={(e) =>
                                            setInviteLabel(e.target.value)
                                        }
                                        placeholder="pl. Kovács János"
                                        className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                                    />
                                </div>
                                <div className="flex w-28 flex-col gap-1">
                                    <label className="text-xs text-zinc-500">
                                        Max. felh.
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={inviteMaxUses}
                                        onChange={(e) =>
                                            setInviteMaxUses(e.target.value)
                                        }
                                        className="border-zinc-700 bg-zinc-800 text-zinc-100"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-zinc-500">
                                        Lejárat (opcionális)
                                    </label>
                                    <Input
                                        type="datetime-local"
                                        value={inviteExpires}
                                        onChange={(e) =>
                                            setInviteExpires(e.target.value)
                                        }
                                        className="border-zinc-700 bg-zinc-800 text-zinc-100"
                                    />
                                </div>
                                <button
                                    onClick={createInvite}
                                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                >
                                    Kód generálása
                                </button>
                            </div>

                            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                                {invites.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-zinc-600">
                                        Még nincs meghívókód.
                                    </p>
                                ) : (
                                    invites.map((inv) => (
                                        <div
                                            key={inv.id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                                        >
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <code className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-sm text-primary">
                                                    {inv.code}
                                                </code>
                                                <span
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${inv.usable ? 'bg-green-500/15 text-green-400' : 'bg-zinc-700/40 text-zinc-500'}`}
                                                >
                                                    {inv.usable
                                                        ? 'aktív'
                                                        : inv.uses >=
                                                            inv.max_uses
                                                          ? 'elfogyott'
                                                          : 'lejárt'}
                                                </span>
                                                <span className="text-xs text-zinc-500 tabular-nums">
                                                    {inv.uses}/{inv.max_uses}
                                                </span>
                                                {inv.label && (
                                                    <span className="truncate text-xs text-zinc-400">
                                                        {inv.label}
                                                    </span>
                                                )}
                                                {inv.expires_at && (
                                                    <span className="text-xs text-zinc-600">
                                                        lejár:{' '}
                                                        {new Date(
                                                            inv.expires_at,
                                                        ).toLocaleDateString(
                                                            'hu-HU',
                                                        )}
                                                    </span>
                                                )}
                                                {inv.used_by.length > 0 && (
                                                    <span className="truncate text-xs text-zinc-600">
                                                        (
                                                        {inv.used_by.join(', ')}
                                                        )
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5">
                                                <button
                                                    onClick={() =>
                                                        copyInvite(inv)
                                                    }
                                                    className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
                                                >
                                                    {copiedId === inv.id
                                                        ? 'Másolva!'
                                                        : 'Link másolása'}
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        revokeInvite(inv.id)
                                                    }
                                                    title="Visszavonás"
                                                    className="rounded-md px-2 py-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
