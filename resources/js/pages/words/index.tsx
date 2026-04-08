import { Head, router } from '@inertiajs/react';
import {
    ArrowLeftRight,
    BookMarked,
    CheckCheck,
    Clock,
    FolderOpen,
    FolderPlus,
    Info,
    Layers,
    Mic,
    Pencil,
    Plus,
    Search,
    Trash2,
    Volume2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { destroy as destroyCustomWord, status as customWordStatus, store as storeCustomWord, update as updateCustomWord } from '@/routes/custom-words';
import { destroy, store, update } from '@/routes/folders';
import { update as folderWordUpdate } from '@/routes/folders/words';
import { importMethod as importFromWord } from '@/routes/flashcards/cards';
import { index, status } from '@/routes/words';

type WordStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | null;

interface Word {
    id: number;
    word: string;
    rank: number;
    meaning_hu: string | null;
    extra_meanings: string | null;
    synonyms: string | null;
    part_of_speech: string | null;
    form_base: string | null;
    verb_past: string | null;
    verb_past_participle: string | null;
    verb_present_participle: string | null;
    verb_third_person: string | null;
    is_irregular: number | null;
    noun_plural: string | null;
    adj_comparative: string | null;
    adj_superlative: string | null;
    example_en: string | null;
    example_hu: string | null;
    status: WordStatus;
}

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

interface CustomWord {
    id: number;
    word: string;
    meaning_hu: string | null;
    extra_meanings: string | null;
    synonyms: string | null;
    part_of_speech: string | null;
    example_en: string | null;
    example_hu: string | null;
    status: 'known' | 'learning' | 'saved' | 'pronunciation' | null;
    form_base: string | null;
    verb_past: string | null;
    verb_past_participle: string | null;
    verb_present_participle: string | null;
    verb_third_person: string | null;
    is_irregular: boolean | null;
    noun_plural: string | null;
    adj_comparative: string | null;
    adj_superlative: string | null;
}

type CustomWordFormData = {
    word: string;
    meaning_hu: string;
    extra_meanings: string;
    synonyms: string;
    part_of_speech: string;
    example_en: string;
    example_hu: string;
    form_base: string;
    verb_past: string;
    verb_past_participle: string;
    verb_present_participle: string;
    verb_third_person: string;
    is_irregular: boolean;
    noun_plural: string;
    adj_comparative: string;
    adj_superlative: string;
};

const EMPTY_CUSTOM_WORD_FORM: CustomWordFormData = {
    word: '', meaning_hu: '', extra_meanings: '', synonyms: '',
    part_of_speech: '', example_en: '', example_hu: '',
    form_base: '', verb_past: '', verb_past_participle: '',
    verb_present_participle: '', verb_third_person: '',
    is_irregular: false, noun_plural: '', adj_comparative: '', adj_superlative: '',
};

interface Props {
    words: PaginatedWords;
    filters: {
        search: string;
        letter: string;
        difficulty: string;
        status: string;
        folder: number | null;
        per_page: number;
    };
    stats: {
        total: number;
        known: number;
        learning: number;
        saved: number;
        pronunciation: number;
    };
    customWords: CustomWord[];
    customStats: { total: number; known: number; learning: number };
    markedPages: number[];
    markedLetters: string[];
    folders: Folder[];
    wordFolderIds: Record<number, number[]>;
    flashcardDecks: FlashcardDeck[];
}

const POS_LABELS: Record<string, string> = {
    verb: 'ige',
    noun: 'főnév',
    adj: 'melléknév',
    adv: 'határozószó',
    prep: 'elöljáró',
    conj: 'kötőszó',
    det: 'névelő',
    pron: 'névmás',
    num: 'számnév',
    interj: 'indulatszó',
};

const DIFFICULTIES = [
    { value: 'beginner', label: 'Kezdő', description: '1–2 000' },
    { value: 'intermediate', label: 'Középhaladó', description: '2 001–6 000' },
    { value: 'advanced', label: 'Haladó', description: '6 001–10 000' },
] as const;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function WordsIndex({
    words,
    filters,
    stats,
    customWords,
    customStats,
    markedPages,
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
    const [customWordForm, setCustomWordForm] = useState<CustomWordFormData>(EMPTY_CUSTOM_WORD_FORM);
    const [customWordErrors, setCustomWordErrors] = useState<Record<string, string>>({});
    const [selectedCustomWordId, setSelectedCustomWordId] = useState<number | null>(null);
    const [editCustomWordId, setEditCustomWordId] = useState<number | null>(null);
    const [editCustomWordForm, setEditCustomWordForm] = useState<CustomWordFormData>(EMPTY_CUSTOM_WORD_FORM);
    const [selectedDeckId, setSelectedDeckId] = useState<string>('');
    const [importingFlashcard, setImportingFlashcard] = useState(false);
    const [customImportSuccess, setCustomImportSuccess] = useState(false);
    const selectedWord =
        selectedWordId !== null
            ? (words.data.find((w) => w.id === selectedWordId) ?? null)
            : null;
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressPercent =
        stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;

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
        const hasParams = search.has('page') || search.has('per_page') || search.has('letter') || search.has('difficulty') || search.has('status') || search.has('search');

        if (!hasParams) {
            const saved = localStorage.getItem(STORAGE_KEY);

            if (saved) {
                const parsed = JSON.parse(saved);
                router.get(index(), parsed, { preserveScroll: false, preserveState: false, replace: true });
            }
        }
    }, []);

    const navigate = useCallback(
        (params: {
            search?: string;
            letter?: string;
            difficulty?: string;
            status?: string;
            folder?: number | null;
            page?: number;
            per_page?: number;
        }) => {
            const resolved = {
                search: params.search ?? filters.search,
                letter: params.letter !== undefined ? params.letter : filters.letter,
                difficulty: params.difficulty !== undefined ? params.difficulty : filters.difficulty,
                status: params.status !== undefined ? params.status : filters.status,
                folder: params.folder !== undefined ? params.folder : filters.folder,
                per_page: params.per_page !== undefined ? params.per_page : filters.per_page,
                page: params.page ?? 1,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
            router.get(index(), resolved, { preserveScroll: false, preserveState: true, replace: true });
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
        router.post(store(), { name }, {
            preserveScroll: true,
            preserveState: true,
            only: ['folders'],
            onSuccess: () => {
                setNewFolderName('');
                setShowNewFolderInput(false);
            },
        });
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

    function handleToggleWordFolder(wordId: number, folderId: number, inFolder: boolean) {
        const refreshWords = filters.folder !== null;

        router.patch(folderWordUpdate({ folder: folderId, word: wordId }), { in_folder: inFolder }, {
            preserveScroll: true,
            preserveState: true,
            only: refreshWords ? ['folders', 'wordFolderIds', 'words'] : ['folders', 'wordFolderIds'],
            onSuccess: () => {
                if (refreshWords && !inFolder) {
                    setSelectedWordId(null);
                }
            },
        });
    }

    function handleImportToFlashcard(wordId: number) {
        if (!selectedDeckId) return;
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
        router.patch(update(folderId), { name: name.trim() }, {
            preserveScroll: true,
            preserveState: true,
            only: ['folders'],
            onSuccess: () => {
                setEditFolderId(null);
                setEditFolderName('');
            },
        });
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
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            navigate({ search: value, letter: filters.letter, page: 1 });
        }, 350);
    }

    function handleLetterClick(letter: string) {
        setSearch('');
        navigate({ search: '', letter, page: 1 });
    }

    function handleDifficultyClick(difficulty: string) {
        setSearch('');
        navigate({ search: '', difficulty, letter: 'ALL', page: 1 });
    }

    function handleStatusFilter(statusValue: string) {
        navigate({ status: statusValue, page: 1 });
    }

    function speak(word: string) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    function handleStatus(word: Word, newStatus: WordStatus) {
        const nextStatus = word.status === newStatus ? null : newStatus;

        router.post(
            status(word.id),
            { status: newStatus },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['words', 'stats', 'flash'],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                optimistic: (props: any) => {
                    const prev = word.status;
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
                            known:
                                props.stats.known +
                                (nextStatus === 'known'
                                    ? 1
                                    : prev === 'known'
                                      ? -1
                                      : 0),
                            learning:
                                props.stats.learning +
                                (nextStatus === 'learning'
                                    ? 1
                                    : prev === 'learning'
                                      ? -1
                                      : 0),
                            saved:
                                props.stats.saved +
                                (nextStatus === 'saved'
                                    ? 1
                                    : prev === 'saved'
                                      ? -1
                                      : 0),
                            pronunciation:
                                props.stats.pronunciation +
                                (nextStatus === 'pronunciation'
                                    ? 1
                                    : prev === 'pronunciation'
                                      ? -1
                                      : 0),
                        },
                    };
                },
            },
        );
    }

    function handleAddCustomWord(e: React.FormEvent) {
        e.preventDefault();
        if (!customWordForm.word.trim()) {
            setCustomWordErrors({ word: 'A szó megadása kötelező.' });
            return;
        }
        const payload: Record<string, string | boolean | null> = {
            word: customWordForm.word.trim(),
            meaning_hu: customWordForm.meaning_hu.trim() || null,
            extra_meanings: customWordForm.extra_meanings.trim() || null,
            synonyms: customWordForm.synonyms.trim() || null,
            part_of_speech: customWordForm.part_of_speech || null,
            example_en: customWordForm.example_en.trim() || null,
            example_hu: customWordForm.example_hu.trim() || null,
        };
        if (customWordForm.part_of_speech === 'verb') {
            payload.form_base = customWordForm.form_base.trim() || null;
            payload.verb_past = customWordForm.verb_past.trim() || null;
            payload.verb_past_participle = customWordForm.verb_past_participle.trim() || null;
            payload.verb_present_participle = customWordForm.verb_present_participle.trim() || null;
            payload.verb_third_person = customWordForm.verb_third_person.trim() || null;
            payload.is_irregular = customWordForm.is_irregular;
        }
        if (customWordForm.part_of_speech === 'noun') {
            payload.noun_plural = customWordForm.noun_plural.trim() || null;
        }
        if (customWordForm.part_of_speech === 'adj') {
            payload.adj_comparative = customWordForm.adj_comparative.trim() || null;
            payload.adj_superlative = customWordForm.adj_superlative.trim() || null;
        }
        router.post(storeCustomWord(), payload, {
            preserveScroll: true,
            only: ['customWords', 'customStats', 'stats', 'flash'],
            onSuccess: () => {
                setCustomWordForm(EMPTY_CUSTOM_WORD_FORM);
                setShowAddCustomWord(false);
                setCustomWordErrors({});
            },
            onError: (e) => setCustomWordErrors(e),
        });
    }

    function handleCustomWordStatus(wordId: number, newStatus: 'known' | 'learning' | 'saved' | 'pronunciation', _currentStatus: string | null) {
        router.post(customWordStatus(wordId), { status: newStatus }, {
            preserveScroll: true,
            only: ['customWords', 'customStats', 'stats', 'flash'],
        });
    }

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

    return (
        <>
            <Head title="Top 10 000 angol szó" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4 pb-24 md:px-6 md:pt-6 md:pb-28">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold tracking-tight">
                            Top 10 000 angol szó
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Jelöld meg a szavakat, amelyeket már ismersz.
                        </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowAddCustomWord(true)} className="shrink-0 mt-1">
                        <Plus className="size-3.5" />
                        Saját szó
                        {customStats.total > 0 && (
                            <span className="ml-1 text-xs font-normal opacity-60">{customStats.total}</span>
                        )}
                    </Button>
                </div>

                {/* Add custom word dialog */}
                <Dialog open={showAddCustomWord} onOpenChange={(open) => { if (!open) { setShowAddCustomWord(false); setCustomWordErrors({}); setCustomWordForm(EMPTY_CUSTOM_WORD_FORM); } }}>
                    <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                        <DialogHeader className="border-b px-6 py-4">
                            <DialogTitle>Saját szó hozzáadása</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddCustomWord}>
                            <div className="max-h-[65vh] overflow-y-auto px-6 py-5 flex flex-col gap-4">
                                {/* Alap mezők */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Input placeholder="Angol szó *" value={customWordForm.word} onChange={(e) => setCustomWordForm({ ...customWordForm, word: e.target.value })} autoFocus />
                                        {customWordErrors.word && <p className="mt-1 text-xs text-destructive">{customWordErrors.word}</p>}
                                    </div>
                                    <Select value={customWordForm.part_of_speech} onValueChange={(v) => setCustomWordForm({ ...customWordForm, part_of_speech: v })}>
                                        <SelectTrigger className="w-36">
                                            <SelectValue placeholder="Szófaj" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(POS_LABELS).map(([val, label]) => (
                                                <SelectItem key={val} value={val}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Input placeholder="Magyar jelentés" value={customWordForm.meaning_hu} onChange={(e) => setCustomWordForm({ ...customWordForm, meaning_hu: e.target.value })} />
                                <Input placeholder="További jelentések (pl. alternatív fordítások)" value={customWordForm.extra_meanings} onChange={(e) => setCustomWordForm({ ...customWordForm, extra_meanings: e.target.value })} />
                                <Input placeholder="Szinonimák (pl. consent, accept)" value={customWordForm.synonyms} onChange={(e) => setCustomWordForm({ ...customWordForm, synonyms: e.target.value })} />
                                <Input placeholder="Példamondat (angol)" value={customWordForm.example_en} onChange={(e) => setCustomWordForm({ ...customWordForm, example_en: e.target.value })} />
                                <Input placeholder="Példamondat (magyar)" value={customWordForm.example_hu} onChange={(e) => setCustomWordForm({ ...customWordForm, example_hu: e.target.value })} />

                                {/* Ige mezők */}
                                {customWordForm.part_of_speech === 'verb' && (
                                    <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Igealakok</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs text-muted-foreground">Alap (to ...)</label>
                                                <Input placeholder="pl. agree" value={customWordForm.form_base} onChange={(e) => setCustomWordForm({ ...customWordForm, form_base: e.target.value })} className="mt-1" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Múlt idő</label>
                                                <Input placeholder="pl. agreed" value={customWordForm.verb_past} onChange={(e) => setCustomWordForm({ ...customWordForm, verb_past: e.target.value })} className="mt-1" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Befejezett igenév</label>
                                                <Input placeholder="pl. agreed" value={customWordForm.verb_past_participle} onChange={(e) => setCustomWordForm({ ...customWordForm, verb_past_participle: e.target.value })} className="mt-1" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Folyamatos (-ing)</label>
                                                <Input placeholder="pl. agreeing" value={customWordForm.verb_present_participle} onChange={(e) => setCustomWordForm({ ...customWordForm, verb_present_participle: e.target.value })} className="mt-1" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">E/3 jelen</label>
                                                <Input placeholder="pl. agrees" value={customWordForm.verb_third_person} onChange={(e) => setCustomWordForm({ ...customWordForm, verb_third_person: e.target.value })} className="mt-1" />
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                            <input type="checkbox" checked={customWordForm.is_irregular} onChange={(e) => setCustomWordForm({ ...customWordForm, is_irregular: e.target.checked })} className="rounded" />
                                            Rendhagyó ige
                                        </label>
                                    </div>
                                )}

                                {/* Főnév mezők */}
                                {customWordForm.part_of_speech === 'noun' && (
                                    <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Főnév alakok</p>
                                        <div>
                                            <label className="text-xs text-muted-foreground">Többes szám</label>
                                            <Input placeholder="pl. agreements" value={customWordForm.noun_plural} onChange={(e) => setCustomWordForm({ ...customWordForm, noun_plural: e.target.value })} className="mt-1" />
                                        </div>
                                    </div>
                                )}

                                {/* Melléknév mezők */}
                                {customWordForm.part_of_speech === 'adj' && (
                                    <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fokozás</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs text-muted-foreground">Középfok</label>
                                                <Input placeholder="pl. better" value={customWordForm.adj_comparative} onChange={(e) => setCustomWordForm({ ...customWordForm, adj_comparative: e.target.value })} className="mt-1" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-muted-foreground">Felsőfok</label>
                                                <Input placeholder="pl. best" value={customWordForm.adj_superlative} onChange={(e) => setCustomWordForm({ ...customWordForm, adj_superlative: e.target.value })} className="mt-1" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2 border-t px-6 py-4">
                                <Button type="submit" className="flex-1" disabled={!customWordForm.word.trim()}>Mentés</Button>
                                <Button type="button" variant="outline" onClick={() => { setShowAddCustomWord(false); setCustomWordErrors({}); setCustomWordForm(EMPTY_CUSTOM_WORD_FORM); }}>Mégse</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Progress */}
                <div className="rounded-xl border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Haladás</span>
                        <span className="text-muted-foreground">
                            {stats.known.toLocaleString()} /{' '}
                            {stats.total.toLocaleString()} ({progressPercent}%)
                        </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-2.5 rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <CheckCheck className="size-3 text-green-500" />{' '}
                            Tudom: {stats.known.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="size-3 text-blue-500" />{' '}
                            Folyamatban: {stats.learning.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                            <BookMarked className="size-3 text-orange-500" />{' '}
                            Később: {stats.saved.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                            <Mic className="size-3 text-violet-500" /> Kiejtés:{' '}
                            {stats.pronunciation.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Keresés..."
                        className="pr-9 pl-9"
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
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

                {/* Per page */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                        Oldalanként:
                    </span>
                    {[20, 50, 100, 200, 300, 400, 500, 1000].map((n) => (
                        <Button
                            key={n}
                            size="sm"
                            variant={
                                filters.per_page === n ? 'default' : 'outline'
                            }
                            onClick={() => navigate({ per_page: n, page: 1 })}
                        >
                            {n}
                        </Button>
                    ))}
                </div>

                {/* Difficulty filter */}
                {!search && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant={
                                !filters.difficulty ? 'default' : 'outline'
                            }
                            onClick={() => handleDifficultyClick('')}
                        >
                            Minden szint
                        </Button>
                        {DIFFICULTIES.map((d) => (
                            <Button
                                key={d.value}
                                size="sm"
                                variant={
                                    filters.difficulty === d.value
                                        ? 'default'
                                        : 'outline'
                                }
                                onClick={() => handleDifficultyClick(d.value)}
                                title={`Rank ${d.description}`}
                            >
                                {d.label}
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    {d.description}
                                </span>
                            </Button>
                        ))}
                    </div>
                )}

                {/* Status filter */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant={!filters.status ? 'default' : 'outline'}
                        onClick={() => handleStatusFilter('')}
                    >
                        Minden státusz
                    </Button>
                    <Button
                        size="sm"
                        variant={filters.status === 'known' ? 'default' : 'outline'}
                        className={filters.status === 'known' ? 'bg-green-600 hover:bg-green-700' : 'hover:border-green-500 hover:text-green-700'}
                        onClick={() => handleStatusFilter('known')}
                    >
                        <CheckCheck className="size-3.5" />
                        Tudom
                        <span className="text-xs font-normal opacity-75">{stats.known.toLocaleString()}</span>
                    </Button>
                    <Button
                        size="sm"
                        variant={filters.status === 'learning' ? 'default' : 'outline'}
                        className={filters.status === 'learning' ? 'bg-blue-600 hover:bg-blue-700' : 'hover:border-blue-500 hover:text-blue-700'}
                        onClick={() => handleStatusFilter('learning')}
                    >
                        <Clock className="size-3.5" />
                        Tanulom
                        <span className="text-xs font-normal opacity-75">{stats.learning.toLocaleString()}</span>
                    </Button>
                    <Button
                        size="sm"
                        variant={filters.status === 'saved' ? 'default' : 'outline'}
                        className={filters.status === 'saved' ? 'bg-orange-500 hover:bg-orange-600' : 'hover:border-orange-500 hover:text-orange-700'}
                        onClick={() => handleStatusFilter('saved')}
                    >
                        <BookMarked className="size-3.5" />
                        Később
                        <span className="text-xs font-normal opacity-75">{stats.saved.toLocaleString()}</span>
                    </Button>
                    <Button
                        size="sm"
                        variant={filters.status === 'pronunciation' ? 'default' : 'outline'}
                        className={filters.status === 'pronunciation' ? 'bg-violet-600 hover:bg-violet-700' : 'hover:border-violet-500 hover:text-violet-700'}
                        onClick={() => handleStatusFilter('pronunciation')}
                    >
                        <Mic className="size-3.5" />
                        Kiejtés
                        <span className="text-xs font-normal opacity-75">{stats.pronunciation.toLocaleString()}</span>
                    </Button>
                </div>

                {/* Active folder chip */}
                {filters.folder && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Mappa:</span>
                        <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
                            <FolderOpen className="size-3.5" />
                            {folders.find((f) => f.id === filters.folder)?.name ?? 'Mappa'}
                            <button
                                onClick={() => handleFolderFilter(null)}
                                className="ml-0.5 rounded-full hover:opacity-70"
                                title="Szűrő törlése"
                            >
                                <X className="size-3.5" />
                            </button>
                        </span>
                    </div>
                )}

                {/* Folder dialog */}
                <Dialog open={showFolderSheet} onOpenChange={setShowFolderSheet}>
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
                                <div key={f.id} className="group flex items-center border-t px-4">
                                    {editFolderId === f.id ? (
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                handleRenameFolder(f.id, editFolderName);
                                            }}
                                            className="flex flex-1 items-center gap-2 py-2"
                                        >
                                            <Input
                                                autoFocus
                                                value={editFolderName}
                                                onChange={(e) => setEditFolderName(e.target.value)}
                                                className="h-8 flex-1"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setEditFolderId(null);
                                                    }
                                                }}
                                            />
                                            <Button size="sm" type="submit" disabled={!editFolderName.trim()}>
                                                Mentés
                                            </Button>
                                            <Button size="sm" variant="ghost" type="button" onClick={() => setEditFolderId(null)}>
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
                                                <span className="flex-1 truncate text-left">{f.name}</span>
                                                <span className="text-xs text-muted-foreground">{f.words_count} szó</span>
                                            </button>
                                            <div className="flex shrink-0 gap-1 pl-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    onClick={() => {
                                                        setEditFolderId(f.id);
                                                        setEditFolderName(f.name);
                                                    }}
                                                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                                    title="Átnevezés"
                                                >
                                                    <Pencil className="size-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFolder(f.id)}
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
                                <form onSubmit={handleNewFolderSubmit} className="flex flex-col gap-2">
                                    <Input
                                        autoFocus
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Mappa neve..."
                                        onKeyDown={handleNewFolderKeyDown}
                                    />
                                    <div className="flex gap-2">
                                        <Button type="submit" className="flex-1" disabled={!newFolderName.trim()}>
                                            <Plus className="size-4" />
                                            Létrehozás
                                        </Button>
                                        <Button variant="outline" type="button" onClick={handleCancelNewFolder}>
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

                {/* Letter navigation */}
                {!search && (
                    <div className="flex flex-wrap gap-1">
                        <Button
                            size="sm"
                            variant={
                                !filters.letter || filters.letter === 'ALL'
                                    ? 'default'
                                    : 'outline'
                            }
                            onClick={() => handleLetterClick('ALL')}
                        >
                            Összes
                        </Button>
                        {LETTERS.map((letter) => {
                            const hasMarks = markedLetters.includes(letter);
                            const isActive = filters.letter === letter;
                            return (
                                <Button
                                    key={letter}
                                    size="sm"
                                    variant={isActive ? 'default' : 'outline'}
                                    onClick={() => handleLetterClick(letter)}
                                    className="relative"
                                >
                                    {letter}
                                    {hasMarks && !isActive && (
                                        <span className="absolute -top-1 -right-1 flex h-2 w-2 items-center justify-center">
                                            <span className="size-1.5 rounded-full bg-primary opacity-70" />
                                        </span>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                )}

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
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                    <Info className="size-5 shrink-0" />
                    <p className="text-sm font-medium">
                        {flipMode
                            ? 'Fordított mód: a magyar jelentés látszik — kattints a szóra az angol megjelenítéséhez vagy mappa hozzáadásához!'
                            : 'Kattints bármelyik szóra a magyar jelentés megtekintéséhez vagy mappa hozzáadásához!'}
                    </p>
                </div>

                {/* Word list */}
                {words.data.length === 0 && customWords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <Search className="mb-3 size-10 opacity-30" />
                        <p className="font-medium">Nincs találat</p>
                        <p className="text-sm">
                            Próbálj más keresési feltételt.
                        </p>
                    </div>
                ) : (
                    <div className="rounded-xl border">
                        <ul className="divide-y">
                            {customWords.length > 0 && (
                                <>
                                    <li className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">Saját szavak</li>
                                    {customWords.map((word) => (
                                        <li
                                            key={`custom-${word.id}`}
                                            className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                                                word.status === 'known' ? 'bg-green-50 dark:bg-green-950/20'
                                                : word.status === 'learning' ? 'bg-blue-50 dark:bg-blue-950/20'
                                                : word.status === 'saved' ? 'bg-orange-50 dark:bg-orange-950/20'
                                                : word.status === 'pronunciation' ? 'bg-violet-50 dark:bg-violet-950/20'
                                                : ''
                                            }`}
                                        >
                                            <button
                                                onClick={() => setSelectedCustomWordId(word.id)}
                                                className={`flex-1 text-left underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70 ${
                                                    flipMode ? 'text-sm font-normal' : 'font-medium'
                                                } ${
                                                    word.status === 'known' ? 'text-green-700 decoration-green-400 dark:text-green-400'
                                                    : word.status === 'learning' ? 'text-blue-700 decoration-blue-400 dark:text-blue-400'
                                                    : word.status === 'saved' ? 'text-orange-700 decoration-orange-400 dark:text-orange-400'
                                                    : word.status === 'pronunciation' ? 'text-violet-700 decoration-violet-400 dark:text-violet-400'
                                                    : 'decoration-muted-foreground/40'
                                                }`}
                                            >
                                                {flipMode
                                                    ? (word.meaning_hu ?? <span className="italic text-muted-foreground">(nincs fordítás)</span>)
                                                    : word.word}
                                                <Info className="mb-0.5 ml-1 inline size-3 opacity-40" />
                                            </button>
                                            <button
                                                onClick={() => speak(word.word)}
                                                title="Felolvasás"
                                                className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                            >
                                                <Volume2 className="size-3.5" />
                                            </button>
                                            <div className="flex shrink-0 gap-1">
                                                {([
                                                    { s: 'known' as const, Icon: CheckCheck, active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', hover: 'hover:bg-green-100 hover:text-green-700', label: 'Tudom' },
                                                    { s: 'learning' as const, Icon: Clock, active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', hover: 'hover:bg-blue-100 hover:text-blue-700', label: 'Tanulom' },
                                                    { s: 'saved' as const, Icon: BookMarked, active: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', hover: 'hover:bg-orange-100 hover:text-orange-700', label: 'Később' },
                                                    { s: 'pronunciation' as const, Icon: Mic, active: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', hover: 'hover:bg-violet-100 hover:text-violet-700', label: 'Kiejtés' },
                                                ]).map(({ s, Icon, active, hover, label }) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => handleCustomWordStatus(word.id, s, word.status ?? null)}
                                                        title={label}
                                                        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-all ${word.status === s ? active : `bg-secondary text-muted-foreground ${hover}`}`}
                                                    >
                                                        <Icon className="size-4" />
                                                        <span className="hidden sm:inline">{label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </li>
                                    ))}
                                    {words.data.length > 0 && (
                                        <li className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">Top 10 000 szó</li>
                                    )}
                                </>
                            )}
                            {words.data.map((word) => (
                                <li
                                    key={word.id}
                                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                                        word.status === 'known'
                                            ? 'bg-green-50 dark:bg-green-950/20'
                                            : word.status === 'learning'
                                              ? 'bg-blue-50 dark:bg-blue-950/20'
                                              : word.status === 'saved'
                                                ? 'bg-orange-50 dark:bg-orange-950/20'
                                                : word.status ===
                                                    'pronunciation'
                                                  ? 'bg-violet-50 dark:bg-violet-950/20'
                                                  : ''
                                    }`}
                                >
                                    <button
                                        onClick={() =>
                                            setSelectedWordId(word.id)
                                        }
                                        className={`flex-1 text-left underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70 ${
                                            flipMode
                                                ? 'text-sm font-normal'
                                                : 'font-medium'
                                        } ${
                                            word.status === 'known'
                                                ? 'text-green-700 decoration-green-400 dark:text-green-400'
                                                : word.status === 'learning'
                                                  ? 'text-blue-700 decoration-blue-400 dark:text-blue-400'
                                                  : word.status === 'saved'
                                                    ? 'text-orange-700 decoration-orange-400 dark:text-orange-400'
                                                    : word.status ===
                                                        'pronunciation'
                                                      ? 'text-violet-700 decoration-violet-400 dark:text-violet-400'
                                                      : 'decoration-muted-foreground/40'
                                        }`}
                                    >
                                        {flipMode
                                            ? (word.meaning_hu ?? (
                                                  <span className="text-muted-foreground italic">
                                                      (nincs fordítás)
                                                  </span>
                                              ))
                                            : word.word}
                                        <Info className="mb-0.5 ml-1 inline size-3 opacity-40" />
                                    </button>
                                    <button
                                        onClick={() => speak(word.word)}
                                        title="Felolvasás"
                                        className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <Volume2 className="size-3.5" />
                                    </button>
                                    <div className="flex shrink-0 gap-1">
                                        <button
                                            onClick={() =>
                                                handleStatus(word, 'known')
                                            }
                                            title="Tudom"
                                            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-all ${
                                                word.status === 'known'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-green-100 hover:text-green-700'
                                            }`}
                                        >
                                            <CheckCheck className="size-4" />
                                            <span className="hidden sm:inline">
                                                Tudom
                                            </span>
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleStatus(word, 'learning')
                                            }
                                            title="Folyamatban"
                                            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-all ${
                                                word.status === 'learning'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-blue-100 hover:text-blue-700'
                                            }`}
                                        >
                                            <Clock className="size-4" />
                                            <span className="hidden sm:inline">
                                                Tanulom
                                            </span>
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleStatus(word, 'saved')
                                            }
                                            title="Mentés későbbre"
                                            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-all ${
                                                word.status === 'saved'
                                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-orange-100 hover:text-orange-700'
                                            }`}
                                        >
                                            <BookMarked className="size-4" />
                                            <span className="hidden sm:inline">
                                                Később
                                            </span>
                                        </button>
                                        <button
                                            onClick={() =>
                                                handleStatus(
                                                    word,
                                                    'pronunciation',
                                                )
                                            }
                                            title="Kiejtési nehézség"
                                            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-all ${
                                                word.status === 'pronunciation'
                                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400'
                                                    : 'bg-secondary text-muted-foreground hover:bg-violet-100 hover:text-violet-700'
                                            }`}
                                        >
                                            <Mic className="size-4" />
                                            <span className="hidden sm:inline">
                                                Kiejtés
                                            </span>
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Pagination */}
                {words.last_page > 1 && (
                    <div className="flex flex-wrap justify-center gap-1">
                        {words.links.map((link, i) => {
                            const pageNum = link.url
                                ? Number(
                                      new URL(link.url).searchParams.get(
                                          'page',
                                      ) ?? 1,
                                  )
                                : null;
                            const hasMarks =
                                pageNum !== null &&
                                !link.active &&
                                markedPages.includes(pageNum);

                            return (
                                <button
                                    key={i}
                                    disabled={!link.url}
                                    onClick={() => {
                                        if (link.url && pageNum)
                                            navigate({ page: pageNum });
                                    }}
                                    className={`relative rounded-md px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                        link.active
                                            ? 'bg-primary font-medium text-primary-foreground'
                                            : hasMarks
                                              ? 'border border-green-400 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-700 dark:bg-green-950/30 dark:text-green-300'
                                              : 'border hover:bg-accent'
                                    }`}
                                    dangerouslySetInnerHTML={{
                                        __html: link.label,
                                    }}
                                />
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
            <Dialog open={selectedCustomWordId !== null} onOpenChange={(open) => { if (!open) setSelectedCustomWordId(null); }}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
                    {(() => {
                        const cw = customWords.find((w) => w.id === selectedCustomWordId);
                        if (!cw) return null;
                        return (
                            <>
                                <div className="border-b bg-gradient-to-br from-primary/8 to-primary/3 px-6 pb-4 pt-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">saját szó</span>
                                                {cw.part_of_speech && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{cw.part_of_speech}</span>}
                                            </div>
                                            <DialogTitle asChild>
                                                <h2 className="text-3xl font-bold tracking-tight">{cw.word}</h2>
                                            </DialogTitle>
                                        </div>
                                        <button onClick={() => speak(cw.word)} title="Felolvasás" className="mt-1 shrink-0 rounded-full bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground">
                                            <Volume2 className="size-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
                                    {cw.meaning_hu && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Magyar jelentés</p>
                                            <p className="text-lg font-semibold leading-snug">{cw.meaning_hu}</p>
                                            {cw.extra_meanings && (
                                                <p className="mt-1 text-sm text-muted-foreground">{cw.extra_meanings}</p>
                                            )}
                                        </div>
                                    )}
                                    {cw.synonyms && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Szinonimák</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {cw.synonyms.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                                                    <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {cw.part_of_speech === 'verb' && cw.verb_past && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Igealakok</p>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {([
                                                    { label: 'Alap', value: cw.form_base },
                                                    { label: 'Múlt idő', value: cw.verb_past },
                                                    { label: 'Befejezett igenév', value: cw.verb_past_participle },
                                                    { label: 'Folyamatos (-ing)', value: cw.verb_present_participle },
                                                    { label: 'E/3 jelen', value: cw.verb_third_person },
                                                ] as const).filter(({ value }) => value).map(({ label, value }) => (
                                                    <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground">{label}</p>
                                                        <p className="font-semibold">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {cw.part_of_speech === 'noun' && cw.noun_plural && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Többes szám</p>
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                    <p className="text-[10px] text-muted-foreground">Egyes szám</p>
                                                    <p className="font-semibold">{cw.form_base ?? cw.word}</p>
                                                </div>
                                                <span className="text-muted-foreground">→</span>
                                                <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                    <p className="text-[10px] text-muted-foreground">Többes szám</p>
                                                    <p className="font-semibold">{cw.noun_plural}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {cw.part_of_speech === 'adj' && cw.adj_comparative && (
                                        <div className="rounded-xl border bg-card px-4 py-3.5">
                                            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fokozás</p>
                                            <div className="flex gap-2">
                                                {cw.adj_comparative && (
                                                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground">Középfok</p>
                                                        <p className="font-semibold">{cw.adj_comparative}</p>
                                                    </div>
                                                )}
                                                {cw.adj_superlative && (
                                                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground">Felsőfok</p>
                                                        <p className="font-semibold">{cw.adj_superlative}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {(cw.example_en || cw.example_hu) && (
                                        <div className="rounded-xl border-l-4 border-primary/40 bg-muted/30 px-4 py-3.5">
                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Példamondat</p>
                                            {cw.example_en && <p className="text-sm font-medium italic">"{cw.example_en}"</p>}
                                            {cw.example_hu && <p className="mt-1 text-sm text-muted-foreground italic">"{cw.example_hu}"</p>}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { s: 'known' as const, label: 'Tudom', icon: CheckCheck, active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', hover: 'hover:bg-green-50 hover:text-green-700' },
                                            { s: 'learning' as const, label: 'Tanulom', icon: Clock, active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', hover: 'hover:bg-blue-50 hover:text-blue-700' },
                                            { s: 'saved' as const, label: 'Később', icon: BookMarked, active: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', hover: 'hover:bg-orange-50 hover:text-orange-700' },
                                            { s: 'pronunciation' as const, label: 'Kiejtés', icon: Mic, active: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', hover: 'hover:bg-violet-50 hover:text-violet-700' },
                                        ] as const).map(({ s, label, icon: Icon, active, hover }) => (
                                            <button key={s} onClick={() => handleCustomWordStatus(cw.id, s, cw.status ?? null)}
                                                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${cw.status === s ? active : `bg-secondary text-muted-foreground ${hover}`}`}>
                                                <Icon className="size-4" /> {label}
                                            </button>
                                        ))}
                                    </div>
                                    {flashcardDecks.length > 0 && (
                                        <div>
                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Flashcard deckhez adás</p>
                                            <div className="flex gap-2">
                                                <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                                    <SelectTrigger className="h-9 flex-1 text-sm">
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
                                                <Button
                                                    size="sm"
                                                    variant={customImportSuccess ? 'default' : 'outline'}
                                                    disabled={!selectedDeckId || importingFlashcard}
                                                    onClick={() => {
                                                        if (!selectedDeckId) return;
                                                        setImportingFlashcard(true);
                                                        setCustomImportSuccess(false);
                                                        router.post(
                                                            importFromWord(Number(selectedDeckId)).url,
                                                            { custom_word_id: cw.id },
                                                            {
                                                                preserveScroll: true,
                                                                onSuccess: () => {
                                                                    setCustomImportSuccess(true);
                                                                    setTimeout(() => setCustomImportSuccess(false), 2500);
                                                                },
                                                                onFinish: () => setImportingFlashcard(false),
                                                            },
                                                        );
                                                    }}
                                                >
                                                    <Layers className="size-4 mr-1.5" />
                                                    {customImportSuccess ? 'Hozzáadva!' : 'Hozzáadás'}
                                                </Button>
                                            </div>
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
                                                setEditCustomWordForm({
                                                    word: cw.word,
                                                    meaning_hu: cw.meaning_hu ?? '',
                                                    extra_meanings: cw.extra_meanings ?? '',
                                                    synonyms: cw.synonyms ?? '',
                                                    part_of_speech: cw.part_of_speech ?? '',
                                                    example_en: cw.example_en ?? '',
                                                    example_hu: cw.example_hu ?? '',
                                                    form_base: cw.form_base ?? '',
                                                    verb_past: cw.verb_past ?? '',
                                                    verb_past_participle: cw.verb_past_participle ?? '',
                                                    verb_present_participle: cw.verb_present_participle ?? '',
                                                    verb_third_person: cw.verb_third_person ?? '',
                                                    is_irregular: cw.is_irregular ?? false,
                                                    noun_plural: cw.noun_plural ?? '',
                                                    adj_comparative: cw.adj_comparative ?? '',
                                                    adj_superlative: cw.adj_superlative ?? '',
                                                });
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
            <Dialog open={editCustomWordId !== null} onOpenChange={(open) => { if (!open) setEditCustomWordId(null); }}>
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Saját szó szerkesztése</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[65vh] overflow-y-auto px-6 py-5 flex flex-col gap-4">
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input placeholder="Angol szó *" value={editCustomWordForm.word} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, word: e.target.value })} autoFocus />
                            </div>
                            <Select value={editCustomWordForm.part_of_speech} onValueChange={(v) => setEditCustomWordForm({ ...editCustomWordForm, part_of_speech: v })}>
                                <SelectTrigger className="w-36">
                                    <SelectValue placeholder="Szófaj" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(POS_LABELS).map(([val, label]) => (
                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Input placeholder="Magyar jelentés" value={editCustomWordForm.meaning_hu} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, meaning_hu: e.target.value })} />
                        <Input placeholder="További jelentések" value={editCustomWordForm.extra_meanings} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, extra_meanings: e.target.value })} />
                        <Input placeholder="Szinonimák (pl. consent, accept)" value={editCustomWordForm.synonyms} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, synonyms: e.target.value })} />
                        <Input placeholder="Példamondat (angol)" value={editCustomWordForm.example_en} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, example_en: e.target.value })} />
                        <Input placeholder="Példamondat (magyar)" value={editCustomWordForm.example_hu} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, example_hu: e.target.value })} />

                        {editCustomWordForm.part_of_speech === 'verb' && (
                            <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Igealakok</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Alap (to ...)</label>
                                        <Input placeholder="pl. agree" value={editCustomWordForm.form_base} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, form_base: e.target.value })} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Múlt idő</label>
                                        <Input placeholder="pl. agreed" value={editCustomWordForm.verb_past} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, verb_past: e.target.value })} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Befejezett igenév</label>
                                        <Input placeholder="pl. agreed" value={editCustomWordForm.verb_past_participle} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, verb_past_participle: e.target.value })} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Folyamatos (-ing)</label>
                                        <Input placeholder="pl. agreeing" value={editCustomWordForm.verb_present_participle} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, verb_present_participle: e.target.value })} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">E/3 jelen</label>
                                        <Input placeholder="pl. agrees" value={editCustomWordForm.verb_third_person} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, verb_third_person: e.target.value })} className="mt-1" />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                    <input type="checkbox" checked={editCustomWordForm.is_irregular} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, is_irregular: e.target.checked })} className="rounded" />
                                    Rendhagyó ige
                                </label>
                            </div>
                        )}

                        {editCustomWordForm.part_of_speech === 'noun' && (
                            <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Főnév alakok</p>
                                <div>
                                    <label className="text-xs text-muted-foreground">Többes szám</label>
                                    <Input placeholder="pl. agreements" value={editCustomWordForm.noun_plural} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, noun_plural: e.target.value })} className="mt-1" />
                                </div>
                            </div>
                        )}

                        {editCustomWordForm.part_of_speech === 'adj' && (
                            <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fokozás</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Középfok</label>
                                        <Input placeholder="pl. better" value={editCustomWordForm.adj_comparative} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, adj_comparative: e.target.value })} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Felsőfok</label>
                                        <Input placeholder="pl. best" value={editCustomWordForm.adj_superlative} onChange={(e) => setEditCustomWordForm({ ...editCustomWordForm, adj_superlative: e.target.value })} className="mt-1" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 border-t px-6 py-4">
                        <Button className="flex-1" disabled={!editCustomWordForm.word.trim()} onClick={() => editCustomWordId !== null && handleSaveEditCustomWord(editCustomWordId)}>
                            Mentés
                        </Button>
                        <Button variant="outline" onClick={() => setEditCustomWordId(null)}>
                            Mégse
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Word detail modal */}
            <Dialog
                open={selectedWord !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedWordId(null);
                }}
            >
                <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                    {selectedWord && (
                        <>
                            {/* Hero */}
                            <div className="border-b bg-gradient-to-br from-primary/8 to-primary/3 px-6 pb-4 pt-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                #{selectedWord.rank}
                                            </span>
                                            {selectedWord.part_of_speech && (
                                                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                                                    {POS_LABELS[selectedWord.part_of_speech] ?? selectedWord.part_of_speech}
                                                </span>
                                            )}
                                            {selectedWord.is_irregular === 1 && (
                                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                    rendhagyó
                                                </span>
                                            )}
                                        </div>
                                        <DialogTitle asChild>
                                            <h2 className="text-3xl font-bold tracking-tight">
                                                {flipMode
                                                    ? (selectedWord.meaning_hu ?? <span className="italic text-muted-foreground">nincs fordítás</span>)
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
                                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {flipMode ? 'Angol' : 'Magyar jelentés'}
                                    </p>
                                    {flipMode ? (
                                        <p className="flex items-center gap-2 text-lg font-semibold">
                                            {selectedWord.word}
                                            <button
                                                onClick={() => speak(selectedWord.word)}
                                                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                            >
                                                <Volume2 className="size-3.5" />
                                            </button>
                                        </p>
                                    ) : selectedWord.meaning_hu ? (
                                        <>
                                            <p className="text-lg font-semibold leading-snug">{selectedWord.meaning_hu}</p>
                                            {selectedWord.extra_meanings && (
                                                <p className="mt-1 text-sm text-muted-foreground">{selectedWord.extra_meanings}</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="italic text-muted-foreground">Nincs fordítás megadva</p>
                                    )}
                                </div>

                                {/* Igealakok */}
                                {selectedWord.part_of_speech === 'verb' && selectedWord.verb_past && (
                                    <div className="rounded-xl border bg-card px-4 py-3.5">
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Igealakok</p>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {([
                                                { label: 'Alap', value: selectedWord.form_base },
                                                { label: 'Múlt idő', value: selectedWord.verb_past },
                                                { label: 'Befejezett igenév', value: selectedWord.verb_past_participle },
                                                { label: 'Folyamatos (-ing)', value: selectedWord.verb_present_participle },
                                                { label: 'E/3 jelen', value: selectedWord.verb_third_person },
                                            ] as const).map(({ label, value }) => (
                                                <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
                                                    <p className="text-[10px] text-muted-foreground">{label}</p>
                                                    <p className="font-semibold">{value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Többes szám */}
                                {selectedWord.part_of_speech === 'noun' && selectedWord.noun_plural && (
                                    <div className="rounded-xl border bg-card px-4 py-3.5">
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Többes szám</p>
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">Egyes szám</p>
                                                <p className="font-semibold">{selectedWord.form_base}</p>
                                            </div>
                                            <span className="text-muted-foreground">→</span>
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">Többes szám</p>
                                                <p className="font-semibold">{selectedWord.noun_plural}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Fokozás */}
                                {selectedWord.part_of_speech === 'adj' && selectedWord.adj_comparative && (
                                    <div className="rounded-xl border bg-card px-4 py-3.5">
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fokozás</p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">Alapfok</p>
                                                <p className="font-semibold">{selectedWord.form_base}</p>
                                            </div>
                                            <span className="text-muted-foreground">→</span>
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">Középfok</p>
                                                <p className="font-semibold">{selectedWord.adj_comparative}</p>
                                            </div>
                                            <span className="text-muted-foreground">→</span>
                                            <div className="rounded-lg bg-muted/50 px-3 py-2">
                                                <p className="text-[10px] text-muted-foreground">Felsőfok</p>
                                                <p className="font-semibold">{selectedWord.adj_superlative}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Szinonimák */}
                                {selectedWord.synonyms && (
                                    <div>
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Szinonimák</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedWord.synonyms.split(',').map((s) => (
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
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Példamondat</p>
                                        <p className="text-sm font-medium italic">"{selectedWord.example_en}"</p>
                                        {selectedWord.example_hu && (
                                            <p className="mt-1 text-sm text-muted-foreground">"{selectedWord.example_hu}"</p>
                                        )}
                                    </div>
                                )}

                                {/* Státusz */}
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { s: 'known' as WordStatus, label: 'Tudom', icon: CheckCheck, active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', hover: 'hover:bg-green-50 hover:text-green-700' },
                                        { s: 'learning' as WordStatus, label: 'Tanulom', icon: Clock, active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', hover: 'hover:bg-blue-50 hover:text-blue-700' },
                                        { s: 'saved' as WordStatus, label: 'Később', icon: BookMarked, active: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400', hover: 'hover:bg-orange-50 hover:text-orange-700' },
                                        { s: 'pronunciation' as WordStatus, label: 'Kiejtés', icon: Mic, active: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400', hover: 'hover:bg-violet-50 hover:text-violet-700' },
                                    ] as const).map(({ s, label, icon: Icon, active, hover }) => (
                                        <button
                                            key={s}
                                            onClick={() => handleStatus(selectedWord, s)}
                                            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                                selectedWord.status === s
                                                    ? active
                                                    : `bg-secondary text-muted-foreground ${hover}`
                                            }`}
                                        >
                                            <Icon className="size-4" /> {label}
                                        </button>
                                    ))}
                                </div>

                                {/* Mappák */}
                                {folders.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mappák</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {folders.map((f) => {
                                                const inFolder = (wordFolderIds[selectedWord.id] ?? []).includes(f.id);

                                                return (
                                                    <button
                                                        key={f.id}
                                                        onClick={() => handleToggleWordFolder(selectedWord.id, f.id, !inFolder)}
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
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Flashcard deckhez adás</p>
                                        <div className="flex gap-2">
                                            <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                                <SelectTrigger className="h-9 flex-1 text-sm">
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
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!selectedDeckId || importingFlashcard}
                                                onClick={() => handleImportToFlashcard(selectedWord.id)}
                                            >
                                                <Layers className="size-4 mr-1.5" />
                                                Hozzáadás
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

WordsIndex.layout = {
    breadcrumbs: [{ title: 'Top 10 000 szó', href: index() }],
};
