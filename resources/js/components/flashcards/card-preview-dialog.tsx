import { ArrowLeftRight, Edit2 } from 'lucide-react';
import {
    STATE_COLORS,
    STATE_LABELS,
    formatDue,
} from '@/components/flashcards/types';
import type { Flashcard } from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RichTextContent } from '@/components/ui/rich-text-editor';

export default function CardPreviewDialog({
    card,
    onClose,
    onEdit,
    now,
}: {
    card: Flashcard;
    onClose: () => void;
    onEdit: () => void;
    now: number;
}) {
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col sm:max-w-2xl">
                <DialogHeader className="pr-8">
                    <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                        Kártya előnézet
                        {card.direction === 'both' && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                <ArrowLeftRight className="size-2.5" />
                                Kétirányú
                            </span>
                        )}
                        {card.review?.is_leech && (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                leech
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        A kártya elő- és hátlapja, valamint az aktuális tanulási
                        állapota.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-1">
                    <div className="space-y-2 rounded-xl border bg-muted/30 p-5">
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Előlap
                        </p>
                        <div className="text-base leading-relaxed font-medium">
                            <RichTextContent html={card.front} />
                        </div>
                        {card.front_notes && (
                            <div className="mt-2 border-t pt-2 text-sm text-muted-foreground italic">
                                <RichTextContent html={card.front_notes} />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2 rounded-xl border bg-muted/30 p-5">
                        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Hátlap
                        </p>
                        <div className="text-base leading-relaxed">
                            <RichTextContent html={card.back} />
                        </div>
                        {card.back_notes && (
                            <div className="mt-2 border-t pt-2 text-sm text-muted-foreground italic">
                                <RichTextContent html={card.back_notes} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    {card.review ? (
                        <>
                            <span
                                className={`font-medium ${STATE_COLORS[card.review.state]}`}
                            >
                                {STATE_LABELS[card.review.state]}
                            </span>
                            <span>·</span>
                            <span>
                                {formatDue(
                                    card.review.due_at,
                                    card.review.state,
                                    now,
                                )}
                            </span>
                            <span>·</span>
                            <span>{card.review.lapses} tévesztés</span>
                            {card.review.interval > 0 && (
                                <>
                                    <span>·</span>
                                    <span>
                                        {card.review.interval} napos intervallum
                                    </span>
                                </>
                            )}
                        </>
                    ) : (
                        <span className="font-medium text-blue-500">
                            Új kártya
                        </span>
                    )}
                    {card.color && (
                        <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                                <span
                                    className="inline-block size-2.5 rounded-full border"
                                    style={{ background: card.color }}
                                />
                                szín
                            </span>
                        </>
                    )}
                </div>

                <DialogFooter className="shrink-0 pt-1">
                    <Button variant="outline" onClick={onClose}>
                        Bezárás
                    </Button>
                    <Button
                        onClick={() => {
                            onClose();
                            onEdit();
                        }}
                    >
                        <Edit2 className="mr-1.5 size-3.5" />
                        Szerkesztés
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
