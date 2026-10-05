import { BookOpen, ChevronLeft, ChevronRight, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { ReaderActions, useReaderScrollReset } from '@/components/text-analysis/reader-controls';
import type { PageDirection, UserBook } from '@/components/text-analysis/types';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';

const STORAGE_LIMIT_MB = 30;

const MAX_FILE_MB = 3;

const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_MB * 1024 * 1024;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

interface BookListProps {
    books: UserBook[];
    bookLimit: number;
    usedStorage: number;
    booksLoaded: boolean;
    isUploading: boolean;
    loadBookmark: (bookId: number) => number;
    onUpload: (file: File) => void;
    onSelect: (book: UserBook) => void;
    onDelete: (book: UserBook) => void;
}

export function BookList({ books, bookLimit, usedStorage, booksLoaded, isUploading, loadBookmark, onUpload, onSelect, onDelete }: BookListProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const bookLimitReached = booksLoaded && books.length >= bookLimit;
    const storageLimitReached = booksLoaded && usedStorage >= STORAGE_LIMIT_BYTES;
    const limitReached = bookLimitReached || storageLimitReached;

    return (
        <div className="flex flex-col gap-3">
            <input
                ref={fileInputRef}
                type="file"
                accept=".epub"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';

                    if (!file) {
                        return;
                    }

                    if (file.size > MAX_FILE_BYTES) {
                        showToast(
                            'error',
                            `A fájl ${(file.size / 1024 / 1024).toFixed(1)} MB — a feltölthető maximum ${MAX_FILE_MB} MB.`,
                        );

                        return;
                    }

                    onUpload(file);
                }}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                    {booksLoaded ? `${books.length} / ${bookLimit} könyv · ${(usedStorage / 1024 / 1024).toFixed(1)} / ${STORAGE_LIMIT_MB} MB` : ''}
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || limitReached}
                    title={
                        bookLimitReached
                            ? `Elérted a maximális könyvszámot (${bookLimit})`
                            : storageLimitReached
                              ? `Elérted a ${STORAGE_LIMIT_MB} MB-os tárhelylimitet`
                              : undefined
                    }
                >
                    {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {isUploading ? 'Feldolgozás...' : 'EPUB feltöltése'}
                </Button>
            </div>

            {limitReached ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                    {bookLimitReached
                        ? `Elérted a maximális könyvszámot (${bookLimit}). Új feltöltéshez törölj egy könyvet.`
                        : `Elérted a ${STORAGE_LIMIT_MB} MB-os tárhelylimitet. Új feltöltéshez törölj egy könyvet.`}
                </p>
            ) : (
                <p className="text-xs text-muted-foreground">
                    Egy EPUB fájl legfeljebb {MAX_FILE_MB} MB lehet.
                </p>
            )}

            {!booksLoaded && (
                <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Könyvek betöltése" />
                </div>
            )}

            {booksLoaded && books.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-3xl bg-card px-6 py-10 text-center shadow-sm">
                    <BookOpen className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">Még nincs feltöltött könyved</p>
                    <p className="max-w-md text-xs text-muted-foreground">
                        Tölts fel egy EPUB fájlt, és oldalanként elemezheted: könyvjelzővel folytatható,
                        és látod a teljes könyv ismertségi százalékát.
                    </p>
                </div>
            )}

            {booksLoaded && books.length > 0 && (
                <div className="flex flex-col divide-y rounded-3xl bg-card shadow-sm">
                    {books.map((book) => {
                        const bookmark = loadBookmark(book.id);

                        return (
                            <div key={book.id} className="group flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-3xl last:rounded-b-3xl hover:bg-accent/40">
                                <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                                <button
                                    type="button"
                                    onClick={() => onSelect(book)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <p className="truncate text-sm font-medium">{book.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {book.file_type.toUpperCase()} · {book.total_pages} oldal
                                        {bookmark > 1 && (
                                            <span className="ml-2 font-medium text-primary">
                                                · Könyvjelző: {bookmark}. oldal
                                            </span>
                                        )}
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(book)}
                                    aria-label={`„${book.title}" törlése`}
                                    className="shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface BookReaderProps {
    book: UserBook;
    page: number;
    text: string;
    isLoadingPage: boolean;
    loadingDirection: PageDirection;
    isAnalyzing: boolean;
    onBack: () => void;
    onPageChange: (page: number) => void;
    onAnalyze: () => void;
}

export function BookReader({ book, page, text, isLoadingPage, loadingDirection, isAnalyzing, onBack, onPageChange, onAnalyze }: BookReaderProps) {
    const readerRef = useReaderScrollReset<HTMLDivElement>(page);

    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="-my-2 flex shrink-0 items-center gap-1.5 py-2 pr-2 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="size-3.5" />
                    Könyvek
                </button>
                <p className="truncate text-xs font-medium text-muted-foreground">{book.title}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{page} / {book.total_pages}</span>
            </div>

            <div
                ref={readerRef}
                className={`scroll-mt-4 rounded-3xl bg-card px-4 py-3 text-sm leading-7 shadow-sm transition-opacity md:max-h-104 md:overflow-y-auto md:px-5 md:py-4 ${
                    isLoadingPage ? 'opacity-50' : ''
                }`}
                aria-busy={isLoadingPage}
            >
                {text.split(/\n+/).filter((p) => p.trim()).map((para, i) => (
                    <p key={i} className="mb-3 last:mb-0">{para}</p>
                ))}
            </div>

            <ReaderActions
                page={page}
                totalPages={book.total_pages}
                isLoadingPage={isLoadingPage}
                loadingDirection={loadingDirection}
                isAnalyzing={isAnalyzing}
                onPageChange={onPageChange}
                onAnalyze={onAnalyze}
            />
        </>
    );
}

interface BookPagerProps {
    page: number;
    totalPages: number;
    disabled: boolean;
    loadingDirection: PageDirection;
    onPrev: () => void;
    onNext: () => void;
}

export function BookPager({ page, totalPages, disabled, loadingDirection, onPrev, onNext }: BookPagerProps) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-3xl bg-card p-4 shadow-sm">
            <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1 || disabled}>
                {disabled && loadingDirection === 'prev' ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                <span className="hidden sm:inline">Előző oldal</span>
                <span className="sm:hidden">Előző</span>
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
                {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages || disabled}>
                <span className="hidden sm:inline">Következő oldal</span>
                <span className="sm:hidden">Következő</span>
                {disabled && loadingDirection === 'next' ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
            </Button>
        </div>
    );
}
