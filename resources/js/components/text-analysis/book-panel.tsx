import { BookOpen, ChevronLeft, ChevronRight, Loader2, ScanText, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import type { UserBook } from '@/components/text-analysis/types';

const STORAGE_LIMIT_MB = 30;

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
    const limitReached = booksLoaded && (books.length >= bookLimit || usedStorage >= STORAGE_LIMIT_MB * 1024 * 1024);

    return (
        <div className="flex flex-col gap-3">
            <input
                ref={fileInputRef}
                type="file"
                accept=".epub"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = '';
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
                        booksLoaded && books.length >= bookLimit
                            ? `Elérted a maximális könyvszámot (${bookLimit})`
                            : booksLoaded && usedStorage >= STORAGE_LIMIT_MB * 1024 * 1024
                              ? `Elérted a ${STORAGE_LIMIT_MB} MB-os tárhelylimitet`
                              : undefined
                    }
                >
                    {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {isUploading ? 'Feldolgozás...' : 'EPUB feltöltése'}
                </Button>
            </div>
            {!booksLoaded && (
                <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
            )}
            {booksLoaded && books.length > 0 && (
                <div className="flex flex-col divide-y rounded-3xl bg-card shadow-sm">
                    {books.map((book) => {
                        const bookmark = loadBookmark(book.id);
                        return (
                            <div key={book.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40 first:rounded-t-3xl last:rounded-b-3xl">
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
                                    className="shrink-0 rounded p-1 text-muted-foreground transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
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
    isAnalyzing: boolean;
    onBack: () => void;
    onPageChange: (page: number) => void;
    onAnalyze: () => void;
}

export function BookReader({ book, page, text, isLoadingPage, isAnalyzing, onBack, onPageChange, onAnalyze }: BookReaderProps) {
    return (
        <>
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="size-3.5" />
                    Könyvek
                </button>
                <p className="truncate text-xs font-medium text-muted-foreground">{book.title}</p>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{page} / {book.total_pages}</span>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-3xl bg-card px-5 py-4 text-sm leading-7 shadow-sm">
                {text.split(/\n+/).filter((p) => p.trim()).map((para, i) => (
                    <p key={i} className="mb-3 last:mb-0">{para}</p>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1 || isLoadingPage}
                >
                    {isLoadingPage ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                    Előző
                </Button>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= book.total_pages || isLoadingPage}
                    >
                        Következő
                        {isLoadingPage ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                    </Button>
                    <Button size="sm" onClick={onAnalyze} disabled={isAnalyzing || isLoadingPage}>
                        {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                        {isAnalyzing ? 'Elemzés...' : 'Elemzés'}
                    </Button>
                </div>
            </div>
        </>
    );
}

interface BookPagerProps {
    page: number;
    totalPages: number;
    disabled: boolean;
    onPrev: () => void;
    onNext: () => void;
}

export function BookPager({ page, totalPages, disabled, onPrev, onNext }: BookPagerProps) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-3xl bg-card p-4 shadow-sm">
            <Button variant="outline" size="sm" onClick={onPrev} disabled={page <= 1 || disabled}>
                {disabled ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                <span className="hidden sm:inline">Előző oldal</span>
                <span className="sm:hidden">Előző</span>
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
                {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages || disabled}>
                <span className="hidden sm:inline">Következő oldal</span>
                <span className="sm:hidden">Következő</span>
                {disabled ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
            </Button>
        </div>
    );
}
