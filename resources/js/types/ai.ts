/**
 * Az AI-keret figyelmeztetése. `null`, amíg nincs mit jelezni (a keret a
 * küszöb alatt van, vagy korlátlan). A `remaining_percent` a MARADÉK keret
 * felfelé kerekítve, így sosem 0, amíg van keret.
 */
export type AiBudgetWarning = {
    level: 'low' | 'exhausted';
    remaining_percent: number;
    reset_at: string;
};
