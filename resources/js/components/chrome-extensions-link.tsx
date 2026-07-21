import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export default function ChromeExtensionsLink() {
    const [copied, setCopied] = useState(false);

    function copy() {
        navigator.clipboard?.writeText('chrome://extensions');
        setCopied(true);
        setTimeout(() => setCopied(false), 6000);
    }

    return (
        <span className="inline-flex flex-col gap-1">
            <button
                type="button"
                onClick={copy}
                title="Másolás a vágólapra"
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 px-2 py-1 font-mono text-xs font-semibold text-indigo-800 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-200 dark:hover:bg-indigo-800/60"
            >
                {copied ? (
                    <Check className="size-3 shrink-0 text-green-500" />
                ) : (
                    <Copy className="size-3 shrink-0 opacity-60" />
                )}
                chrome://extensions
            </button>
            {copied && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 dark:text-green-400">
                    ✓ Másolta! Nyomj Ctrl+L-t, majd illeszd be (Ctrl+V)
                </span>
            )}
        </span>
    );
}
