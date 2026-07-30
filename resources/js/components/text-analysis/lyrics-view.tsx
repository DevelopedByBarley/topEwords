import SelectableTokens from '@/components/text-analysis/selectable-tokens';
import type { TokenBlock } from '@/components/text-analysis/selectable-tokens';
import { buildRenderTokens } from '@/components/text-analysis/tokenize-render';
import { formatTimestamp } from '@/components/text-analysis/types';
import type { LyricSegment, TokenStatus } from '@/components/text-analysis/types';

interface LyricsViewProps {
    segments: LyricSegment[];
    tokenStatuses: Record<string, TokenStatus>;
    phraseStatuses?: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
    lookupOpen?: boolean;
    phraseMode?: boolean;
    onPhraseComplete?: () => void;
}

export default function LyricsView({ segments, tokenStatuses, phraseStatuses, onWordClick, lookupOpen, phraseMode, onPhraseComplete }: LyricsViewProps) {
    const blocks: TokenBlock[] = segments.map((seg) => ({
        tokens: buildRenderTokens(seg.x, tokenStatuses, phraseStatuses ?? {}),
        getContext: () => seg.x,
    }));

    return (
        <div className="flex flex-col">
            <SelectableTokens
                blocks={blocks}
                onWordClick={onWordClick}
                lookupOpen={lookupOpen}
                phraseMode={phraseMode}
                onPhraseComplete={onPhraseComplete}
                renderBlock={(inline, i) => (
                    <div key={i} className="flex gap-3 border-b border-border/50 py-1.5 last:border-0">
                        <span className="shrink-0 pt-1 font-mono text-xs tabular-nums text-muted-foreground">
                            {formatTimestamp(segments[i].t)}
                        </span>
                        <div className="min-w-0 flex-1 text-sm">
                            <p className="wrap-break-word leading-7">{inline}</p>
                        </div>
                    </div>
                )}
            />
        </div>
    );
}
