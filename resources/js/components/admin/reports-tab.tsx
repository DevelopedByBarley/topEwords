import { router } from '@inertiajs/react';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { updateStatus as updateReportStatus } from '@/routes/admin/reports';

interface Report {
    id: number;
    category: 'bug' | 'missing_feature' | 'word_data' | 'other';
    description: string;
    status: 'open' | 'resolved';
    created_at: string;
    user: { id: number; name: string; email: string } | null;
    word: { id: number; word: string } | null;
}

const REPORT_CATEGORY_LABELS: Record<Report['category'], string> = {
    bug: 'Hiba',
    missing_feature: 'Hiányzó funkció',
    word_data: 'Hibás szóadat',
    other: 'Egyéb',
};

interface Props {
    reports: Report[];
}

export default function ReportsTab({ reports }: Props) {
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);

    function toggleReportStatus(report: Report) {
        const status = report.status === 'open' ? 'resolved' : 'open';
        router.patch(
            updateReportStatus(report.id).url,
            { status },
            { preserveScroll: true },
        );
    }

    return (
        <div>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium tracking-wider text-zinc-400 uppercase">
                <span className="inline-block h-3.5 w-0.5 rounded-full bg-primary" />
                Bejelentések
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                {reports.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-600">
                        Még nincs bejelentés.
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="border-b border-zinc-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Dátum
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Felhasználó
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Kategória
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Leírás
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Szó
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Állapot
                                </th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                            {reports.map((r) => (
                                <tr
                                    key={r.id}
                                    onClick={() => setSelectedReport(r)}
                                    className="cursor-pointer align-top transition-colors hover:bg-primary/5"
                                >
                                    <td className="px-4 py-3 text-xs whitespace-nowrap text-zinc-400">
                                        {new Date(
                                            r.created_at,
                                        ).toLocaleDateString('hu-HU')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="max-w-40 truncate font-medium">
                                            {r.user?.name ?? '—'}
                                        </div>
                                        <div className="max-w-40 truncate text-xs text-zinc-500">
                                            {r.user?.email ?? ''}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="flex items-center gap-1 text-xs text-zinc-400">
                                            <Flag className="size-3" />
                                            {
                                                REPORT_CATEGORY_LABELS[
                                                    r.category
                                                ]
                                            }
                                        </span>
                                    </td>
                                    <td className="max-w-xs px-4 py-3 text-zinc-300">
                                        <div className="line-clamp-2">
                                            {r.description}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-zinc-400">
                                        {r.word?.word ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                                r.status === 'resolved'
                                                    ? 'bg-green-500/15 text-green-400'
                                                    : 'bg-amber-500/15 text-amber-400'
                                            }`}
                                        >
                                            {r.status === 'resolved'
                                                ? 'elintézve'
                                                : 'nyitott'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleReportStatus(r);
                                            }}
                                            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-zinc-300 transition-colors hover:bg-zinc-700"
                                        >
                                            {r.status === 'open'
                                                ? 'Elintézve'
                                                : 'Újranyitás'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Bejelentés részletei */}
            <Dialog
                open={selectedReport !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedReport(null);
                    }
                }}
            >
                <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-w-lg">
                    {selectedReport && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Flag className="size-4 text-primary" />
                                    {
                                        REPORT_CATEGORY_LABELS[
                                            selectedReport.category
                                        ]
                                    }
                                </DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 text-sm">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                    <span>
                                        {new Date(
                                            selectedReport.created_at,
                                        ).toLocaleString('hu-HU')}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {selectedReport.user?.name ?? '—'} (
                                        {selectedReport.user?.email ?? '—'})
                                    </span>
                                    {selectedReport.word && (
                                        <>
                                            <span>·</span>
                                            <span>
                                                szó:{' '}
                                                <span className="font-medium text-zinc-300">
                                                    {selectedReport.word.word}
                                                </span>
                                            </span>
                                        </>
                                    )}
                                </div>

                                <p className="max-h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 whitespace-pre-wrap text-zinc-200">
                                    {selectedReport.description}
                                </p>

                                <div className="flex items-center justify-between">
                                    <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                            selectedReport.status ===
                                            'resolved'
                                                ? 'bg-green-500/15 text-green-400'
                                                : 'bg-amber-500/15 text-amber-400'
                                        }`}
                                    >
                                        {selectedReport.status === 'resolved'
                                            ? 'elintézve'
                                            : 'nyitott'}
                                    </span>
                                    <button
                                        onClick={() => {
                                            toggleReportStatus(
                                                selectedReport,
                                            );
                                            setSelectedReport(null);
                                        }}
                                        className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-zinc-300 transition-colors hover:bg-zinc-700"
                                    >
                                        {selectedReport.status === 'open'
                                            ? 'Elintézve'
                                            : 'Újranyitás'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
