import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, CheckCircle, Undo2, RotateCcw, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { index, show } from '@/routes/flashcards';
import { submit as submitReview, undo as undoReview } from '@/routes/flashcards/study';

type Review = {
    state: 'new' | 'learning' | 'review' | 'relearning';
    interval: number;
    lapses: number;
    is_leech: boolean;
};

type Previews = { again: string; hard: string; good: string; easy: string };

type Card = {
    id: number;
    front: string;
    front_notes: string | null;
    front_speak: string | null;
    back: string;
    back_notes: string | null;
    back_speak: string | null;
    study_direction: 'front_to_back' | 'back_to_front';
    color: string | null;
    review: Review;
    previews: Previews;
    other_side_due_at: string | null;
};

type Deck = { id: number; name: string };

const RATING_BUTTONS = [
    { rating: 1, label: 'Nem tudtam', previewKey: 'again' as const, shortcut: '1', className: 'border-destructive/50 text-destructive hover:bg-destructive/10' },
    { rating: 2, label: 'Nehéz',      previewKey: 'hard'  as const, shortcut: '2', className: 'border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950' },
    { rating: 3, label: 'Jó',         previewKey: 'good'  as const, shortcut: '3', className: 'border-blue-500/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950' },
    { rating: 4, label: 'Könnyű',     previewKey: 'easy'  as const, shortcut: '4', className: 'border-green-500/50 text-green-600 hover:bg-green-50 dark:hover:bg-green-950' },
];

function formatRelativeTime(isoString: string): string {
    const diff = Math.round((new Date(isoString).getTime() - Date.now()) / 60000);
    if (diff <= 0) return 'most esedékes';
    if (diff < 60) return `${diff} perc múlva`;
    const hours = Math.round(diff / 60);
    if (hours < 24) return `${hours} óra múlva`;
    return `${Math.round(hours / 24)} nap múlva`;
}

function resolveCardSides(card: Card): { question: string; questionNotes: string | null; questionSpeak: string | null; answer: string; answerNotes: string | null; answerSpeak: string | null } {
    return card.study_direction === 'back_to_front'
        ? { question: card.back, questionNotes: card.back_notes, questionSpeak: card.back_speak, answer: card.front, answerNotes: card.front_notes, answerSpeak: card.front_speak }
        : { question: card.front, questionNotes: card.front_notes, questionSpeak: card.front_speak, answer: card.back, answerNotes: card.back_notes, answerSpeak: card.back_speak };
}

type HistoryEntry = { id: number; direction: string };

function getXsrfToken(): string {
    const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

export default function FlashcardStudy({ deck, cards }: { deck: Deck; cards: Card[] }) {
    const [queue, setQueue] = useState<Card[]>(cards);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    // Track in-flight rating fetches keyed by "id-direction" so undo can wait for them
    const pendingRatings = useRef<Map<string, Promise<void>>>(new Map());
    const answerRef = useRef<HTMLDivElement>(null);

    const current = queue[currentIndex] ?? null;
    const sides = current ? resolveCardSides(current) : null;

    const speak = useCallback((html: string, speakOverride?: string | null, lang = 'en-US') => {
        if (!window.speechSynthesis) return;
        const text = speakOverride?.trim() || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang;
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
    }, []);

    const handleReveal = useCallback(() => {
        if (!revealed) {
            setRevealed(true);
            setTimeout(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
    }, [revealed]);

    const handleRate = useCallback(
        (ratingValue: number) => {
            if (!current || submitting) return;

            const cardId = current.id;
            const direction = current.study_direction;
            const key = `${cardId}-${direction}`;

            setSubmitting(true);

            // Advance immediately — never block on the network
            setHistory((prev) => [...prev, { id: cardId, direction }]);
            const next = currentIndex + 1;
            if (next >= queue.length) {
                setDone(true);
            } else {
                setCurrentIndex(next);
                setRevealed(false);
            }

            // Fire-and-forget: submit rating in the background
            const promise = fetch(submitReview(deck.id).url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({ flashcard_id: cardId, direction, rating: ratingValue }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data?.achievements) && data.achievements.length > 0) {
                        window.dispatchEvent(new CustomEvent('achievements-unlocked', { detail: data.achievements }));
                    }
                })
                .catch(() => {})
                .finally(() => {
                    pendingRatings.current.delete(key);
                    setSubmitting(false);
                }) as Promise<void>;

            pendingRatings.current.set(key, promise);
        },
        [current, currentIndex, queue.length, deck.id, submitting],
    );

    const handleUndo = useCallback(async () => {
        if (history.length === 0 || undoing) return;

        const last = history[history.length - 1];
        const key = `${last.id}-${last.direction}`;

        setUndoing(true);

        // Wait for any in-flight rating for this card before undoing
        if (pendingRatings.current.has(key)) {
            await pendingRatings.current.get(key);
        }

        try {
            await fetch(undoReview(deck.id).url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({ flashcard_id: last.id, direction: last.direction }),
            });
        } catch {
            // continue anyway
        } finally {
            setUndoing(false);
        }

        setHistory((prev) => prev.slice(0, -1));
        setDone(false);
        setCurrentIndex((prev) => prev - 1);
        setRevealed(false);
    }, [history, undoing, deck.id]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!revealed) handleReveal();
            }
            if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
                handleRate(Number(e.key));
            }
            if (e.key === 'Backspace' && history.length > 0) {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [revealed, handleReveal, handleRate, handleUndo, history.length, undoing]);

    if (done || queue.length === 0) {
        return (
            <>
                <Head title="Kész!" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 text-center px-4">
                    <CheckCircle className="size-16 text-green-500" />
                    <div>
                        <h2 className="text-2xl font-bold">Szuper!</h2>
                        <p className="text-muted-foreground mt-1">
                            {queue.length === 0
                                ? 'Nincs esedékes kártya ebben a deckben.'
                                : `${queue.length} kártyát átnéztél.`}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href={show(deck.id)}>
                            <Button variant="outline">
                                <ArrowLeft className="size-4 mr-2" />
                                Vissza a deckhez
                            </Button>
                        </Link>
                        <Button onClick={() => router.reload()}>
                            <RotateCcw className="size-4 mr-2" />
                            Újratöltés
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    const progress = Math.round((currentIndex / queue.length) * 100);

    return (
        <>
            <Head title={`Tanulás · ${deck.name}`} />

            <div className="flex flex-col min-h-[80vh] px-4 py-6 max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link href={show(deck.id)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <ArrowLeft className="size-4" />
                        {deck.name}
                    </Link>
                    <div className="flex items-center gap-3">
                        {history.length > 0 && (
                            <button
                                onClick={handleUndo}
                                disabled={undoing}
                                title="Vissza (Backspace)"
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                            >
                                <Undo2 className="size-3.5" />
                                Vissza
                            </button>
                        )}
                        <span className="text-sm text-muted-foreground">
                            {currentIndex + 1} / {queue.length}
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 w-full bg-muted rounded-full mb-8 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Card */}
                <div className="flex-1 flex flex-col gap-4">
                    {/* Question */}
                    <div
                        className="relative flex-1 flex flex-col items-center justify-center rounded-2xl border bg-card shadow-sm p-8 text-center min-h-48 cursor-pointer select-none"
                        style={current.color ? { borderColor: current.color, borderWidth: 2 } : {}}
                        onClick={handleReveal}
                    >
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                            {current.review.is_leech && (
                                <span className="text-xs text-destructive font-medium">⚠ leech</span>
                            )}
                            {current.other_side_due_at && (
                                <span className="text-xs text-muted-foreground/60" title="A másik irány esedékessége">
                                    ↔ {formatRelativeTime(current.other_side_due_at)}
                                </span>
                            )}
                        </div>
                        {sides!.questionSpeak && (
                            <button
                                onClick={(e) => { e.stopPropagation(); speak(sides!.question, sides!.questionSpeak); }}
                                className="absolute top-3 left-3 rounded-full p-1.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
                                title="Felolvasás"
                            >
                                <Volume2 className="size-4" />
                            </button>
                        )}
                        <span className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                            {current.review.state === 'new' ? 'Új kártya' :
                             current.review.state === 'learning' ? 'Tanulás' :
                             current.review.state === 'relearning' ? 'Újratanulás' :
                             `Ismétlés · ${current.review.interval} nap`}
                        </span>
                        <RichTextContent html={sides!.question} className="text-lg font-semibold" />
                        {sides!.questionNotes && (
                            <RichTextContent html={sides!.questionNotes} className="mt-3 text-sm text-muted-foreground" />
                        )}

                        {!revealed && (
                            <p className="mt-6 text-xs text-muted-foreground">
                                Kattints vagy nyomj <kbd className="px-1.5 py-0.5 rounded border text-xs">Space</kbd> a megjelenítéshez
                            </p>
                        )}
                    </div>

                    {/* Answer */}
                    {revealed && (
                        <div ref={answerRef} className="relative rounded-2xl border border-dashed bg-muted/30 p-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {sides!.answerSpeak && (
                                <button
                                    onClick={() => speak(sides!.answer, sides!.answerSpeak)}
                                    className="absolute top-3 left-3 rounded-full p-1.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors"
                                    title="Felolvasás"
                                >
                                    <Volume2 className="size-4" />
                                </button>
                            )}
                            <RichTextContent html={sides!.answer} className="text-base" />
                            {sides!.answerNotes && (
                                <RichTextContent html={sides!.answerNotes} className="mt-3 text-sm text-muted-foreground" />
                            )}
                        </div>
                    )}

                    {/* Rating buttons */}
                    {revealed && (
                        <div className="grid grid-cols-4 gap-2 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {RATING_BUTTONS.map(({ rating, label, previewKey, shortcut, className }) => (
                                <button
                                    key={rating}
                                    disabled={undoing || submitting}
                                    onClick={() => handleRate(rating)}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 px-2 text-sm font-medium transition-colors disabled:opacity-50 ${className}`}
                                >
                                    <span className="text-xs opacity-50">{shortcut}</span>
                                    {label}
                                    <span className="text-xs font-normal opacity-70">
                                        {current.previews[previewKey]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

FlashcardStudy.layout = {
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
        { title: 'Tanulás', href: '#' },
    ],
};
