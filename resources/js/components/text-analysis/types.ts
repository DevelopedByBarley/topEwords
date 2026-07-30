import { BookMarked, BookOpen, CheckCheck, Clock, FileText, Globe, HelpCircle, Mic, PenLine, Youtube } from 'lucide-react';

export type InputMode = 'text' | 'youtube' | 'url' | 'book';

export interface UserBook {
    id: number;
    title: string;
    file_type: string;
    total_pages: number;
}

/** Melyik lapozó-gomb tölt éppen — csak az forogjon, amit a felhasználó megnyomott. */
export type PageDirection = 'prev' | 'next' | null;

/** Egy YouTube-felirat időbélyeges sora: t = kezdés másodpercben, x = szöveg. */
export interface LyricSegment {
    t: number;
    x: string;
}

/** Egy elmentett YouTube-felirat (külön a könyvektől). */
export interface YoutubeTranscript {
    id: number;
    title: string;
    video_id: string;
    total_pages: number;
}

/** A teljes videó összesített megértési statisztikája. */
export interface VideoOverview {
    comprehension: number;
    totalWords: number;
    uniqueWords: number;
    knownCount: number;
    learningCount: number;
}

/** Másodperc → m:ss (vagy h:mm:ss) formátum. */
export function formatTimestamp(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);

    return (h > 0 ? `${h}:` : '') + `${mm}:${String(sec).padStart(2, '0')}`;
}

export interface HistoryEntry {
    id: number;
    mode: InputMode;
    label: string;
    text: string;
    url?: string;
    date: string;
}

export type TokenStatus = 'known' | 'learning' | 'saved' | 'pronunciation' | 'practice' | 'in_list' | 'not_in_list';

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
    /** Normalized multi-word phrase → status, for phrase-level highlighting. */
    phraseStatuses?: Record<string, TokenStatus>;
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

export interface TokenStatusMeta {
    /** A szóra kerülő kiemelés — üres, ha a státusz nem kap színt. */
    highlight: string;
    /** A jelmagyarázatban megjelenő megnevezés. */
    label: string;
    icon: React.ElementType;
    iconClass: string;
}

/**
 * A kiemelés-színek és a jelmagyarázat EGYETLEN forrása. A megnevezések és a
 * színcsaládok szándékosan a Szavak oldal `STATUS_CONFIG`-jával egyeznek: a
 * felhasználó ugyanazt a szót ugyanabban a színben látja mindkét felületen.
 */
export const TOKEN_STATUS_META: Record<TokenStatus, TokenStatusMeta> = {
    known: {
        highlight: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-300',
        label: 'Tudom',
        icon: CheckCheck,
        iconClass: 'text-green-500',
    },
    learning: {
        highlight: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300',
        label: 'Tanulom',
        icon: Clock,
        iconClass: 'text-blue-500',
    },
    in_list: {
        highlight: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300',
        label: 'Top 10 000, de ismeretlen',
        icon: BookOpen,
        iconClass: 'text-red-500',
    },
    saved: {
        highlight: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-300',
        label: 'Később',
        icon: BookMarked,
        iconClass: 'text-orange-500',
    },
    pronunciation: {
        highlight: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-300',
        label: 'Kiejtés',
        icon: Mic,
        iconClass: 'text-violet-500',
    },
    practice: {
        highlight: 'bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-300',
        label: 'Gyakorlásra',
        icon: PenLine,
        iconClass: 'text-rose-500',
    },
    not_in_list: {
        highlight: '',
        label: 'Tulajdonnév / ritka szó',
        icon: HelpCircle,
        iconClass: 'text-muted-foreground',
    },
};

/**
 * Mindig látható jelmagyarázat-elemek. A többi státusz (Később, Kiejtés,
 * Gyakorlásra) csak akkor jelenik meg, ha az adott szövegben elő is fordul —
 * így a jelmagyarázat nem hét csempével indul.
 */
export const ALWAYS_SHOWN_STATUSES: TokenStatus[] = ['known', 'learning', 'in_list', 'not_in_list'];

export const STATUS_STYLES: Record<TokenStatus, string> = Object.fromEntries(
    Object.entries(TOKEN_STATUS_META).map(([status, meta]) => [status, meta.highlight]),
) as Record<TokenStatus, string>;

export const POS_LABELS: Record<string, string> = {
    verb: 'ige', noun: 'főnév', adj: 'melléknév', adv: 'határozószó',
    prep: 'elöljáró', conj: 'kötőszó', det: 'névelő', pron: 'névmás',
    num: 'számnév', interj: 'indulatszó',
};

export const MODE_ICONS: Record<InputMode, React.ElementType> = {
    text: FileText, youtube: Youtube, url: Globe, book: BookOpen,
};

export const EXAMPLE_TEXT = `The quick brown fox jumps over the lazy dog. Learning new words every day is one of the best investments you can make in your language skills. Reading books, articles, and other written materials helps you encounter words in context, which makes them much easier to remember.`;

const MAX_HISTORY = 10;

// A tárolt előzmények, session-pillanatkép és könyvjelzők személyes tanulási
// adatok, ezért a tároló-kulcsokat a bejelentkezett user id-jével szkópoljuk:
// közös gépen a következő fiók nem látja az előző user szövegeit/pozícióit.
// A userId nélküli hívás (defenzív fallback) a régi közös kulcsra esik vissza.
function historyKey(userId?: number): string {
    return userId ? `text_analysis_history_u${userId}` : 'text_analysis_history';
}

export function sessionKey(userId?: number): string {
    return userId ? `text_analysis_session_u${userId}` : 'text_analysis_session';
}

export function loadHistory(userId?: number): HistoryEntry[] {
    try {
        return JSON.parse(localStorage.getItem(historyKey(userId)) ?? '[]');
    } catch {
        return [];
    }
}

export function saveHistory(entries: HistoryEntry[], userId?: number) {
    localStorage.setItem(historyKey(userId), JSON.stringify(entries));
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'date'>, userId?: number) {
    const entries = loadHistory(userId);
    const newEntry: HistoryEntry = { ...entry, id: Date.now(), date: new Date().toLocaleDateString('hu-HU') };
    const filtered = entries.filter((e) => e.label !== entry.label || e.mode !== entry.mode);
    saveHistory([newEntry, ...filtered].slice(0, MAX_HISTORY), userId);
}

export function loadSession(userId?: number): Partial<{ mode: InputMode; text: string; urlInput: string; fetchedSource: string | null; result: AnalysisResult | null }> {
    try {
        if (typeof window === 'undefined') {
            return {};
        }

        const params = new URLSearchParams(window.location.search);

        if (params.get('url')) {
            return {};
        }

        return JSON.parse(sessionStorage.getItem(sessionKey(userId)) ?? '{}');
    } catch {
        return {};
    }
}

export { postJson } from '@/lib/http';

export function computeTokenFrequencies(text: string): Record<string, number> {
    const frequencies: Record<string, number> = {};

    for (const match of text.match(/[a-zA-Z]+/g) ?? []) {
        const token = match.toLowerCase();
        frequencies[token] = (frequencies[token] ?? 0) + 1;
    }

    return frequencies;
}
