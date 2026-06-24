import { BookMarked, CheckCheck, Clock, Mic, PenLine } from 'lucide-react';

export type WordStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | 'practice' | null;

export interface Word {
    id: number;
    word: string;
    rank: number;
    meaning_hu: string | null;
    extra_meanings: string | null;
    synonyms: string | null;
    part_of_speech: string | null;
    form_base: string | null;
    verb_past: string | null;
    verb_past_participle: string | null;
    verb_present_participle: string | null;
    verb_third_person: string | null;
    is_irregular: number | null;
    noun_plural: string | null;
    adj_comparative: string | null;
    adj_superlative: string | null;
    example_en: string | null;
    example_hu: string | null;
    status: WordStatus;
    importance: number | null;
}

export interface CustomWord {
    id: number;
    word: string;
    meaning_hu: string | null;
    extra_meanings: string | null;
    synonyms: string | null;
    part_of_speech: string | null;
    example_en: string | null;
    example_hu: string | null;
    status: WordStatus;
    importance: number | null;
    form_base: string | null;
    verb_past: string | null;
    verb_past_participle: string | null;
    verb_present_participle: string | null;
    verb_third_person: string | null;
    is_irregular: boolean | null;
    noun_plural: string | null;
    adj_comparative: string | null;
    adj_superlative: string | null;
}

export type WordFormData = {
    word: string;
    meaning_hu: string;
    extra_meanings: string;
    synonyms: string;
    part_of_speech: string;
    example_en: string;
    example_hu: string;
    form_base: string;
    verb_past: string;
    verb_past_participle: string;
    verb_present_participle: string;
    verb_third_person: string;
    is_irregular: boolean;
    noun_plural: string;
    adj_comparative: string;
    adj_superlative: string;
    status: WordStatus;
    importance: number | null;
};

export const EMPTY_WORD_FORM: WordFormData = {
    word: '', meaning_hu: '', extra_meanings: '', synonyms: '',
    part_of_speech: '', example_en: '', example_hu: '',
    form_base: '', verb_past: '', verb_past_participle: '',
    verb_present_participle: '', verb_third_person: '',
    is_irregular: false, noun_plural: '', adj_comparative: '', adj_superlative: '',
    status: null, importance: null,
};

export function wordToFormData(w: Word | CustomWord): WordFormData {
    return {
        word: w.word,
        meaning_hu: w.meaning_hu ?? '',
        extra_meanings: w.extra_meanings ?? '',
        synonyms: w.synonyms ?? '',
        part_of_speech: w.part_of_speech ?? '',
        example_en: w.example_en ?? '',
        example_hu: w.example_hu ?? '',
        form_base: w.form_base ?? '',
        verb_past: w.verb_past ?? '',
        verb_past_participle: w.verb_past_participle ?? '',
        verb_present_participle: w.verb_present_participle ?? '',
        verb_third_person: w.verb_third_person ?? '',
        is_irregular: w.is_irregular === true || w.is_irregular === 1,
        noun_plural: w.noun_plural ?? '',
        adj_comparative: w.adj_comparative ?? '',
        adj_superlative: w.adj_superlative ?? '',
        status: w.status,
        importance: w.importance,
    };
}

export const POS_LABELS: Record<string, string> = {
    verb: 'ige',
    noun: 'főnév',
    adj: 'melléknév',
    adv: 'határozószó',
    prep: 'elöljáró',
    conj: 'kötőszó',
    det: 'névelő',
    pron: 'névmás',
    num: 'számnév',
    interj: 'indulatszó',
};

export const LEVELS = [
    { value: 1, label: 'Top 1 000' },
    { value: 2, label: '1 001 – 2 000' },
    { value: 3, label: '2 001 – 4 000' },
    { value: 4, label: '4 001 – 6 000' },
    { value: 5, label: '6 001 – 8 000' },
    { value: 6, label: '8 001 – 10 000' },
] as const;

export interface StatusConfigEntry {
    value: Exclude<WordStatus, null>;
    label: string;
    icon: typeof CheckCheck;
    pillActive: string;
    pillHover: string;
    rowBg: string;
    rowText: string;
    filterActive: string;
    filterHover: string;
}

export const STATUS_CONFIG: StatusConfigEntry[] = [
    {
        value: 'known', label: 'Tudom', icon: CheckCheck,
        pillActive: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
        pillHover: 'hover:bg-green-100 hover:text-green-700',
        rowBg: 'bg-green-50 dark:bg-green-950/20',
        rowText: 'text-green-700 decoration-green-400 dark:text-green-400',
        filterActive: 'bg-green-600 hover:bg-green-700',
        filterHover: 'hover:border-green-500 hover:text-green-700',
    },
    {
        value: 'learning', label: 'Tanulom', icon: Clock,
        pillActive: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
        pillHover: 'hover:bg-blue-100 hover:text-blue-700',
        rowBg: 'bg-blue-50 dark:bg-blue-950/20',
        rowText: 'text-blue-700 decoration-blue-400 dark:text-blue-400',
        filterActive: 'bg-blue-600 hover:bg-blue-700',
        filterHover: 'hover:border-blue-500 hover:text-blue-700',
    },
    {
        value: 'saved', label: 'Később', icon: BookMarked,
        pillActive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
        pillHover: 'hover:bg-orange-100 hover:text-orange-700',
        rowBg: 'bg-orange-50 dark:bg-orange-950/20',
        rowText: 'text-orange-700 decoration-orange-400 dark:text-orange-400',
        filterActive: 'bg-orange-500 hover:bg-orange-600',
        filterHover: 'hover:border-orange-500 hover:text-orange-700',
    },
    {
        value: 'pronunciation', label: 'Kiejtés', icon: Mic,
        pillActive: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
        pillHover: 'hover:bg-violet-100 hover:text-violet-700',
        rowBg: 'bg-violet-50 dark:bg-violet-950/20',
        rowText: 'text-violet-700 decoration-violet-400 dark:text-violet-400',
        filterActive: 'bg-gradient-to-br from-violet-500 to-violet-400 hover:bg-violet-700',
        filterHover: 'hover:border-violet-500 hover:text-violet-700',
    },
    {
        value: 'practice', label: 'Gyakorlásra', icon: PenLine,
        pillActive: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
        pillHover: 'hover:bg-rose-100 hover:text-rose-700',
        rowBg: 'bg-rose-50 dark:bg-rose-950/20',
        rowText: 'text-rose-700 decoration-rose-400 dark:text-rose-400',
        filterActive: 'bg-rose-600 hover:bg-rose-700',
        filterHover: 'hover:border-rose-500 hover:text-rose-700',
    },
];

export function statusRowBg(status: WordStatus): string {
    return STATUS_CONFIG.find((s) => s.value === status)?.rowBg ?? '';
}

export function statusRowText(status: WordStatus): string {
    return STATUS_CONFIG.find((s) => s.value === status)?.rowText ?? 'decoration-muted-foreground/40';
}

export function speak(word: string): void {
    if (!window.speechSynthesis) {
return;
}

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}
