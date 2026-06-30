import SelectableTokens from '@/components/text-analysis/selectable-tokens';
import type { TokenBlock } from '@/components/text-analysis/selectable-tokens';
import { buildRenderTokens } from '@/components/text-analysis/tokenize-render';
import type { TokenStatus } from '@/components/text-analysis/types';

interface HighlightedProps {
    text: string;
    tokenStatuses: Record<string, TokenStatus>;
    phraseStatuses?: Record<string, TokenStatus>;
    onWordClick?: (word: string, context: string) => void;
    lookupOpen?: boolean;
}

export default function HighlightedText({ text, tokenStatuses, phraseStatuses, onWordClick, lookupOpen }: HighlightedProps) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const getContext = (word: string) =>
        sentences.find((s) => s.toLowerCase().includes(word.toLowerCase()))?.trim() ?? text.slice(0, 300);

    const paragraphs = text.split(/\n+/).filter((p) => p.trim());
    const sources = paragraphs.length > 1 ? paragraphs : [text];
    const multiPara = paragraphs.length > 1;

    const blocks: TokenBlock[] = sources.map((source) => ({
        tokens: buildRenderTokens(source, tokenStatuses, phraseStatuses ?? {}),
        getContext,
    }));

    return (
        <div className={multiPara ? 'space-y-4 text-sm' : 'text-sm'}>
            <SelectableTokens
                blocks={blocks}
                onWordClick={onWordClick}
                lookupOpen={lookupOpen}
                renderBlock={(inline, i) =>
                    multiPara ? (
                        <p key={i} className="wrap-break-word leading-7">
                            {inline}
                        </p>
                    ) : (
                        <p key={i} className="whitespace-pre-wrap wrap-break-word leading-7">
                            {inline}
                        </p>
                    )
                }
            />
        </div>
    );
}
