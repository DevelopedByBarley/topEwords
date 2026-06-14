import { Form, router } from '@inertiajs/react';
import { Plus, Settings2, X } from 'lucide-react';
import React, { useState } from 'react';
import type { Deck, DeckSettings } from '@/components/flashcards/types';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    destroy as destroyDeckSettings,
    update as updateDeckSettings,
} from '@/routes/flashcards/settings';

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

const PRESETS: {
    label: string;
    emoji: string;
    description: string;
    settings: NonNullable<DeckSettings>;
}[] = [
    {
        label: 'Lassú',
        emoji: '🐢',
        description: 'Kevés új kártya, rövid intervallumok, több ismétlés',
        settings: {
            ...DEFAULT_SETTINGS,
            new_cards_per_day: 10,
            max_reviews_per_day: 150,
            learning_steps: [1, 10, 1440],
            graduating_interval: 1,
            easy_interval: 2,
            interval_modifier: 80,
        },
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
        settings: {
            ...DEFAULT_SETTINGS,
            new_cards_per_day: 40,
            max_reviews_per_day: 400,
            learning_steps: [1, 10],
            graduating_interval: 2,
            easy_interval: 7,
            interval_modifier: 115,
        },
    },
];

function SettingField({
    id,
    label,
    description,
    name,
    defaultValue,
    min,
    max,
    error,
    suffix,
}: {
    id: string;
    label: string;
    description?: string;
    name: string;
    defaultValue: number;
    min?: number;
    max?: number;
    error?: string;
    suffix?: string;
}) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    name={name}
                    defaultValue={defaultValue}
                    min={min}
                    max={max}
                    className="w-28"
                />
                {suffix && (
                    <span className="text-sm text-muted-foreground">
                        {suffix}
                    </span>
                )}
            </div>
            <InputError message={error} />
        </div>
    );
}

export default function DeckSettingsDialog({
    deck,
    deckSettings,
    open,
    onClose,
}: {
    deck: Deck;
    deckSettings: DeckSettings;
    open: boolean;
    onClose: () => void;
}) {
    const hasCustom = deckSettings !== null;
    const [activeSettings, setActiveSettings] = useState<
        NonNullable<DeckSettings>
    >(deckSettings ?? DEFAULT_SETTINGS);
    const [presetKey, setPresetKey] = useState(0);
    const s = activeSettings;
    type StepUnit = 'perc' | 'óra' | 'nap';
    type StepEntry = { value: number; unit: StepUnit };

    function minutesToEntry(minutes: number): StepEntry {
        if (minutes >= 1440 && minutes % 1440 === 0) {
            return { value: minutes / 1440, unit: 'nap' };
        }

        if (minutes >= 60 && minutes % 60 === 0) {
            return { value: minutes / 60, unit: 'óra' };
        }

        return { value: minutes, unit: 'perc' };
    }

    function entryToMinutes({ value, unit }: StepEntry): number {
        if (unit === 'nap') {
            return value * 1440;
        }

        if (unit === 'óra') {
            return value * 60;
        }

        return value;
    }

    const [steps, setSteps] = useState<StepEntry[]>(() =>
        s.learning_steps.map(minutesToEntry),
    );

    const addStep = () =>
        setSteps((prev) => [...prev, { value: 10, unit: 'perc' }]);
    const removeStep = (i: number) =>
        setSteps((prev) => prev.filter((_, idx) => idx !== i));
    const updateStepValue = (i: number, value: number) =>
        setSteps((prev) =>
            prev.map((step, idx) => (idx === i ? { ...step, value } : step)),
        );
    const updateStepUnit = (i: number, unit: StepUnit) =>
        setSteps((prev) =>
            prev.map((step, idx) => (idx === i ? { ...step, unit } : step)),
        );

    const applyPreset = (preset: (typeof PRESETS)[0]) => {
        setActiveSettings(preset.settings);
        setSteps(preset.settings.learning_steps.map(minutesToEntry));
        setPresetKey((k) => k + 1);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="size-4" />
                        Deck beállítások
                        {hasCustom && (
                            <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                                egyéni
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <Form
                    action={updateDeckSettings(deck.id)}
                    options={{ preserveScroll: true }}
                    onSuccess={onClose}
                    className="space-y-6 pt-2"
                >
                    {({ processing, errors }) => (
                        <>
                            {/* Presets */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    Gyors beállítás
                                </h4>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                    {PRESETS.map((preset) => (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className="flex flex-col items-start gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent"
                                        >
                                            <span className="text-sm font-medium">
                                                {preset.emoji} {preset.label}
                                            </span>
                                            <span className="text-xs leading-snug text-muted-foreground">
                                                {preset.description}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <Separator />
                            <div key={presetKey} className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Napi korlátok
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <SettingField
                                            id="ds_new"
                                            label="Új kártyák / nap"
                                            description="Mennyi új kártyát tanulj naponta. Kevesebb = lassabb haladás, de könnyebben megemészthető mennyiség."
                                            name="new_cards_per_day"
                                            defaultValue={s.new_cards_per_day}
                                            min={1}
                                            max={9999}
                                            error={errors.new_cards_per_day}
                                            suffix="db"
                                        />
                                        <SettingField
                                            id="ds_rev"
                                            label="Max ismétlések / nap"
                                            description="Mennyi már tanult kártyát ismételj naponta. Ha sokat tanulsz, érdemes magasan tartani, hogy ne maradj le."
                                            name="max_reviews_per_day"
                                            defaultValue={s.max_reviews_per_day}
                                            min={1}
                                            max={9999}
                                            error={errors.max_reviews_per_day}
                                            suffix="db"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Tanulási lépések
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Amikor először látsz egy új kártyát,
                                        ennyi időnként kérdez rá újra, mielőtt
                                        „megtanultnak" minősül. Pl.{' '}
                                        <span className="font-medium">
                                            1 perc → 10 perc → 1 nap
                                        </span>
                                        : háromszor kell helyesen megválaszolni
                                        növekvő időközönként. Több lépés =
                                        alaposabb rögzítés.
                                    </p>
                                    <div className="space-y-2">
                                        {steps.map((step, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2"
                                            >
                                                <span className="w-5 shrink-0 text-right text-xs text-muted-foreground">
                                                    {i + 1}.
                                                </span>
                                                <input
                                                    type="hidden"
                                                    name="learning_steps[]"
                                                    value={entryToMinutes(step)}
                                                />
                                                <Input
                                                    type="number"
                                                    value={step.value}
                                                    onChange={(e) =>
                                                        updateStepValue(
                                                            i,
                                                            Math.max(
                                                                1,
                                                                Number(
                                                                    e.target
                                                                        .value,
                                                                ),
                                                            ),
                                                        )
                                                    }
                                                    min={1}
                                                    className="w-20"
                                                />
                                                <select
                                                    value={step.unit}
                                                    onChange={(e) =>
                                                        updateStepUnit(
                                                            i,
                                                            e.target.value as
                                                                | 'perc'
                                                                | 'óra'
                                                                | 'nap',
                                                        )
                                                    }
                                                    className="h-9 rounded-md border border-input bg-background px-2 text-base text-foreground md:text-sm"
                                                >
                                                    <option value="perc">
                                                        perc
                                                    </option>
                                                    <option value="óra">
                                                        óra
                                                    </option>
                                                    <option value="nap">
                                                        nap
                                                    </option>
                                                </select>
                                                {steps.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeStep(i)
                                                        }
                                                        className="ml-1 text-muted-foreground transition-colors hover:text-destructive"
                                                    >
                                                        <X className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={addStep}
                                            className="mt-1"
                                        >
                                            <Plus className="mr-1 size-3.5" />
                                            Lépés hozzáadása
                                        </Button>
                                    </div>
                                    <InputError
                                        message={errors['learning_steps']}
                                    />
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Végzés & intervallumok
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <SettingField
                                            id="ds_grad"
                                            label="Végzési intervallum"
                                            description="Ennyi nap múlva jelenik meg újra a kártya, miután sikeresen végigment a tanulási lépéseken. Kisebb érték = hamarabb visszajön, több ismétlés."
                                            name="graduating_interval"
                                            defaultValue={s.graduating_interval}
                                            min={1}
                                            max={365}
                                            error={errors.graduating_interval}
                                            suffix="nap"
                                        />
                                        <SettingField
                                            id="ds_easy"
                                            label="Könnyű intervallum"
                                            description='Ha tanulás közben „Könnyű"-t nyomsz, egyből ennyi napra ugrik a kártya — kihagyja a többi lépést. Kisebb = hamarabb visszajön.'
                                            name="easy_interval"
                                            defaultValue={s.easy_interval}
                                            min={1}
                                            max={365}
                                            error={errors.easy_interval}
                                            suffix="nap"
                                        />
                                        <SettingField
                                            id="ds_max"
                                            label="Max intervallum"
                                            description="Két ismétlés között maximum ennyi nap telhet el. Pl. 180-ra állítva soha nem fog fél évnél ritkábban előjönni egy kártya."
                                            name="max_interval"
                                            defaultValue={s.max_interval}
                                            min={1}
                                            max={36500}
                                            error={errors.max_interval}
                                            suffix="nap"
                                        />
                                        <SettingField
                                            id="ds_ease"
                                            label="Kezdő nehézség"
                                            description='Milyen "könnyűnek" tekinti az algoritmus a kártyát induláskor. 250% az alapértelmezett. Kisebb érték = az intervallumok lassabban nőnek.'
                                            name="starting_ease"
                                            defaultValue={s.starting_ease}
                                            min={130}
                                            max={999}
                                            error={errors.starting_ease}
                                            suffix="%"
                                        />
                                        <SettingField
                                            id="ds_bonus"
                                            label="Könnyű bónusz"
                                            description='„Könnyű" értékeléskor az intervallum ennyivel hosszabb a szokásosnál. 130% = 30%-kal tovább vár. Csökkentsd, ha nem akarsz sok kártyát kihagyni.'
                                            name="easy_bonus"
                                            defaultValue={s.easy_bonus}
                                            min={100}
                                            max={999}
                                            error={errors.easy_bonus}
                                            suffix="%"
                                        />
                                        <SettingField
                                            id="ds_hard"
                                            label="Nehéz szorzó"
                                            description='„Nehéz"-et nyomva az intervallum ennyivel nő (120% = kicsit hosszabb). Az algoritmus nehezebb kártyaként kezeli ezután.'
                                            name="hard_interval_modifier"
                                            defaultValue={
                                                s.hard_interval_modifier
                                            }
                                            min={100}
                                            max={999}
                                            error={
                                                errors.hard_interval_modifier
                                            }
                                            suffix="%"
                                        />
                                        <SettingField
                                            id="ds_mod"
                                            label="Intervallum módosító"
                                            description="Az összes kiszámolt intervallumot ezzel szorozza meg. 80% = minden intervallum 20%-kal rövidebb, azaz többet ismételsz. Lassabb haladáshoz csökkentsd."
                                            name="interval_modifier"
                                            defaultValue={s.interval_modifier}
                                            min={10}
                                            max={999}
                                            error={errors.interval_modifier}
                                            suffix="%"
                                        />
                                        <SettingField
                                            id="ds_lapse"
                                            label="Tévesztés utáni visszaesés"
                                            description="Ha eltévesztesz egy kártyát, az előző intervallumának hány %-áról indul újra. 0% = teljesen elölről, 50% = felezi az intervallumot."
                                            name="lapse_new_interval"
                                            defaultValue={s.lapse_new_interval}
                                            min={0}
                                            max={100}
                                            error={errors.lapse_new_interval}
                                            suffix="%"
                                        />
                                        <SettingField
                                            id="ds_leech"
                                            label="Problémás kártya küszöb"
                                            description='Ha egy kártyát ennyiszer tévesztesz el, „problémásnak" jelöli. Ez egy figyelmeztető jelzés — érdemes átírni vagy mnemotechnikát alkalmazni.'
                                            name="leech_threshold"
                                            defaultValue={s.leech_threshold}
                                            min={1}
                                            max={99}
                                            error={errors.leech_threshold}
                                            suffix="tévesztés"
                                        />
                                    </div>
                                </div>

                                <Separator />

                                {/* Shuffle */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        Sorrend
                                    </h4>
                                    <label className="flex cursor-pointer items-start gap-3">
                                        <input
                                            type="checkbox"
                                            name="shuffle_cards"
                                            defaultChecked={s.shuffle_cards}
                                            value="1"
                                            className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
                                        />
                                        <div className="grid gap-0.5">
                                            <span className="text-sm font-medium">
                                                Kártyák keverése
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                Véletlenszerű sorrendben mutatja
                                                a kártyákat — kétoldalú
                                                kártyáknál az előlap és hátlap
                                                nem kerül egymás mellé.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>{' '}
                            {/* end key={presetKey} */}
                            <div className="flex items-center justify-between gap-4 pt-1">
                                <Button type="submit" disabled={processing}>
                                    Mentés
                                </Button>
                                {hasCustom && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-muted-foreground"
                                        onClick={() => {
                                            if (
                                                !confirm(
                                                    'Visszaállítod a globális / alapértelmezett beállításokra?',
                                                )
                                            ) {
                                                return;
                                            }

                                            router.delete(
                                                destroyDeckSettings(deck.id)
                                                    .url,
                                                {
                                                    preserveScroll: true,
                                                    onSuccess: onClose,
                                                },
                                            );
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
