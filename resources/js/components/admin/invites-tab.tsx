import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { Invite, InvitesTabProps } from '@/types/admin';

export default function InvitesTab({ invites, inviteOnly }: InvitesTabProps) {
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

    return (
        <div>
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
                            onChange={(e) => setInviteLabel(e.target.value)}
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
                            onChange={(e) => setInviteMaxUses(e.target.value)}
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
                            onChange={(e) => setInviteExpires(e.target.value)}
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
                                            : inv.uses >= inv.max_uses
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
                                            ).toLocaleDateString('hu-HU')}
                                        </span>
                                    )}
                                    {inv.used_by.length > 0 && (
                                        <span className="truncate text-xs text-zinc-600">
                                            ({inv.used_by.join(', ')})
                                        </span>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <button
                                        onClick={() => copyInvite(inv)}
                                        className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
                                    >
                                        {copiedId === inv.id
                                            ? 'Másolva!'
                                            : 'Link másolása'}
                                    </button>
                                    <button
                                        onClick={() => revokeInvite(inv.id)}
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
    );
}
