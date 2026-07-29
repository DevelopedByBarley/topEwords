import { useForm } from '@inertiajs/react';
import { FolderOpen } from 'lucide-react';
import { useEffect } from 'react';
import type { Deck, DeckFolder } from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { store, update } from '@/routes/flashcards';

interface DeckFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** `null` = új pakli; egyébként a szerkesztett pakli. */
    deck: Deck | null;
    folders: DeckFolder[];
    /** Új paklinál az épp szűrt mappa az alapértelmezés. */
    defaultFolderId: number | null;
}

/**
 * Pakli létrehozása és átnevezése. Ugyanaz a két mező, ezért egy űrlap
 * szolgálja ki mindkettőt — a mappa-választó csak létrehozáskor van ott,
 * meglévő paklinál a kártya menüje kezeli a mappákat.
 */
export default function DeckFormDialog({
    open,
    onOpenChange,
    deck,
    folders,
    defaultFolderId,
}: DeckFormDialogProps) {
    const isEdit = deck !== null;
    const form = useForm({ name: '', description: '', folder_id: '' });

    // A dialógus nyitásakor töltjük fel: a paklit a szülő állítja be, és a
    // komponens nyitva marad a lista újratöltésén át is.
    useEffect(() => {
        if (!open) {
            return;
        }

        form.setData({
            name: deck?.name ?? '',
            description: deck?.description ?? '',
            folder_id:
                !deck && defaultFolderId !== null
                    ? String(defaultFolderId)
                    : '',
        });
        form.clearErrors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, deck?.id]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (isEdit) {
            form.submit(update(deck.id), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            });

            return;
        }

        form.submit(store(), {
            onSuccess: () => onOpenChange(false),
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-md">
                <DialogHeader className="pr-8">
                    <DialogTitle>
                        {isEdit ? 'Pakli átnevezése' : 'Új pakli'}
                    </DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'A pakli neve és leírása bármikor módosítható — a kártyák érintetlenek maradnak.'
                            : 'A pakli a kártyáid gyűjteménye; a tanulási ütemterv paklinként külön állítható.'}
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-1"
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="deck-name">Pakli neve</Label>
                        <Input
                            id="deck-name"
                            name="name"
                            placeholder="pl. Üzleti angol"
                            autoComplete="off"
                            autoFocus
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                        />
                        {form.errors.name && (
                            <p className="text-xs text-destructive">
                                {form.errors.name}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="deck-description">
                            Leírás (opcionális)
                        </Label>
                        <Textarea
                            id="deck-description"
                            name="description"
                            placeholder="Rövid leírás, témakör..."
                            className="min-h-20 resize-none"
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                        {form.errors.description && (
                            <p className="text-xs text-destructive">
                                {form.errors.description}
                            </p>
                        )}
                    </div>

                    {!isEdit && folders.length > 0 && (
                        <div className="grid gap-1.5">
                            <Label>Mappa (opcionális)</Label>
                            <Select
                                value={form.data.folder_id || 'none'}
                                onValueChange={(v) =>
                                    form.setData(
                                        'folder_id',
                                        v === 'none' ? '' : v,
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Nincs mappában" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        Nincs mappában
                                    </SelectItem>
                                    {folders.map((f) => (
                                        <SelectItem
                                            key={f.id}
                                            value={String(f.id)}
                                        >
                                            <FolderOpen className="mr-1.5 inline-block size-3.5" />
                                            {f.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <DialogFooter className="pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Mégse
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                form.processing || form.data.name.trim() === ''
                            }
                        >
                            {isEdit ? 'Mentés' : 'Létrehozás'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
