import { router } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Copy,
    Edit2,
    Info,
    MoreHorizontal,
    MoveRight,
    RotateCcw,
    Sparkles,
    Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import MoveConfirmDialog from '@/components/flashcards/move-confirm-dialog';
import {
    STATE_LABELS,
    formatDue,
    plainText,
    stateBadgeClass,
} from '@/components/flashcards/types';
import type { Deck, Flashcard, OtherDeck } from '@/components/flashcards/types';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    destroy as destroyCard,
    duplicate as duplicateCard,
    move as moveCard,
    reset as resetProgress,
    update as updateCard,
} from '@/routes/flashcards/cards';

export default function CardRow({
    card,
    deck,
    otherDecks,
    onEdit,
    onPreview,
    onPractice,
    onStats,
    selected,
    onSelect,
    now,
}: {
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
    const [moveTarget, setMoveTarget] = useState<{
        id: number;
        name: string;
    } | null>(null);
    const [confirm, setConfirm] = useState<'delete' | 'reset' | null>(null);
    const isBoth = card.direction === 'both';
    const reviewState = card.review?.state ?? 'new';

    return (
        <>
            <div
                className={`flex items-center gap-2 rounded-2xl border px-3 py-3 transition-colors sm:px-4 ${
                    selected
                        ? 'border-primary/30 bg-primary/5'
                        : isBoth && !card.color
                          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                          : 'bg-card hover:bg-muted/30'
                }`}
                style={
                    card.color
                        ? { borderLeftColor: card.color, borderLeftWidth: 3 }
                        : isBoth
                          ? { borderLeftWidth: 3 }
                          : {}
                }
            >
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => onSelect(card.id, e.target.checked)}
                    className="size-4 shrink-0 cursor-pointer rounded border-input accent-primary"
                    aria-label="Kártya kijelölése"
                />

                {/* Card content — clickable for preview */}
                <button
                    type="button"
                    onClick={() => onPreview(card)}
                    className="min-w-0 flex-1 text-left"
                >
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                            {plainText(card.front, 80)}
                        </span>
                        {isBoth && (
                            <ArrowLeftRight className="size-3 shrink-0 text-primary/60" />
                        )}
                        {card.review?.is_leech && (
                            <span className="shrink-0 text-[10px] font-semibold text-destructive">
                                ⚠
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {plainText(card.back, 70)}
                    </div>

                    {/* Mobilon az állapot a tartalom alatt */}
                    <div className="mt-1.5 flex items-center gap-1.5 sm:hidden">
                        <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClass(reviewState)}`}
                        >
                            {STATE_LABELS[reviewState] ?? 'Új'}
                        </span>
                        {card.review && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                {formatDue(
                                    card.review.due_at,
                                    card.review.state,
                                    now,
                                )}
                            </span>
                        )}
                    </div>
                </button>

                {/* State badge + due — fixed column (csak desktopon) */}
                <div className="hidden w-24 shrink-0 flex-col items-end gap-0.5 sm:flex">
                    <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClass(reviewState)}`}
                    >
                        {STATE_LABELS[reviewState] ?? 'Új'}
                    </span>
                    {card.review && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                            {formatDue(
                                card.review.due_at,
                                card.review.state,
                                now,
                            )}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                    {onPractice && (
                        <button
                            onClick={() => onPractice(card)}
                            className="inline-flex size-8 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                            title="Mondatírás gyakorlás"
                        >
                            <Sparkles className="size-3.5" />
                        </button>
                    )}
                    <button
                        onClick={() => onEdit(card)}
                        className="hidden size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
                        title="Szerkesztés"
                    >
                        <Edit2 className="size-3.5" />
                    </button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                                <MoreHorizontal className="size-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">
                                Kártya műveletek
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => onStats(card)}>
                                <Info className="mr-2 size-3.5" />
                                Statisztika
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() =>
                                    router.post(
                                        duplicateCard({
                                            deck: deck.id,
                                            flashcard: card.id,
                                        }),
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <Copy className="mr-2 size-3.5" />
                                Másolat létrehozása
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() =>
                                    router.patch(
                                        updateCard({
                                            deck: deck.id,
                                            flashcard: card.id,
                                        }),
                                        {
                                            direction:
                                                card.direction === 'both'
                                                    ? 'front_to_back'
                                                    : 'both',
                                        },
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <ArrowLeftRight className="mr-2 size-3.5" />
                                {card.direction === 'both'
                                    ? 'Visszaállítás (1 irányú)'
                                    : 'Kétirányú kártya'}
                            </DropdownMenuItem>

                            {otherDecks.length > 0 && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <MoveRight className="mr-2 size-3.5" />
                                        Áthelyezés
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-48">
                                        {otherDecks.map((d) => (
                                            <DropdownMenuItem
                                                key={d.id}
                                                onClick={() =>
                                                    setMoveTarget({
                                                        id: d.id,
                                                        name: d.name,
                                                    })
                                                }
                                            >
                                                {d.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={() => setConfirm('reset')}
                            >
                                <RotateCcw className="mr-2 size-3.5" />
                                Haladás visszaállítása
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setConfirm('delete')}
                            >
                                <Trash2 className="mr-2 size-3.5" />
                                Törlés
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <ConfirmDialog
                open={confirm === 'reset'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Haladás visszaállítása"
                confirmLabel="Igen, visszaállítom"
                description={
                    <>
                        A(z){' '}
                        <strong className="text-foreground">
                            {plainText(card.front, 40)}
                        </strong>{' '}
                        kártya SRS-adatai törlődnek, és a kártya újként kerül
                        vissza a tanulási sorba.
                    </>
                }
                onConfirm={() =>
                    router.post(
                        resetProgress({ deck: deck.id, flashcard: card.id }),
                        {},
                        { preserveScroll: true },
                    )
                }
            />

            <ConfirmDialog
                open={confirm === 'delete'}
                onOpenChange={(open) => !open && setConfirm(null)}
                title="Kártya törlése"
                destructive
                confirmLabel="Igen, törlöm"
                description={
                    <>
                        A(z){' '}
                        <strong className="text-foreground">
                            {plainText(card.front, 40)}
                        </strong>{' '}
                        kártya a tanulási előzményeivel együtt véglegesen
                        törlődik. Ez nem vonható vissza.
                    </>
                }
                onConfirm={() =>
                    router.delete(
                        destroyCard({ deck: deck.id, flashcard: card.id }),
                        { preserveScroll: true },
                    )
                }
            />

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
                            {
                                target_deck_id: moveTarget.id,
                                reset_progress: resetProgress,
                            },
                            { preserveScroll: true },
                        );
                    }}
                />
            )}
        </>
    );
}
