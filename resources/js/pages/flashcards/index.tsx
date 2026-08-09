import { Head, router } from '@inertiajs/react';
import { BookOpen, Plus, Search, Settings2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import DeckCard from '@/components/flashcards/deck-card';
import DeckFormDialog from '@/components/flashcards/deck-form-dialog';
import FolderManagerDialog from '@/components/flashcards/folder-manager-dialog';
import { formatDue } from '@/components/flashcards/types';
import type { DeckFolder, DeckSummary } from '@/components/flashcards/types';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { destroy, index } from '@/routes/flashcards';
import {
    destroy as destroyFolder,
    store as storeFolder,
    update as updateFolder,
} from '@/routes/flashcards/folders';
import { update as updateFolderDeck } from '@/routes/flashcards/folders/decks';

/** Ennyi pakli fölött a keresőmező többet segít, mint amennyi helyet elvesz. */
const SEARCH_THRESHOLD = 8;

export default function FlashcardsIndex({
    decks,
    folders,
    deckFolderIds,
    dueCounts,
    nextDueAt,
}: {
    decks: DeckSummary[];
    folders: DeckFolder[];
    deckFolderIds: Record<number, number[]>;
    dueCounts: Record<number, number> | undefined;
    nextDueAt: Record<number, string> | undefined;
}) {
    const [activeFolderId, setActiveFolderId] = useState<number | null>(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        const param = new URLSearchParams(window.location.search).get('folder');

        if (!param) {
            return null;
        }

        const id = parseInt(param, 10);

        return folders.find((f) => f.id === id) ? id : null;
    });

    // Egyszer vett időbélyeg: a relatív esedékesség-szövegek ("3 óra múlva")
    // ebből számolnak, hogy a render tiszta maradjon.
    const [now] = useState(() => Date.now());
    const [search, setSearch] = useState('');
    const [deckDialogOpen, setDeckDialogOpen] = useState(false);
    const [editingDeck, setEditingDeck] = useState<DeckSummary | null>(null);
    const [showFolderManager, setShowFolderManager] = useState(false);
    const [deletingDeck, setDeletingDeck] = useState<DeckSummary | null>(null);

    const setFolder = (id: number | null) => {
        const params = new URLSearchParams(window.location.search);

        if (id !== null) {
            params.set('folder', String(id));
        } else {
            params.delete('folder');
        }

        const newUrl = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;
        window.history.replaceState(null, '', newUrl);
        setActiveFolderId(id);
    };

    const displayedDecks = useMemo(() => {
        const q = search.trim().toLowerCase();

        return decks.filter((d) => {
            if (
                activeFolderId !== null &&
                !(deckFolderIds[d.id] ?? []).includes(activeFolderId)
            ) {
                return false;
            }

            return q === '' || d.name.toLowerCase().includes(q);
        });
    }, [decks, deckFolderIds, activeFolderId, search]);

    /** Az összesített „mennyi vár rám ma” — a hero fő üzenete. */
    const dueSummary = useMemo(() => {
        if (!dueCounts) {
            return null;
        }

        const entries = Object.values(dueCounts).filter((n) => n > 0);
        // Ha ma nincs mit tanulni, a legközelebbi esedékesség az egyetlen
        // használható üzenet — abból tudja a felhasználó, mikor jöjjön vissza.
        const upcoming = Object.values(nextDueAt ?? {}).sort();

        return {
            cards: entries.reduce((sum, n) => sum + n, 0),
            decks: entries.length,
            earliestNext: upcoming[0] ?? null,
        };
    }, [dueCounts, nextDueAt]);

    function openNewDeckDialog() {
        setEditingDeck(null);
        setDeckDialogOpen(true);
    }

    function openRenameDialog(deck: DeckSummary) {
        setEditingDeck(deck);
        setDeckDialogOpen(true);
    }

    function handleCreateFolder(name: string) {
        router.post(
            storeFolder(),
            { name },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['folders', 'deckFolderIds'],
            },
        );
    }

    function handleDeleteFolder(folderId: number) {
        router.delete(destroyFolder(folderId), {
            preserveScroll: true,
            preserveState: true,
            only: ['folders', 'deckFolderIds'],
            onSuccess: () => {
                if (activeFolderId === folderId) {
                    setFolder(null);
                }
            },
        });
    }

    function handleRenameFolder(folderId: number, name: string) {
        router.patch(
            updateFolder(folderId),
            { name },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['folders'],
            },
        );
    }

    function handleToggleDeckFolder(
        deckId: number,
        folderId: number,
        inFolder: boolean,
    ) {
        router.patch(
            updateFolderDeck({
                flashcardFolder: folderId,
                flashcardDeck: deckId,
            }),
            { in_folder: inFolder },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['folders', 'deckFolderIds'],
            },
        );
    }

    return (
        <>
            <Head title="Flashcard paklik" />

            <div className="mx-auto flex h-full w-full max-w-[2000px] flex-1 flex-col gap-6 p-4 md:p-6 xl:px-10 2xl:px-16">
                {/* Hero */}
                <div
                    className="relative overflow-hidden rounded-3xl p-6 md:p-8"
                    style={{
                        background: 'linear-gradient(135deg,#4338CA,#4F8EEC)',
                    }}
                >
                    <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-xl">
                            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                                Flashcard paklik
                            </h1>
                            <p className="mt-1.5 text-sm text-white/85 md:text-base">
                                Kezeld a kártyagyűjteményeidet, és tanulj
                                időzített ismétléssel.
                            </p>
                            <div className="mt-5 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={openNewDeckDialog}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-3 text-sm font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                                >
                                    <Plus className="size-4" />
                                    Új pakli
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowFolderManager(true)}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/30"
                                >
                                    <Settings2 className="size-4" />
                                    Mappák
                                </button>
                            </div>
                        </div>

                        {decks.length > 0 && (
                            <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-white/15 px-5 py-4 text-center ring-1 ring-white/20">
                                {dueSummary === null ? (
                                    <>
                                        <span className="h-10 w-16 animate-pulse rounded bg-white/25" />
                                        <span className="mt-1 h-3 w-24 animate-pulse rounded bg-white/20" />
                                    </>
                                ) : (
                                    <>
                                        <span className="text-4xl font-bold text-white tabular-nums">
                                            {dueSummary.cards.toLocaleString()}
                                        </span>
                                        <span className="text-xs text-white/75">
                                            {dueSummary.cards > 0
                                                ? `esedékes kártya ${dueSummary.decks} pakliban`
                                                : dueSummary.earliestNext
                                                  ? `következő kártya ${formatDue(dueSummary.earliestNext, 'review', now)}`
                                                  : 'esedékes kártya'}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mappa-szűrő + kereső — csak ha van mit szűrni; a mappák
                    létrehozása a hero „Mappák" gombján érhető el. */}
                {(folders.length > 0 || decks.length > SEARCH_THRESHOLD) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {folders.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setFolder(null)}
                                    aria-pressed={activeFolderId === null}
                                    className={cn(
                                        'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                        activeFolderId === null
                                            ? 'bg-linear-to-br from-indigo-600 to-indigo-800 text-white'
                                            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                                    )}
                                >
                                    Összes
                                    <span className="text-xs tabular-nums opacity-70">
                                        {decks.length}
                                    </span>
                                </button>

                                {folders.map((folder) => (
                                    <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() => setFolder(folder.id)}
                                        aria-pressed={
                                            activeFolderId === folder.id
                                        }
                                        className={cn(
                                            'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                            activeFolderId === folder.id
                                                ? 'bg-linear-to-br from-indigo-600 to-indigo-800 text-white'
                                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                                        )}
                                    >
                                        {folder.name}
                                        <span className="text-xs tabular-nums opacity-70">
                                            {folder.decks_count}
                                        </span>
                                    </button>
                                ))}
                            </>
                        )}

                        {decks.length > SEARCH_THRESHOLD && (
                            <div className="relative ms-auto w-full sm:w-64">
                                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Pakli keresése..."
                                    className="h-9 rounded-full border-0 bg-muted pr-9 pl-10"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        aria-label="Keresés törlése"
                                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Pakli-rács */}
                {decks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center">
                        <BookOpen className="mb-4 size-12 text-muted-foreground opacity-30" />
                        <p className="text-sm font-medium">
                            Még nincs egy paklid sem.
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                            A pakli kártyák gyűjteménye — kézzel is felvehetsz
                            kártyát, de a szólistából és CSV-ből is
                            importálhatsz.
                        </p>
                        <button
                            type="button"
                            onClick={openNewDeckDialog}
                            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-br from-green-400 to-green-500 px-5 py-2.5 text-sm font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                        >
                            <Plus className="size-4" />
                            Első pakli létrehozása
                        </button>
                    </div>
                ) : displayedDecks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center">
                        <BookOpen className="mb-4 size-12 text-muted-foreground opacity-30" />
                        <p className="text-sm text-muted-foreground">
                            {search
                                ? `Nincs találat erre: „${search}"`
                                : 'Nincs pakli ebben a mappában.'}
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setFolder(null);
                            }}
                            className="mt-3 cursor-pointer text-sm text-primary underline underline-offset-2 hover:no-underline"
                        >
                            Szűrők törlése
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                        {displayedDecks.map((deck) => (
                            <DeckCard
                                key={deck.id}
                                deck={deck}
                                dueCount={dueCounts?.[deck.id]}
                                nextDueAt={nextDueAt?.[deck.id]}
                                now={now}
                                folders={folders}
                                folderIds={deckFolderIds[deck.id] ?? []}
                                onToggleFolder={(folderId, inFolder) =>
                                    handleToggleDeckFolder(
                                        deck.id,
                                        folderId,
                                        inFolder,
                                    )
                                }
                                onRename={openRenameDialog}
                                onDelete={setDeletingDeck}
                            />
                        ))}
                    </div>
                )}
            </div>

            <DeckFormDialog
                open={deckDialogOpen}
                onOpenChange={setDeckDialogOpen}
                deck={editingDeck}
                folders={folders}
                defaultFolderId={activeFolderId}
            />

            <FolderManagerDialog
                open={showFolderManager}
                onOpenChange={setShowFolderManager}
                folders={folders}
                onCreate={handleCreateFolder}
                onRename={handleRenameFolder}
                onDelete={handleDeleteFolder}
            />

            <ConfirmDialog
                open={deletingDeck !== null}
                onOpenChange={(open) => !open && setDeletingDeck(null)}
                title="Pakli törlése"
                destructive
                confirmLabel="Igen, törlöm"
                description={
                    <>
                        A(z){' '}
                        <strong className="text-foreground">
                            {deletingDeck?.name}
                        </strong>{' '}
                        pakli és a benne lévő{' '}
                        <strong className="text-foreground">
                            {deletingDeck?.flashcards_count.toLocaleString()}{' '}
                            kártya
                        </strong>{' '}
                        a tanulási előzményekkel együtt véglegesen törlődik. Ez
                        nem vonható vissza.
                    </>
                }
                onConfirm={() => {
                    if (deletingDeck) {
                        router.delete(destroy({ deck: deletingDeck.id }));
                    }
                }}
            />
        </>
    );
}

FlashcardsIndex.layout = {
    breadcrumbs: [{ title: 'Flashcards', href: index() }],
};
