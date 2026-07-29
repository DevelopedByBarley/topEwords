import { Link } from '@inertiajs/react';
import {
    Clock,
    FolderOpen,
    MoreHorizontal,
    Pencil,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { formatDue } from '@/components/flashcards/types';
import type { DeckFolder, DeckSummary } from '@/components/flashcards/types';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { show, study } from '@/routes/flashcards';

interface DeckCardProps {
    deck: DeckSummary;
    /** `undefined`, amíg a deferred `dueCounts` meg nem érkezik. */
    dueCount: number | undefined;
    /** A legközelebbi jövőbeni esedékesség ISO-ban, ha van ilyen kártya. */
    nextDueAt: string | undefined;
    /** A szülő egyszer vett időbélyege a relatív esedékesség kiírásához. */
    now: number;
    folders: DeckFolder[];
    folderIds: number[];
    onToggleFolder: (folderId: number, inFolder: boolean) => void;
    onRename: (deck: DeckSummary) => void;
    onDelete: (deck: DeckSummary) => void;
}

export default function DeckCard({
    deck,
    dueCount,
    nextDueAt,
    now,
    folders,
    folderIds,
    onToggleFolder,
    onRename,
    onDelete,
}: DeckCardProps) {
    const deckFolders = folders.filter((f) => folderIds.includes(f.id));
    const isEmpty = deck.flashcards_count === 0;
    const isLoading = dueCount === undefined;
    const hasDue = (dueCount ?? 0) > 0;

    return (
        <article className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-700 dark:bg-card">
            <Link
                href={show({ deck: deck.id })}
                className="flex flex-1 flex-col gap-2 p-5"
            >
                <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 leading-tight font-semibold">
                        {deck.name}
                    </h3>
                    {isLoading ? (
                        <span className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
                    ) : (
                        hasDue && (
                            <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 tabular-nums dark:bg-indigo-950/50 dark:text-indigo-300">
                                {dueCount} esedékes
                            </span>
                        )
                    )}
                </div>

                {deck.description && (
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {deck.description}
                    </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                        {deck.flashcards_count.toLocaleString()} kártya
                    </span>
                    {deckFolders.map((f) => (
                        <span
                            key={f.id}
                            className="inline-flex items-center gap-1"
                        >
                            <FolderOpen className="size-3" />
                            {f.name}
                        </span>
                    ))}
                </div>
            </Link>

            <div className="flex items-center gap-1.5 border-t bg-muted/30 px-3 py-2.5">
                {/* Ha nincs esedékes kártya, a gomb helyén az az egyetlen
                    hasznos információ áll, hogy mikor érdemes visszajönni —
                    nem egy „nincs esedékes" felirat, amit a hiányzó gomb
                    magától is elmond. */}
                {isLoading ? (
                    <span className="h-9 flex-1 animate-pulse rounded-lg bg-muted" />
                ) : hasDue ? (
                    <Link
                        href={study({ deck: deck.id })}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-linear-to-br from-indigo-600 to-indigo-800 px-3 py-2 text-xs font-semibold text-white transition-all hover:brightness-105"
                    >
                        <Sparkles className="size-3.5" />
                        Tanulás ({dueCount})
                    </Link>
                ) : isEmpty ? (
                    <Link
                        href={show({ deck: deck.id })}
                        className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                    >
                        Adj hozzá kártyákat
                    </Link>
                ) : nextDueAt ? (
                    <span className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
                        <Clock className="size-3.5 shrink-0" />
                        Következő {formatDue(nextDueAt, 'review', now)}
                    </span>
                ) : (
                    <span className="flex-1" />
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            aria-label={`${deck.name} — pakli műveletek`}
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel className="text-xs">
                            Pakli műveletek
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => onRename(deck)}>
                            <Pencil className="mr-2 size-3.5" />
                            Átnevezés
                        </DropdownMenuItem>

                        {folders.length > 0 && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <FolderOpen className="mr-2 size-3.5" />
                                    Mappák
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-52">
                                    {folders.map((f) => (
                                        <DropdownMenuCheckboxItem
                                            key={f.id}
                                            checked={folderIds.includes(f.id)}
                                            onCheckedChange={(checked) =>
                                                onToggleFolder(f.id, checked)
                                            }
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            {f.name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(deck)}
                        >
                            <Trash2 className="mr-2 size-3.5" />
                            Törlés
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </article>
    );
}
