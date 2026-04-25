import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { BookOpen, Puzzle, X } from 'lucide-react';
import { useExtensionInstalled } from '@/hooks/use-extension-installed';

const STORE_URL = 'https://chrome.google.com/webstore';
const DISMISS_KEY = 'topwords_ext_banner_dismissed';

export function ExtensionBanner() {
    const installed = useExtensionInstalled();
    const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

    if (installed === null || installed || dismissed) {
        return null;
    }

    function dismiss() {
        localStorage.setItem(DISMISS_KEY, '1');
        setDismissed(true);
    }

    return (
        <div className="hidden md:flex items-center gap-4 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/20">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <Puzzle className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-violet-900 dark:text-violet-100">Telepítsd a Chrome bővítményt</p>
                <p className="text-sm text-violet-700 dark:text-violet-300">
                    Jelölj meg szavakat bármelyik weboldalon egyetlen kattintással, vagy az{' '}
                    <kbd className="rounded border border-violet-300 dark:border-violet-600 bg-violet-100 dark:bg-violet-900/40 px-1 py-0.5 text-xs font-mono">
                        Alt+W
                    </kbd>
                    {' '}(Mac: <kbd className="rounded border border-violet-300 dark:border-violet-600 bg-violet-100 dark:bg-violet-900/40 px-1 py-0.5 text-xs font-mono">⌥W</kbd>) gyorsbillentyűvel.
                </p>
            </div>
            <Link
                href="/guide#extension"
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-700 px-3 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
            >
                <BookOpen className="size-4" />
                Hogyan működik?
            </Link>
            <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
            >
                Telepítés
            </a>
            <button
                onClick={dismiss}
                className="shrink-0 text-violet-400 hover:text-violet-600 dark:hover:text-violet-200 transition-colors"
                aria-label="Bezárás"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}
