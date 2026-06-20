import { FlaskConical, X } from 'lucide-react';
import { useState } from 'react';

const STORAGE_KEY = 'tw-beta-dismissed';

/**
 * „Béta / teszt üzemmód" jelzés. Elbocsátható, az állapot localStorage-ban marad,
 * így nem zaklatja a felhasználót minden oldalbetöltésnél.
 */
export default function BetaBanner() {
    const [hidden, setHidden] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    });

    if (hidden) {
        return null;
    }

    function dismiss() {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch {
            // localStorage nem elérhető — csak a jelen munkamenetre rejtjük el.
        }
        setHidden(true);
    }

    return (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <FlaskConical className="size-3.5 shrink-0" />
            <span>
                <strong>Béta / teszt üzemmód.</strong> A szolgáltatás kísérleti —
                a funkciók és az adatok változhatnak. Visszajelzést szívesen
                fogadunk.
            </span>
            <button
                onClick={dismiss}
                aria-label="Bezárás"
                className="ml-1 shrink-0 rounded p-0.5 transition-colors hover:bg-amber-200/60 dark:hover:bg-amber-900/40"
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
