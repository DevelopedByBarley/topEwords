import React, {} from 'react';
import {
    
    
    
    
    
    formatDue,
    
    
    stateBadgeClass,
    stateLabelFull
    
    
    
     } from '@/components/flashcards/types';
import type {AllReviewItem, Flashcard} from '@/components/flashcards/types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

function StatsRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

const DIRECTION_DISPLAY: Record<string, string> = {
    front_to_back: 'Előlap → Hátlap',
    back_to_front: 'Hátlap → Előlap',
};

function ReviewStatsBlock({ r, now }: { r: AllReviewItem; now: number }) {
    return (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <StatsRow label="Állapot">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadgeClass(r.state)}`}>
                    {stateLabelFull(r.state)}
                </span>
            </StatsRow>
            {(r.state === 'learning' || r.state === 'relearning') && (
                <StatsRow label="Tanulási lépés">
                    <span className="font-medium">{r.learning_step + 1}. lépés</span>
                </StatsRow>
            )}
            {r.state === 'review' && (
                <StatsRow label="Intervallum">
                    <span className="font-medium">{r.interval} nap</span>
                </StatsRow>
            )}
            <StatsRow label="Ease factor">
                <span className="font-medium">{(r.ease_factor / 100).toFixed(2)}</span>
            </StatsRow>
            <StatsRow label="Ismétlések">
                <span className="font-medium">{r.repetitions}</span>
            </StatsRow>
            <StatsRow label="Tévesztések">
                <span className="font-medium">{r.lapses}</span>
            </StatsRow>
            {r.due_at && (
                <StatsRow label="Esedékesség">
                    <span className="font-medium">{formatDue(r.due_at, r.state, now)}</span>
                </StatsRow>
            )}
            {r.introduced_on && (
                <StatsRow label="Bevezetve">
                    <span className="font-medium">{r.introduced_on}</span>
                </StatsRow>
            )}
            {r.reviewed_on && (
                <StatsRow label="Utolsó ismétlés">
                    <span className="font-medium">{r.reviewed_on}</span>
                </StatsRow>
            )}
            {r.is_leech && (
                <p className="text-xs text-destructive">⚠ Leech — sokat tévesztett kártya</p>
            )}
        </div>
    );
}


export default function CardStatsDialog({ card, onClose, now }: { card: Flashcard; onClose: () => void; now: number }) {
    const hasTwoDirections = card.all_reviews.length > 1;

    return (
        <Dialog open onOpenChange={(open) => {
 if (!open) {
onClose();
} 
}}>
            <DialogContent className="sm:max-w-xs w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">Kártya statisztika</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                    {card.all_reviews.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Ez a kártya még nem volt tanulásban.
                        </p>
                    ) : (
                        card.all_reviews.map((r, i) => (
                            <div key={r.direction}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {hasTwoDirections ? (DIRECTION_DISPLAY[r.direction] ?? r.direction) : 'Jelenlegi állapot'}
                                </p>
                                <ReviewStatsBlock r={r} now={now} />

                                {r.previous_state && (
                                    <div className="mt-3">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Előző állapot</p>
                                        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                            <StatsRow label="Állapot">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadgeClass(r.previous_state.state)}`}>
                                                    {stateLabelFull(r.previous_state.state)}
                                                </span>
                                            </StatsRow>
                                            {(r.previous_state.state === 'learning' || r.previous_state.state === 'relearning') && (
                                                <StatsRow label="Tanulási lépés volt">
                                                    <span className="font-medium">{r.previous_state.learning_step + 1}. lépés</span>
                                                </StatsRow>
                                            )}
                                            {r.previous_state.interval > 0 && (
                                                <StatsRow label="Intervallum volt">
                                                    <span className="font-medium">{r.previous_state.interval} nap</span>
                                                </StatsRow>
                                            )}
                                            <StatsRow label="Ease factor volt">
                                                <span className="font-medium">{(r.previous_state.ease_factor / 100).toFixed(2)}</span>
                                            </StatsRow>
                                            <StatsRow label="Tévesztések volt">
                                                <span className="font-medium">{r.previous_state.lapses}</span>
                                            </StatsRow>
                                        </div>
                                    </div>
                                )}

                                {hasTwoDirections && i < card.all_reviews.length - 1 && (
                                    <Separator className="mt-4" />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
