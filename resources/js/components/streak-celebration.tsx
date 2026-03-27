import { usePage } from '@inertiajs/react';
import { Flame } from 'lucide-react';
import { useEffect, useState } from 'react';

const popStyle: React.CSSProperties = {
    animation: 'streak-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
};

const outStyle: React.CSSProperties = {
    animation: 'streak-out 0.35s ease-in forwards',
};

const glowStyle: React.CSSProperties = {
    animation: 'streak-glow-pulse 1s ease-in-out infinite',
};

export default function StreakCelebration() {
    const { flash } = usePage().props;
    const streak = flash?.streakTriggered ?? null;

    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (!streak) {
            return;
        }

        setVisible(true);
        setExiting(false);

        const exitTimer = setTimeout(() => setExiting(true), 1800);
        const hideTimer = setTimeout(() => setVisible(false), 2150);

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(hideTimer);
        };
    }, [streak]);

    if (!visible || !streak) {
        return null;
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div style={exiting ? outStyle : popStyle}>
                <div className="flex flex-col items-center gap-3">
                    <div className="relative flex items-center justify-center">
                        <div
                            className="absolute size-36 rounded-full bg-orange-400/30 blur-2xl"
                            style={glowStyle}
                        />
                        <Flame className="relative size-28 text-orange-500 drop-shadow-[0_0_24px_rgba(249,115,22,0.8)]" />
                    </div>
                    <div className="text-center">
                        <div className="text-7xl font-black tabular-nums text-orange-500 drop-shadow-[0_2px_8px_rgba(249,115,22,0.5)]">
                            {streak}
                        </div>
                        <div className="mt-1 text-xl font-bold text-orange-600 dark:text-orange-400">
                            napos sorozat!
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
