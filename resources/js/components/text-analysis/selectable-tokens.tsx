import { useEffect, useRef, useState } from 'react';
import type { RenderToken } from '@/components/text-analysis/tokenize-render';
import { STATUS_STYLES } from '@/components/text-analysis/types';

/** Egy bekezdés / felirat-sor előre tokenizálva, a kereséshez tartozó kontextussal. */
export interface TokenBlock {
    tokens: RenderToken[];
    /** A kattintott szóhoz adott mondat/sor kontextus a kereséshez. */
    getContext: (word: string) => string;
}

interface SelectableTokensProps {
    blocks: TokenBlock[];
    onWordClick?: (word: string, context: string) => void;
    /** A kereső modal nyitott állapota — záráskor töröljük a kijelölést. */
    lookupOpen?: boolean;
    /** Egy blokk inline tartalmát a saját konténerébe csomagolja (pl. <p> vagy felirat-sor). */
    renderBlock: (inline: React.ReactNode, blockIndex: number) => React.ReactNode;
}

const normalizePhrase = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * Kiemelt, kattintható szavak megjelenítése a szöveg- és felirat-nézethez.
 *
 * - Sima kattintás: egyetlen szót ad át, és azonnal megnyitja a modalt.
 * - Shift+kattintás(ok): a modal NEM ugrik fel, csak a horgony és a kattintott
 *   szó közötti tartomány jelölődik ki. A Shift elengedésekor nyílik meg a modal
 *   az összefűzött, többszavas kifejezéssel.
 * - A modal bezárásakor (vagy elkattintáskor) a kijelölés törlődik.
 */
export default function SelectableTokens({ blocks, onWordClick, lookupOpen, renderBlock }: SelectableTokensProps) {
    const [anchor, setAnchor] = useState<number | null>(null);
    const [range, setRange] = useState<[number, number] | null>(null);

    // Globális, dokumentum-sorrendű indexet rendelünk minden kattintható tokenhez (a
    // szeparátorok -1-et kapnak), és párhuzamosan lapos listát építünk a kereséshez.
    const decorated: { token: RenderToken; index: number }[][] = [];
    const flat: { text: string; context: string }[] = [];
    let counter = 0;

    for (const block of blocks) {
        const row: { token: RenderToken; index: number }[] = [];

        for (const token of block.tokens) {
            if (token.kind === 'sep') {
                row.push({ token, index: -1 });
            } else {
                row.push({ token, index: counter });
                flat.push({ text: token.text, context: block.getContext(token.text) });
                counter += 1;
            }
        }

        decorated.push(row);
    }

    // A Shift-elengedéskor futó dokumentum-szintű figyelő friss értékeket olvas ezekből.
    const rangeRef = useRef<[number, number] | null>(null);
    const flatRef = useRef(flat);
    const onWordClickRef = useRef(onWordClick);
    const shiftSelectedRef = useRef(false);

    useEffect(() => {
        rangeRef.current = range;
        flatRef.current = flat;
        onWordClickRef.current = onWordClick;
    });

    // Shift elengedése → a kijelölt kifejezés átadása (csak ha történt Shift-kattintás).
    useEffect(() => {
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key !== 'Shift' || !shiftSelectedRef.current) {
                return;
            }

            shiftSelectedRef.current = false;
            const selected = rangeRef.current;

            if (!selected) {
                return;
            }

            const [lo, hi] = selected;
            const items = flatRef.current;
            const phrase = normalizePhrase(items.slice(lo, hi + 1).map((f) => f.text).join(' '));
            onWordClickRef.current?.(phrase, items[lo].context);
        };
        window.addEventListener('keyup', handleKeyUp);

        return () => window.removeEventListener('keyup', handleKeyUp);
    }, []);

    // A modal bezárásakor (vagy elkattintáskor) megszüntetjük a kijelölést.
    // Render közbeni, őrzött state-frissítés a React „prop-változásra reagálás" mintája szerint.
    const open = Boolean(lookupOpen);
    const [prevLookupOpen, setPrevLookupOpen] = useState(false);

    if (prevLookupOpen !== open) {
        setPrevLookupOpen(open);

        if (prevLookupOpen && !open) {
            setAnchor(null);
            setRange(null);
        }
    }

    const handleClick = (index: number, shiftKey: boolean) => {
        if (shiftKey) {
            // Shift: csak a kijelölést építjük; a modal NEM nyílik meg kattintáskor.
            shiftSelectedRef.current = true;

            if (anchor === null) {
                setAnchor(index);
                setRange([index, index]);
            } else {
                setRange([Math.min(anchor, index), Math.max(anchor, index)]);
            }

            return;
        }

        setAnchor(index);
        setRange(null);
        onWordClick?.(flat[index].text, flat[index].context);
    };

    return (
        <>
            {decorated.map((row, blockIndex) => {
                const inline = row.map(({ token, index }, ti) => {
                    if (token.kind === 'sep') {
                        return token.text;
                    }

                    const selected = range !== null && index >= range[0] && index <= range[1];
                    const statusClass = token.status ? STATUS_STYLES[token.status] : '';

                    return (
                        <span
                            key={ti}
                            // Shift+kattintásnál ne induljon natív szövegkijelölés.
                            onMouseDown={(e) => {
                                if (e.shiftKey) {
                                    e.preventDefault();
                                }
                            }}
                            onClick={(e) => handleClick(index, e.shiftKey)}
                            className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-70 ${statusClass} ${selected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                        >
                            {token.text}
                        </span>
                    );
                });

                return renderBlock(inline, blockIndex);
            })}
        </>
    );
}
