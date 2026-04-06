import { Form, Head, Link, router } from '@inertiajs/react';
import { BookOpen, FolderOpen, FolderPlus, Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { destroy, index, show, store } from '@/routes/flashcards';
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
}: {
    decks: Deck[];
    folders: Folder[];
    deckFolderIds: Record<number, number[]>;
}) {
    const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
    const [showFolderDialog, setShowFolderDialog] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [editFolderId, setEditFolderId] = useState<number | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [folderPopoverDeckId, setFolderPopoverDeckId] = useState<number | null>(null);

    const visibleDecks = activeFolderId !== null
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

    return (
        <>
            <Head title="Flashcard decks" />

            <div className="px-4 py-6 space-y-6">
                <Heading
                    title="Flashcard decks"
                    description="Kezeld a kártyagyűjteményeidet"
                />

                {/* New deck form */}
                <div className="max-w-md">
                    <Form
                        action={store()}
                        method="post"
                        resetOnSuccess
                        className="space-y-3"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-1.5">
                                    <Label htmlFor="name">Új deck neve</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        placeholder="pl. Üzleti angol"
                                        autoComplete="off"
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
                                        placeholder="Rövid leírás, példamondatok..."
                                        className="min-h-20 resize-y"
                                    />
                                </div>
                                {folders.length > 0 && (
                                    <div className="grid gap-1.5">
                                        <Label>Mappa (opcionális)</Label>
                                        <Select name="folder_id">
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
                                <Button type="submit" disabled={processing} size="sm">
                                    <Plus className="size-4 mr-1" />
                                    Deck létrehozása
                                </Button>
                            </>
                        )}
                    </Form>
                </div>

                <Separator />

                {/* Folder filter bar */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant={activeFolderId === null ? 'default' : 'outline'}
                        onClick={() => setActiveFolderId(null)}
                    >
                        <BookOpen className="size-3.5 mr-1.5" />
                        Összes deck
                    </Button>
                    {folders.map((f) => (
                        <Button
                            key={f.id}
                            size="sm"
                            variant={activeFolderId === f.id ? 'default' : 'outline'}
                            onClick={() => setActiveFolderId(activeFolderId === f.id ? null : f.id)}
                        >
                            <FolderOpen className="size-3.5 mr-1.5" />
                            {f.name}
                            <span className="ml-1.5 text-xs opacity-60">{f.decks_count}</span>
                        </Button>
                    ))}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowFolderDialog(true)}
                        title="Mappák kezelése"
                    >
                        <Layers className="size-3.5 mr-1.5" />
                        Mappák
                    </Button>
                </div>

                {/* Folder management dialog */}
                <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
                    <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-sm">
                        <DialogHeader className="border-b px-4 py-3">
                            <DialogTitle>Mappák kezelése</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-1 flex-col overflow-y-auto py-1">
                            {folders.length === 0 && (
                                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                                    Még nincs mappád. Hozz létre egyet!
                                </p>
                            )}
                            {folders.map((f) => (
                                <div key={f.id} className="group flex items-center border-t px-4">
                                    {editFolderId === f.id ? (
                                        <form
                                            onSubmit={(e) => { e.preventDefault(); handleRenameFolder(f.id, editFolderName); }}
                                            className="flex flex-1 items-center gap-2 py-2"
                                        >
                                            <Input
                                                autoFocus
                                                value={editFolderName}
                                                onChange={(e) => setEditFolderName(e.target.value)}
                                                className="h-8 flex-1"
                                                onKeyDown={(e) => { if (e.key === 'Escape') setEditFolderId(null); }}
                                            />
                                            <Button size="sm" type="submit" disabled={!editFolderName.trim()}>Mentés</Button>
                                            <Button size="sm" variant="ghost" type="button" onClick={() => setEditFolderId(null)}>
                                                <X className="size-4" />
                                            </Button>
                                        </form>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => { setActiveFolderId(f.id); setShowFolderDialog(false); }}
                                                className="flex flex-1 items-center gap-2 py-3 text-sm transition-colors text-foreground"
                                            >
                                                <FolderOpen className="size-4 shrink-0" />
                                                <span className="flex-1 truncate text-left">{f.name}</span>
                                                <span className="text-xs text-muted-foreground">{f.decks_count} deck</span>
                                            </button>
                                            <div className="flex shrink-0 gap-1 pl-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    onClick={() => { setEditFolderId(f.id); setEditFolderName(f.name); }}
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                                    title="Átnevezés"
                                                >
                                                    <Pencil className="size-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFolder(f.id)}
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                                                    title="Törlés"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="border-t p-4">
                            {showNewFolderInput ? (
                                <form
                                    onSubmit={(e) => { e.preventDefault(); handleCreateFolder(); }}
                                    className="flex flex-col gap-2"
                                >
                                    <Input
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Mappa neve..."
                                        onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }}
                                    />
                                    <div className="flex gap-2">
                                        <Button type="submit" className="flex-1" disabled={!newFolderName.trim()}>
                                            <Plus className="size-4" />
                                            Létrehozás
                                        </Button>
                                        <Button variant="outline" type="button" onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}>
                                            Mégse
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <Button variant="outline" className="w-full" onClick={() => setShowNewFolderInput(true)}>
                                    <FolderPlus className="size-4" />
                                    Új mappa létrehozása
                                </Button>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Deck list */}
                {visibleDecks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <BookOpen className="size-12 mb-4 opacity-30" />
                        <p className="text-sm">
                            {activeFolderId !== null
                                ? 'Nincs deck ebben a mappában.'
                                : 'Még nincs egy decked sem. Hozz létre egyet fent!'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleDecks.map((deck) => {
                            const deckFolders = (deckFolderIds[deck.id] ?? [])
                                .map((fid) => folders.find((f) => f.id === fid))
                                .filter(Boolean) as Folder[];

                            return (
                                <div
                                    key={deck.id}
                                    className="group relative flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"
                                >
                                    <Link href={show({ deck: deck.id })} className="flex-1">
                                        <h3 className="font-semibold text-sm leading-tight pr-6">{deck.name}</h3>
                                        {deck.description && (
                                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                                {deck.description}
                                            </p>
                                        )}
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {deck.flashcards_count} kártya
                                        </p>
                                    </Link>

                                    {/* Folder chips */}
                                    {deckFolders.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {deckFolders.map((f) => (
                                                <span
                                                    key={f.id}
                                                    className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                                                >
                                                    <FolderOpen className="size-3" />
                                                    {f.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions on hover */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Folder assignment popover */}
                                        {folders.length > 0 && (
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); setFolderPopoverDeckId(folderPopoverDeckId === deck.id ? null : deck.id); }}
                                                    className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Mappák"
                                                >
                                                    <FolderOpen className="size-4" />
                                                </button>
                                                {folderPopoverDeckId === deck.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-md border bg-popover shadow-md overflow-hidden">
                                                        {folders.map((f) => {
                                                            const inFolder = (deckFolderIds[deck.id] ?? []).includes(f.id);
                                                            return (
                                                                <button
                                                                    key={f.id}
                                                                    onClick={(e) => { e.preventDefault(); handleToggleDeckFolder(deck.id, f.id, !inFolder); }}
                                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-accent ${inFolder ? 'text-primary font-medium' : 'text-foreground'}`}
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
                                                    className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                                                    title="Deck törlése"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            )}
                                        </Form>
                                    </div>
                                </div>
                            );
                        })}
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
