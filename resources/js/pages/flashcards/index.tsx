import { Form, Head, Link, router } from '@inertiajs/react';
import { BookOpen, ChevronRight, FolderOpen, FolderPlus, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { destroy, index, show, store, study } from '@/routes/flashcards';
import { destroy as destroyFolder, store as storeFolder, update as updateFolder } from '@/routes/flashcards/folders';
import { update as updateFolderDeck } from '@/routes/flashcards/folders/decks';

type Deck = {
    id: number;
    name: string;
    description: string | null;
    flashcards_count: number;
};

type Folder = {
    id: number;
    name: string;
    decks_count: number;
};

export default function FlashcardsIndex({
    decks,
    folders,
    deckFolderIds,
    dueCounts,
}: {
    decks: Deck[];
    folders: Folder[];
    deckFolderIds: Record<number, number[]>;
    dueCounts: Record<number, number>;
}) {
    const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
    const [showNewDeckDialog, setShowNewDeckDialog] = useState(false);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [editFolderId, setEditFolderId] = useState<number | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [folderPopoverDeckId, setFolderPopoverDeckId] = useState<number | null>(null);

    const activeFolder = folders.find((f) => f.id === activeFolderId) ?? null;
    const folderDecks = activeFolderId !== null
        ? decks.filter((d) => (deckFolderIds[d.id] ?? []).includes(activeFolderId))
        : [];
    const unassignedDecks = decks.filter((d) => (deckFolderIds[d.id] ?? []).length === 0);

    function handleCreateFolder() {
        const name = newFolderName.trim();
        if (!name) return;
        router.post(storeFolder(), { name }, {
            preserveScroll: true,
            preserveState: true,
            only: ['folders', 'deckFolderIds'],
            onSuccess: () => {
                setNewFolderName('');
                setShowNewFolderInput(false);
            },
        });
    }

    function handleDeleteFolder(folderId: number) {
        router.delete(destroyFolder(folderId), {
            preserveScroll: true,
            preserveState: true,
            only: ['folders', 'deckFolderIds'],
            onSuccess: () => {
                if (activeFolderId === folderId) setActiveFolderId(null);
            },
        });
    }

    function handleRenameFolder(folderId: number, name: string) {
        if (!name.trim()) return;
        router.patch(updateFolder(folderId), { name: name.trim() }, {
            preserveScroll: true,
            preserveState: true,
            only: ['folders'],
            onSuccess: () => {
                setEditFolderId(null);
                setEditFolderName('');
            },
        });
    }

    function handleToggleDeckFolder(deckId: number, folderId: number, inFolder: boolean) {
        router.patch(updateFolderDeck({ flashcardFolder: folderId, flashcardDeck: deckId }), { in_folder: inFolder }, {
            preserveScroll: true,
            preserveState: true,
            only: ['folders', 'deckFolderIds'],
        });
    }

    function DeckCard({ deck }: { deck: Deck }) {
        return (
            <div className="flex flex-col rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-sm overflow-hidden">
                <Link href={show({ deck: deck.id })} className="flex-1 p-5 block">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold leading-tight line-clamp-1">{deck.name}</h3>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                            {deck.flashcards_count}
                        </span>
                    </div>
                    {deck.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                            {deck.description}
                        </p>
                    )}
                </Link>

                <div className="flex items-center gap-1.5 border-t bg-muted/30 px-3 py-2.5">
                    {(dueCounts[deck.id] ?? 0) > 0 ? (
                        <Link
                            href={study({ deck: deck.id })}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                            <Sparkles className="size-3.5" />
                            Tanulás
                        </Link>
                    ) : (
                        <span className="flex-1" />
                    )}

                    {folders.length > 0 && (
                        <div className="relative">
                            <button
                                onClick={(e) => { e.preventDefault(); setFolderPopoverDeckId(folderPopoverDeckId === deck.id ? null : deck.id); }}
                                className="rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                title="Mappa"
                            >
                                <FolderOpen className="size-4" />
                            </button>
                            {folderPopoverDeckId === deck.id && (
                                <div className="absolute right-0 bottom-full mb-1 z-50 w-48 rounded-md border bg-popover shadow-md overflow-hidden">
                                    {folders.map((f) => {
                                        const inFolder = (deckFolderIds[deck.id] ?? []).includes(f.id);
                                        return (
                                            <button
                                                key={f.id}
                                                onClick={(e) => { e.preventDefault(); handleToggleDeckFolder(deck.id, f.id, !inFolder); }}
                                                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-accent active:bg-accent ${inFolder ? 'text-primary font-medium' : 'text-foreground'}`}
                                            >
                                                <FolderOpen className="size-3.5 shrink-0" />
                                                <span className="truncate flex-1 text-left">{f.name}</span>
                                                {inFolder && <span className="text-xs">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <Form
                        action={destroy({ deck: deck.id })}
                        method="delete"
                        options={{ onBefore: () => confirm(`Törlöd a "${deck.name}" decket?`) ?? false }}
                    >
                        {({ processing }) => (
                            <button
                                type="submit"
                                disabled={processing}
                                className="rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                                title="Deck törlése"
                            >
                                <Trash2 className="size-4" />
                            </button>
                        )}
                    </Form>
                </div>
            </div>
        );
    }

    return (
        <>
            <Head title="Flashcard decks" />

            {folderPopoverDeckId !== null && (
                <div className="fixed inset-0 z-40" onClick={() => setFolderPopoverDeckId(null)} />
            )}

            <div className="px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        {activeFolderId !== null && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                                <button
                                    onClick={() => setActiveFolderId(null)}
                                    className="hover:text-foreground transition-colors"
                                >
                                    Flashcard decks
                                </button>
                                <ChevronRight className="size-3.5" />
                                <span className="text-foreground font-medium">{activeFolder?.name}</span>
                            </div>
                        )}
                        <Heading
                            title={activeFolderId !== null ? (activeFolder?.name ?? '') : 'Flashcard decks'}
                            description={
                                activeFolderId !== null
                                    ? `${activeFolder?.decks_count ?? 0} deck ebben a mappában`
                                    : 'Kezeld a kártyagyűjteményeidet'
                            }
                        />
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {activeFolderId === null && (
                            <Button variant="outline" onClick={() => setShowNewFolderInput(true)}>
                                <FolderPlus className="size-4 mr-1.5" />
                                Új mappa
                            </Button>
                        )}
                        <Button onClick={() => setShowNewDeckDialog(true)}>
                            <Plus className="size-4 mr-1.5" />
                            Új deck
                        </Button>
                    </div>
                </div>

                {/* New deck dialog */}
                <Dialog open={showNewDeckDialog} onOpenChange={setShowNewDeckDialog}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Új deck létrehozása</DialogTitle>
                        </DialogHeader>
                        <Form
                            action={store()}
                            method="post"
                            resetOnSuccess
                            options={{ onSuccess: () => setShowNewDeckDialog(false) }}
                            className="space-y-4 pt-1"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="name">Deck neve</Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            placeholder="pl. Üzleti angol"
                                            autoComplete="off"
                                            autoFocus
                                        />
                                        {errors.name && (
                                            <p className="text-xs text-destructive">{errors.name}</p>
                                        )}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="description">Leírás (opcionális)</Label>
                                        <Textarea
                                            id="description"
                                            name="description"
                                            placeholder="Rövid leírás, témakör..."
                                            className="min-h-20 resize-none"
                                        />
                                    </div>
                                    {folders.length > 0 && (
                                        <div className="grid gap-1.5">
                                            <Label>Mappa (opcionális)</Label>
                                            <Select name="folder_id" defaultValue={activeFolderId !== null ? String(activeFolderId) : undefined}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Nincs mappában" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {folders.map((f) => (
                                                        <SelectItem key={f.id} value={String(f.id)}>
                                                            <FolderOpen className="size-3.5 mr-1.5 inline-block" />
                                                            {f.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        <Button type="submit" disabled={processing} className="flex-1">
                                            Létrehozás
                                        </Button>
                                        <Button type="button" variant="outline" onClick={() => setShowNewDeckDialog(false)}>
                                            Mégse
                                        </Button>
                                    </div>
                                </>
                            )}
                        </Form>
                    </DialogContent>
                </Dialog>

                {/* New folder inline input */}
                {showNewFolderInput && activeFolderId === null && (
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}
                        className="flex items-center gap-2 rounded-xl border border-dashed bg-card p-4"
                    >
                        <FolderPlus className="size-5 shrink-0 text-muted-foreground" />
                        <Input
                            autoFocus
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="Mappa neve..."
                            className="flex-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setShowNewFolderInput(false);
                                    setNewFolderName('');
                                }
                            }}
                        />
                        <Button type="submit" disabled={!newFolderName.trim()}>Létrehozás</Button>
                        <Button
                            variant="ghost"
                            type="button"
                            size="icon"
                            onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                        >
                            <X className="size-4" />
                        </Button>
                    </form>
                )}

                {/* Root view */}
                {activeFolderId === null ? (
                    <>
                        {/* Folders grid */}
                        {folders.length > 0 && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {folders.map((folder) =>
                                    editFolderId === folder.id ? (
                                        <div key={folder.id} className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6">
                                            <FolderOpen className="size-12 text-primary/40" />
                                            <form
                                                onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder.id, editFolderName); }}
                                                className="w-full flex flex-col gap-2"
                                            >
                                                <Input
                                                    autoFocus
                                                    value={editFolderName}
                                                    onChange={(e) => setEditFolderName(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Escape') setEditFolderId(null); }}
                                                />
                                                <div className="flex gap-2">
                                                    <Button type="submit" size="sm" className="flex-1" disabled={!editFolderName.trim()}>
                                                        Mentés
                                                    </Button>
                                                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditFolderId(null)}>
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        <div
                                            key={folder.id}
                                            className="group relative flex flex-col items-center gap-3 rounded-xl border bg-card p-6 cursor-pointer hover:shadow-sm hover:border-primary/30 transition-all"
                                            onClick={() => setActiveFolderId(folder.id)}
                                        >
                                            <FolderOpen className="size-12 text-primary/60 group-hover:text-primary/80 transition-colors" />
                                            <div className="text-center min-w-0 w-full">
                                                <h3 className="font-semibold leading-tight truncate">{folder.name}</h3>
                                                <p className="text-xs text-muted-foreground mt-0.5">{folder.decks_count} deck</p>
                                            </div>
                                            <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditFolderId(folder.id); setEditFolderName(folder.name); }}
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                                    title="Átnevezés"
                                                >
                                                    <Pencil className="size-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                                                    title="Törlés"
                                                >
                                                    <Trash2 className="size-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                )}
                            </div>
                        )}

                        {/* Unassigned decks */}
                        {decks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                <BookOpen className="size-12 mb-4 opacity-30" />
                                <p className="text-sm">Még nincs egy decked sem.</p>
                                <button
                                    onClick={() => setShowNewDeckDialog(true)}
                                    className="mt-3 text-sm text-primary underline underline-offset-2 hover:no-underline"
                                >
                                    Hozz létre egy decket →
                                </button>
                            </div>
                        ) : unassignedDecks.length > 0 ? (
                            <div className="space-y-4">
                                {folders.length > 0 && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                                            Mappán kívüli deckek
                                        </span>
                                        <div className="flex-1 border-t" />
                                    </div>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {unassignedDecks.map((deck) => (
                                        <DeckCard key={deck.id} deck={deck} />
                                    ))}
                                </div>
                            </div>
                        ) : folders.length > 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                Minden deck mappában van rendezve.
                            </p>
                        ) : null}
                    </>
                ) : (
                    /* Folder view */
                    folderDecks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                            <BookOpen className="size-12 mb-4 opacity-30" />
                            <p className="text-sm">Nincs deck ebben a mappában.</p>
                            <button
                                onClick={() => setShowNewDeckDialog(true)}
                                className="mt-3 text-sm text-primary underline underline-offset-2 hover:no-underline"
                            >
                                Hozz létre egy decket →
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {folderDecks.map((deck) => (
                                <DeckCard key={deck.id} deck={deck} />
                            ))}
                        </div>
                    )
                )}
            </div>
        </>
    );
}

FlashcardsIndex.layout = {
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
    ],
};
