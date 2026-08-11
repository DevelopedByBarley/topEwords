import { Head } from '@inertiajs/react';
import { Flag, Gauge, ShieldCheck, Ticket } from 'lucide-react';
import { useState } from 'react';
import AccessTab from '@/components/admin/access-tab';
import InvitesTab from '@/components/admin/invites-tab';
import OverviewTab from '@/components/admin/overview-tab';
import ReportsTab from '@/components/admin/reports-tab';
import AppLogoIcon from '@/components/app-logo-icon';
import type { AdminIndexPageProps } from '@/types/admin';

const TABS = [
    { key: 'overview', label: 'Áttekintés', icon: Gauge },
    { key: 'access', label: 'Hozzáférések', icon: ShieldCheck },
    { key: 'invites', label: 'Meghívók', icon: Ticket },
    { key: 'reports', label: 'Bejelentések', icon: Flag },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AdminIndex({
    stats,
    topStreaks,
    recentUsers,
    mostActive,
    registrationsByDay,
    accessUsers,
    invites,
    inviteOnly,
    reports,
}: AdminIndexPageProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('overview');
    const openReportsCount = reports.filter(
        (r) => r.status === 'open',
    ).length;

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

                {/* Tab nav */}
                <nav className="border-b border-zinc-800/60 px-6">
                    <div className="mx-auto flex max-w-7xl gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                                    activeTab === tab.key
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <tab.icon className="size-4" />
                                {tab.label}
                                {tab.key === 'reports' &&
                                    openReportsCount > 0 && (
                                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                            {openReportsCount}
                                        </span>
                                    )}
                            </button>
                        ))}
                    </div>
                </nav>

                <main className="mx-auto max-w-7xl px-6 py-10">
                    {activeTab === 'overview' && (
                        <OverviewTab
                            stats={stats}
                            topStreaks={topStreaks}
                            recentUsers={recentUsers}
                            mostActive={mostActive}
                            registrationsByDay={registrationsByDay}
                        />
                    )}
                    {activeTab === 'access' && (
                        <AccessTab accessUsers={accessUsers} />
                    )}
                    {activeTab === 'invites' && (
                        <InvitesTab invites={invites} inviteOnly={inviteOnly} />
                    )}
                    {activeTab === 'reports' && (
                        <ReportsTab reports={reports} />
                    )}
                </main>
            </div>
        </>
    );
}
