import { ChevronLeft, ChevronRight, Loader2, ScanText } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { PageDirection } from '@/components/text-analysis/types';
import { Button } from '@/components/ui/button';

/**
 * Lapváltáskor az olvasó elejére visz.
 *
 * Desktopon az olvasó saját görgetősávos doboz — annak a tetejére állunk.
 * Mobilon a szöveg a lappal együtt görög (belső görgetés nélkül), így a
 * „Következő" után a felhasználó a régi lap alján maradna: ha az olvasó
 * teteje kikerült a képből, odagörgetünk.
 */
export function useReaderScrollReset<T extends HTMLElement>(page: number) {
    const ref = useRef<T>(null);

    useEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        el.scrollTop = 0;

        if (el.getBoundingClientRect().top < 0) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [page]);

    return ref;
}

interface ReaderActionsProps {
    page: number;
    totalPages: number;
    isLoadingPage: boolean;
    loadingDirection: PageDirection;
    isAnalyzing: boolean;
    onPageChange: (page: number) => void;
    onAnalyze: () => void;
}

/**
 * Az olvasó (YouTube-felirat, könyv) lapozó- és elemző-gombjai.
 *
 * Mobilon egy sorba sűrített, a képernyő aljára (az alsó navigáció fölé)
 * rögzített sáv: hosszú lapnál is egy koppintásra van a lapozás és az
 * elemzés, nem kell a szöveg végéig görgetni. A sáv által takart helyet az
 * oldal alsó paddingja adja (text-analysis/index). md-től a szokásos,
 * szöveg alatti gombsor.
 */
export function ReaderActions({ page, totalPages, isLoadingPage, loadingDirection, isAnalyzing, onPageChange, onAnalyze }: ReaderActionsProps) {
    return (
        <div className="fixed inset-x-0 bottom-(--bottom-nav-offset) z-30 border-t bg-background px-4 py-3 shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.25)] md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none">
            <div className="flex items-center gap-2 md:justify-between">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 md:h-8 md:w-auto"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1 || isLoadingPage}
                    aria-label="Előző oldal"
                >
                    {isLoadingPage && loadingDirection === 'prev' ? <Loader2 className="size-4 animate-spin" /> : <ChevronLeft className="size-4" />}
                    <span className="hidden md:inline">Előző</span>
                </Button>

                {/* Mobilon a fejléc oldalszáma kigörög — a sávban is látszik. */}
                <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground md:hidden">
                    {page} / {totalPages}
                </span>

                {/* Mobilon `contents`: a két gomb a sáv sorába olvad, az elemzés kitölti a maradékot. */}
                <div className="contents md:flex md:gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-10 md:h-8 md:w-auto"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages || isLoadingPage}
                        aria-label="Következő oldal"
                    >
                        <span className="hidden md:inline">Következő</span>
                        {isLoadingPage && loadingDirection === 'next' ? <Loader2 className="size-4 animate-spin" /> : <ChevronRight className="size-4" />}
                    </Button>
                    <Button size="sm" className="h-10 flex-1 md:h-8 md:flex-none" onClick={onAnalyze} disabled={isAnalyzing || isLoadingPage}>
                        {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
                        {isAnalyzing ? 'Elemzés...' : 'Oldal elemzése'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
