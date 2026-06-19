import { buildRenderTokens } from '@/components/text-analysis/tokenize-render';
import { STATUS_STYLES } from '@/components/text-analysis/types';
import type { TokenStatus } from '@/components/text-analysis/types';

interface HighlightedProps {
    tokenStatuses: Record<string, TokenStatus>;
    phraseStatuses?: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
}

function renderTokens(source: string, { tokenStatuses, phraseStatuses, onWordClick }: HighlightedProps) {
    const sentences = source.split(/(?<=[.!?])\s+/);
    const contextFor = (word: string) =>
        sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))?.trim() ?? source.slice(0, 300);

    return buildRenderTokens(source, tokenStatuses, phraseStatuses ?? {}).map((token, i) => {
        if (token.kind === 'sep') {
            return token.text;
        }

        const className = token.status ? STATUS_STYLES[token.status] : '';

        return (
            <span
                key={i}
                onClick={() => onWordClick?.(token.text, contextFor(token.text))}
                className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-70 ${className}`}
            >
                {token.text}
            </span>
        );
    });
}

function HighlightedParagraph({ para, ...props }: HighlightedProps & { para: string }) {
    return <p className="wrap-break-word leading-7">{renderTokens(para, props)}</p>;
}

export default function HighlightedText({ text, ...props }: HighlightedProps & { text: string }) {
    const paragraphs = text.split(/\n+/).filter((p) => p.trim());

    if (paragraphs.length > 1) {
        return (
            <div className="space-y-4 text-sm">
                {paragraphs.map((para, pi) => (
                    <HighlightedParagraph key={pi} para={para} {...props} />
                ))}
            </div>
        );
    }

    return <p className="whitespace-pre-wrap wrap-break-word text-sm leading-7">{renderTokens(text, props)}</p>;
}
