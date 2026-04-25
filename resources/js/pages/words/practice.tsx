import { Head, Link } from '@inertiajs/react';
import { AlertCircle, BookMarked, CheckCheck, CheckCircle2, Clock, Loader2, Mic, PenLine, Plus, Search, Sparkles, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { index } from '@/routes/words';

type TargetWord = {
    word: string;
    meaning_hu: string | null;
};

type SearchResult = {
    id: number;
    word: string;
    meaning_hu: string | null;
    is_custom: boolean;
};

type WordResult = {
    word: string;
    used: boolean;
    correct: boolean;
    feedback_hu: string;
};

type CheckResult = {
    words: WordResult[];
    grammar_issues: string[];
    overall_hu: string;
    corrected_text: string | null;
};

function getXsrfToken(): string {
    const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

type PracticeWord = { id: number; word: string; meaning_hu: string | null; is_custom: boolean };

export default function WordsPractice({ preWords, practiceWords: initialPracticeWords }: { preWords: string[]; practiceWords: PracticeWord[] }) {
    const [targetWords, setTargetWords] = useState<TargetWord[]>(
        preWords.map((w) => ({ word: w, meaning_hu: null })),
    );
    const [practiceWords, setPracticeWords] = useState<PracticeWord[]>(initialPracticeWords);
    const [statusModalWord, setStatusModalWord] = useState<PracticeWord | null>(null);
    const [statusUpdating, setStatusUpdating] = useState(false);

    const STATUS_OPTIONS = [
        { value: 'known',         label: 'Tudom',        Icon: CheckCheck, cls: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-400' },
        { value: 'learning',      label: 'Tanulom',      Icon: Clock,      cls: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400' },
        { value: 'saved',         label: 'Később',       Icon: BookMarked, cls: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-400' },
        { value: 'pronunciation', label: 'Kiejtés',      Icon: Mic,        cls: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-400' },
        { value: 'practice',      label: 'Gyakorlásra',  Icon: PenLine,    cls: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-400' },
    ] as const;

    async function updateWordStatus(pw: PracticeWord, newStatus: string | null) {
        setStatusUpdating(true);
        const url = pw.is_custom ? `/custom-words/${pw.id}/status` : `/words/${pw.id}/status`;
        const body = newStatus ? { status: newStatus } : { status: 'practice' };
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-XSRF-TOKEN': getXsrfToken() },
            body: JSON.stringify(body),
        }).catch(() => {});
        if (newStatus !== 'practice') {
            setPracticeWords((prev) => prev.filter((w) => !(w.id === pw.id && w.is_custom === pw.is_custom)));
            setTargetWords((prev) => prev.filter((w) => w.word.toLowerCase() !== pw.word.toLowerCase()));
        }
        setStatusUpdating(false);
        setStatusModalWord(null);
    }
    const [wordInput, setWordInput] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<CheckResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const searchWords = useCallback((q: string) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (q.trim().length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
        searchTimeout.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/words/search?q=${encodeURIComponent(q)}`, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
                const data = await res.json();
                setSearchResults(Array.isArray(data) ? data : []);
                setShowDropdown(true);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 250);
    }, []);

    function addWord(word: string, meaning_hu: string | null) {
        const normalized = word.trim().toLowerCase();
        if (!normalized) return;
        if (targetWords.some((w) => w.word.toLowerCase() === normalized)) return;
        if (targetWords.length >= 10) return;
        setTargetWords((prev) => [...prev, { word: word.trim(), meaning_hu }]);
        setWordInput('');
        setSearchResults([]);
        setShowDropdown(false);
        setResult(null);
    }

    function addManual() {
        addWord(wordInput, null);
    }

    function removeWord(word: string) {
        setTargetWords((prev) => prev.filter((w) => w.word !== word));
        setResult(null);
    }

    async function handleCheck() {
        if (targetWords.length === 0 || text.trim().length < 5) return;
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await fetch('/words/practice/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({ words: targetWords, text: text.trim() }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error ?? 'Ismeretlen hiba.');
            } else {
                setResult(data as CheckResult);
            }
        } catch {
            setError('Kapcsolódási hiba.');
        } finally {
            setLoading(false);
        }
    }

    const canCheck = targetWords.length > 0 && text.trim().length >= 5 && !loading;

    return (
        <>
            <Head title="Szabad írás gyakorlás" />
            <div className="px-4 py-6 space-y-6">
                <Heading
                    title="Szabad írás gyakorlás"
                    description="Adj hozzá célszavakat, írj szabadon, az AI ellenőrzi a szóhasználatot és a grammatikát."
                />

                <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
                    {/* Left: target words */}
                    <div className="space-y-4">
                        <div className="rounded-xl border bg-card p-4 space-y-3">
                            <p className="text-sm font-semibold">Célszavak <span className="text-muted-foreground font-normal">({targetWords.length}/10)</span></p>

                            {/* Practice-status words */}
                            {practiceWords.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gyakorlásra jelölt szavak</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {practiceWords.map((pw) => {
                                            const alreadyAdded = targetWords.some(
                                                (w) => w.word.toLowerCase() === pw.word.toLowerCase(),
                                            );
                                            return (
                                                <div key={pw.word} className="flex items-center gap-0.5">
                                                    <button
                                                        onClick={() => !alreadyAdded && addWord(pw.word, pw.meaning_hu)}
                                                        disabled={alreadyAdded || targetWords.length >= 10}
                                                        title={pw.meaning_hu ?? pw.word}
                                                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-default ${
                                                            alreadyAdded
                                                                ? 'border-rose-300 bg-rose-50 text-rose-600 opacity-60 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                                                                : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60'
                                                        }`}
                                                    >
                                                        {alreadyAdded && <CheckCircle2 className="size-3 shrink-0" />}
                                                        <span>{pw.word}</span>
                                                        {pw.meaning_hu && (
                                                            <span className="opacity-60 hidden sm:inline">· {pw.meaning_hu}</span>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setStatusModalWord(pw)}
                                                        title="Státusz módosítása"
                                                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Search/add input */}
                            <div className="relative" ref={dropdownRef}>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        {searching
                                            ? <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-muted-foreground" />
                                            : <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                        }
                                        <input
                                            type="text"
                                            value={wordInput}
                                            onChange={(e) => {
                                                setWordInput(e.target.value);
                                                searchWords(e.target.value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); addManual(); }
                                                if (e.key === 'Escape') setShowDropdown(false);
                                            }}
                                            placeholder="Szó keresése..."
                                            className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                                            disabled={targetWords.length >= 10}
                                        />
                                    </div>
                                    <button
                                        onClick={addManual}
                                        disabled={!wordInput.trim() || targetWords.length >= 10}
                                        className="rounded-md border bg-primary px-2.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                                        title="Hozzáadás"
                                    >
                                        <Plus className="size-4" />
                                    </button>
                                </div>

                                {/* Dropdown */}
                                {showDropdown && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md overflow-hidden">
                                        {searchResults.map((r) => (
                                            <button
                                                key={`${r.is_custom ? 'c' : 'w'}-${r.id}`}
                                                onClick={() => addWord(r.word, r.meaning_hu)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                                            >
                                                <span className="font-medium flex-1">{r.word}</span>
                                                {r.meaning_hu && (
                                                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">{r.meaning_hu}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Word chips */}
                            {targetWords.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                    Adj hozzá szavakat a szólistából vagy gépelje be kézzel.
                                </p>
                            ) : (
                                <ul className="space-y-1.5">
                                    {targetWords.map((w) => {
                                        const wordResult = result?.words.find(
                                            (r) => r.word.toLowerCase() === w.word.toLowerCase(),
                                        );
                                        return (
                                            <li
                                                key={w.word}
                                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                                    wordResult
                                                        ? wordResult.correct
                                                            ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
                                                            : wordResult.used
                                                              ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                                                              : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                                                        : 'border-border bg-muted/30'
                                                }`}
                                            >
                                                {wordResult && (
                                                    wordResult.correct
                                                        ? <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                                                        : <XCircle className="size-3.5 shrink-0 text-red-500" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <span className="font-medium">{w.word}</span>
                                                    {w.meaning_hu && (
                                                        <span className="ml-1.5 text-xs text-muted-foreground truncate">{w.meaning_hu}</span>
                                                    )}
                                                    {wordResult && (
                                                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{wordResult.feedback_hu}</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeWord(w.word)}
                                                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* Word list link */}
                        <p className="text-xs text-muted-foreground text-center">
                            <Link href={index()} className="underline underline-offset-2 hover:text-foreground transition-colors">
                                ← Vissza a szólistához
                            </Link>
                        </p>
                    </div>

                    {/* Right: writing area */}
                    <div className="space-y-4">
                        <div className="rounded-xl border bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold">Írj szabadon</p>
                                <span className="text-xs text-muted-foreground">{text.length} / 3000</span>
                            </div>
                            <Textarea
                                value={text}
                                onChange={(e) => { setText(e.target.value.slice(0, 3000)); setResult(null); }}
                                placeholder="Írj mondatokat, bekezdést, bármit — próbáld beleépíteni a célszavakat természetes módon..."
                                className="min-h-96 resize-y text-base leading-relaxed"
                            />
                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleCheck}
                                    disabled={!canCheck}
                                    className="gap-2 border-violet-200 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-800"
                                >
                                    {loading
                                        ? <Loader2 className="size-4 animate-spin" />
                                        : <Sparkles className="size-4" />
                                    }
                                    {loading ? 'Ellenőrzés...' : 'Ellenőrzés'}
                                </Button>
                                {targetWords.length === 0 && (
                                    <p className="text-xs text-muted-foreground">Adj hozzá legalább 1 célszót.</p>
                                )}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                <AlertCircle className="size-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Result */}
                        {result && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Overall */}
                                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="size-4 shrink-0 mt-0.5 text-violet-600" />
                                        <p className="text-sm text-violet-800 dark:text-violet-300">{result.overall_hu}</p>
                                    </div>
                                </div>

                                {/* Grammar issues */}
                                {result.grammar_issues.length > 0 && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1 dark:border-amber-800 dark:bg-amber-950/30">
                                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Grammatikai megjegyzések</p>
                                        <ul className="space-y-1">
                                            {result.grammar_issues.map((issue, i) => (
                                                <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                                                    <span className="mt-1 size-1 rounded-full bg-amber-500 shrink-0" />
                                                    {typeof issue === 'string' ? issue : ((issue as any).explanation_hu ?? (issue as any).issue ?? JSON.stringify(issue))}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Corrected text */}
                                {result.corrected_text && (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-1 dark:border-blue-800 dark:bg-blue-950/30">
                                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Javított változat</p>
                                        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">{result.corrected_text}</p>
                                    </div>
                                )}

                                {result.grammar_issues.length === 0 && !result.corrected_text && (
                                    <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                                        <CheckCircle2 className="size-4 shrink-0" />
                                        Grammatikailag helyes szöveg!
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status modal */}
            <Dialog open={statusModalWord !== null} onOpenChange={(open) => { if (!open) setStatusModalWord(null); }}>
                <DialogContent className="sm:max-w-xs w-[calc(100vw-2rem)]">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {statusModalWord?.word}
                            {statusModalWord?.meaning_hu && (
                                <span className="ml-2 text-sm font-normal text-muted-foreground">{statusModalWord.meaning_hu}</span>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 pt-1">
                        {STATUS_OPTIONS.map(({ value, label, Icon, cls }) => (
                            <button
                                key={value}
                                disabled={statusUpdating}
                                onClick={() => statusModalWord && updateWordStatus(statusModalWord, value === 'practice' ? null : value)}
                                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                                    value === 'practice' ? 'bg-secondary text-muted-foreground hover:bg-destructive/10 hover:text-destructive' : cls
                                }`}
                            >
                                <Icon className="size-4 shrink-0" />
                                {value === 'practice' ? 'Eltávolítás a gyakorlásra listából' : label}
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

WordsPractice.layout = {
    breadcrumbs: [
        { title: 'Szavak', href: index() },
        { title: 'Szabad írás gyakorlás', href: '#' },
    ],
};
