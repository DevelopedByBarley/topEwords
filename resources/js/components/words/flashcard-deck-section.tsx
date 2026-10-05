import { Link } from '@inertiajs/react';
import { CheckCheck, Layers, Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { absorbAiBudget } from '@/lib/ai-budget';
import { csrfHeaders } from '@/lib/csrf';
import type { GeminiWordData } from '@/lib/gemini-word';
import { geminiErrorMessage } from '@/lib/gemini-word';
import { httpErrorMessage, postJson } from '@/lib/http';
import { withMinDuration } from '@/lib/min-duration';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { index as flashcardsIndex } from '@/routes/flashcards';
import {
    importMethod as importFromWord,
    store as storeCard,
} from '@/routes/flashcards/cards';
import { geminiFlashcard } from '@/routes/text-analysis';
import type { FlashcardDeck } from '@/types/words';

type CardSource = { word_id: number } | { custom_word_id: number };

interface FlashcardDeckSectionProps {
    word: string;
    source: CardSource;
    hasAiAccess: boolean;
    flashcardDecks: FlashcardDeck[];
    deckId: string;
    onDeckChange: (deckId: string) => void;
}

export default function FlashcardDeckSection({
    word,
    source,
    hasAiAccess,
    flashcardDecks,
    deckId,
    onDeckChange,
}: FlashcardDeckSectionProps) {
    const [plainSaving, setPlainSaving] = useState(false);
    const [plainSaved, setPlainSaved] = useState(false);
    const [aiCard, setAiCard] = useState<{
        front: string;
        back: string;
    } | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiSaved, setAiSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    if (flashcardDecks.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                Flashcardként mentéshez előbb{' '}
                <Link
                    href={flashcardsIndex().url}
                    className="text-primary underline underline-offset-2"
                >
                    hozz létre egy csomagot
                </Link>
                .
            </p>
        );
    }

    const saveErrorMessage = (status: number, data: Record<string, unknown>) =>
        (status === 403 || status === 409) && typeof data.message === 'string'
            ? data.message
            : httpErrorMessage(
                  status,
                  'A kártya felvétele nem sikerült — próbáld újra.',
              );

    const handlePlainAdd = async () => {
        if (!deckId) {
            return;
        }

        setPlainSaving(true);
        setError(null);

        try {
            const { ok, status, data } = await postJson(
                importFromWord.url(Number(deckId)),
                source,
            );

            if (!mountedRef.current) {
                return;
            }

            if (ok) {
                setPlainSaved(true);
            } else {
                setError(saveErrorMessage(status, data));
            }
        } catch {
            if (mountedRef.current) {
                setError(httpErrorMessage());
            }
        } finally {
            if (mountedRef.current) {
                setPlainSaving(false);
            }
        }
    };

    const handleGenerate = async () => {
        setAiLoading(true);
        setAiSaved(false);
        setError(null);

        try {
            const res = await withMinDuration(
                fetch(geminiFlashcard.url({ query: { word } }), {
                    headers: { Accept: 'application/json', ...csrfHeaders() },
                }),
            );
            const data = (await res
                .json()
                .catch(() => ({}))) as GeminiWordData & {
                front?: string;
                back?: string;
            };

            absorbAiBudget(data);

            if (!mountedRef.current) {
                return;
            }

            if (!res.ok || data.error) {
                setError(geminiErrorMessage(res.status, data));
            } else if (data.is_real_word === false) {
                setError(data.message ?? 'Ez nem tűnik valódi angol szónak.');
            } else if (!data.front || !data.back) {
                setError('Az AI nem tudott kártyát készíteni — próbáld újra.');
            } else {
                setAiCard({ front: data.front, back: data.back });
            }
        } catch {
            if (mountedRef.current) {
                setError(
                    'Nincs hálózati kapcsolat — az AI-generálás nem sikerült.',
                );
            }
        } finally {
            if (mountedRef.current) {
                setAiLoading(false);
            }
        }
    };

    const handleSaveAiCard = async () => {
        if (!aiCard || !deckId) {
            return;
        }

        setAiSaving(true);
        setError(null);

        try {
            const { ok, status, data } = await postJson(
                storeCard.url(Number(deckId)),
                {
                    front: aiCard.front,
                    back: aiCard.back,
                    direction: 'both',
                    ...('word_id' in source ? { word_id: source.word_id } : {}),
                },
            );

            if (!mountedRef.current) {
                return;
            }

            if (ok) {
                setAiSaved(true);
            } else {
                setError(saveErrorMessage(status, data));
            }
        } catch {
            if (mountedRef.current) {
                setError(httpErrorMessage());
            }
        } finally {
            if (mountedRef.current) {
                setAiSaving(false);
            }
        }
    };

    const discardAiCard = () => {
        setAiCard(null);
        setAiSaved(false);
        setError(null);
    };

    return (
        <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Flashcard deckhez adás
            </p>
            <Select
                value={deckId}
                onValueChange={(value) => {
                    onDeckChange(value);
                    setPlainSaved(false);
                    setAiSaved(false);
                    setError(null);
                }}
            >
                <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue placeholder="Válassz decket..." />
                </SelectTrigger>
                <SelectContent>
                    {flashcardDecks.map((deck) => (
                        <SelectItem key={deck.id} value={String(deck.id)}>
                            {deck.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {aiCard ? (
                <div className="mt-3 space-y-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 dark:border-indigo-800 dark:bg-indigo-950/20">
                    <div className="flex items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                            <Sparkles className="size-3.5" />
                            AI kártya előnézete
                        </p>
                        <button
                            type="button"
                            onClick={discardAiCard}
                            title="Elvetés"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                    <AiCardSide label="Előlap" html={aiCard.front} />
                    <AiCardSide label="Hátlap" html={aiCard.back} />
                    <Button
                        size="sm"
                        className="w-full"
                        disabled={!deckId || aiSaving || aiSaved}
                        onClick={handleSaveAiCard}
                    >
                        {aiSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : aiSaved ? (
                            <CheckCheck className="size-4" />
                        ) : (
                            <Layers className="size-4" />
                        )}
                        {aiSaved
                            ? 'Hozzáadva!'
                            : deckId
                              ? 'AI kártya mentése a pakliba'
                              : 'Válassz paklit a mentéshez'}
                    </Button>
                </div>
            ) : (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Button
                        size="sm"
                        variant={plainSaved ? 'default' : 'outline'}
                        className="sm:flex-1"
                        disabled={!deckId || plainSaving || plainSaved}
                        onClick={handlePlainAdd}
                    >
                        {plainSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : plainSaved ? (
                            <CheckCheck className="size-4" />
                        ) : (
                            <Layers className="size-4" />
                        )}
                        {plainSaved
                            ? 'Hozzáadva!'
                            : hasAiAccess
                              ? 'Egyszerű kártya'
                              : 'Hozzáadás'}
                    </Button>
                    {hasAiAccess && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 sm:flex-1 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                            disabled={aiLoading}
                            onClick={handleGenerate}
                        >
                            {aiLoading ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Sparkles className="size-4" />
                            )}
                            {aiLoading
                                ? 'Generálás...'
                                : 'AI kártya generálása'}
                        </Button>
                    )}
                </div>
            )}

            {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}

function AiCardSide({ label, html }: { label: string; html: string }) {
    return (
        <div>
            <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {label}
            </p>
            <div
                className="max-h-56 space-y-1 overflow-y-auto rounded-md border bg-background px-3 py-2 text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
        </div>
    );
}
