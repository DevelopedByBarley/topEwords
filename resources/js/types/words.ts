import type { CheckCheck } from 'lucide-react';
import type { PaginationData } from '@/types/pagination';

export type WordStatus =
    | 'known'
    | 'learning'
    | 'saved'
    | 'pronunciation'
    | 'practice'
    | null;

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
    extra_forms: string | null;
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
    extra_forms: string;
    status: WordStatus;
    importance: number | null;
};

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
    /** A haladás-kártya statisztika-csempéjének gyűrűje, ha rá van szűrve. */
    tileRing: string;
}

export interface Folder {
    id: number;
    name: string;
    words_count: number;
}

export interface FlashcardDeck {
    id: number;
    name: string;
}

export interface WordFilterValues {
    search: string;
    letter: string;
    level: number | null;
    status: string;
    importance: number | null;
    folder: number | null;
    /** 'custom' = csak a saját szavak; üres = a teljes lista. */
    source: string;
    per_page: number;
}

/** Csak azokat a kulcsokat lehet módosítani, amelyeket a szülő navigate-je ismer. */
export type WordFilterPatch = Partial<WordFilterValues> & { page?: number };

/** A szólista-oldal lapozója — a Laravel-paginátor itt használt részhalmaza. */
export type PaginatedWords = Pick<
    PaginationData<Word>,
    'data' | 'current_page' | 'last_page' | 'per_page' | 'total' | 'links'
>;

/** A szólista-oldal státusz-számlálói (a teljes listára és a saját szavakra is). */
export interface WordStatusCounts {
    total: number;
    known: number;
    learning: number;
    saved: number;
    pronunciation: number;
    practice: number;
}

export interface WordsIndexPageProps {
    words: PaginatedWords;
    filters: WordFilterValues;
    stats: WordStatusCounts;
    customWords: CustomWord[];
    customStats: WordStatusCounts;
    markedPages: number[];
    completedPages: number[];
    markedLetters: string[];
    folders: Folder[];
    wordFolderIds: Record<number, number[]>;
    flashcardDecks: FlashcardDeck[];
}
