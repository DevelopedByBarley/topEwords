import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Check, Chrome, Clock, Puzzle, X } from 'lucide-react';
import { useState } from 'react';
import { useExtensionInstalled } from '@/hooks/use-extension-installed';

const DISMISS_KEY = 'topwords_ext_banner_dismissed';

/**
 * A bővítmény telepítésére hívó banner a dashboardon. A CTA a Chrome Web
 * Store-listingre visz, ha a `CHROME_WEB_STORE_URL` env-kulcs be van állítva;
 * addig „hamarosan" állapotot mutat. A fejlesztői .zip letöltése szándékosan
 * nincs itt: az admin-only, a /downloads oldalon érhető el.
 */
export function ExtensionBanner() {
    const { extensionStoreUrl } = usePage().props;
    const installed = useExtensionInstalled();
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(DISMISS_KEY) === '1',
    );

    if (installed === null || installed || dismissed) {
        return null;
    }

    function dismiss() {
        localStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    }

    const benefits: React.ReactNode[] = [
        'Azonnali fordítás dupla kattintással, kiejtéssel',
        'Tanult szavak kiemelése bármely oldalon',
        'Gyors kereső (Ctrl+Shift+F) AI-kitöltéssel',
        'YouTube- és Netflix-feliratok színezése és átirat',
    ];

    return (
        <div className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-linear-to-br from-blue-50 via-indigo-50 to-blue-100 p-5 shadow-lg shadow-blue-500/10 dark:border-blue-900/50 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-blue-950/20">
            {/* decorative glow */}
            <div className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/10" />

            <button
                onClick={dismiss}
                className="absolute top-3 right-3 z-10 rounded-md p-1.5 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-200"
                aria-label="Bezárás"
                title="Ne mutasd újra"
            >
                <X className="size-4" />
            </button>

            <div className="relative flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30">
                    <Puzzle className="size-6 text-white" />
                </div>
                <div className="pr-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-blue-950 dark:text-blue-100">
                            Telepítsd a TopWords böngészőbővítményt
                        </p>
                        <span className="inline-flex items-center rounded-full bg-linear-to-br from-green-400 to-green-500 px-2 py-0.5 text-[10px] font-bold tracking-wide text-green-950 uppercase">
                            Ingyenes
                        </span>
                    </div>
                    <p className="text-sm text-blue-800/80 dark:text-blue-300">
                        Szótanulás a böngészésben — weboldalakon, YouTube-on és
                        Netflixen is.
                    </p>
                </div>
            </div>

            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {benefits.map((text, i) => (
                    <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-blue-900/85 dark:text-blue-200"
                    >
                        <Check className="mt-0.5 size-4 shrink-0 text-blue-500 dark:text-blue-400" />
                        <span>{text}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {extensionStoreUrl ? (
                    <a
                        href={extensionStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-linear-to-br from-green-400 to-green-500 px-4 py-2 text-sm font-bold text-green-950 shadow-[0_4px_0_0_var(--color-green-600)] transition-all hover:brightness-105 active:translate-y-0.75"
                    >
                        <Chrome className="size-4" />
                        Telepítés a Chrome Web Store-ból
                    </a>
                ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-blue-300 bg-white/60 px-4 py-2 text-sm font-semibold text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
                        <Clock className="size-4" />
                        Hamarosan a Chrome Web Store-ban
                    </span>
                )}
                <Link
                    href="/handbook#extension"
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
                >
                    <BookOpen className="size-4" />
                    Mit tud a bővítmény?
                </Link>
            </div>
        </div>
    );
}
