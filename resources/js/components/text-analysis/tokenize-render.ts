import type { TokenStatus } from '@/components/text-analysis/types';

/** One renderable unit: raw separator, a single word, or a multi-word phrase. */
export type RenderToken =
    | { kind: 'sep'; text: string }
    | { kind: 'word'; text: string; status?: TokenStatus }
    | { kind: 'phrase'; text: string; status?: TokenStatus };

// Splits text into [separator, word, separator, word, …] — words at odd indices.
const WORD_SPLIT = /([a-zA-Z]+(?:['’][a-zA-Z]+)*)/;

// The backend keys statuses with straight apostrophes and lowercase; mirror that
// here so "I'm", "can't" and curly-apostrophe variants line up.
export const tokenKey = (word: string): string =>
    word.toLowerCase().replace(/[‘’′]/g, "'");

const MAX_PHRASE_WORDS = 3;

/**
 * Turn display text into render tokens, greedily matching the longest known
 * multi-word phrase first (e.g. "cut through") so a phrase is highlighted as a
 * single unit instead of colouring its individual words. A phrase only matches
 * when its words are adjacent across plain whitespace (so "a, b" is never one).
 */
export function buildRenderTokens(
    text: string,
    tokenStatuses: Record<string, TokenStatus>,
    phraseStatuses: Record<string, TokenStatus> = {},
): RenderToken[] {
    const parts = text.split(WORD_SPLIT);
    const tokens: RenderToken[] = [];
    const hasPhrases = Object.keys(phraseStatuses).length > 0;

    let i = 0;
    while (i < parts.length) {
        // Separators occupy the even slots.
        if (i % 2 === 0) {
            if (parts[i] !== '') {
                tokens.push({ kind: 'sep', text: parts[i] });
            }
            i += 1;
            continue;
        }

        let matched = false;

        if (hasPhrases) {
            for (let n = MAX_PHRASE_WORDS; n >= 2; n -= 1) {
                const lastWordIdx = i + (n - 1) * 2;
                if (lastWordIdx >= parts.length) {
                    continue;
                }

                const words: string[] = [];
                let adjacent = true;

                for (let k = 0; k < n; k += 1) {
                    words.push(parts[i + k * 2]);
                    // The separator between consecutive phrase words must be whitespace only.
                    if (k < n - 1 && !/^\s+$/.test(parts[i + k * 2 + 1] ?? '')) {
                        adjacent = false;
                        break;
                    }
                }

                if (!adjacent) {
                    continue;
                }

                const status = phraseStatuses[words.map(tokenKey).join(' ')];

                if (status) {
                    tokens.push({ kind: 'phrase', text: parts.slice(i, lastWordIdx + 1).join(''), status });
                    i = lastWordIdx + 1;
                    matched = true;
                    break;
                }
            }
        }

        if (matched) {
            continue;
        }

        tokens.push({ kind: 'word', text: parts[i], status: tokenStatuses[tokenKey(parts[i])] });
        i += 1;
    }

    return tokens;
}
