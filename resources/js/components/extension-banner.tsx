import { Link } from '@inertiajs/react';
import { BookOpen, Check, Download, Puzzle, X } from 'lucide-react';
import { useState } from 'react';
import ChromeExtensionsLink from '@/components/chrome-extensions-link';
import { useExtensionInstalled } from '@/hooks/use-extension-installed';

const DOWNLOAD_URL = '/downloads/topwords-extension.zip';
const DISMISS_KEY = 'topwords_ext_banner_dismissed';

export function ExtensionBanner() {
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
        'YouTube-feliratok színezése és átirat',
    ];

    const steps: React.ReactNode[] = [
        'Töltsd le a .zip-et, és csomagold ki egy mappába',
        <>
            Nyisd meg: <ChromeExtensionsLink />
        </>,
        'Kapcsold be a Fejlesztői módot (jobb felső sarok)',
        'Kicsomagolt bővítmény betöltése → válaszd a kicsomagolt mappát',
    ];

    return (
        <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950/20">
            <button
                onClick={dismiss}
                className="absolute top-3 right-3 rounded-md p-1.5 text-violet-500 transition-colors hover:bg-violet-100 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-900/40 dark:hover:text-violet-200"
                aria-label="Bezárás"
                title="Ne mutasd újra"
            >
                <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40">
                    <Puzzle className="size-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <p className="font-semibold text-violet-900 dark:text-violet-100">
                        Telepítsd a TopWords böngészőbővítményt
                    </p>
                    <p className="text-sm text-violet-700 dark:text-violet-300">
                        Telepítsd, és élvezd az előnyeit — a szótanulás beépül a
                        mindennapi böngészésedbe.
                    </p>
                </div>
            </div>

            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                {benefits.map((text, i) => (
                    <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-violet-800 dark:text-violet-200"
                    >
                        <Check className="mt-0.5 size-4 shrink-0 text-violet-500 dark:text-violet-400" />
                        <span>{text}</span>
                    </li>
                ))}
            </ul>

            <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {steps.map((text, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-xs font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                            {i + 1}
                        </span>
                        <span className="text-violet-800 dark:text-violet-200">
                            {text}
                        </span>
                    </li>
                ))}
            </ol>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                    href={DOWNLOAD_URL}
                    download
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                >
                    <Download className="size-4" />
                    Bővítmény letöltése (.zip)
                </a>
                <Link
                    href="/guide#extension"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/30"
                >
                    <BookOpen className="size-4" />
                    Részletes útmutató
                </Link>
            </div>
        </div>
    );
}
