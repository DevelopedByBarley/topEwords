import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeftRight,
    BookOpen,
    CheckCircle2,
    Download,
    Loader2,
    MoveRight,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Settings2,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import CardForm from '@/components/flashcards/card-form';
import CardPreviewDialog from '@/components/flashcards/card-preview-dialog';
import CardRow from '@/components/flashcards/card-row';
import CardStatsDialog from '@/components/flashcards/card-stats-dialog';
import DeckFormDialog from '@/components/flashcards/deck-form-dialog';
import DeckSettingsDialog from '@/components/flashcards/deck-settings-dialog';
import {
    CsvImport,
    WordSearchImport,
} from '@/components/flashcards/import-tools';
import MoveConfirmDialog from '@/components/flashcards/move-confirm-dialog';
import {
    STATE_FILTER_OPTIONS,
    getXsrfToken,
} from '@/components/flashcards/types';
import type {
    Deck,
    DeckSettings,
    Flashcard,
    OtherDeck,
    WordResult,
} from '@/components/flashcards/types';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { absorbAiBudget } from '@/lib/ai-budget';
import { calibrate, index, show, study } from '@/routes/flashcards';
import { skip as skipCalibration } from '@/routes/flashcards/calibrate';
import {
    bulkDelete as bulkDeleteCards,
    bulkDirection as bulkDirectionCards,
    bulkMove as bulkMoveCards,
    bulkReset as bulkResetCards,
    importMethod as importFromWord,
} from '@/routes/flashcards/cards';
import { exportMethod as csvExport } from '@/routes/flashcards/csv';

export default function FlashcardShow({
    deck,
    flashcards,
    newDueCount,
    reviewDueCount,
    uncalibratedCount,
    deckSettings,
    globalSettings,
    otherDecks,
    nextDueAt,
}: {
    deck: Deck;
    flashcards: Flashcard[] | undefined;
    newDueCount: number;
    reviewDueCount: number;
    uncalibratedCount: number;
    deckSettings: DeckSettings;
    globalSettings: DeckSettings;
    otherDecks: OtherDeck[];
    nextDueAt: string | null;
}) {
    const { flash, auth } = usePage<{
        flash: {
            success?: string | null;
            calibrationPrompt?: number | null;
            importedCardId?: number | null;
        };
        auth: { isAdmin?: boolean };
    }>().props;
    const isAdmin = auth?.isAdmin ?? false;
    const [showCalibrateModal, setShowCalibrateModal] = useState(
        (flash?.calibrationPrompt ?? 0) > 0,
    );
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
    const [previewCard, setPreviewCard] = useState<Flashcard | null>(null);
    const [statsCard, setStatsCard] = useState<Flashcard | null>(null);

    type PracticeResult = {
        words: {
            word: string;
            used: boolean;
            correct: boolean;
            feedback_hu: string;
        }[];
        grammar_issues: string[];
        overall_hu: string;
        corrected_text: string | null;
    };
    const [practiceCard, setPracticeCard] = useState<Flashcard | null>(null);
    const [practiceText, setPracticeText] = useState('');
    const [practiceLoading, setPracticeLoading] = useState(false);
    const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(
        null,
    );
    const [practiceError, setPracticeError] = useState<string | null>(null);

    const openPracticeModal = useCallback((card: Flashcard) => {
        setPracticeCard(card);
        setPracticeText('');
        setPracticeResult(null);
        setPracticeError(null);
    }, []);

    const closePracticeModal = useCallback(() => {
        setPracticeCard(null);
        setPracticeText('');
        setPracticeResult(null);
        setPracticeError(null);
    }, []);

    const handlePracticeCheck = useCallback(async () => {
        if (!practiceCard || practiceText.trim().length < 5) {
            return;
        }

        const word = practiceCard.front.replace(/<[^>]*>/g, '').trim();
        setPracticeLoading(true);
        setPracticeError(null);
        setPracticeResult(null);

        try {
            const res = await fetch('/words/practice/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    words: [{ word, meaning_hu: null }],
                    text: practiceText.trim(),
                }),
            });
            const data = await res.json();

            absorbAiBudget(data);

            if (!res.ok || data.error) {
                setPracticeError(data.error ?? 'Ismeretlen hiba.');
            } else {
                setPracticeResult(data as PracticeResult);
            }
        } catch {
            setPracticeError('Kapcsolódási hiba.');
        } finally {
            setPracticeLoading(false);
        }
    }, [practiceCard, practiceText]);

    useEffect(() => {
        if (!flash?.importedCardId || !flashcards) {
            return;
        }

        const card = flashcards.find((c) => c.id === flash.importedCardId);

        if (card) {
            setShowNewForm(false);
            setEditingCard(card);
        }
    }, [flash?.importedCardId, flashcards]);
    const [now, setNow] = useState(() => Date.now());
    const [secondsUntilDue, setSecondsUntilDue] = useState<number | null>(
        () => {
            if (!nextDueAt) {
                return null;
            }

            return Math.max(
                0,
                Math.round((new Date(nextDueAt).getTime() - Date.now()) / 1000),
            );
        },
    );

    useEffect(() => {
        const tick = () => {
            const ts = Date.now();
            setNow(ts);

            if (!nextDueAt) {
                return;
            }

            const remaining = Math.round(
                (new Date(nextDueAt).getTime() - ts) / 1000,
            );

            if (remaining <= 0) {
                setSecondsUntilDue(0);
                router.reload({
                    only: ['newDueCount', 'reviewDueCount', 'nextDueAt'],
                });
            } else {
                setSecondsUntilDue(remaining);
            }
        };
        const id = setInterval(tick, 5000);

        return () => clearInterval(id);
    }, [nextDueAt]);

    const [showSettings, setShowSettings] = useState(false);
    const [search, setSearch] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkMoveTarget, setBulkMoveTarget] = useState<{
        id: number;
        name: string;
    } | null>(null);
    const [bulkConfirm, setBulkConfirm] = useState<'delete' | 'reset' | null>(
        null,
    );
    const PAGE_SIZE = 50;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const filtered = (flashcards ?? []).filter((card) => {
        if (stateFilter) {
            const s = card.review?.state ?? 'new';

            if (s !== stateFilter) {
                return false;
            }
        }

        if (search) {
            const q = search.toLowerCase();

            return (
                card.front.toLowerCase().includes(q) ||
                card.back.toLowerCase().includes(q)
            );
        }

        return true;
    });

    const visibleCards = filtered.slice(0, visibleCount);

    const stateCounts = {
        new: (flashcards ?? []).filter(
            (c) => !c.review || c.review.state === 'new',
        ).length,
        learning: (flashcards ?? []).filter(
            (c) => c.review?.state === 'learning',
        ).length,
        review: (flashcards ?? []).filter((c) => c.review?.state === 'review')
            .length,
        relearning: (flashcards ?? []).filter(
            (c) => c.review?.state === 'relearning',
        ).length,
    };

    const handleSelect = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (checked) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });
    };

    const allFilteredSelected =
        filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
    const someSelected = selectedIds.size > 0;
    const allSelectedBoth =
        someSelected &&
        [...selectedIds].every(
            (id) =>
                (flashcards ?? []).find((c) => c.id === id)?.direction ===
                'both',
        );

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map((c) => c.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const bulkAction = (
        url: string,
        extraData: Record<string, unknown> = {},
    ) => {
        router.post(
            url,
            { ids: [...selectedIds], ...extraData },
            {
                preserveScroll: true,
                onSuccess: clearSelection,
            },
        );
    };

    const handleWordImport = (word: WordResult) => {
        const body = word.is_custom
            ? { custom_word_id: word.id }
            : { word_id: word.id };

        router.post(importFromWord(deck.id).url, body);
    };

    return (
        <>
            <Head title={deck.name} />

            <div className="mx-auto flex h-full w-full max-w-[2000px] flex-1 flex-col gap-6 p-4 md:p-6 xl:px-10 2xl:px-16">
                {/* Hero: deck info + study CTA */}
                <div
                    className="relative overflow-hidden rounded-3xl p-6 md:p-8"
                    style={{
                        background: 'linear-gradient(135deg,#4338CA,#4F8EEC)',
                    }}
                >
                    <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/15 blur-2xl" />
                    <div className="relative flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                                        {deck.name}
                                    </h1>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowRenameDialog(true)
                                        }
                                        className="shrink-0 cursor-pointer rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                                        aria-label="Pakli átnevezése"
                                        title="Pakli átnevezése"
                                    >
                                        <Pencil className="size-4" />
                                    </button>
                                </div>
                                {deck.description && (
                                    <p className="mt-1 text-sm text-white/85">
                                        {deck.description}
                                    </p>
                                )}
                            </div>
                            {flashcards === undefined ? (
                                <span className="h-7 w-24 shrink-0 animate-pulse rounded-full bg-white/20" />
                            ) : (
                                <span className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold text-white tabular-nums">
                                    {flashcards.length} kártya
                                </span>
                            )}
                        </div>

                        {/* A due-számok nem deferred propok, így a fő akció
                            azonnal látszik — nem várunk a kártyalistára. */}
                        {(flashcards === undefined || flashcards.length > 0) &&
                            (() => {
                                const dueCount = newDueCount + reviewDueCount;
                                const hasCountdown =
                                    dueCount === 0 &&
                                    secondsUntilDue !== null &&
                                    secondsUntilDue > 0;
                                const mins = hasCountdown
                                    ? Math.floor(secondsUntilDue! / 60)
                                    : 0;
                                const secs = hasCountdown
                                    ? secondsUntilDue! % 60
                                    : 0;

                                return (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {dueCount > 0 ? (
                                                <>
                                                    {newDueCount > 0 && (
                                                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-600">
                                                            {newDueCount} új
                                                        </span>
                                                    )}
                                                    {reviewDueCount > 0 && (
                                                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-indigo-600">
                                                            {reviewDueCount}{' '}
                                                            ismétlés
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-white/85">
                                                        esedékes — folytathatod
                                                        a tanulást!
                                                    </span>
                                                </>
                                            ) : hasCountdown ? (
                                                <span className="text-sm text-white/85">
                                                    Következő kártya{' '}
                                                    <span className="font-bold text-white tabular-nums">
                                                        {mins > 0
                                                            ? `${mins}p `
                                                            : ''}
                                                        {String(secs).padStart(
                                                            2,
                                                            '0',
                                                        )}
                                                        mp
                                                    </span>{' '}
                                                    múlva esedékes.
                                                </span>
                                            ) : (
                                                <span className="text-sm text-white/85">
                                                    Nincs esedékes kártya —
                                                    gyere vissza később.
                                                </span>
                                            )}
                                        </div>
                                        {dueCount > 0 ? (
                                            <Link
                                                href={study(deck.id)}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-sky-600 shadow-[0_4px_0_0_oklch(0.55_0.12_230)] transition-all hover:brightness-95 active:translate-y-0.75 active:shadow-[0_1px_0_0_oklch(0.55_0.12_230)] sm:self-auto"
                                            >
                                                <BookOpen className="size-4" />
                                                Tanulás
                                            </Link>
                                        ) : (
                                            <span className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold text-white/70 sm:self-auto">
                                                <BookOpen className="size-4" />
                                                Tanulás
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                    </div>
                </div>

                {/* Calibration banner */}
                {uncalibratedCount > 0 && (
                    <div className="flex flex-col justify-between gap-3 rounded-2xl bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:px-5 dark:bg-amber-950/30">
                        <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                                {uncalibratedCount} kártya vár kalibrálásra
                            </p>
                            <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                                Kalibrálásig ezek nem kerülnek a tanulási sorba.
                            </p>
                        </div>
                        <div className="flex gap-2 self-start sm:self-auto">
                            <Button
                                size="sm"
                                onClick={() => router.visit(calibrate(deck.id))}
                            >
                                Folytatás
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-amber-700 dark:text-amber-400"
                                onClick={() =>
                                    router.post(skipCalibration(deck.id).url)
                                }
                            >
                                Kihagyás
                            </Button>
                        </div>
                    </div>
                )}

                {/* Flash message */}
                {flash?.success && (
                    <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                {/* Calibration modal */}
                <Dialog
                    open={showCalibrateModal}
                    onOpenChange={setShowCalibrateModal}
                >
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader className="pr-8">
                            <DialogTitle>Kalibráció</DialogTitle>
                            <DialogDescription asChild>
                                <p>
                                    <span className="font-semibold text-foreground">
                                        {flash?.calibrationPrompt} kártyát
                                    </span>{' '}
                                    importáltál. Ha megmondod, mennyire ismered
                                    őket, az ismétlési ütemterv nem nulláról
                                    indul. Kihagyás esetén mind új kártyaként
                                    kerül a sorba.
                                </p>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCalibrateModal(false);
                                    router.post(skipCalibration(deck.id).url);
                                }}
                            >
                                Kihagyás
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowCalibrateModal(false);
                                    router.visit(calibrate(deck.id));
                                }}
                            >
                                Kalibrálás indítása
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Műveletek: elöl az egyetlen elsődleges akció (kártya
                    felvitele), utána az import/export és a beállítások. */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        onClick={() => {
                            setShowNewForm(true);
                            setEditingCard(null);
                        }}
                    >
                        <Plus className="mr-1 size-4" />
                        Új kártya
                    </Button>

                    <WordSearchImport onImport={handleWordImport} />
                    <CsvImport deck={deck} />

                    {(flashcards?.length ?? 0) > 0 && (
                        <Button size="sm" variant="outline" asChild>
                            <a href={csvExport(deck.id).url}>
                                <Download className="mr-1 size-4" />
                                CSV export
                            </a>
                        </Button>
                    )}

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowSettings(true)}
                        className="relative ms-auto"
                    >
                        <Settings2 className="mr-1 size-4" />
                        Beállítások
                        {deckSettings !== null && (
                            <span
                                className="absolute -top-1 -right-1 size-2 rounded-full bg-primary"
                                title="Egyéni beállítások aktívak"
                            />
                        )}
                    </Button>
                </div>

                <Deferred
                    data="flashcards"
                    fallback={
                        <>
                            <div className="h-24 animate-pulse rounded-3xl border bg-muted/40" />
                            <div className="space-y-2">
                                {[...Array(6)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="h-16 animate-pulse rounded-2xl border bg-muted/40"
                                    />
                                ))}
                            </div>
                        </>
                    }
                >
                    {/* Szűrők */}
                    {(flashcards?.length ?? 0) > 0 && (
                        <section className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5 dark:border-neutral-700 dark:bg-card">
                            <div className="relative max-w-sm">
                                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setVisibleCount(PAGE_SIZE);
                                    }}
                                    placeholder="Keresés az előlapon / hátlapon..."
                                    className="rounded-full border-0 bg-muted pr-9 pl-10"
                                    aria-label="Keresés a kártyák között"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        aria-label="Keresés törlése"
                                        className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="size-4" />
                                    </button>
                                )}
                            </div>

                            {/* Állapot-szűrő chipek */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                                {STATE_FILTER_OPTIONS.map(
                                    ({ value, label }) => {
                                        const count =
                                            value === ''
                                                ? (flashcards?.length ?? 0)
                                                : stateCounts[
                                                      value as keyof typeof stateCounts
                                                  ];
                                        const active = stateFilter === value;

                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                aria-pressed={active}
                                                onClick={() => {
                                                    setStateFilter(value);
                                                    setVisibleCount(PAGE_SIZE);
                                                }}
                                                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                                    active
                                                        ? 'border-primary bg-primary text-primary-foreground'
                                                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {label}
                                                <span
                                                    className={`text-[10px] tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}
                                                >
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    },
                                )}
                            </div>

                            {/* Találatszám */}
                            {(search || stateFilter) && (
                                <p className="text-xs text-muted-foreground">
                                    <span className="tabular-nums">
                                        {filtered.length}
                                    </span>{' '}
                                    találat
                                    {' · '}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            setStateFilter('');
                                        }}
                                        className="cursor-pointer underline hover:no-underline"
                                    >
                                        szűrők törlése
                                    </button>
                                </p>
                            )}
                        </section>
                    )}

                    {/* Kártyalista */}
                    {(flashcards?.length ?? 0) === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed py-16 text-center">
                            <BookOpen className="mb-4 size-12 text-muted-foreground opacity-30" />
                            <p className="text-sm font-medium">
                                Még nincs kártya ebben a pakliban.
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                Vegyél fel kártyát kézzel, importálj egy szót a
                                szótárból, vagy tölts be egy CSV-t.
                            </p>
                            <Button
                                className="mt-4"
                                onClick={() => {
                                    setShowNewForm(true);
                                    setEditingCard(null);
                                }}
                            >
                                <Plus className="mr-1 size-4" />
                                Első kártya felvitele
                            </Button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-3xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                            Nincs a szűrőknek megfelelő kártya.
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setStateFilter('');
                                }}
                                className="ml-1 cursor-pointer underline hover:no-underline"
                            >
                                Szűrők törlése
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 px-1 pb-1">
                                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
                                    <input
                                        type="checkbox"
                                        checked={allFilteredSelected}
                                        ref={(el) => {
                                            if (el) {
                                                el.indeterminate =
                                                    someSelected &&
                                                    !allFilteredSelected;
                                            }
                                        }}
                                        onChange={toggleSelectAll}
                                        className="size-4 cursor-pointer rounded border-input accent-primary"
                                    />
                                    {allFilteredSelected
                                        ? 'Kijelölés törlése'
                                        : `Összes kijelölése (${filtered.length})`}
                                </label>
                            </div>

                            {visibleCards.map((card) => (
                                <CardRow
                                    key={card.id}
                                    card={card}
                                    deck={deck}
                                    otherDecks={otherDecks}
                                    onEdit={(c) => {
                                        setEditingCard(c);
                                        setShowNewForm(false);
                                    }}
                                    onPreview={(c) => setPreviewCard(c)}
                                    onPractice={
                                        isAdmin ? openPracticeModal : undefined
                                    }
                                    onStats={(c) => setStatsCard(c)}
                                    selected={selectedIds.has(card.id)}
                                    onSelect={handleSelect}
                                    now={now}
                                />
                            ))}
                            {visibleCount < filtered.length && (
                                <div className="flex justify-center py-4">
                                    <button
                                        onClick={() =>
                                            setVisibleCount(
                                                (v) => v + PAGE_SIZE,
                                            )
                                        }
                                        className="text-sm text-muted-foreground underline hover:text-foreground"
                                    >
                                        Több betöltése (
                                        {filtered.length - visibleCount} maradt)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Hely a rögzített tömeges művelet-sávnak, hogy ne
                        takarja el a lista utolsó sorait. */}
                    {someSelected && <div className="h-20" aria-hidden />}
                </Deferred>
            </div>

            {/* Tömeges műveletek — rögzítve az ablak aljához, hogy a lista
                bármely pontjáról elérhető legyen kigörgetés nélkül. */}
            {someSelected && (
                <div className="fixed inset-x-0 bottom-0 z-40 animate-in border-t bg-background px-4 py-3 shadow-[0_-4px_16px_-8px_rgb(0_0_0/0.25)] duration-150 slide-in-from-bottom-2 md:bg-background/95 md:backdrop-blur">
                    <div className="mx-auto flex max-w-[2000px] flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                            {selectedIds.size} kijelölve
                        </span>
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="mr-2 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                            Mégse
                        </button>

                        <button
                            type="button"
                            onClick={() => setBulkConfirm('reset')}
                            className="flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                            <RotateCcw className="size-3" />
                            Haladás törlése
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                bulkAction(bulkDirectionCards(deck.id).url, {
                                    direction: allSelectedBoth
                                        ? 'front_to_back'
                                        : 'both',
                                })
                            }
                            className="flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                            <ArrowLeftRight className="size-3" />
                            {allSelectedBoth
                                ? 'Visszaállítás (1 irányú)'
                                : 'Kétirányú kártya'}
                        </button>

                        {otherDecks.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    >
                                        <MoveRight className="size-3" />
                                        Áthelyezés
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    side="top"
                                    className="w-48"
                                >
                                    {otherDecks.map((d) => (
                                        <DropdownMenuItem
                                            key={d.id}
                                            onClick={() =>
                                                setBulkMoveTarget({
                                                    id: d.id,
                                                    name: d.name,
                                                })
                                            }
                                        >
                                            {d.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <button
                            type="button"
                            onClick={() => setBulkConfirm('delete')}
                            className="flex cursor-pointer items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                            <Trash2 className="size-3" />
                            Törlés
                        </button>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={bulkConfirm === 'reset'}
                onOpenChange={(open) => !open && setBulkConfirm(null)}
                title="Haladás visszaállítása"
                confirmLabel="Igen, visszaállítom"
                description={
                    <>
                        <strong className="text-foreground">
                            {selectedIds.size} kártya
                        </strong>{' '}
                        SRS-adatai (intervallum, ismétlésszám, tévesztések)
                        törlődnek, és a kártyák újként kerülnek vissza a
                        tanulási sorba.
                    </>
                }
                onConfirm={() => bulkAction(bulkResetCards(deck.id).url)}
            />

            <ConfirmDialog
                open={bulkConfirm === 'delete'}
                onOpenChange={(open) => !open && setBulkConfirm(null)}
                title="Kártyák törlése"
                destructive
                confirmLabel="Igen, törlöm"
                description={
                    <>
                        A kijelölt{' '}
                        <strong className="text-foreground">
                            {selectedIds.size} kártya
                        </strong>{' '}
                        a tanulási előzményeivel együtt véglegesen törlődik. Ez
                        nem vonható vissza.
                    </>
                }
                onConfirm={() => bulkAction(bulkDeleteCards(deck.id).url)}
            />

            <DeckFormDialog
                open={showRenameDialog}
                onOpenChange={setShowRenameDialog}
                deck={deck}
                folders={[]}
                defaultFolderId={null}
            />

            {/* Card stats dialog */}
            {statsCard && (
                <CardStatsDialog
                    card={statsCard}
                    onClose={() => setStatsCard(null)}
                    now={now}
                />
            )}

            {/* Card preview dialog */}
            {previewCard && (
                <CardPreviewDialog
                    card={previewCard}
                    onClose={() => setPreviewCard(null)}
                    onEdit={() => {
                        setEditingCard(previewCard);
                        setShowNewForm(false);
                    }}
                    now={now}
                />
            )}

            {/* Deck settings dialog */}
            <DeckSettingsDialog
                deck={deck}
                deckSettings={deckSettings}
                globalSettings={globalSettings}
                open={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* Practice modal */}
            <Dialog
                open={practiceCard !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        closePracticeModal();
                    }
                }}
            >
                <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col sm:max-w-2xl">
                    <DialogHeader className="pr-8">
                        <DialogTitle className="flex flex-wrap items-center gap-2">
                            <Sparkles className="size-4 text-indigo-600" />
                            Mondatírás gyakorlás
                            {practiceCard && (
                                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                                    {practiceCard.front
                                        .replace(/<[^>]*>/g, '')
                                        .trim()}
                                </span>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Írj mondatokat, amelyekben természetesen használod a
                            szót. Az AI ellenőrzi a szóhasználatot és a
                            grammatikát.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-1">
                        <div className="space-y-2">
                            <Textarea
                                value={practiceText}
                                onChange={(e) => {
                                    setPracticeText(
                                        e.target.value.slice(0, 3000),
                                    );
                                    setPracticeResult(null);
                                }}
                                placeholder="Írj mondatokat..."
                                className="min-h-40 resize-y text-base leading-relaxed"
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                    {practiceText.length} / 3000
                                </span>
                                <Button
                                    onClick={handlePracticeCheck}
                                    disabled={
                                        practiceText.trim().length < 5 ||
                                        practiceLoading
                                    }
                                    className="gap-2 rounded-full bg-linear-to-br from-indigo-600 to-indigo-800 text-white shadow-[0_4px_0_0_var(--color-indigo-900)] hover:brightness-105 active:translate-y-0.75"
                                >
                                    {practiceLoading ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="size-4" />
                                    )}
                                    {practiceLoading
                                        ? 'Ellenőrzés...'
                                        : 'Ellenőrzés'}
                                </Button>
                            </div>
                        </div>

                        {practiceError && (
                            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                <AlertCircle className="size-4 shrink-0" />
                                {practiceError}
                            </div>
                        )}

                        {practiceResult && (
                            <div className="animate-in space-y-3 duration-300 fade-in slide-in-from-bottom-2">
                                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-950/30">
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                                        <p className="text-sm text-indigo-800 dark:text-indigo-300">
                                            {practiceResult.overall_hu}
                                        </p>
                                    </div>
                                </div>

                                {practiceResult.grammar_issues.length > 0 && (
                                    <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                                        <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
                                            Grammatikai megjegyzések
                                        </p>
                                        <ul className="space-y-1">
                                            {practiceResult.grammar_issues.map(
                                                (issue, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400"
                                                    >
                                                        <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-500" />
                                                        {typeof issue ===
                                                        'string'
                                                            ? issue
                                                            : ((issue as any)
                                                                  .explanation_hu ??
                                                              (issue as any)
                                                                  .issue ??
                                                              JSON.stringify(
                                                                  issue,
                                                              ))}
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </div>
                                )}

                                {practiceResult.corrected_text && (
                                    <div className="space-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
                                        <p className="text-xs font-semibold tracking-wide text-blue-800 uppercase dark:text-blue-300">
                                            Javított változat
                                        </p>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-blue-700 dark:text-blue-300">
                                            {practiceResult.corrected_text}
                                        </p>
                                    </div>
                                )}

                                {practiceResult.grammar_issues.length === 0 &&
                                    !practiceResult.corrected_text && (
                                        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                                            <CheckCircle2 className="size-4 shrink-0" />
                                            Grammatikailag helyes szöveg!
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Card edit / new dialog */}
            <Dialog
                open={showNewForm || editingCard !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowNewForm(false);
                        setEditingCard(null);
                    }
                }}
            >
                <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-2rem)] flex-col sm:max-w-5xl">
                    <DialogHeader className="pr-8">
                        <DialogTitle>
                            {editingCard ? 'Kártya szerkesztése' : 'Új kártya'}
                        </DialogTitle>
                        <DialogDescription>
                            Az előlap a kérdés, a hátlap a válasz. A tanulás
                            iránya és a kártya színe alul állítható.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <CardForm
                            key={editingCard?.id ?? 'new'}
                            deck={deck}
                            card={editingCard ?? undefined}
                            onCancel={() => {
                                setShowNewForm(false);
                                setEditingCard(null);
                            }}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {bulkMoveTarget && (
                <MoveConfirmDialog
                    open
                    onClose={() => setBulkMoveTarget(null)}
                    targetDeckName={bulkMoveTarget.name}
                    cardCount={selectedIds.size}
                    onConfirm={(resetProgress) => {
                        setBulkMoveTarget(null);
                        bulkAction(bulkMoveCards(deck.id).url, {
                            target_deck_id: bulkMoveTarget.id,
                            reset_progress: resetProgress,
                        });
                    }}
                />
            )}
        </>
    );
}

FlashcardShow.layout = (props: { deck: Deck }) => ({
    breadcrumbs: [
        { title: 'Flashcards', href: index() },
        { title: props.deck.name, href: show({ deck: props.deck.id }) },
    ],
});
