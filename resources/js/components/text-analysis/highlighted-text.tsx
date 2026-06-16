import { STATUS_STYLES } from '@/components/text-analysis/types';
import type { TokenStatus } from '@/components/text-analysis/types';

interface HighlightedProps {
    tokenStatuses: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
}

function HighlightedParagraph({ para, tokenStatuses, onWordClick }: HighlightedProps & { para: string }) {
    const parts = para.split(/([a-zA-Z]+(?:['’][a-zA-Z]+)*)/);
    const extractSentence = (word: string) => {
        const sentences = para.split(/(?<=[.!?])\s+/);
        return sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))?.trim() ?? para.slice(0, 300);
    };
    return (
        <p className="wrap-break-word leading-7">
            {parts.map((part, i) => {
                if (i % 2 === 0) return part;
                const status = tokenStatuses[part.toLowerCase()];
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

export default function HighlightedText({ text, tokenStatuses, onWordClick }: HighlightedProps & { text: string }) {
    const paragraphs = text.split(/\n+/).filter((p) => p.trim());

    if (paragraphs.length > 1) {
        return (
            <div className="space-y-4 text-sm">
                {paragraphs.map((para, pi) => (
                    <HighlightedParagraph key={pi} para={para} tokenStatuses={tokenStatuses} onWordClick={onWordClick} />
                ))}
            </div>
        );
    }

    const parts = text.split(/([a-zA-Z]+(?:['’][a-zA-Z]+)*)/);
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
                const status = tokenStatuses[part.toLowerCase()];
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
