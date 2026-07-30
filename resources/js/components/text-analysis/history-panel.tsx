import { Trash2 } from 'lucide-react';
import { MODE_ICONS } from '@/components/text-analysis/types';
import type { HistoryEntry } from '@/components/text-analysis/types';

interface HistoryPanelProps {
    history: HistoryEntry[];
    onLoad: (entry: HistoryEntry) => void;
    onDelete: (id: number) => void;
    onClearAll: () => void;
}

export default function HistoryPanel({ history, onLoad, onDelete, onClearAll }: HistoryPanelProps) {
    return (
        <div className="rounded-3xl bg-card shadow-sm">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <p className="text-sm font-medium">Korábbi elemzések</p>
                <button
                    type="button"
                    onClick={onClearAll}
                    className="text-xs text-muted-foreground hover:text-destructive"
                >
                    Mind törlése
                </button>
            </div>
            <ul className="divide-y">
                {history.map((entry) => {
                    const Icon = MODE_ICONS[entry.mode];
                    return (
                        <li key={entry.id} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <button
                                type="button"
                                onClick={() => onLoad(entry)}
                                className="min-w-0 flex-1 text-left"
                            >
                                <p className="truncate text-sm">{entry.label}</p>
                                <p className="text-xs text-muted-foreground">{entry.date}</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(entry.id)}
                                aria-label={`„${entry.label}" törlése az előzményekből`}
                                className="shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
