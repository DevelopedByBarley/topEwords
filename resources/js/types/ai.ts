export type AiBudgetWarning = {
    level: 'low' | 'exhausted';
    remaining_percent: number;
    reset_at: string;
};
