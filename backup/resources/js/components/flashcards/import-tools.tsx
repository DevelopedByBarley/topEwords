import { FileUp, Import, Info, Loader2, Search } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { DIRECTION_OPTIONS } from '@/components/flashcards/types';
import type { Deck, WordResult } from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>CSV import beállítások</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
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
                    <div className="mt-2 flex justify-end gap-3">
                        <Button variant="outline" onClick={handleCancel}>
                            Mégse
                        </Button>
                        <Button onClick={handleConfirm}>
                            <FileUp className="mr-1 size-4" />
                            Importálás
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export function WordSearchImport({
    onImport,
}: {
    onImport: (word: WordResult) => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WordResult[]>([]);
    const [selected, setSelected] = useState<WordResult | null>(null);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);
        setSelected(null);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (value.length < 2) {
            setResults([]);
            setOpen(false);

            return;
        }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);

            try {
                const res = await fetch(
                    searchWords({ query: { q: value } }).url,
                    {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                );
                const data: WordResult[] = await res.json();
                setResults(data);
                setOpen(data.length > 0);
            } finally {
                setSearching(false);
            }
        }, 250);
    }, []);

    const handleSelect = (word: WordResult) => {
        setSelected(word);
        setQuery(word.word);
        setOpen(false);
    };

    const handleImport = () => {
        if (!selected) {
            return;
        }

        onImport(selected);
        setSelected(null);
        setQuery('');
        setResults([]);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="Szó keresése..."
                    className="h-9 w-36 pl-8 sm:w-56"
                />
                {open && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-72 overflow-hidden rounded-md border bg-popover shadow-md">
                        {searching && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                Keresés...
                            </div>
                        )}
                        {results.map((word) => (
                            <button
                                key={`${word.is_custom ? 'c' : 'w'}-${word.id}`}
                                onMouseDown={() => handleSelect(word)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                            >
                                <span className="font-medium">{word.word}</span>
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
                )}
            </div>
            <Button
                size="sm"
                variant="outline"
                disabled={!selected}
                onClick={handleImport}
            >
                <Import className="mr-1 size-4" />
                Importálás
            </Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="size-4 shrink-0 cursor-help text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Keres a TopWords szótárban és a saját szavaid között.
                        <br />
                        Importálás után azonnal szerkesztheted a kártyát.
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}
