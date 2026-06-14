import { Deferred, Form, Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowLeftRight, BookOpen, CheckCircle2, Copy, Download, Edit2, FileUp, Import, Info, Loader2, MoreHorizontal, MoveRight, Plus, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { type RichTextEditorHandle } from '@/components/ui/rich-text-editor';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RichTextContent, RichTextEditor } from '@/components/ui/rich-text-editor';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { bulkDelete as bulkDeleteCards, bulkDirection as bulkDirectionCards, bulkMove as bulkMoveCards, bulkReset as bulkResetCards, bulkReverse as bulkReverseCards, destroy as destroyCard, duplicate as duplicateCard, importMethod as importFromWord, move as moveCard, reset as resetProgress, store as storeCard, update as updateCard } from '@/routes/flashcards/cards';
import { exportMethod as csvExport, importMethod as csvImport } from '@/routes/flashcards/csv';
import { calibrate, index, show, study } from '@/routes/flashcards';
import { skip as skipCalibration } from '@/routes/flashcards/calibrate';
import { destroy as destroyDeckSettings, update as updateDeckSettings } from '@/routes/flashcards/settings';
import { search as searchWords } from '@/routes/words';
import InputError from '@/components/input-error';

function getXsrfToken(): string {
    const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));
    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

type PrevState = {
    state: string;
    interval: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
    learning_step: number;
};

type Review = {
    state: 'new' | 'learning' | 'review' | 'relearning';
    interval: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
    is_leech: boolean;
    due_at: string | null;
    introduced_on: string | null;
    reviewed_on: string | null;
    previous_state: PrevState | null;
};

type AllReviewItem = {
    direction: string;
    state: string;
    interval: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
    learning_step: number;
    is_leech: boolean;
    due_at: string | null;
    introduced_on: string | null;
    reviewed_on: string | null;
    previous_state: PrevState | null;
};

type Flashcard = {
    id: number;
    front: string;
    front_notes: string | null;
    front_speak: string | null;
    back: string;
    back_notes: string | null;
    back_speak: string | null;
    direction: 'front_to_back' | 'back_to_front' | 'both';
    color: string | null;
    word_id: number | null;
    review: Review | null;
    all_reviews: AllReviewItem[];
};

type Deck = {
    id: number;
    name: string;
    description: string | null;
};

type OtherDeck = { id: number; name: string };

type DeckSettings = {
    new_cards_per_day: number;
    max_reviews_per_day: number;
    learning_steps: number[];
    graduating_interval: number;
    easy_interval: number;
    starting_ease: number;
    easy_bonus: number;
    hard_interval_modifier: number;
    interval_modifier: number;
    max_interval: number;
    lapse_new_interval: number;
    leech_threshold: number;
    shuffle_cards: boolean;
} | null;

const DEFAULT_SETTINGS: NonNullable<DeckSettings> = {
    new_cards_per_day: 20,
    max_reviews_per_day: 200,
    learning_steps: [1, 10],
    graduating_interval: 1,
    easy_interval: 4,
    starting_ease: 250,
    easy_bonus: 130,
    hard_interval_modifier: 120,
    interval_modifier: 100,
    max_interval: 365,
    lapse_new_interval: 0,
    leech_threshold: 8,
    shuffle_cards: false,
};

const PRESETS: { label: string; emoji: string; description: string; settings: NonNullable<DeckSettings> }[] = [
    {
        label: 'Lassú',
        emoji: '🐢',
        description: 'Kevés új kártya, rövid intervallumok, több ismétlés',
        settings: { ...DEFAULT_SETTINGS, new_cards_per_day: 10, max_reviews_per_day: 150, learning_steps: [1, 10, 1440], graduating_interval: 1, easy_interval: 2, interval_modifier: 80 },
    },
    {
        label: 'Normál',
        emoji: '⚖️',
        description: 'Kiegyensúlyozott haladás',
        settings: { ...DEFAULT_SETTINGS },
    },
    {
        label: 'Gyors',
        emoji: '🚀',
        description: 'Több új kártya, hosszabb intervallumok, gyorsabb haladás',
        settings: { ...DEFAULT_SETTINGS, new_cards_per_day: 40, max_reviews_per_day: 400, learning_steps: [1, 10], graduating_interval: 2, easy_interval: 7, interval_modifier: 115 },
    },
];

function SettingField({
    id, label, description, name, defaultValue, min, max, error, suffix,
}: {
    id: string; label: string; description?: string; name: string;
    defaultValue: number; min?: number; max?: number; error?: string; suffix?: string;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <div className="flex items-center gap-2">
                <Input id={id} type="number" name={name} defaultValue={defaultValue} min={min} max={max} className="w-28" />
                {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
            <InputError message={error} />
        </div>
    );
}

function DeckSettingsDialog({ deck, deckSettings, open, onClose }: {
    deck: Deck;
    deckSettings: DeckSettings;
    open: boolean;
    onClose: () => void;
}) {
    const hasCustom = deckSettings !== null;
    const [activeSettings, setActiveSettings] = useState<NonNullable<DeckSettings>>(deckSettings ?? DEFAULT_SETTINGS);
    const [presetKey, setPresetKey] = useState(0);
    const s = activeSettings;
    type StepUnit = 'perc' | 'óra' | 'nap';
    type StepEntry = { value: number; unit: StepUnit };

    function minutesToEntry(minutes: number): StepEntry {
        if (minutes >= 1440 && minutes % 1440 === 0) return { value: minutes / 1440, unit: 'nap' };
        if (minutes >= 60 && minutes % 60 === 0) return { value: minutes / 60, unit: 'óra' };
        return { value: minutes, unit: 'perc' };
    }

    function entryToMinutes({ value, unit }: StepEntry): number {
        if (unit === 'nap') return value * 1440;
        if (unit === 'óra') return value * 60;
        return value;
    }

    const [steps, setSteps] = useState<StepEntry[]>(() => s.learning_steps.map(minutesToEntry));

    const addStep = () => setSteps((prev) => [...prev, { value: 10, unit: 'perc' }]);
    const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
    const updateStepValue = (i: number, value: number) =>
        setSteps((prev) => prev.map((step, idx) => (idx === i ? { ...step, value } : step)));
    const updateStepUnit = (i: number, unit: StepUnit) =>
        setSteps((prev) => prev.map((step, idx) => (idx === i ? { ...step, unit } : step)));

    const applyPreset = (preset: typeof PRESETS[0]) => {
        setActiveSettings(preset.settings);
        setSteps(preset.settings.learning_steps.map(minutesToEntry));
        setPresetKey((k) => k + 1);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="size-4" />
                        Deck beállítások
                        {hasCustom && (
                            <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">egyéni</span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <Form
                    action={updateDeckSettings(deck.id)}
                    options={{ preserveScroll: true, onSuccess: onClose }}
                    className="space-y-6 pt-2"
                >
                    {({ processing, errors }) => (
                        <>
                            {/* Presets */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Gyors beállítás</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {PRESETS.map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent hover:border-primary/40"
                                        >
                                            <span className="text-sm font-medium">{preset.emoji} {preset.label}</span>
                                            <span className="text-xs text-muted-foreground leading-snug">{preset.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div key={presetKey} className="space-y-6">
                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Napi korlátok</h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="ds_new" label="Új kártyák / nap"
                                        description="Mennyi új kártyát tanulj naponta. Kevesebb = lassabb haladás, de könnyebben megemészthető mennyiség."
                                        name="new_cards_per_day" defaultValue={s.new_cards_per_day} min={1} max={9999} error={errors.new_cards_per_day} suffix="db"
                                    />
                                    <SettingField
                                        id="ds_rev" label="Max ismétlések / nap"
                                        description="Mennyi már tanult kártyát ismételj naponta. Ha sokat tanulsz, érdemes magasan tartani, hogy ne maradj le."
                                        name="max_reviews_per_day" defaultValue={s.max_reviews_per_day} min={1} max={9999} error={errors.max_reviews_per_day} suffix="db"
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Tanulási lépések</h4>
                                <p className="text-xs text-muted-foreground">
                                    Amikor először látsz egy új kártyát, ennyi időnként kérdez rá újra, mielőtt „megtanultnak" minősül.
                                    Pl. <span className="font-medium">1 perc → 10 perc → 1 nap</span>: háromszor kell helyesen megválaszolni növekvő időközönként. Több lépés = alaposabb rögzítés.
                                </p>
                                <div className="space-y-2">
                                    {steps.map((step, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="w-5 text-xs text-muted-foreground text-right shrink-0">{i + 1}.</span>
                                            <input type="hidden" name="learning_steps[]" value={entryToMinutes(step)} />
                                            <Input
                                                type="number"
                                                value={step.value}
                                                onChange={(e) => updateStepValue(i, Math.max(1, Number(e.target.value)))}
                                                min={1}
                                                className="w-20"
                                            />
                                            <select
                                                value={step.unit}
                                                onChange={(e) => updateStepUnit(i, e.target.value as 'perc' | 'óra' | 'nap')}
                                                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                                            >
                                                <option value="perc">perc</option>
                                                <option value="óra">óra</option>
                                                <option value="nap">nap</option>
                                            </select>
                                            {steps.length > 1 && (
                                                <button type="button" onClick={() => removeStep(i)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                                                    <X className="size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addStep} className="mt-1">
                                        <Plus className="size-3.5 mr-1" />
                                        Lépés hozzáadása
                                    </Button>
                                </div>
                                <InputError message={errors['learning_steps']} />
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Végzés & intervallumok</h4>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="ds_grad" label="Végzési intervallum"
                                        description='Ennyi nap múlva jelenik meg újra a kártya, miután sikeresen végigment a tanulási lépéseken. Kisebb érték = hamarabb visszajön, több ismétlés.'
                                        name="graduating_interval" defaultValue={s.graduating_interval} min={1} max={365} error={errors.graduating_interval} suffix="nap"
                                    />
                                    <SettingField
                                        id="ds_easy" label="Könnyű intervallum"
                                        description='Ha tanulás közben „Könnyű"-t nyomsz, egyből ennyi napra ugrik a kártya — kihagyja a többi lépést. Kisebb = hamarabb visszajön.'
                                        name="easy_interval" defaultValue={s.easy_interval} min={1} max={365} error={errors.easy_interval} suffix="nap"
                                    />
                                    <SettingField
                                        id="ds_max" label="Max intervallum"
                                        description="Két ismétlés között maximum ennyi nap telhet el. Pl. 180-ra állítva soha nem fog fél évnél ritkábban előjönni egy kártya."
                                        name="max_interval" defaultValue={s.max_interval} min={1} max={36500} error={errors.max_interval} suffix="nap"
                                    />
                                    <SettingField
                                        id="ds_ease" label="Kezdő nehézség"
                                        description='Milyen "könnyűnek" tekinti az algoritmus a kártyát induláskor. 250% az alapértelmezett. Kisebb érték = az intervallumok lassabban nőnek.'
                                        name="starting_ease" defaultValue={s.starting_ease} min={130} max={999} error={errors.starting_ease} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_bonus" label="Könnyű bónusz"
                                        description='„Könnyű" értékeléskor az intervallum ennyivel hosszabb a szokásosnál. 130% = 30%-kal tovább vár. Csökkentsd, ha nem akarsz sok kártyát kihagyni.'
                                        name="easy_bonus" defaultValue={s.easy_bonus} min={100} max={999} error={errors.easy_bonus} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_hard" label="Nehéz szorzó"
                                        description='„Nehéz"-et nyomva az intervallum ennyivel nő (120% = kicsit hosszabb). Az algoritmus nehezebb kártyaként kezeli ezután.'
                                        name="hard_interval_modifier" defaultValue={s.hard_interval_modifier} min={100} max={999} error={errors.hard_interval_modifier} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_mod" label="Intervallum módosító"
                                        description="Az összes kiszámolt intervallumot ezzel szorozza meg. 80% = minden intervallum 20%-kal rövidebb, azaz többet ismételsz. Lassabb haladáshoz csökkentsd."
                                        name="interval_modifier" defaultValue={s.interval_modifier} min={10} max={999} error={errors.interval_modifier} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_lapse" label="Tévesztés utáni visszaesés"
                                        description="Ha eltévesztesz egy kártyát, az előző intervallumának hány %-áról indul újra. 0% = teljesen elölről, 50% = felezi az intervallumot."
                                        name="lapse_new_interval" defaultValue={s.lapse_new_interval} min={0} max={100} error={errors.lapse_new_interval} suffix="%"
                                    />
                                    <SettingField
                                        id="ds_leech" label="Problémás kártya küszöb"
                                        description='Ha egy kártyát ennyiszer tévesztesz el, „problémásnak" jelöli. Ez egy figyelmeztető jelzés — érdemes átírni vagy mnemotechnikát alkalmazni.'
                                        name="leech_threshold" defaultValue={s.leech_threshold} min={1} max={99} error={errors.leech_threshold} suffix="tévesztés"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Shuffle */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Sorrend</h4>
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type="checkbox"
                                        name="shuffle_cards"
                                        defaultChecked={s.shuffle_cards}
                                        value="1"
                                        className="mt-0.5 size-4 rounded border-input accent-primary cursor-pointer"
                                    />
                                    <div className="grid gap-0.5">
                                        <span className="text-sm font-medium">Kártyák keverése</span>
                                        <span className="text-xs text-muted-foreground">
                                            Véletlenszerű sorrendben mutatja a kártyákat — kétoldalú kártyáknál az előlap és hátlap nem kerül egymás mellé.
                                        </span>
                                    </div>
                                </label>
                            </div>
                            </div> {/* end key={presetKey} */}

                            <div className="flex items-center justify-between gap-4 pt-1">
                                <Button type="submit" disabled={processing}>Mentés</Button>
                                {hasCustom && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground text-xs"
                                        onClick={() => {
                                            if (!confirm('Visszaállítod a globális / alapértelmezett beállításokra?')) return;
                                            router.delete(destroyDeckSettings(deck.id).url, {
                                                preserveScroll: true,
                                                onSuccess: onClose,
                                            });
                                        }}
                                    >
                                        Egyéni beállítások törlése
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const DIRECTION_LABELS = {
    front_to_back: 'Előlap → Hátlap',
    back_to_front: 'Hátlap → Előlap',
    both: 'Mindkét irány',
};

const STATE_LABELS: Record<string, string> = {
    new: 'Új',
    learning: 'Tanulás',
    review: 'Ismétlés',
    relearning: 'Újratanulás',
};

const STATE_COLORS: Record<string, string> = {
    new: 'text-blue-500',
    learning: 'text-amber-500',
    review: 'text-green-500',
    relearning: 'text-orange-500',
};

function stateBadgeClass(state: string): string {
    return ({
        new:        'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        learning:   'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
        review:     'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
        relearning: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
    } as Record<string, string>)[state] ?? 'bg-muted text-muted-foreground';
}

function stateLabelFull(state: string): string {
    return ({ new: 'Új kártya', learning: 'Tanulás', review: 'Ismétlés', relearning: 'Újratanulás' } as Record<string, string>)[state] ?? state;
}

function StatsRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

const DIRECTION_DISPLAY: Record<string, string> = {
    front_to_back: 'Előlap → Hátlap',
    back_to_front: 'Hátlap → Előlap',
};

function ReviewStatsBlock({ r, now }: { r: AllReviewItem; now: number }) {
    return (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <StatsRow label="Állapot">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadgeClass(r.state)}`}>
                    {stateLabelFull(r.state)}
                </span>
            </StatsRow>
            {(r.state === 'learning' || r.state === 'relearning') && (
                <StatsRow label="Tanulási lépés">
                    <span className="font-medium">{r.learning_step + 1}. lépés</span>
                </StatsRow>
            )}
            {r.state === 'review' && (
                <StatsRow label="Intervallum">
                    <span className="font-medium">{r.interval} nap</span>
                </StatsRow>
            )}
            <StatsRow label="Ease factor">
                <span className="font-medium">{(r.ease_factor / 100).toFixed(2)}</span>
            </StatsRow>
            <StatsRow label="Ismétlések">
                <span className="font-medium">{r.repetitions}</span>
            </StatsRow>
            <StatsRow label="Tévesztések">
                <span className="font-medium">{r.lapses}</span>
            </StatsRow>
            {r.due_at && (
                <StatsRow label="Esedékesség">
                    <span className="font-medium">{formatDue(r.due_at, r.state, now)}</span>
                </StatsRow>
            )}
            {r.introduced_on && (
                <StatsRow label="Bevezetve">
                    <span className="font-medium">{r.introduced_on}</span>
                </StatsRow>
            )}
            {r.reviewed_on && (
                <StatsRow label="Utolsó ismétlés">
                    <span className="font-medium">{r.reviewed_on}</span>
                </StatsRow>
            )}
            {r.is_leech && (
                <p className="text-xs text-destructive">⚠ Leech — sokat tévesztett kártya</p>
            )}
        </div>
    );
}

function CardStatsDialog({ card, onClose, now }: { card: Flashcard; onClose: () => void; now: number }) {
    const hasTwoDirections = card.all_reviews.length > 1;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-xs w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">Kártya statisztika</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                    {card.all_reviews.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            Ez a kártya még nem volt tanulásban.
                        </p>
                    ) : (
                        card.all_reviews.map((r, i) => (
                            <div key={r.direction}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {hasTwoDirections ? (DIRECTION_DISPLAY[r.direction] ?? r.direction) : 'Jelenlegi állapot'}
                                </p>
                                <ReviewStatsBlock r={r} now={now} />

                                {r.previous_state && (
                                    <div className="mt-3">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Előző állapot</p>
                                        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                                            <StatsRow label="Állapot">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateBadgeClass(r.previous_state.state)}`}>
                                                    {stateLabelFull(r.previous_state.state)}
                                                </span>
                                            </StatsRow>
                                            {(r.previous_state.state === 'learning' || r.previous_state.state === 'relearning') && (
                                                <StatsRow label="Tanulási lépés volt">
                                                    <span className="font-medium">{r.previous_state.learning_step + 1}. lépés</span>
                                                </StatsRow>
                                            )}
                                            {r.previous_state.interval > 0 && (
                                                <StatsRow label="Intervallum volt">
                                                    <span className="font-medium">{r.previous_state.interval} nap</span>
                                                </StatsRow>
                                            )}
                                            <StatsRow label="Ease factor volt">
                                                <span className="font-medium">{(r.previous_state.ease_factor / 100).toFixed(2)}</span>
                                            </StatsRow>
                                            <StatsRow label="Tévesztések volt">
                                                <span className="font-medium">{r.previous_state.lapses}</span>
                                            </StatsRow>
                                        </div>
                                    </div>
                                )}

                                {hasTwoDirections && i < card.all_reviews.length - 1 && (
                                    <Separator className="mt-4" />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function plainText(html: string, maxLen = 80): string {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

function formatDue(dueAt: string | null, state: string, now: number): string {
    if (state === 'new' || dueAt === null) return 'most esedékes';

    const diff = Math.round((new Date(dueAt).getTime() - now) / 1000);

    if (diff <= 0) return 'most esedékes';
    if (diff < 60) return `${diff} mp múlva`;
    if (diff < 3600) return `${Math.round(diff / 60)} perc múlva`;
    if (diff < 86400) return `${Math.round(diff / 3600)} óra múlva`;
    const days = Math.round(diff / 86400);
    return `${days} nap múlva`;
}

function CardRow({ card, deck, otherDecks, onEdit, onPreview, onPractice, onStats, selected, onSelect, now }: {
    card: Flashcard;
    deck: Deck;
    otherDecks: OtherDeck[];
    onEdit: (card: Flashcard) => void;
    onPreview: (card: Flashcard) => void;
    onPractice?: (card: Flashcard) => void;
    onStats: (card: Flashcard) => void;
    selected: boolean;
    onSelect: (id: number, checked: boolean) => void;
    now: number;
}) {
    const isBoth = card.direction === 'both';
    const reviewState = card.review?.state ?? 'new';

    return (
        <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                selected
                    ? 'bg-primary/5 border-primary/30'
                    : isBoth && !card.color
                        ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                        : 'bg-card hover:bg-muted/30'
            }`}
            style={card.color ? { borderLeftColor: card.color, borderLeftWidth: 3 } : isBoth ? { borderLeftWidth: 3 } : {}}
        >
            <input
                type="checkbox"
                checked={selected}
                onChange={(e) => onSelect(card.id, e.target.checked)}
                className="shrink-0 size-4 rounded border-input accent-primary cursor-pointer"
                aria-label="Kártya kijelölése"
            />

            {/* Card content — clickable for preview */}
            <button
                type="button"
                onClick={() => onPreview(card)}
                className="flex-1 min-w-0 text-left"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium truncate">{plainText(card.front, 80)}</span>
                    {isBoth && <ArrowLeftRight className="size-3 shrink-0 text-primary/60" />}
                    {card.review?.is_leech && <span className="shrink-0 text-[10px] font-semibold text-destructive">⚠</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{plainText(card.back, 70)}</div>
            </button>

            {/* State badge + due — fixed column */}
            <div className="shrink-0 w-24 flex flex-col items-end gap-0.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateBadgeClass(reviewState)}`}>
                    {STATE_LABELS[reviewState] ?? 'Új'}
                </span>
                {card.review && (
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDue(card.review.due_at, card.review.state, now)}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                {onPractice && (
                    <button
                        onClick={() => onPractice(card)}
                        className="size-8 inline-flex items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 transition-colors hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400 dark:hover:bg-violet-900/40"
                        title="Mondatírás gyakorlás"
                    >
                        <Sparkles className="size-3.5" />
                    </button>
                )}
                <button
                    onClick={() => onEdit(card)}
                    className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Szerkesztés"
                >
                    <Edit2 className="size-3.5" />
                </button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="size-8 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-xs">Kártya műveletek</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => onStats(card)}>
                            <Info className="size-3.5 mr-2" />
                            Statisztika
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => router.post(duplicateCard({ deck: deck.id, flashcard: card.id }), {}, { preserveScroll: true })}
                        >
                            <Copy className="size-3.5 mr-2" />
                            Másolat létrehozása
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={() => router.patch(
                                updateCard({ deck: deck.id, flashcard: card.id }),
                                { direction: card.direction === 'both' ? 'front_to_back' : 'both' },
                                { preserveScroll: true },
                            )}
                        >
                            <ArrowLeftRight className="size-3.5 mr-2" />
                            {card.direction === 'both' ? 'Visszaállítás (1 irányú)' : 'Kétirányú kártya'}
                        </DropdownMenuItem>

                        {otherDecks.length > 0 && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <MoveRight className="size-3.5 mr-2" />
                                    Áthelyezés
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                    {otherDecks.map((d) => (
                                        <DropdownMenuItem
                                            key={d.id}
                                            onClick={() => router.post(
                                                moveCard({ deck: deck.id, flashcard: card.id }),
                                                { target_deck_id: d.id },
                                                { preserveScroll: true },
                                            )}
                                        >
                                            {d.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => {
                                if (!confirm('Visszaállítod a kártya haladását? Az összes SRS adat törlődik.')) return;
                                router.post(resetProgress({ deck: deck.id, flashcard: card.id }), {}, { preserveScroll: true });
                            }}
                        >
                            <RotateCcw className="size-3.5 mr-2" />
                            Haladás visszaállítása
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                                if (!confirm('Törlöd ezt a kártyát?')) return;
                                router.delete(destroyCard({ deck: deck.id, flashcard: card.id }), { preserveScroll: true });
                            }}
                        >
                            <Trash2 className="size-3.5 mr-2" />
                            Törlés
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

function CardPreviewDialog({ card, onClose, onEdit, now }: {
    card: Flashcard;
    onClose: () => void;
    onEdit: () => void;
    now: number;
}) {
    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        Kártya előnézet
                        {card.direction === 'both' && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                <ArrowLeftRight className="size-2.5" />
                                Kétirányú
                            </span>
                        )}
                        {card.review?.is_leech && (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">leech</span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-3 pt-1">
                    <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Előlap</p>
                        <div className="text-base font-medium leading-relaxed">
                            <RichTextContent html={card.front} />
                        </div>
                        {card.front_notes && (
                            <div className="text-sm text-muted-foreground italic border-t pt-2 mt-2">
                                <RichTextContent html={card.front_notes} />
                            </div>
                        )}
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hátlap</p>
                        <div className="text-base leading-relaxed">
                            <RichTextContent html={card.back} />
                        </div>
                        {card.back_notes && (
                            <div className="text-sm text-muted-foreground italic border-t pt-2 mt-2">
                                <RichTextContent html={card.back_notes} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                    {card.review ? (
                        <>
                            <span className={`font-medium ${STATE_COLORS[card.review.state]}`}>{STATE_LABELS[card.review.state]}</span>
                            <span>·</span>
                            <span>{formatDue(card.review.due_at, card.review.state)}</span>
                            <span>·</span>
                            <span>{card.review.lapses} tévesztés</span>
                            {card.review.interval > 0 && (
                                <>
                                    <span>·</span>
                                    <span>{card.review.interval} napos intervallum</span>
                                </>
                            )}
                        </>
                    ) : (
                        <span className="font-medium text-blue-500">Új kártya</span>
                    )}
                    {card.color && (
                        <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                                <span className="size-2.5 rounded-full inline-block border" style={{ background: card.color }} />
                                szín
                            </span>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={onClose}>Bezárás</Button>
                    <Button onClick={() => { onClose(); onEdit(); }}>
                        <Edit2 className="size-3.5 mr-1.5" />
                        Szerkesztés
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

type DictDefinition = { definition: string; example?: string };
type DictMeaning = { partOfSpeech: string; definitions: DictDefinition[] };
type DictEntry = { word: string; phonetic?: string; meanings: DictMeaning[] };

function CardForm({
    deck,
    card,
    onCancel,
}: {
    deck: Deck;
    card?: Flashcard;
    onCancel: () => void;
}) {
    const isEdit = !!card;
    const action = isEdit
        ? updateCard({ deck: deck.id, flashcard: card.id })
        : storeCard(deck.id);

    const frontEditorRef = useRef<RichTextEditorHandle>(null);
    const backEditorRef = useRef<RichTextEditorHandle>(null);
    const [frontText, setFrontText] = useState(() => card?.front ? card.front.replace(/<[^>]*>/g, '').trim() : '');
    const [dictEntry, setDictEntry] = useState<DictEntry | null>(null);
    const [dictLoading, setDictLoading] = useState(false);
    const [dictError, setDictError] = useState('');
    const [geminiLoading, setGeminiLoading] = useState(false);

    const { auth } = usePage<{ auth: { isAdmin: boolean; subscription: { hasAiAccess: boolean } | null } }>().props as any;
    const isAdmin: boolean = auth?.isAdmin ?? false;
    const hasAiAccess: boolean = isAdmin || (auth?.subscription?.hasAiAccess ?? false);

    const generateGeminiFlashcard = async () => {
        const word = frontText.trim();
        if (!word) return;
        setGeminiLoading(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const res = await fetch(`/text-analysis/gemini-flashcard?word=${encodeURIComponent(word)}`, {
                headers: { 'X-CSRF-TOKEN': csrfToken, Accept: 'application/json' },
            });
            const data = await res.json();
            if (data.error) return;
            if (data.front) frontEditorRef.current?.setContent(data.front);
            if (data.back) backEditorRef.current?.setContent(data.back);
        } finally {
            setGeminiLoading(false);
        }
    };

    const lookupWord = async () => {
        const word = frontText.trim();
        if (!word) return;
        setDictLoading(true);
        setDictError('');
        setDictEntry(null);
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            if (!res.ok) throw new Error('not found');
            const data: DictEntry[] = await res.json();
            setDictEntry(data[0]);
        } catch {
            setDictError('Nem találtam ezt a szót a szótárban.');
        } finally {
            setDictLoading(false);
        }
    };

    const insertDefinition = (partOfSpeech: string, definition: string, example?: string) => {
        let html = `<p><em>${partOfSpeech}</em> — ${definition}</p>`;
        if (example) html += `<p><em>"${example}"</em></p>`;
        backEditorRef.current?.setContent(html);
        setDictEntry(null);
    };

    return (
        <Form
            action={action}
            method={isEdit ? 'patch' : 'post'}
            options={{ preserveScroll: true }}
            onSuccess={onCancel}
            className="flex flex-col gap-5"
        >
            {({ processing, errors }) => (
                <>
                    {/* Gemini AI banner */}
                    {hasAiAccess && (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                                    <Sparkles className="size-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-violet-800 dark:text-violet-200">
                                        Gemini AI kitöltés
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={generateGeminiFlashcard}
                                disabled={!frontText.trim() || geminiLoading}
                                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {geminiLoading
                                    ? <><Loader2 className="size-4 animate-spin" />Generálás...</>
                                    : <><Sparkles className="size-4" />Generálás</>}
                            </button>
                        </div>
                    )}

                    {/* Front + Back editors */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Előlap</Label>
                                <button
                                    type="button"
                                    onClick={lookupWord}
                                    disabled={!frontText.trim() || dictLoading}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    {dictLoading
                                        ? <><Loader2 className="size-3 animate-spin" />Keresés...</>
                                        : <>📖 Szótár</>}
                                </button>
                            </div>
                            <RichTextEditor
                                ref={frontEditorRef}
                                name="front"
                                defaultValue={card?.front ?? ''}
                                placeholder="Angol szó, kifejezés, kérdés..."
                                minHeight="18rem"
                                speakName="front_speak"
                                defaultSpeakValue={card?.front_speak ?? ''}
                                onTextChange={setFrontText}
                            />
                            {errors.front && <p className="text-xs text-destructive">{errors.front}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Hátlap</Label>
                            <RichTextEditor
                                ref={backEditorRef}
                                name="back"
                                defaultValue={card?.back ?? ''}
                                placeholder="Magyar jelentés, magyarázat, válasz..."
                                minHeight="18rem"
                                speakName="back_speak"
                                defaultSpeakValue={card?.back_speak ?? ''}
                            />
                            {errors.back && <p className="text-xs text-destructive">{errors.back}</p>}
                        </div>
                    </div>

                    {/* Dictionary results */}
                    {dictError && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {dictError}
                        </div>
                    )}
                    {dictEntry && (
                        <div className="rounded-xl border bg-muted/40 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{dictEntry.word}</span>
                                    {dictEntry.phonetic && (
                                        <span className="text-sm text-muted-foreground">{dictEntry.phonetic}</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDictEntry(null)}
                                    className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                            <div className="space-y-3 max-h-52 overflow-y-auto">
                                {dictEntry.meanings.map((meaning, mi) => (
                                    <div key={mi}>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{meaning.partOfSpeech}</p>
                                        <div className="space-y-1">
                                            {meaning.definitions.slice(0, 3).map((def, di) => (
                                                <button
                                                    key={di}
                                                    type="button"
                                                    onClick={() => insertDefinition(meaning.partOfSpeech, def.definition, def.example)}
                                                    className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors border border-transparent hover:border-border"
                                                >
                                                    <span>{def.definition}</span>
                                                    {def.example && (
                                                        <span className="block text-muted-foreground mt-0.5 text-xs italic">"{def.example}"</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Kattints egy definícióra → beilleszti a hátlapba.</p>
                        </div>
                    )}

                    {/* Options row */}
                    <div className="flex flex-wrap gap-4 rounded-xl border bg-muted/30 px-4 py-3">
                        <div className="grid gap-1.5 min-w-40">
                            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tanulás iránya</Label>
                            <Select name="direction" defaultValue={card?.direction ?? 'both'}>
                                <SelectTrigger className="h-9 bg-background">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="both">Mindkét irány</SelectItem>
                                    <SelectItem value="front_to_back">Előlap → Hátlap</SelectItem>
                                    <SelectItem value="back_to_front">Hátlap → Előlap</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor={`color-${card?.id ?? 'new'}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Kártya szín
                            </Label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    id={`color-${card?.id ?? 'new'}`}
                                    name="color"
                                    defaultValue={card?.color ?? '#6366f1'}
                                    className="h-9 w-14 rounded-lg border border-border cursor-pointer bg-transparent"
                                />
                                <span className="text-xs text-muted-foreground">Bal szegély színe</span>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-1">
                        <Button type="submit" disabled={processing} className="px-6">
                            {processing
                                ? <><Loader2 className="size-4 mr-2 animate-spin" />{isEdit ? 'Mentés...' : 'Hozzáadás...'}</>
                                : isEdit ? 'Változások mentése' : 'Kártya hozzáadása'}
                        </Button>
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Mégse
                        </Button>
                    </div>
                </>
            )}
        </Form>
    );
}

const DIRECTION_OPTIONS = [
    { value: 'front_to_back', label: 'Elölap → Hátlap' },
    { value: 'back_to_front', label: 'Hátlap → Elölap' },
    { value: 'both', label: 'Mindkét irány' },
] as const;

function CsvImport({ deck }: { deck: Deck }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [uploading, setUploading] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [direction, setDirection] = useState<'front_to_back' | 'back_to_front' | 'both'>('front_to_back');

    const handleChange = () => {
        if (!inputRef.current?.files?.length) return;
        setShowDialog(true);
    };

    const handleConfirm = () => {
        setShowDialog(false);
        setUploading(true);
        formRef.current?.submit();
    };

    const handleCancel = () => {
        setShowDialog(false);
        if (inputRef.current) inputRef.current.value = '';
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
                <input type="hidden" name="_token" value={typeof document !== 'undefined' ? document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '' : ''} />
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
                    {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <FileUp className="size-4 mr-1" />}
                    CSV import
                </Button>
            </form>

            <Dialog open={showDialog} onOpenChange={(open) => { if (!open) handleCancel(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>CSV import beállítások</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Melyik irányban szeretnéd tanulni a kártyákat?</p>
                        <div className="grid gap-2 mt-1">
                            {DIRECTION_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${direction === opt.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                >
                                    <input
                                        type="radio"
                                        name="csv_direction"
                                        value={opt.value}
                                        checked={direction === opt.value}
                                        onChange={() => setDirection(opt.value)}
                                        className="accent-primary"
                                    />
                                    <span className="text-sm font-medium">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                        <Button variant="outline" onClick={handleCancel}>Mégse</Button>
                        <Button onClick={handleConfirm}>
                            <FileUp className="size-4 mr-1" />
                            Importálás
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

type WordResult = { id: number; word: string; meaning_hu: string | null; is_custom: boolean };

function WordSearchImport({ deck, onImport }: { deck: Deck; onImport: (word: WordResult) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<WordResult[]>([]);
    const [selected, setSelected] = useState<WordResult | null>(null);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSearch = useCallback((value: string) => {
        setQuery(value);
        setSelected(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(searchWords({ query: { q: value } }).url, {
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
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
        if (!selected) return;
        onImport(selected);
        setSelected(null);
        setQuery('');
        setResults([]);
    };

    return (
        <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder="Szó keresése..."
                    className="h-9 w-36 sm:w-56 pl-8 text-sm"
                />
                {open && (
                    <div className="absolute z-50 top-full mt-1 left-0 w-72 rounded-md border bg-popover shadow-md overflow-hidden">
                        {searching && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">Keresés...</div>
                        )}
                        {results.map((word) => (
                            <button
                                key={`${word.is_custom ? 'c' : 'w'}-${word.id}`}
                                onMouseDown={() => handleSelect(word)}
                                className="w-full text-left flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors"
                            >
                                <span className="font-medium">{word.word}</span>
                                {word.is_custom && (
                                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">saját</span>
                                )}
                                {word.meaning_hu && (
                                    <span className="text-muted-foreground text-xs truncate">{word.meaning_hu}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <Button size="sm" variant="outline" disabled={!selected} onClick={handleImport}>
                <Import className="size-4 mr-1" />
                Importálás
            </Button>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="size-4 text-muted-foreground cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                        Keres a TopWords szótárban és a saját szavaid között.<br />
                        Importálás után azonnal szerkesztheted a kártyát.
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

const STATE_FILTER_OPTIONS = [
    { value: '', label: 'Összes' },
    { value: 'new', label: 'Új' },
    { value: 'learning', label: 'Tanulás' },
    { value: 'review', label: 'Ismétlés' },
    { value: 'relearning', label: 'Újratanulás' },
] as const;

export default function FlashcardShow({
    deck,
    flashcards,
    newDueCount,
    reviewDueCount,
    uncalibratedCount,
    deckSettings,
    otherDecks,
    nextDueAt,
}: {
    deck: Deck;
    flashcards: Flashcard[] | undefined;
    newDueCount: number;
    reviewDueCount: number;
    uncalibratedCount: number;
    deckSettings: DeckSettings;
    otherDecks: OtherDeck[];
    nextDueAt: string | null;
}) {
    const { flash, auth } = usePage<{ flash: { success?: string | null; calibrationPrompt?: number | null; importedCardId?: number | null }; auth: { isAdmin: boolean } }>().props as any;
    const isAdmin: boolean = (auth as any)?.isAdmin ?? false;
    const [showCalibrateModal, setShowCalibrateModal] = useState((flash?.calibrationPrompt ?? 0) > 0);
    const [showNewForm, setShowNewForm] = useState(false);
    const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
    const [previewCard, setPreviewCard] = useState<Flashcard | null>(null);
    const [statsCard, setStatsCard] = useState<Flashcard | null>(null);

    type PracticeResult = { words: { word: string; used: boolean; correct: boolean; feedback_hu: string }[]; grammar_issues: string[]; overall_hu: string; corrected_text: string | null };
    const [practiceCard, setPracticeCard] = useState<Flashcard | null>(null);
    const [practiceText, setPracticeText] = useState('');
    const [practiceLoading, setPracticeLoading] = useState(false);
    const [practiceResult, setPracticeResult] = useState<PracticeResult | null>(null);
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
        if (!practiceCard || practiceText.trim().length < 5) return;
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
                body: JSON.stringify({ words: [{ word, meaning_hu: null }], text: practiceText.trim() }),
            });
            const data = await res.json();
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
        if (!flash?.importedCardId || !flashcards) return;
        const card = flashcards.find((c) => c.id === flash.importedCardId);
        if (card) {
            setShowNewForm(false);
            setEditingCard(card);
        }
    }, [flash?.importedCardId, flashcards]);
    const [now, setNow] = useState(() => Date.now());
    const [secondsUntilDue, setSecondsUntilDue] = useState<number | null>(() => {
        if (!nextDueAt) return null;
        return Math.max(0, Math.round((new Date(nextDueAt).getTime() - Date.now()) / 1000));
    });

    useEffect(() => {
        const tick = () => {
            const ts = Date.now();
            setNow(ts);
            if (!nextDueAt) return;
            const remaining = Math.round((new Date(nextDueAt).getTime() - ts) / 1000);
            if (remaining <= 0) {
                setSecondsUntilDue(0);
                router.reload({ only: ['newDueCount', 'reviewDueCount', 'nextDueAt'] });
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
    const PAGE_SIZE = 50;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const filtered = (flashcards ?? []).filter((card) => {
        if (stateFilter) {
            const s = card.review?.state ?? 'new';
            if (s !== stateFilter) return false;
        }
        if (search) {
            const q = search.toLowerCase();
            return card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q);
        }
        return true;
    });

    const visibleCards = filtered.slice(0, visibleCount);

    const stateCounts = {
        new: (flashcards ?? []).filter((c) => !c.review || c.review.state === 'new').length,
        learning: (flashcards ?? []).filter((c) => c.review?.state === 'learning').length,
        review: (flashcards ?? []).filter((c) => c.review?.state === 'review').length,
        relearning: (flashcards ?? []).filter((c) => c.review?.state === 'relearning').length,
    };

    const handleSelect = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
    const someSelected = selectedIds.size > 0;
    const allSelectedBoth = someSelected && [...selectedIds].every((id) => (flashcards ?? []).find((c) => c.id === id)?.direction === 'both');

    const toggleSelectAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map((c) => c.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const bulkAction = (url: string, extraData: Record<string, unknown> = {}) => {
        router.post(url, { ids: [...selectedIds], ...extraData }, {
            preserveScroll: true,
            onSuccess: clearSelection,
        });
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

            <div className="px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <Heading
                        title={deck.name}
                        description={deck.description ?? undefined}
                    />
                    <span className="text-sm text-muted-foreground shrink-0 mt-1">{flashcards?.length ?? '—'} kártya</span>
                </div>

                {/* Calibration banner */}
                {uncalibratedCount > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5 dark:border-amber-800 dark:bg-amber-950/30">
                        <div>
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                                {uncalibratedCount} kártya vár kalibrálásra
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                Kalibrálásig ezek nem kerülnek a tanulási sorba.
                            </p>
                        </div>
                        <div className="flex gap-2 self-start sm:self-auto">
                            <Button size="sm" onClick={() => router.visit(calibrate(deck.id))}>
                                Folytatás
                            </Button>
                            <Button size="sm" variant="ghost" className="text-amber-700 dark:text-amber-400"
                                onClick={() => router.post(skipCalibration(deck.id).url)}>
                                Kihagyás
                            </Button>
                        </div>
                    </div>
                )}

                {/* Study banner */}
                {(flashcards?.length ?? 0) > 0 && (() => {
                    const dueCount = newDueCount + reviewDueCount;
                    const hasCountdown = dueCount === 0 && secondsUntilDue !== null && secondsUntilDue > 0;
                    const mins = hasCountdown ? Math.floor(secondsUntilDue! / 60) : 0;
                    const secs = hasCountdown ? secondsUntilDue! % 60 : 0;
                    return (
                        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-4 sm:px-5 ${dueCount > 0 ? 'border-primary/30 bg-primary/5' : 'bg-muted/40'}`}>
                            <div>
                                {dueCount > 0 ? (
                                    <>
                                        <p className="font-semibold text-sm">
                                            {newDueCount > 0 && <span className="text-blue-600 dark:text-blue-400">{newDueCount} új</span>}
                                            {newDueCount > 0 && reviewDueCount > 0 && <span className="text-muted-foreground mx-1.5">·</span>}
                                            {reviewDueCount > 0 && <span className="text-primary">{reviewDueCount} ismétlés</span>}
                                            <span className="text-muted-foreground ml-1.5">esedékes</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Folytathatod a tanulást!</p>
                                    </>
                                ) : hasCountdown ? (
                                    <>
                                        <p className="font-semibold text-sm text-muted-foreground">
                                            Következő kártya{' '}
                                            <span className="tabular-nums text-foreground">
                                                {mins > 0 ? `${mins}p ` : ''}{String(secs).padStart(2, '0')}mp
                                            </span>{' '}
                                            múlva esedékes
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">A gomb automatikusan aktiválódik.</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-semibold text-sm text-muted-foreground">Nincs esedékes kártya</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Gyere vissza később.</p>
                                    </>
                                )}
                            </div>
                            {dueCount > 0 ? (
                                <Link href={study(deck.id)} className="self-start sm:self-auto">
                                    <Button size="lg" className="gap-2 px-6">
                                        <BookOpen className="size-4" />
                                        Tanulás
                                    </Button>
                                </Link>
                            ) : (
                                <Button size="lg" variant="outline" disabled className="self-start sm:self-auto gap-2 px-6">
                                    <BookOpen className="size-4" />
                                    Tanulás
                                </Button>
                            )}
                        </div>
                    );
                })()}

                {/* Flash message */}
                {flash?.success && (
                    <div className="rounded-md border border-green-500/30 bg-green-500/10 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                {/* Calibration modal */}
                <Dialog open={showCalibrateModal} onOpenChange={setShowCalibrateModal}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Kalibráció</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{flash?.calibrationPrompt} kártyát</span> importáltál.
                            Szeretnéd kalibrálni őket, hogy az SRS ne nulláról induljon?
                        </p>
                        <div className="flex justify-end gap-3 mt-2">
                            <Button variant="outline" onClick={() => { setShowCalibrateModal(false); router.post(skipCalibration(deck.id).url); }}>
                                Kihagyás
                            </Button>
                            <Button onClick={() => { setShowCalibrateModal(false); router.visit(calibrate(deck.id)); }}>
                                Kalibrálás indítása
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowNewForm(true); setEditingCard(null); }}
                    >
                        <Plus className="size-4 mr-1" />
                        Új kártya
                    </Button>
                    <WordSearchImport deck={deck} onImport={handleWordImport} />
                    <CsvImport deck={deck} />
                    {(flashcards?.length ?? 0) > 0 && (
                        <a href={csvExport(deck.id).url}>
                            <Button size="sm" variant="outline">
                                <Download className="size-4 mr-1" />
                                CSV export
                            </Button>
                        </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setShowSettings(true)} className="relative">
                        <Settings2 className="size-4 mr-1" />
                        Beállítások
                        {deckSettings !== null && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" title="Egyéni beállítások aktívak" />
                        )}
                    </Button>
                </div>

                <Deferred
                    data="flashcards"
                    fallback={
                        <div className="space-y-2 pt-2">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-14 rounded-lg border bg-muted/40 animate-pulse" />
                            ))}
                        </div>
                    }
                >
                <Separator />

                {/* Filters */}
                {(flashcards?.length ?? 0) > 0 && (
                    <div className="space-y-3">
                        {/* Search */}
                        <div className="relative max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
                                placeholder="Keresés az előlapon / hátlapon..."
                                className="pl-8 h-8 text-sm"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* State filter chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                            {STATE_FILTER_OPTIONS.map(({ value, label }) => {
                                const count = value === ''
                                    ? flashcards.length
                                    : stateCounts[value as keyof typeof stateCounts];
                                const active = stateFilter === value;
                                return (
                                    <button
                                        key={value}
                                        onClick={() => { setStateFilter(value); setVisibleCount(PAGE_SIZE); }}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                            active
                                                ? 'border-primary bg-primary text-primary-foreground'
                                                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                                        }`}
                                    >
                                        {label}
                                        <span className={`text-[10px] ${active ? 'opacity-80' : 'opacity-60'}`}>{count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Result count */}
                        {(search || stateFilter) && (
                            <p className="text-xs text-muted-foreground">
                                {filtered.length} találat
                                {' · '}
                                <button onClick={() => { setSearch(''); setStateFilter(''); }} className="underline hover:no-underline">
                                    szűrők törlése
                                </button>
                            </p>
                        )}
                    </div>
                )}

                {/* Card list */}
                {(flashcards?.length ?? 0) === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                        <BookOpen className="size-12 mb-4 opacity-30" />
                        <p className="text-sm">Még nincs kártya ebben a deckben.</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Nincs a szűrőknek megfelelő kártya.</div>
                ) : (
                    <div className="space-y-2">
                        {/* Select all + bulk action bar */}
                        <div className="flex items-center gap-3 px-1 pb-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={toggleSelectAll}
                                    className="size-4 rounded border-input accent-primary cursor-pointer"
                                />
                                {allFilteredSelected ? 'Kijelölés törlése' : `Összes kijelölése (${filtered.length})`}
                            </label>

                            {someSelected && (
                                <div className="flex flex-wrap items-center gap-1.5 ml-auto animate-in fade-in duration-150">
                                    <span className="text-xs text-muted-foreground mr-1">{selectedIds.size} kijelölve</span>

                                    <button
                                        onClick={() => {
                                            if (!confirm(`Visszaállítod ${selectedIds.size} kártya haladását?`)) return;
                                            bulkAction(bulkResetCards(deck.id).url);
                                        }}
                                        className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    >
                                        <RotateCcw className="size-3" />
                                        Haladás törlése
                                    </button>

                                    <button
                                        onClick={() => bulkAction(bulkDirectionCards(deck.id).url, { direction: allSelectedBoth ? 'front_to_back' : 'both' })}
                                        className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    >
                                        <ArrowLeftRight className="size-3" />
                                        {allSelectedBoth ? 'Visszaállítás (1 irányú)' : 'Kétirányú kártya'}
                                    </button>

                                    {otherDecks.length > 0 && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                                                    <MoveRight className="size-3" />
                                                    Áthelyezés
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {otherDecks.map((d) => (
                                                    <DropdownMenuItem
                                                        key={d.id}
                                                        onClick={() => bulkAction(bulkMoveCards(deck.id).url, { target_deck_id: d.id })}
                                                    >
                                                        {d.name}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (!confirm(`Törlöd a kijelölt ${selectedIds.size} kártyát?`)) return;
                                            bulkAction(bulkDeleteCards(deck.id).url);
                                        }}
                                        className="flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                                    >
                                        <Trash2 className="size-3" />
                                        Törlés
                                    </button>
                                </div>
                            )}
                        </div>

                        {visibleCards.map((card) => (
                            <div key={card.id}>
                                <CardRow
                                        card={card}
                                        deck={deck}
                                        otherDecks={otherDecks}
                                        onEdit={(c) => { setEditingCard(c); setShowNewForm(false); }}
                                        onPreview={(c) => setPreviewCard(c)}
                                        onPractice={isAdmin ? openPracticeModal : undefined}
                                        onStats={(c) => setStatsCard(c)}
                                        selected={selectedIds.has(card.id)}
                                        onSelect={handleSelect}
                                        now={now}
                                    />
                            </div>
                        ))}
                        {visibleCount < filtered.length && (
                            <div className="flex justify-center py-4">
                                <button
                                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                                    className="text-sm text-muted-foreground hover:text-foreground underline"
                                >
                                    Több betöltése ({filtered.length - visibleCount} maradt)
                                </button>
                            </div>
                        )}
                    </div>
                )}
                </Deferred>
            </div>

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
                    onEdit={() => { setEditingCard(previewCard); setShowNewForm(false); }}
                    now={now}
                />
            )}

            {/* Deck settings dialog */}
            <DeckSettingsDialog
                deck={deck}
                deckSettings={deckSettings}
                open={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* Practice modal */}
            <Dialog open={practiceCard !== null} onOpenChange={(open) => { if (!open) closePracticeModal(); }}>
                <DialogContent className="sm:max-w-2xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="size-4 text-violet-600" />
                            Mondatírás gyakorlás
                            {practiceCard && (
                                <span className="ml-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                    {practiceCard.front.replace(/<[^>]*>/g, '').trim()}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Írj mondatokat amelyekben természetesen használod a szót. Az AI ellenőrzi a szóhasználatot és a grammatikát.
                            </p>
                            <Textarea
                                value={practiceText}
                                onChange={(e) => { setPracticeText(e.target.value.slice(0, 3000)); setPracticeResult(null); }}
                                placeholder="Írj mondatokat..."
                                className="min-h-40 resize-y text-base leading-relaxed"
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{practiceText.length} / 3000</span>
                                <Button
                                    onClick={handlePracticeCheck}
                                    disabled={practiceText.trim().length < 5 || practiceLoading}
                                    className="gap-2 border-violet-200 bg-violet-600 text-white hover:bg-violet-700 dark:border-violet-800"
                                >
                                    {practiceLoading
                                        ? <Loader2 className="size-4 animate-spin" />
                                        : <Sparkles className="size-4" />
                                    }
                                    {practiceLoading ? 'Ellenőrzés...' : 'Ellenőrzés'}
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
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-800 dark:bg-violet-950/30">
                                    <div className="flex items-start gap-2">
                                        <Sparkles className="size-4 shrink-0 mt-0.5 text-violet-600" />
                                        <p className="text-sm text-violet-800 dark:text-violet-300">{practiceResult.overall_hu}</p>
                                    </div>
                                </div>

                                {practiceResult.grammar_issues.length > 0 && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1 dark:border-amber-800 dark:bg-amber-950/30">
                                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Grammatikai megjegyzések</p>
                                        <ul className="space-y-1">
                                            {practiceResult.grammar_issues.map((issue, i) => (
                                                <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                                                    <span className="mt-1 size-1 rounded-full bg-amber-500 shrink-0" />
                                                    {typeof issue === 'string' ? issue : ((issue as any).explanation_hu ?? (issue as any).issue ?? JSON.stringify(issue))}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {practiceResult.corrected_text && (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-1 dark:border-blue-800 dark:bg-blue-950/30">
                                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Javított változat</p>
                                        <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">{practiceResult.corrected_text}</p>
                                    </div>
                                )}

                                {practiceResult.grammar_issues.length === 0 && !practiceResult.corrected_text && (
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
                onOpenChange={(open) => { if (!open) { setShowNewForm(false); setEditingCard(null); } }}
            >
                <DialogContent className="sm:max-w-7xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingCard ? 'Kártya szerkesztése' : 'Új kártya'}</DialogTitle>
                    </DialogHeader>
                    <CardForm
                        key={editingCard?.id ?? 'new'}
                        deck={deck}
                        card={editingCard ?? undefined}
                        onCancel={() => { setShowNewForm(false); setEditingCard(null); }}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

FlashcardShow.layout = (props: { deck: Deck }) => ({
    breadcrumbs: [
        { title: 'Flashcard decks', href: index() },
        { title: props.deck.name, href: show({ deck: props.deck.id }) },
    ],
});
