import { Head, Link, usePage } from '@inertiajs/react';
import { BookOpen, FileText, Globe, History, Loader2, ScanText, X, Youtube } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnalysisResultView from '@/components/text-analysis/analysis-result';
import { BookList, BookPager, BookReader } from '@/components/text-analysis/book-panel';
import HistoryPanel from '@/components/text-analysis/history-panel';
import { phraseKey } from '@/components/text-analysis/tokenize-render';
import {
    addHistoryEntry,
    computeTokenFrequencies,
    EXAMPLE_TEXT,
    loadHistory,
    loadSession,
    sessionKey,
    postJson,
    saveHistory,
} from '@/components/text-analysis/types';
import type { AnalysisResult, HistoryEntry, InputMode, LyricSegment, TokenStatus, UserBook, VideoOverview, YoutubeTranscript } from '@/components/text-analysis/types';
import WordLookupDialog from '@/components/text-analysis/word-lookup-dialog';
import { WholeVideoBanner, YoutubeList, YoutubeReader } from '@/components/text-analysis/youtube-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { csrfHeaders } from '@/lib/csrf';
import { deleteJson, httpErrorMessage } from '@/lib/http';
import { sanitizeUploadFilename } from '@/lib/sanitize-filename';
import { analyze as analyzeRoute, fetchSource as fetchSourceRoute, show as textAnalysisShow } from '@/routes/text-analysis';
import { destroy as destroyBook, index as booksIndex, overview as bookOverviewRoute, page as bookPageRoute, store as storeBook } from '@/routes/text-analysis/books';
import { destroy as ytDestroy, index as ytIndex, overview as ytOverviewRoute, page as ytPageRoute, store as ytStore } from '@/routes/text-analysis/youtube';

const MODE_TABS: { id: InputMode; label: string; Icon: React.ElementType }[] = [
    { id: 'text', label: 'Szöveg', Icon: FileText },
    { id: 'youtube', label: 'YouTube', Icon: Youtube },
    { id: 'url', label: 'Weboldal', Icon: Globe },
    { id: 'book', label: 'Könyv', Icon: BookOpen },
];

export default function TextAnalysis() {
    const { auth } = usePage<{ auth: { user?: { id?: number }; isAdmin?: boolean; subscription?: { hasAiAccess: boolean } | null } }>().props;
    const isAdmin = auth?.isAdmin ?? false;
    const hasAiAccess = isAdmin || (auth?.subscription?.hasAiAccess ?? false);
    // A tárolt előzmények/session/könyvjelzők a bejelentkezett userhez kötöttek,
    // hogy közös gépen ne szivárogjanak át a következő fióknak (FL4).
    const userId = auth?.user?.id;

    const [sessionData] = useState(() => loadSession(userId));
    const [mode, setMode] = useState<InputMode>(sessionData.mode ?? 'text');
    const [text, setText] = useState(sessionData.text ?? '');
    const [urlInput, setUrlInput] = useState(sessionData.urlInput ?? '');
    const [fetchedSource, setFetchedSource] = useState<string | null>(sessionData.fetchedSource ?? null);
    const [result, setResult] = useState<AnalysisResult | null>(sessionData.result ?? null);
    const [isFetching, setIsFetching] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(userId));
    const [showHistory, setShowHistory] = useState(false);

    const [books, setBooks] = useState<UserBook[]>([]);
    const [bookLimit, setBookLimit] = useState<number>(1);
    const [usedStorage, setUsedStorage] = useState<number>(0);
    const [booksLoaded, setBooksLoaded] = useState(false);
    const [activeBook, setActiveBook] = useState<UserBook | null>(null);
    const [bookPage, setBookPage] = useState(1);
    const [bookOverview, setBookOverview] = useState<VideoOverview | 'failed' | null>(null);

    // YouTube-feliratok (külön rendszer)
    const [transcripts, setTranscripts] = useState<YoutubeTranscript[]>([]);
    const [youtubeLimit, setYoutubeLimit] = useState<number>(1);
    const [youtubeLoaded, setYoutubeLoaded] = useState(false);
    const [activeTranscript, setActiveTranscript] = useState<YoutubeTranscript | null>(null);
    const [ytPage, setYtPage] = useState(1);
    const [segments, setSegments] = useState<LyricSegment[] | null>(null);
    const [overview, setOverview] = useState<VideoOverview | 'failed' | null>(null);
    const [isUploadingBook, setIsUploadingBook] = useState(false);
    const [isLoadingPage, setIsLoadingPage] = useState(false);

    const [lookupWord, setLookupWord] = useState<string | null>(null);
    const [lookupContext, setLookupContext] = useState<string | null>(null);

    const didAutoFetch = useRef(false);
    useEffect(() => {
        if (didAutoFetch.current) {
return;
}

        const params = new URLSearchParams(window.location.search);
        const urlParam = params.get('url');

        if (!urlParam) {
return;
}

        didAutoFetch.current = true;
        const isYouTube = /youtube\.com|youtu\.be/.test(urlParam);
        setMode(isYouTube ? 'youtube' : 'url');
        setUrlInput(urlParam);

        // YouTube linket nem töltünk be automatikusan (könyv jönne létre) — a felhasználó indítja.
        if (isYouTube) {
            return;
        }

        // fetch directly with the param value, not via state (which isn't set yet)
        setIsFetching(true);
        setError(null);
        fetch(fetchSourceRoute.url(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...csrfHeaders(), Accept: 'application/json' },
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
    }, []);  

    useEffect(() => {
        try {
            sessionStorage.setItem(sessionKey(userId), JSON.stringify({ mode, text, urlInput, fetchedSource, result }));
        } catch {
            try {
                sessionStorage.setItem(sessionKey(userId), JSON.stringify({ mode, text, urlInput, fetchedSource, result: null }));
            } catch {
                // ignore quota errors
            }
        }
    }, [mode, text, urlInput, fetchedSource, result, userId]);

    useEffect(() => {
        if (mode === 'youtube' && !youtubeLoaded) {
            fetchTranscripts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const userScope = userId ? `_u${userId}` : '';
    const getBookmarkKey = (bookId: number) => `book_bookmark_${bookId}${userScope}`;
    const saveBookmark = (bookId: number, page: number) =>
        localStorage.setItem(getBookmarkKey(bookId), String(page));
    const loadBookmark = (bookId: number): number =>
        parseInt(localStorage.getItem(getBookmarkKey(bookId)) ?? '1', 10) || 1;

    const fetchBooks = async () => {
        try {
            const res = await fetch(booksIndex.url(), { headers: { Accept: 'application/json' } });
            const data = await res.json();
            setBooks(data.books ?? []);
            setBookLimit(data.bookLimit ?? 1);
            setUsedStorage(data.usedStorage ?? 0);
        } catch {
            setError('Nem sikerült betölteni a könyveket.');
        } finally {
            setBooksLoaded(true);
        }
    };

    const loadBookPage = async (book: UserBook, page: number, thenAnalyze = false) => {
        setIsLoadingPage(true);
        setError(null);

        try {
            const res = await fetch(bookPageRoute.url(book.id, { query: { page } }), {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || typeof data?.text !== 'string') {
                setError((data?.error as string) ?? 'Nem sikerült betölteni az oldalt. Próbáld újra.');

                return;
            }

            const pageText = data.text as string;
            setFetchedSource(pageText);
            setSegments((data.segments as LyricSegment[] | undefined) ?? null);
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

    const fetchBookOverview = async (book: UserBook) => {
        setBookOverview(null);

        try {
            const res = await fetch(bookOverviewRoute.url(book.id), { headers: { Accept: 'application/json' } });

            if (res.ok) {
                setBookOverview((await res.json()) as VideoOverview);
            } else {
                setBookOverview('failed');
            }
        } catch {
            // A teljes könyv %-a opcionális — hiba esetén nem mutatjuk.
            setBookOverview('failed');
        }
    };

    const selectBook = (book: UserBook) => {
        setActiveBook(book);
        loadBookPage(book, loadBookmark(book.id));
        fetchBookOverview(book);
    };

    const handleBookUpload = async (file: File) => {
        setIsUploadingBook(true);
        setError(null);
        const formData = new FormData();
        // A szerver WAF-ja a fájlnévben lévő aposztrófot/idézőjelet SQLi-ként
        // blokkolja (403), ezért biztonságos névvel küldjük — a tartalom marad.
        formData.append('file', file, sanitizeUploadFilename(file.name));

        try {
            const res = await fetch(storeBook.url(), {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
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
            setSegments(null);
            setResult(null);
            fetchBookOverview(book);
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsUploadingBook(false);
        }
    };

    // ── YouTube-feliratok (külön rendszer) ──────────────────────────────────────

    const getYtBookmarkKey = (id: number) => `yt_bookmark_${id}${userScope}`;
    const saveYtBookmark = (id: number, page: number) =>
        localStorage.setItem(getYtBookmarkKey(id), String(page));
    const loadYtBookmark = (id: number): number =>
        parseInt(localStorage.getItem(getYtBookmarkKey(id)) ?? '1', 10) || 1;

    const fetchTranscripts = async () => {
        try {
            const res = await fetch(ytIndex.url(), { headers: { Accept: 'application/json' } });
            const data = await res.json();
            setTranscripts(data.transcripts ?? []);
            setYoutubeLimit(data.youtubeLimit ?? 1);
        } catch {
            setError('Nem sikerült betölteni a feliratokat.');
        } finally {
            setYoutubeLoaded(true);
        }
    };

    const fetchOverview = async (transcript: YoutubeTranscript) => {
        setOverview(null);

        try {
            const res = await fetch(ytOverviewRoute.url(transcript.id), { headers: { Accept: 'application/json' } });

            if (res.ok) {
                setOverview((await res.json()) as VideoOverview);
            } else {
                setOverview('failed');
            }
        } catch {
            // A teljes videó %-a opcionális — hiba esetén egyszerűen nem mutatjuk.
            setOverview('failed');
        }
    };

    const loadYtPage = async (transcript: YoutubeTranscript, page: number, thenAnalyze = false) => {
        setIsLoadingPage(true);
        setError(null);

        try {
            const res = await fetch(ytPageRoute.url(transcript.id, { query: { page } }), {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || typeof data?.text !== 'string') {
                setError((data?.error as string) ?? 'Nem sikerült betölteni az oldalt. Próbáld újra.');

                return;
            }

            const pageText = data.text as string;
            setFetchedSource(pageText);
            setSegments((data.segments as LyricSegment[] | undefined) ?? null);
            setYtPage(page);
            saveYtBookmark(transcript.id, page);
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

    const selectTranscript = (transcript: YoutubeTranscript) => {
        setActiveTranscript(transcript);
        setResult(null);
        loadYtPage(transcript, loadYtBookmark(transcript.id));
        fetchOverview(transcript);
    };

    /** Új YouTube videó feliratának lehívása és mentése, majd megnyitása az olvasóban. */
    const loadYoutube = async (rawUrl: string) => {
        const url = rawUrl.trim();

        if (!url) {
return;
}

        setIsFetching(true);
        setError(null);
        setUpgradeUrl(null);

        try {
            const { ok, data } = await postJson(ytStore.url(), { url });

            if (!ok) {
                setError((data.error as string) ?? (data.message as string) ?? 'Hiba történt.');

                if (typeof data.upgrade_url === 'string') {
                    setUpgradeUrl(data.upgrade_url);
                }

                return;
            }

            const transcript = data.transcript as YoutubeTranscript;
            setTranscripts((prev) => [transcript, ...prev.filter((t) => t.id !== transcript.id)]);
            setYoutubeLoaded(true);
            setActiveTranscript(transcript);
            setYtPage(1);
            setFetchedSource(data.text as string);
            setSegments((data.segments as LyricSegment[] | undefined) ?? null);
            setResult(null);
            setUrlInput('');
            fetchOverview(transcript);
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsFetching(false);
        }
    };

    const deleteTranscript = async (transcript: YoutubeTranscript) => {
        if (!confirm(`Törlöd a(z) „${transcript.title}" feliratot?`)) {
return;
}

        setError(null);

        try {
            const { ok, status } = await deleteJson(ytDestroy.url(transcript.id));

            if (!ok) {
                setError(httpErrorMessage(status, 'A törlés nem sikerült — próbáld újra.'));

                return;
            }
        } catch {
            setError(httpErrorMessage());

            return;
        }

        setTranscripts((prev) => prev.filter((t) => t.id !== transcript.id));

        if (activeTranscript?.id === transcript.id) {
            setActiveTranscript(null);
            setFetchedSource(null);
            setSegments(null);
            setOverview(null);
            setResult(null);
        }
    };

    const handleDeleteBook = async (book: UserBook) => {
        if (!confirm(`Törlöd a(z) „${book.title}" könyvet?`)) {
return;
}

        setError(null);

        try {
            const { ok, status } = await deleteJson(destroyBook.url(book.id));

            if (!ok) {
                setError(httpErrorMessage(status, 'A törlés nem sikerült — próbáld újra.'));

                return;
            }
        } catch {
            setError(httpErrorMessage());

            return;
        }

        setBooks((prev) => prev.filter((b) => b.id !== book.id));

        if (activeBook?.id === book.id) {
            setActiveBook(null);
            setFetchedSource(null);
            setSegments(null);
            setBookOverview(null);
            setResult(null);
        }
    };

    const reset = () => {
        setResult(null);
        setFetchedSource(null);
        setSegments(null);
        setError(null);
        setUpgradeUrl(null);
    };

    /** A „Új elemzés" YouTube módban csak az eredményt zárja — az olvasó (felirat + teljes %) megmarad. */
    const handleResultReset = () => {
        if (mode === 'youtube' && activeTranscript) {
            setResult(null);
            setError(null);
            setUpgradeUrl(null);

            return;
        }

        reset();
    };

    const switchMode = (m: InputMode) => {
        setMode(m);
        reset();

        // reset() clears fetchedSource, so an already-selected book/transcript
        // must be deselected too — otherwise the tab renders neither the list
        // nor the reader and stays blank.
        if (m === 'book') {
            setActiveBook(null);
            setBookOverview(null);

            if (!booksLoaded) {
                fetchBooks();
            }
        }

        if (m === 'youtube') {
            setActiveTranscript(null);
            setOverview(null);
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
        saveHistory(updated, userId);
        setHistory(updated);
    };

    const fetchSource = async () => {
        const url = urlInput;

        if (!url.trim()) {
return;
}

        setIsFetching(true);
        setError(null);
        setFetchedSource(null);

        try {
            const { ok, data } = await postJson(fetchSourceRoute.url(), { url });

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

        if (!input.trim()) {
return;
}

        setIsAnalyzing(true);
        setError(null);
        setUpgradeUrl(null);

        try {
            const { ok, data } = await postJson(analyzeRoute.url(), { text: input });

            if (!ok) {
                setError((data.message as string) ?? 'Hiba történt az elemzés során.');

                if (typeof data.upgrade_url === 'string') {
                    setUpgradeUrl(data.upgrade_url);
                }

                return;
            }

            setResult(data as unknown as AnalysisResult);

            if (Array.isArray(data.achievements) && (data.achievements as unknown[]).length > 0) {
                window.dispatchEvent(new CustomEvent('achievements-unlocked', { detail: data.achievements }));
            }

            if (mode !== 'book' && mode !== 'youtube') {
                const label = mode === 'text'
                    ? input.slice(0, 80).trim() + (input.length > 80 ? '…' : '')
                    : urlInput;
                addHistoryEntry({ mode, label, text: input, url: mode !== 'text' ? urlInput : undefined }, userId);
                setHistory(loadHistory(userId));
            }
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleWordClick = (word: string, context?: string) => {
        setLookupWord(word.toLowerCase());
        setLookupContext(context || null);
    };

    const activeText = mode === 'text' ? text : (fetchedSource ?? '');
    const tokenFrequencies = useMemo(() => (result ? computeTokenFrequencies(activeText) : {}), [result, activeText]);

    /** A modal státuszváltásakor optimistán igazítjuk az eredmény-statisztikákat. */
    const handleLookupStatusChange = (word: string, prevStatus: string | null, nextStatus: TokenStatus | null, fallback: TokenStatus) => {
        const freq = tokenFrequencies[word] ?? 0;
        setResult((prev) => {
            if (!prev) {
return prev;
}

            // Többszavas kifejezést a renderelés csak a phraseStatuses-ben keres,
            // ezért oda írjuk; levételkor töröljük, ahogy az újraelemzés is tenné.
            // A statisztikákat nem érinti: a kifejezés nem szerepel a token-frekvenciákban.
            if (/\s/.test(word.trim())) {
                const phraseStatuses = { ...prev.phraseStatuses };

                if (nextStatus) {
                    phraseStatuses[phraseKey(word)] = nextStatus;
                } else {
                    delete phraseStatuses[phraseKey(word)];
                }

                return { ...prev, phraseStatuses };
            }

            let knownDelta = 0;
            let learningDelta = 0;

            if (prevStatus === 'known') {
knownDelta -= freq;
}

            if (prevStatus === 'learning') {
learningDelta -= freq;
}

            if (nextStatus === 'known') {
knownDelta += freq;
}

            if (nextStatus === 'learning') {
learningDelta += freq;
}

            const newKnownCount = prev.knownCount + knownDelta;
            const newLearningCount = prev.learningCount + learningDelta;

            return {
                ...prev,
                tokenStatuses: { ...prev.tokenStatuses, [word]: nextStatus ?? fallback },
                knownCount: newKnownCount,
                learningCount: newLearningCount,
                comprehension: prev.totalWords > 0 ? Math.round((newKnownCount / prev.totalWords) * 100) : 0,
            };
        });
    };

    const handleCustomAdded = (word: string) => {
        setResult((prev) => prev ? { ...prev, tokenStatuses: { ...prev.tokenStatuses, [word]: 'not_in_list' } } : prev);
    };

    return (
        <>
            <Head title="Szövegelemzés" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-3xl bg-violet-500 p-6 md:p-8">
                    <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/15" />
                    <div className="relative">
                        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Szövegelemzés</h1>
                        <p className="mt-1.5 max-w-xl text-sm text-white/85">
                            Elemezd meg a tudásod bármilyen angol szövegen – illeszd be, adj meg egy weboldalt, vagy egy YouTube videót.
                        </p>
                    </div>
                </div>

                {/* Mode tabs + history toggle */}
                {!result && (
                    <div className="flex flex-wrap items-center gap-2">
                        {MODE_TABS.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                type="button"
                                title={label}
                                onClick={() => switchMode(id)}
                                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                                    mode === id
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                                }`}
                            >
                                <Icon className="size-3.5" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}

                        {history.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowHistory((v) => !v)}
                                className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                    showHistory ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <History className="size-3.5" />
                                <span className="hidden sm:inline">Előzmények</span>
                                <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-xs tabular-nums">{history.length}</span>
                            </button>
                        )}
                    </div>
                )}

                {/* History panel */}
                {!result && showHistory && history.length > 0 && (
                    <HistoryPanel
                        history={history}
                        onLoad={loadFromHistory}
                        onDelete={deleteHistoryEntry}
                        onClearAll={() => {
 saveHistory([], userId); setHistory([]); setShowHistory(false);
}}
                    />
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
                                    className="min-h-48 resize-none rounded-2xl"
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
                                        <span className="hidden text-xs text-muted-foreground sm:inline">{text.length.toLocaleString()} / 15 000</span>
                                        <Button onClick={() => analyze()} disabled={isAnalyzing || !text.trim()}>
                                            {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                                            {isAnalyzing ? 'Elemzés...' : 'Elemzés'}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {mode === 'youtube' && (
                            activeTranscript ? (
                                <YoutubeReader
                                    transcript={activeTranscript}
                                    page={ytPage}
                                    segments={segments}
                                    overview={overview}
                                    isLoadingPage={isLoadingPage}
                                    isAnalyzing={isAnalyzing}
                                    onBack={() => {
 setActiveTranscript(null); setFetchedSource(null); setSegments(null); setOverview(null); setResult(null); 
}}
                                    onPageChange={(page) => loadYtPage(activeTranscript, page)}
                                    onAnalyze={() => analyze(fetchedSource ?? '')}
                                />
                            ) : (
                                <>
                                    <div className="flex gap-2">
                                        <Input
                                            value={urlInput}
                                            onChange={(e) => {
 setUrlInput(e.target.value); setError(null); 
}}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="flex-1"
                                            onKeyDown={(e) => e.key === 'Enter' && !isFetching && loadYoutube(urlInput)}
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={() => loadYoutube(urlInput)}
                                            disabled={isFetching || !urlInput.trim()}
                                        >
                                            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Youtube className="size-4" />}
                                            {isFetching ? 'Felirat letöltése...' : 'Felirat betöltése'}
                                        </Button>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        A videóhoz angol feliratnak kell lennie (auto-generált is megfelel). A teljes felirat
                                        időbélyeges sorokként mentődik — lapozható, később folytatható, és látod a teljes videó ismertségi %-át.
                                    </p>

                                    <YoutubeList
                                        transcripts={transcripts}
                                        youtubeLimit={youtubeLimit}
                                        loaded={youtubeLoaded}
                                        loadBookmark={loadYtBookmark}
                                        onSelect={selectTranscript}
                                        onDelete={deleteTranscript}
                                    />
                                </>
                            )
                        )}

                        {mode === 'url' && (
                            <>
                                <div className="flex gap-2">
                                    <Input
                                        value={urlInput}
                                        onChange={(e) => {
 setUrlInput(e.target.value); setFetchedSource(null); setError(null); 
}}
                                        placeholder="https://example.com/article"
                                        className="flex-1"
                                        onKeyDown={(e) => e.key === 'Enter' && !fetchedSource && fetchSource()}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={() => fetchSource()}
                                        disabled={isFetching || !urlInput.trim() || !!fetchedSource}
                                    >
                                        {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
                                        {isFetching ? 'Betöltés...' : 'Betöltés'}
                                    </Button>
                                </div>

                                {fetchedSource && (
                                    <>
                                        <div className="rounded-2xl bg-muted/50 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-xs font-medium text-muted-foreground">
                                                    Betöltött szöveg ({fetchedSource.length.toLocaleString()} karakter)
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
 setFetchedSource(null); setError(null); 
}}
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
                                {!activeBook && (
                                    <BookList
                                        books={books}
                                        bookLimit={bookLimit}
                                        usedStorage={usedStorage}
                                        booksLoaded={booksLoaded}
                                        isUploading={isUploadingBook}
                                        loadBookmark={loadBookmark}
                                        onUpload={handleBookUpload}
                                        onSelect={selectBook}
                                        onDelete={handleDeleteBook}
                                    />
                                )}

                                {activeBook && fetchedSource !== null && (
                                    <>
                                        <WholeVideoBanner
                                            overview={bookOverview}
                                            heading="A teljes könyvből ismered"
                                            source="könyvben"
                                            loadingLabel="Teljes könyv kiértékelése…"
                                        />
                                        <BookReader
                                            book={activeBook}
                                            page={bookPage}
                                            text={fetchedSource}
                                            isLoadingPage={isLoadingPage}
                                            isAnalyzing={isAnalyzing}
                                            onBack={() => {
 setActiveBook(null); setFetchedSource(null); setBookOverview(null); setResult(null); 
}}
                                            onPageChange={(page) => loadBookPage(activeBook, page)}
                                            onAnalyze={() => analyze(fetchedSource)}
                                        />
                                    </>
                                )}

                                {activeBook && isLoadingPage && !fetchedSource && (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </>
                        )}

                        {error && (
                            <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                                {upgradeUrl && (
                                    <Link href={upgradeUrl} className="ml-2 font-semibold underline underline-offset-2">
                                        Csomagok megtekintése →
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Results */}
                {result && (
                    <AnalysisResultView
                        result={result}
                        activeText={activeText}
                        segments={segments}
                        onWordClick={handleWordClick}
                        onReset={handleResultReset}
                        lookupOpen={lookupWord !== null}
                    >
                        {mode === 'book' && activeBook && (
                            <>
                                <WholeVideoBanner
                                    overview={bookOverview}
                                    heading="A teljes könyvből ismered"
                                    source="könyvben"
                                    loadingLabel="Teljes könyv kiértékelése…"
                                />
                                <BookPager
                                    page={bookPage}
                                    totalPages={activeBook.total_pages}
                                    disabled={isLoadingPage || isAnalyzing}
                                    onPrev={() => loadBookPage(activeBook, bookPage - 1, true)}
                                    onNext={() => loadBookPage(activeBook, bookPage + 1, true)}
                                />
                            </>
                        )}
                        {mode === 'youtube' && activeTranscript && (
                            <>
                                <WholeVideoBanner overview={overview} />
                                <BookPager
                                    page={ytPage}
                                    totalPages={activeTranscript.total_pages}
                                    disabled={isLoadingPage || isAnalyzing}
                                    onPrev={() => loadYtPage(activeTranscript, ytPage - 1, true)}
                                    onNext={() => loadYtPage(activeTranscript, ytPage + 1, true)}
                                />
                            </>
                        )}
                    </AnalysisResultView>
                )}
            </div>

            <WordLookupDialog
                word={lookupWord}
                context={lookupContext}
                hasAiAccess={hasAiAccess}
                onClose={() => {
 setLookupWord(null); setLookupContext(null); 
}}
                onStatusChange={handleLookupStatusChange}
                onCustomAdded={handleCustomAdded}
            />
        </>
    );
}

TextAnalysis.layout = {
    breadcrumbs: [{ title: 'Szövegelemzés', href: textAnalysisShow() }],
};
