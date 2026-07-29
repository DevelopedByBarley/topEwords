import { FolderOpen, FolderPlus, Pencil, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { DeckFolder } from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface FolderManagerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folders: DeckFolder[];
    onCreate: (name: string) => void;
    onRename: (folderId: number, name: string) => void;
    onDelete: (folderId: number) => void;
}

/**
 * Mappák létrehozása, átnevezése és törlése. A törlés két lépéses megerősítést
 * kér a soron belül — a natív `confirm()` a modál fölött külön rétegként ugrik
 * fel, és a szövege sem stílusozható.
 */
export default function FolderManagerDialog({
    open,
    onOpenChange,
    folders,
    onCreate,
    onRename,
    onDelete,
}: FolderManagerDialogProps) {
    const [newName, setNewName] = useState('');
    const [showNewInput, setShowNewInput] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    /** Záráskor takarítunk, hogy újranyitáskor ne egy félbehagyott átnevezés
     *  vagy törlés-megerősítés fogadja a felhasználót. */
    function handleOpenChange(next: boolean) {
        if (!next) {
            setNewName('');
            setShowNewInput(false);
            setEditId(null);
            setEditName('');
            setConfirmDeleteId(null);
        }

        onOpenChange(next);
    }

    function handleCreate() {
        const name = newName.trim();

        if (!name) {
            return;
        }

        onCreate(name);
        setNewName('');
        setShowNewInput(false);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-sm">
                <DialogHeader className="pr-8">
                    <DialogTitle>Mappák kezelése</DialogTitle>
                    <DialogDescription>
                        A mappák csak csoportosítják a paklikat — a mappa
                        törlésekor a benne lévő paklik megmaradnak.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pt-1">
                    {folders.map((folder) =>
                        editId === folder.id ? (
                            <form
                                key={folder.id}
                                onSubmit={(e) => {
                                    e.preventDefault();

                                    if (!editName.trim()) {
                                        return;
                                    }

                                    onRename(folder.id, editName.trim());
                                    setEditId(null);
                                }}
                                className="flex items-center gap-2 px-1 py-1"
                            >
                                <Input
                                    autoFocus
                                    value={editName}
                                    onChange={(e) =>
                                        setEditName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            setEditId(null);
                                        }
                                    }}
                                    className="h-8 flex-1"
                                    aria-label="Mappa neve"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    className="h-8 px-3"
                                    disabled={!editName.trim()}
                                >
                                    Mentés
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="size-8 p-0"
                                    onClick={() => setEditId(null)}
                                    aria-label="Átnevezés megszakítása"
                                >
                                    <X className="size-3.5" />
                                </Button>
                            </form>
                        ) : confirmDeleteId === folder.id ? (
                            <div
                                key={folder.id}
                                className="flex flex-wrap items-center gap-2 rounded-lg bg-destructive/10 px-2 py-2"
                            >
                                <span className="flex-1 text-xs text-destructive">
                                    Törlöd a(z) „{folder.name}" mappát?
                                </span>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => {
                                        setConfirmDeleteId(null);
                                        onDelete(folder.id);
                                    }}
                                >
                                    Törlés
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => setConfirmDeleteId(null)}
                                >
                                    Mégse
                                </Button>
                            </div>
                        ) : (
                            <div
                                key={folder.id}
                                className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted/50"
                            >
                                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                                <span className="flex-1 truncate text-sm font-medium">
                                    {folder.name}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {folder.decks_count}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditId(folder.id);
                                        setEditName(folder.name);
                                    }}
                                    className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    aria-label={`${folder.name} átnevezése`}
                                >
                                    <Pencil className="size-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setConfirmDeleteId(folder.id)
                                    }
                                    className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`${folder.name} törlése`}
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>
                        ),
                    )}

                    {folders.length === 0 && !showNewInput && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Még nincs mappád.
                        </p>
                    )}

                    {showNewInput ? (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleCreate();
                            }}
                            className="flex items-center gap-2 px-1 pt-2"
                        >
                            <Input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Mappa neve..."
                                className="h-8 flex-1"
                                aria-label="Új mappa neve"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setShowNewInput(false);
                                        setNewName('');
                                    }
                                }}
                            />
                            <Button
                                type="submit"
                                size="sm"
                                className="h-8 px-3"
                                disabled={!newName.trim()}
                            >
                                Létrehozás
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="size-8 p-0"
                                onClick={() => {
                                    setShowNewInput(false);
                                    setNewName('');
                                }}
                                aria-label="Mégse"
                            >
                                <X className="size-3.5" />
                            </Button>
                        </form>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowNewInput(true)}
                            className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                        >
                            <FolderPlus className="size-3.5" />
                            Új mappa
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
