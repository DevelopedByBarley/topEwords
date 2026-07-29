import { FileUp, Import, Loader2, Search } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { DIRECTION_OPTIONS } from '@/components/flashcards/types';
import type { Deck, WordResult } from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { importMethod as csvImport } from '@/routes/flashcards/csv';
import { search as searchWords } from '@/routes/words';

export function CsvImport({ deck }: { deck: Deck }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [uploading, setUploading] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [direction, setDirection] = useState<
        'front_to_back' | 'back_to_front' | 'both'
    >('front_to_back');

    const handleChange = () => {
        if (!inputRef.current?.files?.length) {
            return;
        }

        setShowDialog(true);
    };

    const handleConfirm = () => {
        setShowDialog(false);
        setUploading(true);
        formRef.current?.submit();
    };

    const handleCancel = () => {
        setShowDialog(false);

        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <>
            <form
                ref={formRef}
                action={csvImport(deck.id).url}
                method="post"
                encType="multipart/form-data"
                className="contents"
            >
                <input
                    type="hidden"
                    name="_token"
                    value={
                        typeof document !== 'undefined'
                            ? (document.querySelector<HTMLMetaElement>(
                                  'meta[name="csrf-token"]',
                              )?.content ?? '')
                            : ''
                    }
                />
                <input type="hidden" name="direction" value={direction} />
                <input
                    ref={inputRef}
                    type="file"
                    name="csv_file"
                    accept=".csv,.txt"
                    className="sr-only"
                    onChange={handleChange}
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                >
                    {uploading ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                    ) : (
                        <FileUp className="mr-1 size-4" />
                    )}
                    CSV import
                </Button>
            </form>

            <Dialog
                open={showDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCancel();
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader className="pr-8">
                        <DialogTitle>CSV import beállítások</DialogTitle>
                        <DialogDescription>
                            Két oszlop kell: előlap, hátlap — vesszővel
                            elválasztva, fejléc nélkül. Egyszerre legfeljebb 5
                            000 sor importálható.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <p className="text-sm font-medium">
                            Melyik irányban szeretnéd tanulni a kártyákat?
                        </p>
                        <div className="mt-1 grid gap-2">
                            {DIRECTION_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${direction === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                >
                                    <input
                                        type="radio"
                                        name="csv_direction"
                                        value={opt.value}
                                        checked={direction === opt.value}
                                        onChange={() => setDirection(opt.value)}
                                        className="accent-primary"
                                    />
                                    <span className="text-sm font-medium">
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={handleCancel}>
                            Mégse
                        </Button>
                        <Button onClick={handleConfirm}>
                            <FileUp className="mr-1 size-4" />
                            Importálás
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * Szó felvétele kártyaként. A kereső saját dialógusban lakik: a művelet-sávban
 * egy mindig nyitott beviteli mező vitte a helyet, és a „kiválaszt, majd
 * importál" két lépéséből itt egy kattintás lett.
 */
export function WordSearchImport({
    onImport,
}: {
    onImport: (word: WordResult) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WordResult[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (value.trim().length < 2) {
            setResults([]);
            setSearching(false);

            return;
        }

        setSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    searchWords({ query: { q: value } }).url,
                    {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                );
                const data: WordResult[] = await res.json();
                setResults(data);
            } finally {
                setSearching(false);
            }
        }, 250);
    }, []);

    function handlePick(word: WordResult) {
        setOpen(false);
        setQuery('');
        setResults([]);
        onImport(word);
    }

    return (
        <>
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Import className="mr-1 size-4" />
                Szó importálása
            </Button>

            <Dialog
                open={open}
                onOpenChange={(next) => {
                    setOpen(next);

                    if (!next) {
                        setQuery('');
                        setResults([]);
                    }
                }}
            >
                <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-md">
                    <DialogHeader className="pr-8">
                        <DialogTitle>Szó importálása kártyaként</DialogTitle>
                        <DialogDescription>
                            Keres a TopWords szótárban és a saját szavaid
                            között. Importálás után azonnal megnyílik a kártya
                            szerkesztője.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            autoFocus
                            value={query}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Szó keresése..."
                            className="pl-9"
                            aria-label="Szó keresése"
                        />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {searching && (
                            <p className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
                                <Loader2 className="size-3.5 animate-spin" />
                                Keresés...
                            </p>
                        )}

                        {!searching &&
                            query.trim().length >= 2 &&
                            results.length === 0 && (
                                <p className="px-1 py-3 text-sm text-muted-foreground">
                                    Nincs találat erre: „{query.trim()}"
                                </p>
                            )}

                        {!searching &&
                            results.map((word) => (
                                <button
                                    key={`${word.is_custom ? 'c' : 'w'}-${word.id}`}
                                    type="button"
                                    onClick={() => handlePick(word)}
                                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                                >
                                    <span className="font-medium">
                                        {word.word}
                                    </span>
                                    {word.is_custom && (
                                        <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                            saját
                                        </span>
                                    )}
                                    {word.meaning_hu && (
                                        <span className="truncate text-xs text-muted-foreground">
                                            {word.meaning_hu}
                                        </span>
                                    )}
                                </button>
                            ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
