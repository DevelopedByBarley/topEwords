import { Form, usePage } from '@inertiajs/react';
import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import type { Deck, Flashcard } from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { RichTextEditorHandle } from '@/components/ui/rich-text-editor';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { withMinDuration } from '@/lib/min-duration';
import {
    store as storeCard,
    update as updateCard,
} from '@/routes/flashcards/cards';

type DictDefinition = { definition: string; example?: string };
type DictMeaning = { partOfSpeech: string; definitions: DictDefinition[] };
type DictEntry = { word: string; phonetic?: string; meanings: DictMeaning[] };

export default function CardForm({
    deck,
    card,
    onCancel,
}: {
    deck: Deck;
    card?: Flashcard;
    onCancel: () => void;
}) {
    const isEdit = !!card;
    const action = isEdit
        ? updateCard({ deck: deck.id, flashcard: card.id })
        : storeCard(deck.id);

    const frontEditorRef = useRef<RichTextEditorHandle>(null);
    const backEditorRef = useRef<RichTextEditorHandle>(null);
    const [frontText, setFrontText] = useState(() =>
        card?.front ? card.front.replace(/<[^>]*>/g, '').trim() : '',
    );
    const [dictEntry, setDictEntry] = useState<DictEntry | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [dictError, setDictError] = useState('');
    const [geminiLoading, setGeminiLoading] = useState(false);
    const [geminiError, setGeminiError] = useState('');

    const { auth } = usePage<{
        auth: {
            isAdmin: boolean;
            subscription: { hasAiAccess: boolean } | null;
        };
    }>().props as any;
    const isAdmin: boolean = auth?.isAdmin ?? false;
    const hasAiAccess: boolean =
        isAdmin || (auth?.subscription?.hasAiAccess ?? false);

    const generateGeminiFlashcard = async () => {
        const word = frontText.trim();

        if (!word) {
            return;
        }

        setGeminiLoading(true);
        setGeminiError('');

        try {
            const csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const res = await withMinDuration(
                fetch(
                    `/text-analysis/gemini-flashcard?word=${encodeURIComponent(word)}`,
                    {
                        headers: {
                            'X-CSRF-TOKEN': csrfToken,
                            Accept: 'application/json',
                        },
                    },
                ),
            );
            const data = await res.json();

            if (data.error) {
                setGeminiError(
                    'Nem sikerült generálni. Próbáld újra egy kis idő múlva.',
                );

                return;
            }

            // Az AI nem létező szónak ítélte (gibberish / elgépelés): jelezzük.
            if (data.is_real_word === false) {
                setGeminiError(
                    data.message ?? 'Ez nem tűnik valódi angol szónak.',
                );

                return;
            }

            if (data.front) {
                frontEditorRef.current?.setContent(data.front);
            }

            if (data.back) {
                backEditorRef.current?.setContent(data.back);
            }
        } catch {
            setGeminiError('Hálózati hiba. Próbáld újra.');
        } finally {
            setGeminiLoading(false);
        }
    };

    const lookupWord = async () => {
        const word = frontText.trim();

        if (!word) {
            return;
        }

        setDictLoading(true);
        setDictError('');
        setDictEntry(null);

        try {
            const res = await fetch(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
            );

            if (!res.ok) {
                throw new Error('not found');
            }

            const data: DictEntry[] = await res.json();
            setDictEntry(data[0]);
        } catch {
            setDictError('Nem találtam ezt a szót a szótárban.');
        } finally {
            setDictLoading(false);
        }
    };

    // A szótár-API (dictionaryapi.dev) válasza külső, nem megbízható adat, ami
    // közvetlenül HTML-be kerül a szerkesztőbe — escape-elni kell, nehogy egy
    // kompromittált vagy hibás API-válasz HTML-t injektáljon a kártyába.
    const escapeHtml = (value: string) =>
        value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const insertDefinition = (
        partOfSpeech: string,
        definition: string,
        example?: string,
    ) => {
        let html = `<p><em>${escapeHtml(partOfSpeech)}</em> — ${escapeHtml(definition)}</p>`;

        if (example) {
            html += `<p><em>"${escapeHtml(example)}"</em></p>`;
        }

        backEditorRef.current?.setContent(html);
        setDictEntry(null);
    };

    return (
        <Form
            action={action}
            method={isEdit ? 'patch' : 'post'}
            options={{ preserveScroll: true }}
            onSuccess={onCancel}
            className="flex flex-col gap-5 py-6"
        >
            {({ processing, errors }) => (
                <>
                    {/* Gemini AI banner */}
                    {hasAiAccess && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-400 text-white">
                                    <Sparkles className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                                        Gemini AI kitöltés
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={generateGeminiFlashcard}
                                disabled={!frontText.trim() || geminiLoading}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-violet-400 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {geminiLoading ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Generálás...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="size-4" />
                                        Generálás
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {geminiError && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {geminiError}
                        </div>
                    )}

                    {/* Front + Back editors */}
                    <div className="grid gap-4 sm:grid-cols-2 py-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">
                                    Előlap
                                </Label>
                                <button
                                    type="button"
                                    onClick={lookupWord}
                                    disabled={!frontText.trim() || dictLoading}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {dictLoading ? (
                                        <>
                                            <Loader2 className="size-3 animate-spin" />
                                            Keresés...
                                        </>
                                    ) : (
                                        <>📖 Szótár</>
                                    )}
                                </button>
                            </div>
                            <RichTextEditor
                                ref={frontEditorRef}
                                name="front"
                                defaultValue={card?.front ?? ''}
                                placeholder="Angol szó, kifejezés, kérdés..."
                                minHeight="18rem"
                                speakName="front_speak"
                                defaultSpeakValue={card?.front_speak ?? ''}
                                onTextChange={setFrontText}
                            />
                            {errors.front && (
                                <p className="text-xs text-destructive">
                                    {errors.front}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2 py-5">
                            <Label className="text-sm font-semibold">
                                Hátlap
                            </Label>
                            <RichTextEditor
                                ref={backEditorRef}
                                name="back"
                                defaultValue={card?.back ?? ''}
                                placeholder="Magyar jelentés, magyarázat, válasz..."
                                minHeight="18rem"
                                speakName="back_speak"
                                defaultSpeakValue={card?.back_speak ?? ''}
                            />
                            {errors.back && (
                                <p className="text-xs text-destructive">
                                    {errors.back}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Dictionary results */}
                    {dictError && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {dictError}
                        </div>
                    )}
                    {dictEntry && (
                        <div className="animate-in space-y-3 rounded-xl border bg-muted/40 p-4 duration-150 fade-in slide-in-from-top-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">
                                        {dictEntry.word}
                                    </span>
                                    {dictEntry.phonetic && (
                                        <span className="text-sm text-muted-foreground">
                                            {dictEntry.phonetic}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDictEntry(null)}
                                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                            <div className="max-h-52 space-y-3 overflow-y-auto">
                                {dictEntry.meanings.map((meaning, mi) => (
                                    <div key={mi}>
                                        <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                            {meaning.partOfSpeech}
                                        </p>
                                        <div className="space-y-1">
                                            {meaning.definitions
                                                .slice(0, 3)
                                                .map((def, di) => (
                                                    <button
                                                        key={di}
                                                        type="button"
                                                        onClick={() =>
                                                            insertDefinition(
                                                                meaning.partOfSpeech,
                                                                def.definition,
                                                                def.example,
                                                            )
                                                        }
                                                        className="w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-border hover:bg-accent"
                                                    >
                                                        <span>
                                                            {def.definition}
                                                        </span>
                                                        {def.example && (
                                                            <span className="mt-0.5 block text-xs text-muted-foreground italic">
                                                                "{def.example}"
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Kattints egy definícióra → beilleszti a
                                hátlapba.
                            </p>
                        </div>
                    )}

                    {/* Options row */}
                    <div className="flex flex-wrap gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                        <div className="grid min-w-40 gap-1.5">
                            <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                Tanulás iránya
                            </Label>
                            <Select
                                name="direction"
                                defaultValue={card?.direction ?? 'both'}
                            >
                                <SelectTrigger className="h-9 bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">
                                        Mindkét irány
                                    </SelectItem>
                                    <SelectItem value="front_to_back">
                                        Előlap → Hátlap
                                    </SelectItem>
                                    <SelectItem value="back_to_front">
                                        Hátlap → Előlap
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label
                                htmlFor={`color-${card?.id ?? 'new'}`}
                                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                            >
                                Kártya szín
                            </Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    id={`color-${card?.id ?? 'new'}`}
                                    name="color"
                                    defaultValue={card?.color ?? '#6366f1'}
                                    className="h-9 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                                />
                                <span className="text-xs text-muted-foreground">
                                    Bal szegély színe
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-1">
                        <Button
                            type="submit"
                            disabled={processing}
                            className="px-6"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    {isEdit ? 'Mentés...' : 'Hozzáadás...'}
                                </>
                            ) : isEdit ? (
                                'Változások mentése'
                            ) : (
                                'Kártya hozzáadása'
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                        >
                            Mégse
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}
