import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import FlashcardController, { edit } from '@/actions/App/Http/Controllers/Settings/FlashcardController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type Settings = {
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
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    name={name}
                    defaultValue={defaultValue}
                    min={min}
                    max={max}
                    className="w-32"
                />
                {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
            <InputError message={error} />
        </div>
    );
}

export default function FlashcardSettings({ settings }: { settings: Settings }) {
    const [steps, setSteps] = useState<number[]>(settings.learning_steps);

    const addStep = () => setSteps((prev) => [...prev, 10]);
    const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
    const updateStep = (i: number, val: number) =>
        setSteps((prev) => prev.map((s, idx) => (idx === i ? val : s)));

    return (
        <>
            <Head title="Flashcard beállítások" />
            <h1 className="sr-only">Flashcard beállítások</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Flashcard beállítások"
                    description="Szabályozd az ismétlési algoritmus paramétereit"
                />

                <Form
                    action={FlashcardController.update.url()}
                    method="put"
                    options={{ preserveScroll: true }}
                    className="space-y-8"
                >
                    {({ processing, recentlySuccessful, errors }) => (
                        <>
                            {/* Daily limits */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold">Napi korlátok</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="new_cards_per_day"
                                        label="Új kártyák / nap"
                                        description="Hány új kártyát mutasson naponta"
                                        name="new_cards_per_day"
                                        defaultValue={settings.new_cards_per_day}
                                        min={1}
                                        max={9999}
                                        error={errors.new_cards_per_day}
                                        suffix="db"
                                    />
                                    <SettingField
                                        id="max_reviews_per_day"
                                        label="Max ismétlések / nap"
                                        description="Maximális esedékes kártyaszám naponta"
                                        name="max_reviews_per_day"
                                        defaultValue={settings.max_reviews_per_day}
                                        min={1}
                                        max={9999}
                                        error={errors.max_reviews_per_day}
                                        suffix="db"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Learning steps */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-semibold">Tanulási lépések</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Percek sorozata, amelyen az új kártyák végigmennek tanulás közben
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center">
                                    {steps.map((step, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                            <Input
                                                type="number"
                                                name="learning_steps[]"
                                                value={step}
                                                onChange={(e) => updateStep(i, Number(e.target.value))}
                                                min={1}
                                                max={1440}
                                                className="w-20"
                                            />
                                            <span className="text-xs text-muted-foreground">perc</span>
                                            {steps.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeStep(i)}
                                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={addStep}>
                                        <Plus className="size-3.5 mr-1" />
                                        Lépés hozzáadása
                                    </Button>
                                </div>
                                <InputError message={errors['learning_steps']} />
                            </div>

                            <Separator />

                            {/* Graduation */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold">Végzés & könnyű intervallum</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="graduating_interval"
                                        label="Végzési intervallum"
                                        description='Intervallum, amivel a kártya "Jó" után kerül ismétlésbe'
                                        name="graduating_interval"
                                        defaultValue={settings.graduating_interval}
                                        min={1}
                                        max={365}
                                        error={errors.graduating_interval}
                                        suffix="nap"
                                    />
                                    <SettingField
                                        id="easy_interval"
                                        label="Könnyű intervallum"
                                        description='"Könnyű" értékelésnél alkalmazott intervallum'
                                        name="easy_interval"
                                        defaultValue={settings.easy_interval}
                                        min={1}
                                        max={365}
                                        error={errors.easy_interval}
                                        suffix="nap"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Ease factors */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold">Ease (könnyűségi) faktorok</h3>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    <SettingField
                                        id="starting_ease"
                                        label="Kezdő ease"
                                        description="Kezdeti könnyűségi faktor végzéskor (250 = 2,5×)"
                                        name="starting_ease"
                                        defaultValue={settings.starting_ease}
                                        min={130}
                                        max={999}
                                        error={errors.starting_ease}
                                        suffix="%"
                                    />
                                    <SettingField
                                        id="easy_bonus"
                                        label="Könnyű bónusz"
                                        description='"Könnyű" után az ease extra szorzója'
                                        name="easy_bonus"
                                        defaultValue={settings.easy_bonus}
                                        min={100}
                                        max={999}
                                        error={errors.easy_bonus}
                                        suffix="%"
                                    />
                                    <SettingField
                                        id="hard_interval_modifier"
                                        label="Nehéz intervallum"
                                        description='"Nehéz" értékelésnél alkalmazott szorzó'
                                        name="hard_interval_modifier"
                                        defaultValue={settings.hard_interval_modifier}
                                        min={100}
                                        max={999}
                                        error={errors.hard_interval_modifier}
                                        suffix="%"
                                    />
                                    <SettingField
                                        id="interval_modifier"
                                        label="Intervallum módosító"
                                        description="Általános szorzó minden intervallumra"
                                        name="interval_modifier"
                                        defaultValue={settings.interval_modifier}
                                        min={10}
                                        max={999}
                                        error={errors.interval_modifier}
                                        suffix="%"
                                    />
                                    <SettingField
                                        id="max_interval"
                                        label="Max intervallum"
                                        description="Maximális napok száma két ismétlés közt"
                                        name="max_interval"
                                        defaultValue={settings.max_interval}
                                        min={1}
                                        max={36500}
                                        error={errors.max_interval}
                                        suffix="nap"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Lapses */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold">Tévesztések</h3>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <SettingField
                                        id="lapse_new_interval"
                                        label="Tévesztés új intervallum"
                                        description="Az intervallum hány %-a maradjon meg tévesztés után"
                                        name="lapse_new_interval"
                                        defaultValue={settings.lapse_new_interval}
                                        min={0}
                                        max={100}
                                        error={errors.lapse_new_interval}
                                        suffix="%"
                                    />
                                    <SettingField
                                        id="leech_threshold"
                                        label="Leech küszöb"
                                        description="Ennyi tévesztés után a kártya leech-nek minősül"
                                        name="leech_threshold"
                                        defaultValue={settings.leech_threshold}
                                        min={1}
                                        max={99}
                                        error={errors.leech_threshold}
                                        suffix="tévesztés"
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Shuffle */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold">Sorrendbeállítás</h3>
                                <label className="flex cursor-pointer items-start gap-3">
                                    <input
                                        type="checkbox"
                                        name="shuffle_cards"
                                        defaultChecked={settings.shuffle_cards}
                                        value="1"
                                        className="mt-0.5 size-4 rounded border-input accent-primary cursor-pointer"
                                    />
                                    <div className="grid gap-0.5">
                                        <span className="text-sm font-medium">Kártyák keverése</span>
                                        <span className="text-xs text-muted-foreground">
                                            Bekapcsolva a rendszer véletlenszerű sorrendben mutatja a kártyákat — az új és az esedékes kártyákat egyaránt keverve. Kétoldalú kártyáknál az előlap és hátlap nem kerül egymás mellé.
                                        </span>
                                    </div>
                                </label>
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

FlashcardSettings.layout = {
    breadcrumbs: [
        {
            title: 'Flashcard beállítások',
            href: edit(),
        },
    ],
};
