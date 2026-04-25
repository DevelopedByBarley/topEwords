import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, CheckCircle, Eye, Settings2, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RichTextContent } from '@/components/ui/rich-text-editor';
import { calibrate, index, show } from '@/routes/flashcards';
import { rate as rateCard, skip as skipCalibration } from '@/routes/flashcards/calibrate';

type Card = {
    id: number;
    front: string;
    front_notes: string | null;
    back: string;
    back_notes: string | null;
    direction: 'front_to_back' | 'back_to_front' | 'both';
    color: string | null;
    calibration_direction: 'front_to_back' | 'back_to_front';
    is_last_direction: boolean;
};

type Deck = { id: number; name: string };

type CalibIntervals = {
    somewhat_min: number;
    somewhat_max: number;
    know_min: number;
    know_max: number;
    well_min: number;
    well_max: number;
};

function getXsrfToken(): string {
    const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

function IntervalInput({ label, min, max, onChangeMin, onChangeMax }: {
    label: string;
    min: number;
    max: number;
    onChangeMin: (v: number) => void;
    onChangeMax: (v: number) => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <span className="w-28 text-sm font-medium shrink-0">{label}</span>
            <div className="flex items-center gap-2 flex-1">
                <input
                    type="number"
                    min={1}
                    max={365}
                    value={min}
                    onChange={(e) => onChangeMin(Math.max(1, Math.min(365, Number(e.target.value))))}
                    className="w-16 rounded-md border bg-background px-2 py-1 text-sm text-center"
                />
                <span className="text-muted-foreground text-sm">–</span>
                <input
                    type="number"
                    min={1}
                    max={365}
                    value={max}
                    onChange={(e) => onChangeMax(Math.max(1, Math.min(365, Number(e.target.value))))}
                    className="w-16 rounded-md border bg-background px-2 py-1 text-sm text-center"
                />
                <span className="text-muted-foreground text-sm">nap</span>
            </div>
        </div>
    );
}

export default function FlashcardCalibrate({ deck, cards, totalRemaining, calibIntervals }: {
    deck: Deck;
    cards: Card[];
    totalRemaining: number;
    calibIntervals: CalibIntervals;
}) {
    const { flash } = usePage<{ flash: { success?: string | null } }>().props;
    const sessionKey = `calib_started_${deck.id}`;
    const [started, setStarted] = useState(() => localStorage.getItem(sessionKey) === '1');
    const [showSettings, setShowSettings] = useState(false);
    const [intervals, setIntervals] = useState<CalibIntervals>({
        somewhat_min: calibIntervals.somewhat_min ?? 3,
        somewhat_max: calibIntervals.somewhat_max ?? 7,
        know_min: calibIntervals.know_min ?? 8,
        know_max: calibIntervals.know_max ?? 21,
        well_min: calibIntervals.well_min ?? 22,
        well_max: calibIntervals.well_max ?? 50,
    });
    const [currentIndex, setCurrentIndex] = useState(0);
    const [done, setDone] = useState(false);
    const [showBack, setShowBack] = useState(false);
    const [counts, setCounts] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });

    const ratings = [
        { rating: 1 as const, label: 'Nem tudom', description: 'Marad újként', shortcut: '1', className: 'border-destructive/50 text-destructive hover:bg-destructive/10' },
        { rating: 2 as const, label: 'Valamennyire', description: `≈ ${intervals.somewhat_min}–${intervals.somewhat_max} nap`, shortcut: '2', className: 'border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950' },
        { rating: 3 as const, label: 'Tudom', description: `≈ ${intervals.know_min}–${intervals.know_max} nap`, shortcut: '3', className: 'border-green-500/50 text-green-600 hover:bg-green-50 dark:hover:bg-green-950' },
        { rating: 4 as const, label: 'Jól tudom', description: `≈ ${intervals.well_min}–${intervals.well_max} nap`, shortcut: '4', className: 'border-blue-500/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950' },
    ];

    const current = cards[currentIndex] ?? null;

    const handleRate = useCallback(
        (rating: 1 | 2 | 3 | 4) => {
            if (!current || !showBack) return;

            setCounts((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));

            fetch(rateCard(deck.id).url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    flashcard_id: current.id,
                    rating,
                    direction: current.calibration_direction,
                    is_last_direction: current.is_last_direction,
                    ...intervals,
                }),
            }).catch(() => {});

            const next = currentIndex + 1;
            if (next >= cards.length) {
                setDone(true);
            } else {
                setCurrentIndex(next);
                setShowBack(false);
            }
        },
        [current, currentIndex, cards.length, deck.id, showBack],
    );

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if ((e.key === ' ' || e.key === 'Enter') && !showBack) {
                e.preventDefault();
                setShowBack(true);
                return;
            }
            if (showBack && ['1', '2', '3', '4'].includes(e.key)) {
                handleRate(Number(e.key) as 1 | 2 | 3 | 4);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleRate, showBack]);

    if (!started && cards.length > 0) {
        return (
            <>
                <Head title={`Kalibráció · ${deck.name}`} />
                <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
                    <div className="w-full max-w-md">
                        <div className="flex items-center gap-2 mb-6">
                            <Settings2 className="size-5 text-muted-foreground" />
                            <h2 className="text-xl font-bold">Kalibrálás beállítása</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Állítsd be, hogy az egyes értékelések mekkora ismétlési intervallumot jelentsenek.
                            A beállítások mentésre kerülnek a következő kalibráláshoz.
                        </p>

                        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4 mb-6">
                            <IntervalInput
                                label="Valamennyire"
                                min={intervals.somewhat_min}
                                max={intervals.somewhat_max}
                                onChangeMin={(v) => setIntervals((p) => ({ ...p, somewhat_min: v }))}
                                onChangeMax={(v) => setIntervals((p) => ({ ...p, somewhat_max: v }))}
                            />
                            <IntervalInput
                                label="Tudom"
                                min={intervals.know_min}
                                max={intervals.know_max}
                                onChangeMin={(v) => setIntervals((p) => ({ ...p, know_min: v }))}
                                onChangeMax={(v) => setIntervals((p) => ({ ...p, know_max: v }))}
                            />
                            <IntervalInput
                                label="Jól tudom"
                                min={intervals.well_min}
                                max={intervals.well_max}
                                onChangeMin={(v) => setIntervals((p) => ({ ...p, well_min: v }))}
                                onChangeMax={(v) => setIntervals((p) => ({ ...p, well_max: v }))}
                            />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <Link href={show(deck.id)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                                <ArrowLeft className="size-4" />
                                Vissza
                            </Link>
                            <div className="flex gap-2">
                                <Button variant="ghost" className="text-muted-foreground text-sm" onClick={() => router.post(skipCalibration(deck.id).url)}>
                                    Kihagyás
                                </Button>
                                <Button onClick={() => { localStorage.setItem(sessionKey, '1'); setStarted(true); }}>
                                    Indítás ({totalRemaining} kártya)
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (done || cards.length === 0) {
        return (
            <>
                <Head title="Kalibráció kész" />
                <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 text-center px-4">
                    <CheckCircle className="size-16 text-green-500" />
                    <div>
                        <h2 className="text-2xl font-bold">Kalibráció kész!</h2>
                        <p className="text-muted-foreground mt-1">
                            {cards.length === 0
                                ? 'Nincs kalibrálásra váró kártya.'
                                : `${cards.length} kártyát értékeltél.`}
                        </p>
                    </div>
                    {cards.length > 0 && (
                        <div className="flex gap-4 text-sm">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-destructive">{counts[1]}</p>
                                <p className="text-muted-foreground text-xs">Nem tudtam</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-amber-500">{counts[2]}</p>
                                <p className="text-muted-foreground text-xs">Valamennyire</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-500">{counts[3]}</p>
                                <p className="text-muted-foreground text-xs">Tudtam</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-blue-500">{counts[4]}</p>
                                <p className="text-muted-foreground text-xs">Jól tudtam</p>
                            </div>
                        </div>
                    )}
                    {totalRemaining > cards.length && (
                        <p className="text-sm text-muted-foreground">
                            Még <strong>{totalRemaining - cards.length}</strong> kártya vár kalibrálásra.
                        </p>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                        {totalRemaining > cards.length && (
                            <Link href={calibrate(deck.id)}>
                                <Button>Folytatás</Button>
                            </Link>
                        )}
                        <Link href={show(deck.id)}>
                            <Button variant="outline">
                                <ArrowLeft className="size-4 mr-2" />
                                Vissza a deckhez
                            </Button>
                        </Link>
                        {totalRemaining > cards.length && (
                            <Button
                                variant="ghost"
                                className="text-muted-foreground text-sm"
                                onClick={() => router.post(skipCalibration(deck.id).url)}
                            >
                                Végleg kihagyás
                            </Button>
                        )}
                    </div>
                </div>
            </>
        );
    }

    const progress = Math.round((currentIndex / cards.length) * 100);

    return (
        <>
            <Head title={`Kalibráció · ${deck.name}`} />

            <div className="flex flex-col min-h-[80vh] px-4 py-6 max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Link href={show(deck.id)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <ArrowLeft className="size-4" />
                        {deck.name}
                    </Link>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {currentIndex + 1} / {cards.length}
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowSettings((v) => !v)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Intervallum beállítások"
                        >
                            {showSettings ? <X className="size-4" /> : <SlidersHorizontal className="size-4" />}
                        </button>
                    </div>
                </div>

                {/* Inline settings panel */}
                {showSettings && (
                    <div className="rounded-xl border bg-card p-4 mb-6 flex flex-col gap-3">
                        <p className="text-xs text-muted-foreground">Az intervallumok a következő értékeléstől érvényesek és mentésre kerülnek.</p>
                        <IntervalInput
                            label="Valamennyire"
                            min={intervals.somewhat_min}
                            max={intervals.somewhat_max}
                            onChangeMin={(v) => setIntervals((p) => ({ ...p, somewhat_min: v }))}
                            onChangeMax={(v) => setIntervals((p) => ({ ...p, somewhat_max: v }))}
                        />
                        <IntervalInput
                            label="Tudom"
                            min={intervals.know_min}
                            max={intervals.know_max}
                            onChangeMin={(v) => setIntervals((p) => ({ ...p, know_min: v }))}
                            onChangeMax={(v) => setIntervals((p) => ({ ...p, know_max: v }))}
                        />
                        <IntervalInput
                            label="Jól tudom"
                            min={intervals.well_min}
                            max={intervals.well_max}
                            onChangeMin={(v) => setIntervals((p) => ({ ...p, well_min: v }))}
                            onChangeMax={(v) => setIntervals((p) => ({ ...p, well_max: v }))}
                        />
                    </div>
                )}

                {/* Progress bar */}
                <div className="h-1 w-full bg-muted rounded-full mb-8 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {flash?.success && (
                    <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                {/* Card */}
                <div
                    className="rounded-2xl border bg-card shadow-sm overflow-hidden mb-6"
                    style={current.color ? { borderColor: current.color, borderWidth: 2 } : {}}
                >
                    {current.direction === 'both' && (
                        <div className="px-4 pt-3 flex justify-center">
                            <span className="text-[10px] uppercase tracking-wide font-medium text-violet-500 bg-violet-50 dark:bg-violet-950/30 px-2 py-0.5 rounded-full">
                                {current.calibration_direction === 'front_to_back' ? 'Előlap → Hátlap' : 'Hátlap → Előlap'}
                            </span>
                        </div>
                    )}
                    {/* Question side */}
                    <div className="p-6 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                            {current.calibration_direction === 'front_to_back' ? 'Előlap' : 'Hátlap'}
                        </p>
                        <RichTextContent
                            html={current.calibration_direction === 'front_to_back' ? current.front : current.back}
                            className="text-lg font-semibold"
                        />
                        {current.calibration_direction === 'front_to_back' && current.front_notes && (
                            <RichTextContent html={current.front_notes} className="mt-2 text-sm text-muted-foreground" />
                        )}
                        {current.calibration_direction === 'back_to_front' && current.back_notes && (
                            <RichTextContent html={current.back_notes} className="mt-2 text-sm text-muted-foreground" />
                        )}
                    </div>

                    {showBack ? (
                        <>
                            <div className="border-t border-dashed" />
                            <div className="p-6 text-center bg-muted/20">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                                    {current.calibration_direction === 'front_to_back' ? 'Hátlap' : 'Előlap'}
                                </p>
                                <RichTextContent
                                    html={current.calibration_direction === 'front_to_back' ? current.back : current.front}
                                    className="text-base"
                                />
                                {current.calibration_direction === 'front_to_back' && current.back_notes && (
                                    <RichTextContent html={current.back_notes} className="mt-2 text-sm text-muted-foreground" />
                                )}
                                {current.calibration_direction === 'back_to_front' && current.front_notes && (
                                    <RichTextContent html={current.front_notes} className="mt-2 text-sm text-muted-foreground" />
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="border-t border-dashed p-4 flex justify-center">
                            <Button variant="outline" size="sm" onClick={() => setShowBack(true)}>
                                <Eye className="size-4 mr-1.5" />
                                Mutasd a {current.calibration_direction === 'front_to_back' ? 'hátlapot' : 'előlapot'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Rating buttons — only visible after flip */}
                {showBack ? (
                    <>
                        <div className="grid grid-cols-4 gap-2">
                            {ratings.map(({ rating, label, description, shortcut, className }) => (
                                <button
                                    key={rating}
                                    onClick={() => handleRate(rating)}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-4 px-2 text-sm font-medium transition-colors ${className}`}
                                >
                                    <span className="text-xs opacity-50">{shortcut}</span>
                                    {label}
                                    <span className="text-xs font-normal opacity-70">{description}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-center text-xs text-muted-foreground mt-4">
                            Billentyűk:{' '}
                            {['1','2','3','4'].map((k) => (
                                <kbd key={k} className="px-1.5 py-0.5 rounded border text-xs mx-0.5">{k}</kbd>
                            ))}
                        </p>
                    </>
                ) : (
                    <p className="text-center text-xs text-muted-foreground mt-2">
                        <kbd className="px-1.5 py-0.5 rounded border text-xs">Szóköz</kbd> a hátlap megmutatásához
                    </p>
                )}
            </div>
        </>
    );
}

FlashcardCalibrate.layout = {
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
        { title: 'Kalibráció', href: '#' },
    ],
};
