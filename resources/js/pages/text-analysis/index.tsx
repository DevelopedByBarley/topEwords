import { Head } from '@inertiajs/react';
import { BookOpen, CheckCheck, Clock, FileText, Globe, HelpCircle, History, Loader2, ScanText, Trash2, X, Youtube } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { show as textAnalysisShow } from '@/routes/text-analysis';

type InputMode = 'text' | 'youtube' | 'url';

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

function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'date'>) {
    const entries = loadHistory();
    const newEntry: HistoryEntry = { ...entry, id: Date.now(), date: new Date().toLocaleDateString('hu-HU') };
    const filtered = entries.filter((e) => e.label !== entry.label || e.mode !== entry.mode);
    saveHistory([newEntry, ...filtered].slice(0, MAX_HISTORY));
}

const MODE_ICONS: Record<InputMode, React.ElementType> = { text: FileText, youtube: Youtube, url: Globe };
type TokenStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | 'in_list' | 'not_in_list';

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

const EXAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. Learning new words every day is one of the best investments you can make in your language skills. Reading books, articles, and other written materials helps you encounter words in context, which makes them much easier to remember.`;

function HighlightedText({ text, tokenStatuses }: { text: string; tokenStatuses: Record<string, TokenStatus> }) {
    const parts = text.split(/([a-zA-Z]+)/);

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
                    <span key={i} className={className ? `rounded px-0.5 ${className}` : undefined}>
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
    const [mode, setMode] = useState<InputMode>('text');
    const [text, setText] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [fetchedSource, setFetchedSource] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
    const [showHistory, setShowHistory] = useState(false);

    const refreshHistory = () => setHistory(loadHistory());

    const reset = () => {
        setResult(null);
        setFetchedSource(null);
        setError(null);
    };

    const switchMode = (m: InputMode) => {
        setMode(m);
        reset();
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
        if (!urlInput.trim()) return;
        setIsFetching(true);
        setError(null);
        setFetchedSource(null);

        try {
            const { ok, data } = await postJson('/text-analysis/fetch-source', { url: urlInput });
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

            const label = mode === 'text'
                ? input.slice(0, 80).trim() + (input.length > 80 ? '…' : '')
                : urlInput;
            addHistoryEntry({ mode, label, text: input, url: mode !== 'text' ? urlInput : undefined });
            refreshHistory();
        } catch {
            setError('Hálózati hiba. Próbáld újra.');
        } finally {
            setIsAnalyzing(false);
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
                                        onClick={fetchSource}
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
                            <HighlightedText text={activeText} tokenStatuses={result.tokenStatuses} />
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

                        <Button variant="outline" onClick={reset} className="self-start">
                            Új elemzés
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}

TextAnalysis.layout = {
    breadcrumbs: [{ title: 'Szövegelemzés', href: textAnalysisShow() }],
};
