import { Head, usePage } from '@inertiajs/react';
import { BookMarked, BookOpen, ChevronLeft, ChevronRight, CheckCheck, Clock, FileText, Globe, HelpCircle, History, Loader2, Mic, Plus, ScanText, Sparkles, Trash2, Upload, Volume2, X, Youtube } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { show as textAnalysisShow } from '@/routes/text-analysis';

type InputMode = 'text' | 'youtube' | 'url' | 'book';

interface UserBook {
    id: number;
    title: string;
    file_type: string;
    total_pages: number;
}

interface HistoryEntry {
    id: number;
    mode: InputMode;
    label: string;
    text: string;
    url?: string;
    date: string;
}

const HISTORY_KEY = 'text_analysis_history';
const MAX_HISTORY = 10;
const SESSION_KEY = 'text_analysis_session';

function loadHistory(): HistoryEntry[] {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function saveHistory(entries: HistoryEntry[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

function loadSession(): Partial<{ mode: InputMode; text: string; urlInput: string; fetchedSource: string | null; result: AnalysisResult | null }> {
    try {
        if (typeof window === 'undefined') return {};
        const params = new URLSearchParams(window.location.search);
        if (params.get('url')) return {};
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}');
    } catch {
        return {};
    }
}

function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'date'>) {
    const entries = loadHistory();
    const newEntry: HistoryEntry = { ...entry, id: Date.now(), date: new Date().toLocaleDateString('hu-HU') };
    const filtered = entries.filter((e) => e.label !== entry.label || e.mode !== entry.mode);
    saveHistory([newEntry, ...filtered].slice(0, MAX_HISTORY));
}

const MODE_ICONS: Record<InputMode, React.ElementType> = { text: FileText, youtube: Youtube, url: Globe, book: BookOpen };
type TokenStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | 'in_list' | 'not_in_list';

type LookupResult =
    | { type: 'word'; id: number; word: string; meaning_hu: string | null; example_en: string | null; part_of_speech: string | null; rank: number; status: string | null }
    | { type: 'custom'; id: number; word: string; meaning_hu: string | null; example_en: string | null; part_of_speech: string | null; status: string | null }
    | { type: 'not_found'; word: string };

interface UnknownWord {
    word: string;
    frequency: number;
    rank: number;
    meaning_hu: string;
}

interface AnalysisResult {
    comprehension: number;
    totalWords: number;
    uniqueWords: number;
    knownCount: number;
    learningCount: number;
    tokenStatuses: Record<string, TokenStatus>;
    topUnknown: UnknownWord[];
}

const STATUS_STYLES: Record<TokenStatus, string> = {
    known: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-300',
    learning: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300',
    saved: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300',
    pronunciation: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-300',
    in_list: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300',
    not_in_list: '',
};

const POS_LABELS: Record<string, string> = {
    verb: 'ige', noun: 'főnév', adj: 'melléknév', adv: 'határozószó',
    prep: 'elöljáró', conj: 'kötőszó', det: 'névelő', pron: 'névmás',
    num: 'számnév', interj: 'indulatszó',
};

type CustomWordForm = {
    meaning_hu: string; extra_meanings: string; synonyms: string;
    part_of_speech: string; example_en: string; example_hu: string;
    verb_past: string; verb_past_participle: string;
    verb_present_participle: string; verb_third_person: string;
    is_irregular: boolean; noun_plural: string;
    adj_comparative: string; adj_superlative: string;
};

const EMPTY_CUSTOM_WORD_FORM: CustomWordForm = {
    meaning_hu: '', extra_meanings: '', synonyms: '', part_of_speech: '',
    example_en: '', example_hu: '', verb_past: '', verb_past_participle: '',
    verb_present_participle: '', verb_third_person: '', is_irregular: false,
    noun_plural: '', adj_comparative: '', adj_superlative: '',
};

const EXAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. Learning new words every day is one of the best investments you can make in your language skills. Reading books, articles, and other written materials helps you encounter words in context, which makes them much easier to remember.`;

function HighlightedParagraph({
    para,
    tokenStatuses,
    onWordClick,
}: {
    para: string;
    tokenStatuses: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
}) {
    const parts = para.split(/([a-zA-Z]+)/);
    const extractSentence = (word: string) => {
        const sentences = para.split(/(?<=[.!?])\s+/);
        return sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))?.trim() ?? para.slice(0, 300);
    };
    return (
        <p className="wrap-break-word leading-7">
            {parts.map((part, i) => {
                if (i % 2 === 0) return part;
                const token = part.toLowerCase();
                const status = tokenStatuses[token];
                const className = status ? STATUS_STYLES[status] : '';
                return (
                    <span
                        key={i}
                        onClick={() => onWordClick?.(part, extractSentence(part))}
                        className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-70 ${className}`}
                    >
                        {part}
                    </span>
                );
            })}
        </p>
    );
}

function HighlightedText({
    text,
    tokenStatuses,
    onWordClick,
}: {
    text: string;
    tokenStatuses: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
}) {
    const paragraphs = text.split(/\n+/).filter((p) => p.trim());

    if (paragraphs.length > 1) {
        return (
            <div className="space-y-4 text-sm">
                {paragraphs.map((para, pi) => (
                    <HighlightedParagraph
                        key={pi}
                        para={para}
                        tokenStatuses={tokenStatuses}
                        onWordClick={onWordClick}
                    />
                ))}
            </div>
        );
    }

    const parts = text.split(/([a-zA-Z]+)/);
    const extractSentence = (word: string) => {
        const sentences = text.split(/(?<=[.!?])\s+/);
        return sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))?.trim() ?? text.slice(0, 300);
    };
    return (
        <p className="whitespace-pre-wrap wrap-break-word text-sm leading-7">
            {parts.map((part, i) => {
                if (i % 2 === 0) {
                    return part;
                }
                const token = part.toLowerCase();
                const status = tokenStatuses[token];
                const className = status ? STATUS_STYLES[status] : '';

                return (
                    <span
                        key={i}
                        onClick={() => onWordClick?.(part, extractSentence(part))}
                        className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-70 ${className}`}
                    >
                        {part}
                    </span>
                );
            })}
        </p>
    );
}

async function postJson(path: string, body: object): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return { ok: response.ok, data };
}

export default function TextAnalysis() {
    const [sessionData] = useState(() => loadSession());
    const [mode, setMode] = useState<InputMode>(sessionData.mode ?? 'text');
    const [text, setText] = useState(sessionData.text ?? '');
    const [urlInput, setUrlInput] = useState(sessionData.urlInput ?? '');
    const [fetchedSource, setFetchedSource] = useState<string | null>(sessionData.fetchedSource ?? null);
    const [result, setResult] = useState<AnalysisResult | null>(sessionData.result ?? null);
    const [isFetching, setIsFetching] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
    const [showHistory, setShowHistory] = useState(false);

    const [books, setBooks] = useState<UserBook[]>([]);
    const [bookLimit, setBookLimit] = useState<number>(1);
    const [usedStorage, setUsedStorage] = useState<number>(0);
    const [booksLoaded, setBooksLoaded] = useState(false);
    const [activeBook, setActiveBook] = useState<UserBook | null>(null);
    const [bookPage, setBookPage] = useState(1);
    const [isUploadingBook, setIsUploadingBook] = useState(false);
    const [isLoadingPage, setIsLoadingPage] = useState(false);
    const bookFileInputRef = useRef<HTMLInputElement>(null);

    const [lookupWord, setLookupWord] = useState<string | null>(null);
    const [lookupContext, setLookupContext] = useState<string | null>(null);
    const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [lookupStatus, setLookupStatus] = useState<string | null>(null);
    const [contextExplanation, setContextExplanation] = useState<string | null>(null);
    const [customWordForm, setCustomWordForm] = useState<CustomWordForm>(EMPTY_CUSTOM_WORD_FORM);
    const [addingCustom, setAddingCustom] = useState(false);
    const [addedCustom, setAddedCustom] = useState(false);
    const [geminiLoading, setGeminiLoading] = useState(false);

    const { auth } = usePage<{ auth: { isAdmin: boolean; subscription: { hasAiAccess: boolean } | null } }>().props as any;
    const isAdmin: boolean = auth?.isAdmin ?? false;
    const hasAiAccess: boolean = isAdmin || (auth?.subscription?.hasAiAccess ?? false);

    const didAutoFetch = useRef(false);
    useEffect(() => {
        if (didAutoFetch.current) return;
        const params = new URLSearchParams(window.location.search);
        const urlParam = params.get('url');
        if (!urlParam) return;
        didAutoFetch.current = true;
        const isYouTube = /youtube\.com|youtu\.be/.test(urlParam);
        setMode(isYouTube ? 'youtube' : 'url');
        setUrlInput(urlParam);
        // fetch directly with the param value, not via state (which isn't set yet)
        setIsFetching(true);
        setError(null);
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        fetch('/text-analysis/fetch-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
            body: JSON.stringify({ url: urlParam }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.error || data.message) {
                    setError(data.error ?? data.message ?? 'Hiba történt.');
                } else {
                    setFetchedSource(data.text as string);
                }
            })
            .catch(() => setError('Hálózati hiba.'))
            .finally(() => setIsFetching(false));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode, text, urlInput, fetchedSource, result }));
        } catch {
            try {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify({ mode, text, urlInput, fetchedSource, result: null }));
            } catch {
                // ignore quota errors
            }
        }
    }, [mode, text, urlInput, fetchedSource, result]);

    const refreshHistory = () => setHistory(loadHistory());

    const getBookmarkKey = (bookId: number) => `book_bookmark_${bookId}`;
    const saveBookmark = (bookId: number, page: number) =>
        localStorage.setItem(getBookmarkKey(bookId), String(page));
    const loadBookmark = (bookId: number): number =>
        parseInt(localStorage.getItem(getBookmarkKey(bookId)) ?? '1', 10) || 1;

    const fetchBooks = async () => {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const res = await fetch('/text-analysis/books', { headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' } });
        const data = await res.json();
        setBooks(data.books ?? []);
        setBookLimit(data.bookLimit ?? 1);
        setUsedStorage(data.usedStorage ?? 0);
        setBooksLoaded(true);
    };

    const loadBookPage = async (book: UserBook, page: number, thenAnalyze = false) => {
        setIsLoadingPage(true);
        setError(null);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const res = await fetch(`/text-analysis/books/${book.id}/page?page=${page}`, {
                headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
            });
            const data = await res.json();
            const pageText = data.text as string;
            setFetchedSource(pageText);
            setBookPage(page);
            saveBookmark(book.id, page);
            setResult(null);
            if (thenAnalyze) {
                await analyze(pageText);
            }
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsLoadingPage(false);
        }
    };

    const selectBook = (book: UserBook) => {
        setActiveBook(book);
        loadBookPage(book, loadBookmark(book.id));
    };

    const handleBookUpload = async (file: File) => {
        setIsUploadingBook(true);
        setError(null);
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/text-analysis/books', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                setError((data.errors?.file?.[0] as string) ?? (data.error as string) ?? 'Feltöltés sikertelen.');
                return;
            }
            const book = data.book as UserBook;
            setBooks((prev) => [book, ...prev]);
            setActiveBook(book);
            setBookPage(1);
            setFetchedSource(data.text as string);
            setResult(null);
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsUploadingBook(false);
        }
    };

    const deleteBookById = async (id: number) => {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        await fetch(`/text-analysis/books/${id}`, { method: 'DELETE', headers: { 'X-CSRF-TOKEN': csrfToken } });
        setBooks((prev) => prev.filter((b) => b.id !== id));
        if (activeBook?.id === id) {
            setActiveBook(null);
            setFetchedSource(null);
            setResult(null);
        }
    };

    const reset = () => {
        setResult(null);
        setFetchedSource(null);
        setError(null);
    };

    const switchMode = (m: InputMode) => {
        setMode(m);
        reset();
        if (m === 'book' && !booksLoaded) {
            fetchBooks();
        }
    };

    const loadFromHistory = (entry: HistoryEntry) => {
        setMode(entry.mode);
        setResult(null);
        setError(null);
        if (entry.mode === 'text') {
            setText(entry.text);
            setFetchedSource(null);
            setUrlInput('');
        } else {
            setUrlInput(entry.url ?? '');
            setFetchedSource(entry.text);
        }
        setShowHistory(false);
    };

    const deleteHistoryEntry = (id: number) => {
        const updated = history.filter((e) => e.id !== id);
        saveHistory(updated);
        setHistory(updated);
    };

    const fetchSource = async () => {
        const url = urlInput;
        if (!url.trim()) return;
        setIsFetching(true);
        setError(null);
        setFetchedSource(null);

        try {
            const { ok, data } = await postJson('/text-analysis/fetch-source', { url });
            if (!ok) {
                setError((data.error as string) ?? (data.message as string) ?? 'Hiba történt.');
                return;
            }
            setFetchedSource(data.text as string);
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsFetching(false);
        }
    };

    const analyze = async (overrideText?: string) => {
        const input = overrideText ?? (mode === 'text' ? text : fetchedSource ?? '');
        if (!input.trim()) return;

        setIsAnalyzing(true);
        setError(null);

        try {
            const { ok, data } = await postJson('/text-analysis/analyze', { text: input });
            if (!ok) {
                setError((data.message as string) ?? 'Hiba történt az elemzés során.');
                return;
            }
            setResult(data as unknown as AnalysisResult);

            if (Array.isArray(data.achievements) && (data.achievements as unknown[]).length > 0) {
                window.dispatchEvent(new CustomEvent('achievements-unlocked', { detail: data.achievements }));
            }

            if (mode !== 'book') {
                const label = mode === 'text'
                    ? input.slice(0, 80).trim() + (input.length > 80 ? '…' : '')
                    : urlInput;
                addHistoryEntry({ mode, label, text: input, url: mode !== 'text' ? urlInput : undefined });
                refreshHistory();
            }
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleWordClick = async (word: string, context?: string) => {
        const token = word.toLowerCase();
        setLookupWord(token);
        setLookupContext(context ?? null);
        setLookupResult(null);
        setLookupLoading(true);
        setLookupStatus(null);
        setContextExplanation(null);
        setCustomWordForm(EMPTY_CUSTOM_WORD_FORM);
        setAddedCustom(false);

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        const res = await fetch(`/text-analysis/word-lookup?word=${encodeURIComponent(token)}`, {
            headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        const data = await res.json();
        setLookupResult(data);
        setLookupStatus((data as LookupResult & { status?: string | null }).status ?? null);
        setLookupLoading(false);
    };

    const handleLookupStatus = async (newStatus: string) => {
        if (!lookupResult || lookupResult.type === 'not_found') return;
        const path =
            lookupResult.type === 'word'
                ? `/words/${lookupResult.id}/status`
                : `/custom-words/${lookupResult.id}/status`;
        const sameStatus = lookupStatus === newStatus;
        const nextStatus = sameStatus ? null : (newStatus as TokenStatus);

        // Update modal button highlight
        setLookupStatus(nextStatus);

        // Update highlighted text colors in the result
        if (lookupWord) {
            const tokenStatus: TokenStatus = nextStatus ?? (lookupResult.type === 'word' ? 'in_list' : 'not_in_list');
            setResult((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    tokenStatuses: { ...prev.tokenStatuses, [lookupWord]: tokenStatus },
                };
            });
        }

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
        await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify({ status: newStatus }),
        });
    };

    const handleAddAsCustom = async () => {
        if (!lookupResult || lookupResult.type !== 'not_found') return;
        setAddingCustom(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const body: Record<string, unknown> = { word: lookupResult.word };
            (Object.keys(customWordForm) as (keyof CustomWordForm)[]).forEach((k) => {
                const v = customWordForm[k];
                if (v !== '' && v !== false) body[k] = v;
            });
            const response = await fetch('/custom-words', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                body: JSON.stringify(body),
            });
            if (response.ok || response.redirected) {
                setAddedCustom(true);
                if (lookupWord) {
                    setResult((prev) => prev ? { ...prev, tokenStatuses: { ...prev.tokenStatuses, [lookupWord]: 'not_in_list' } } : prev);
                }
            }
        } finally {
            setAddingCustom(false);
        }
    };

    const handleGeminiAutofill = async () => {
        if (!lookupResult || lookupResult.type !== 'not_found') return;
        setGeminiLoading(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const params = new URLSearchParams({ word: lookupResult.word });
            if (lookupContext) params.set('context', lookupContext);
            const res = await fetch(`/text-analysis/gemini-lookup?${params.toString()}`, {
                headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
            });
            const data = await res.json();
            if (data.error) return;
            setCustomWordForm((prev) => ({
                ...prev,
                meaning_hu: data.meaning_hu || prev.meaning_hu,
                extra_meanings: data.extra_meanings || prev.extra_meanings,
                synonyms: data.synonyms || prev.synonyms,
                part_of_speech: data.part_of_speech || prev.part_of_speech,
                example_en: data.example_en || prev.example_en,
                example_hu: data.example_hu || prev.example_hu,
                verb_past: data.verb_past || prev.verb_past,
                verb_past_participle: data.verb_past_participle || prev.verb_past_participle,
                verb_present_participle: data.verb_present_participle || prev.verb_present_participle,
                verb_third_person: data.verb_third_person || prev.verb_third_person,
                is_irregular: data.is_irregular ?? prev.is_irregular,
                noun_plural: data.noun_plural || prev.noun_plural,
                adj_comparative: data.adj_comparative || prev.adj_comparative,
                adj_superlative: data.adj_superlative || prev.adj_superlative,
            }));
            if (data.context_explanation) {
                setContextExplanation(data.context_explanation);
            }
        } finally {
            setGeminiLoading(false);
        }
    };

    const activeText = mode === 'text' ? text : (fetchedSource ?? '');

    const comprehensionColor =
        !result ? ''
        : result.comprehension >= 90 ? 'text-green-600 dark:text-green-400'
        : result.comprehension >= 70 ? 'text-blue-600 dark:text-blue-400'
        : result.comprehension >= 50 ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

    const comprehensionBarColor =
        !result ? 'bg-primary'
        : result.comprehension >= 90 ? 'bg-green-500'
        : result.comprehension >= 70 ? 'bg-blue-500'
        : result.comprehension >= 50 ? 'bg-yellow-500'
        : 'bg-red-500';

    return (
        <>
            <Head title="Szövegelemzés" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-tight">Szövegelemzés</h1>
                    <p className="text-sm text-muted-foreground">
                        Elemezd meg a tudásod bármilyen angol szövegen – illeszd be, adj meg egy weboldalt, vagy egy YouTube videót.
                    </p>
                </div>

{/* Mode tabs + history toggle */}
                {!result && (
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex gap-1 rounded-lg border bg-muted p-1">
                            {([
                                { id: 'text', label: 'Szöveg', Icon: FileText },
                                { id: 'youtube', label: 'YouTube', Icon: Youtube },
                                { id: 'url', label: 'Weboldal', Icon: Globe },
                                { id: 'book', label: 'Könyv', Icon: BookOpen },
                            ] as { id: InputMode; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => switchMode(id)}
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                        mode === id
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="size-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>

                        {history.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowHistory((v) => !v)}
                                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                                    showHistory ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <History className="size-3.5" />
                                Előzmények
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{history.length}</span>
                            </button>
                        )}
                    </div>
                )}

                {/* History panel */}
                {!result && showHistory && history.length > 0 && (
                    <div className="rounded-xl border bg-card">
                        <div className="flex items-center justify-between border-b px-4 py-2.5">
                            <p className="text-sm font-medium">Korábbi elemzések</p>
                            <button
                                type="button"
                                onClick={() => { saveHistory([]); setHistory([]); setShowHistory(false); }}
                                className="text-xs text-muted-foreground hover:text-destructive"
                            >
                                Mind törlése
                            </button>
                        </div>
                        <ul className="divide-y">
                            {history.map((entry) => {
                                const Icon = MODE_ICONS[entry.mode];
                                return (
                                    <li key={entry.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
                                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                                        <button
                                            type="button"
                                            onClick={() => loadFromHistory(entry)}
                                            className="flex-1 min-w-0 text-left"
                                        >
                                            <p className="truncate text-sm">{entry.label}</p>
                                            <p className="text-xs text-muted-foreground">{entry.date}</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteHistoryEntry(entry.id)}
                                            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* Input area */}
                {!result && (
                    <div className="flex flex-col gap-3">
                        {mode === 'text' && (
                            <>
                                <Textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Illeszd be ide az angol szöveget... (cikk, könyvrészlet, felirat, bármi)"
                                    className="min-h-48 resize-none"
                                    maxLength={15000}
                                />
                                <div className="flex items-center justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setText(EXAMPLE_TEXT)}
                                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                    >
                                        Példa szöveg betöltése
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{text.length.toLocaleString()} / 15 000</span>
                                        <Button onClick={() => analyze()} disabled={isAnalyzing || !text.trim()}>
                                            {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                                            {isAnalyzing ? 'Elemzés...' : 'Elemzés'}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {(mode === 'youtube' || mode === 'url') && (
                            <>
                                <div className="flex gap-2">
                                    <Input
                                        value={urlInput}
                                        onChange={(e) => { setUrlInput(e.target.value); setFetchedSource(null); setError(null); }}
                                        placeholder={
                                            mode === 'youtube'
                                                ? 'https://www.youtube.com/watch?v=...'
                                                : 'https://example.com/article'
                                        }
                                        className="flex-1"
                                        onKeyDown={(e) => e.key === 'Enter' && !fetchedSource && fetchSource()}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => fetchSource()}
                                        disabled={isFetching || !urlInput.trim() || !!fetchedSource}
                                    >
                                        {isFetching ? <Loader2 className="size-4 animate-spin" /> : (mode === 'youtube' ? <Youtube className="size-4" /> : <Globe className="size-4" />)}
                                        {isFetching ? 'Betöltés...' : 'Betöltés'}
                                    </Button>
                                </div>

                                {mode === 'youtube' && (
                                    <p className="text-xs text-muted-foreground">
                                        A videóhoz angol feliratnak kell lennie (auto-generált is megfelel).
                                    </p>
                                )}

                                {fetchedSource && (
                                    <>
                                        <div className="rounded-lg border bg-muted/50 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    {mode === 'youtube' ? 'Betöltött felirat' : 'Betöltött szöveg'} ({fetchedSource.length.toLocaleString()} karakter)
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => { setFetchedSource(null); setError(null); }}
                                                    className="text-muted-foreground hover:text-foreground"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </div>
                                            <p className="line-clamp-3 text-xs text-muted-foreground">{fetchedSource}</p>
                                        </div>
                                        <div className="flex justify-end">
                                            <Button onClick={() => analyze(fetchedSource)} disabled={isAnalyzing}>
                                                {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                                                {isAnalyzing ? 'Elemzés...' : 'Elemzés'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {mode === 'book' && (
                            <>
                                <input
                                    ref={bookFileInputRef}
                                    type="file"
                                    accept=".pdf,.epub"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleBookUpload(file);
                                        e.target.value = '';
                                    }}
                                />

                                {/* Book list */}
                                {!activeBook && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground">
                                                {booksLoaded ? `${books.length} / ${bookLimit} könyv · ${(usedStorage / 1024 / 1024).toFixed(1)} / 30 MB` : ''}
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => bookFileInputRef.current?.click()}
                                                disabled={isUploadingBook || (booksLoaded && (books.length >= bookLimit || usedStorage >= 30 * 1024 * 1024))}
                                                title={booksLoaded && books.length >= bookLimit ? `Elérted a maximális könyvszámot (${bookLimit})` : booksLoaded && usedStorage >= 30 * 1024 * 1024 ? 'Elérted a 30 MB-os tárhelylimitet' : undefined}
                                            >
                                                {isUploadingBook ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                                                {isUploadingBook ? 'Feldolgozás...' : 'PDF / EPUB feltöltése'}
                                            </Button>
                                        </div>
                                        {!booksLoaded && (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                        {booksLoaded && books.length > 0 && (
                                            <div className="flex flex-col divide-y rounded-xl border bg-card">
                                                {books.map((book) => {
                                                    const bookmark = loadBookmark(book.id);
                                                    const hasProgress = bookmark > 1;
                                                    return (
                                                        <div key={book.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                                                            <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                                                            <button
                                                                type="button"
                                                                onClick={() => selectBook(book)}
                                                                className="flex-1 min-w-0 text-left"
                                                            >
                                                                <p className="truncate text-sm font-medium">{book.title}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {book.file_type.toUpperCase()} · {book.total_pages} oldal
                                                                    {hasProgress && (
                                                                        <span className="ml-2 text-primary font-medium">
                                                                            · Könyvjelző: {bookmark}. oldal
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteBookById(book.id)}
                                                                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Active book page view */}
                                {activeBook && fetchedSource !== null && (
                                    <>
                                        {/* Book header */}
                                        <div className="flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setActiveBook(null); setFetchedSource(null); setResult(null); }}
                                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                            >
                                                <ChevronLeft className="size-3.5" />
                                                Könyvek
                                            </button>
                                            <p className="truncate text-xs font-medium text-muted-foreground">{activeBook.title}</p>
                                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{bookPage} / {activeBook.total_pages}</span>
                                        </div>

                                        {/* Readable text box */}
                                        <div className="max-h-80 overflow-y-auto rounded-xl border bg-card px-5 py-4 text-sm leading-7">
                                            {fetchedSource.split(/\n+/).filter(p => p.trim()).map((para, i) => (
                                                <p key={i} className="mb-3 last:mb-0">{para}</p>
                                            ))}
                                        </div>

                                        {/* Page navigation */}
                                        <div className="flex items-center justify-between gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => loadBookPage(activeBook, bookPage - 1)}
                                                disabled={bookPage <= 1 || isLoadingPage}
                                            >
                                                {isLoadingPage ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                                                Előző
                                            </Button>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadBookPage(activeBook, bookPage + 1)}
                                                    disabled={bookPage >= activeBook.total_pages || isLoadingPage}
                                                >
                                                    Következő
                                                    {isLoadingPage ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                                                </Button>
                                                <Button onClick={() => analyze(fetchedSource)} disabled={isAnalyzing || isLoadingPage}>
                                                    {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                                                    {isAnalyzing ? 'Elemzés...' : 'Elemzés'}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeBook && isLoadingPage && !fetchedSource && (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </>
                        )}

                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <div className="flex flex-col gap-5">
                        {/* Comprehension score */}
                        <div className="rounded-xl border bg-card p-5">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Érthetőség</p>
                                    <p className={`text-5xl font-bold tabular-nums ${comprehensionColor}`}>
                                        {result.comprehension}%
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {result.knownCount.toLocaleString()} ismert szó / {result.totalWords.toLocaleString()} szó összesen
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={reset} title="Új elemzés">
                                    <X className="size-4" />
                                </Button>
                            </div>

                            <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                    className={`h-3 rounded-full transition-all duration-700 ${comprehensionBarColor}`}
                                    style={{ width: `${result.comprehension}%` }}
                                />
                            </div>

                            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-sm bg-green-500" />
                                    Tudom: {result.knownCount.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-sm bg-blue-500" />
                                    Tanulom: {result.learningCount.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-sm bg-red-400" />
                                    Top 10k-ban, de ismeretlen: {Object.values(result.tokenStatuses).filter(s => s === 'in_list').length}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-block size-2.5 rounded-sm bg-muted-foreground/30" />
                                    Egyedi szavak: {result.uniqueWords.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 text-xs">
                            {([
                                { label: 'Tudom', cls: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-300', Icon: CheckCheck, iconCls: 'text-green-500' },
                                { label: 'Tanulom', cls: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300', Icon: Clock, iconCls: 'text-blue-500' },
                                { label: 'Top 10k, de ismeretlen', cls: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300', Icon: BookOpen, iconCls: 'text-red-500' },
                                { label: 'Tulajdonnév / ritka szó', cls: '', Icon: HelpCircle, iconCls: 'text-muted-foreground' },
                            ]).map(({ label, cls, Icon, iconCls }) => (
                                <span key={label} className="flex items-center gap-1.5 rounded-md border px-2 py-1">
                                    <Icon className={`size-3 ${iconCls}`} />
                                    {cls && <span className={`rounded px-1 ${cls}`}>szó</span>}
                                    {label}
                                </span>
                            ))}
                        </div>

                        {/* Highlighted text */}
                        <div className="rounded-xl border bg-card p-5">
                            <p className="mb-3 text-sm font-medium">Szöveg kiemelésekkel</p>
                            <HighlightedText text={activeText} tokenStatuses={result.tokenStatuses} onWordClick={handleWordClick} />
                        </div>

                        {/* Top unknown words */}
                        {result.topUnknown.length > 0 && (
                            <div className="rounded-xl border bg-card p-5">
                                <p className="mb-3 text-sm font-medium">
                                    Leggyakoribb ismeretlen szavak a top 10 000-ből
                                </p>
                                <div className="grid gap-1.5 sm:grid-cols-2">
                                    {result.topUnknown.map((item) => (
                                        <div
                                            key={item.word}
                                            className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className="truncate font-medium">{item.word}</span>
                                                <span className="shrink-0 text-xs text-muted-foreground">#{item.rank}</span>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <span className="max-w-32 truncate text-xs text-muted-foreground">{item.meaning_hu}</span>
                                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">
                                                    ×{item.frequency}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Book page navigation in results view */}
                        {mode === 'book' && activeBook && (
                            <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadBookPage(activeBook, bookPage - 1, true)}
                                    disabled={bookPage <= 1 || isLoadingPage || isAnalyzing}
                                >
                                    {(isLoadingPage || isAnalyzing) ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                                    Előző oldal
                                </Button>
                                <span className="text-sm text-muted-foreground tabular-nums">
                                    {bookPage} / {activeBook.total_pages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadBookPage(activeBook, bookPage + 1, true)}
                                    disabled={bookPage >= activeBook.total_pages || isLoadingPage || isAnalyzing}
                                >
                                    Következő oldal
                                    {(isLoadingPage || isAnalyzing) ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                                </Button>
                            </div>
                        )}

                        <Button variant="outline" onClick={reset} className="self-start">
                            Új elemzés
                        </Button>
                    </div>
                )}
            </div>

            {/* Word lookup modal */}
            <Dialog
                open={lookupWord !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setLookupWord(null);
                        setLookupResult(null);
                    }
                }}
            >
                <DialogContent className={`gap-0 overflow-hidden p-0 ${lookupResult?.type === 'not_found' ? 'sm:max-w-lg' : 'sm:max-w-md'}`}>
                    {lookupLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!lookupLoading && lookupResult && (
                        <>
                            {/* Header */}
                            <div className="border-b bg-linear-to-br from-primary/8 to-primary/3 px-5 pb-4 pt-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        {lookupResult.type !== 'not_found' && (
                                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                {lookupResult.type === 'word' && lookupResult.rank && (
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
                                                        {lookupResult.part_of_speech}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <DialogTitle className="text-2xl font-bold tracking-tight">
                                            {lookupResult.word}
                                        </DialogTitle>
                                    </div>
                                    {lookupResult.type !== 'not_found' && (
                                        <button
                                            onClick={() => {
                                                const u = new SpeechSynthesisUtterance(lookupResult.word);
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
                                {/* Word or Custom found */}
                                {lookupResult.type !== 'not_found' && (
                                    <>
                                        {lookupResult.meaning_hu && (
                                            <div className="rounded-xl border bg-card px-4 py-3">
                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Magyar jelentés
                                                </p>
                                                <p className="font-semibold leading-snug">{lookupResult.meaning_hu}</p>
                                            </div>
                                        )}
                                        {lookupResult.example_en && (
                                            <div className="rounded-xl border-l-4 border-primary/40 bg-muted/30 px-4 py-3">
                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Példamondat
                                                </p>
                                                <p className="text-sm italic">"{lookupResult.example_en}"</p>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            {(
                                                [
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
                                                ] as const
                                            ).map(({ s, label, Icon, active, hover }) => (
                                                <button
                                                    key={s}
                                                    onClick={() => handleLookupStatus(s)}
                                                    className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                                        lookupStatus === s ? active : `bg-secondary text-muted-foreground ${hover}`
                                                    }`}
                                                >
                                                    <Icon className="size-4" /> {label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Not found — add as custom */}
                                {lookupResult.type === 'not_found' && (
                                    <div className="-mx-5 -mt-4">
                                        {addedCustom ? (
                                            <div className="flex items-center gap-2 px-5 py-6 text-sm font-medium text-green-700 dark:text-green-400">
                                                <CheckCheck className="size-4" /> Sikeresen hozzáadva saját szóként!
                                            </div>
                                        ) : (
                                            <>
                                                <div className="max-h-[55vh] overflow-y-auto px-5 py-4 flex flex-col gap-3">
                                                    {/* Action buttons */}
                                                    <div className="flex gap-2">
                                                        {hasAiAccess && (
                                                            <Button
                                                                variant="outline"
                                                                onClick={handleGeminiAutofill}
                                                                disabled={geminiLoading}
                                                                className="flex-1 border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950/30"
                                                            >
                                                                {geminiLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                                                Gemini AI
                                                            </Button>
                                                        )}
                                                        <a
                                                            href={`https://www.google.com/search?q=${encodeURIComponent(lookupResult.word + ' angol szó: jelentése magyarul, szinonimák, példamondat angolul és magyarul, szófaj, igeragozás ha ige')}&udm=50`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                                                        >
                                                            <svg className="size-4 shrink-0" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                                            Google AI
                                                        </a>
                                                    </div>

                                                    {/* Basic fields */}
                                                    <div className="flex gap-2">
                                                        <Input
                                                            placeholder="Magyar jelentés"
                                                            value={customWordForm.meaning_hu}
                                                            onChange={(e) => setCustomWordForm({ ...customWordForm, meaning_hu: e.target.value })}
                                                            className="flex-1"
                                                        />
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
                                                    <Input
                                                        placeholder="További jelentések (pl. alternatív fordítások)"
                                                        value={customWordForm.extra_meanings}
                                                        onChange={(e) => setCustomWordForm({ ...customWordForm, extra_meanings: e.target.value })}
                                                    />
                                                    <Input
                                                        placeholder="Szinonimák (pl. consent, accept)"
                                                        value={customWordForm.synonyms}
                                                        onChange={(e) => setCustomWordForm({ ...customWordForm, synonyms: e.target.value })}
                                                    />
                                                    <Input
                                                        placeholder="Példamondat (angol)"
                                                        value={customWordForm.example_en}
                                                        onChange={(e) => setCustomWordForm({ ...customWordForm, example_en: e.target.value })}
                                                    />
                                                    <Input
                                                        placeholder="Példamondat (magyar)"
                                                        value={customWordForm.example_hu}
                                                        onChange={(e) => setCustomWordForm({ ...customWordForm, example_hu: e.target.value })}
                                                    />

                                                    {/* Verb fields */}
                                                    {customWordForm.part_of_speech === 'verb' && (
                                                        <div className="rounded-xl border bg-muted/30 px-4 py-3 flex flex-col gap-3">
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Igealakok</p>
                                                            <div className="grid grid-cols-2 gap-2">
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

                                                    {/* Noun fields */}
                                                    {customWordForm.part_of_speech === 'noun' && (
                                                        <div className="rounded-xl border bg-muted/30 px-4 py-3 flex flex-col gap-2">
                                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Főnév alakok</p>
                                                            <div>
                                                                <label className="text-xs text-muted-foreground">Többes szám</label>
                                                                <Input placeholder="pl. agreements" value={customWordForm.noun_plural} onChange={(e) => setCustomWordForm({ ...customWordForm, noun_plural: e.target.value })} className="mt-1" />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Adjective fields */}
                                                    {customWordForm.part_of_speech === 'adj' && (
                                                        <div className="rounded-xl border bg-muted/30 px-4 py-3 flex flex-col gap-3">
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

                                                {/* Context explanation */}
                                                {(lookupContext || contextExplanation) && (
                                                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 space-y-2">
                                                        {lookupContext && (
                                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                                <span className="font-semibold">Kontextus: </span>
                                                                {lookupContext.replace(new RegExp(`\\b${lookupResult?.word}\\b`, 'gi'), (m) => `「${m}」`)}
                                                            </p>
                                                        )}
                                                        {contextExplanation && (
                                                            <p className="text-xs text-blue-800 dark:text-blue-200">
                                                                <span className="font-semibold">Jelentés ebben a mondatban: </span>
                                                                {contextExplanation}
                                                            </p>
                                                        )}
                                                        {!contextExplanation && lookupContext && (
                                                            <p className="text-xs text-blue-500 dark:text-blue-400 italic">Nyomj Gemini AI-ra a kontextuális magyarázathoz.</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer */}
                                                <div className="flex gap-2 border-t px-5 py-4">
                                                    <Button className="flex-1" onClick={handleAddAsCustom} disabled={addingCustom}>
                                                        {addingCustom ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
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
        </>
    );
}

TextAnalysis.layout = {
    breadcrumbs: [{ title: 'Szövegelemzés', href: textAnalysisShow() }],
};
