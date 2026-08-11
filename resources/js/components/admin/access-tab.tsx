import { router } from '@inertiajs/react';
import { Gift, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { set as setAccess } from '@/routes/admin/access';
import { grant as grantFreeMonth } from '@/routes/admin/free-month';
import type { AccessTabProps } from '@/types/admin';

export default function AccessTab({ accessUsers }: AccessTabProps) {
    const [accessSearch, setAccessSearch] = useState('');

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
                    value={accessSearch}
                    onChange={(e) => setAccessSearch(e.target.value)}
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
            </div>
        </div>
    );
}
