import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Flag,
    FolderOpen,
    FolderPlus,
    Info,
    Layers,
    Loader2,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2,
    Volume2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ImportanceStars from '@/components/words/importance-stars';
import PracticeModal from '@/components/words/practice-modal';
import type { PracticeWord } from '@/components/words/practice-modal';
import StatusButtons from '@/components/words/status-buttons';
import {
    EMPTY_WORD_FORM,
    POS_LABELS,
    speak,
    wordToFormData,
} from '@/components/words/word-config';
import WordFilters from '@/components/words/word-filters';
import WordFormFields from '@/components/words/word-form-fields';
import WordInsightPanel from '@/components/words/word-insight-panel';
import WordProgressCard from '@/components/words/word-progress-card';
import WordRow from '@/components/words/word-row';
import type { UnifiedItem } from '@/components/words/word-row';
import { absorbAiBudget } from '@/lib/ai-budget';
import { httpErrorMessage } from '@/lib/http';
import { withMinDuration } from '@/lib/min-duration';
import {
    destroy as destroyCustomWord,
    importance as customWordImportance,
    status as customWordStatus,
    store as storeCustomWord,
    update as updateCustomWord,
} from '@/routes/custom-words';
import { index as flashcardsIndex } from '@/routes/flashcards';
import { importMethod as importFromWord } from '@/routes/flashcards/cards';
import { destroy, store, update } from '@/routes/folders';
import { update as folderWordUpdate } from '@/routes/folders/words';
import { store as storeReport } from '@/routes/report';
import {
    importance as wordImportance,
    index,
    status,
    update as updateWord,
} from '@/routes/words';
import type {
    Word,
    WordFilterPatch,
    WordFormData,
    WordsIndexPageProps,
    WordStatus,
} from '@/types/words';

/** A backend `WordIndexFilters::ALLOWED_PER_PAGE` értékei. */
const PER_PAGE_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 1000] as const;

const STORAGE_KEY = 'words_filters';

const HINT_STORAGE_KEY = 'words_hint_dismissed';

export default function WordsIndex({
    words,
    filters,
    stats,
    customWords,
    customStats,
    markedPages,
    completedPages,
    markedLetters,
    folders,
    wordFolderIds,
    flashcardDecks,
}: WordsIndexPageProps) {
    const [search, setSearch] = useState(filters.search);
    const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
    const [flipMode, setFlipMode] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [editFolderId, setEditFolderId] = useState<number | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [showFolderSheet, setShowFolderSheet] = useState(false);
    const [showAddCustomWord, setShowAddCustomWord] = useState(false);
    const [customWordForm, setCustomWordForm] =
        useState<WordFormData>(EMPTY_WORD_FORM);
    const [customWordErrors, setCustomWordErrors] = useState<
        Record<string, string>
    >({});
    const [geminiLoading, setGeminiLoading] = useState(false);
    // Ha az AI a beírt ragozott alakot alapszóra lemmatizálta (helped → help),
    // ez a tájékoztató üzenet jelzi a cserét a kitöltés-gomb alatt.
    const [geminiBaseFormNotice, setGeminiBaseFormNotice] = useState<
        string | null
    >(null);
    const [selectedCustomWordId, setSelectedCustomWordId] = useState<
        number | null
    >(null);
    const [editCustomWordId, setEditCustomWordId] = useState<number | null>(
        null,
    );
    const [editCustomWordForm, setEditCustomWordForm] =
        useState<WordFormData>(EMPTY_WORD_FORM);
    const [editWordId, setEditWordId] = useState<number | null>(null);
    const [editWordForm, setEditWordForm] =
        useState<WordFormData>(EMPTY_WORD_FORM);
    const [editWordErrors, setEditWordErrors] = useState<
        Record<string, string>
    >({});
    const [selectedDeckId, setSelectedDeckId] = useState<string>('');
    const [importingFlashcard, setImportingFlashcard] = useState(false);
    const [customImportSuccess, setCustomImportSuccess] = useState(false);
    const [wordImportSuccess, setWordImportSuccess] = useState(false);
    const [savingCustomWord, setSavingCustomWord] = useState(false);
    // Kétlépcsős törlés a saját szó modalban: a gomb előbb megerősítést kér.
    const [confirmDeleteCustom, setConfirmDeleteCustom] = useState(false);
    const [hintDismissed, setHintDismissed] = useState(
        () => localStorage.getItem(HINT_STORAGE_KEY) === '1',
    );
    // A forrás-szűrő az URL-ben él (a többi szűrővel azonos módon), így a
    // dashboard „Saját szavak → Kezelés" linkje egyből ide tud navigálni,
    // és a szűrt nézet megosztható/visszatölthető.
    const customFilter: 'all' | 'custom' =
        filters.source === 'custom' ? 'custom' : 'all';
    const [practiceModalWord, setPracticeModalWord] =
        useState<PracticeWord | null>(null);
    const [reportWordId, setReportWordId] = useState<number | null>(null);
    const reportForm = useForm({ description: '' });

    const { auth } = usePage<{
        auth: {
            isAdmin: boolean;
            subscription: { hasAiAccess: boolean } | null;
        };
    }>().props as any;
    const isAdmin: boolean = auth?.isAdmin ?? false;
    const hasAiAccess: boolean =
        isAdmin || (auth?.subscription?.hasAiAccess ?? false);
    const selectedWord =
        selectedWordId !== null
            ? (words.data.find((w) => w.id === selectedWordId) ?? null)
            : null;
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const unifiedList = useMemo((): UnifiedItem[] => {
        if (customFilter === 'custom') {
            return customWords.map((w) => ({ type: 'custom', data: w }));
        }

        // The main list is paginated by rank, so pages have no alphabetical
        // range to slot custom words into. Merge every matching custom word
        // into the first page — each one shows up exactly once.
        const customForPage = words.current_page === 1 ? customWords : [];

        return [
            ...customForPage.map(
                (w): UnifiedItem => ({ type: 'custom', data: w }),
            ),
            ...words.data.map(
                (w): UnifiedItem => ({ type: 'regular', data: w }),
            ),
        ].sort((a, b) =>
            a.data.word.localeCompare(b.data.word, 'en', {
                sensitivity: 'base',
            }),
        );
    }, [customFilter, customWords, words.data, words.current_page]);

    // Saját-szavak nézetben a lista nincs lapozva, ezért a fejléc a betöltött
    // elemek számát mutatja, nem a fő lista (szűrt) összesenét.
    const listedTotal =
        customFilter === 'custom' ? customWords.length : words.total;
    const hasActiveFilters =
        filters.search !== '' ||
        filters.level !== null ||
        filters.status !== '' ||
        filters.importance !== null ||
        filters.folder !== null ||
        filters.source !== '' ||
        (filters.letter !== '' && filters.letter !== 'ALL');

    useEffect(() => {
        const handler = () => setShowFolderSheet(true);
        window.addEventListener('open-folder-sheet', handler);

        return () => {
            window.removeEventListener('open-folder-sheet', handler);
        };
    }, []);

    useEffect(() => {
        const search = new URLSearchParams(window.location.search);
        const addWord = search.get('add');

        // Üres `?add=` is nyit: a dashboard „Hozzáadás" gombja szó nélkül,
        // a bővítmény pedig előtöltött szóval hívja ugyanezt az űrlapot.
        if (addWord !== null) {
            setCustomWordForm({ ...EMPTY_WORD_FORM, word: addWord.trim() });
            setShowAddCustomWord(true);
            // Clean the ?add= param from the URL without reloading
            const clean = new URL(window.location.href);
            clean.searchParams.delete('add');
            window.history.replaceState({}, '', clean.toString());

            return;
        }

        const hasParams =
            search.has('page') ||
            search.has('per_page') ||
            search.has('letter') ||
            search.has('level') ||
            search.has('status') ||
            search.has('importance') ||
            search.has('folder') ||
            search.has('source') ||
            search.has('search');

        if (!hasParams) {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (saved) {
                try {
                    const parsed = JSON.parse(saved);

                    if (parsed && typeof parsed === 'object') {
                        router.get(index(), parsed, {
                            preserveScroll: false,
                            preserveState: false,
                            replace: true,
                        });
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                } catch {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        }
    }, []);

    // A kereső-debounce unmountkor törlendő, különben gyors oldalváltás után
    // a késői router.get visszanavigálná a usert a szólistára.
    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const navigate = useCallback(
        (params: WordFilterPatch, options?: { preserveScroll?: boolean }) => {
            // Egy szűrő-kattintás mindig felülírja a még függő kereső-debounce-t,
            // különben az 350 ms-mal később visszaírná a régi keresőszót.
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
                searchTimeout.current = null;
            }

            if (params.search !== undefined) {
                setSearch(params.search);
            }

            const resolved = {
                search: params.search ?? filters.search,
                letter:
                    params.letter !== undefined
                        ? params.letter
                        : filters.letter,
                level:
                    params.level !== undefined ? params.level : filters.level,
                status:
                    params.status !== undefined
                        ? params.status
                        : filters.status,
                importance:
                    params.importance !== undefined
                        ? params.importance
                        : filters.importance,
                folder:
                    params.folder !== undefined
                        ? params.folder
                        : filters.folder,
                source:
                    params.source !== undefined
                        ? params.source
                        : filters.source,
                per_page:
                    params.per_page !== undefined
                        ? params.per_page
                        : filters.per_page,
                page: params.page ?? 1,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
            router.get(index(), resolved, {
                preserveScroll: options?.preserveScroll ?? false,
                preserveState: true,
                replace: true,
            });
        },
        [filters],
    );

    function handleFolderFilter(folderId: number | null) {
        navigate({ folder: folderId, page: 1 });
    }

    function handleResetFilters() {
        navigate({
            search: '',
            letter: 'ALL',
            level: null,
            status: '',
            importance: null,
            folder: null,
            source: '',
            page: 1,
        });
    }

    function handleDismissHint() {
        localStorage.setItem(HINT_STORAGE_KEY, '1');
        setHintDismissed(true);
    }

    function handleCreateFolder() {
        const name = newFolderName.trim();

        if (!name) {
            return;
        }

        router.post(
            store(),
            { name },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['folders'],
                onSuccess: () => {
                    setNewFolderName('');
                    setShowNewFolderInput(false);
                },
            },
        );
    }

    function handleDeleteFolder(folderId: number, folderName: string) {
        if (
            !confirm(
                `Törlöd a „${folderName}" mappát? A szavak megmaradnak, csak a mappa-besorolásuk vész el.`,
            )
        ) {
            return;
        }

        router.delete(destroy(folderId), {
            preserveScroll: true,
            preserveState: true,
            only: ['folders', 'wordFolderIds'],
            onSuccess: () => {
                if (filters.folder === folderId) {
                    navigate({ folder: null, page: 1 });
                }
            },
        });
    }

    function handleToggleWordFolder(
        wordId: number,
        folderId: number,
        inFolder: boolean,
    ) {
        const refreshWords = filters.folder !== null;

        router.patch(
            folderWordUpdate({ folder: folderId, word: wordId }),
            { in_folder: inFolder },
            {
                preserveScroll: true,
                preserveState: true,
                only: refreshWords
                    ? ['folders', 'wordFolderIds', 'words']
                    : ['folders', 'wordFolderIds'],
                onSuccess: () => {
                    if (refreshWords && !inFolder) {
                        setSelectedWordId(null);
                    }
                },
            },
        );
    }

    function handleImportToFlashcard(wordId: number) {
        if (!selectedDeckId) {
            return;
        }

        setImportingFlashcard(true);
        setWordImportSuccess(false);
        router.post(
            importFromWord(Number(selectedDeckId)).url,
            { word_id: wordId },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['flashcardDecks'],
                onSuccess: () => {
                    setWordImportSuccess(true);
                    setTimeout(() => setWordImportSuccess(false), 2500);
                },
                onFinish: () => setImportingFlashcard(false),
            },
        );
    }

    function handleRenameFolder(folderId: number, name: string) {
        if (!name.trim()) {
            return;
        }

        router.patch(
            update(folderId),
            { name: name.trim() },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['folders'],
                onSuccess: () => {
                    setEditFolderId(null);
                    setEditFolderName('');
                },
            },
        );
    }

    function handleCancelNewFolder() {
        setShowNewFolderInput(false);
        setNewFolderName('');
    }

    function handleNewFolderSubmit(e: React.FormEvent) {
        e.preventDefault();
        handleCreateFolder();
    }

    function handleNewFolderKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Escape') {
            handleCancelNewFolder();
        }
    }

    function handleSearchChange(value: string) {
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            navigate({ search: value, page: 1 }, { preserveScroll: true });
        }, 350);
    }

    // A sor-kezelők useCallback-ben vannak, hogy a memoizált WordRow propjai
    // stabilak maradjanak — enélkül a memo semmit sem érne.
    const handleStatus = useCallback((word: Word, newStatus: WordStatus) => {
        const nextStatus = word.status === newStatus ? null : newStatus;

        router.post(
            status(word.id),
            { status: newStatus },
            {
                preserveScroll: true,
                preserveState: true,
                // Gyors, egymás utáni kattintásoknál minden hívás fusson
                // párhuzamosan, ne szakítsa meg (és görgesse vissza) az
                // előzőt — az Inertia a párhuzamos optimista frissítéseket
                // propról propra követi.
                async: true,
                // A jelölés a lapozó/betű-annotációkat is érinti, ezért azokat
                // is újratöltjük, különben a pöttyök és a zöld oldalak elavulnak.
                only: [
                    'words',
                    'stats',
                    'markedPages',
                    'completedPages',
                    'markedLetters',
                    'flash',
                ],

                optimistic: (props: any) => {
                    const prev = word.status;
                    const delta = (s: WordStatus) =>
                        nextStatus === s ? 1 : prev === s ? -1 : 0;

                    return {
                        words: {
                            ...props.words,
                            data: props.words.data.map((w: Word) =>
                                w.id === word.id
                                    ? { ...w, status: nextStatus }
                                    : w,
                            ),
                        },
                        stats: {
                            ...props.stats,
                            known: props.stats.known + delta('known'),
                            learning: props.stats.learning + delta('learning'),
                            saved: props.stats.saved + delta('saved'),
                            pronunciation:
                                props.stats.pronunciation +
                                delta('pronunciation'),
                            practice: props.stats.practice + delta('practice'),
                        },
                    };
                },
            },
        );
    }, []);

    // Az AI által visszaadott mezőket beolvasztja a meglévő űrlapba. Ahol az AI
    // ad értéket, az felülírja a korábbit (admin szerkesztésnél így újratölt),
    // ahol nem, ott a meglévő érték marad. A `wordOverride` (ha meg van adva) az
    // alapszó, amire a `word` mezőt is átállítjuk — csak új szó felvitelekor.
    function mergeGeminiData(
        prev: WordFormData,
        data: any,
        wordOverride?: string,
    ): WordFormData {
        return {
            ...prev,
            word: wordOverride ?? prev.word,
            // Lemmára váltáskor (pl. „successfully" → „successful") a beírt eredeti
            // alakot külön elmentjük, hogy a szó-felismerés később arra is találjon.
            extra_forms:
                wordOverride && wordOverride !== prev.word
                    ? prev.word
                    : prev.extra_forms,
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
                data.verb_present_participle || prev.verb_present_participle,
            verb_third_person: data.verb_third_person || prev.verb_third_person,
            is_irregular: data.is_irregular ?? prev.is_irregular,
            noun_plural: data.noun_plural || prev.noun_plural,
            adj_comparative: data.adj_comparative || prev.adj_comparative,
            adj_superlative: data.adj_superlative || prev.adj_superlative,
        };
    }

    /**
     * Lekéri a Gemini szóadatot és beolvasztja a megadott űrlapba. Több modal is
     * használja (saját szó hozzáadása, admin szó szerkesztése), ezért a setter és
     * a hiba-kezelő paraméterként jön.
     */
    async function handleGeminiAutofill(
        rawWord: string,
        applyForm: (updater: (prev: WordFormData) => WordFormData) => void,
        setErrors: (errors: Record<string, string>) => void,
        switchWord = false,
    ) {
        const word = rawWord.trim();

        if (!word) {
            return;
        }

        // Korábbi hiba (pl. "nem valódi szó") és lemma-jelzés törlése, hogy egy
        // sikeres újralekérés ne hagyja a régi üzenetet a képernyőn.
        setErrors({});
        setGeminiBaseFormNotice(null);
        setGeminiLoading(true);

        try {
            const csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const res = await withMinDuration(
                fetch(
                    `/text-analysis/gemini-lookup?word=${encodeURIComponent(word)}`,
                    {
                        headers: {
                            'X-CSRF-TOKEN': csrfToken,
                            Accept: 'application/json',
                        },
                    },
                ),
            );
            const data = await res.json().catch(() => ({}));

            absorbAiBudget(data);

            // A 429-es AI-keret válaszban az `error` gépi kód (ai_limit), az
            // emberi szöveg a `message`-ben jön; a többi hibaágon az `error`
            // maga a magyar üzenet.
            if (!res.ok || data.error) {
                setErrors({
                    word:
                        data.message ??
                        data.error ??
                        httpErrorMessage(
                            res.status,
                            'Az AI-kitöltés nem sikerült — próbáld újra.',
                        ),
                });

                return;
            }

            // Az AI nem létező szónak ítélte (gibberish / elgépelés): jelezzük, nem töltünk ki kamu adatot.
            if (data.is_real_word === false) {
                setErrors({
                    word:
                        data.message ??
                        'Ez nem tűnik valódi angol szónak. Ellenőrizd a helyesírást.',
                });

                return;
            }

            // A beírt szó ragozott alak volt (helped): az AI a „help" alapszóra
            // lemmatizált. Új szó felvitelekor (switchWord) az alapszóra állítjuk
            // a `word` mezőt is, és jelezzük; admin-szerkesztésnél csak jelzünk,
            // mert ott egy konkrét, létező sort szerkeszt a felhasználó — a szó
            // néma átírása véletlen átnevezés lenne.
            const lemma =
                data.normalized_from_input && data.base_form
                    ? (data.base_form as string)
                    : null;

            applyForm((prev) =>
                mergeGeminiData(
                    prev,
                    data,
                    switchWord && lemma ? lemma : undefined,
                ),
            );

            if (lemma) {
                setGeminiBaseFormNotice(
                    switchWord
                        ? `A(z) „${word}" a(z) „${lemma}" ragozott alakja — az alapszóból indultunk ki.`
                        : `A(z) „${word}" a(z) „${lemma}" ragozott alakja. A kitöltött alakok az alapszóra vonatkoznak.`,
                );
            }
        } catch {
            setErrors({
                word: 'Nincs hálózati kapcsolat — az AI-kitöltés nem sikerült.',
            });
        } finally {
            setGeminiLoading(false);
        }
    }

    function handleAddCustomWord(e: React.FormEvent) {
        e.preventDefault();

        if (savingCustomWord) {
            return;
        }

        if (!customWordForm.word.trim()) {
            setCustomWordErrors({ word: 'A szó megadása kötelező.' });

            return;
        }

        if (!customWordForm.meaning_hu.trim()) {
            setCustomWordErrors({
                meaning_hu: 'A magyar jelentés megadása kötelező.',
            });

            return;
        }

        const payload: Record<string, string | boolean | number | null> = {
            word: customWordForm.word.trim(),
            meaning_hu: customWordForm.meaning_hu.trim(),
            extra_meanings: customWordForm.extra_meanings.trim() || null,
            synonyms: customWordForm.synonyms.trim() || null,
            part_of_speech: customWordForm.part_of_speech || null,
            example_en: customWordForm.example_en.trim() || null,
            example_hu: customWordForm.example_hu.trim() || null,
            status: customWordForm.status ?? null,
            importance: customWordForm.importance,
        };

        // Minden kitöltött alak-mezőt elküldünk, a szófajtól függetlenül: egy szó
        // több szófaj alakjait is hordozhatja (pl. "interest" főnév + igealakok),
        // és a párosítás/kiemelés mind a 9 oszlopot olvassa.
        payload.form_base = customWordForm.form_base.trim() || null;
        payload.verb_past = customWordForm.verb_past.trim() || null;
        payload.verb_past_participle =
            customWordForm.verb_past_participle.trim() || null;
        payload.verb_present_participle =
            customWordForm.verb_present_participle.trim() || null;
        payload.verb_third_person =
            customWordForm.verb_third_person.trim() || null;
        payload.is_irregular = customWordForm.is_irregular;
        payload.noun_plural = customWordForm.noun_plural.trim() || null;
        payload.adj_comparative = customWordForm.adj_comparative.trim() || null;
        payload.adj_superlative = customWordForm.adj_superlative.trim() || null;
        payload.extra_forms = customWordForm.extra_forms.trim() || null;

        setSavingCustomWord(true);
        router.post(storeCustomWord(), payload, {
            preserveScroll: true,
            only: ['customWords', 'customStats', 'stats', 'flash'],
            onSuccess: () => {
                setCustomWordForm(EMPTY_WORD_FORM);
                setShowAddCustomWord(false);
                setCustomWordErrors({});
                setGeminiBaseFormNotice(null);
            },
            onError: (e) => setCustomWordErrors(e),
            onFinish: () => setSavingCustomWord(false),
        });
    }

    const handleCustomWordStatus = useCallback(
        (wordId: number, newStatus: Exclude<WordStatus, null>) => {
            router.post(
                customWordStatus(wordId),
                { status: newStatus },
                {
                    preserveScroll: true,
                    async: true,
                    only: ['customWords', 'customStats', 'stats', 'flash'],
                },
            );
        },
        [],
    );

    function handleDeleteCustomWord(wordId: number) {
        router.delete(destroyCustomWord(wordId), {
            preserveScroll: true,
            only: ['customWords', 'customStats', 'stats'],
        });
    }

    function handleSaveEditCustomWord(wordId: number) {
        router.patch(updateCustomWord(wordId), editCustomWordForm, {
            preserveScroll: true,
            only: ['customWords', 'customStats'],
            onSuccess: () => {
                setEditCustomWordId(null);
            },
        });
    }

    const openPracticeModal = useCallback(
        (word: string, meaning_hu: string | null) => {
            setPracticeModalWord({ word, meaning_hu });
        },
        [],
    );

    function handleImportance(wordId: number, value: number | null) {
        router.post(
            wordImportance(wordId),
            { importance: value },
            {
                preserveScroll: true,
                preserveState: true,
                async: true,
                // Jelöletlen szónál a backend "known" pivotot hoz létre, ezért
                // a fejléc-statisztika és a lapozó/betű-annotációk is változhatnak.
                only: [
                    'words',
                    'stats',
                    'markedPages',
                    'completedPages',
                    'markedLetters',
                ],
            },
        );
    }

    function handleCustomWordImportance(wordId: number, value: number | null) {
        router.post(
            customWordImportance(wordId),
            { importance: value },
            {
                preserveScroll: true,
                async: true,
                only: ['customWords'],
            },
        );
    }

    function handleSaveEditWord(wordId: number) {
        router.patch(updateWord(wordId), editWordForm, {
            preserveScroll: true,
            only: ['words'],
            onSuccess: () => {
                setEditWordId(null);
            },
        });
    }

    return (
        <>
            <Head title="Top 10 000 angol szó" />

            {/* Practice modal */}
            <PracticeModal
                key={practiceModalWord?.word ?? 'practice'}
                word={practiceModalWord}
                onClose={() => setPracticeModalWord(null)}
            />

            <div className="mx-auto flex h-full w-full max-w-[2000px] flex-1 flex-col gap-6 p-4 pb-24 md:p-6 md:pb-28 xl:px-10 2xl:px-16">
                {/* Hero */}
                <div
                    className="relative overflow-hidden rounded-3xl p-6 md:p-8"
                    style={{
                        background: 'linear-gradient(135deg,#4338CA,#4F8EEC)',
                    }}
                >
                    <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
                    <div className="pointer-events-none absolute right-28 -bottom-24 size-48 rounded-full bg-white/10 blur-2xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                        <div className="max-w-xl">
                            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                                Top 10 000 angol szó
                            </h1>
                            <p className="mt-1.5 text-sm text-white/85 md:text-base">
                                Jelöld meg a szavakat, amelyeket már ismersz — a
                                haladásod magától mentődik, és a szintekben is
                                látszik.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowAddCustomWord(true)}
                                className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-linear-to-br from-green-400 to-green-500 px-6 py-3 text-sm font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                            >
                                <Plus className="size-4" />
                                Saját szó hozzáadása
                            </button>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-2xl bg-white/15 px-5 py-4 ring-1 ring-white/20">
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-white tabular-nums">
                                    {listedTotal.toLocaleString()}
                                </span>
                            </div>
                            <span className="text-xs text-white/70">
                                {hasActiveFilters
                                    ? 'szó a szűrt listában'
                                    : 'szó a listában'}
                            </span>
                        </div>
                    </div>
                </div>

                <WordProgressCard
                    stats={stats}
                    customStats={customStats}
                    activeStatus={filters.status}
                    onStatusFilter={(status) => navigate({ status, page: 1 })}
                    customOnly={customFilter === 'custom'}
                    onCustomOnlyToggle={() =>
                        navigate({
                            source: customFilter === 'custom' ? '' : 'custom',
                            page: 1,
                        })
                    }
                    onAddCustomWord={() => setShowAddCustomWord(true)}
                />

                {/* Add custom word dialog */}
                <Dialog
                    open={showAddCustomWord}
                    onOpenChange={(open) => {
                        if (!open) {
                            setShowAddCustomWord(false);
                            setCustomWordErrors({});
                            setCustomWordForm(EMPTY_WORD_FORM);
                            setGeminiBaseFormNotice(null);
                        }
                    }}
                >
                    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                        <DialogHeader className="border-b px-6 py-4 pr-12">
                            <DialogTitle>Saját szó hozzáadása</DialogTitle>
                            <DialogDescription>
                                A szó és a magyar jelentés kötelező — a többit
                                az AI is kitöltheti helyetted.
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={handleAddCustomWord}
                            className="flex min-h-0 flex-1 flex-col"
                        >
                            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
                                <WordFormFields
                                    form={customWordForm}
                                    onChange={setCustomWordForm}
                                    errors={customWordErrors}
                                    autoFocus
                                    afterWordSlot={
                                        hasAiAccess && (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleGeminiAutofill(
                                                            customWordForm.word,
                                                            setCustomWordForm,
                                                            setCustomWordErrors,
                                                            true,
                                                        )
                                                    }
                                                    disabled={
                                                        geminiLoading ||
                                                        !customWordForm.word.trim()
                                                    }
                                                    className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                                >
                                                    {geminiLoading ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="size-4" />
                                                    )}
                                                    Kitöltés Gemini AI-val
                                                </Button>
                                                {geminiBaseFormNotice && (
                                                    <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                                                        {geminiBaseFormNotice}
                                                    </p>
                                                )}
                                            </>
                                        )
                                    }
                                />
                                <div className="space-y-3 border-t pt-3">
                                    <div>
                                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Státusz
                                        </p>
                                        <StatusButtons
                                            variant="modal"
                                            current={customWordForm.status}
                                            onSelect={(s) =>
                                                setCustomWordForm((prev) => ({
                                                    ...prev,
                                                    status:
                                                        prev.status === s
                                                            ? null
                                                            : s,
                                                }))
                                            }
                                        />
                                    </div>
                                    <ImportanceStars
                                        value={customWordForm.importance}
                                        onChange={(v) =>
                                            setCustomWordForm((prev) => ({
                                                ...prev,
                                                importance: v,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 border-t px-6 py-4">
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={
                                        savingCustomWord ||
                                        !customWordForm.word.trim()
                                    }
                                >
                                    {savingCustomWord ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : null}
                                    {savingCustomWord ? 'Mentés…' : 'Mentés'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowAddCustomWord(false);
                                        setCustomWordErrors({});
                                        setCustomWordForm(EMPTY_WORD_FORM);
                                        setGeminiBaseFormNotice(null);
                                    }}
                                >
                                    Mégse
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <WordFilters
                    filters={filters}
                    search={search}
                    onSearchChange={handleSearchChange}
                    onChange={navigate}
                    onReset={handleResetFilters}
                    folders={folders}
                    markedLetters={markedLetters}
                    customTotal={customStats.total}
                    perPageOptions={PER_PAGE_OPTIONS}
                />

                {/* Folder dialog */}
                <Dialog
                    open={showFolderSheet}
                    onOpenChange={setShowFolderSheet}
                >
                    <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-sm">
                        <DialogHeader className="border-b px-4 py-3 pr-12">
                            <DialogTitle>Mappák</DialogTitle>
                            <DialogDescription className="sr-only">
                                Mappák kezelése és szűrés mappa szerint.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-1 flex-col overflow-y-auto py-1">
                            <button
                                onClick={() => {
                                    handleFolderFilter(null);
                                    setShowFolderSheet(false);
                                }}
                                className={`flex w-full items-center gap-2 px-4 py-3 text-sm transition-colors ${!filters.folder ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                            >
                                <FolderOpen className="size-4 shrink-0" />
                                Minden szó
                            </button>
                            {folders.map((f) => (
                                <div
                                    key={f.id}
                                    className="group flex items-center border-t px-4"
                                >
                                    {editFolderId === f.id ? (
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                handleRenameFolder(
                                                    f.id,
                                                    editFolderName,
                                                );
                                            }}
                                            className="flex flex-1 items-center gap-2 py-2"
                                        >
                                            <Input
                                                autoFocus
                                                value={editFolderName}
                                                onChange={(e) =>
                                                    setEditFolderName(
                                                        e.target.value,
                                                    )
                                                }
                                                className="h-8 flex-1"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setEditFolderId(null);
                                                    }
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                type="submit"
                                                disabled={
                                                    !editFolderName.trim()
                                                }
                                            >
                                                Mentés
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                type="button"
                                                onClick={() =>
                                                    setEditFolderId(null)
                                                }
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        </form>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => {
                                                    handleFolderFilter(f.id);
                                                    setShowFolderSheet(false);
                                                }}
                                                className={`flex flex-1 items-center gap-2 py-3 text-sm transition-colors ${filters.folder === f.id ? 'font-medium text-primary' : 'text-foreground'}`}
                                            >
                                                <FolderOpen className="size-4 shrink-0" />
                                                <span className="flex-1 truncate text-left">
                                                    {f.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {f.words_count} szó
                                                </span>
                                            </button>
                                            <div className="flex shrink-0 gap-1 pl-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    onClick={() => {
                                                        setEditFolderId(f.id);
                                                        setEditFolderName(
                                                            f.name,
                                                        );
                                                    }}
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                                    title="Átnevezés"
                                                >
                                                    <Pencil className="size-4" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        handleDeleteFolder(
                                                            f.id,
                                                            f.name,
                                                        )
                                                    }
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                                                    title="Törlés"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="border-t p-4">
                            {showNewFolderInput ? (
                                <form
                                    onSubmit={handleNewFolderSubmit}
                                    className="flex flex-col gap-2"
                                >
                                    <Input
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) =>
                                            setNewFolderName(e.target.value)
                                        }
                                        placeholder="Mappa neve..."
                                        onKeyDown={handleNewFolderKeyDown}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            className="flex-1"
                                            disabled={!newFolderName.trim()}
                                        >
                                            <Plus className="size-4" />
                                            Létrehozás
                                        </Button>
                                        <Button
                                            variant="outline"
                                            type="button"
                                            onClick={handleCancelNewFolder}
                                        >
                                            Mégse
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => setShowNewFolderInput(true)}
                                >
                                    <FolderPlus className="size-4" />
                                    Új mappa létrehozása
                                </Button>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Word list */}
                <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                        <p className="text-sm font-medium tabular-nums">
                            {listedTotal.toLocaleString()} szó
                            {customFilter !== 'custom' &&
                                words.last_page > 1 && (
                                    <span className="font-normal text-muted-foreground">
                                        {' '}
                                        &mdash; {words.current_page}. /{' '}
                                        {words.last_page}. oldal
                                    </span>
                                )}
                        </p>
                        {customFilter === 'custom' && (
                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                                Csak a saját szavaid
                            </span>
                        )}
                    </div>

                    {!hintDismissed && (
                        <div className="flex items-start gap-3 border-b bg-indigo-50 px-4 py-3 text-indigo-900 dark:bg-indigo-950/20 dark:text-indigo-200">
                            <Info className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                            <p className="flex-1 text-sm">
                                {flipMode
                                    ? 'Fordított mód: a magyar jelentés látszik — kattints a szóra az angol alakért vagy mappa hozzáadásához.'
                                    : 'Kattints bármelyik szóra a részletekért, mappához adásért vagy a példamondatért.'}
                            </p>
                            <button
                                type="button"
                                onClick={handleDismissHint}
                                aria-label="Tipp elrejtése"
                                className="shrink-0 cursor-pointer rounded p-0.5 text-indigo-500 transition-colors hover:text-indigo-900 dark:hover:text-indigo-200"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    )}

                    {unifiedList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                            <Search className="mb-3 size-10 text-muted-foreground/40" />
                            <p className="font-medium">Nincs találat</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {hasActiveFilters
                                    ? 'Egyik szó sem felel meg a beállított szűrőknek.'
                                    : 'Próbálj más keresési feltételt.'}
                            </p>
                            {hasActiveFilters && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={handleResetFilters}
                                >
                                    Szűrők törlése
                                </Button>
                            )}
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {unifiedList.map((item) => (
                                <WordRow
                                    key={
                                        item.type === 'custom'
                                            ? `custom-${item.data.id}`
                                            : item.data.id
                                    }
                                    item={item}
                                    flipMode={flipMode}
                                    hasAiAccess={hasAiAccess}
                                    onSelectWord={setSelectedWordId}
                                    onSelectCustomWord={setSelectedCustomWordId}
                                    onStatus={handleStatus}
                                    onCustomStatus={handleCustomWordStatus}
                                    onPractice={openPracticeModal}
                                />
                            ))}
                        </ul>
                    )}
                </section>

                {/* Pagination */}
                {words.last_page > 1 && customFilter !== 'custom' && (
                    <div className="flex flex-wrap justify-center gap-1">
                        {words.links.map((link, i) => {
                            const pageNum = link.url
                                ? Number(
                                      new URL(link.url).searchParams.get(
                                          'page',
                                      ) ?? 1,
                                  )
                                : null;
                            const isCompleted =
                                pageNum !== null &&
                                !link.active &&
                                completedPages.includes(pageNum);
                            const hasMarks =
                                pageNum !== null &&
                                !link.active &&
                                !isCompleted &&
                                markedPages.includes(pageNum);
                            const label =
                                link.label.includes('Previous') ||
                                link.label.includes('pagination.previous')
                                    ? '←'
                                    : link.label.includes('Next') ||
                                        link.label.includes('pagination.next')
                                      ? '→'
                                      : link.label;

                            return (
                                <button
                                    key={i}
                                    disabled={!link.url}
                                    onClick={() => {
                                        if (link.url && pageNum) {
                                            navigate({ page: pageNum });
                                        }
                                    }}
                                    className={`relative rounded-full px-3.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        link.active
                                            ? 'bg-primary font-medium text-primary-foreground shadow-sm'
                                            : isCompleted
                                              ? 'bg-green-100 font-medium text-green-800 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-300'
                                              : hasMarks
                                                ? 'bg-card text-foreground shadow-sm ring-1 ring-indigo-300 hover:bg-accent dark:ring-indigo-700'
                                                : 'bg-card shadow-sm hover:bg-accent'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Flip mode FAB */}
            <button
                onClick={() => setFlipMode((v) => !v)}
                title={
                    flipMode
                        ? 'Vissza az alap módra'
                        : 'Fordított mód: magyar → angol'
                }
                className={`fixed right-6 bottom-6 z-50 flex cursor-pointer items-center gap-2.5 rounded-full px-5 py-3.5 shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl active:scale-95 ${
                    flipMode
                        ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                        : 'border-2 border-primary/40 bg-card text-foreground hover:border-primary'
                }`}
            >
                <ArrowLeftRight className="size-5 shrink-0" />
                <span className="hidden text-sm font-semibold sm:inline">
                    {flipMode ? 'Magyar → Angol' : 'Fordított mód'}
                </span>
            </button>

            {/* Custom word detail modal */}
            <Dialog
                open={selectedCustomWordId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedCustomWordId(null);
                        setConfirmDeleteCustom(false);
                    }
                }}
            >
                <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
                    {(() => {
                        const cw = customWords.find(
                            (w) => w.id === selectedCustomWordId,
                        );

                        if (!cw) {
                            return null;
                        }

                        return (
                            <>
                                <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-6 pt-5 pr-14 pb-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                                                    saját szó
                                                </span>
                                                {cw.part_of_speech && (
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                        {cw.part_of_speech}
                                                    </span>
                                                )}
                                            </div>
                                            <DialogTitle asChild>
                                                <h2 className="text-3xl font-bold tracking-tight">
                                                    {cw.word}
                                                </h2>
                                            </DialogTitle>
                                            <DialogDescription className="sr-only">
                                                A saját szavad részletei és
                                                beállításai.
                                            </DialogDescription>
                                        </div>
                                        <button
                                            onClick={() => speak(cw.word)}
                                            title="Felolvasás"
                                            className="mt-1 shrink-0 rounded-full bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
                                        >
                                            <Volume2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                                    {cw.meaning_hu && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Magyar jelentés
                                            </p>
                                            <p className="text-lg leading-snug font-semibold">
                                                {cw.meaning_hu}
                                            </p>
                                            {cw.extra_meanings && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {cw.extra_meanings}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {cw.synonyms && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Szinonimák
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {cw.synonyms
                                                    .split(',')
                                                    .map((s) => s.trim())
                                                    .filter(Boolean)
                                                    .map((s) => (
                                                        <span
                                                            key={s}
                                                            className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                                                        >
                                                            {s}
                                                        </span>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                    {cw.verb_past && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Igealakok
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {(
                                                    [
                                                        {
                                                            label: 'Alap',
                                                            value: cw.form_base,
                                                        },
                                                        {
                                                            label: 'Múlt idő',
                                                            value: cw.verb_past,
                                                        },
                                                        {
                                                            label: 'Befejezett igenév',
                                                            value: cw.verb_past_participle,
                                                        },
                                                        {
                                                            label: 'Folyamatos (-ing)',
                                                            value: cw.verb_present_participle,
                                                        },
                                                        {
                                                            label: 'E/3 jelen',
                                                            value: cw.verb_third_person,
                                                        },
                                                    ] as const
                                                )
                                                    .filter(
                                                        ({ value }) => value,
                                                    )
                                                    .map(({ label, value }) => (
                                                        <div
                                                            key={label}
                                                            className="rounded-lg bg-muted/50 px-3 py-2"
                                                        >
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {label}
                                                            </p>
                                                            <p className="font-semibold">
                                                                {value}
                                                            </p>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                    {cw.noun_plural && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Többes szám
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Egyes szám
                                                    </p>
                                                    <p className="font-semibold">
                                                        {cw.form_base ??
                                                            cw.word}
                                                    </p>
                                                </div>
                                                <span className="text-muted-foreground">
                                                    →
                                                </span>
                                                <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Többes szám
                                                    </p>
                                                    <p className="font-semibold">
                                                        {cw.noun_plural}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {cw.adj_comparative && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Fokozás
                                            </p>
                                            <div className="flex gap-2">
                                                {cw.adj_comparative && (
                                                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Középfok
                                                        </p>
                                                        <p className="font-semibold">
                                                            {cw.adj_comparative}
                                                        </p>
                                                    </div>
                                                )}
                                                {cw.adj_superlative && (
                                                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Felsőfok
                                                        </p>
                                                        <p className="font-semibold">
                                                            {cw.adj_superlative}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {(cw.example_en || cw.example_hu) && (
                                        <div className="rounded-xl border-l-4 border-primary/40 bg-muted/30 px-4 py-3.5">
                                            <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Példamondat
                                            </p>
                                            {cw.example_en && (
                                                <p className="text-sm font-medium italic">
                                                    "{cw.example_en}"
                                                </p>
                                            )}
                                            {cw.example_hu && (
                                                <p className="mt-1 text-sm text-muted-foreground italic">
                                                    "{cw.example_hu}"
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <StatusButtons
                                        variant="modal"
                                        current={cw.status}
                                        onSelect={(s) =>
                                            handleCustomWordStatus(cw.id, s)
                                        }
                                    />
                                    <ImportanceStars
                                        value={cw.importance}
                                        onChange={(v) =>
                                            handleCustomWordImportance(cw.id, v)
                                        }
                                    />
                                    {flashcardDecks.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                                Flashcard deckhez adás
                                            </p>
                                            <div className="flex gap-2">
                                                <Select
                                                    value={selectedDeckId}
                                                    onValueChange={
                                                        setSelectedDeckId
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 flex-1 text-sm">
                                                        <SelectValue placeholder="Válassz decket..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {flashcardDecks.map(
                                                            (deck) => (
                                                                <SelectItem
                                                                    key={
                                                                        deck.id
                                                                    }
                                                                    value={String(
                                                                        deck.id,
                                                                    )}
                                                                >
                                                                    {deck.name}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    size="sm"
                                                    variant={
                                                        customImportSuccess
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    disabled={
                                                        !selectedDeckId ||
                                                        importingFlashcard
                                                    }
                                                    onClick={() => {
                                                        if (!selectedDeckId) {
                                                            return;
                                                        }

                                                        setImportingFlashcard(
                                                            true,
                                                        );
                                                        setCustomImportSuccess(
                                                            false,
                                                        );
                                                        router.post(
                                                            importFromWord(
                                                                Number(
                                                                    selectedDeckId,
                                                                ),
                                                            ).url,
                                                            {
                                                                custom_word_id:
                                                                    cw.id,
                                                            },
                                                            {
                                                                preserveScroll: true,
                                                                onSuccess:
                                                                    () => {
                                                                        setCustomImportSuccess(
                                                                            true,
                                                                        );
                                                                        setTimeout(
                                                                            () =>
                                                                                setCustomImportSuccess(
                                                                                    false,
                                                                                ),
                                                                            2500,
                                                                        );
                                                                    },
                                                                onFinish: () =>
                                                                    setImportingFlashcard(
                                                                        false,
                                                                    ),
                                                            },
                                                        );
                                                    }}
                                                >
                                                    <Layers className="mr-1.5 size-4" />
                                                    {customImportSuccess
                                                        ? 'Hozzáadva!'
                                                        : 'Hozzáadás'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                    {flashcardDecks.length === 0 && (
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
                                    )}

                                    {hasAiAccess && (
                                        <div className="flex flex-col gap-3 border-t pt-4">
                                            <WordInsightPanel
                                                key={cw.word}
                                                word={cw.word}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="border-t px-6 py-4">
                                    {confirmDeleteCustom ? (
                                        <div className="flex flex-col gap-2">
                                            <p className="text-sm font-medium text-destructive">
                                                Biztosan törlöd a(z) „{cw.word}"
                                                szót? Ez nem vonható vissza.
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => {
                                                        handleDeleteCustomWord(
                                                            cw.id,
                                                        );
                                                        setSelectedCustomWordId(
                                                            null,
                                                        );
                                                        setConfirmDeleteCustom(
                                                            false,
                                                        );
                                                    }}
                                                >
                                                    <Trash2 className="size-3.5" />
                                                    Igen, törlöm
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        setConfirmDeleteCustom(
                                                            false,
                                                        )
                                                    }
                                                >
                                                    Mégse
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => {
                                                    setSelectedCustomWordId(
                                                        null,
                                                    );
                                                    setEditCustomWordId(cw.id);
                                                    setEditCustomWordForm(
                                                        wordToFormData(cw),
                                                    );
                                                }}
                                            >
                                                <Pencil className="size-3.5" />
                                                Szerkesztés
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                onClick={() =>
                                                    setConfirmDeleteCustom(true)
                                                }
                                            >
                                                <Trash2 className="size-3.5" />
                                                Törlés
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Custom word edit modal */}
            <Dialog
                open={editCustomWordId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditCustomWordId(null);
                    }
                }}
            >
                <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                    <DialogHeader className="border-b px-6 py-4 pr-12">
                        <DialogTitle>Saját szó szerkesztése</DialogTitle>
                        <DialogDescription className="sr-only">
                            A saját szavad adatainak módosítása.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
                        <WordFormFields
                            form={editCustomWordForm}
                            onChange={setEditCustomWordForm}
                            autoFocus
                        />
                        <div className="space-y-3 border-t pt-3">
                            <div>
                                <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                    Státusz
                                </p>
                                <StatusButtons
                                    variant="modal"
                                    current={editCustomWordForm.status}
                                    onSelect={(s) =>
                                        setEditCustomWordForm((prev) => ({
                                            ...prev,
                                            status:
                                                prev.status === s ? null : s,
                                        }))
                                    }
                                />
                            </div>
                            <ImportanceStars
                                value={editCustomWordForm.importance}
                                onChange={(v) =>
                                    setEditCustomWordForm((prev) => ({
                                        ...prev,
                                        importance: v,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 border-t px-6 py-4">
                        <Button
                            className="flex-1"
                            disabled={!editCustomWordForm.word.trim()}
                            onClick={() =>
                                editCustomWordId !== null &&
                                handleSaveEditCustomWord(editCustomWordId)
                            }
                        >
                            Mentés
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setEditCustomWordId(null)}
                        >
                            Mégse
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Word detail modal */}
            <Dialog
                open={selectedWord !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedWordId(null);
                    }
                }}
            >
                <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                    {selectedWord && (
                        <>
                            {/* Hero */}
                            <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-6 pt-5 pr-14 pb-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                #{selectedWord.rank}
                                            </span>
                                            {selectedWord.part_of_speech && (
                                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                                                    {POS_LABELS[
                                                        selectedWord
                                                            .part_of_speech
                                                    ] ??
                                                        selectedWord.part_of_speech}
                                                </span>
                                            )}
                                            {selectedWord.is_irregular ===
                                                1 && (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    rendhagyó
                                                </span>
                                            )}
                                        </div>
                                        <DialogTitle asChild>
                                            <h2 className="text-3xl font-bold tracking-tight">
                                                {flipMode
                                                    ? (selectedWord.meaning_hu ?? (
                                                          <span className="text-muted-foreground italic">
                                                              nincs fordítás
                                                          </span>
                                                      ))
                                                    : selectedWord.word}
                                            </h2>
                                        </DialogTitle>
                                        <DialogDescription className="sr-only">
                                            A szó jelentése, alakjai és
                                            beállításai.
                                        </DialogDescription>
                                    </div>
                                    <button
                                        onClick={() => speak(selectedWord.word)}
                                        title="Felolvasás"
                                        className="mt-1 shrink-0 rounded-full bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground"
                                    >
                                        <Volume2 className="size-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable body */}
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                                {/* Jelentés */}
                                <div className="rounded-xl border bg-card px-4 py-3.5">
                                    <p className="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                        {flipMode ? 'Angol' : 'Magyar jelentés'}
                                    </p>
                                    {flipMode ? (
                                        <p className="flex items-center gap-2 text-lg font-semibold">
                                            {selectedWord.word}
                                            <button
                                                onClick={() =>
                                                    speak(selectedWord.word)
                                                }
                                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                            >
                                                <Volume2 className="size-3.5" />
                                            </button>
                                        </p>
                                    ) : selectedWord.meaning_hu ? (
                                        <>
                                            <p className="text-lg leading-snug font-semibold">
                                                {selectedWord.meaning_hu}
                                            </p>
                                            {selectedWord.extra_meanings && (
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {
                                                        selectedWord.extra_meanings
                                                    }
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-muted-foreground italic">
                                            Nincs fordítás megadva
                                        </p>
                                    )}
                                </div>

                                {/* Igealakok — a szófajtól függetlenül látszik, ha
                                    a szó hordoz igealakot (pl. "interest" főnév + ige) */}
                                {selectedWord.verb_past && (
                                    <div className="rounded-xl border bg-card px-4 py-3.5">
                                        <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Igealakok
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {(
                                                [
                                                    {
                                                        label: 'Alap',
                                                        value:
                                                            selectedWord.form_base ||
                                                            selectedWord.word,
                                                    },
                                                    {
                                                        label: 'Múlt idő',
                                                        value: selectedWord.verb_past,
                                                    },
                                                    {
                                                        label: 'Befejezett igenév',
                                                        value: selectedWord.verb_past_participle,
                                                    },
                                                    {
                                                        label: 'Folyamatos (-ing)',
                                                        value: selectedWord.verb_present_participle,
                                                    },
                                                    {
                                                        label: 'E/3 jelen',
                                                        value: selectedWord.verb_third_person,
                                                    },
                                                ] as const
                                            )
                                                .filter(({ value }) => value)
                                                .map(({ label, value }) => (
                                                    <div
                                                        key={label}
                                                        className="rounded-lg bg-muted/50 px-3 py-2"
                                                    >
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {label}
                                                        </p>
                                                        <p className="font-semibold">
                                                            {value}
                                                        </p>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Többes szám — szófajtól függetlenül, ha van adat */}
                                {selectedWord.noun_plural && (
                                    <div className="rounded-xl border bg-card px-4 py-3.5">
                                        <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Többes szám
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Egyes szám
                                                </p>
                                                <p className="font-semibold">
                                                    {selectedWord.form_base ||
                                                        selectedWord.word}
                                                </p>
                                            </div>
                                            <span className="text-muted-foreground">
                                                →
                                            </span>
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Többes szám
                                                </p>
                                                <p className="font-semibold">
                                                    {selectedWord.noun_plural}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Fokozás — szófajtól függetlenül, ha van adat */}
                                {selectedWord.adj_comparative && (
                                    <div className="rounded-xl border bg-card px-4 py-3.5">
                                        <p className="mb-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Fokozás
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Alapfok
                                                </p>
                                                <p className="font-semibold">
                                                    {selectedWord.form_base ||
                                                        selectedWord.word}
                                                </p>
                                            </div>
                                            <span className="text-muted-foreground">
                                                →
                                            </span>
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Középfok
                                                </p>
                                                <p className="font-semibold">
                                                    {
                                                        selectedWord.adj_comparative
                                                    }
                                                </p>
                                            </div>
                                            <span className="text-muted-foreground">
                                                →
                                            </span>
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">
                                                    Felsőfok
                                                </p>
                                                <p className="font-semibold">
                                                    {
                                                        selectedWord.adj_superlative
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Szinonimák */}
                                {selectedWord.synonyms && (
                                    <div>
                                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Szinonimák
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedWord.synonyms
                                                .split(',')
                                                .map((s) => (
                                                    <span
                                                        key={s.trim()}
                                                        className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium"
                                                    >
                                                        {s.trim()}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Példamondat */}
                                {selectedWord.example_en && (
                                    <div className="rounded-xl border-l-4 border-primary/40 bg-muted/30 px-4 py-3.5">
                                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Példamondat
                                        </p>
                                        <p className="text-sm font-medium italic">
                                            "{selectedWord.example_en}"
                                        </p>
                                        {selectedWord.example_hu && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                "{selectedWord.example_hu}"
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Státusz */}
                                <StatusButtons
                                    variant="modal"
                                    current={selectedWord.status}
                                    onSelect={(s) =>
                                        handleStatus(selectedWord, s)
                                    }
                                />

                                {/* Fontosság */}
                                <ImportanceStars
                                    value={selectedWord.importance}
                                    onChange={(v) =>
                                        handleImportance(selectedWord.id, v)
                                    }
                                />

                                {/* Mappák */}
                                {folders.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Mappák
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {folders.map((f) => {
                                                const inFolder = (
                                                    wordFolderIds[
                                                        selectedWord.id
                                                    ] ?? []
                                                ).includes(f.id);

                                                return (
                                                    <button
                                                        key={f.id}
                                                        onClick={() =>
                                                            handleToggleWordFolder(
                                                                selectedWord.id,
                                                                f.id,
                                                                !inFolder,
                                                            )
                                                        }
                                                        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                                                            inFolder
                                                                ? 'bg-primary text-primary-foreground'
                                                                : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary'
                                                        }`}
                                                    >
                                                        <FolderOpen className="size-3.5" />
                                                        {f.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Flashcard deckhez adás */}
                                {flashcardDecks.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                            Flashcard deckhez adás
                                        </p>
                                        <div className="flex gap-2">
                                            <Select
                                                value={selectedDeckId}
                                                onValueChange={
                                                    setSelectedDeckId
                                                }
                                            >
                                                <SelectTrigger className="h-9 flex-1 text-sm">
                                                    <SelectValue placeholder="Válassz decket..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {flashcardDecks.map(
                                                        (deck) => (
                                                            <SelectItem
                                                                key={deck.id}
                                                                value={String(
                                                                    deck.id,
                                                                )}
                                                            >
                                                                {deck.name}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                size="sm"
                                                variant={
                                                    wordImportSuccess
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                disabled={
                                                    !selectedDeckId ||
                                                    importingFlashcard
                                                }
                                                onClick={() =>
                                                    handleImportToFlashcard(
                                                        selectedWord.id,
                                                    )
                                                }
                                            >
                                                <Layers className="mr-1.5 size-4" />
                                                {wordImportSuccess
                                                    ? 'Hozzáadva!'
                                                    : 'Hozzáadás'}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {flashcardDecks.length === 0 && (
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
                                )}

                                {/* AI szó-infó (AI-hozzáférésű felhasználóknak) */}
                                {hasAiAccess && (
                                    <div className="flex flex-col gap-3 border-t pt-4">
                                        <WordInsightPanel
                                            key={selectedWord.word}
                                            word={selectedWord.word}
                                        />
                                    </div>
                                )}

                                {/* Hibás adat jelentése */}
                                <div className="flex flex-col gap-3 border-t pt-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full text-muted-foreground"
                                        onClick={() =>
                                            setReportWordId(selectedWord.id)
                                        }
                                    >
                                        <Flag className="size-3.5" />
                                        Hibás adat jelentése
                                    </Button>
                                </div>

                                {/* Admin szerkesztés */}
                                {isAdmin && (
                                    <div className="flex flex-col gap-3 border-t pt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                            onClick={() => {
                                                setSelectedWordId(null);
                                                setEditWordId(selectedWord.id);
                                                setEditWordForm(
                                                    wordToFormData(
                                                        selectedWord,
                                                    ),
                                                );
                                                setEditWordErrors({});
                                                setGeminiBaseFormNotice(null);
                                            }}
                                        >
                                            <Pencil className="size-3.5" />
                                            Admin szerkesztés
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
            {/* Hibás szóadat jelentése modal */}
            <Dialog
                open={reportWordId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setReportWordId(null);
                        reportForm.reset();
                        reportForm.clearErrors();
                    }
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
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();

                            if (reportWordId === null) {
                                return;
                            }

                            router.post(
                                storeReport().url,
                                {
                                    category: 'word_data',
                                    word_id: reportWordId,
                                    description: reportForm.data.description,
                                },
                                {
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        reportForm.reset();
                                        setReportWordId(null);
                                    },
                                    onError: (errors) =>
                                        reportForm.setError(
                                            errors as Record<string, string>,
                                        ),
                                },
                            );
                        }}
                        className="flex flex-col gap-3"
                    >
                        <Textarea
                            value={reportForm.data.description}
                            onChange={(e) =>
                                reportForm.setData(
                                    'description',
                                    e.target.value,
                                )
                            }
                            maxLength={2000}
                            rows={4}
                            placeholder="Mi hibás ennél a szónál?"
                            required
                        />
                        <div className="flex items-center justify-between gap-2">
                            {reportForm.errors.description ? (
                                <p className="text-sm text-destructive">
                                    {reportForm.errors.description}
                                </p>
                            ) : (
                                <span />
                            )}
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {reportForm.data.description.length} / 2000
                            </span>
                        </div>
                        <Button
                            type="submit"
                            disabled={
                                reportForm.processing ||
                                reportForm.data.description.trim() === ''
                            }
                            className="self-start"
                        >
                            {reportForm.processing ? 'Küldés...' : 'Küldés'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
            {/* Admin word edit modal */}
            {isAdmin && (
                <Dialog
                    open={editWordId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditWordId(null);
                            setEditWordErrors({});
                            setGeminiBaseFormNotice(null);
                        }
                    }}
                >
                    <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                        <DialogHeader className="border-b px-6 py-4 pr-12">
                            <DialogTitle>Szó szerkesztése (Admin)</DialogTitle>
                            <DialogDescription className="sr-only">
                                A listás szó adatainak módosítása.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
                            <WordFormFields
                                form={editWordForm}
                                onChange={setEditWordForm}
                                errors={editWordErrors}
                                autoFocus
                                afterWordSlot={
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                handleGeminiAutofill(
                                                    editWordForm.word,
                                                    setEditWordForm,
                                                    setEditWordErrors,
                                                )
                                            }
                                            disabled={
                                                geminiLoading ||
                                                !editWordForm.word.trim()
                                            }
                                            className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                        >
                                            {geminiLoading ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Sparkles className="size-4" />
                                            )}
                                            Újratöltés Gemini AI-val
                                        </Button>
                                        {geminiBaseFormNotice && (
                                            <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
                                                {geminiBaseFormNotice}
                                            </p>
                                        )}
                                    </>
                                }
                            />
                        </div>
                        <div className="flex gap-2 border-t px-6 py-4">
                            <Button
                                className="flex-1"
                                disabled={!editWordForm.word.trim()}
                                onClick={() =>
                                    editWordId !== null &&
                                    handleSaveEditWord(editWordId)
                                }
                            >
                                Mentés
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setEditWordId(null)}
                            >
                                Mégse
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

WordsIndex.layout = {
    breadcrumbs: [{ title: 'Top 10 000 szó', href: index() }],
};
