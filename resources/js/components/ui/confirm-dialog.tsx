import React from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    /** Mit veszít a felhasználó — legyen konkrét (név, darabszám). */
    description: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Igaz visszafordíthatatlan műveletnél: piros megerősítő gomb. */
    destructive?: boolean;
    onConfirm: () => void;
}

/**
 * Megerősítő párbeszéd a natív `confirm()` helyett: a böngésző-dialógus nem
 * stílusozható, mobilon a domainnel kezdődik, és a szövege nem tud kiemelést
 * használni — így a felhasználó pont a lényeget (mit töröl) olvassa át.
 */
export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Igen',
    cancelLabel = 'Mégse',
    destructive = false,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="pr-8">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription asChild>
                        <div>{description}</div>
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={() => {
                            onOpenChange(false);
                            onConfirm();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
