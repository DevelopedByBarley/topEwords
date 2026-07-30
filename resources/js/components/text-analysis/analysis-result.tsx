import { Highlighter, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import HighlightedText from '@/components/text-analysis/highlighted-text';
import LyricsView from '@/components/text-analysis/lyrics-view';
import { ALWAYS_SHOWN_STATUSES, TOKEN_STATUS_META } from '@/components/text-analysis/types';
import type { AnalysisResult, LyricSegment, TokenStatus } from '@/components/text-analysis/types';
import { Button } from '@/components/ui/button';

interface AnalysisResultViewProps {
    result: AnalysisResult;
    activeText: string;
    segments?: LyricSegment[] | null;
    onWordClick: (word: string, context: string) => void;
    onReset: () => void;
    lookupOpen?: boolean;
    children?: React.ReactNode;
}

export default function AnalysisResultView({ result, activeText, segments, onWordClick, onReset, lookupOpen, children }: AnalysisResultViewProps) {
    // Koppintásos kifejezés-jelölés: érintőképernyőn nincs Shift, ezért a
    // többszavas felvitel csak ezen az úton érhető el.
    const [phraseMode, setPhraseMode] = useState(false);

    const comprehensionColor =
        result.comprehension >= 90 ? 'text-green-600 dark:text-green-400'
        : result.comprehension >= 70 ? 'text-blue-600 dark:text-blue-400'
        : result.comprehension >= 50 ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400';

    const comprehensionBarColor =
        result.comprehension >= 90 ? 'bg-green-500'
        : result.comprehension >= 70 ? 'bg-blue-500'
        : result.comprehension >= 50 ? 'bg-yellow-500'
        : 'bg-red-500';

    const inListUnknownCount = Object.values(result.tokenStatuses).filter((s) => s === 'in_list').length;

    // A jelmagyarázat csak a szövegben tényleg előforduló státuszokat sorolja fel
    // (a négy alap mindig látszik) — így nem indul hét csempével.
    const presentStatuses = new Set<TokenStatus>([
        ...Object.values(result.tokenStatuses),
        ...Object.values(result.phraseStatuses ?? {}),
    ]);
    const legendStatuses = (Object.keys(TOKEN_STATUS_META) as TokenStatus[]).filter(
        (status) => ALWAYS_SHOWN_STATUSES.includes(status) || presentStatuses.has(status),
    );

    const lyricSegments = segments && segments.length > 0 ? segments : null;

    return (
        <div className="flex flex-col gap-5">
            {/* Comprehension score */}
            <div className="rounded-3xl bg-card p-5 shadow-sm">
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
                    <Button variant="ghost" size="icon" onClick={onReset} title="Új elemzés" aria-label="Elemzés bezárása, új elemzés indítása">
                        <X className="size-4" />
                    </Button>
                </div>

                <div
                    className="mb-5 h-3 w-full overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-valuenow={result.comprehension}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Érthetőség"
                >
                    <div
                        className={`h-3 rounded-full transition-all duration-700 ${comprehensionBarColor}`}
                        style={{ width: `${result.comprehension}%` }}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="flex flex-col gap-1 rounded-2xl bg-green-50 p-3 dark:bg-green-950/20">
                        <span className="text-xs text-green-700 dark:text-green-400">Tudom</span>
                        <span className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
                            {result.knownCount.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/20">
                        <span className="text-xs text-blue-700 dark:text-blue-400">Tanulom</span>
                        <span className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
                            {result.learningCount.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-2xl bg-red-50 p-3 dark:bg-red-950/20">
                        <span className="text-xs text-red-700 dark:text-red-400">Top 10k, ismeretlen</span>
                        <span className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
                            {inListUnknownCount.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-2xl bg-muted p-3">
                        <span className="text-xs text-muted-foreground">Egyedi szavak</span>
                        <span className="text-2xl font-bold tabular-nums">
                            {result.uniqueWords.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
                {legendStatuses.map((status) => {
                    const { label, highlight, icon: Icon, iconClass } = TOKEN_STATUS_META[status];

                    return (
                        <span key={status} className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-sm">
                            <Icon className={`size-3 ${iconClass}`} />
                            {highlight && <span className={`rounded px-1 ${highlight}`}>szó</span>}
                            {label}
                        </span>
                    );
                })}
            </div>

            {/* Highlighted text / lyrics */}
            <div className="rounded-3xl bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                        {lyricSegments ? 'Felirat időbélyegekkel' : 'Szöveg kiemelésekkel'}
                    </p>
                    <button
                        type="button"
                        onClick={() => setPhraseMode((v) => !v)}
                        aria-pressed={phraseMode}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            phraseMode
                                ? 'bg-indigo-500 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                    >
                        <Highlighter className="size-3.5" />
                        {phraseMode ? 'Kifejezés-jelölés kikapcsolása' : 'Kifejezés jelölése'}
                    </button>
                </div>

                <p className="mt-1 mb-3 text-xs text-muted-foreground" aria-live="polite">
                    {phraseMode ? (
                        <>Koppints a kifejezés <strong>első</strong>, majd az <strong>utolsó</strong> szavára — a jelentés ekkor nyílik meg.</>
                    ) : (
                        <>
                            Kattints egy szóra a jelentéséhez — billentyűzetről a nyilakkal lépkedhetsz, Enterrel nyithatsz.
                            <span className="hidden pointer-fine:inline">
                                {' '}Kifejezéshez tartsd lenyomva a{' '}
                                <kbd className="rounded border bg-muted px-1 font-sans">Shift</kbd> billentyűt, jelöld ki a szavakat, és engedd el.
                            </span>
                        </>
                    )}
                </p>

                {lyricSegments ? (
                    <LyricsView
                        segments={lyricSegments}
                        tokenStatuses={result.tokenStatuses}
                        phraseStatuses={result.phraseStatuses}
                        onWordClick={onWordClick}
                        lookupOpen={lookupOpen}
                        phraseMode={phraseMode}
                        onPhraseComplete={() => setPhraseMode(false)}
                    />
                ) : (
                    <HighlightedText
                        text={activeText}
                        tokenStatuses={result.tokenStatuses}
                        phraseStatuses={result.phraseStatuses}
                        onWordClick={onWordClick}
                        lookupOpen={lookupOpen}
                        phraseMode={phraseMode}
                        onPhraseComplete={() => setPhraseMode(false)}
                    />
                )}
            </div>

            {/* Top unknown words */}
            {result.topUnknown.length > 0 && (
                <div className="rounded-3xl bg-card p-5 shadow-sm">
                    <p className="mb-3 text-sm font-medium">
                        Leggyakoribb ismeretlen szavak a top 10 000-ből
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                        {result.topUnknown.map((item) => (
                            <button
                                key={item.word}
                                type="button"
                                onClick={() => onWordClick(item.word, '')}
                                className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate font-medium">{item.word}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">#{item.rank}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="max-w-32 truncate text-xs text-muted-foreground">{item.meaning_hu}</span>
                                    <span className="rounded-full bg-background px-1.5 py-0.5 text-xs font-medium tabular-nums">
                                        ×{item.frequency}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {children}

            <Button variant="outline" onClick={onReset} className="self-start">
                <RotateCcw className="size-4" />
                Új elemzés
            </Button>
        </div>
    );
}
