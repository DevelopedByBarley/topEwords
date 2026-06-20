import { Link, usePage } from '@inertiajs/react';
import { AlertCircle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { pricing } from '@/routes';

type ToastKind = 'error' | 'info';

interface Toast {
    kind: ToastKind;
    message: string;
}

const DISPLAY_MS = 8000;

/**
 * Globális flash üzenet megjelenítő — a backend `error` és `info` flash-eit
 * mutatja (pl. free csomag limit-üzenetek). Ha az üzenet csomagváltást
 * javasol, linket is kap az árak oldalra.
 */
export default function FlashToast() {
    const { flash, billingEnabled } = usePage().props;
    const [toast, setToast] = useState<Toast | null>(null);
    const [seen, setSeen] = useState<string | null>(null);

    const error = flash?.error ?? null;
    const info = flash?.info ?? null;
    const incoming: Toast | null = error
        ? { kind: 'error', message: error }
        : info
          ? { kind: 'info', message: info }
          : null;

    // Render közbeni state-igazítás (React-ajánlott minta effect helyett)
    if (incoming && incoming.message !== seen) {
        setSeen(incoming.message);
        setToast(incoming);
    }

    useEffect(() => {
        if (!toast) {
            return;
        }

        const timer = setTimeout(() => {
            setToast(null);
            setSeen(null);
        }, DISPLAY_MS);

        return () => clearTimeout(timer);
    }, [toast]);

    if (!toast) {
        return null;
    }

    const isUpgradeHint =
        billingEnabled &&
        /prémium|premium|csomag|frissíts/i.test(toast.message);

    return (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 animate-in duration-300 fade-in slide-in-from-bottom-4">
            <div
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-lg ${
                    toast.kind === 'error'
                        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                        : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                }`}
            >
                {toast.kind === 'error' ? (
                    <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                    <Info className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
                )}
                <div className="min-w-0 flex-1">
                    <p
                        className={`text-sm ${
                            toast.kind === 'error'
                                ? 'text-amber-800 dark:text-amber-200'
                                : 'text-blue-800 dark:text-blue-200'
                        }`}
                    >
                        {toast.message}
                    </p>
                    {toast.kind === 'error' && isUpgradeHint && (
                        <Link
                            href={pricing()}
                            className="mt-1.5 inline-block text-sm font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                        >
                            Csomagok megtekintése →
                        </Link>
                    )}
                </div>
                <button
                    onClick={() => setToast(null)}
                    className={`shrink-0 rounded-full p-1 transition-colors ${
                        toast.kind === 'error'
                            ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900'
                            : 'text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900'
                    }`}
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
