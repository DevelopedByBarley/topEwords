import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { POS_LABELS } from '@/components/words/word-config';
import type { WordFormData } from '@/types/words';

interface WordFormFieldsProps {
    form: WordFormData;
    onChange: (form: WordFormData) => void;
    errors?: Record<string, string>;
    autoFocus?: boolean;
    /** Opcionális tartalom a szó/szófaj sor után (pl. AI kitöltés gomb) */
    afterWordSlot?: ReactNode;
}

/** A szóalak-mezőket tartalmazó szófajok, és az egyes blokkokhoz tartozó mezők. */
const FORM_POS = ['verb', 'noun', 'adj'] as const;
type FormPos = (typeof FORM_POS)[number];

const FORM_POS_FIELDS: Record<FormPos, Array<keyof WordFormData>> = {
    verb: [
        'form_base',
        'verb_past',
        'verb_past_participle',
        'verb_present_participle',
        'verb_third_person',
    ],
    noun: ['noun_plural'],
    adj: ['adj_comparative', 'adj_superlative'],
};

export default function WordFormFields({
    form,
    onChange,
    errors = {},
    autoFocus = false,
    afterWordSlot,
}: WordFormFieldsProps) {
    const set = (patch: Partial<WordFormData>) =>
        onChange({ ...form, ...patch });

    // Egy szó több szófaj alakjait is hordozhatja (pl. "interest" → főnév + igealakok),
    // mert a párosítás/kiemelés a szófajtól függetlenül mind a 9 alak-oszlopot olvassa.
    // Az elsődleges szófaj blokkja mindig látszik; a többi egy lenyíló alá kerül.
    const primaryPos = (FORM_POS as readonly string[]).includes(
        form.part_of_speech,
    )
        ? (form.part_of_speech as FormPos)
        : null;
    const otherPos = FORM_POS.filter((p) => p !== primaryPos);
    const hasOtherForms = otherPos.some((p) =>
        FORM_POS_FIELDS[p].some(
            (field) => String(form[field] ?? '').trim() !== '',
        ),
    );

    const [showOther, setShowOther] = useState(hasOtherForms);

    // Ha utólag (pl. AI-autofill) más szófaj alakjai töltődnek be, nyissuk ki a
    // lenyílót — különben a beküldött adat láthatatlan maradna. Csak nyitunk:
    // a felhasználó által kézzel kinyitott szekciót nem csukjuk vissza.
    useEffect(() => {
        if (hasOtherForms) {
            setShowOther(true);
        }
    }, [hasOtherForms]);

    const renderBlock = (pos: FormPos): ReactNode => {
        if (pos === 'verb') {
            return (
                <div
                    key="verb"
                    className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-4"
                >
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Igealakok
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-muted-foreground">
                                Alap (to ...)
                            </label>
                            <Input
                                placeholder="pl. agree"
                                value={form.form_base}
                                onChange={(e) =>
                                    set({ form_base: e.target.value })
                                }
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">
                                Múlt idő
                            </label>
                            <Input
                                placeholder="pl. agreed"
                                value={form.verb_past}
                                onChange={(e) =>
                                    set({ verb_past: e.target.value })
                                }
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">
                                Befejezett igenév
                            </label>
                            <Input
                                placeholder="pl. agreed"
                                value={form.verb_past_participle}
                                onChange={(e) =>
                                    set({
                                        verb_past_participle: e.target.value,
                                    })
                                }
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">
                                Folyamatos (-ing)
                            </label>
                            <Input
                                placeholder="pl. agreeing"
                                value={form.verb_present_participle}
                                onChange={(e) =>
                                    set({
                                        verb_present_participle: e.target.value,
                                    })
                                }
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">
                                E/3 jelen
                            </label>
                            <Input
                                placeholder="pl. agrees"
                                value={form.verb_third_person}
                                onChange={(e) =>
                                    set({ verb_third_person: e.target.value })
                                }
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
                        <input
                            type="checkbox"
                            checked={form.is_irregular}
                            onChange={(e) =>
                                set({ is_irregular: e.target.checked })
                            }
                            className="rounded"
                        />
                        Rendhagyó ige
                    </label>
                </div>
            );
        }

        if (pos === 'noun') {
            return (
                <div
                    key="noun"
                    className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-4"
                >
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Főnév alakok
                    </p>
                    <div>
                        <label className="text-xs text-muted-foreground">
                            Többes szám
                        </label>
                        <Input
                            placeholder="pl. agreements"
                            value={form.noun_plural}
                            onChange={(e) =>
                                set({ noun_plural: e.target.value })
                            }
                            className="mt-1"
                        />
                    </div>
                </div>
            );
        }

        return (
            <div
                key="adj"
                className="flex flex-col gap-3 rounded-xl border bg-muted/30 px-4 py-4"
            >
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Fokozás
                </p>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-muted-foreground">
                            Középfok
                        </label>
                        <Input
                            placeholder="pl. better"
                            value={form.adj_comparative}
                            onChange={(e) =>
                                set({ adj_comparative: e.target.value })
                            }
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground">
                            Felsőfok
                        </label>
                        <Input
                            placeholder="pl. best"
                            value={form.adj_superlative}
                            onChange={(e) =>
                                set({ adj_superlative: e.target.value })
                            }
                            className="mt-1"
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="flex gap-2">
                <div className="flex-1">
                    <Input
                        placeholder="Angol szó *"
                        value={form.word}
                        onChange={(e) => set({ word: e.target.value })}
                        autoFocus={autoFocus}
                    />
                    {errors.word && (
                        <p className="mt-1 text-xs text-destructive">
                            {errors.word}
                        </p>
                    )}
                </div>
                <Select
                    value={form.part_of_speech}
                    onValueChange={(v) => set({ part_of_speech: v })}
                >
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Szófaj" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(POS_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {afterWordSlot}

            <div>
                <Input
                    placeholder="Magyar jelentés"
                    value={form.meaning_hu}
                    onChange={(e) => set({ meaning_hu: e.target.value })}
                />
                {errors.meaning_hu && (
                    <p className="mt-1 text-xs text-destructive">
                        {errors.meaning_hu}
                    </p>
                )}
            </div>
            <Input
                placeholder="További jelentések (pl. alternatív fordítások)"
                value={form.extra_meanings}
                onChange={(e) => set({ extra_meanings: e.target.value })}
            />
            <Input
                placeholder="Szinonimák (pl. consent, accept)"
                value={form.synonyms}
                onChange={(e) => set({ synonyms: e.target.value })}
            />
            <Input
                placeholder="Példamondat (angol)"
                value={form.example_en}
                onChange={(e) => set({ example_en: e.target.value })}
            />
            <Input
                placeholder="Példamondat (magyar)"
                value={form.example_hu}
                onChange={(e) => set({ example_hu: e.target.value })}
            />

            {primaryPos && renderBlock(primaryPos)}

            <div className="flex flex-col gap-3">
                <button
                    type="button"
                    onClick={() => setShowOther((v) => !v)}
                    className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronDown
                        className={`size-3.5 transition-transform ${showOther ? '' : '-rotate-90'}`}
                    />
                    További alakok (más szófaj)
                </button>
                {showOther && otherPos.map((pos) => renderBlock(pos))}
            </div>
        </>
    );
}
