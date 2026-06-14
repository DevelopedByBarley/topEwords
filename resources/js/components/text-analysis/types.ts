import { BookOpen, FileText, Globe, Youtube } from 'lucide-react';

export type InputMode = 'text' | 'youtube' | 'url' | 'book';

export interface UserBook {
    id: number;
    title: string;
    file_type: string;
    total_pages: number;
}

export interface HistoryEntry {
    id: number;
    mode: InputMode;
    label: string;
    text: string;
    url?: string;
    date: string;
}

export type TokenStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | 'in_list' | 'not_in_list';

export type LookupResult =
    | { type: 'word'; id: number; word: string; meaning_hu: string | null; example_en: string | null; part_of_speech: string | null; rank: number; status: string | null }
    | { type: 'custom'; id: number; word: string; meaning_hu: string | null; example_en: string | null; part_of_speech: string | null; status: string | null }
    | { type: 'not_found'; word: string };

export interface UnknownWord {
    word: string;
    frequency: number;
    rank: number;
    meaning_hu: string;
}

export interface AnalysisResult {
    comprehension: number;
    totalWords: number;
    uniqueWords: number;
    knownCount: number;
    learningCount: number;
    tokenStatuses: Record<string, TokenStatus>;
    topUnknown: UnknownWord[];
}

export type CustomWordForm = {
    meaning_hu: string; extra_meanings: string; synonyms: string;
    part_of_speech: string; example_en: string; example_hu: string;
    verb_past: string; verb_past_participle: string;
    verb_present_participle: string; verb_third_person: string;
    is_irregular: boolean; noun_plural: string;
    adj_comparative: string; adj_superlative: string;
};

export const EMPTY_CUSTOM_WORD_FORM: CustomWordForm = {
    meaning_hu: '', extra_meanings: '', synonyms: '', part_of_speech: '',
    example_en: '', example_hu: '', verb_past: '', verb_past_participle: '',
    verb_present_participle: '', verb_third_person: '', is_irregular: false,
    noun_plural: '', adj_comparative: '', adj_superlative: '',
};

export const STATUS_STYLES: Record<TokenStatus, string> = {
    known: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-300',
    learning: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300',
    saved: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300',
    pronunciation: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-300',
    in_list: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300',
    not_in_list: '',
};

export const POS_LABELS: Record<string, string> = {
    verb: 'ige', noun: 'főnév', adj: 'melléknév', adv: 'határozószó',
    prep: 'elöljáró', conj: 'kötőszó', det: 'névelő', pron: 'névmás',
    num: 'számnév', interj: 'indulatszó',
};

export const MODE_ICONS: Record<InputMode, React.ElementType> = {
    text: FileText, youtube: Youtube, url: Globe, book: BookOpen,
};

export const EXAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. Learning new words every day is one of the best investments you can make in your language skills. Reading books, articles, and other written materials helps you encounter words in context, which makes them much easier to remember.`;

const HISTORY_KEY = 'text_analysis_history';
const MAX_HISTORY = 10;
export const SESSION_KEY = 'text_analysis_session';

export function loadHistory(): HistoryEntry[] {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
        return [];
    }
}

export function saveHistory(entries: HistoryEntry[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'date'>) {
    const entries = loadHistory();
    const newEntry: HistoryEntry = { ...entry, id: Date.now(), date: new Date().toLocaleDateString('hu-HU') };
    const filtered = entries.filter((e) => e.label !== entry.label || e.mode !== entry.mode);
    saveHistory([newEntry, ...filtered].slice(0, MAX_HISTORY));
}

export function loadSession(): Partial<{ mode: InputMode; text: string; urlInput: string; fetchedSource: string | null; result: AnalysisResult | null }> {
    try {
        if (typeof window === 'undefined') return {};
        const params = new URLSearchParams(window.location.search);
        if (params.get('url')) return {};
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}');
    } catch {
        return {};
    }
}

export function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

export async function postJson(path: string, body: object): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken(), Accept: 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return { ok: response.ok, data };
}

export function computeTokenFrequencies(text: string): Record<string, number> {
    const frequencies: Record<string, number> = {};
    for (const match of text.match(/[a-zA-Z]+/g) ?? []) {
        const token = match.toLowerCase();
        frequencies[token] = (frequencies[token] ?? 0) + 1;
    }
    return frequencies;
}
