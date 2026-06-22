import { MoveRight, RotateCcw, Shield } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface MoveConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    targetDeckName: string;
    cardCount: number;
    onConfirm: (resetProgress: boolean) => void;
}

export default function MoveConfirmDialog({
    open,
    onClose,
    targetDeckName,
    cardCount,
    onConfirm,
}: MoveConfirmDialogProps) {
    const label = cardCount === 1 ? '1 kártya' : `${cardCount} kártya`;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MoveRight className="size-4 text-primary" />
                        Kártya áthelyezése
                    </DialogTitle>
                </DialogHeader>

                <p className="text-sm text-muted-foreground">
                    Biztosan áthelyezed a(z) <strong className="text-foreground">{label}</strong>{' '}
                    ide: <strong className="text-foreground">{targetDeckName}</strong>?
                </p>

                <p className="text-sm font-medium mt-1">Mi legyen a tanulási haladással?</p>

                <div className="flex flex-col gap-2 mt-1">
                    <button
                        type="button"
                        onClick={() => onConfirm(false)}
                        className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70 hover:border-primary/40"
                    >
                        <Shield className="size-4 mt-0.5 shrink-0 text-green-600" />
                        <div>
                            <div className="text-sm font-medium">Haladás megőrzése</div>
                            <div className="text-xs text-muted-foreground mt-0.5">Az SRS állapot és ismétlési ütemterv megmarad</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onConfirm(true)}
                        className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70 hover:border-destructive/40"
                    >
                        <RotateCcw className="size-4 mt-0.5 shrink-0 text-destructive" />
                        <div>
                            <div className="text-sm font-medium">Haladás törlése</div>
                            <div className="text-xs text-muted-foreground mt-0.5">A kártya újként jelenik meg az új pakliban</div>
                        </div>
                    </button>
                </div>

                <div className="flex justify-end mt-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Mégse
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
