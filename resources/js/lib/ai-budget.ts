import type { AiBudgetWarning } from '@/types';

const EVENT_NAME = 'ai-budget-updated';

/**
 * Az AI-keret élő állapotának átadása a fejléc-sávnak. Az AI-keretet fogyasztó
 * végpontok válaszába az `ai.budget` middleware beteszi a hívás utáni
 * keret-állapotot (`ai_budget_warning`) — ezt kell minden AI-hívás után
 * átadni, különben a sáv csak a következő oldalváltáskor frissülne.
 *
 * A `null` érvényes érték: nincs mit jelezni, a sáv eltűnik. A kulcs hiánya
 * viszont (nem AI-válasz, hálózati hiba) nem jelent semmit — ilyenkor a
 * jelenlegi állapot marad érvényben.
 */
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

/**
 * Feliratkozás az élő keret-állapotra. A visszatérési érték leiratkoztat.
 */
export function onAiBudgetUpdate(
    handler: (warning: AiBudgetWarning | null) => void,
): () => void {
    const listener = (event: Event) => {
        handler((event as CustomEvent<AiBudgetWarning | null>).detail ?? null);
    };

    window.addEventListener(EVENT_NAME, listener);

    return () => window.removeEventListener(EVENT_NAME, listener);
}
