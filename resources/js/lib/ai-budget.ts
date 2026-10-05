import type { AiBudgetWarning } from '@/types';

const EVENT_NAME = 'ai-budget-updated';

export function absorbAiBudget(data: unknown): void {
    if (
        typeof data !== 'object' ||
        data === null ||
        !('ai_budget_warning' in data)
    ) {
        return;
    }

    const warning = (data as { ai_budget_warning: AiBudgetWarning | null })
        .ai_budget_warning;

    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: warning }));
}

export function onAiBudgetUpdate(
    handler: (warning: AiBudgetWarning | null) => void,
): () => void {
    const listener = (event: Event) => {
        handler((event as CustomEvent<AiBudgetWarning | null>).detail ?? null);
    };

    window.addEventListener(EVENT_NAME, listener);

    return () => window.removeEventListener(EVENT_NAME, listener);
}
