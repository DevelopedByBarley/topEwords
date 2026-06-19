import { buildRenderTokens } from '@/components/text-analysis/tokenize-render';
import { formatTimestamp, STATUS_STYLES } from '@/components/text-analysis/types';
import type { LyricSegment, TokenStatus } from '@/components/text-analysis/types';

interface LyricsViewProps {
    segments: LyricSegment[];
    tokenStatuses: Record<string, TokenStatus>;
    phraseStatuses?: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
}

function HighlightedLine({
    line,
    tokenStatuses,
    phraseStatuses,
    onWordClick,
}: {
    line: string;
    tokenStatuses: Record<string, TokenStatus>;
    phraseStatuses?: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
}) {
    return (
        <p className="wrap-break-word leading-7">
            {buildRenderTokens(line, tokenStatuses, phraseStatuses ?? {}).map((token, i) => {
                if (token.kind === 'sep') {
                    return token.text;
                }

                const className = token.status ? STATUS_STYLES[token.status] : '';

                return (
                    <span
                        key={i}
                        onClick={() => onWordClick?.(token.text, line)}
                        className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-70 ${className}`}
                    >
                        {token.text}
                    </span>
                );
            })}
        </p>
    );
}

export default function LyricsView({ segments, tokenStatuses, phraseStatuses, onWordClick }: LyricsViewProps) {
    return (
        <div className="flex flex-col">
            {segments.map((seg, i) => (
                <div
                    key={i}
                    className="flex gap-3 border-b border-border/50 py-1.5 last:border-0"
                >
                    <span className="shrink-0 pt-1 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatTimestamp(seg.t)}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                        <HighlightedLine
                            line={seg.x}
                            tokenStatuses={tokenStatuses}
                            phraseStatuses={phraseStatuses}
                            onWordClick={onWordClick}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
