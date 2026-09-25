import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Gift, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { admin } from '@/routes';
import { set as setAccess } from '@/routes/admin/access';
import { grant as grantFreeMonth } from '@/routes/admin/free-month';
import type { AccessTabProps } from '@/types/admin';

/**
 * A userlista szerveroldalon keresett és lapozott (F9C-L4): a keresés és a
 * lapváltás partial reload, ami csak a userlistát kéri újra — a teljes
 * userbázis sosem kerül a böngészőbe.
 */
export default function AccessTab({
    accessUsers,
    accessSearch,
}: AccessTabProps) {
    const [search, setSearch] = useState(accessSearch);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Unmountkor (tabváltás) a függő debounce ne navigáljon utólag.
    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    function reloadAccessUsers(searchValue: string, page: number) {
        const query: Record<string, string | number> = {};
        const trimmed = searchValue.trim();

        if (trimmed !== '') {
            query.access_search = trimmed;
        }

        if (page > 1) {
            query.access_page = page;
        }

        router.get(admin(), query, {
            only: ['accessUsers', 'accessSearch'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }

    function handleSearchChange(value: string) {
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            reloadAccessUsers(value, 1);
        }, 350);
    }

    function goToPage(page: number) {
        reloadAccessUsers(accessSearch, page);
    }

    function setUserPlan(email: string, plan: 'premium' | 'none') {
        router.post(setAccess().url, { email, plan }, { preserveScroll: true });
    }

    function giveFreeMonth(email: string) {
        router.post(grantFreeMonth(email).url, {}, { preserveScroll: true });
    }

    return (
        <div>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                Hozzáférések
            </h2>
            <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-xs text-zinc-500">
                    Free = napi keretek + AI-próbahozzáférés · Pro = korlátlan +
                    teljes AI-keret. Az AI minden csomagon elérhető (a havi
                    keret a korlát). A „+1 hó" gomb egy hónap ingyen Prót ad —
                    halmozható, lejáratkor magától visszaáll Free-re.
                </p>
                <Input
                    type="text"
                    placeholder="Keresés név vagy email alapján..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                />
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {accessUsers.data.length === 0 ? (
                        <p className="py-4 text-center text-sm text-zinc-600">
                            Nincs találat
                        </p>
                    ) : (
                        accessUsers.data.map((u) => (
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
                                                    (admin felülírás)
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
                                            setUserPlan(u.email, 'premium')
                                        }
                                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                                            u.plan_override === 'premium'
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                                        }`}
                                    >
                                        Pro
                                    </button>
                                    <button
                                        onClick={() => giveFreeMonth(u.email)}
                                        title="+1 hónap ingyen Pro (halmozható, lejáratkor magától visszaáll)"
                                        className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:bg-indigo-500/20 hover:text-indigo-400"
                                    >
                                        <Gift className="size-3.5" />
                                        +1 hó
                                    </button>
                                    {u.plan_override && (
                                        <button
                                            onClick={() =>
                                                setUserPlan(u.email, 'none')
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
                {accessUsers.total > 0 && (
                    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>
                            {accessUsers.from}–{accessUsers.to} /{' '}
                            {accessUsers.total} felhasználó
                        </span>
                        {accessUsers.last_page > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        goToPage(accessUsers.current_page - 1)
                                    }
                                    disabled={accessUsers.current_page <= 1}
                                    aria-label="Előző oldal"
                                    className="rounded-md bg-zinc-800 p-1 text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronLeft className="size-3.5" />
                                </button>
                                <span className="tabular-nums">
                                    {accessUsers.current_page} /{' '}
                                    {accessUsers.last_page}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        goToPage(accessUsers.current_page + 1)
                                    }
                                    disabled={
                                        accessUsers.current_page >=
                                        accessUsers.last_page
                                    }
                                    aria-label="Következő oldal"
                                    className="rounded-md bg-zinc-800 p-1 text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <ChevronRight className="size-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
