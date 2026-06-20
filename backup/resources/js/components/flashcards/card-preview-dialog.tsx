import {  ArrowLeftRight,     Edit2 } from 'lucide-react';
import React, {} from 'react';
import {
    
    
    STATE_COLORS,
    
    STATE_LABELS,
    formatDue
    
    
    
    
    
    
    
     } from '@/components/flashcards/types';
import type {Flashcard} from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle } from '@/components/ui/dialog';
import { RichTextContent } from '@/components/ui/rich-text-editor';

export default function CardPreviewDialog({ card, onClose, onEdit, now }: {
    card: Flashcard;
    onClose: () => void;
    onEdit: () => void;
    now: number;
}) {
    return (
        <Dialog open onOpenChange={(open) => {
 if (!open) {
onClose();
} 
}}>
            <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        Kártya előnézet
                        {card.direction === 'both' && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                <ArrowLeftRight className="size-2.5" />
                                Kétirányú
                            </span>
                        )}
                        {card.review?.is_leech && (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">leech</span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 pt-1">
                    <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Előlap</p>
                        <div className="text-base font-medium leading-relaxed">
                            <RichTextContent html={card.front} />
                        </div>
                        {card.front_notes && (
                            <div className="text-sm text-muted-foreground italic border-t pt-2 mt-2">
                                <RichTextContent html={card.front_notes} />
                            </div>
                        )}
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hátlap</p>
                        <div className="text-base leading-relaxed">
                            <RichTextContent html={card.back} />
                        </div>
                        {card.back_notes && (
                            <div className="text-sm text-muted-foreground italic border-t pt-2 mt-2">
                                <RichTextContent html={card.back_notes} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                    {card.review ? (
                        <>
                            <span className={`font-medium ${STATE_COLORS[card.review.state]}`}>{STATE_LABELS[card.review.state]}</span>
                            <span>·</span>
                            <span>{formatDue(card.review.due_at, card.review.state, now)}</span>
                            <span>·</span>
                            <span>{card.review.lapses} tévesztés</span>
                            {card.review.interval > 0 && (
                                <>
                                    <span>·</span>
                                    <span>{card.review.interval} napos intervallum</span>
                                </>
                            )}
                        </>
                    ) : (
                        <span className="font-medium text-blue-500">Új kártya</span>
                    )}
                    {card.color && (
                        <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                                <span className="size-2.5 rounded-full inline-block border" style={{ background: card.color }} />
                                szín
                            </span>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={onClose}>Bezárás</Button>
                    <Button onClick={() => {
 onClose(); onEdit(); 
}}>
                        <Edit2 className="size-3.5 mr-1.5" />
                        Szerkesztés
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
