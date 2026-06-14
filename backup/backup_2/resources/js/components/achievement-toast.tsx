import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

interface Achievement {
    key: string;
    title: string;
    description: string;
    icon: string;
    group: string;
}

export default function AchievementToast() {
    const { flash } = usePage().props;
    const achievements = flash?.achievements ?? [];
    // Use a stable string key so the effect reliably fires when new achievements arrive
    const achievementKeys = achievements.map((a) => a.key).join(',');

    const [queue, setQueue] = useState<Achievement[]>([]);
    const [current, setCurrent] = useState<Achievement | null>(null);
    const [exiting, setExiting] = useState(false);

    // Inertia flash (word status changes, custom words, deck creation)
    useEffect(() => {
        if (achievements.length > 0) {
            setQueue((prev) => [...prev, ...achievements]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [achievementKeys]);

    // Custom event (flashcard study — uses raw fetch, not Inertia)
    useEffect(() => {
        const handler = (e: Event) => {
            const incoming = (e as CustomEvent<Achievement[]>).detail ?? [];
            if (incoming.length > 0) {
                setQueue((prev) => [...prev, ...incoming]);
            }
        };
        window.addEventListener('achievements-unlocked', handler);
        return () => window.removeEventListener('achievements-unlocked', handler);
    }, []);

    const DISPLAY_MS = 4000;
    const EXIT_MS = 400;

    // Pick next item from queue when idle
    useEffect(() => {
        if (current !== null || queue.length === 0) return;
        const next = queue[0];
        setQueue((prev) => prev.slice(1));
        setExiting(false);
        setCurrent(next);
    }, [current, queue]);

    // Auto-dismiss timer — separate effect so setCurrent() doesn't cancel it
    useEffect(() => {
        if (!current) return;
        const exitTimer = setTimeout(() => setExiting(true), DISPLAY_MS);
        const hideTimer = setTimeout(() => setCurrent(null), DISPLAY_MS + EXIT_MS);
        return () => {
            clearTimeout(exitTimer);
            clearTimeout(hideTimer);
        };
    }, [current]);

    if (!current) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center">
            <div
                style={{
                    animation: exiting
                        ? `achievement-out ${EXIT_MS}ms ease-in forwards`
                        : 'achievement-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                }}
            >
                <div className="relative overflow-hidden rounded-2xl border-2 border-yellow-300 bg-white shadow-2xl shadow-yellow-200/60 dark:border-yellow-700 dark:bg-zinc-900 dark:shadow-yellow-900/30">
                    <div className="flex items-center gap-4 px-6 py-4">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-3xl shadow-inner dark:bg-yellow-900/40">
                            {current.icon}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
                                🏅 Teljesítmény feloldva!
                            </p>
                            <p className="text-lg font-bold text-foreground">{current.title}</p>
                            <p className="text-sm text-muted-foreground">{current.description}</p>
                        </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 w-full bg-yellow-100 dark:bg-yellow-950">
                        <div
                            className="h-1 bg-yellow-400 dark:bg-yellow-500"
                            style={{ animation: `achievement-progress ${DISPLAY_MS}ms linear forwards` }}
                        />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes achievement-in {
                    from { opacity: 0; transform: translateY(-24px) scale(0.92); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes achievement-out {
                    from { opacity: 1; transform: translateY(0) scale(1); }
                    to   { opacity: 0; transform: translateY(-16px) scale(0.95); }
                }
                @keyframes achievement-progress {
                    from { width: 100%; }
                    to   { width: 0%; }
                }
            `}</style>
        </div>
    );
}
