import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { index, show } from '@/routes/flashcards';
import { rate as rateCard } from '@/routes/flashcards/calibrate';

type Card = {
    id: number;
    front: string;
    front_notes: string | null;
    back: string;
    back_notes: string | null;
    direction: 'front_to_back' | 'back_to_front' | 'both';
    color: string | null;
};

type Deck = { id: number; name: string };

const RATINGS = [
    {
        rating: 1,
        label: 'Nem tudom',
        description: 'Marad újként',
        shortcut: '1',
        className: 'border-destructive/50 text-destructive hover:bg-destructive/10',
    },
    {
        rating: 2,
        label: 'Valamennyire',
        description: '≈ 1–2 héten belül',
        shortcut: '2',
        className: 'border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950',
    },
    {
        rating: 3,
        label: 'Tudom',
        description: '≈ 2–8 héten belül',
        shortcut: '3',
        className: 'border-green-500/50 text-green-600 hover:bg-green-50 dark:hover:bg-green-950',
    },
] as const;

function getXsrfToken(): string {
    const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

export default function FlashcardCalibrate({ deck, cards }: { deck: Deck; cards: Card[] }) {
    const { flash } = usePage<{ flash: { success?: string | null } }>().props;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [done, setDone] = useState(false);
    const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0 });

    const current = cards[currentIndex] ?? null;

    const handleRate = useCallback(
        (rating: 1 | 2 | 3) => {
            if (!current) return;

            setCounts((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));

            // Fire-and-forget
            fetch(rateCard(deck.id).url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({ flashcard_id: current.id, rating }),
            }).catch(() => {});

            const next = currentIndex + 1;
            if (next >= cards.length) {
                setDone(true);
            } else {
                setCurrentIndex(next);
            }
        },
        [current, currentIndex, cards.length, deck.id],
    );

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (['1', '2', '3'].includes(e.key)) {
                handleRate(Number(e.key) as 1 | 2 | 3);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleRate]);

    if (done || cards.length === 0) {
        return (
            <>
                <Head title="Kalibráció kész" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 text-center px-4">
                    <CheckCircle className="size-16 text-green-500" />
                    <div>
                        <h2 className="text-2xl font-bold">Kalibráció kész!</h2>
                        <p className="text-muted-foreground mt-1">
                            {cards.length === 0
                                ? 'Nincs kalibrálásra váró kártya.'
                                : `${cards.length} kártyát értékeltél.`}
                        </p>
                    </div>
                    {cards.length > 0 && (
                        <div className="flex gap-6 text-sm">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-destructive">{counts[1]}</p>
                                <p className="text-muted-foreground">Nem tudtam</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-amber-500">{counts[2]}</p>
                                <p className="text-muted-foreground">Valamennyire</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-500">{counts[3]}</p>
                                <p className="text-muted-foreground">Tudtam</p>
                            </div>
                        </div>
                    )}
                    <Link href={show(deck.id)}>
                        <Button>
                            <ArrowLeft className="size-4 mr-2" />
                            Vissza a deckhez
                        </Button>
                    </Link>
                </div>
            </>
        );
    }

    const progress = Math.round((currentIndex / cards.length) * 100);

    return (
        <>
            <Head title={`Kalibráció · ${deck.name}`} />

            <div className="flex flex-col min-h-[80vh] px-4 py-6 max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link href={show(deck.id)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <ArrowLeft className="size-4" />
                        {deck.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                        {currentIndex + 1} / {cards.length}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full bg-muted rounded-full mb-8 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                <p className="text-xs text-muted-foreground text-center mb-4">
                    Nézd meg a kártyát és értékeld, mennyire ismered — mindkét oldal látható.
                </p>

                {/* Card — both sides visible */}
                <div
                    className="rounded-2xl border bg-card shadow-sm overflow-hidden mb-6"
                    style={current.color ? { borderColor: current.color, borderWidth: 2 } : {}}
                >
                    {/* Front */}
                    <div className="p-6 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Előlap</p>
                        <RichTextContent html={current.front} className="text-lg font-semibold" />
                        {current.front_notes && (
                            <RichTextContent html={current.front_notes} className="mt-2 text-sm text-muted-foreground" />
                        )}
                    </div>

                    <div className="border-t border-dashed" />

                    {/* Back */}
                    <div className="p-6 text-center bg-muted/20">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Hátlap</p>
                        <RichTextContent html={current.back} className="text-base" />
                        {current.back_notes && (
                            <RichTextContent html={current.back_notes} className="mt-2 text-sm text-muted-foreground" />
                        )}
                    </div>
                </div>

                {/* Rating buttons */}
                <div className="grid grid-cols-3 gap-3">
                    {RATINGS.map(({ rating, label, description, shortcut, className }) => (
                        <button
                            key={rating}
                            onClick={() => handleRate(rating)}
                            className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-4 px-2 text-sm font-medium transition-colors ${className}`}
                        >
                            <span className="text-xs opacity-50">{shortcut}</span>
                            {label}
                            <span className="text-xs font-normal opacity-70">{description}</span>
                        </button>
                    ))}
                </div>

                <p className="text-center text-xs text-muted-foreground mt-4">
                    Billentyűk: <kbd className="px-1.5 py-0.5 rounded border text-xs">1</kbd>{' '}
                    <kbd className="px-1.5 py-0.5 rounded border text-xs">2</kbd>{' '}
                    <kbd className="px-1.5 py-0.5 rounded border text-xs">3</kbd>
                </p>
            </div>
        </>
    );
}

FlashcardCalibrate.layout = {
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
        { title: 'Kalibráció', href: '#' },
    ],
};
