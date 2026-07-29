import { MoveRight, RotateCcw, Shield } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
            <DialogContent className="sm:max-w-sm">
                <DialogHeader className="pr-8">
                    <DialogTitle className="flex items-center gap-2">
                        <MoveRight className="size-4 text-primary" />
                        Kártya áthelyezése
                    </DialogTitle>
                    <DialogDescription asChild>
                        <p>
                            Biztosan áthelyezed a(z){' '}
                            <strong className="text-foreground">{label}</strong>{' '}
                            ide:{' '}
                            <strong className="text-foreground">
                                {targetDeckName}
                            </strong>
                            ?
                        </p>
                    </DialogDescription>
                </DialogHeader>

                <p className="mt-1 text-sm font-medium">
                    Mi legyen a tanulási haladással?
                </p>

                <div className="mt-1 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={() => onConfirm(false)}
                        className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/70"
                    >
                        <Shield className="mt-0.5 size-4 shrink-0 text-green-600" />
                        <div>
                            <div className="text-sm font-medium">
                                Haladás megőrzése
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                Az SRS állapot és ismétlési ütemterv megmarad
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onConfirm(true)}
                        className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:border-destructive/40 hover:bg-muted/70"
                    >
                        <RotateCcw className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <div>
                            <div className="text-sm font-medium">
                                Haladás törlése
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                A kártya újként jelenik meg az új pakliban
                            </div>
                        </div>
                    </button>
                </div>

                <div className="mt-2 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        Mégse
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
