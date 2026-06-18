import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/**
 * A `chrome://extensions` cím nem lehet valódi link (a böngésző tiltja a
 * chrome:// hivatkozásokat weboldalról), ezért kattintásra a vágólapra másoljuk,
 * hogy a felhasználó beilleszthesse a címsorba.
 */
export default function ChromeExtensionsLink() {
    const [copied, setCopied] = useState(false);

    function copy() {
        navigator.clipboard?.writeText('chrome://extensions');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <button
            type="button"
            onClick={copy}
            title="Másolás a vágólapra"
            className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-accent"
        >
            chrome://extensions
            {copied ? (
                <Check className="size-3 text-green-500" />
            ) : (
                <Copy className="size-3 opacity-60" />
            )}
        </button>
    );
}
