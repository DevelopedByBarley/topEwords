import { ChevronLeft, ChevronRight, Loader2, ScanText, Trash2, Youtube } from 'lucide-react';
import LyricsView from '@/components/text-analysis/lyrics-view';
import type { LyricSegment, VideoOverview, YoutubeTranscript } from '@/components/text-analysis/types';
import { Button } from '@/components/ui/button';

/** „A teljes videóból/könyvből X%-át ismered" sáv. `'failed'`-nél nem jelenik meg. */
export function WholeVideoBanner({
    overview,
    heading = 'A teljes videóból ismered',
    source = 'feliratban',
    loadingLabel = 'Teljes videó kiértékelése…',
}: {
    overview: VideoOverview | 'failed' | null;
    heading?: string;
    source?: string;
    loadingLabel?: string;
}) {
    if (overview === 'failed') {
        return null;
    }

    if (!overview) {
        return (
            <div className="flex items-center gap-2 rounded-3xl bg-card p-4 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="size-4 animate-spin" />
                {loadingLabel}
            </div>
        );
    }

    const barColor =
        overview.comprehension >= 90 ? 'bg-green-500'
        : overview.comprehension >= 70 ? 'bg-blue-500'
        : overview.comprehension >= 50 ? 'bg-yellow-500'
        : 'bg-red-500';

    return (
        <div className="rounded-3xl bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{heading}</span>
                <span className="text-2xl font-bold tabular-nums">{overview.comprehension}%</span>
            </div>
            <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                    className={`h-2.5 rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${overview.comprehension}%` }}
                />
            </div>
            <p className="text-xs text-muted-foreground">
                {overview.knownCount.toLocaleString()} ismert szó / {overview.totalWords.toLocaleString()} szó a teljes {source}
            </p>
        </div>
    );
}

interface YoutubeListProps {
    transcripts: YoutubeTranscript[];
    youtubeLimit: number;
    loaded: boolean;
    loadBookmark: (id: number) => number;
    onSelect: (t: YoutubeTranscript) => void;
    onDelete: (t: YoutubeTranscript) => void;
}

export function YoutubeList({ transcripts, youtubeLimit, loaded, loadBookmark, onSelect, onDelete }: YoutubeListProps) {
    if (!loaded) {
        return (
            <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (transcripts.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
                Mentett feliratok: {transcripts.length} / {youtubeLimit}
            </p>
            <div className="flex flex-col divide-y rounded-3xl bg-card shadow-sm">
                {transcripts.map((t) => {
                    const bookmark = loadBookmark(t.id);

                    return (
                        <div key={t.id} className="group flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-3xl last:rounded-b-3xl hover:bg-accent/40">
                            <Youtube className="size-4 shrink-0 text-red-500" />
                            <button type="button" onClick={() => onSelect(t)} className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium">{t.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    {t.total_pages} oldal
                                    {bookmark > 1 && (
                                        <span className="ml-2 font-medium text-primary">· Könyvjelző: {bookmark}. oldal</span>
                                    )}
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(t)}
                                className="shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                            >
                                <Trash2 className="size-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface YoutubeReaderProps {
    transcript: YoutubeTranscript;
    page: number;
    segments: LyricSegment[] | null;
    overview: VideoOverview | 'failed' | null;
    isLoadingPage: boolean;
    isAnalyzing: boolean;
    onBack: () => void;
    onPageChange: (page: number) => void;
    onAnalyze: () => void;
}

export function YoutubeReader({ transcript, page, segments, overview, isLoadingPage, isAnalyzing, onBack, onPageChange, onAnalyze }: YoutubeReaderProps) {
    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="size-3.5" />
                    Feliratok
                </button>
                <p className="truncate text-xs font-medium text-muted-foreground">{transcript.title}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{page} / {transcript.total_pages}</span>
            </div>

            <WholeVideoBanner overview={overview} />

            <div className="max-h-80 overflow-y-auto rounded-3xl bg-card px-5 py-4 text-sm leading-7 shadow-sm">
                {segments && segments.length > 0 ? (
                    <LyricsView segments={segments} tokenStatuses={{}} />
                ) : (
                    <div className="flex justify-center py-6">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || isLoadingPage}>
                    {isLoadingPage ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                    Előző
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= transcript.total_pages || isLoadingPage}>
                        Következő
                        {isLoadingPage ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                    </Button>
                    <Button size="sm" onClick={onAnalyze} disabled={isAnalyzing || isLoadingPage}>
                        {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                        {isAnalyzing ? 'Elemzés...' : 'Oldal elemzése'}
                    </Button>
                </div>
            </div>
        </>
    );
}
