import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle,
    Info,
    Square,
    Undo2,
    Volume2,
} from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { httpErrorMessage, postJson } from '@/lib/http';
import { showToast } from '@/lib/toast';
import { index, show } from '@/routes/flashcards';
import {
    submit as submitReview,
    undo as undoReview,
} from '@/routes/flashcards/study';

type PreviousState = {
    state: string;
    interval: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
    learning_step: number;
    due_at: string | null;
    introduced_on: string | null;
    reviewed_on: string | null;
};

type Review = {
    state: 'new' | 'learning' | 'review' | 'relearning';
    interval: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
    learning_step: number;
    is_leech: boolean;
    introduced_on: string | null;
    reviewed_on: string | null;
    due_at: string | null;
    previous_state: PreviousState | null;
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
    {
        rating: 1,
        label: 'Nem tudtam',
        previewKey: 'again' as const,
        shortcut: '1',
        className:
            'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60',
        textClass: 'text-destructive',
    },
    {
        rating: 2,
        label: 'Nehéz',
        previewKey: 'hard' as const,
        shortcut: '2',
        className:
            'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60',
        textClass: 'text-amber-600',
    },
    {
        rating: 3,
        label: 'Jó',
        previewKey: 'good' as const,
        shortcut: '3',
        className:
            'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/60',
        textClass: 'text-blue-600',
    },
    {
        rating: 4,
        label: 'Könnyű',
        previewKey: 'easy' as const,
        shortcut: '4',
        className:
            'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:hover:bg-green-950/60',
        textClass: 'text-green-600',
    },
];

function stateLabel(state: string): string {
    return (
        (
            {
                new: 'Új kártya',
                learning: 'Tanulás',
                review: 'Ismétlés',
                relearning: 'Újratanulás',
            } as Record<string, string>
        )[state] ?? state
    );
}

function stateBadgeClass(state: string): string {
    return (
        (
            {
                new: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                learning:
                    'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
                review: 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
                relearning:
                    'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
            } as Record<string, string>
        )[state] ?? 'bg-muted text-muted-foreground'
    );
}

function InfoRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

function formatRelativeTime(isoString: string): string {
    const diff = Math.round(
        (new Date(isoString).getTime() - Date.now()) / 60000,
    );

    if (diff <= 0) {
        return 'most esedékes';
    }

    if (diff < 60) {
        return `${diff} perc múlva`;
    }

    const hours = Math.round(diff / 60);

    if (hours < 24) {
        return `${hours} óra múlva`;
    }

    return `${Math.round(hours / 24)} nap múlva`;
}

function resolveCardSides(card: Card): {
    question: string;
    questionNotes: string | null;
    questionSpeak: string | null;
    answer: string;
    answerNotes: string | null;
    answerSpeak: string | null;
} {
    return card.study_direction === 'back_to_front'
        ? {
              question: card.back,
              questionNotes: card.back_notes,
              questionSpeak: card.back_speak,
              answer: card.front,
              answerNotes: card.front_notes,
              answerSpeak: card.front_speak,
          }
        : {
              question: card.front,
              questionNotes: card.front_notes,
              questionSpeak: card.front_speak,
              answer: card.back,
              answerNotes: card.back_notes,
              answerSpeak: card.back_speak,
          };
}

type HistoryEntry = { id: number; direction: string };

export default function FlashcardStudy({
    deck,
    cards,
}: {
    deck: Deck;
    cards: Card[];
}) {
    const [queue] = useState<Card[]>(cards);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [showInfo, setShowInfo] = useState(false);
    const [speakingSide, setSpeakingSide] = useState<
        'question' | 'answer' | null
    >(null);
    // Track in-flight rating fetches keyed by "id-direction" so undo can wait for them
    const pendingRatings = useRef<Map<string, Promise<void>>>(new Map());
    const answerRef = useRef<HTMLDivElement>(null);
    // Bumped on every stop so stale onend/timeout callbacks bail out instead of
    // queuing the next chunk after the user has interrupted playback.
    const speakSessionRef = useRef(0);
    const speakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const current = queue[currentIndex] ?? null;
    const sides = current ? resolveCardSides(current) : null;

    const stopSpeaking = useCallback(() => {
        speakSessionRef.current += 1;

        if (speakTimeoutRef.current) {
            clearTimeout(speakTimeoutRef.current);
            speakTimeoutRef.current = null;
        }

        window.speechSynthesis?.cancel();
        setSpeakingSide(null);
    }, []);

    const speak = useCallback(
        (
            side: 'question' | 'answer',
            html: string,
            speakOverride?: string | null,
            lang = 'en-US',
        ) => {
            if (!window.speechSynthesis) {
                return;
            }

            const raw =
                speakOverride?.trim() ||
                html
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();

            if (!raw) {
                return;
            }

            stopSpeaking();
            const session = speakSessionRef.current;
            setSpeakingSide(side);

            const parts = raw
                .split('\n')
                .map((p) => p.trim())
                .filter(Boolean);

            const speakPart = (index: number) => {
                if (session !== speakSessionRef.current) {
                    return;
                }

                if (index >= parts.length) {
                    setSpeakingSide(null);

                    return;
                }

                const u = new SpeechSynthesisUtterance(parts[index]);
                u.lang = lang;
                u.rate = 0.9;
                u.onend = () => {
                    if (session !== speakSessionRef.current) {
                        return;
                    }

                    if (index < parts.length - 1) {
                        speakTimeoutRef.current = setTimeout(
                            () => speakPart(index + 1),
                            700,
                        );
                    } else {
                        setSpeakingSide(null);
                    }
                };
                u.onerror = () => {
                    if (session === speakSessionRef.current) {
                        setSpeakingSide(null);
                    }
                };
                window.speechSynthesis.speak(u);
            };

            speakPart(0);
        },
        [stopSpeaking],
    );

    const handleReveal = useCallback(() => {
        if (!revealed) {
            setRevealed(true);
            setTimeout(
                () =>
                    answerRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                    }),
                50,
            );
        }
    }, [revealed]);

    const handleRate = useCallback(
        (ratingValue: number) => {
            if (!current || submitting || undoing || done) {
                return;
            }

            const cardId = current.id;
            const direction = current.study_direction;
            const key = `${cardId}-${direction}`;

            stopSpeaking();
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

            // Fire-and-forget: submit rating in the background, but surface
            // failures (expired session, throttle, 500) — otherwise ratings
            // are lost silently while the UI keeps advancing.
            const promise = postJson(submitReview(deck.id).url, {
                flashcard_id: cardId,
                direction,
                rating: ratingValue,
            })
                .then(({ ok, status, data }) => {
                    if (!ok) {
                        showToast(
                            'error',
                            httpErrorMessage(
                                status,
                                'Az értékelés mentése nem sikerült — ez a kártya nem lett elmentve.',
                            ),
                        );

                        return;
                    }

                    if (
                        Array.isArray(data?.achievements) &&
                        data.achievements.length > 0
                    ) {
                        window.dispatchEvent(
                            new CustomEvent('achievements-unlocked', {
                                detail: data.achievements,
                            }),
                        );
                    }
                })
                .catch(() => showToast('error', httpErrorMessage()))
                .finally(() => {
                    pendingRatings.current.delete(key);
                    setSubmitting(false);
                }) as Promise<void>;

            pendingRatings.current.set(key, promise);
        },
        [
            current,
            currentIndex,
            queue.length,
            deck.id,
            submitting,
            undoing,
            done,
            stopSpeaking,
        ],
    );

    const handleUndo = useCallback(async () => {
        if (history.length === 0 || undoing) {
            return;
        }

        const last = history[history.length - 1];
        const key = `${last.id}-${last.direction}`;

        stopSpeaking();
        setUndoing(true);

        // Wait for any in-flight rating for this card before undoing
        if (pendingRatings.current.has(key)) {
            await pendingRatings.current.get(key);
        }

        // Only roll back the UI if the server-side undo succeeded — otherwise
        // the screen would step back while the review still counts on the
        // server, and re-rating the card would create a duplicate review.
        try {
            const { ok, status } = await postJson(undoReview(deck.id).url, {
                flashcard_id: last.id,
                direction: last.direction,
            });

            if (!ok) {
                showToast(
                    'error',
                    httpErrorMessage(
                        status,
                        'A visszavonás nem sikerült — próbáld újra.',
                    ),
                );

                return;
            }
        } catch {
            showToast('error', httpErrorMessage());

            return;
        } finally {
            setUndoing(false);
        }

        setHistory((prev) => prev.slice(0, -1));
        setDone(false);
        // Derive the index from the history instead of decrementing: rating the
        // last card sets `done` without advancing currentIndex, so a plain
        // decrement would slip one card back too far (and could go below 0).
        setCurrentIndex(Math.max(0, history.length - 1));
        setRevealed(false);
    }, [history, undoing, deck.id, stopSpeaking]);

    // Stop any in-flight speech when leaving the study view.
    useEffect(() => stopSpeaking, [stopSpeaking]);

    // Scroll back to the top after the new card has rendered. Runs before paint
    // so a tall next card never leaves the view stuck at the previous scroll
    // position. Tied to currentIndex so it also covers undo navigation.
    useLayoutEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [currentIndex]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                return;
            }

            if (e.key === 'Backspace' && history.length > 0) {
                e.preventDefault();
                handleUndo();

                return;
            }

            // On the done screen only undo is allowed; the reveal/rating keys
            // would act on the already-rated last card.
            if (done) {
                return;
            }

            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();

                if (!revealed) {
                    handleReveal();
                }
            }

            if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
                handleRate(Number(e.key));
            }
        };
        window.addEventListener('keydown', handler);

        return () => window.removeEventListener('keydown', handler);
    }, [
        revealed,
        done,
        handleReveal,
        handleRate,
        handleUndo,
        history.length,
        undoing,
    ]);

    if (done || queue.length === 0) {
        return (
            <>
                <Head title="Kész!" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
                    <CheckCircle className="size-16 text-green-500" />
                    <div>
                        <h2 className="text-2xl font-bold">Szuper!</h2>
                        <p className="mt-1 text-muted-foreground">
                            {queue.length === 0
                                ? 'Nincs esedékes kártya ebben a deckben.'
                                : `${queue.length} kártyát átnéztél.`}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link href={show(deck.id)}>
                            <Button variant="outline">
                                <ArrowLeft className="mr-2 size-4" />
                                Vissza a deckhez
                            </Button>
                        </Link>
                        {history.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={handleUndo}
                                disabled={undoing}
                                title="Visszavonás (Backspace)"
                            >
                                <Undo2 className="mr-2 size-4" />
                                Visszavonás
                            </Button>
                        )}
                    </div>
                </div>
            </>
        );
    }

    const progress = Math.round((currentIndex / queue.length) * 100);

    return (
        <>
            <Head title={`Tanulás · ${deck.name}`} />

            <div className="mx-auto flex min-h-[80vh] max-w-2xl min-w-90 flex-col px-4 pb-20 md:py-6 xl:min-w-2xl">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <Link
                        href={show(deck.id)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                        {deck.name}
                    </Link>
                    <div className="flex items-center gap-3">
                        {history.length > 0 && (
                            <button
                                onClick={handleUndo}
                                disabled={undoing}
                                title="Vissza (Backspace)"
                                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
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
                <div className="mb-8 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Card */}
                <div className="flex flex-1 flex-col gap-4">
                    {/* Question */}
                    <div
                        className="relative flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl bg-card p-5 text-center shadow-sm select-none sm:p-8"
                        style={
                            current.color
                                ? {
                                      boxShadow: `inset 0 0 0 2px ${current.color}`,
                                  }
                                : {}
                        }
                        onClick={handleReveal}
                    >
                        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowInfo(true);
                                }}
                                className="rounded-full p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                                title="Statisztika"
                            >
                                <Info className="size-3.5" />
                            </button>
                            {current.review.is_leech && (
                                <span className="text-xs font-medium text-destructive">
                                    ⚠ leech
                                </span>
                            )}
                            {current.other_side_due_at && (
                                <span
                                    className="text-xs text-muted-foreground/60"
                                    title="A másik irány esedékessége"
                                >
                                    ↔{' '}
                                    {formatRelativeTime(
                                        current.other_side_due_at,
                                    )}
                                </span>
                            )}
                        </div>
                        {sides!.questionSpeak && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();

                                    if (speakingSide === 'question') {
                                        stopSpeaking();
                                    } else {
                                        speak(
                                            'question',
                                            sides!.question,
                                            sides!.questionSpeak,
                                        );
                                    }
                                }}
                                className={`absolute top-3 left-3 rounded-full p-1.5 transition-colors ${
                                    speakingSide === 'question'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground'
                                }`}
                                title={
                                    speakingSide === 'question'
                                        ? 'Leállítás'
                                        : 'Felolvasás'
                                }
                            >
                                {speakingSide === 'question' ? (
                                    <Square className="size-4 fill-current" />
                                ) : (
                                    <Volume2 className="size-4" />
                                )}
                            </button>
                        )}
                        <span className="mb-3 text-xs tracking-wide text-muted-foreground uppercase">
                            {current.review.state === 'new'
                                ? 'Új kártya'
                                : current.review.state === 'learning'
                                  ? 'Tanulás'
                                  : current.review.state === 'relearning'
                                    ? 'Újratanulás'
                                    : `Ismétlés · ${current.review.interval} nap`}
                        </span>
                        <RichTextContent
                            html={sides!.question}
                            className="text-lg font-semibold"
                        />
                        {sides!.questionNotes && (
                            <RichTextContent
                                html={sides!.questionNotes}
                                className="mt-3 text-sm text-muted-foreground"
                            />
                        )}

                        {!revealed && (
                            <p className="mt-6 text-xs text-muted-foreground">
                                <span className="sm:hidden">
                                    Koppints a válasz megjelenítéséhez
                                </span>
                                <span className="hidden sm:inline">
                                    Kattints vagy nyomj{' '}
                                    <kbd className="rounded border px-1.5 py-0.5 text-xs">
                                        Space
                                    </kbd>{' '}
                                    a megjelenítéshez
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Answer */}
                    {revealed && (
                        <div
                            ref={answerRef}
                            className="relative flex min-h-64 animate-in flex-col items-center justify-center rounded-3xl bg-accent/60 p-6 text-center duration-200 fade-in slide-in-from-bottom-2"
                        >
                            {sides!.answerSpeak && (
                                <button
                                    onClick={() => {
                                        if (speakingSide === 'answer') {
                                            stopSpeaking();
                                        } else {
                                            speak(
                                                'answer',
                                                sides!.answer,
                                                sides!.answerSpeak,
                                            );
                                        }
                                    }}
                                    className={`absolute top-3 left-3 rounded-full p-1.5 transition-colors ${
                                        speakingSide === 'answer'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground/50 hover:bg-muted hover:text-foreground'
                                    }`}
                                    title={
                                        speakingSide === 'answer'
                                            ? 'Leállítás'
                                            : 'Felolvasás'
                                    }
                                >
                                    {speakingSide === 'answer' ? (
                                        <Square className="size-4 fill-current" />
                                    ) : (
                                        <Volume2 className="size-4" />
                                    )}
                                </button>
                            )}
                            <RichTextContent
                                html={sides!.answer}
                                className="text-base"
                            />
                            {sides!.answerNotes && (
                                <RichTextContent
                                    html={sides!.answerNotes}
                                    className="mt-3 text-sm text-muted-foreground"
                                />
                            )}
                        </div>
                    )}

                    {/* Rating buttons */}
                    {revealed && (
                        <div className="mt-2 grid animate-in grid-cols-2 gap-2 duration-200 fade-in slide-in-from-bottom-2 sm:grid-cols-4">
                            {RATING_BUTTONS.map(
                                ({
                                    rating,
                                    label,
                                    previewKey,
                                    shortcut,
                                    className,
                                }) => (
                                    <button
                                        key={rating}
                                        disabled={undoing || submitting}
                                        onClick={() => handleRate(rating)}
                                        className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3.5 text-sm font-semibold shadow-sm transition-all hover:shadow active:scale-95 disabled:opacity-50 ${className}`}
                                    >
                                        <span className="hidden text-xs opacity-50 sm:inline">
                                            {shortcut}
                                        </span>
                                        {label}
                                        <span className="text-xs font-normal opacity-70">
                                            {current.previews[previewKey]}
                                        </span>
                                    </button>
                                ),
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Card info dialog */}
            {current && (
                <Dialog open={showInfo} onOpenChange={setShowInfo}>
                    <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xs">
                        <DialogHeader>
                            <DialogTitle className="text-base">
                                Kártya statisztika
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 pt-1">
                            {/* Current state */}
                            <div>
                                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    Jelenlegi állapot
                                </p>
                                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                    <InfoRow label="Állapot">
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadgeClass(current.review.state)}`}
                                        >
                                            {stateLabel(current.review.state)}
                                        </span>
                                    </InfoRow>
                                    {(current.review.state === 'learning' ||
                                        current.review.state ===
                                            'relearning') && (
                                        <InfoRow label="Tanulási lépés">
                                            <span className="font-medium">
                                                {current.review.learning_step +
                                                    1}
                                                . lépés
                                            </span>
                                        </InfoRow>
                                    )}
                                    {current.review.state === 'review' && (
                                        <InfoRow label="Intervallum">
                                            <span className="font-medium">
                                                {current.review.interval} nap
                                            </span>
                                        </InfoRow>
                                    )}
                                    <InfoRow label="Ease factor">
                                        <span className="font-medium">
                                            {(
                                                current.review.ease_factor / 100
                                            ).toFixed(2)}
                                        </span>
                                    </InfoRow>
                                    <InfoRow label="Ismétlések">
                                        <span className="font-medium">
                                            {current.review.repetitions}
                                        </span>
                                    </InfoRow>
                                    <InfoRow label="Tévesztések">
                                        <span className="font-medium">
                                            {current.review.lapses}
                                        </span>
                                    </InfoRow>
                                    {current.review.introduced_on && (
                                        <InfoRow label="Bevezetve">
                                            <span className="font-medium">
                                                {current.review.introduced_on}
                                            </span>
                                        </InfoRow>
                                    )}
                                    {current.review.reviewed_on && (
                                        <InfoRow label="Utolsó ismétlés">
                                            <span className="font-medium">
                                                {current.review.reviewed_on}
                                            </span>
                                        </InfoRow>
                                    )}
                                    {current.review.is_leech && (
                                        <p className="text-xs text-destructive">
                                            ⚠ Leech — sokat tévesztett kártya
                                        </p>
                                    )}
                                </div>
                                <p className="mt-1.5 text-center text-[11px] text-muted-foreground/60">
                                    A statisztika a munkamenet kezdeti állapotát
                                    tükrözi.
                                </p>
                            </div>

                            {/* Previous state */}
                            {current.review.previous_state && (
                                <div>
                                    <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Előző állapot
                                    </p>
                                    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                        <InfoRow label="Állapot">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadgeClass(current.review.previous_state.state)}`}
                                            >
                                                {stateLabel(
                                                    current.review
                                                        .previous_state.state,
                                                )}
                                            </span>
                                        </InfoRow>
                                        {(current.review.previous_state
                                            .state === 'learning' ||
                                            current.review.previous_state
                                                .state === 'relearning') && (
                                            <InfoRow label="Tanulási lépés volt">
                                                <span className="font-medium">
                                                    {current.review
                                                        .previous_state
                                                        .learning_step + 1}
                                                    . lépés
                                                </span>
                                            </InfoRow>
                                        )}
                                        {current.review.previous_state
                                            .interval > 0 && (
                                            <InfoRow label="Intervallum volt">
                                                <span className="font-medium">
                                                    {
                                                        current.review
                                                            .previous_state
                                                            .interval
                                                    }{' '}
                                                    nap
                                                </span>
                                            </InfoRow>
                                        )}
                                        <InfoRow label="Ease factor volt">
                                            <span className="font-medium">
                                                {(
                                                    current.review
                                                        .previous_state
                                                        .ease_factor / 100
                                                ).toFixed(2)}
                                            </span>
                                        </InfoRow>
                                        <InfoRow label="Tévesztések volt">
                                            <span className="font-medium">
                                                {
                                                    current.review
                                                        .previous_state.lapses
                                                }
                                            </span>
                                        </InfoRow>
                                    </div>
                                </div>
                            )}

                            {/* Next steps */}
                            <div>
                                <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    Következő lépések
                                </p>
                                {revealed ? (
                                    <div className="overflow-hidden rounded-lg border">
                                        {RATING_BUTTONS.map(
                                            (
                                                {
                                                    rating,
                                                    label,
                                                    previewKey,
                                                    textClass,
                                                },
                                                i,
                                            ) => (
                                                <div
                                                    key={rating}
                                                    className={`flex items-center justify-between px-3 py-2 text-sm ${i < RATING_BUTTONS.length - 1 ? 'border-b' : ''}`}
                                                >
                                                    <span
                                                        className={`font-medium ${textClass}`}
                                                    >
                                                        {label}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {
                                                            current.previews[
                                                                previewKey
                                                            ]
                                                        }
                                                    </span>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Fedezd fel a kártyát az értékek
                                        megtekintéséhez.
                                    </p>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

FlashcardStudy.layout = (props: { deck: Deck }) => ({
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
        { title: props.deck.name, href: show(props.deck.id) },
        { title: 'Tanulás', href: '#' },
    ],
});
