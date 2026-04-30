import { Head, Link, router, useForm } from '@inertiajs/react';
import { BookOpen, FolderOpen, FolderPlus, Pencil, Plus, Settings2, Sparkles, Trash2, X } from 'lucide-react';
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
import { cn } from '@/lib/utils';
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
    const [activeFolderId, setActiveFolderId] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const param = new URLSearchParams(window.location.search).get('folder');
        if (!param) return null;
        const id = parseInt(param, 10);
        return folders.find((f) => f.id === id) ? id : null;
    });

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

    const [showNewDeckDialog, setShowNewDeckDialog] = useState(false);
    const [showFolderManagerDialog, setShowFolderManagerDialog] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [editFolderId, setEditFolderId] = useState<number | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [folderPopoverDeckId, setFolderPopoverDeckId] = useState<number | null>(null);

    const newDeckForm = useForm({ name: '', description: '', folder_id: '' });

    const displayedDecks = activeFolderId !== null
        ? decks.filter((d) => (deckFolderIds[d.id] ?? []).includes(activeFolderId))
        : decks;

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

    function handleDeleteFolder(folderId: number, folderName: string) {
        if (!confirm(`Törlöd a „${folderName}" mappát? A bennük lévő deckek megmaradnak.`)) return;
        router.delete(destroyFolder(folderId), {
            preserveScroll: true,
            preserveState: true,
            only: ['folders', 'deckFolderIds'],
            onSuccess: () => {
                if (activeFolderId === folderId) setFolder(null);
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

    function handleSubmitNewDeck(e: React.FormEvent) {
        e.preventDefault();
        newDeckForm.post(store(), {
            onSuccess: () => {
                setShowNewDeckDialog(false);
                newDeckForm.reset();
            },
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

                    <button
                        onClick={() => {
                            if (!confirm(`Törlöd a "${deck.name}" decket?`)) return;
                            router.delete(destroy({ deck: deck.id }));
                        }}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                        title="Deck törlése"
                    >
                        <Trash2 className="size-4" />
                    </button>
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <Heading
                        title="Flashcard decks"
                        description="Kezeld a kártyagyűjteményeidet"
                    />
                    <div className="flex items-center gap-2 sm:shrink-0">
                        {folders.length > 0 && (
                            <Button variant="outline" onClick={() => setShowFolderManagerDialog(true)}>
                                <Settings2 className="size-4 mr-1.5" />
                                Mappák kezelése
                            </Button>
                        )}
                        <Button onClick={() => setShowNewDeckDialog(true)}>
                            <Plus className="size-4 mr-1.5" />
                            Új deck
                        </Button>
                    </div>
                </div>

                {/* New deck dialog */}
                <Dialog open={showNewDeckDialog} onOpenChange={(open) => { setShowNewDeckDialog(open); if (!open) newDeckForm.reset(); }}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Új deck létrehozása</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmitNewDeck} className="space-y-4 pt-1">
                            <div className="grid gap-1.5">
                                <Label htmlFor="name">Deck neve</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="pl. Üzleti angol"
                                    autoComplete="off"
                                    autoFocus
                                    value={newDeckForm.data.name}
                                    onChange={(e) => newDeckForm.setData('name', e.target.value)}
                                />
                                {newDeckForm.errors.name && (
                                    <p className="text-xs text-destructive">{newDeckForm.errors.name}</p>
                                )}
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="description">Leírás (opcionális)</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    placeholder="Rövid leírás, témakör..."
                                    className="min-h-20 resize-none"
                                    value={newDeckForm.data.description}
                                    onChange={(e) => newDeckForm.setData('description', e.target.value)}
                                />
                            </div>
                            {folders.length > 0 && (
                                <div className="grid gap-1.5">
                                    <Label>Mappa (opcionális)</Label>
                                    <Select
                                        value={newDeckForm.data.folder_id || undefined}
                                        onValueChange={(v) => newDeckForm.setData('folder_id', v)}
                                        defaultValue={activeFolderId !== null ? String(activeFolderId) : undefined}
                                    >
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
                                <Button type="submit" disabled={newDeckForm.processing} className="flex-1">
                                    Létrehozás
                                </Button>
                                <Button type="button" variant="outline" onClick={() => setShowNewDeckDialog(false)}>
                                    Mégse
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Folder manager dialog */}
                <Dialog open={showFolderManagerDialog} onOpenChange={(open) => {
                    setShowFolderManagerDialog(open);
                    if (!open) {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                        setEditFolderId(null);
                        setEditFolderName('');
                    }
                }}>
                    <DialogContent className="sm:max-w-sm">
                        <DialogHeader>
                            <DialogTitle>Mappák kezelése</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-1 pt-1">
                            {folders.map((folder) =>
                                editFolderId === folder.id ? (
                                    <form
                                        key={folder.id}
                                        onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder.id, editFolderName); }}
                                        className="flex items-center gap-2 px-1 py-1"
                                    >
                                        <Input
                                            autoFocus
                                            value={editFolderName}
                                            onChange={(e) => setEditFolderName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Escape') setEditFolderId(null); }}
                                            className="h-8 flex-1 text-sm"
                                        />
                                        <Button type="submit" size="sm" className="h-8 px-3" disabled={!editFolderName.trim()}>
                                            Mentés
                                        </Button>
                                        <Button type="button" size="sm" variant="ghost" className="size-8 p-0" onClick={() => setEditFolderId(null)}>
                                            <X className="size-3.5" />
                                        </Button>
                                    </form>
                                ) : (
                                    <div
                                        key={folder.id}
                                        className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
                                    >
                                        <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                                        <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
                                        <span className="text-xs text-muted-foreground tabular-nums">{folder.decks_count}</span>
                                        <button
                                            onClick={() => { setEditFolderId(folder.id); setEditFolderName(folder.name); }}
                                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                            title="Átnevezés"
                                        >
                                            <Pencil className="size-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteFolder(folder.id, folder.name)}
                                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                            title="Törlés"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                )
                            )}

                            {folders.length === 0 && !showNewFolderInput && (
                                <p className="py-4 text-center text-sm text-muted-foreground">Még nincs mappád.</p>
                            )}

                            {showNewFolderInput ? (
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}
                                    className="flex items-center gap-2 px-1 pt-2"
                                >
                                    <Input
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Mappa neve..."
                                        className="h-8 flex-1 text-sm"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                                setShowNewFolderInput(false);
                                                setNewFolderName('');
                                            }
                                        }}
                                    />
                                    <Button type="submit" size="sm" className="h-8 px-3" disabled={!newFolderName.trim()}>
                                        Létrehozás
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="size-8 p-0"
                                        onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                                    >
                                        <X className="size-3.5" />
                                    </Button>
                                </form>
                            ) : (
                                <button
                                    onClick={() => setShowNewFolderInput(true)}
                                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                                >
                                    <FolderPlus className="size-3.5" />
                                    Új mappa
                                </button>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Folder filter chips */}
                <div className="flex flex-wrap items-center gap-2">
                    {folders.length > 0 && (
                        <button
                            onClick={() => setFolder(null)}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                activeFolderId === null
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            Összes
                            <span className={cn('text-xs tabular-nums', activeFolderId === null ? 'opacity-80' : 'opacity-60')}>
                                {decks.length}
                            </span>
                        </button>
                    )}

                    {folders.map((folder) => (
                        <button
                            key={folder.id}
                            onClick={() => setFolder(folder.id)}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                activeFolderId === folder.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                        >
                            {folder.name}
                            <span className={cn('text-xs tabular-nums', activeFolderId === folder.id ? 'opacity-80' : 'opacity-60')}>
                                {folder.decks_count}
                            </span>
                        </button>
                    ))}

                    {folders.length === 0 && (
                        <button
                            onClick={() => setShowFolderManagerDialog(true)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                        >
                            <FolderPlus className="size-3.5" />
                            Új mappa
                        </button>
                    )}
                </div>

                {/* Deck grid */}
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
                ) : displayedDecks.length === 0 ? (
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
                        {displayedDecks.map((deck) => (
                            <DeckCard key={deck.id} deck={deck} />
                        ))}
                    </div>
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
