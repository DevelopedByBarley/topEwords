import {
    CheckCheck,
    Flag,
    Loader2,
    Plus,
    Sparkles,
    Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
    LookupResult,
    TokenStatus,
} from '@/components/text-analysis/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import ImportanceStars from '@/components/words/importance-stars';
import StatusButtons from '@/components/words/status-buttons';
import {
    EMPTY_WORD_FORM,
    POS_LABELS,
    speak,
} from '@/components/words/word-config';
import WordDetailSections from '@/components/words/word-detail-sections';
import WordFormFields from '@/components/words/word-form-fields';
import WordInsightPanel from '@/components/words/word-insight-panel';
import {
    fetchGeminiWord,
    lemmaNotice,
    mergeGeminiData,
} from '@/lib/gemini-word';
import { httpErrorMessage, postJson } from '@/lib/http';
import {
    importance as customWordImportance,
    status as customWordStatus,
    store as customWordsStore,
} from '@/routes/custom-words';
import { store as storeReport } from '@/routes/report';
import { wordLookup } from '@/routes/text-analysis';
import {
    importance as wordImportance,
    status as wordStatus,
} from '@/routes/words';
import type { WordFormData, WordStatus } from '@/types/words';

interface WordLookupDialogProps {
    word: string | null;
    context: string | null;
    hasAiAccess: boolean;
    onClose: () => void;
    /** Optimista frissítéshez: a szülő igazítja az eredmény-statisztikákat. */
    onStatusChange: (
        word: string,
        prevStatus: string | null,
        nextStatus: TokenStatus | null,
        fallback: TokenStatus,
    ) => void;
    onCustomAdded: (word: string) => void;
}

/**
 * Egy szóra kattintva megnyíló részletező.
 *
 * A megtalált szó ugyanazt a nézetet kapja, mint a szólista modálja: a
 * részletek a közös `WordDetailSections`-ből, a státusz a közös
 * `StatusButtons`-ból, a fontosság a közös `ImportanceStars`-ból jönnek. A
 * hiányzó szó felvitele a szólista közös űrlapját (`WordFormFields`) és a közös
 * AI-kitöltést (`@/lib/gemini-word`) használja — így a felhasználó ugyanazt az
 * adatkört látja és ugyanazt tudja megadni, akárhonnan nyitja meg a szót.
 */
export default function WordLookupDialog({
    word,
    context,
    hasAiAccess,
    onClose,
    onStatusChange,
    onCustomAdded,
}: WordLookupDialogProps) {
    const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupStatus, setLookupStatus] = useState<WordStatus>(null);
    const [lookupImportance, setLookupImportance] = useState<number | null>(
        null,
    );
    const [lookupError, setLookupError] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [contextExplanation, setContextExplanation] = useState<string | null>(
        null,
    );
    const [customWordForm, setCustomWordForm] =
        useState<WordFormData>(EMPTY_WORD_FORM);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [addingCustom, setAddingCustom] = useState(false);
    const [addedCustom, setAddedCustom] = useState(false);
    const [geminiLoading, setGeminiLoading] = useState(false);
    const [geminiNotice, setGeminiNotice] = useState<string | null>(null);
    const [reportOpen, setReportOpen] = useState(false);

    // A státusz/fontosság-POST rollbackje csak akkor nyúlhat a dialógus lokális
    // state-jéhez, ha közben nem váltott másik szóra a felhasználó.
    const activeWordRef = useRef(word);

    useEffect(() => {
        activeWordRef.current = word;
    }, [word]);

    useEffect(() => {
        if (!word) {
            return;
        }

        // A megszakító egyben a still-mounted jelzés is: a cleanup abortálja a
        // folyamatban lévő kérést (gyors szóváltogatásnál így nem terheljük feleslegesen
        // a szervert), és az abort utáni válaszokra/hibákra már nem frissítünk state-et.
        const controller = new AbortController();

        setLookupResult(null);
        setLookupLoading(true);
        setLookupStatus(null);
        setLookupImportance(null);
        setLookupError(false);
        setSaveError(null);
        setContextExplanation(null);
        setGeminiNotice(null);
        setCustomWordForm(EMPTY_WORD_FORM);
        setFormErrors({});
        setAddedCustom(false);
        setReportOpen(false);

        fetch(wordLookup.url({ query: { word } }), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal: controller.signal,
        })
            .then(async (res) => {
                const data = (await res
                    .json()
                    .catch(() => null)) as LookupResult | null;

                if (controller.signal.aborted) {
                    return;
                }

                // Hiba-JSON-t (401/419/5xx) nem renderelünk találatként:
                // az érvényes lookup-válasznak mindig van `type` mezője.
                if (!res.ok || !data?.type) {
                    setLookupError(true);

                    return;
                }

                setLookupResult(data);

                if (data.type === 'not_found') {
                    setCustomWordForm({ ...EMPTY_WORD_FORM, word: data.word });

                    return;
                }

                setLookupStatus(data.status ?? null);
                setLookupImportance(data.importance ?? null);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setLookupError(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLookupLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [word]);

    /** A megtalált szó státusz/fontosság-végpontjai (fő szó vs. saját szó). */
    const savePaths =
        lookupResult && lookupResult.type !== 'not_found'
            ? lookupResult.type === 'word'
                ? {
                      status: wordStatus.url(lookupResult.id),
                      importance: wordImportance.url(lookupResult.id),
                      /** Amit a szó a státusz levétele után kap a szövegben. */
                      fallback: 'in_list' as TokenStatus,
                  }
                : {
                      status: customWordStatus.url(lookupResult.id),
                      importance: customWordImportance.url(lookupResult.id),
                      fallback: 'not_in_list' as TokenStatus,
                  }
            : null;

    const handleStatusClick = async (newStatus: Exclude<WordStatus, null>) => {
        if (!word || !savePaths) {
            return;
        }

        const nextStatus =
            lookupStatus === newStatus ? null : (newStatus as TokenStatus);
        const prevStatus = lookupStatus;

        setSaveError(null);
        setLookupStatus(nextStatus as WordStatus);
        onStatusChange(word, prevStatus, nextStatus, savePaths.fallback);

        // Sikertelen mentésnél visszagörgetjük az optimista frissítést: a szülő
        // statisztikáit fordított irányú deltával, a dialógus gombjait pedig csak
        // akkor, ha még mindig ez a szó van megnyitva.
        const rollback = (status?: number) => {
            onStatusChange(
                word,
                nextStatus,
                prevStatus as TokenStatus | null,
                savePaths.fallback,
            );

            if (activeWordRef.current === word) {
                setLookupStatus(prevStatus);
                setSaveError(httpErrorMessage(status));
            }
        };

        try {
            const { ok, status } = await postJson(savePaths.status, {
                status: newStatus,
            });

            if (!ok) {
                rollback(status);
            }
        } catch {
            rollback();
        }
    };

    const handleImportanceChange = async (value: number | null) => {
        if (!word || !savePaths || !lookupResult) {
            return;
        }

        const prevImportance = lookupImportance;
        const prevStatus = lookupStatus;

        // A fő szólista végpontja (WordController::importance) a még nem jelölt
        // szót „known"-ként veszi fel, ha csillagot kap — a dialógus és a szöveg
        // kiemelése különben ezt a szerver-oldali státuszt nem tükrözné.
        const alsoMarksKnown =
            lookupResult.type === 'word' &&
            prevStatus === null &&
            value !== null;

        setSaveError(null);
        setLookupImportance(value);

        if (alsoMarksKnown) {
            setLookupStatus('known');
            onStatusChange(word, prevStatus, 'known', savePaths.fallback);
        }

        const rollback = (status?: number) => {
            if (alsoMarksKnown) {
                onStatusChange(word, 'known', null, savePaths.fallback);
            }

            if (activeWordRef.current === word) {
                setLookupImportance(prevImportance);
                setLookupStatus(prevStatus);
                setSaveError(httpErrorMessage(status));
            }
        };

        try {
            const { ok, status } = await postJson(savePaths.importance, {
                importance: value,
            });

            if (!ok) {
                rollback(status);
            }
        } catch {
            rollback();
        }
    };

    const handleAddAsCustom = async () => {
        if (!word || !lookupResult || lookupResult.type !== 'not_found') {
            return;
        }

        const form = customWordForm;

        if (!form.word.trim()) {
            setFormErrors({ word: 'A szó megadása kötelező.' });

            return;
        }

        if (!form.meaning_hu.trim()) {
            setFormErrors({
                meaning_hu: 'A magyar jelentés megadása kötelező.',
            });

            return;
        }

        setAddingCustom(true);
        setFormErrors({});

        // Ugyanaz a mezőkör, mint a szólista „Saját szó hozzáadása" űrlapjánál:
        // minden alak-mezőt elküldünk a szófajtól függetlenül, mert egy szó több
        // szófaj alakjait is hordozhatja, és a párosítás/kiemelés mind a 9
        // alak-oszlopot olvassa.
        const payload = {
            word: form.word.trim(),
            meaning_hu: form.meaning_hu.trim(),
            extra_meanings: form.extra_meanings.trim() || null,
            synonyms: form.synonyms.trim() || null,
            part_of_speech: form.part_of_speech || null,
            example_en: form.example_en.trim() || null,
            example_hu: form.example_hu.trim() || null,
            status: form.status ?? null,
            importance: form.importance,
            form_base: form.form_base.trim() || null,
            verb_past: form.verb_past.trim() || null,
            verb_past_participle: form.verb_past_participle.trim() || null,
            verb_present_participle:
                form.verb_present_participle.trim() || null,
            verb_third_person: form.verb_third_person.trim() || null,
            is_irregular: form.is_irregular,
            noun_plural: form.noun_plural.trim() || null,
            adj_comparative: form.adj_comparative.trim() || null,
            adj_superlative: form.adj_superlative.trim() || null,
            extra_forms: form.extra_forms.trim() || null,
        };

        try {
            const { ok, status, data } = await postJson(
                customWordsStore.url(),
                payload,
            );

            if (ok) {
                setAddedCustom(true);
                onCustomAdded(word);

                return;
            }

            // 422-nél a Laravel `message` az első validációs hiba (magyarul);
            // más státuszoknál (419/429/5xx) a közös magyar üzenetet mutatjuk.
            setFormErrors({
                word:
                    status === 422 && typeof data.message === 'string'
                        ? data.message
                        : httpErrorMessage(
                              status,
                              'A hozzáadás nem sikerült — próbáld újra.',
                          ),
            });
        } catch {
            setFormErrors({ word: httpErrorMessage() });
        } finally {
            setAddingCustom(false);
        }
    };

    const handleGeminiAutofill = async () => {
        if (!lookupResult || lookupResult.type !== 'not_found') {
            return;
        }

        setGeminiLoading(true);
        setGeminiNotice(null);
        setFormErrors({});

        try {
            // A kontextust (a mondatot, amiben a szó áll) is átadjuk: ettől jön a
            // `context_explanation`. A szólistán nincs mondat, ott nem megy.
            const result = await fetchGeminiWord(customWordForm.word, context);

            if (!result.ok) {
                setFormErrors({ word: result.error });

                return;
            }

            const { data, lemma } = result;

            setCustomWordForm((prev) =>
                mergeGeminiData(prev, data, lemma ?? undefined),
            );

            if (lemma) {
                setGeminiNotice(lemmaNotice(customWordForm.word, lemma, true));
            }

            if (data.context_explanation) {
                setContextExplanation(data.context_explanation);
            }
        } finally {
            setGeminiLoading(false);
        }
    };

    const notFound = lookupResult?.type === 'not_found';

    return (
        <Dialog
            open={word !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                {lookupLoading && (
                    <>
                        <DialogTitle className="sr-only">
                            Szó keresése
                        </DialogTitle>
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    </>
                )}
                {!lookupLoading && lookupError && (
                    <>
                        <DialogTitle className="sr-only">
                            A keresés nem sikerült
                        </DialogTitle>
                        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                            A keresés nem sikerült. Zárd be, és próbáld újra.
                        </p>
                    </>
                )}
                {!lookupLoading && lookupResult && (
                    <>
                        {/* Hero */}
                        <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-5 pt-5 pr-14 pb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    {lookupResult.type !== 'not_found' && (
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            {lookupResult.type === 'word' && (
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    #{lookupResult.rank}
                                                </span>
                                            )}
                                            {lookupResult.type === 'custom' && (
                                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                                                    saját szó
                                                </span>
                                            )}
                                            {lookupResult.part_of_speech && (
                                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                    {POS_LABELS[
                                                        lookupResult
                                                            .part_of_speech
                                                    ] ??
                                                        lookupResult.part_of_speech}
                                                </span>
                                            )}
                                            {lookupResult.is_irregular && (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    rendhagyó
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <DialogTitle asChild>
                                        <h2 className="text-2xl font-bold tracking-tight">
                                            {notFound
                                                ? customWordForm.word ||
                                                  lookupResult.word
                                                : lookupResult.word}
                                        </h2>
                                    </DialogTitle>
                                    <DialogDescription className="sr-only">
                                        {notFound
                                            ? 'Ez a szó még nincs a listáidban — itt veheted fel saját szóként.'
                                            : 'A szó jelentése, alakjai és beállításai.'}
                                    </DialogDescription>
                                </div>
                                {!notFound && (
                                    <button
                                        onClick={() => speak(lookupResult.word)}
                                        title="Felolvasás"
                                        className="mt-1 shrink-0 rounded-full bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
                                    >
                                        <Volume2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Megtalált szó (fő lista vagy saját szó) */}
                        {lookupResult.type !== 'not_found' && (
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                                <WordDetailSections data={lookupResult} />

                                <StatusButtons
                                    variant="modal"
                                    current={lookupStatus}
                                    onSelect={handleStatusClick}
                                />

                                <ImportanceStars
                                    value={lookupImportance}
                                    onChange={handleImportanceChange}
                                />

                                {saveError && (
                                    <p className="text-sm text-red-600 dark:text-red-400">
                                        {saveError}
                                    </p>
                                )}

                                {/* AI szó-infó (AI-hozzáférésű felhasználóknak) */}
                                {hasAiAccess && (
                                    <div className="flex flex-col gap-3 border-t pt-4">
                                        <WordInsightPanel
                                            key={lookupResult.word}
                                            word={lookupResult.word}
                                        />
                                    </div>
                                )}

                                {/* Hibás adat jelentése — csak a fő szólista
                                    szavaira, a bejelentés oda hivatkozik. */}
                                {lookupResult.type === 'word' && (
                                    <div className="flex flex-col gap-3 border-t pt-4">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full text-muted-foreground"
                                            onClick={() => setReportOpen(true)}
                                        >
                                            <Flag className="size-3.5" />
                                            Hibás adat jelentése
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Nincs találat — felvétel saját szóként */}
                        {notFound &&
                            (addedCustom ? (
                                <div className="flex items-center gap-2 px-5 py-6 text-sm font-medium text-green-700 dark:text-green-400">
                                    <CheckCheck className="size-4" /> Sikeresen
                                    hozzáadva saját szóként!
                                </div>
                            ) : (
                                <>
                                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                                        <WordFormFields
                                            form={customWordForm}
                                            onChange={setCustomWordForm}
                                            errors={formErrors}
                                            afterWordSlot={
                                                <>
                                                    <div className="flex gap-2">
                                                        {hasAiAccess && (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={
                                                                    handleGeminiAutofill
                                                                }
                                                                disabled={
                                                                    geminiLoading ||
                                                                    !customWordForm.word.trim()
                                                                }
                                                                className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                                            >
                                                                {geminiLoading ? (
                                                                    <Loader2 className="size-4 animate-spin" />
                                                                ) : (
                                                                    <Sparkles className="size-4" />
                                                                )}
                                                                Kitöltés Gemini
                                                                AI-val
                                                            </Button>
                                                        )}
                                                        <a
                                                            href={`https://www.google.com/search?q=${encodeURIComponent(customWordForm.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                                                        >
                                                            <GoogleIcon />
                                                            Google AI
                                                        </a>
                                                    </div>
                                                    {geminiNotice && (
                                                        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                                                            {geminiNotice}
                                                        </p>
                                                    )}
                                                </>
                                            }
                                        />

                                        <div className="space-y-3 border-t pt-3">
                                            <div>
                                                <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Státusz
                                                </p>
                                                <StatusButtons
                                                    variant="modal"
                                                    current={
                                                        customWordForm.status
                                                    }
                                                    onSelect={(s) =>
                                                        setCustomWordForm(
                                                            (prev) => ({
                                                                ...prev,
                                                                status:
                                                                    prev.status ===
                                                                    s
                                                                        ? null
                                                                        : s,
                                                            }),
                                                        )
                                                    }
                                                />
                                            </div>
                                            <ImportanceStars
                                                value={
                                                    customWordForm.importance
                                                }
                                                onChange={(v) =>
                                                    setCustomWordForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            importance: v,
                                                        }),
                                                    )
                                                }
                                            />
                                        </div>

                                        {/* Kontextus + AI magyarázat */}
                                        {(context || contextExplanation) && (
                                            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                                                {context && (
                                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                                        <span className="font-semibold">
                                                            Kontextus:{' '}
                                                        </span>
                                                        {highlightWord(
                                                            context,
                                                            lookupResult.word,
                                                        )}
                                                    </p>
                                                )}
                                                {contextExplanation && (
                                                    <p className="text-xs text-blue-800 dark:text-blue-200">
                                                        <span className="font-semibold">
                                                            Jelentés ebben a
                                                            mondatban:{' '}
                                                        </span>
                                                        {contextExplanation}
                                                    </p>
                                                )}
                                                {!contextExplanation &&
                                                    context &&
                                                    hasAiAccess && (
                                                        <p className="text-xs text-blue-500 italic dark:text-blue-400">
                                                            Nyomj Gemini AI-ra a
                                                            kontextuális
                                                            magyarázathoz.
                                                        </p>
                                                    )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="space-y-2 border-t px-5 py-4">
                                        <Button
                                            className="w-full"
                                            onClick={handleAddAsCustom}
                                            disabled={
                                                addingCustom ||
                                                !customWordForm.word.trim()
                                            }
                                        >
                                            {addingCustom ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Plus className="size-4" />
                                            )}
                                            Hozzáadás saját szóként
                                        </Button>
                                    </div>
                                </>
                            ))}
                    </>
                )}

                {/* Hibás szóadat jelentése — a szólista modáljával egyező űrlap.
                    A részletezőn BELÜL nyílik, hogy bezárás után a felhasználó
                    ugyanannál a szónál maradjon. */}
                {lookupResult?.type === 'word' && (
                    <ReportWordDialog
                        open={reportOpen}
                        wordId={lookupResult.id}
                        onOpenChange={setReportOpen}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** A keresett szót 「idézőjelbe」 emeli a kontextus-mondatban. */
function highlightWord(sentence: string, word: string): string {
    return sentence.replace(
        new RegExp(
            `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'gi',
        ),
        (m) => `「${m}」`,
    );
}

function GoogleIcon() {
    return (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24">
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}

/**
 * Hibás szóadat bejelentése a részletezőből.
 *
 * A szólista ugyanezt Inertia-visittel küldi; itt szándékosan JSON-kérés megy,
 * hogy a bejelentés ne rántsa újra a szövegelemző oldalt (a betöltött szöveg,
 * az elemzés és a könyv-lap mind lokális state).
 */
function ReportWordDialog({
    open,
    wordId,
    onOpenChange,
}: {
    open: boolean;
    wordId: number;
    onOpenChange: (open: boolean) => void;
}) {
    const [description, setDescription] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setError(null);

        try {
            const { ok, status, data } = await postJson(storeReport.url(), {
                category: 'word_data',
                word_id: wordId,
                description,
            });

            if (ok) {
                setDescription('');
                onOpenChange(false);

                return;
            }

            setError(
                status === 422 && typeof data.message === 'string'
                    ? data.message
                    : httpErrorMessage(
                          status,
                          'A bejelentés nem sikerült — próbáld újra.',
                      ),
            );
        } catch {
            setError(httpErrorMessage());
        } finally {
            setSending(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setError(null);
                }

                onOpenChange(next);
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Hibás adat jelentése</DialogTitle>
                    <DialogDescription>
                        Írd le, mi a gond a szó adataival — átnézzük és
                        javítjuk.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="flex flex-col gap-3">
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={2000}
                        rows={4}
                        placeholder="Mi hibás ennél a szónál?"
                        required
                    />
                    <div className="flex items-center justify-between gap-2">
                        {error ? (
                            <p className="text-sm text-destructive">{error}</p>
                        ) : (
                            <span />
                        )}
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {description.length} / 2000
                        </span>
                    </div>
                    <Button
                        type="submit"
                        disabled={sending || description.trim() === ''}
                        className="self-start"
                    >
                        {sending ? 'Küldés...' : 'Küldés'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
