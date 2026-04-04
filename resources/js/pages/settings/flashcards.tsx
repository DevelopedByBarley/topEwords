import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { edit, update } from '@/routes/flashcard-settings';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FlashcardSettings = {
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
};

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
                    <span className="text-sm text-muted-foreground">{suffix}</span>
                )}
            </div>
            <InputError message={error} />
        </div>
    );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
    return (
        <div className="border-b pb-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
            )}
        </div>
    );
}

export default function FlashcardSettingsPage({ settings }: { settings: FlashcardSettings }) {
    return (
        <>
            <Head title="Flashcard beállítások" />
            <h1 className="sr-only">Flashcard beállítások</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Flashcard beállítások"
                    description="Az ismétlési algoritmus (SRS) paramétereit állíthatod be itt"
                />

                <Form
                    action={update()}
                    method="put"
                    options={{ preserveScroll: true }}
                    className="space-y-8"
                >
                    {({ processing, recentlySuccessful, errors }) => (
                        <>
                            {/* Daily limits */}
                            <div className="space-y-4">
                                <SectionHeading
                                    title="Napi korlátok"
                                    description="Mennyi új és ismétlendő kártyát mutasson naponta"
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="new_cards_per_day"
                                        label="Új kártyák / nap"
                                        name="new_cards_per_day"
                                        defaultValue={settings.new_cards_per_day}
                                        min={1}
                                        max={9999}
                                        suffix="db"
                                        error={errors.new_cards_per_day}
                                    />
                                    <SettingField
                                        id="max_reviews_per_day"
                                        label="Max ismétlések / nap"
                                        name="max_reviews_per_day"
                                        defaultValue={settings.max_reviews_per_day}
                                        min={1}
                                        max={9999}
                                        suffix="db"
                                        error={errors.max_reviews_per_day}
                                    />
                                </div>
                            </div>

                            {/* Learning steps */}
                            <div className="space-y-4">
                                <SectionHeading
                                    title="Tanulási lépések"
                                    description="Új kártyák esetén az első megjelenések közötti szünet (percben). Az utolsó lépés után a kártya 'érettnek' minősül."
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {settings.learning_steps.map((step, index) => (
                                        <SettingField
                                            key={index}
                                            id={`learning_steps_${index}`}
                                            label={`${index + 1}. lépés`}
                                            name={`learning_steps[${index}]`}
                                            defaultValue={step}
                                            min={1}
                                            max={1440}
                                            suffix="perc"
                                            error={errors[`learning_steps.${index}` as keyof typeof errors]}
                                        />
                                    ))}
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="graduating_interval"
                                        label="Érettségi intervallum"
                                        description="Hány nap múlva jelenjen meg újra az első alkalommal sikeresen megtanult kártya"
                                        name="graduating_interval"
                                        defaultValue={settings.graduating_interval}
                                        min={1}
                                        max={365}
                                        suffix="nap"
                                        error={errors.graduating_interval}
                                    />
                                    <SettingField
                                        id="easy_interval"
                                        label="Könnyű intervallum"
                                        description="Ha az első alkalommal 'Könnyű'-t nyomsz, ennyivel tér vissza"
                                        name="easy_interval"
                                        defaultValue={settings.easy_interval}
                                        min={1}
                                        max={365}
                                        suffix="nap"
                                        error={errors.easy_interval}
                                    />
                                </div>
                            </div>

                            {/* Ease factors */}
                            <div className="space-y-4">
                                <SectionHeading
                                    title="Könnyűségi faktorok"
                                    description="Az intervallum szorzói az egyes gombokhoz. 100 = 1.0x, 250 = 2.5x"
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="starting_ease"
                                        label="Kezdeti könnyűségi faktor"
                                        description="Alapértelmezett szorzó új kártyáknál (pl. 250 = 2.5x)"
                                        name="starting_ease"
                                        defaultValue={settings.starting_ease}
                                        min={130}
                                        max={999}
                                        error={errors.starting_ease}
                                    />
                                    <SettingField
                                        id="easy_bonus"
                                        label="Könnyű bónusz"
                                        description="Extra szorzó a 'Könnyű' gombhoz (pl. 130 = 1.3x)"
                                        name="easy_bonus"
                                        defaultValue={settings.easy_bonus}
                                        min={100}
                                        max={999}
                                        error={errors.easy_bonus}
                                    />
                                    <SettingField
                                        id="hard_interval_modifier"
                                        label="Nehéz szorzó"
                                        description="'Nehéz' gomb esetén az intervallum szorzója (pl. 120 = 1.2x)"
                                        name="hard_interval_modifier"
                                        defaultValue={settings.hard_interval_modifier}
                                        min={100}
                                        max={999}
                                        error={errors.hard_interval_modifier}
                                    />
                                    <SettingField
                                        id="interval_modifier"
                                        label="Globális intervallum szorzó"
                                        description="Minden intervallumra alkalmazott szorzó (100 = 1.0x, nincs változás)"
                                        name="interval_modifier"
                                        defaultValue={settings.interval_modifier}
                                        min={10}
                                        max={999}
                                        error={errors.interval_modifier}
                                    />
                                </div>
                            </div>

                            {/* Max interval */}
                            <div className="space-y-4">
                                <SectionHeading
                                    title="Intervallum korlát"
                                    description="A maximális szünet két ismétlés között"
                                />
                                <SettingField
                                    id="max_interval"
                                    label="Maximum intervallum"
                                    name="max_interval"
                                    defaultValue={settings.max_interval}
                                    min={1}
                                    max={36500}
                                    suffix="nap"
                                    error={errors.max_interval}
                                />
                            </div>

                            {/* Lapse settings */}
                            <div className="space-y-4">
                                <SectionHeading
                                    title="Felejtés"
                                    description="Mi történjen, ha nem emlékszel egy kártyára"
                                />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="lapse_new_interval"
                                        label="Új intervallum felejtés után"
                                        description="A korábbi intervallum hány %-át tartsa meg (0 = teljesen visszaáll)"
                                        name="lapse_new_interval"
                                        defaultValue={settings.lapse_new_interval}
                                        min={0}
                                        max={100}
                                        suffix="%"
                                        error={errors.lapse_new_interval}
                                    />
                                    <SettingField
                                        id="leech_threshold"
                                        label="Leech határ"
                                        description="Hányszor felejtve legyen 'leech'-nek (problémás kártya) jelölve"
                                        name="leech_threshold"
                                        defaultValue={settings.leech_threshold}
                                        min={1}
                                        max={99}
                                        suffix="x"
                                        error={errors.leech_threshold}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button disabled={processing}>Mentés</Button>
                                <Transition
                                    show={recentlySuccessful}
                                    enter="transition ease-in-out"
                                    enterFrom="opacity-0"
                                    leave="transition ease-in-out"
                                    leaveTo="opacity-0"
                                >
                                    <p className="text-sm text-neutral-600">Mentve</p>
                                </Transition>
                            </div>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}

FlashcardSettingsPage.layout = {
    breadcrumbs: [
        {
            title: 'Flashcard beállítások',
            href: edit(),
        },
    ],
};
