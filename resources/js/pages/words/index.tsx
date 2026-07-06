import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    BookMarked,
    CheckCheck,
    Clock,
    FolderOpen,
    FolderPlus,
    Info,
    Layers,
    Loader2,
    Mic,
    Pencil,
    PenLine,
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
import { FilterChip, FilterGroup } from '@/components/words/filter-chip';
import ImportanceStars from '@/components/words/importance-stars';
import PracticeModal from '@/components/words/practice-modal';
import type { PracticeWord } from '@/components/words/practice-modal';
import StatusButtons from '@/components/words/status-buttons';
import {
    EMPTY_WORD_FORM,
    LEVELS,
    POS_LABELS,
    STATUS_CONFIG,
    speak,
    wordToFormData,
} from '@/components/words/types';
import type {
    CustomWord,
    Word,
    WordFormData,
    WordStatus,
} from '@/components/words/types';
import WordFormFields from '@/components/words/word-form-fields';
import WordInsightPanel from '@/components/words/word-insight-panel';
import WordRow from '@/components/words/word-row';
import type { UnifiedItem } from '@/components/words/word-row';
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
import {
    importance as wordImportance,
    index,
    status,
    update as updateWord,
} from '@/routes/words';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedWords {
    data: Word[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PaginationLink[];
}

interface Folder {
    id: number;
    name: string;
    words_count: number;
}

interface FlashcardDeck {
    id: number;
    name: string;
}

interface Props {
    words: PaginatedWords;
    filters: {
        search: string;
        letter: string;
        level: number | null;
        status: string;
        importance: number | null;
        folder: number | null;
        per_page: number;
    };
    stats: {
        total: number;
        known: number;
        learning: number;
        saved: number;
        pronunciation: number;
        practice: number;
    };
    customWords: CustomWord[];
    customStats: {
        total: number;
        known: number;
        learning: number;
        saved: number;
        pronunciation: number;
        practice: number;
    };
    markedPages: number[];
    completedPages: number[];
    markedLetters: string[];
    folders: Folder[];
    wordFolderIds: Record<number, number[]>;
    flashcardDecks: FlashcardDeck[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
}: Props) {
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
    const [customFilter, setCustomFilter] = useState<'all' | 'custom'>('all');
    const [practiceModalWord, setPracticeModalWord] =
        useState<PracticeWord | null>(null);

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
    const progressPercent =
        stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;

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

    const STORAGE_KEY = 'words_filters';

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

        if (addWord) {
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
        (
            params: {
                search?: string;
                letter?: string;
                level?: number | null;
                status?: string;
                importance?: number | null;
                folder?: number | null;
                page?: number;
                per_page?: number;
            },
            options?: { preserveScroll?: boolean },
        ) => {
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

    function handleDeleteFolder(folderId: number) {
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
        router.post(
            importFromWord(Number(selectedDeckId)).url,
            { word_id: wordId },
            {
                preserveScroll: true,
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
            navigate(
                { search: value, letter: filters.letter, page: 1 },
                { preserveScroll: true },
            );
        }, 350);
    }

    function handleLetterClick(letter: string) {
        setSearch('');
        navigate({ search: '', letter, page: 1 });
    }

    function handleLevelClick(level: number | null) {
        setSearch('');
        navigate({ search: '', level, letter: 'ALL', page: 1 });
    }

    function handleStatusFilter(statusValue: string) {
        navigate({ status: statusValue, page: 1 });
    }

    function handleImportanceFilter(value: number | null) {
        navigate({ importance: value, page: 1 });
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
    // ahol nem, ott a meglévő érték marad.
    function mergeGeminiData(prev: WordFormData, data: any): WordFormData {
        return {
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
    ) {
        const word = rawWord.trim();

        if (!word) {
            return;
        }

        // Korábbi hiba (pl. "nem valódi szó") törlése, hogy egy sikeres
        // újralekérés ne hagyja a régi üzenetet a képernyőn.
        setErrors({});
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

            applyForm((prev) => mergeGeminiData(prev, data));
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

        router.post(storeCustomWord(), payload, {
            preserveScroll: true,
            only: ['customWords', 'customStats', 'stats', 'flash'],
            onSuccess: () => {
                setCustomWordForm(EMPTY_WORD_FORM);
                setShowAddCustomWord(false);
                setCustomWordErrors({});
            },
            onError: (e) => setCustomWordErrors(e),
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

            <div className="flex h-full flex-1 flex-col gap-4 p-4 pb-24 md:px-6 md:pt-6 md:pb-28">
                {/* Hero + progress + custom words */}
                <div
                    id="custom-words"
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-violet-400 p-6 md:p-8"
                >
                    <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/15" />
                    <div className="relative flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                                Top 10 000 angol szó
                            </h1>
                            <p className="text-sm text-white/85">
                                Jelöld meg a szavakat, amelyeket már ismersz.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowAddCustomWord(true)}
                            className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-green-700 shadow-[0_4px_0_0_var(--color-primary-shade)] transition-all hover:brightness-95 active:translate-y-0.75 active:shadow-[0_1px_0_0_var(--color-primary-shade)]"
                        >
                            <Plus className="size-4" />
                            <span className="hidden sm:inline">Saját szó</span>
                            {customStats.total > 0 && (
                                <span className="text-xs font-normal opacity-70">
                                    {customStats.total}
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="relative mt-5">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-white">
                                Haladás
                            </span>
                            <span className="text-white/85">
                                {stats.known.toLocaleString()} /{' '}
                                {stats.total.toLocaleString()} (
                                {progressPercent}%)
                            </span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-black/15">
                            <div
                                className="h-3 rounded-full bg-white transition-all duration-300"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                <CheckCheck className="size-3.5 text-green-600" />
                                Tudom: {stats.known.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                <Clock className="size-3.5 text-blue-600" />
                                Tanulom: {stats.learning.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                <BookMarked className="size-3.5 text-orange-600" />
                                Később: {stats.saved.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                <Mic className="size-3.5 text-violet-600" />
                                Kiejtés: {stats.pronunciation.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                <PenLine className="size-3.5 text-rose-600" />
                                Gyakorlásra: {stats.practice.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    {/* Custom words sub-section */}
                    <div className="relative mt-5 border-t border-white/20 pt-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-bold text-white">
                                Saját szavak
                            </span>
                            <span className="text-white/85">
                                {customStats.total === 0
                                    ? 'Még nincs hozzáadott szó'
                                    : `${customStats.total} szó hozzáadva`}
                            </span>
                        </div>
                        {customStats.total > 0 && (
                            <>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-black/15">
                                    <div
                                        className="h-2 rounded-full bg-white transition-all duration-300"
                                        style={{
                                            width: `${Math.round((customStats.known / customStats.total) * 100)}%`,
                                        }}
                                    />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                        <CheckCheck className="size-3.5 text-green-600" />
                                        Tudom:{' '}
                                        {customStats.known.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                        <Clock className="size-3.5 text-blue-600" />
                                        Tanulom:{' '}
                                        {customStats.learning.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                        <BookMarked className="size-3.5 text-orange-600" />
                                        Később:{' '}
                                        {customStats.saved.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                        <Mic className="size-3.5 text-violet-600" />
                                        Kiejtés:{' '}
                                        {customStats.pronunciation.toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-700">
                                        <PenLine className="size-3.5 text-rose-600" />
                                        Gyakorlásra:{' '}
                                        {customStats.practice.toLocaleString()}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Add custom word dialog */}
                <Dialog
                    open={showAddCustomWord}
                    onOpenChange={(open) => {
                        if (!open) {
                            setShowAddCustomWord(false);
                            setCustomWordErrors({});
                            setCustomWordForm(EMPTY_WORD_FORM);
                        }
                    }}
                >
                    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                        <DialogHeader className="border-b px-6 py-4">
                            <DialogTitle>Saját szó hozzáadása</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddCustomWord}>
                            <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-6 py-5">
                                <WordFormFields
                                    form={customWordForm}
                                    onChange={setCustomWordForm}
                                    errors={customWordErrors}
                                    autoFocus
                                    afterWordSlot={
                                        hasAiAccess && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() =>
                                                    handleGeminiAutofill(
                                                        customWordForm.word,
                                                        setCustomWordForm,
                                                        setCustomWordErrors,
                                                    )
                                                }
                                                disabled={
                                                    geminiLoading ||
                                                    !customWordForm.word.trim()
                                                }
                                                className="w-full border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                            >
                                                {geminiLoading ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Sparkles className="size-4" />
                                                )}
                                                Kitöltés Gemini AI-val
                                            </Button>
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
                                    disabled={!customWordForm.word.trim()}
                                >
                                    Mentés
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowAddCustomWord(false);
                                        setCustomWordErrors({});
                                        setCustomWordForm(EMPTY_WORD_FORM);
                                    }}
                                >
                                    Mégse
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Szűrők */}
                <div className="flex flex-col gap-4 rounded-3xl bg-card p-4 shadow-sm md:p-5">
                    {/* Keresés + oldalméret */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Keresés a szavak között..."
                                className="rounded-full border-0 bg-muted pr-9 pl-10"
                                value={search}
                                onChange={(e) =>
                                    handleSearchChange(e.target.value)
                                }
                            />
                            {search && (
                                <button
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleSearchChange('')}
                                    aria-label="Törlés"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </div>
                        <Select
                            value={String(filters.per_page)}
                            onValueChange={(v) =>
                                navigate({ per_page: Number(v), page: 1 })
                            }
                        >
                            <SelectTrigger className="w-28 rounded-full border-0 bg-muted text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[20, 50, 100, 200, 300, 400, 500, 1000].map(
                                    (n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n} / oldal
                                        </SelectItem>
                                    ),
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {!search && (
                        <FilterGroup label="Szint">
                            <FilterChip
                                active={filters.level === null}
                                onClick={() => handleLevelClick(null)}
                            >
                                Mind
                            </FilterChip>
                            {LEVELS.map((l) => (
                                <FilterChip
                                    key={l.value}
                                    active={filters.level === l.value}
                                    onClick={() => handleLevelClick(l.value)}
                                >
                                    {l.value}. {l.label}
                                </FilterChip>
                            ))}
                        </FilterGroup>
                    )}

                    <FilterGroup label="Státusz">
                        <FilterChip
                            active={!filters.status}
                            onClick={() => handleStatusFilter('')}
                        >
                            Mind
                        </FilterChip>
                        {STATUS_CONFIG.map(
                            ({ value, label, icon: Icon, filterActive }) => (
                                <FilterChip
                                    key={value}
                                    active={filters.status === value}
                                    activeClass={`${filterActive} text-white shadow-sm`}
                                    onClick={() => handleStatusFilter(value)}
                                >
                                    <Icon className="size-3.5" />
                                    {label}
                                    <span className="font-normal opacity-75">
                                        {stats[value].toLocaleString()}
                                    </span>
                                </FilterChip>
                            ),
                        )}
                    </FilterGroup>

                    <FilterGroup label="Fontosság">
                        <FilterChip
                            active={filters.importance === null}
                            onClick={() => handleImportanceFilter(null)}
                        >
                            Mind
                        </FilterChip>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <FilterChip
                                key={n}
                                active={filters.importance === n}
                                activeClass="bg-amber-400 text-amber-950 shadow-sm"
                                onClick={() => handleImportanceFilter(n)}
                                title={`${n} csillag`}
                            >
                                {'★'.repeat(n)}
                            </FilterChip>
                        ))}
                    </FilterGroup>

                    {folders.length > 0 && (
                        <FilterGroup label="Mappa">
                            <FilterChip
                                active={filters.folder === null}
                                onClick={() => handleFolderFilter(null)}
                            >
                                Mind
                            </FilterChip>
                            {folders.map((f) => (
                                <FilterChip
                                    key={f.id}
                                    active={filters.folder === f.id}
                                    onClick={() => handleFolderFilter(f.id)}
                                >
                                    <FolderOpen className="size-3.5" />
                                    {f.name}
                                    <span className="font-normal opacity-75">
                                        {f.words_count}
                                    </span>
                                </FilterChip>
                            ))}
                        </FilterGroup>
                    )}

                    {customStats.total > 0 && (
                        <FilterGroup label="Forrás">
                            <FilterChip
                                active={customFilter === 'all'}
                                onClick={() => setCustomFilter('all')}
                            >
                                Minden szó
                            </FilterChip>
                            <FilterChip
                                active={customFilter === 'custom'}
                                onClick={() => setCustomFilter('custom')}
                            >
                                <Plus className="size-3.5" />
                                Saját szavak
                                <span className="font-normal opacity-75">
                                    {customStats.total}
                                </span>
                            </FilterChip>
                        </FilterGroup>
                    )}

                    {!search && (
                        <FilterGroup label="Betű">
                            <FilterChip
                                active={
                                    !filters.letter || filters.letter === 'ALL'
                                }
                                onClick={() => handleLetterClick('ALL')}
                            >
                                Összes
                            </FilterChip>
                            {LETTERS.map((letter) => {
                                const hasMarks = markedLetters.includes(letter);
                                const isActive = filters.letter === letter;

                                return (
                                    <FilterChip
                                        key={letter}
                                        active={isActive}
                                        onClick={() =>
                                            handleLetterClick(letter)
                                        }
                                    >
                                        {letter}
                                        {hasMarks && !isActive && (
                                            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-violet-500 opacity-80" />
                                        )}
                                    </FilterChip>
                                );
                            })}
                        </FilterGroup>
                    )}
                </div>

                {/* Folder dialog */}
                <Dialog
                    open={showFolderSheet}
                    onOpenChange={setShowFolderSheet}
                >
                    <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-sm">
                        <DialogHeader className="border-b px-4 py-3">
                            <DialogTitle>Mappák</DialogTitle>
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
                                                        handleDeleteFolder(f.id)
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

                {/* Word count */}
                <p className="text-sm text-muted-foreground">
                    {words.total.toLocaleString()} szó
                    {words.last_page > 1 && (
                        <span>
                            {' '}
                            &mdash; {words.current_page}. / {words.last_page}.
                            oldal
                        </span>
                    )}
                </p>

                {/* Hint banner */}
                <div className="flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-accent-foreground">
                    <Info className="size-5 shrink-0 text-violet-600 dark:text-violet-400" />
                    <p className="text-sm font-medium">
                        {flipMode
                            ? 'Fordított mód: a magyar jelentés látszik — kattints a szóra az angol megjelenítéséhez vagy mappa hozzáadásához!'
                            : 'Kattints bármelyik szóra a magyar jelentés megtekintéséhez vagy mappa hozzáadásához!'}
                    </p>
                </div>

                {/* Word list */}
                {unifiedList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <Search className="mb-3 size-10 opacity-30" />
                        <p className="font-medium">Nincs találat</p>
                        <p className="text-sm">
                            Próbálj más keresési feltételt.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
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
                    </div>
                )}

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
                                                ? 'bg-card text-foreground shadow-sm ring-1 ring-violet-300 hover:bg-accent dark:ring-violet-700'
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
                    }
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    {(() => {
                        const cw = customWords.find(
                            (w) => w.id === selectedCustomWordId,
                        );

                        if (!cw) {
                            return null;
                        }

                        return (
                            <>
                                <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-6 pt-5 pb-4">
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
                                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
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

                                    <div className="flex gap-2 border-t pt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setSelectedCustomWordId(null);
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
                                            onClick={() => {
                                                handleDeleteCustomWord(cw.id);
                                                setSelectedCustomWordId(null);
                                            }}
                                        >
                                            <Trash2 className="size-3.5" />
                                            Törlés
                                        </Button>
                                    </div>
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
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Saját szó szerkesztése</DialogTitle>
                    </DialogHeader>
                    <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-6 py-5">
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
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                    {selectedWord && (
                        <>
                            {/* Hero */}
                            <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-6 pt-5 pb-4">
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
                            <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
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
                                                variant="outline"
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
                                                Hozzáadás
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
            {/* Admin word edit modal */}
            {isAdmin && (
                <Dialog
                    open={editWordId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setEditWordId(null);
                            setEditWordErrors({});
                        }
                    }}
                >
                    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                        <DialogHeader className="border-b px-6 py-4">
                            <DialogTitle>Szó szerkesztése (Admin)</DialogTitle>
                        </DialogHeader>
                        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-6 py-5">
                            <WordFormFields
                                form={editWordForm}
                                onChange={setEditWordForm}
                                errors={editWordErrors}
                                autoFocus
                                afterWordSlot={
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
                                        className="w-full border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                    >
                                        {geminiLoading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Sparkles className="size-4" />
                                        )}
                                        Újratöltés Gemini AI-val
                                    </Button>
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
