export function getXsrfToken(): string {
    const cookie = document.cookie.split('; ').find((r) => r.startsWith('XSRF-TOKEN='));

    return cookie ? decodeURIComponent(cookie.substring('XSRF-TOKEN='.length)) : '';
}

export type PrevState = {
    state: string;
    interval: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
    learning_step: number;
};

export type Review = {
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

export type AllReviewItem = {
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

export type Flashcard = {
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

export type Deck = {
    id: number;
    name: string;
    description: string | null;
};

export type OtherDeck = { id: number; name: string };

export type DeckSettings = {
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


export const DIRECTION_LABELS = {
    front_to_back: 'Előlap → Hátlap',
    back_to_front: 'Hátlap → Előlap',
    both: 'Mindkét irány',
};

export const STATE_LABELS: Record<string, string> = {
    new: 'Új',
    learning: 'Tanulás',
    review: 'Ismétlés',
    relearning: 'Újratanulás',
};

export const STATE_COLORS: Record<string, string> = {
    new: 'text-blue-500',
    learning: 'text-amber-500',
    review: 'text-green-500',
    relearning: 'text-orange-500',
};

export function stateBadgeClass(state: string): string {
    return ({
        new:        'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
        learning:   'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
        review:     'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
        relearning: 'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
    } as Record<string, string>)[state] ?? 'bg-muted text-muted-foreground';
}

export function stateLabelFull(state: string): string {
    return ({ new: 'Új kártya', learning: 'Tanulás', review: 'Ismétlés', relearning: 'Újratanulás' } as Record<string, string>)[state] ?? state;
}

export function plainText(html: string, maxLen = 80): string {
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export function formatDue(dueAt: string | null, state: string, now: number): string {
    if (state === 'new' || dueAt === null) {
return 'most esedékes';
}

    const diff = Math.round((new Date(dueAt).getTime() - now) / 1000);

    if (diff <= 0) {
return 'most esedékes';
}

    if (diff < 60) {
return `${diff} mp múlva`;
}

    if (diff < 3600) {
return `${Math.round(diff / 60)} perc múlva`;
}

    if (diff < 86400) {
return `${Math.round(diff / 3600)} óra múlva`;
}

    const days = Math.round(diff / 86400);

    return `${days} nap múlva`;
}

export const DIRECTION_OPTIONS = [
    { value: 'front_to_back', label: 'Elölap → Hátlap' },
    { value: 'back_to_front', label: 'Hátlap → Elölap' },
    { value: 'both', label: 'Mindkét irány' },
] as const;


export const STATE_FILTER_OPTIONS = [
    { value: '', label: 'Összes' },
    { value: 'new', label: 'Új' },
    { value: 'learning', label: 'Tanulás' },
    { value: 'review', label: 'Ismétlés' },
    { value: 'relearning', label: 'Újratanulás' },
] as const;


export type WordResult = { id: number; word: string; meaning_hu: string | null; is_custom: boolean };

