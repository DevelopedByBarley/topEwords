import { useEffect, useRef, useState } from 'react';
import type { RenderToken } from '@/components/text-analysis/tokenize-render';
import { MAX_PHRASE_WORDS } from '@/components/text-analysis/tokenize-render';
import { STATUS_STYLES } from '@/components/text-analysis/types';
import { showToast } from '@/lib/toast';

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
    /**
     * Koppintással jelölhető kifejezés-mód: Shift nélkül is kijelölhető
     * tartomány, hogy a funkció mobilon (ahol nincs Shift) is elérhető legyen.
     */
    phraseMode?: boolean;
    /** A kifejezés átadása után hívjuk, hogy a hívó kiléphessen a kifejezés-módból. */
    onPhraseComplete?: () => void;
    /** Egy blokk inline tartalmát a saját konténerébe csomagolja (pl. <p> vagy felirat-sor). */
    renderBlock: (inline: React.ReactNode, blockIndex: number) => React.ReactNode;
}

interface FlatToken {
    text: string;
    context: string;
}

const normalizePhrase = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * A kijelölt tartomány átadása a kereső modalnak.
 *
 * @return Igaz, ha a kifejezés átadható volt (a plafonnál hosszabb nem az).
 */
function commitPhrase(
    lo: number,
    hi: number,
    items: FlatToken[],
    onWordClick?: (word: string, context: string) => void,
): boolean {
    // A kijelölt kifejezésnek a kiemelés-motor plafonjához kell igazodnia —
    // hosszabb kifejezés menthető lenne, de olvasáskor a mohó n-gram illesztés
    // (MAX_PHRASE_WORDS) sosem festené ki.
    if (hi - lo + 1 > MAX_PHRASE_WORDS) {
        showToast('error', `Legfeljebb ${MAX_PHRASE_WORDS} szavas kifejezés jelölhető ki.`);

        return false;
    }

    const phrase = normalizePhrase(items.slice(lo, hi + 1).map((f) => f.text).join(' '));
    onWordClick?.(phrase, items[lo].context);

    return true;
}

/**
 * Kiemelt, kattintható szavak megjelenítése a szöveg- és felirat-nézethez.
 *
 * - Sima kattintás: egyetlen szót ad át, és azonnal megnyitja a modalt.
 * - Shift+kattintás(ok): a modal NEM ugrik fel, csak a horgony és a kattintott
 *   szó közötti tartomány jelölődik ki. A Shift elengedésekor nyílik meg a modal
 *   az összefűzött, többszavas kifejezéssel.
 * - Kifejezés-módban (`phraseMode`) Shift nélkül is megy: az első koppintás a
 *   kezdet, a második a vég — ez az egyetlen elérhető út érintőképernyőn.
 * - A modal bezárásakor (vagy elkattintáskor) a kijelölés törlődik.
 *
 * Billentyűzet: a szó-folyam egyetlen tab-stop (roving tabindex), a nyilakkal
 * lépkedni, Enterrel/Space-szel megnyitni lehet — így több ezer szó sem tesz
 * végigtabbolhatatlanná egy oldalt.
 */
export default function SelectableTokens({
    blocks,
    onWordClick,
    lookupOpen,
    phraseMode = false,
    onPhraseComplete,
    renderBlock,
}: SelectableTokensProps) {
    const [anchor, setAnchor] = useState<number | null>(null);
    const [range, setRange] = useState<[number, number] | null>(null);
    const [focusIndex, setFocusIndex] = useState(0);

    // Globális, dokumentum-sorrendű indexet rendelünk minden kattintható tokenhez (a
    // szeparátorok -1-et kapnak), és párhuzamosan lapos listát építünk a kereséshez.
    const decorated: { token: RenderToken; index: number }[][] = [];
    const flat: FlatToken[] = [];
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
    const tokenRefs = useRef(new Map<number, HTMLSpanElement>());

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

            commitPhrase(selected[0], selected[1], flatRef.current, onWordClickRef.current);
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

    // Kifejezés-módból kilépve a félkész kijelölés is eltűnik, hogy a következő
    // koppintás ne folytassa egy korábban elkezdett tartományt.
    const [prevPhraseMode, setPrevPhraseMode] = useState(phraseMode);

    if (prevPhraseMode !== phraseMode) {
        setPrevPhraseMode(phraseMode);
        setAnchor(null);
        setRange(null);
    }

    /** Kijelölés-építés Shift-tel vagy kifejezés-módban. A második pont zárja a kifejezést. */
    const extendSelection = (index: number) => {
        if (anchor === null) {
            setAnchor(index);
            setRange([index, index]);

            return;
        }

        const lo = Math.min(anchor, index);
        const hi = Math.max(anchor, index);

        // Shift-tel a kifejezést a Shift elengedése zárja (közben szabadon
        // igazítható); koppintós módban a második pont azonnal zár.
        if (!phraseMode) {
            setRange([lo, hi]);

            return;
        }

        if (!commitPhrase(lo, hi, flat, onWordClick)) {
            return;
        }

        setAnchor(null);
        setRange(null);
        onPhraseComplete?.();
    };

    const handleActivate = (index: number, shiftKey: boolean) => {
        if (shiftKey || phraseMode) {
            shiftSelectedRef.current = shiftKey;
            extendSelection(index);

            return;
        }

        setAnchor(index);
        setRange(null);
        onWordClick?.(flat[index].text, flat[index].context);
    };

    /** Nyilazás a szavak között: a fókusz mozgatása és a roving tabindex frissítése. */
    const moveFocus = (nextIndex: number) => {
        const clamped = Math.max(0, Math.min(flat.length - 1, nextIndex));
        setFocusIndex(clamped);
        tokenRefs.current.get(clamped)?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                handleActivate(index, e.shiftKey);
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                moveFocus(index + 1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                moveFocus(index - 1);
                break;
            case 'Home':
                e.preventDefault();
                moveFocus(0);
                break;
            case 'End':
                e.preventDefault();
                moveFocus(flat.length - 1);
                break;
            default:
                break;
        }
    };

    // A tokenszám a szöveg váltásakor csökkenhet — a fókusz-index ne mutasson túl a végén.
    const rovingIndex = Math.min(focusIndex, Math.max(0, flat.length - 1));

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
                            ref={(el) => {
                                if (el) {
                                    tokenRefs.current.set(index, el);
                                } else {
                                    tokenRefs.current.delete(index);
                                }
                            }}
                            role="button"
                            tabIndex={index === rovingIndex ? 0 : -1}
                            // A szó maga a hozzáférhető név — külön aria-label
                            // minden tokenre feleslegesen szószátyár lenne.
                            // Az `aria-pressed` csak a kijelölteken jelenik meg.
                            aria-pressed={selected || undefined}
                            // Shift+kattintásnál ne induljon natív szövegkijelölés.
                            onMouseDown={(e) => {
                                if (e.shiftKey) {
                                    e.preventDefault();
                                }
                            }}
                            onClick={(e) => handleActivate(index, e.shiftKey)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            onFocus={() => setFocusIndex(index)}
                            className={`cursor-pointer rounded px-0.5 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${statusClass} ${selected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
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
