import { Link, usePage } from '@inertiajs/react';
import { Sparkles, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onAiBudgetUpdate } from '@/lib/ai-budget';
import { pricing } from '@/routes';
import { edit as editSubscription } from '@/routes/subscription';
import type { AiBudgetWarning } from '@/types';

const STORAGE_KEY = 'tw-ai-budget-dismissed';

export default function AiBudgetBanner() {
    const { aiBudgetWarning, auth, billingEnabled } = usePage().props;
    const [dismissedKey, setDismissedKey] = useState<string | null>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    });
    const [live, setLive] = useState<{
        basedOn: AiBudgetWarning | null;
        value: AiBudgetWarning | null;
    } | null>(null);

    useEffect(
        () =>
            onAiBudgetUpdate((value) =>
                setLive({ basedOn: aiBudgetWarning, value }),
            ),
        [aiBudgetWarning],
    );

    const warning =
        live !== null && live.basedOn === aiBudgetWarning
            ? live.value
            : aiBudgetWarning;

    if (!warning) {
        return null;
    }

    const { level, remaining_percent, reset_at } = warning;
    const currentKey = `${level}:${reset_at}`;

    if (dismissedKey === currentKey) {
        return null;
    }

    function dismiss() {
        try {
            localStorage.setItem(STORAGE_KEY, currentKey);
        } catch {
            // localStorage nem elérhető — csak a jelen munkamenetre rejtjük el.
        }

        setDismissedKey(currentKey);
    }

    const isExhausted = level === 'exhausted';
    const resetDate = new Date(reset_at).toLocaleDateString('hu-HU');
    const isFree = auth.subscription?.plan === 'free';

    return (
        <div
            role="status"
            className={
                'flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b px-4 py-2 text-center text-xs ' +
                (isExhausted
                    ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
                    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200')
            }
        >
            {isExhausted ? (
                <TriangleAlert className="size-3.5 shrink-0" />
            ) : (
                <Sparkles className="size-3.5 shrink-0" />
            )}
            <span>
                {isExhausted ? (
                    <>
                        <strong>Elfogyott a havi AI-kereted.</strong> A szavak
                        AI-kitöltése és a szövegelemzés {resetDate}-ig nem
                        működik.
                    </>
                ) : (
                    <>
                        <strong>
                            Az AI-keretedből {remaining_percent}% maradt.
                        </strong>{' '}
                        Újraindul: {resetDate}.
                    </>
                )}
            </span>
            {billingEnabled && (
                <Link
                    href={isFree ? pricing() : editSubscription()}
                    className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
                >
                    {isFree ? 'Prémiummal nagyobb keret' : 'Keret részletei'}
                </Link>
            )}
            <button
                onClick={dismiss}
                aria-label="Bezárás"
                className={
                    'ml-1 shrink-0 rounded p-0.5 transition-colors ' +
                    (isExhausted
                        ? 'hover:bg-rose-200/60 dark:hover:bg-rose-900/40'
                        : 'hover:bg-amber-200/60 dark:hover:bg-amber-900/40')
                }
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
