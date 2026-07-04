import { Info, Sparkles, Volume2 } from 'lucide-react';
import { memo } from 'react';
import StatusButtons from '@/components/words/status-buttons';
import { speak, statusRowBg, statusRowText } from '@/components/words/types';
import type { CustomWord, Word, WordStatus } from '@/components/words/types';

export type UnifiedItem =
    | { type: 'custom'; data: CustomWord }
    | { type: 'regular'; data: Word };

interface WordRowProps {
    item: UnifiedItem;
    flipMode: boolean;
    hasAiAccess: boolean;
    onSelectWord: (id: number) => void;
    onSelectCustomWord: (id: number) => void;
    onStatus: (word: Word, status: Exclude<WordStatus, null>) => void;
    onCustomStatus: (id: number, status: Exclude<WordStatus, null>) => void;
    onPractice: (word: string, meaning_hu: string | null) => void;
}

/**
 * Egyetlen sor a szólistában. Memoizált: a szülő state-változásai (pl. gépelés
 * a keresőmezőbe) nem renderelik újra az akár 1000 sort, csak ha maga a sor
 * adata vagy a megjelenítési mód változik.
 */
function WordRow({
    item,
    flipMode,
    hasAiAccess,
    onSelectWord,
    onSelectCustomWord,
    onStatus,
    onCustomStatus,
    onPractice,
}: WordRowProps) {
    return (
        <li
            className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${statusRowBg(item.data.status)}`}
        >
            <button
                onClick={() =>
                    item.type === 'custom'
                        ? onSelectCustomWord(item.data.id)
                        : onSelectWord(item.data.id)
                }
                className={`flex-1 text-left underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70 ${
                    flipMode ? 'text-sm font-normal' : 'font-medium'
                } ${statusRowText(item.data.status)}`}
            >
                {flipMode
                    ? (item.data.meaning_hu ?? (
                          <span className="text-muted-foreground italic">
                              (nincs fordítás)
                          </span>
                      ))
                    : item.data.word}
                <Info className="mb-0.5 ml-1 inline size-3 opacity-40" />
                {item.type === 'custom' && (
                    <span className="ml-1.5 rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        saját
                    </span>
                )}
            </button>
            <button
                onClick={() => speak(item.data.word)}
                title="Felolvasás"
                className="hidden shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:block"
            >
                <Volume2 className="size-3.5" />
            </button>
            {hasAiAccess && (
                <button
                    onClick={() =>
                        onPractice(item.data.word, item.data.meaning_hu ?? null)
                    }
                    title="Gyakorlás"
                    className="shrink-0 cursor-pointer rounded p-1 text-violet-500 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/30"
                >
                    <Sparkles className="size-3.5" />
                </button>
            )}
            <StatusButtons
                variant="row"
                current={item.data.status}
                onSelect={(s) =>
                    item.type === 'custom'
                        ? onCustomStatus(item.data.id, s)
                        : onStatus(item.data, s)
                }
            />
        </li>
    );
}

export default memo(WordRow);
