import {
    BookMarked,
    CheckCheck,
    Clock,
    Loader2,
    Mic,
    Plus,
    Sparkles,
    Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    EMPTY_CUSTOM_WORD_FORM,
    POS_LABELS,
} from '@/components/text-analysis/types';
import type {
    CustomWordForm,
    LookupResult,
    TokenStatus,
} from '@/components/text-analysis/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { httpErrorMessage, postJson } from '@/lib/http';
import { withMinDuration } from '@/lib/min-duration';
import {
    status as customWordStatus,
    store as customWordsStore,
} from '@/routes/custom-words';
import { geminiLookup, wordLookup } from '@/routes/text-analysis';
import { status as wordStatus } from '@/routes/words';

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

const STATUS_BUTTONS = [
    {
        s: 'known',
        label: 'Tudom',
        Icon: CheckCheck,
        active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
        hover: 'hover:bg-green-50 hover:text-green-700',
    },
    {
        s: 'learning',
        label: 'Tanulom',
        Icon: Clock,
        active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        hover: 'hover:bg-blue-50 hover:text-blue-700',
    },
    {
        s: 'saved',
        label: 'Később',
        Icon: BookMarked,
        active: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
        hover: 'hover:bg-orange-50 hover:text-orange-700',
    },
    {
        s: 'pronunciation',
        label: 'Kiejtés',
        Icon: Mic,
        active: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
        hover: 'hover:bg-violet-50 hover:text-violet-700',
    },
] as const;

/**
 * Hibaüzenet a Gemini-kitöltéshez. Az AI-kvóta 429-e saját magyar üzenettel
 * érkezik (`error: 'ai_limit'` + `message`); a route-throttle 429 viszont csak
 * angol `message`-et ad, arra a közös magyar szöveget mutatjuk. A 422/502
 * `error` mezője már felhasználóbarát magyar szöveg a backendről.
 */
function geminiErrorMessage(
    status: number,
    data: Record<string, unknown>,
): string {
    if (data.error === 'ai_limit' && typeof data.message === 'string') {
        return data.message;
    }

    if (status === 429) {
        return httpErrorMessage(429);
    }

    if (typeof data.error === 'string' && data.error !== '') {
        return data.error;
    }

    return httpErrorMessage(
        status,
        'A Gemini-kitöltés nem sikerült — próbáld újra.',
    );
}

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
    const [lookupStatus, setLookupStatus] = useState<string | null>(null);
    const [lookupError, setLookupError] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [contextExplanation, setContextExplanation] = useState<string | null>(
        null,
    );
    const [customWordForm, setCustomWordForm] = useState<CustomWordForm>(
        EMPTY_CUSTOM_WORD_FORM,
    );
    const [addingCustom, setAddingCustom] = useState(false);
    const [addedCustom, setAddedCustom] = useState(false);
    const [customAddError, setCustomAddError] = useState<string | null>(null);
    const [geminiLoading, setGeminiLoading] = useState(false);
    const [geminiNotice, setGeminiNotice] = useState<string | null>(null);
    // Ha az AI a beírt ragozott alakot alapszóra lemmatizálta (helped → help),
    // ez az alapszó lesz elmentve a beírt szó helyett.
    const [baseFormOverride, setBaseFormOverride] = useState<string | null>(
        null,
    );

    // A státusz-POST rollbackje csak akkor nyúlhat a dialógus lokális state-jéhez,
    // ha közben nem váltott másik szóra a felhasználó.
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
        setLookupError(false);
        setStatusError(null);
        setContextExplanation(null);
        setGeminiNotice(null);
        setBaseFormOverride(null);
        setCustomWordForm(EMPTY_CUSTOM_WORD_FORM);
        setAddedCustom(false);
        setCustomAddError(null);

        fetch(wordLookup.url({ query: { word } }), {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            signal: controller.signal,
        })
            .then(async (res) => {
                const data = (await res.json().catch(() => null)) as
                    | (LookupResult & { status?: string | null })
                    | null;

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
                setLookupStatus(data.status ?? null);
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

    const handleStatusClick = async (newStatus: string) => {
        if (!word || !lookupResult || lookupResult.type === 'not_found') {
            return;
        }

        const path =
            lookupResult.type === 'word'
                ? wordStatus.url(lookupResult.id)
                : customWordStatus.url(lookupResult.id);
        const nextStatus =
            lookupStatus === newStatus ? null : (newStatus as TokenStatus);
        const prevStatus = lookupStatus;
        const fallback: TokenStatus =
            lookupResult.type === 'word' ? 'in_list' : 'not_in_list';

        setStatusError(null);
        setLookupStatus(nextStatus);
        onStatusChange(word, prevStatus, nextStatus, fallback);

        // Sikertelen mentésnél visszagörgetjük az optimista frissítést: a szülő
        // statisztikáit fordított irányú deltával, a dialógus gombjait pedig csak
        // akkor, ha még mindig ez a szó van megnyitva.
        const rollback = (status?: number) => {
            onStatusChange(
                word,
                nextStatus,
                prevStatus as TokenStatus | null,
                fallback,
            );

            if (activeWordRef.current === word) {
                setLookupStatus(prevStatus);
                setStatusError(httpErrorMessage(status));
            }
        };

        try {
            const { ok, status } = await postJson(path, { status: newStatus });

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

        setAddingCustom(true);
        setCustomAddError(null);

        try {
            const body: Record<string, unknown> = {
                word: baseFormOverride ?? lookupResult.word,
            };
            (Object.keys(customWordForm) as (keyof CustomWordForm)[]).forEach(
                (k) => {
                    const v = customWordForm[k];

                    if (v !== '' && v !== false) {
                        body[k] = v;
                    }
                },
            );
            const { ok, status, data } = await postJson(
                customWordsStore.url(),
                body,
            );

            if (ok) {
                setAddedCustom(true);
                onCustomAdded(word);

                return;
            }

            // 422-nél a Laravel `message` az első validációs hiba (magyarul);
            // más státuszoknál (419/429/5xx) a közös magyar üzenetet mutatjuk.
            setCustomAddError(
                status === 422 && typeof data.message === 'string'
                    ? data.message
                    : httpErrorMessage(
                          status,
                          'A hozzáadás nem sikerült — próbáld újra.',
                      ),
            );
        } catch {
            setCustomAddError(httpErrorMessage());
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

        try {
            const query: Record<string, string> = { word: lookupResult.word };

            if (context) {
                query.context = context;
            }

            const res = await withMinDuration(
                fetch(geminiLookup.url({ query }), {
                    headers: { Accept: 'application/json' },
                }),
            );
            const data = await res.json().catch(() => ({}));

            if (!res.ok || data.error) {
                setGeminiNotice(geminiErrorMessage(res.status, data));

                return;
            }

            // Az AI nem létező szónak ítélte (gibberish / elgépelés): nem töltünk ki kamu adatot.
            if (data.is_real_word === false) {
                setGeminiNotice(
                    data.message ?? 'Ez nem tűnik valódi angol szónak.',
                );

                return;
            }

            // A beírt szó ragozott alak volt (helped): az AI a „help" alapszóra
            // lemmatizált, és minden mezőt arra töltött ki — azt mentjük el, jelezzük.
            if (data.normalized_from_input && data.base_form) {
                setBaseFormOverride(data.base_form);
                setGeminiNotice(
                    `A(z) „${lookupResult.word}" a(z) „${data.base_form}" ragozott alakja — az alapszóból indultunk ki.`,
                );
            }

            setCustomWordForm((prev) => ({
                ...prev,
                meaning_hu: data.meaning_hu || prev.meaning_hu,
                extra_meanings: data.extra_meanings || prev.extra_meanings,
                synonyms: data.synonyms || prev.synonyms,
                part_of_speech: data.part_of_speech || prev.part_of_speech,
                example_en: data.example_en || prev.example_en,
                example_hu: data.example_hu || prev.example_hu,
                verb_past: data.verb_past || prev.verb_past,
                verb_past_participle:
                    data.verb_past_participle || prev.verb_past_participle,
                verb_present_participle:
                    data.verb_present_participle ||
                    prev.verb_present_participle,
                verb_third_person:
                    data.verb_third_person || prev.verb_third_person,
                is_irregular: data.is_irregular ?? prev.is_irregular,
                noun_plural: data.noun_plural || prev.noun_plural,
                adj_comparative: data.adj_comparative || prev.adj_comparative,
                adj_superlative: data.adj_superlative || prev.adj_superlative,
            }));

            if (data.context_explanation) {
                setContextExplanation(data.context_explanation);
            }
        } catch {
            setGeminiNotice('Hálózati hiba — próbáld újra.');
        } finally {
            setGeminiLoading(false);
        }
    };

    return (
        <Dialog
            open={word !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className={`w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 ${lookupResult?.type === 'not_found' ? 'sm:max-w-lg' : 'sm:max-w-md'}`}
            >
                {lookupLoading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                )}
                {!lookupLoading && lookupError && (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        A keresés nem sikerült. Zárd be, és próbáld újra.
                    </p>
                )}
                {!lookupLoading && lookupResult && (
                    <>
                        {/* Header */}
                        <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-5 pt-5 pb-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    {lookupResult.type !== 'not_found' && (
                                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                            {lookupResult.type === 'word' &&
                                                lookupResult.rank && (
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
                                        </div>
                                    )}
                                    <DialogTitle className="text-2xl font-bold tracking-tight">
                                        {baseFormOverride ?? lookupResult.word}
                                    </DialogTitle>
                                </div>
                                {lookupResult.type !== 'not_found' && (
                                    <button
                                        onClick={() => {
                                            const u =
                                                new SpeechSynthesisUtterance(
                                                    lookupResult.word,
                                                );
                                            u.lang = 'en-US';
                                            speechSynthesis.speak(u);
                                        }}
                                        className="mt-1 shrink-0 rounded-full bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
                                    >
                                        <Volume2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 px-5 py-4">
                            {/* Word or custom word found */}
                            {lookupResult.type !== 'not_found' && (
                                <>
                                    {lookupResult.meaning_hu && (
                                        <div className="rounded-xl border bg-card px-4 py-3">
                                            <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Magyar jelentés
                                            </p>
                                            <p className="leading-snug font-semibold">
                                                {lookupResult.meaning_hu}
                                            </p>
                                        </div>
                                    )}
                                    {lookupResult.example_en && (
                                        <div className="rounded-xl border-l-4 border-primary/40 bg-muted/30 px-4 py-3">
                                            <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Példamondat
                                            </p>
                                            <p className="text-sm italic">
                                                "{lookupResult.example_en}"
                                            </p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        {STATUS_BUTTONS.map(
                                            ({
                                                s,
                                                label,
                                                Icon,
                                                active,
                                                hover,
                                            }) => (
                                                <button
                                                    key={s}
                                                    onClick={() =>
                                                        handleStatusClick(s)
                                                    }
                                                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                                        lookupStatus === s
                                                            ? active
                                                            : `bg-secondary text-muted-foreground ${hover}`
                                                    }`}
                                                >
                                                    <Icon className="size-4" />{' '}
                                                    {label}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                    {statusError && (
                                        <p className="text-sm text-red-600 dark:text-red-400">
                                            {statusError}
                                        </p>
                                    )}
                                </>
                            )}

                            {/* Not found — add as custom word */}
                            {lookupResult.type === 'not_found' && (
                                <div className="-mx-5 -mt-4">
                                    {addedCustom ? (
                                        <div className="flex items-center gap-2 px-5 py-6 text-sm font-medium text-green-700 dark:text-green-400">
                                            <CheckCheck className="size-4" />{' '}
                                            Sikeresen hozzáadva saját szóként!
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto px-5 py-4">
                                                {/* Action buttons */}
                                                <div className="flex gap-2">
                                                    {hasAiAccess && (
                                                        <Button
                                                            variant="outline"
                                                            onClick={
                                                                handleGeminiAutofill
                                                            }
                                                            disabled={
                                                                geminiLoading
                                                            }
                                                            className="flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                                        >
                                                            {geminiLoading ? (
                                                                <Loader2 className="size-4 animate-spin" />
                                                            ) : (
                                                                <Sparkles className="size-4" />
                                                            )}
                                                            Gemini AI
                                                        </Button>
                                                    )}
                                                    <a
                                                        href={`https://www.google.com/search?q=${encodeURIComponent(lookupResult.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex flex-1 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                                                    >
                                                        <svg
                                                            className="size-4 shrink-0"
                                                            viewBox="0 0 24 24"
                                                        >
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
                                                        Google AI
                                                    </a>
                                                </div>

                                                {geminiNotice && (
                                                    <p
                                                        className={
                                                            baseFormOverride
                                                                ? 'rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                                                                : 'rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                                        }
                                                    >
                                                        {geminiNotice}
                                                    </p>
                                                )}

                                                {/* Basic fields */}
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="Magyar jelentés"
                                                        value={
                                                            customWordForm.meaning_hu
                                                        }
                                                        onChange={(e) =>
                                                            setCustomWordForm({
                                                                ...customWordForm,
                                                                meaning_hu:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        className="flex-1"
                                                    />
                                                    <Select
                                                        value={
                                                            customWordForm.part_of_speech
                                                        }
                                                        onValueChange={(v) =>
                                                            setCustomWordForm({
                                                                ...customWordForm,
                                                                part_of_speech:
                                                                    v,
                                                            })
                                                        }
                                                    >
                                                        <SelectTrigger className="w-28 sm:w-36">
                                                            <SelectValue placeholder="Szófaj" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.entries(
                                                                POS_LABELS,
                                                            ).map(
                                                                ([
                                                                    val,
                                                                    label,
                                                                ]) => (
                                                                    <SelectItem
                                                                        key={
                                                                            val
                                                                        }
                                                                        value={
                                                                            val
                                                                        }
                                                                    >
                                                                        {label}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <Input
                                                    placeholder="További jelentések (pl. alternatív fordítások)"
                                                    value={
                                                        customWordForm.extra_meanings
                                                    }
                                                    onChange={(e) =>
                                                        setCustomWordForm({
                                                            ...customWordForm,
                                                            extra_meanings:
                                                                e.target.value,
                                                        })
                                                    }
                                                />
                                                <Input
                                                    placeholder="Szinonimák (pl. consent, accept)"
                                                    value={
                                                        customWordForm.synonyms
                                                    }
                                                    onChange={(e) =>
                                                        setCustomWordForm({
                                                            ...customWordForm,
                                                            synonyms:
                                                                e.target.value,
                                                        })
                                                    }
                                                />
                                                <Input
                                                    placeholder="Példamondat (angol)"
                                                    value={
                                                        customWordForm.example_en
                                                    }
                                                    onChange={(e) =>
                                                        setCustomWordForm({
                                                            ...customWordForm,
                                                            example_en:
                                                                e.target.value,
                                                        })
                                                    }
                                                />
                                                <Input
                                                    placeholder="Példamondat (magyar)"
                                                    value={
                                                        customWordForm.example_hu
                                                    }
                                                    onChange={(e) =>
                                                        setCustomWordForm({
                                                            ...customWordForm,
                                                            example_hu:
                                                                e.target.value,
                                                        })
                                                    }
                                                />

                                                {/* Verb fields */}
                                                {customWordForm.part_of_speech ===
                                                    'verb' && (
                                                    <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                                                        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                            Igealakok
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">
                                                                    Múlt idő
                                                                </label>
                                                                <Input
                                                                    placeholder="pl. agreed"
                                                                    value={
                                                                        customWordForm.verb_past
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setCustomWordForm(
                                                                            {
                                                                                ...customWordForm,
                                                                                verb_past:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">
                                                                    Befejezett
                                                                    igenév
                                                                </label>
                                                                <Input
                                                                    placeholder="pl. agreed"
                                                                    value={
                                                                        customWordForm.verb_past_participle
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setCustomWordForm(
                                                                            {
                                                                                ...customWordForm,
                                                                                verb_past_participle:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">
                                                                    Folyamatos
                                                                    (-ing)
                                                                </label>
                                                                <Input
                                                                    placeholder="pl. agreeing"
                                                                    value={
                                                                        customWordForm.verb_present_participle
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setCustomWordForm(
                                                                            {
                                                                                ...customWordForm,
                                                                                verb_present_participle:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">
                                                                    E/3 jelen
                                                                </label>
                                                                <Input
                                                                    placeholder="pl. agrees"
                                                                    value={
                                                                        customWordForm.verb_third_person
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setCustomWordForm(
                                                                            {
                                                                                ...customWordForm,
                                                                                verb_third_person:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                        </div>
                                                        <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={
                                                                    customWordForm.is_irregular
                                                                }
                                                                onChange={(e) =>
                                                                    setCustomWordForm(
                                                                        {
                                                                            ...customWordForm,
                                                                            is_irregular:
                                                                                e
                                                                                    .target
                                                                                    .checked,
                                                                        },
                                                                    )
                                                                }
                                                                className="rounded"
                                                            />
                                                            Rendhagyó ige
                                                        </label>
                                                    </div>
                                                )}

                                                {/* Noun fields */}
                                                {customWordForm.part_of_speech ===
                                                    'noun' && (
                                                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/30 px-4 py-3">
                                                        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                            Főnév alakok
                                                        </p>
                                                        <div>
                                                            <label className="text-xs text-muted-foreground">
                                                                Többes szám
                                                            </label>
                                                            <Input
                                                                placeholder="pl. agreements"
                                                                value={
                                                                    customWordForm.noun_plural
                                                                }
                                                                onChange={(e) =>
                                                                    setCustomWordForm(
                                                                        {
                                                                            ...customWordForm,
                                                                            noun_plural:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                        },
                                                                    )
                                                                }
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Adjective fields */}
                                                {customWordForm.part_of_speech ===
                                                    'adj' && (
                                                    <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                                                        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                            Fokozás
                                                        </p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">
                                                                    Középfok
                                                                </label>
                                                                <Input
                                                                    placeholder="pl. better"
                                                                    value={
                                                                        customWordForm.adj_comparative
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setCustomWordForm(
                                                                            {
                                                                                ...customWordForm,
                                                                                adj_comparative:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">
                                                                    Felsőfok
                                                                </label>
                                                                <Input
                                                                    placeholder="pl. best"
                                                                    value={
                                                                        customWordForm.adj_superlative
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) =>
                                                                        setCustomWordForm(
                                                                            {
                                                                                ...customWordForm,
                                                                                adj_superlative:
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="mt-1"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Context explanation */}
                                                {(context ||
                                                    contextExplanation) && (
                                                    <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                                                        {context && (
                                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                                <span className="font-semibold">
                                                                    Kontextus:{' '}
                                                                </span>
                                                                {context.replace(
                                                                    new RegExp(
                                                                        `\\b${lookupResult.word}\\b`,
                                                                        'gi',
                                                                    ),
                                                                    (m) =>
                                                                        `「${m}」`,
                                                                )}
                                                            </p>
                                                        )}
                                                        {contextExplanation && (
                                                            <p className="text-xs text-blue-800 dark:text-blue-200">
                                                                <span className="font-semibold">
                                                                    Jelentés
                                                                    ebben a
                                                                    mondatban:{' '}
                                                                </span>
                                                                {
                                                                    contextExplanation
                                                                }
                                                            </p>
                                                        )}
                                                        {!contextExplanation &&
                                                            context && (
                                                                <p className="text-xs text-blue-500 italic dark:text-blue-400">
                                                                    Nyomj Gemini
                                                                    AI-ra a
                                                                    kontextuális
                                                                    magyarázathoz.
                                                                </p>
                                                            )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="space-y-2 border-t px-5 py-4">
                                                {customAddError && (
                                                    <p className="text-sm text-red-600 dark:text-red-400">
                                                        {customAddError}
                                                    </p>
                                                )}
                                                <Button
                                                    className="w-full"
                                                    onClick={handleAddAsCustom}
                                                    disabled={addingCustom}
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
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
