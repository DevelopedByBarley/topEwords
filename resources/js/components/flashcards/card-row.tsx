import { router } from '@inertiajs/react';
import { ArrowLeftRight, Copy, Edit2, Info, MoreHorizontal, MoveRight, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import MoveConfirmDialog from '@/components/flashcards/move-confirm-dialog';
import { STATE_LABELS, formatDue, plainText, stateBadgeClass } from '@/components/flashcards/types';
import type { Deck, Flashcard, OtherDeck } from '@/components/flashcards/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {      destroy as destroyCard, duplicate as duplicateCard,  move as moveCard, reset as resetProgress,  update as updateCard } from '@/routes/flashcards/cards';

export default function CardRow({ card, deck, otherDecks, onEdit, onPreview, onPractice, onStats, selected, onSelect, now }: {
    card: Flashcard;
    deck: Deck;
    otherDecks: OtherDeck[];
    onEdit: (card: Flashcard) => void;
    onPreview: (card: Flashcard) => void;
    onPractice?: (card: Flashcard) => void;
    onStats: (card: Flashcard) => void;
    selected: boolean;
    onSelect: (id: number, checked: boolean) => void;
    now: number;
}) {
    const [moveTarget, setMoveTarget] = useState<{ id: number; name: string } | null>(null);
    const isBoth = card.direction === 'both';
    const reviewState = card.review?.state ?? 'new';

    return (
        <>
        <div
            className={`flex items-center gap-2 rounded-2xl border px-3 py-3 transition-colors sm:px-4 ${
                selected
                    ? 'bg-primary/5 border-primary/30'
                    : isBoth && !card.color
                        ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                        : 'bg-card hover:bg-muted/30'
            }`}
            style={card.color ? { borderLeftColor: card.color, borderLeftWidth: 3 } : isBoth ? { borderLeftWidth: 3 } : {}}
        >
            <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelect(card.id, e.target.checked)}
                className="shrink-0 size-4 rounded border-input accent-primary cursor-pointer"
                aria-label="Kártya kijelölése"
            />

            {/* Card content — clickable for preview */}
            <button
                type="button"
                onClick={() => onPreview(card)}
                className="flex-1 min-w-0 text-left"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium truncate">{plainText(card.front, 80)}</span>
                    {isBoth && <ArrowLeftRight className="size-3 shrink-0 text-primary/60" />}
                    {card.review?.is_leech && <span className="shrink-0 text-[10px] font-semibold text-destructive">⚠</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{plainText(card.back, 70)}</div>

                {/* Mobilon az állapot a tartalom alatt */}
                <div className="mt-1.5 flex items-center gap-1.5 sm:hidden">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClass(reviewState)}`}>
                        {STATE_LABELS[reviewState] ?? 'Új'}
                    </span>
                    {card.review && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatDue(card.review.due_at, card.review.state, now)}
                        </span>
                    )}
                </div>
            </button>

            {/* State badge + due — fixed column (csak desktopon) */}
            <div className="hidden shrink-0 w-24 sm:flex flex-col items-end gap-0.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClass(reviewState)}`}>
                    {STATE_LABELS[reviewState] ?? 'Új'}
                </span>
                {card.review && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDue(card.review.due_at, card.review.state, now)}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                {onPractice && (
                    <button
                        onClick={() => onPractice(card)}
                        className="size-8 inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                        title="Mondatírás gyakorlás"
                    >
                        <Sparkles className="size-3.5" />
                    </button>
                )}
                <button
                    onClick={() => onEdit(card)}
                    className="hidden size-8 sm:inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Szerkesztés"
                >
                    <Edit2 className="size-3.5" />
                </button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs">Kártya műveletek</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => onStats(card)}>
                            <Info className="size-3.5 mr-2" />
                            Statisztika
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => router.post(duplicateCard({ deck: deck.id, flashcard: card.id }), {}, { preserveScroll: true })}
                        >
                            <Copy className="size-3.5 mr-2" />
                            Másolat létrehozása
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={() => router.patch(
                                updateCard({ deck: deck.id, flashcard: card.id }),
                                { direction: card.direction === 'both' ? 'front_to_back' : 'both' },
                                { preserveScroll: true },
                            )}
                        >
                            <ArrowLeftRight className="size-3.5 mr-2" />
                            {card.direction === 'both' ? 'Visszaállítás (1 irányú)' : 'Kétirányú kártya'}
                        </DropdownMenuItem>

                        {otherDecks.length > 0 && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <MoveRight className="size-3.5 mr-2" />
                                    Áthelyezés
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    {otherDecks.map((d) => (
                                        <DropdownMenuItem
                                            key={d.id}
                                            onClick={() => setMoveTarget({ id: d.id, name: d.name })}
                                        >
                                            {d.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => {
                                if (!confirm('Visszaállítod a kártya haladását? Az összes SRS adat törlődik.')) {
return;
}

                                router.post(resetProgress({ deck: deck.id, flashcard: card.id }), {}, { preserveScroll: true });
                            }}
                        >
                            <RotateCcw className="size-3.5 mr-2" />
                            Haladás visszaállítása
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                                if (!confirm('Törlöd ezt a kártyát?')) {
return;
}

                                router.delete(destroyCard({ deck: deck.id, flashcard: card.id }), { preserveScroll: true });
                            }}
                        >
                            <Trash2 className="size-3.5 mr-2" />
                            Törlés
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        {moveTarget && (
            <MoveConfirmDialog
                open
                onClose={() => setMoveTarget(null)}
                targetDeckName={moveTarget.name}
                cardCount={1}
                onConfirm={(resetProgress) => {
                    setMoveTarget(null);
                    router.post(
                        moveCard({ deck: deck.id, flashcard: card.id }),
                        { target_deck_id: moveTarget.id, reset_progress: resetProgress },
                        { preserveScroll: true },
                    );
                }}
            />
        )}
        </>
    );
}
