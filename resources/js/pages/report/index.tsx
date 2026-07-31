import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, Flag, Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { index as reportIndex, store } from '@/routes/report';
import { search as searchWords } from '@/routes/words';

const CATEGORY_LABELS: Record<string, string> = {
    bug: 'Hiba a rendszerben',
    missing_feature: 'Hiányzó funkció',
    word_data: 'Hibás szóadat',
    other: 'Egyéb',
};

const DESCRIPTION_MAX = 2000;

const DESCRIPTION_MIN = 10;

/** Ennél hosszabb leírásnál már mutatjuk, hogy közel a limit. */
const DESCRIPTION_WARN_AT = 1900;

const DRAFT_STORAGE_KEY = 'report:draft';

type WordResult = {
    id: number;
    word: string;
    meaning_hu: string | null;
    is_custom: boolean;
};

type SearchState = 'idle' | 'searching' | 'done' | 'failed';

interface Draft {
    category: string;
    description: string;
    word: WordResult | null;
}

/**
 * A félig megírt bejelentés visszaolvasása. Egy lejárt session vagy egy véletlen
 * frissítés enélkül nyom nélkül elvinne egy hosszan megfogalmazott leírást.
 */
function readDraft(): Draft | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
        const draft = raw ? (JSON.parse(raw) as Draft) : null;

        if (!draft || typeof draft.description !== 'string') {
            return null;
        }

        return {
            ...draft,
            category:
                draft.category in CATEGORY_LABELS ? draft.category : 'bug',
        };
    } catch {
        return null;
    }
}

function clearDraft(): void {
    try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
        // Privát módban a localStorage dobhat — a piszkozat elvesztése nem hiba.
    }
}

export default function ReportIndex() {
    const [restoredDraft] = useState(readDraft);
    const form = useForm({
        category: restoredDraft?.category ?? 'bug',
        description: restoredDraft?.description ?? '',
        word_id: restoredDraft?.word?.id ?? null,
    });

    const [selectedWord, setSelectedWord] = useState<WordResult | null>(
        restoredDraft?.word ?? null,
    );
    const [wordQuery, setWordQuery] = useState('');
    const [wordResults, setWordResults] = useState<WordResult[]>([]);
    const [searchState, setSearchState] = useState<SearchState>('idle');
    const [submitted, setSubmitted] = useState(false);

    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const wordSearchRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isWordReport = form.data.category === 'word_data';
    const descriptionLength = form.data.description.length;

    useEffect(() => {
        if (!form.data.description.trim() && !selectedWord) {
            clearDraft();

            return;
        }

        try {
            window.localStorage.setItem(
                DRAFT_STORAGE_KEY,
                JSON.stringify({
                    category: form.data.category,
                    description: form.data.description,
                    word: selectedWord,
                } satisfies Draft),
            );
        } catch {
            // Ld. clearDraft(): a piszkozat kényelmi funkció, nem buktathat el semmit.
        }
    }, [form.data.category, form.data.description, selectedWord]);

    useEffect(
        () => () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        },
        [],
    );

    /**
     * A szótári szavak keresése. A `words/search` a felhasználó saját szavait is
     * visszaadja, azokat viszont ki kell szűrni: külön táblában élnek, az id-jük
     * egy másik szótári szóra mutatna — és a sajátjait a Szólistában maga javítja.
     */
    const handleWordSearch = useCallback((value: string) => {
        setWordQuery(value);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (value.trim().length < 2) {
            setWordResults([]);
            setSearchState('idle');

            return;
        }

        setSearchState('searching');
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    searchWords({ query: { q: value } }).url,
                    {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                );
                const data: WordResult[] = await res.json();

                setWordResults(data.filter((word) => !word.is_custom));
                setSearchState('done');
            } catch {
                setWordResults([]);
                setSearchState('failed');
            }
        }, 250);
    }, []);

    function handleCategoryChange(value: string) {
        form.setData('category', value);
        form.clearErrors('word_id');

        if (value !== 'word_data') {
            form.setData('word_id', null);
        }
    }

    function pickWord(word: WordResult) {
        setSelectedWord(word);
        setWordQuery('');
        setWordResults([]);
        setSearchState('idle');
        form.setData('word_id', word.id);
        form.clearErrors('word_id');
    }

    function clearWord() {
        setSelectedWord(null);
        form.setData('word_id', null);
        wordSearchRef.current?.focus();
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        form.clearErrors();

        if (form.data.description.trim().length < DESCRIPTION_MIN) {
            form.setError(
                'description',
                `Írj legalább pár szót, hogy utána tudjunk járni (legalább ${DESCRIPTION_MIN} karakter).`,
            );
            descriptionRef.current?.focus();

            return;
        }

        if (isWordReport && !form.data.word_id) {
            form.setError('word_id', 'Válaszd ki, melyik szóról van szó.');
            wordSearchRef.current?.focus();

            return;
        }

        form.submit(store(), {
            preserveScroll: true,
            onSuccess: () => {
                clearDraft();
                // Nem `reset()`: annak a kezdőértéke a visszaolvasott piszkozat
                // lenne, így egy szó-bejelentés után a `word_id` beragadna.
                form.setData({
                    category: 'bug',
                    description: '',
                    word_id: null,
                });
                setSelectedWord(null);
                setSubmitted(true);
            },
            onError: (errors) => {
                if (errors.word_id) {
                    wordSearchRef.current?.focus();

                    return;
                }

                if (errors.description) {
                    descriptionRef.current?.focus();
                }
            },
        });
    }

    function startNewReport() {
        setSubmitted(false);
        form.clearErrors();
    }

    return (
        <>
            <Head title="Hibabejelentés" />

            <div className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                        <Flag className="size-6 text-primary" />
                        Hibabejelentés
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Találtál hibát, hiányzik egy funkció, vagy hibás egy szó
                        adata? Írd le, és utánajárunk. Minden bejelentést
                        elolvasunk; ha kérdésünk van, a regisztrált
                        e-mail-címeden keresünk.
                    </p>
                </div>

                {submitted ? (
                    <div
                        role="status"
                        className="flex flex-col items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/40"
                    >
                        <p className="flex items-center gap-2 font-medium text-green-800 dark:text-green-200">
                            <CheckCircle2 className="size-5 shrink-0" />
                            Köszönjük, megkaptuk a bejelentésedet!
                        </p>
                        <p className="text-sm text-green-800/80 dark:text-green-200/80">
                            Átnézzük, és ha kérdésünk van, e-mailben
                            jelentkezünk. Visszajelzést nem minden bejelentésre
                            tudunk küldeni, de mindet elolvassuk.
                        </p>
                        <Button variant="outline" onClick={startNewReport}>
                            Új bejelentés írása
                        </Button>
                    </div>
                ) : (
                    <form
                        onSubmit={submit}
                        noValidate
                        className="flex flex-col gap-5 rounded-2xl border bg-card p-6"
                    >
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="category">Kategória</Label>
                            <Select
                                value={form.data.category}
                                onValueChange={handleCategoryChange}
                            >
                                <SelectTrigger id="category" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CATEGORY_LABELS).map(
                                        ([value, label]) => (
                                            <SelectItem
                                                key={value}
                                                value={value}
                                            >
                                                {label}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            {form.errors.category && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {form.errors.category}
                                </p>
                            )}
                        </div>

                        {isWordReport && (
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="word-search">
                                    Melyik szóról van szó?
                                </Label>

                                {selectedWord ? (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                                        <span className="min-w-0 truncate text-sm">
                                            <span className="font-medium">
                                                {selectedWord.word}
                                            </span>
                                            {selectedWord.meaning_hu && (
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    — {selectedWord.meaning_hu}
                                                </span>
                                            )}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clearWord}
                                            aria-label="Kiválasztott szó törlése"
                                            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                id="word-search"
                                                ref={wordSearchRef}
                                                value={wordQuery}
                                                onChange={(e) =>
                                                    handleWordSearch(
                                                        e.target.value,
                                                    )
                                                }
                                                autoComplete="off"
                                                aria-invalid={
                                                    !!form.errors.word_id
                                                }
                                                aria-describedby="word-search-hint"
                                                placeholder="Kezdd el gépelni az angol szót..."
                                                className="pl-9"
                                            />
                                            {searchState === 'searching' && (
                                                <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                            )}
                                        </div>

                                        {wordResults.length > 0 && (
                                            <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border">
                                                {wordResults.map((word) => (
                                                    <li key={word.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                pickWord(word)
                                                            }
                                                            className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                                                        >
                                                            <span className="font-medium">
                                                                {word.word}
                                                            </span>
                                                            {word.meaning_hu && (
                                                                <span className="truncate text-muted-foreground">
                                                                    {
                                                                        word.meaning_hu
                                                                    }
                                                                </span>
                                                            )}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        <p
                                            id="word-search-hint"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {searchState === 'failed'
                                                ? 'A keresés most nem érhető el. Válaszd az „Egyéb" kategóriát, és írd le a szót a leírásban.'
                                                : searchState === 'done' &&
                                                    wordResults.length === 0
                                                  ? 'Nincs találat a szótárban. A saját szavaidat a Szólistában közvetlenül javíthatod; egyébként válaszd az „Egyéb" kategóriát.'
                                                  : 'Írj be legalább két betűt, majd válassz a találatok közül.'}
                                        </p>
                                    </>
                                )}

                                {form.errors.word_id && (
                                    <p
                                        role="alert"
                                        className="text-sm text-destructive"
                                    >
                                        {form.errors.word_id}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="description">Leírás</Label>
                                <span
                                    className={
                                        descriptionLength >= DESCRIPTION_WARN_AT
                                            ? 'text-xs text-amber-600 dark:text-amber-400'
                                            : 'text-xs text-muted-foreground'
                                    }
                                >
                                    {descriptionLength}/{DESCRIPTION_MAX}
                                </span>
                            </div>
                            <Textarea
                                id="description"
                                ref={descriptionRef}
                                value={form.data.description}
                                onChange={(e) =>
                                    form.setData('description', e.target.value)
                                }
                                maxLength={DESCRIPTION_MAX}
                                rows={6}
                                aria-invalid={!!form.errors.description}
                                aria-describedby="description-hint"
                                placeholder="Mit csináltál, mit vártál, és mi történt helyette? Melyik oldalon?"
                            />
                            <p
                                id="description-hint"
                                className={
                                    descriptionLength >= DESCRIPTION_MAX
                                        ? 'text-xs text-amber-600 dark:text-amber-400'
                                        : 'text-xs text-muted-foreground'
                                }
                            >
                                {descriptionLength >= DESCRIPTION_MAX
                                    ? 'Elérted a maximális hosszt, a mező itt megáll.'
                                    : 'Minél konkrétabb, annál gyorsabban javítjuk.'}
                            </p>
                            {form.errors.description && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {form.errors.description}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            disabled={form.processing}
                            className="self-start"
                        >
                            {form.processing
                                ? 'Küldés...'
                                : 'Bejelentés küldése'}
                        </Button>
                    </form>
                )}
            </div>
        </>
    );
}

ReportIndex.layout = {
    breadcrumbs: [{ title: 'Hibabejelentés', href: reportIndex() }],
};
