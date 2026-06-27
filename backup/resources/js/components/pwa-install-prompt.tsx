import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (localStorage.getItem(DISMISSED_KEY)) return;

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setVisible(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setVisible(false);
        localStorage.setItem(DISMISSED_KEY, '1');
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 rounded-xl border bg-card shadow-lg px-4 py-3">
                <img src="/pwa-192.png" alt="TopWords" className="size-10 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Telepítsd az appot</p>
                    <p className="text-xs text-muted-foreground">Használd offline is, főképernyőről</p>
                </div>
                <button
                    onClick={handleInstall}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                >
                    <Download className="size-3.5" />
                    Telepítés
                </button>
                <button
                    onClick={handleDismiss}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
                    aria-label="Bezárás"
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}
