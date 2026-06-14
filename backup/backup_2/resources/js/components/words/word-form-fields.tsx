import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { POS_LABELS  } from '@/components/words/types';
import type {WordFormData} from '@/components/words/types';

interface WordFormFieldsProps {
    form: WordFormData;
    onChange: (form: WordFormData) => void;
    errors?: Record<string, string>;
    autoFocus?: boolean;
    /** Opcionális tartalom a szó/szófaj sor után (pl. AI kitöltés gomb) */
    afterWordSlot?: ReactNode;
}

export default function WordFormFields({ form, onChange, errors = {}, autoFocus = false, afterWordSlot }: WordFormFieldsProps) {
    const set = (patch: Partial<WordFormData>) => onChange({ ...form, ...patch });

    return (
        <>
            <div className="flex gap-2">
                <div className="flex-1">
                    <Input placeholder="Angol szó *" value={form.word} onChange={(e) => set({ word: e.target.value })} autoFocus={autoFocus} />
                    {errors.word && <p className="mt-1 text-xs text-destructive">{errors.word}</p>}
                </div>
                <Select value={form.part_of_speech} onValueChange={(v) => set({ part_of_speech: v })}>
                    <SelectTrigger className="w-36">
                        <SelectValue placeholder="Szófaj" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(POS_LABELS).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {afterWordSlot}

            <Input placeholder="Magyar jelentés" value={form.meaning_hu} onChange={(e) => set({ meaning_hu: e.target.value })} />
            <Input placeholder="További jelentések (pl. alternatív fordítások)" value={form.extra_meanings} onChange={(e) => set({ extra_meanings: e.target.value })} />
            <Input placeholder="Szinonimák (pl. consent, accept)" value={form.synonyms} onChange={(e) => set({ synonyms: e.target.value })} />
            <Input placeholder="Példamondat (angol)" value={form.example_en} onChange={(e) => set({ example_en: e.target.value })} />
            <Input placeholder="Példamondat (magyar)" value={form.example_hu} onChange={(e) => set({ example_hu: e.target.value })} />

            {form.part_of_speech === 'verb' && (
                <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Igealakok</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-muted-foreground">Alap (to ...)</label>
                            <Input placeholder="pl. agree" value={form.form_base} onChange={(e) => set({ form_base: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Múlt idő</label>
                            <Input placeholder="pl. agreed" value={form.verb_past} onChange={(e) => set({ verb_past: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Befejezett igenév</label>
                            <Input placeholder="pl. agreed" value={form.verb_past_participle} onChange={(e) => set({ verb_past_participle: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Folyamatos (-ing)</label>
                            <Input placeholder="pl. agreeing" value={form.verb_present_participle} onChange={(e) => set({ verb_present_participle: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">E/3 jelen</label>
                            <Input placeholder="pl. agrees" value={form.verb_third_person} onChange={(e) => set({ verb_third_person: e.target.value })} className="mt-1" />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input type="checkbox" checked={form.is_irregular} onChange={(e) => set({ is_irregular: e.target.checked })} className="rounded" />
                        Rendhagyó ige
                    </label>
                </div>
            )}

            {form.part_of_speech === 'noun' && (
                <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Főnév alakok</p>
                    <div>
                        <label className="text-xs text-muted-foreground">Többes szám</label>
                        <Input placeholder="pl. agreements" value={form.noun_plural} onChange={(e) => set({ noun_plural: e.target.value })} className="mt-1" />
                    </div>
                </div>
            )}

            {form.part_of_speech === 'adj' && (
                <div className="rounded-xl border bg-muted/30 px-4 py-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fokozás</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-muted-foreground">Középfok</label>
                            <Input placeholder="pl. better" value={form.adj_comparative} onChange={(e) => set({ adj_comparative: e.target.value })} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground">Felsőfok</label>
                            <Input placeholder="pl. best" value={form.adj_superlative} onChange={(e) => set({ adj_superlative: e.target.value })} className="mt-1" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
